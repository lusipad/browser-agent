// 真实 Chromium 里验证 extract_data 的页面内抽取：表格 / 链接 / selector+fields，
// 且穿透 open shadow DOM 与同源 iframe。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

const FIXTURE = `<!doctype html><html><head><meta charset="utf-8"></head><body>
  <table>
    <caption>Fruits</caption>
    <tr><th>Name</th><th>Price</th></tr>
    <tr><td>Apple</td><td>3</td></tr>
    <tr><td>Banana</td><td>2</td></tr>
  </table>
  <ul id="list">
    <li class="item"><span class="t">First</span><a class="lnk" href="https://a.example/1">la</a></li>
    <li class="item"><span class="t">Second</span><a class="lnk" href="https://b.example/2">lb</a></li>
  </ul>
  <div id="host"></div>
  <iframe id="frm" srcdoc="<body><a href='https://iframe.example/x'>ifr</a></body>" style="border:0"></iframe>
  <script>
    const sr = document.getElementById('host').attachShadow({ mode: 'open' });
    sr.innerHTML = '<a href="https://shadow.example/y">sh</a>';
  </script>
</body></html>`;

let browser;
let page;

before(async () => {
  const built = await esbuild.build({
    entryPoints: ['test/e2e/pageAgent.entry.ts'],
    bundle: true,
    format: 'iife',
    write: false,
    logLevel: 'error',
  });
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  await page.setContent(FIXTURE, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const f = document.querySelector('iframe');
    return !!(f && f.contentDocument && f.contentDocument.querySelector('a'));
  });
  await page.addScriptTag({ content: built.outputFiles[0].text });
});

after(async () => {
  await browser?.close();
});

const call = (cmd, payload) => page.evaluate(([c, p]) => window.__pageAgent(c, p), [cmd, payload ?? null]);

test('extract tables: 表头/行/标题', async () => {
  const r = await call('extract', { mode: 'tables' });
  assert.ok(!r.__error, r.__error);
  assert.equal(r.count, 1);
  const t = r.tables[0];
  assert.equal(t.caption, 'Fruits');
  assert.deepEqual(t.headers, ['Name', 'Price']);
  assert.deepEqual(t.rows, [
    ['Apple', '3'],
    ['Banana', '2'],
  ]);
});

test('extract links: 穿透 shadow 与同源 iframe', async () => {
  const r = await call('extract', { mode: 'links' });
  assert.ok(!r.__error, r.__error);
  const hrefs = r.links.map((l) => l.href);
  assert.ok(hrefs.includes('https://a.example/1'), '顶层链接');
  assert.ok(hrefs.includes('https://b.example/2'), '顶层链接2');
  assert.ok(hrefs.includes('https://shadow.example/y'), 'shadow 内链接');
  assert.ok(hrefs.includes('https://iframe.example/x'), '同源 iframe 内链接');
});

test('extract selector + fields: 每条记录抽子字段与属性', async () => {
  const r = await call('extract', {
    mode: 'selector',
    selector: 'li.item',
    fields: { title: '.t', link: '.lnk@href' },
  });
  assert.ok(!r.__error, r.__error);
  assert.equal(r.count, 2);
  assert.deepEqual(r.items[0], { title: 'First', link: 'https://a.example/1' });
  assert.deepEqual(r.items[1], { title: 'Second', link: 'https://b.example/2' });
});

test('extract selector 无 fields: 返回文本数组', async () => {
  const r = await call('extract', { mode: 'selector', selector: '.t' });
  assert.deepEqual(r.items, ['First', 'Second']);
});

test('extract selector 缺失报错', async () => {
  const r = await call('extract', { mode: 'selector' });
  assert.match(r.__error || '', /selector/);
});
