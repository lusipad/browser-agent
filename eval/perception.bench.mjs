// 感知层基准评测：用多样真实前端结构的 fixture + ground-truth，量化
// read_page / find / extract_data / wait_for 的可靠性——这是端到端任务
// 成功率的地基，且无需真实 API，可在 CI 全自动回归。
//
//   npm run bench            跑全部任务并打印通过率（有失败则非零退出）
//   npm run bench -- --json  额外输出 JSON 结果
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

// ---------------- fixtures ----------------

const PRODUCTS = `<!doctype html><meta charset="utf-8"><body>
<div class="grid">
  ${['无线鼠标|99|1', '机械键盘|349|2', '4K 显示器|1799|3', 'USB-C 扩展坞|259|4', '人体工学椅|1299|5', '降噪耳机|899|6']
    .map((s) => {
      const [name, price, id] = s.split('|');
      return `<article class="product"><h3 class="name">${name}</h3><span class="price">¥${price}</span><a class="buy" href="https://shop.example/p/${id}">加入购物车</a></article>`;
    })
    .join('\n')}
</div></body>`;

const TABLE = `<!doctype html><meta charset="utf-8"><body>
<table>
  <caption>季度营收</caption>
  <thead><tr><th>季度</th><th>营收</th><th>同比</th></tr></thead>
  <tbody>
    <tr><td>Q1</td><td>120</td><td>+8%</td></tr>
    <tr><td>Q2</td><td>135</td><td>+12%</td></tr>
    <tr><td>Q3</td><td>150</td><td>+11%</td></tr>
    <tr><td>Q4</td><td>180</td><td>+20%</td></tr>
  </tbody>
</table></body>`;

const SHADOW_IFRAME = `<!doctype html><meta charset="utf-8"><body>
<button id="top">Top Action</button>
<div id="host"></div>
<iframe id="frm" srcdoc="<body><input id='q' aria-label='站内搜索' placeholder='站内搜索'><button>iframe 提交</button></body>" style="border:0;width:320px;height:120px"></iframe>
<script>
  const sr = document.getElementById('host').attachShadow({ mode: 'open' });
  sr.innerHTML = '<button>Shadow Action</button>';
</script></body>`;

const DYNAMIC = `<!doctype html><meta charset="utf-8"><body>
<div id="status">加载中…</div>
<script>setTimeout(() => { document.getElementById('status').textContent = '加载完成 · 结果就绪'; }, 700);</script>
</body>`;

const COMPLEX = `<!doctype html><meta charset="utf-8"><body>
<nav><a href="/">首页</a><a href="/about">关于</a></nav>
<header><button>登录</button><button>注册</button></header>
<main>
  <section><h2>商品详情</h2>
    <button class="fav">收藏</button>
    <button class="cart">加入购物车</button>
    <button class="buy-now">立即购买</button>
  </section>
</main>
<footer><a href="/help">帮助中心</a></footer></body>`;

// ---------------- 任务定义（含 ground-truth 校验） ----------------

