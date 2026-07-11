// 真实 Chromium 里验证感知层 pageAgent：Shadow DOM 穿透、同源 iframe 穿透 +
// 顶层坐标换算、可见性、form_input 触发事件、probe。这是 jsdom 无法覆盖的部分。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

const FIXTURE = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font:16px sans-serif}</style></head><body>
  <button id="b1">Top Button</button>
  <a href="https://example.com" id="lnk">A Link</a>
  <label>Name <input id="name" type="text"></label>
  <select id="sel"><option>One</option><option>Two</option></select>
  <label><input type="checkbox" id="chk"> Accept Terms</label>
  <div id="spacer" style="height:1400px"></div>
  <button id="offscreen">Below Fold</button>
  <div id="ce"></div>
  <iframe id="frm" srcdoc="<body style='margin:0'><button>iframe-btn</button><input id='fi' type='text'></body>"
          style="position:absolute;top:420px;left:0;width:300px;height:150px;border:0"></iframe>
  <script>
    const sr = document.getElementById('ce').attachShadow({ mode: 'open' });
    sr.innerHTML = '<button>shadow-btn</button>';
  </script>
</body></html>`;

let browser;
let page;
let bundle;

before(async () => {
  const built = await esbuild.build({
    entryPoints: ['test/e2e/pageAgent.entry.ts'],
    bundle: true,
    format: 'iife',
    write: false,
    logLevel: 'error',
  });
  bundle = built.outputFiles[0].text;

  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent(FIXTURE, { waitUntil: 'load' });
  // 等 srcdoc iframe 内部就绪
  await page.waitForFunction(() => {
    const f = document.querySelector('iframe');
    return !!(f && f.contentDocument && f.contentDocument.querySelector('button'));
  });
  await page.addScriptTag({ content: bundle });
});

after(async () => {
  await browser?.close();
});

const call = (cmd, payload) => page.evaluate(([c, p]) => window.__pageAgent(c, p), [cmd, payload ?? null]);

test('read_page 收集基础可交互元素', async () => {
  const r = await call('read_page', { filter: 'full', max_chars: 60000 });
  assert.ok(!r.__error, r.__error);
  const els = r.elements;
  const byName = (s) => els.find((e) => (e.name || '').includes(s));
  assert.ok(byName('Top Button'), '找到顶层按钮');
  assert.ok(els.find((e) => e.role === 'link' && e.name.includes('A Link')), '找到链接');
  assert.ok(els.find((e) => e.role === 'textbox' && e.name.includes('Name')), '文本框带 label 名');
  assert.ok(els.find((e) => e.role === 'select'), '找到下拉');
  assert.ok(els.find((e) => e.role === 'checkbox' && e.name.includes('Accept')), '复选框带 label 名');
});

test('穿透 Shadow DOM', async () => {
  const r = await call('collect');
  const el = r.elements.find((e) => (e.name || '').includes('shadow-btn'));
  assert.ok(el, '找到 shadow DOM 内按钮');
  assert.equal(el.src, 'shadow', '来源标注为 shadow');
});

test('穿透同源 iframe 且坐标换算到顶层文档', async () => {
  const r = await call('collect');
  const btn = r.elements.find((e) => (e.name || '').includes('iframe-btn'));
  assert.ok(btn, '找到 iframe 内按钮');
  assert.equal(btn.src, 'iframe', '来源标注为 iframe');
  // iframe 定位在 top:420px，内部按钮的顶层坐标应落在其下方
  assert.ok(btn.cy >= 400, `iframe 内元素顶层 y(${btn.cy}) 已加上 iframe 偏移`);
  assert.ok(r.elements.find((e) => e.src === 'iframe' && e.role === 'textbox'), '找到 iframe 内输入框');
});

test('视口外元素标记 inView=false', async () => {
  const r = await call('collect');
  const off = r.elements.find((e) => (e.name || '').includes('Below Fold'));
  assert.ok(off, '收集到视口外元素');
  assert.equal(off.inView, false, '标记为 offscreen');
});

test('form_input 设值并触发事件（含 iframe 内）', async () => {
  const r = await call('read_page', {});
  const nameEl = r.elements.find((e) => e.role === 'textbox' && e.name.includes('Name'));
  let fired = false;
  await page.exposeFunction('__mark', () => (fired = true)).catch(() => {});
  await page.evaluate(() => document.getElementById('name').addEventListener('input', () => window.__mark && window.__mark()));
  const res = await call('form_input', { ref: nameEl.ref, value: 'hello world' });
  assert.ok(!res.__error, res.__error);
  assert.equal(await page.evaluate(() => document.getElementById('name').value), 'hello world', '值已写入');
  assert.ok(fired, 'input 事件已触发（React/Vue 可感知）');
});

test('probe 存在性探测（跨 shadow）', async () => {
  const byQuery = await call('probe', { query: 'shadow-btn' });
  assert.ok(byQuery.matchCount >= 1, 'query 命中 shadow 内元素');
  const byText = await call('probe', { text: 'Top Button' });
  assert.equal(byText.textFound, true, 'text 命中页面文本');
  const none = await call('probe', { query: 'zzz-nonexistent-zzz' });
  assert.equal(none.matchCount, 0, '不存在则 0');
});
