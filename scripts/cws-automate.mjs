import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const userDataDir = 'C:\\Users\\lus\\AppData\\Local\\Google\\Chrome\\User Data';
const targetUrl = 'https://chrome.google.com/webstore/devconsole/08f37905-643e-49e4-8412-15b5c0506cfa';
const zipPath = path.resolve(projectRoot, 'browser-agent-0.4.1.zip');
const heroImg = path.resolve(projectRoot, 'docs/screenshots/store-hero.png');
const optionsImg = path.resolve(projectRoot, 'docs/screenshots/options.png');
const promoImg = path.resolve(projectRoot, 'docs/screenshots/promo-tile-440x280.png');

const PRIVACY_POLICY = 'https://github.com/lusipad/browser-agent/blob/main/PRIVACY.md';
const SINGLE_PURPOSE = '一个在浏览器侧边栏运行的 AI 助手：用户用自然语言下达任务，扩展代表用户在用户已授权的网页上执行浏览操作（打开标签页、点击、填表、读取内容、调试网页）并汇报结果。所有大模型推理由用户自行配置的 OpenAI 兼容接口完成。';
const DEBUGGER_JUSTIFICATION = '通过 Chrome DevTools Protocol 生成可信的输入事件（鼠标点击、键盘输入）与截图，这是可靠代表用户操作网页所必需的——普通合成事件会被许多站点的框架/防护忽略。附加调试器时 Chrome 会在页面顶部显示调试横幅，用户始终可见扩展正在操作哪个标签页。仅在用户下达任务且站点被授权后使用，绝不用于监视用户。';
const ALL_URLS_JUSTIFICATION = '用户可能要求在任意网站上执行任务，故需广泛主机权限；但实际操作前每个站点都要经用户逐站授权，未授权站点不会被读取或操作，且金融/支付类站点预置为完全禁止。';

async function main() {
  console.log('Starting CWS Automation Pipeline...');
  console.log('Checking prerequisites:');
  console.log(' - ZIP file:', zipPath, fs.existsSync(zipPath));
  console.log(' - Hero screenshot:', heroImg, fs.existsSync(heroImg));
  console.log(' - Options screenshot:', optionsImg, fs.existsSync(optionsImg));

  if (!fs.existsSync(zipPath)) {
    throw new Error('Package ZIP does not exist: ' + zipPath);
  }

  console.log('\nLaunching Chrome with existing profile...');
  let context = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless: false,
        viewport: null,
        args: ['--start-maximized', '--no-default-browser-check']
      });
      break;
    } catch (err) {
      console.log(`Launch attempt ${attempt} failed: ${err.message}. Retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!context) {
    throw new Error('Failed to launch Chrome persistent context after 5 attempts.');
  }

  const page = context.pages()[0] || await context.newPage();
  console.log('Navigating to CWS Item console:', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 90000 }).catch(async () => {
    console.log('Networkidle timed out, proceeding with domcontentloaded');
  });

  await page.waitForTimeout(5000);
  console.log('Current URL:', page.url());
  console.log('Title:', await page.title());

  const screenshotPath = path.resolve(projectRoot, 'docs/screenshots/cws-initial.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved initial screenshot:', screenshotPath);

  // Check if we are redirected to login
  if (page.url().includes('accounts.google.com')) {
    console.log('⚠️ Login required. Please log into your Google Account in the browser window.');
    console.log('Waiting for navigation back to devconsole...');
    await page.waitForURL('**/devconsole/**', { timeout: 180000 });
  }

  console.log('\n--- Step 1: Package Tab ---');
  // Look for Package tab or link
  const packageLink = page.getByRole('tab', { name: /程序包|Package/i }).or(page.getByRole('link', { name: /程序包|Package/i })).or(page.locator('text=程序包')).first();
  if (await packageLink.isVisible()) {
    console.log('Clicking Package tab...');
    await packageLink.click();
    await page.waitForTimeout(3000);
  }

  // Look for Upload button or file input
  const fileInput = page.locator('input[type="file"]').first();
  const uploadButton = page.getByRole('button', { name: /上传新版本|Upload new package|Upload/i }).first();

  if (await fileInput.count() > 0) {
    console.log('Setting file input to:', zipPath);
    await fileInput.setInputFiles(zipPath);
    await page.waitForTimeout(10000);
  } else if (await uploadButton.isVisible()) {
    console.log('Found upload button, listening for file chooser...');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null),
      uploadButton.click()
    ]);
    if (fileChooser) {
      await fileChooser.setFiles(zipPath);
      console.log('Uploaded zip via fileChooser!');
      await page.waitForTimeout(10000);
    }
  }

  await page.screenshot({ path: path.resolve(projectRoot, 'docs/screenshots/cws-step1-package.png') });

  console.log('\n--- Step 2: Store listing Tab ---');
  const storeListingLink = page.getByRole('tab', { name: /商品发布信息|Store listing/i }).or(page.getByRole('link', { name: /商品发布信息|Store listing/i })).or(page.locator('text=商品发布信息')).first();
  if (await storeListingLink.isVisible()) {
    console.log('Clicking Store listing tab...');
    await storeListingLink.click();
    await page.waitForTimeout(3000);
  }

  // Privacy policy input
  const privacyInput = page.locator('input[placeholder*="privacy" i], input[aria-label*="隐私权" i], input[name*="privacy" i]').or(page.locator('input[type="url"]').first());
  if (await privacyInput.count() > 0 && await privacyInput.first().isVisible()) {
    console.log('Filling Privacy Policy URL...');
    await privacyInput.first().fill(PRIVACY_POLICY);
  }

  await page.screenshot({ path: path.resolve(projectRoot, 'docs/screenshots/cws-step2-listing.png') });

  console.log('\n--- Step 3: Privacy practices Tab ---');
  const privacyLink = page.getByRole('tab', { name: /隐私权规范|Privacy practices/i }).or(page.getByRole('link', { name: /隐私权规范|Privacy practices/i })).or(page.locator('text=隐私权规范')).first();
  if (await privacyLink.isVisible()) {
    console.log('Clicking Privacy practices tab...');
    await privacyLink.click();
    await page.waitForTimeout(3000);
  }

  // Single purpose textarea
  const textareas = page.locator('textarea');
  const textareaCount = await textareas.count();
  console.log('Found textareas count:', textareaCount);
  if (textareaCount > 0) {
    console.log('Filling primary textareas...');
    // Usually first is single purpose
    await textareas.nth(0).fill(SINGLE_PURPOSE);
  }

  await page.screenshot({ path: path.resolve(projectRoot, 'docs/screenshots/cws-step3-privacy.png') });

  console.log('\nPipeline executed. Inspecting final state...');
  console.log('Browser remains open for user review.');
}

main().catch(err => {
  console.error('Error during execution:', err);
});
