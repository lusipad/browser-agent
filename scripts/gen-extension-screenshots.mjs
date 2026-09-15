import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.resolve(root, 'dist');
const out = path.resolve(root, 'docs/screenshots');

async function main() {
  console.log('Launching browser to capture extension screenshots...');
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--headless=new`,
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
      '--lang=zh-CN',
      '--no-sandbox',
      '--disable-gpu',
    ],
    viewport: { width: 1280, height: 800 },
  });

  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  console.log('Extension ID:', extId);

  // 1. Capture Options - Providers
  const optPage = await ctx.newPage();
  await optPage.setViewportSize({ width: 1280, height: 800 });
  await optPage.goto(`chrome-extension://${extId}/options.html`);
  await optPage.waitForLoadState('networkidle');
  await optPage.waitForTimeout(500);
  await optPage.screenshot({ path: path.join(out, 'options.png') });
  console.log('Captured options.png');

  // 2. Capture Options - Skills
  const skillsTabBtn = optPage.locator('nav button.nav-item', { hasText: /技能|Skills/ });
  await skillsTabBtn.click();
  await optPage.waitForTimeout(400);
  // Click new skill to show rich editor
  const newBtn = optPage.locator('button', { hasText: /新建技能|New Skill/ });
  if (await newBtn.isVisible()) {
    await newBtn.click();
    await optPage.waitForTimeout(300);
    const iconInput = optPage.locator('.icon-input');
    await iconInput.fill('🛒');
    const nameInput = optPage.locator('.card .grid-2col .input-text').nth(1);
    await nameInput.fill('电商多平台商品比价助手');
    const descTextarea = optPage.locator('.textarea-desc');
    await descTextarea.fill('自动搜索并比对商品在京东、淘宝与拼多多的价格，汇总生成比价表格');
    const addStepBtn = optPage.locator('button', { hasText: /添加步骤|Add Step/ });
    await addStepBtn.click();
    await optPage.waitForTimeout(300);
    const stepInputs = optPage.locator('.step-intent');
    if (await stepInputs.count() > 0) {
      await stepInputs.first().fill('在搜索框中输入 {{keyword}} 并点击搜索');
    }
    const saveBtn = optPage.locator('button', { hasText: /保存更改|Save Changes/ });
    await saveBtn.click();
    await optPage.waitForTimeout(600);
  }
  await optPage.screenshot({ path: path.join(out, 'options-skills.png') });
  console.log('Captured options-skills.png');

  // 3. Capture Options - Safety & Sync
  const safetyTabBtn = optPage.locator('nav button.nav-item', { hasText: /安全|Safety/ });
  await safetyTabBtn.click();
  await optPage.waitForTimeout(500);
  await optPage.screenshot({ path: path.join(out, 'options-sync.png') });
  console.log('Captured options-sync.png');
  await optPage.close();

  // 4. Capture Sidepanel - Default
  const spPage = await ctx.newPage();
  await spPage.setViewportSize({ width: 440, height: 750 });
  await spPage.goto(`chrome-extension://${extId}/sidepanel.html`);
  await spPage.waitForLoadState('networkidle');
  await spPage.waitForTimeout(500);
  await spPage.screenshot({ path: path.join(out, 'sidepanel.png') });
  console.log('Captured sidepanel.png');

  // 5. Capture Sidepanel - Skill Drawer
  const skillBtn = spPage.locator('button.icon-btn[title*="技能"], button.icon-btn[title*="Skills"], button.icon-btn:has-text("📋")');
  if (await skillBtn.isVisible()) {
    await skillBtn.click();
    await spPage.waitForTimeout(500);
  }
  await spPage.screenshot({ path: path.join(out, 'sidepanel-skills.png') });
  console.log('Captured sidepanel-skills.png');
  await spPage.close();

  await ctx.close();
  console.log('All extension screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Failed to capture screenshots:', err);
  process.exit(1);
});
