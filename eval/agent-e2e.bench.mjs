// 端到端 agent 评测：真实 LLM 决策 + 真实浏览器操作 + 本地稳定 fixture + 自动判定。
// 复用扩展的 openaiStream 适配器与 pageAgent 感知层；用 Playwright 替代 CDP 执行动作。
// 这是 WebVoyager 精神的可复现本地版：衡量「感知层 + 提示词 + 真实模型」端到端能否完成任务。
//
//   EVAL_BASE_URL=https://host/v1 EVAL_API_KEY=sk-xxx EVAL_MODEL=gpt-5.4-mini npm run bench:e2e
//
// 缺少 EVAL_API_KEY 时跳过（退出 0），因为它需要真实 API。
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

const BASE_URL = process.env.EVAL_BASE_URL || '';
const API_KEY = process.env.EVAL_API_KEY || '';
const MODEL = process.env.EVAL_MODEL || 'gpt-5.4-mini';
const MAX_STEPS = 12;

if (!API_KEY || !BASE_URL) {
  console.log('⏭  跳过端到端评测：未设置 EVAL_API_KEY / EVAL_BASE_URL。');
  console.log('   用法：EVAL_BASE_URL=https://host/v1 EVAL_API_KEY=sk-xxx EVAL_MODEL=gpt-5.4-mini npm run bench:e2e');
  process.exit(0);
}

// ---------------- 本地 fixture 站点 ----------------

const PAGES = {
  '/cart': `<!doctype html><meta charset="utf-8"><title>Shop</title><body>
    <h1>商店</h1>
    <div class="grid">
      ${['无线鼠标|99', '机械键盘|349', '4K 显示器|1799', '降噪耳机|899']
        .map((s) => {
          const [name, price] = s.split('|');
          return `<div class="product"><span class="name">${name}</span><span class="price">¥${price}</span><button class="buy" data-name="${name}">加入购物车</button></div>`;
        })
        .join('\n')}
    </div>
    <div id="cart">购物车为空</div>
    <script>
      let items = [];
      document.querySelectorAll('.buy').forEach((b) => b.addEventListener('click', () => {
        items.push(b.dataset.name);
        document.getElementById('cart').textContent = '购物车: ' + items.join(', ');
      }));
    </script></body>`,

  '/cheapest': `<!doctype html><meta charset="utf-8"><title>Prices</title><body>
    <h1>报价单</h1>
    <ul class="list">
      <li class="row"><span class="n">A 型支架</span> <span class="p">¥129</span></li>
      <li class="row"><span class="n">B 型支架</span> <span class="p">¥89</span></li>
      <li class="row"><span class="n">C 型支架</span> <span class="p">¥215</span></li>
      <li class="row"><span class="n">D 型支架</span> <span class="p">¥156</span></li>
    </ul></body>`,

  '/search': `<!doctype html><meta charset="utf-8"><title>Search</title><body>
    <h1>搜索</h1>
    <input id="q" aria-label="搜索关键词" placeholder="输入关键词">
    <button id="go">搜索</button>
    <div id="result">尚未搜索</div>
    <script>
      document.getElementById('go').addEventListener('click', () => {
        const v = document.getElementById('q').value;
        document.getElementById('result').textContent = '搜索结果: ' + v;
      });
    </script></body>`,

  '/nav': `<!doctype html><meta charset="utf-8"><title>Catalog</title><body>
    <h1>目录</h1>
    <ul>
      <li>入门套装 ¥199 <a href="/product?name=starter">查看详情</a></li>
      <li>专业套装 ¥499 <a href="/product?name=pro">查看详情</a></li>
      <li>旗舰套装 ¥999 <a href="/product?name=flagship">查看详情</a></li>
    </ul></body>`,

  '/product': `<!doctype html><meta charset="utf-8"><title>Product</title><body><h1 id="pd">商品详情页</h1></body>`,
};

