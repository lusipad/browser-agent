import { chromium } from 'playwright';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');
const videoDir = path.resolve(projectRoot, 'docs/videos');

if (!fs.existsSync(videoDir)) {
  fs.mkdirSync(videoDir, { recursive: true });
}

const PORT = 8790;

const PRODUCT_PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>TechGear 极客数码 - 人体工学双模机械键盘</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
      background: #f1f5f9;
      color: #1e293b;
      min-height: 100vh;
      width: 1280px;
    }
    header {
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 1280px;
    }
    .logo {
      font-size: 18px;
      font-weight: 800;
      color: #2563eb;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nav-links {
      display: flex;
      gap: 20px;
      font-size: 14px;
      color: #64748b;
    }
    .nav-links span.active { color: #2563eb; font-weight: 600; }
    main {
      padding: 24px;
      display: flex;
      justify-content: flex-start;
      padding-left: 205px;
    }
    .product-card {
      width: 440px;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .badge-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .badge-promo {
      background: #fee2e2;
      color: #dc2626;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
    }
    .countdown {
      font-size: 12px;
      color: #ef4444;
      font-weight: 600;
    }
    .prod-visual {
      height: 160px;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      position: relative;
      overflow: hidden;
    }
    .prod-visual::before {
      content: '';
      position: absolute;
      width: 140px;
      height: 140px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%);
      top: -30px;
      right: -20px;
    }
    .prod-title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.4;
    }
    .price-row {
      display: flex;
      align-items: baseline;
      gap: 12px;
    }
    .current-price {
      font-size: 30px;
      font-weight: 800;
      color: #ef4444;
    }
    .original-price {
      font-size: 15px;
      color: #94a3b8;
      text-decoration: line-through;
    }
    .discount-pill {
      background: #fef08a;
      color: #854d0e;
      font-size: 12px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .specs-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      background: #f8fafc;
      padding: 12px;
      border-radius: 8px;
    }
    .spec-item {
      font-size: 12.5px;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .buy-btn {
      width: 100%;
      background: #2563eb;
      color: #ffffff;
      padding: 12px;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">⚡ TechGear 极客数码</div>
    <div class="nav-links">
      <span class="active">外设装备</span>
      <span>桌面美学</span>
      <span>会员特惠</span>
      <span>关于我们</span>
    </div>
  </header>
  <main>
    <div class="product-card" id="target-product-card">
      <div class="badge-row">
        <span class="badge-promo">🔥 限时大促直降 ¥300</span>
        <span class="countdown">距结束 02:45:18</span>
      </div>
      <div class="prod-visual">
        <span style="font-size: 40px; margin-bottom: 6px;">⌨️</span>
        <span style="font-size: 14px; font-weight: 600; letter-spacing: 1px;">ERGONOMIC KEYBOARD</span>
      </div>
      <h2 class="prod-title">TechGear 人体工学分体双模机械键盘</h2>
      <div class="price-row">
        <span class="current-price">¥599.00</span>
        <span class="original-price">¥899.00</span>
        <span class="discount-pill">省 ¥300</span>
      </div>
      <div class="specs-grid">
        <div class="spec-item">✨ Gasket 软弹消音结构</div>
        <div class="spec-item">🌈 1680万色 RGB 律动</div>
        <div class="spec-item">⚡ 全键热插拔定制线性轴</div>
        <div class="spec-item">🔋 4000mAh 超长续航</div>
      </div>
      <button class="buy-btn">立即加购特惠装</button>
    </div>
  </main>
</body>
</html>`;

function getStageHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Browser Agent v0.6.0 Real Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { width: 1280px; height: 720px; background: #090c15; overflow: hidden; }
    canvas { width: 1280px; height: 720px; display: block; }
    .video-holder { position: fixed; left: 0; top: 0; width: 1px; height: 1px; opacity: 0.01; overflow: hidden; pointer-events: none; }
  </style>
</head>
<body>
  <div class="video-holder">
    <video id="v-web" src="/raw-web.webm" muted playsinline></video>
    <video id="v-side" src="/raw-sidepanel.webm" muted playsinline></video>
  </div>
  <canvas id="stage" width="1280" height="720"></canvas>

  <script>
    const vWeb = document.getElementById('v-web');
    const vSide = document.getElementById('v-side');
    const canvas = document.getElementById('stage');
    const ctx = canvas.getContext('2d');

    function renderLoop() {
      // 1. Draw top Chrome window header
      ctx.fillStyle = '#1e2433';
      ctx.fillRect(0, 0, 1280, 50);

      // Window dots
      ctx.fillStyle = '#ff5f56'; ctx.beginPath(); ctx.arc(20, 25, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffbd2e'; ctx.beginPath(); ctx.arc(38, 25, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#27c93f'; ctx.beginPath(); ctx.arc(56, 25, 6, 0, Math.PI * 2); ctx.fill();

      // Tab
      ctx.fillStyle = '#2b3347';
      ctx.beginPath();
      ctx.roundRect(80, 10, 260, 40, [8, 8, 0, 0]);
      ctx.fill();
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '500 12px sans-serif';
      ctx.fillText('⚡ TechGear 极客数码 - 人体工学双模键盘', 96, 34);

      // URL bar
      ctx.fillStyle = '#151923';
      ctx.beginPath();
      ctx.roundRect(360, 10, 560, 30, [6, 6, 6, 6]);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.font = '12px sans-serif';
      ctx.fillText('🔒', 374, 30);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '12px monospace';
      ctx.fillText('https://techgear.store/products/ergonomic-split-keyboard', 396, 30);

      // Action badge
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.roundRect(1110, 11, 150, 28, [6, 6, 6, 6]);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11.5px sans-serif';
      ctx.fillText('🎯 视觉精准框选 v0.6.0', 1122, 29);

      // 2. Draw Left Web Page (exact 850 x 670 crop from 1280x720 video)
      if (vWeb.readyState >= 2) {
        ctx.drawImage(vWeb, 0, 0, 850, 670, 0, 50, 850, 670);
      }

      // 3. Draw Right Sidepanel (exact 430 x 670 crop from 1280x720 video)
      if (vSide.readyState >= 2) {
        ctx.drawImage(vSide, 0, 0, 430, 670, 850, 50, 430, 670);
      }

      // 4. Subtle split border
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(850, 50);
      ctx.lineTo(850, 720);
      ctx.stroke();

      // 5. Status badge pill
      const t = vSide.currentTime || 0;
      let text = '⚡ 侧边栏开启 · 视觉框选按钮已就绪';
      if (t >= 2.5 && t < 7.5) {
        text = '🎯 划线框选任意区域 · 自动智能识别 ROI';
      } else if (t >= 7.5 && t < 13.0) {
        text = '📎 选区缩略图挂载 · 发起自然语言精准提问';
      } else if (t >= 13.0 && t < 16.5) {
        text = '🤖 多模态视觉模型流式解析 · 提取核心价格与配置';
      } else if (t >= 16.5) {
        text = '🔍 缩略图点击支持高清 Lightbox 大图预览';
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(24, 665, 360, 36, [18, 18, 18, 18]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 13px sans-serif';
      ctx.fillText(text, 44, 688);

      requestAnimationFrame(renderLoop);
    }

    requestAnimationFrame(renderLoop);
  </script>
</body>
</html>`;
}

async function record() {
  console.log('=== Starting Real Extension Demonstration Video Recording ===');

  const finalRawWebPath = path.join(videoDir, 'browser-agent-v0.6.0-real-web.webm');
  const finalRawSidePath = path.join(videoDir, 'browser-agent-v0.6.0-real-sidepanel.webm');

  let rawWebVideoPath = '';
  let rawSidepanelVideoPath = '';

  // 1. Setup local mock HTTP server
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(PRODUCT_PAGE_HTML);
      return;
    }

    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const responseTokens = [
        '🎯 **视觉选区解析结果：**\n\n',
        '- **商品名称**：TechGear 人体工学双模机械键盘\n',
        '- **活动特惠价**：**¥599.00**（限时直降 ¥300，日常原价 ¥899.00）\n',
        '- **核心硬件配置**：Gasket 软弹手感结构、1680万色 RGB 幻彩律动、全键热插拔定制线性轴体、Type-C + 2.4G 双模极速无线连接。\n\n',
        '💡 **购买建议**：当前处于促销大促倒计时，属于历史低价区间，强烈推荐直接加购！',
      ];

      let idx = 0;
      const timer = setInterval(() => {
        if (idx < responseTokens.length) {
          const chunk = responseTokens[idx++];
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
        } else {
          clearInterval(timer);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }, 90);
      return;
    }

    if (req.url === '/stage') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getStageHtml());
      return;
    }

    const webTarget = (rawWebVideoPath && fs.existsSync(rawWebVideoPath)) ? rawWebVideoPath : finalRawWebPath;
    if (req.url === '/raw-web.webm' && fs.existsSync(webTarget)) {
      const stat = fs.statSync(webTarget);
      res.writeHead(200, {
        'Content-Type': 'video/webm',
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(webTarget).pipe(res);
      return;
    }

    const sideTarget = (rawSidepanelVideoPath && fs.existsSync(rawSidepanelVideoPath)) ? rawSidepanelVideoPath : finalRawSidePath;
    if (req.url === '/raw-sidepanel.webm' && fs.existsSync(sideTarget)) {
      const stat = fs.statSync(sideTarget);
      res.writeHead(200, {
        'Content-Type': 'video/webm',
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(sideTarget).pipe(res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise((r) => server.listen(PORT, r));
  console.log(`Mock server running at http://localhost:${PORT}`);

  // 2. Launch Chromium with persistent anonymous profile and unpacked extension
  const cleanProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-real-demo-'));
  const rawVideoTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-raw-videos-'));

  console.log('Launching Chromium with real extension from dist/ ...');
  const context = await chromium.launchPersistentContext(cleanProfileDir, {
    headless: false,
    args: [
      '--headless=new',
      '--window-size=1280,720',
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
      '--no-sandbox',
      '--disable-gpu',
    ],
    recordVideo: {
      dir: rawVideoTmpDir,
      size: { width: 1280, height: 720 },
    },
  });

  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent('serviceworker');
  }
  const extensionId = background.url().split('/')[2];
  console.log('Real Extension loaded, ID:', extensionId);

  // Wait for auto-opened options tab and close it
  await new Promise((r) => setTimeout(r, 1200));
  for (const p of context.pages()) {
    if (p.url().includes('options.html')) {
      await p.close().catch(() => {});
    }
  }

  // Configure extension settings in chrome.storage
  await background.evaluate(async (mockUrl) => {
    const raw = await chrome.storage.local.get(['config', 'local_api_keys']);
    const cfg = raw.config || {};
    const providers = (cfg.providers || []).map((p) => {
      if (p.id === 'openai') {
        return { ...p, baseUrl: mockUrl, apiKey: 'demo-secure-token' };
      }
      return p;
    });
    if (!providers.some((p) => p.id === 'openai')) {
      providers.push({ id: 'openai', name: 'OpenAI', baseUrl: mockUrl, apiKey: 'demo-secure-token' });
    }
    const secrets = raw.local_api_keys || {};
    secrets['openai'] = 'demo-secure-token';

    const newCfg = {
      ...cfg,
      providers,
      defaultBindingId: 'openai/gpt-5.6-terra',
      advanced: {
        ...(cfg.advanced || {}),
        planning: false,
      },
    };
    if (chrome.storage.sync) {
      await chrome.storage.sync.set({ config: newCfg });
    }
    await chrome.storage.local.set({
      config: newCfg,
      local_api_keys: secrets,
    });
  }, `http://localhost:${PORT}/v1`);
  console.log('Extension configured with local endpoint.');

  // 3. Open Web Page (1280 x 720)
  const webPage = await context.newPage();
  await webPage.setViewportSize({ width: 1280, height: 720 });
  await webPage.goto(`http://localhost:${PORT}`);
  await webPage.waitForLoadState('networkidle');
  console.log('Target web page loaded.');

  // 4. Open Extension Sidepanel
  const sidepanelPage = await context.newPage();
  await sidepanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await sidepanelPage.waitForLoadState('networkidle');
  await sidepanelPage.addStyleTag({
    content: `
      html, body { width: 430px !important; max-width: 430px !important; margin: 0 !important; background: #0f172a !important; overflow-x: hidden !important; }
      .app { width: 430px !important; max-width: 430px !important; min-height: 670px !important; }
    `,
  });
  await sidepanelPage.waitForTimeout(1000);
  console.log('Real sidepanel loaded.');

  // === STEP 1: Introduce & Click 🎯 in Sidepanel ===
  console.log('[Step 1] Hovering and clicking 🎯 Region Select Button in sidepanel...');
  await sidepanelPage.bringToFront();
  const regionBtn = sidepanelPage.locator('.region-select-btn');
  await regionBtn.hover();
  await sidepanelPage.waitForTimeout(800);
  await regionBtn.click();
  await sidepanelPage.waitForTimeout(600);

  // === STEP 2: In-Page Overlay & Drag Selection on Web Page ===
  console.log('[Step 2] Switching to webPage for in-page visual selection...');
  await webPage.bringToFront();
  const overlay = webPage.locator('#__ba_region_overlay');
  await overlay.waitFor({ state: 'visible', timeout: 5000 });

  // Smooth mouse drag over product card
  console.log('Dragging mouse across product card...');
  const startX = 185, startY = 65;
  const targetX = 665, targetY = 555;
  await webPage.mouse.move(startX, startY);
  await webPage.waitForTimeout(400);
  await webPage.mouse.down();
  await webPage.waitForTimeout(200);

  // Move in steps for visible drag
  const steps = 18;
  for (let i = 1; i <= steps; i++) {
    const curX = Math.round(startX + (targetX - startX) * (i / steps));
    const curY = Math.round(startY + (targetY - startY) * (i / steps));
    await webPage.mouse.move(curX, curY);
    await webPage.waitForTimeout(35);
  }

  await webPage.waitForTimeout(400);
  await webPage.mouse.up();
  console.log('Mouse released. Region selected!');
  await webPage.waitForTimeout(800);

  // === STEP 3: Verify Chip in Sidepanel & Type Prompt ===
  console.log('[Step 3] Switching back to sidepanel. Verifying chip and typing prompt...');
  await sidepanelPage.bringToFront();
  const chip = sidepanelPage.locator('.composer-region-chip');
  await chip.waitFor({ state: 'visible', timeout: 5000 });
  const dim = await sidepanelPage.locator('.region-chip-dim').textContent();
  console.log('Mounted chip with dimension:', dim);
  await sidepanelPage.waitForTimeout(600);

  // Type prompt with natural rhythm
  const textarea = sidepanelPage.locator('.composer textarea');
  const promptText = '请提取框选卡片中的商品核心配置和限时特惠价格，并给出购买建议';
  await textarea.click();
  for (const char of promptText) {
    await textarea.type(char, { delay: 40 });
  }
  await sidepanelPage.waitForTimeout(500);

  // === STEP 4: Send & Stream AI Response ===
  console.log('[Step 4] Clicking send button...');
  const sendBtn = sidepanelPage.locator('.send-btn');
  await sendBtn.click();

  console.log('Waiting for AI response stream...');
  await sidepanelPage.waitForSelector('.row.assistant', { timeout: 10000 });
  console.log('Assistant response received! Waiting for stream to complete...');
  await sidepanelPage.waitForTimeout(3500);

  // === STEP 5: Click Thumbnail to Showcase Lightbox Modal ===
  console.log('[Step 5] Clicking user region thumbnail to open high-res Lightbox modal...');
  const userThumb = sidepanelPage.locator('.user-region-preview');
  await userThumb.hover();
  await sidepanelPage.waitForTimeout(500);
  await userThumb.click();

  const lightboxImg = sidepanelPage.locator('.lightbox-img');
  await lightboxImg.waitFor({ state: 'visible', timeout: 3000 });
  console.log('Lightbox modal visible! Holding for showcase...');
  await sidepanelPage.waitForTimeout(2500);

  // Click close button
  console.log('Closing Lightbox modal...');
  const closeBtn = sidepanelPage.locator('.lightbox-close');
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  } else {
    await sidepanelPage.locator('.lightbox-backdrop').click();
  }
  await sidepanelPage.waitForTimeout(1500);

  // Finish real recordings
  console.log('Closing pages to finalize raw video files...');
  const webVideo = webPage.video();
  const sidepanelVideo = sidepanelPage.video();

  await webPage.close();
  await sidepanelPage.close();
  await context.close();

  rawWebVideoPath = await webVideo.path();
  rawSidepanelVideoPath = await sidepanelVideo.path();

  console.log('Raw web video:', rawWebVideoPath);
  console.log('Raw sidepanel video:', rawSidepanelVideoPath);

  // Save standalone copies of raw videos
  fs.copyFileSync(rawWebVideoPath, finalRawWebPath);
  fs.copyFileSync(rawSidepanelVideoPath, finalRawSidePath);
  console.log('Saved standalone raw videos to docs/videos/');

  // === STEP 6: Composite Unified Split-Screen 1280x720 Demo Video ===
  console.log('[Step 6] Recording Unified 1280x720 Split-Screen Chrome Frame Video via Canvas...');

  const compBrowser = await chromium.launch({ headless: true });
  const compContext = await compBrowser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 },
    },
  });

  const compPage = await compContext.newPage();
  await compPage.goto(`http://localhost:${PORT}/stage`);
  console.log('Compositing stage loaded. Triggering synchronized playback...');

  await compPage.waitForTimeout(400);
  await compPage.evaluate(async () => {
    const vWeb = document.getElementById('v-web');
    const vSide = document.getElementById('v-side');
    vWeb.currentTime = 0;
    vSide.currentTime = 0;
    await Promise.all([vWeb.play().catch(() => {}), vSide.play().catch(() => {})]);
  });

  console.log('Recording synchronized real demo via Canvas for 18.5 seconds...');
  await compPage.waitForTimeout(18500);
  console.log('Synchronized playback finished!');

  const compVideo = compPage.video();
  await compPage.close();
  await compContext.close();
  await compBrowser.close();
  const finalRecordedPath = await compVideo.path();

  // Rename master video to browser-agent-v0.6.0-real-demo.webm
  const masterPath = path.join(videoDir, 'browser-agent-v0.6.0-real-demo.webm');
  if (fs.existsSync(masterPath)) fs.unlinkSync(masterPath);
  fs.renameSync(finalRecordedPath, masterPath);

  const stat = fs.statSync(masterPath);
  console.log(`\n🎉 SUCCESS! Master Real Demo Video generated:\n -> ${masterPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)\n`);

  // Cleanup
  server.close();
  fs.rmSync(cleanProfileDir, { recursive: true, force: true });
  fs.rmSync(rawVideoTmpDir, { recursive: true, force: true });
  console.log('Ephemeral files cleaned up.');
}

record().catch((err) => {
  console.error('Error during recording:', err);
  process.exit(1);
});