const tasks = [
  {
    name: '电商卡片抽取（extract selector+fields）',
    html: PRODUCTS,
    async run(call) {
      return call('extract', { mode: 'selector', selector: 'article.product', fields: { name: '.name', price: '.price', link: '.buy@href' } });
    },
    check(r) {
      if (r.count !== 6) return { pass: false, detail: `期望 6 条，实际 ${r.count}` };
      const first = r.items[0];
      const ok = first.name === '无线鼠标' && first.price === '¥99' && first.link === 'https://shop.example/p/1';
      const allFields = r.items.every((i) => i.name && i.price && /^https?:/.test(i.link || ''));
      return { pass: ok && allFields, detail: ok && allFields ? '6 条商品，name/price/link 齐全' : `首条=${JSON.stringify(first)}` };
    },
  },
  {
    name: '数据表格解析（extract tables）',
    html: TABLE,
    async run(call) {
      return call('extract', { mode: 'tables' });
    },
    check(r) {
      const t = r.tables?.[0];
      if (!t) return { pass: false, detail: '未解析到表格' };
      const headersOk = JSON.stringify(t.headers) === JSON.stringify(['季度', '营收', '同比']);
      const rowsOk = t.rows.length === 4 && JSON.stringify(t.rows[3]) === JSON.stringify(['Q4', '180', '+20%']);
      const capOk = t.caption === '季度营收';
      return { pass: headersOk && rowsOk && capOk, detail: `caption=${t.caption} headers=${t.headers} rows=${t.rows.length}` };
    },
  },
  {
    name: 'Shadow / 同源 iframe 穿透（read_page）',
    html: SHADOW_IFRAME,
    waitFrame: true,
    async run(call) {
      return call('read_page', { filter: 'interactive', max_chars: 40000 });
    },
    check(r) {
      const els = r.elements || [];
      const shadowBtn = els.find((e) => e.src === 'shadow' && /Shadow Action/.test(e.name || ''));
      const iframeInput = els.find((e) => e.src === 'iframe' && e.role === 'textbox');
      const iframeBtn = els.find((e) => e.src === 'iframe' && /iframe 提交/.test(e.name || ''));
      const hits = [shadowBtn && 'shadow-btn', iframeInput && 'iframe-input', iframeBtn && 'iframe-btn'].filter(Boolean);
      return { pass: !!(shadowBtn && iframeInput && iframeBtn), detail: `命中 ${hits.join(', ') || '无'}` };
    },
  },
  {
    name: '动态内容等待（wait_for text 轮询）',
    html: DYNAMIC,
    async run(call) {
      const start = Date.now();
      while (Date.now() - start < 5000) {
        const r = await call('probe', { query: '', text: '结果就绪' });
        if (r.textFound) return { textFound: true, waited: Date.now() - start };
        await new Promise((res) => setTimeout(res, 200));
      }
      return { textFound: false, waited: Date.now() - start };
    },
    check(r) {
      return { pass: r.textFound, detail: r.textFound ? `${(r.waited / 1000).toFixed(1)}s 后命中` : '超时未命中' };
    },
  },
  {
    name: '复杂页面元素定位（find）',
    html: COMPLEX,
    async run(call) {
      return call('find', { query: '加入购物车' });
    },
    check(r) {
      const top = (r.elements || [])[0];
      const pass = !!top && /加入购物车/.test(top.name || '');
      return { pass, detail: pass ? `首个命中「${top.name}」` : `首个=${top?.name ?? '无'}` };
    },
  },
];

// ---------------- 运行 ----------------

async function main() {
  const built = await esbuild.build({
    entryPoints: ['test/e2e/pageAgent.entry.ts'],
    bundle: true,
    format: 'iife',
    write: false,
    logLevel: 'error',
  });
  const bundle = built.outputFiles[0].text;

  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const task of tasks) {
      const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
      try {
        await page.setContent(task.html, { waitUntil: 'load' });
        if (task.waitFrame) {
          await page.waitForFunction(() => {
            const f = document.querySelector('iframe');
            return !f || !!(f.contentDocument && f.contentDocument.querySelector('button'));
          });
        }
        await page.addScriptTag({ content: bundle });
        const call = (cmd, payload) => page.evaluate(([c, p]) => window.__pageAgent(c, p), [cmd, payload ?? null]);
        const raw = await task.run(call);
        if (raw && raw.__error) throw new Error(raw.__error);
        const verdict = task.check(raw);
        results.push({ name: task.name, ...verdict });
      } catch (e) {
        results.push({ name: task.name, pass: false, detail: `异常：${e.message}` });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const bar = '─'.repeat(52);
  console.log(`\n感知层基准评测 (perception benchmark)\n${bar}`);
  for (const r of results) {
    console.log(`${r.pass ? '✔' : '✖'}  ${r.name.padEnd(34)} ${r.detail}`);
  }
  console.log(bar);
  const pct = ((passed / total) * 100).toFixed(0);
  console.log(`通过 ${passed}/${total} (${pct}%)\n`);

  if (process.argv.includes('--json')) console.log(JSON.stringify({ passed, total, results }, null, 2));
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