function startServer() {
  const server = http.createServer((req, res) => {
    const path = (req.url || '/').split('?')[0];
    const body = PAGES[path];
    if (body == null) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body);
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, port: server.address().port })));
}

// ---------------- 任务集（含 ground-truth 判定） ----------------

const tasks = [
  {
    name: '点击加入购物车并确认',
    start: '/cart',
    goal: '把「机械键盘」加入购物车，然后用一句话告诉我购物车里现在有什么。',
    async judge(page, answer) {
      const cart = await page.evaluate(() => document.getElementById('cart')?.textContent || '');
      return { pass: cart.includes('机械键盘'), detail: `购物车="${cart}"` };
    },
  },
  {
    name: '结构化数据问答（最便宜）',
    start: '/cheapest',
    goal: '这张报价单里最便宜的是哪一款？只回答商品名称。',
    async judge(_page, answer) {
      return { pass: /B\s*型支架/.test(answer), detail: `回答="${answer.slice(0, 60)}"` };
    },
  },
  {
    name: '表单填写并提交',
    start: '/search',
    goal: '在搜索框里输入 laptop 并点击搜索按钮。',
    async judge(page) {
      const result = await page.evaluate(() => document.getElementById('result')?.textContent || '');
      return { pass: /laptop/i.test(result), detail: `result="${result}"` };
    },
  },
  {
    name: '多步导航到指定商品',
    start: '/nav',
    goal: '打开「专业套装」的详情页。',
    async judge(page) {
      const url = page.url();
      return { pass: /name=pro\b/.test(url), detail: `url=${url}` };
    },
  },
];

// ---------------- agent 工具集 ----------------

const SYSTEM = `You are a browser agent operating a live web page through tools. The current model has no vision — perceive the page ONLY through tools.
Rules:
1. Call read_page (or find for a targeted search) FIRST to get element refs, then act via click(ref) / form_input(ref,value). Never invent refs.
2. Use extract_data for lists/tables (mode "tables", "links", or "selector"+"fields"); use get_page_text for prose.
3. After an action, re-read the page to verify the result.
4. When the task is complete, reply with a SHORT final answer in plain text and DO NOT call any more tools.
Keep going with tools until the task is actually done.`;

const TOOLS = [
  { name: 'read_page', description: 'List interactive elements with refs, roles, names.', schema: { type: 'object', properties: {} } },
  { name: 'find', description: 'Find elements matching a text query; returns refs.', schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'click', description: 'Click an element by ref (from read_page/find).', schema: { type: 'object', properties: { ref: { type: 'string' } }, required: ['ref'] } },
  { name: 'form_input', description: 'Set a form field value by ref.', schema: { type: 'object', properties: { ref: { type: 'string' }, value: { type: 'string' } }, required: ['ref', 'value'] } },
  { name: 'get_page_text', description: 'Get the readable text of the page.', schema: { type: 'object', properties: {} } },
  {
    name: 'extract_data',
    description: 'Extract structured data. mode "tables"|"links"|"selector"(+selector,fields).',
    schema: { type: 'object', properties: { mode: { type: 'string' }, selector: { type: 'string' }, fields: { type: 'object', additionalProperties: { type: 'string' } } } },
  },
];

