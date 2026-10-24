// 验证 Phase 1 - Phase 6 关键增强在真实 Chromium 环境中的细部能力：
// 1. 智能滚动 (smart_scroll_read) 与无感抽文去重
// 2. 页面动态稳定探测 (page_settle)
// 3. 实时活体执行 HUD 与点击激光波纹 (hud_update / pointer_ripple)
// 4. 无选择器启发式卡片/列表流提取 (auto_cards)
// 6. WebBridge 本地守候进程与 MCP 协议交互 (健康检查 / 客户端双向 RPC / 4409 实例冲突防重)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';
import { WebBridgeDaemon } from '../../scripts/webbridge-daemon.mjs';

const FIXTURE = `<!doctype html><html><head><meta charset="utf-8">
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
  .scroll-box {
    width: 400px;
    height: 250px;
    overflow-y: scroll;
    border: 1px solid #ccc;
    padding: 10px;
  }
  .product-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 20px;
  }
  .product-card {
    width: 220px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
  }
  .product-card img { width: 100%; height: 120px; object-fit: cover; }
  .product-card h3 { margin: 8px 0 4px; font-size: 16px; }
  .product-card .price { color: #e11d48; font-weight: bold; font-size: 15px; }
</style>
</head><body>
  <div id="text-target" style="padding: 20px;">
    <h2>产品介绍</h2>
    <p id="selectable-p">Antigravity Browser Agent 是一款高自主度、具备长程规划与物理级浏览器操控能力的智能体扩展。</p>
  </div>

  <div id="nested-scroll" class="scroll-box">
    <div style="height: 1200px;">
      <p>Scroll Row 1: 开始</p>
      <p style="margin-top: 300px;">Scroll Row 2: 中间数据内容</p>
      <p style="margin-top: 300px;">Scroll Row 3: 底部结算数据</p>
    </div>
  </div>

  <div class="product-grid">
    <div class="product-card">
      <img src="https://images.example/kb.jpg" alt="Keyboard">
      <h3 class="prod-title">机械键盘 Pro</h3>
      <div class="price">¥599.00</div>
      <a href="https://shop.example/items/keyboard" class="buy-link">立即购买</a>
      <p>全键无冲，RGB 律动背光，CNC 铝合金外壳。</p>
    </div>
    <div class="product-card">
      <img src="https://images.example/mouse.jpg" alt="Mouse">
      <h3 class="prod-title">人体工学无线鼠标</h3>
      <div class="price">¥299.00</div>
      <a href="https://shop.example/items/mouse" class="buy-link">立即购买</a>
      <p>双模无线连接，PAW3395 传感器，轻量化 58g。</p>
    </div>
    <div class="product-card">
      <img src="https://images.example/screen.jpg" alt="Screen">
      <h3 class="prod-title">4K 144Hz 电竞显示器</h3>
      <div class="price">¥2399.00</div>
      <a href="https://shop.example/items/monitor" class="buy-link">立即购买</a>
      <p>Mini-LED 1152 分区背光，HDR1000 认证。</p>
    </div>
    <div class="product-card">
      <img src="https://images.example/headset.jpg" alt="Headset">
      <h3 class="prod-title">主动降噪头戴耳机</h3>
      <div class="price">¥899.00</div>
      <a href="https://shop.example/items/headset" class="buy-link">立即购买</a>
      <p>40mm 镀钛驱动单元，45dB 深度降噪，60小时续航。</p>
    </div>
  </div>
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
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.setContent(FIXTURE, { waitUntil: 'load' });

  // 注入 mock chrome.runtime.sendMessage 以便捕获 HUD 与胶囊发出的消息
  await page.evaluate(() => {
    window.__sent_messages = [];
    window.chrome = {
      runtime: {
        sendMessage: (msg) => {
          window.__sent_messages.push(msg);
          return Promise.resolve({ ok: true });
        },
      },
    };
  });

  await page.addScriptTag({ content: bundle });
});

after(async () => {
  await browser?.close();
});

const call = (cmd, payload) => page.evaluate(([c, p]) => window.__pageAgent(c, p), [cmd, payload ?? null]);

test('1. 智能滚动探测容器与多屏抽取行去重 (smart_scroll_read)', async () => {
  const r = await call('smart_scroll_read', { max_screens: 5, step_timeout_ms: 100 });
  assert.ok(!r.__error, r.__error);
  assert.ok(r.screens >= 1, `屏幕滚动次数: ${r.screens}`);
  assert.ok(r.totalChars > 0, `抽取的字符数: ${r.totalChars}`);
  // 验证抽取的文本包含页面多区域内容，且无重复行堆叠
  assert.ok(r.text.includes('机械键盘 Pro'), '文本包含商品');
  assert.ok(r.text.includes('产品介绍'), '文本包含顶部介绍');
});

test('2. 页面动态稳定结算机制 (page_settle)', async () => {
  // 2.1 静止页面瞬时结算
  const t0 = Date.now();
  const res1 = await call('page_settle', { timeoutMs: 1000, quietMs: 80 });
  const d1 = Date.now() - t0;
  assert.ok(res1.settled, '静止页面应快速标记为 settled');
  assert.ok(d1 < 500, `静止页面结算应在 500ms 内完成，实际 ${d1}ms`);

  // 2.2 动态突变过程中持续追踪并在静止后结算
  await page.evaluate(() => {
    let count = 0;
    const interval = setInterval(() => {
      const el = document.createElement('span');
      el.textContent = ` dynamic-${++count}`;
      document.body.appendChild(el);
      if (count >= 3) clearInterval(interval);
    }, 40);
  });
  const res2 = await call('page_settle', { timeoutMs: 1500, quietMs: 100 });
  assert.ok(res2.settled, '突变停止后应标记 settled');
  assert.ok(res2.durationMs >= 100, `应至少等待 quietMs (100ms)，实际 ${res2.durationMs}ms`);
});

test('3. 实时活体执行 HUD 与点击激光波纹 (hud_update / pointer_ripple)', async () => {
  // 3.1 渲染 HUD
  const hudRes = await call('hud_update', { text: '正在搜索高评分产品...', status: 'running' });
  assert.ok(hudRes.ok);

  const hudExists = await page.evaluate(() => {
    const el = document.getElementById('__ba_live_hud');
    if (!el) return false;
    const label = el.querySelector('#__ba_hud_label')?.textContent;
    return label === '正在搜索高评分产品...';
  });
  assert.ok(hudExists, '页面应渲染出 __ba_live_hud 并展示文本');

  // 3.2 点击 HUD 上的 [⏹ 停止] 按钮，应派发 abort 并隐藏
  const aborted = await page.evaluate(() => {
    const btn = document.querySelector('#__ba_live_hud button');
    if (!btn) return false;
    btn.click();
    const msgs = window.__sent_messages || [];
    return msgs.some((m) => m.type === 'abort');
  });
  assert.ok(aborted, '点击停止按钮应派发 { type: "abort" } 消息');

  // 3.3 激光波纹 pointer_ripple
  const ripRes = await call('pointer_ripple', { x: 350, y: 220, color: '#38bdf8' });
  assert.ok(ripRes.ok);
  const rippleHost = await page.evaluate(() => {
    const host = document.getElementById('__ba_visuals_host');
    return !!host && host.children.length >= 2; // dot + ring
  });
  assert.ok(rippleHost, '点击坐标处应生成 __ba_visuals_host 及激光波纹光环');
});

test('4. 无选择器启发式卡片/列表流自动提取 (auto_cards)', async () => {
  const r = await call('extract', { mode: 'auto_cards' });
  assert.ok(!r.__error, r.__error);
  assert.equal(r.mode, 'auto_cards');
  assert.equal(r.count, 4, '应自动识别并抽取 4 个商品卡片');

  const kb = r.cards.find((c) => c.title?.includes('机械键盘 Pro'));
  assert.ok(kb, '应识别到机械键盘 Pro 卡片');
  assert.equal(kb.price, '¥599.00', '应自动正则提取价格 ¥599.00');
  assert.equal(kb.link, 'https://shop.example/items/keyboard', '提取商品链接');
  assert.equal(kb.image, 'https://images.example/kb.jpg', '提取商品封面图');
  assert.ok(kb.text.includes('CNC 铝合金外壳'), '提取卡片完整语义文本');

  const screen = r.cards.find((c) => c.title?.includes('电竞显示器'));
  assert.ok(screen, '识别到电竞显示器');
  assert.equal(screen.price, '¥2399.00');
});

test('6. WebBridge 本地 WebSocket 守候进程与 MCP RPC 交互', async () => {
  const daemon = new WebBridgeDaemon(10091);
  await daemon.start();

  try {
    // 6.1 HTTP 健康检查
    const res = await fetch('http://127.0.0.1:10091/health');
    assert.equal(res.status, 200);
    const health = await res.json();
    assert.equal(health.status, 'ok');
    assert.equal(health.connected, false);

    // 6.2 客户端 1 建立连接并双向 RPC 交互
    const WS = globalThis.WebSocket;
    const ws1 = new WS('ws://127.0.0.1:10091/ws?client=browser_ext_1');

    await new Promise((resolve, reject) => {
      ws1.onopen = resolve;
      ws1.onerror = reject;
    });

    // 监听服务端指令并回复
    ws1.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'ping_tool') {
        ws1.send(JSON.stringify({ id: msg.id, result: { ack: true, time: Date.now() } }));
      }
    };

    // 服务端向浏览器下发调用
    const rpcRes = await daemon.call('ping_tool', {}, 5000);
    assert.equal(rpcRes.ack, true, '服务端 daemon.call 应成功收到浏览器客户端回包');

    // 6.3 第二个客户端发起连接，验证 4409 实例冲突防重阻断
    const ws2 = new WS('ws://127.0.0.1:10091/ws?client=browser_ext_2');
    const closePromise = new Promise((resolve) => {
      ws2.onclose = (ev) => resolve(ev.code);
    });

    const closeCode = await closePromise;
    assert.equal(closeCode, 4409, '多实例并发连接时应被 4409 实例冲突保护安全关闭');

    ws1.close();
  } finally {
    daemon.stop();
  }
});
