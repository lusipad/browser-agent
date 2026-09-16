import { chromium } from 'playwright';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const artifactDir = 'C:/Users/lus/.gemini/antigravity/brain/f8a6c147-f2e5-4ca5-b4b3-89c0ac214584';

const TEST_PAGE_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>视觉框选测试页面</title>
  <style>
    body { font-family: sans-serif; padding: 40px; background: #f8fafc; }
    .product-card {
      width: 320px;
      padding: 20px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      margin: 20px auto;
    }
    .badge { background: #fee2e2; color: #dc2626; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .price { font-size: 24px; color: #ef4444; font-weight: bold; margin: 10px 0; }
    .btn { width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 15px; }
  </style>
</head>
<body>
  <div class="product-card">
    <span class="badge">限时特惠</span>
    <h3>人体工学分体键盘</h3>
    <div class="price">¥599.00</div>
    <button class="btn">立即抢购</button>
  </div>
</body>
</html>`;

async function run() {
  console.log('--- Starting Visual Region-of-Interest (ROI) E2E Verification ---');

  // 1. 启动轻量 HTTP 服务器
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(TEST_PAGE_HTML);
  });
  await new Promise((resolve) => server.listen(8766, resolve));
  console.log('Mock Web Server running at http://localhost:8766');

  // 2. 启动加载扩展的 Chromium
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--headless=new`,
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
      '--no-sandbox',
      '--disable-gpu',
    ],
  });

  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent('serviceworker');
  }
  const extensionId = background.url().split('/')[2];
  console.log('Extension loaded, ID:', extensionId);

  // 3. 打开待框选的网页
  const webPage = await context.newPage();
  await webPage.setViewportSize({ width: 900, height: 750 });
  await webPage.goto('http://localhost:8766');
  await webPage.waitForLoadState('networkidle');
  console.log('Test web page loaded.');

  // 4. 打开侧边栏
  const sidepanelPage = await context.newPage();
  await sidepanelPage.setViewportSize({ width: 440, height: 750 });
  await sidepanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await sidepanelPage.waitForLoadState('networkidle');
  await sidepanelPage.waitForTimeout(600);
  console.log('Sidepanel loaded.');

  // 5. 验证 Composer 输入框左侧存在 🎯 按钮并点击
  const selectRegionBtn = sidepanelPage.locator('.region-select-btn');
  const btnCount = await selectRegionBtn.count();
  console.log('Region select button found in Composer:', btnCount > 0);
  if (btnCount === 0) {
    throw new Error('Region select button not found in Composer!');
  }

  console.log('Clicking 🎯 Region select button...');
  await selectRegionBtn.click();
  await sidepanelPage.waitForTimeout(600);

  // 6. 验证被框选网页出现全屏蒙层 #ba-region-overlay
  await webPage.bringToFront();
  await webPage.waitForTimeout(300);
  const overlay = webPage.locator('#__ba_region_overlay');
  const overlayVisible = await overlay.isVisible();
  console.log('In-page region overlay visible:', overlayVisible);
  if (!overlayVisible) {
    throw new Error('In-page region overlay did not appear on target tab!');
  }

  // 截图 1: 页面上的框选提示蒙层
  const screenshot1 = path.join(artifactDir, 'region-step1-overlay.png');
  await webPage.screenshot({ path: screenshot1 });
  console.log('Saved screenshot:', screenshot1);

  // 7. 在网页上模拟鼠标拖拽框选商品卡片
  console.log('Dragging mouse to select product card region...');
  await webPage.mouse.move(260, 50);
  await webPage.mouse.down();
  await webPage.mouse.move(640, 360, { steps: 8 });
  await webPage.mouse.up();
  await webPage.waitForTimeout(800);

  // 8. 切换回侧边栏，检查 Composer 挂载的选区附件
  console.log('Verifying region chip attached to Composer in sidepanel...');
  await sidepanelPage.bringToFront();
  await sidepanelPage.waitForTimeout(600);

  const chip = sidepanelPage.locator('.composer-region-chip');
  const chipVisible = await chip.isVisible();
  console.log('Composer region chip visible:', chipVisible);
  if (!chipVisible) {
    throw new Error('Composer region chip was not attached!');
  }

  const dimText = await sidepanelPage.locator('.region-chip-dim').textContent();
  console.log('Region dimensions text:', dimText);

  // 截图 2: 侧边栏 Composer 挂载选区缩略图与尺寸
  const screenshot2 = path.join(artifactDir, 'region-step2-chip-attached.png');
  await sidepanelPage.screenshot({ path: screenshot2 });
  console.log('Saved screenshot:', screenshot2);

  // 9. 输入指令并提交
  console.log('Submitting prompt with attached region...');
  const textarea = sidepanelPage.locator('.composer textarea');
  await textarea.fill('请提取框选卡片中的商品名称和限时特惠价格');
  await sidepanelPage.waitForTimeout(300);

  const sendBtn = sidepanelPage.locator('.send-btn');
  await sendBtn.click();
  await sidepanelPage.waitForTimeout(800);

  // 10. 检查时间线中的用户消息附带了选区缩略图
  const userPreview = sidepanelPage.locator('.user-region-preview');
  await userPreview.waitFor({ state: 'visible', timeout: 3000 });
  const previewCount = await userPreview.count();
  console.log('User timeline item has region preview image:', previewCount > 0);
  if (previewCount === 0) {
    throw new Error('User timeline item does not contain region preview image!');
  }

  // 截图 3: 时间线中带选区缩略图的用户消息
  const screenshot3 = path.join(artifactDir, 'region-step3-timeline-sent.png');
  await sidepanelPage.screenshot({ path: screenshot3 });
  console.log('Saved screenshot:', screenshot3);

  // 11. 点击缩略图弹出高分辨率 Lightbox 预览
  console.log('Testing Lightbox preview on thumbnail click...');
  await userPreview.click();
  await sidepanelPage.waitForTimeout(400);
  const lightboxImg = sidepanelPage.locator('.lightbox-img');
  const lightboxVisible = await lightboxImg.isVisible();
  console.log('Lightbox preview visible:', lightboxVisible);
  if (!lightboxVisible) {
    throw new Error('Lightbox did not open on thumbnail click!');
  }

  // 截图 4: Lightbox 大图预览
  const screenshot4 = path.join(artifactDir, 'region-step4-lightbox.png');
  await sidepanelPage.screenshot({ path: screenshot4 });
  console.log('Saved screenshot:', screenshot4);

  // 清理并退出
  await context.close();
  server.close();
  console.log('--- Visual Region-of-Interest (ROI) E2E Verification PASSED Successfully! ---');
}

run().catch((err) => {
  console.error('Region verification failed:', err);
  process.exit(1);
});