function textOf(blocks) {
  return blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

async function main() {
  // openaiStream（esm）
  await esbuild.build({ entryPoints: ['eval/providers.entry.ts'], bundle: true, format: 'esm', platform: 'node', outfile: 'dist-test/eval-providers.mjs', logLevel: 'error' });
  const { openaiStream } = await import(pathToFileURL(process.cwd() + '/dist-test/eval-providers.mjs').href);
  // pageAgent（iife 注入串）
  const pa = await esbuild.build({ entryPoints: ['test/e2e/pageAgent.entry.ts'], bundle: true, format: 'iife', write: false, logLevel: 'error' });
  const pageAgentJs = pa.outputFiles[0].text;

  const { server, port } = await startServer();
  const origin = `http://127.0.0.1:${port}`;
  const provider = { id: 'eval', name: 'Eval', baseUrl: BASE_URL, apiKey: API_KEY };
  const model = { id: 'eval/' + MODEL, providerId: 'eval', model: MODEL, label: MODEL, vision: false };

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const task of tasks) {
      const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
      let steps = 0;
      let answer = '';
      let err = null;
      try {
        await page.goto(origin + task.start, { waitUntil: 'load' });
        await page.addScriptTag({ content: pageAgentJs });
        const pageCall = (cmd, payload) => page.evaluate(([c, p]) => window.__pageAgent(c, p), [cmd, payload ?? null]);

        async function execTool(name, input) {
          switch (name) {
            case 'read_page': {
              const r = await pageCall('read_page', { filter: 'interactive', max_chars: 8000 });
              return String(r?.text ?? '(empty)');
            }
            case 'find':
              return String((await pageCall('find', { query: String(input.query ?? '') }))?.text ?? '');
            case 'get_page_text':
              return String(await page.evaluate(() => document.body?.innerText || '')).slice(0, 8000);
            case 'extract_data': {
              const r = await pageCall('extract', { mode: input.mode, selector: input.selector, fields: input.fields });
              return JSON.stringify(r).slice(0, 8000);
            }
            case 'form_input':
              return String((await pageCall('form_input', { ref: input.ref, value: String(input.value ?? '') }))?.text ?? 'ok');
            case 'click': {
              const r = await pageCall('scroll_to', { ref: input.ref });
              if (!r || typeof r.x !== 'number') return `click failed: unknown ref ${input.ref}`;
              const before = page.url();
              await page.mouse.click(r.x, r.y);
              await page.waitForTimeout(400);
              if (page.url() !== before) {
                await page.addScriptTag({ content: pageAgentJs }).catch(() => {});
                return `clicked; navigated to ${page.url()}`;
              }
              return `clicked ${input.ref}`;
            }
            default:
              return `unknown tool ${name}`;
          }
        }

        const messages = [{ role: 'user', content: [{ type: 'text', text: task.goal }] }];
        for (; steps < MAX_STEPS; steps++) {
          const res = await openaiStream({
            provider, model, system: SYSTEM, messages, tools: TOOLS,
            temperature: null, maxTokens: 1024, signal: new AbortController().signal, timeoutMs: 90000, retries: 2, onText: () => {},
          });
          const blocks = res.blocks.length ? res.blocks : [{ type: 'text', text: '(empty)' }];
          messages.push({ role: 'assistant', content: blocks });
          const toolUses = blocks.filter((b) => b.type === 'tool_use');
          if (!toolUses.length) {
            answer = textOf(blocks);
            break;
          }
          const out = [];
          for (const tu of toolUses) {
            let text;
            try {
              text = await execTool(tu.name, tu.input || {});
            } catch (e) {
              text = `error: ${e.message}`;
            }
            out.push({ type: 'tool_result', toolUseId: tu.id, toolName: tu.name, content: [{ type: 'text', text }] });
          }
          messages.push({ role: 'user', content: out });
        }
      } catch (e) {
        err = e;
      }

      let verdict;
      try {
        verdict = err ? { pass: false, detail: `异常：${err.message}` } : await task.judge(page, answer);
      } catch (e) {
        verdict = { pass: false, detail: `判定异常：${e.message}` };
      }
      results.push({ name: task.name, steps, ...verdict });
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const bar = '─'.repeat(60);
  console.log(`\n端到端 agent 评测  (模型 ${MODEL})\n${bar}`);
  for (const r of results) console.log(`${r.pass ? '✔' : '✖'}  ${r.name.padEnd(24)} [${r.steps}步] ${r.detail}`);
  console.log(bar);
  console.log(`通过 ${passed}/${total} (${((passed / total) * 100).toFixed(0)}%)\n`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
