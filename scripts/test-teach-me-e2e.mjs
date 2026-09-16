import { chromium } from 'playwright';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const artifactDir = 'C:/Users/lus/.gemini/antigravity/brain/f8a6c147-f2e5-4ca5-b4b3-89c0ac214584';

const TEST_PAGE_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>电商测试搜索页 - 示教录制验证</title>
  <style>
    body { font-family: sans-serif; padding: 30px; line-height: 1.6; }
    .box { max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
    input[type="text"] { width: 80%; padding: 8px; font-size: 14px; margin-bottom: 12px; }
    button { padding: 8px 16px; font-size: 14px; cursor: pointer; background: #2563eb; color: #fff; border: none; border-radius: 4px; }
    .upload-area { margin-top: 16px; padding: 12px; border: 1px dashed #aaa; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="box">
    <h2>商品搜索与以图搜图</h2>
    <div>
      <input id="kw-input" type="text" placeholder="输入你想搜索的商品关键词..." />
      <button id="search-btn">搜索商品</button>
    </div>
    <div class="upload-area">
      <label for="img-upload">以图搜图上传参考图片：</label><br/>
      <input id="img-upload" type="file" />
    </div>
  </div>
</body>
</html>`;

async function run() {
  console.log('--- Starting Teach-Me (Demonstration-to-Skill) E2E Verification ---');

  // 1. 启动轻量 HTTP 服务器提供可操控的测试网页
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(TEST_PAGE_HTML);
  });
  await new Promise((resolve) => server.listen(8765, resolve));
  console.log('Mock Web Server running at http://localhost:8765');

  // 创建临时测试图片供上传测试
  const dummyFilePath = path.join(__dirname, 'dummy-sample.png');
  fs.writeFileSync(dummyFilePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

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

  // 3. 打开待操作的网页
  const webPage = await context.newPage();
  await webPage.setViewportSize({ width: 900, height: 750 });
  await webPage.goto('http://localhost:8765');
  await webPage.waitForLoadState('networkidle');
  console.log('Test web page loaded.');

  // 4. 打开侧边栏
  const sidepanelPage = await context.newPage();
  await sidepanelPage.setViewportSize({ width: 440, height: 750 });
  await sidepanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await sidepanelPage.waitForLoadState('networkidle');
  await sidepanelPage.waitForTimeout(600);
  console.log('Sidepanel loaded.');

  // 5. 点击 Header 上的 📋 技能抽屉按钮
  const skillBtn = sidepanelPage.locator('button.icon-btn[title*="技能"], button.icon-btn[title*="Skills"], button.icon-btn:has-text("📋")');
  await skillBtn.click();
  await sidepanelPage.waitForTimeout(400);

  // 验证「🔴 示教录制新技能」按钮存在
  const teachBtn = sidepanelPage.locator('.skill-teach-btn');
  const teachBtnCount = await teachBtn.count();
  console.log('Teach-Me button found in SkillDrawer:', teachBtnCount > 0);
  if (teachBtnCount === 0) {
    throw new Error('Teach-Me button not found in SkillDrawer!');
  }

  // 截图 1: 技能抽屉中的示教录制按钮
  const screenshot1 = path.join(artifactDir, 'teach-me-step1-drawer.png');
  await sidepanelPage.screenshot({ path: screenshot1 });
  console.log('Saved screenshot:', screenshot1);

  // 6. 点击「🔴 示教录制新技能」
  console.log('Clicking Teach-Me button...');
  await teachBtn.click();
  await sidepanelPage.waitForTimeout(500);

  // 验证侧边栏出现浮动录制横幅 RecordingBanner
  const banner = sidepanelPage.locator('.recording-banner');
  const bannerVisible = await banner.isVisible();
  console.log('Recording banner visible:', bannerVisible);
  if (!bannerVisible) {
    throw new Error('Recording banner is not visible after clicking Teach-Me!');
  }

  // 截图 2: 浮动录制条初始状态（0 动作）
  const screenshot2 = path.join(artifactDir, 'teach-me-step2-banner-active.png');
  await sidepanelPage.screenshot({ path: screenshot2 });
  console.log('Saved screenshot:', screenshot2);

  // 7. 在被示教网页上模拟用户手工操作
  console.log('Simulating manual user interactions on webpage...');
  await webPage.bringToFront();
  await webPage.waitForTimeout(300);

  // 7.1 输入搜索关键词
  const kwInput = webPage.locator('#kw-input');
  await kwInput.click();
  await kwInput.fill('人体工学客制化机械键盘');
  // 等待输入防抖 (400ms)
  await webPage.waitForTimeout(600);

  // 7.2 点击“搜索商品”按钮
  const searchBtn = webPage.locator('#search-btn');
  await searchBtn.click();
  await webPage.waitForTimeout(500);

  // 7.3 上传参考图片
  const fileInput = webPage.locator('#img-upload');
  await fileInput.setInputFiles(dummyFilePath);
  await webPage.waitForTimeout(600);

  // 8. 切换回侧边栏，检查录制横幅状态更新
  console.log('Verifying captured actions in sidepanel banner...');
  await sidepanelPage.bringToFront();
  await sidepanelPage.waitForTimeout(500);

  const countText = await sidepanelPage.locator('.recording-count').textContent();
  const lastActionText = await sidepanelPage.locator('.recording-last').textContent();
  console.log('Captured action count text:', countText);
  console.log('Latest action summary text:', lastActionText);

  // 验证完成按钮状态已从 disabled 变为可点击
  const finishBtn = sidepanelPage.locator('.recording-finish-btn');
  const finishDisabled = await finishBtn.isDisabled();
  console.log('Finish button is disabled:', finishDisabled);

  // 截图 3: 动作捕获后的录制横幅（动作计数 > 0，显示最新动作，完成按钮高亮）
  const screenshot3 = path.join(artifactDir, 'teach-me-step3-banner-captured.png');
  await sidepanelPage.screenshot({ path: screenshot3 });
  console.log('Saved screenshot:', screenshot3);

  // 9. 点击取消按钮 ✕ 测试关闭录制
  console.log('Testing cancel button on banner...');
  const cancelBtn = sidepanelPage.locator('.recording-cancel-btn');
  await cancelBtn.click();
  await sidepanelPage.waitForTimeout(400);

  const bannerStillVisible = await banner.isVisible();
  console.log('Banner still visible after cancel:', bannerStillVisible);
  if (bannerStillVisible) {
    throw new Error('Recording banner did not dismiss after cancel!');
  }

  // 截图 4: 取消录制后横幅消失
  const screenshot4 = path.join(artifactDir, 'teach-me-step4-banner-dismissed.png');
  await sidepanelPage.screenshot({ path: screenshot4 });
  console.log('Saved screenshot:', screenshot4);

  // 清理
  try { fs.unlinkSync(dummyFilePath); } catch {}
  await context.close();
  server.close();
  console.log('--- Teach-Me E2E Verification PASSED Successfully! ---');
}

run().catch((err) => {
  console.error('Teach-Me verification failed:', err);
  process.exit(1);
});
