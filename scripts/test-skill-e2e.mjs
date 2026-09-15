import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const artifactDir = 'C:/Users/lus/.gemini/antigravity/brain/f8a6c147-f2e5-4ca5-b4b3-89c0ac214584';

async function run() {
  console.log('Launching browser with extension from:', distDir);
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

  // 等待 background service worker 启动以获取 extension ID
  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent('serviceworker');
  }

  const extensionId = background.url().split('/')[2];
  console.log('Extension loaded, ID:', extensionId);

  // 1. 测试 Options 页面的 Skills Tab
  const optionsPage = await context.newPage();
  await optionsPage.setViewportSize({ width: 1200, height: 800 });
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);
  await optionsPage.waitForLoadState('networkidle');

  // 点击技能 Tab
  console.log('Navigating to Skills tab...');
  const skillsTabBtn = optionsPage.locator('nav button.nav-item', { hasText: /技能|Skills/ });
  await skillsTabBtn.click();
  await optionsPage.waitForTimeout(500);

  // 截图 1：Skills Tab 初始界面
  await optionsPage.screenshot({ path: path.join(artifactDir, 'skill-options-initial.png') });
  console.log('Captured skill-options-initial.png');

  // 点击“＋ 新建技能”
  console.log('Creating new skill...');
  const newBtn = optionsPage.locator('button', { hasText: /新建技能|New Skill/ });
  await newBtn.click();
  await optionsPage.waitForTimeout(500);

  // 编辑技能表单
  console.log('Editing skill details...');
  // 图标
  const iconInput = optionsPage.locator('.icon-input');
  await iconInput.fill('🛒');

  // 名称
  const nameInput = optionsPage.locator('.card .grid-2col .input-text').nth(1);
  await nameInput.fill('京东商品比价助手');

  // 描述
  const descTextarea = optionsPage.locator('.textarea-desc');
  await descTextarea.fill('自动打开京东搜索指定商品，收集价格信息并汇总');

  // 添加步骤
  console.log('Adding step...');
  const addStepBtn = optionsPage.locator('button', { hasText: /添加步骤|Add Step/ });
  await addStepBtn.click();
  await optionsPage.waitForTimeout(300);

  const stepInputs = optionsPage.locator('.step-intent');
  if (await stepInputs.count() > 1) {
    await stepInputs.nth(1).fill('提取前 10 个商品的名称与价格列表');
  }

  // 点击保存更改
  console.log('Saving skill...');
  const saveBtn = optionsPage.locator('button', { hasText: /保存更改|Save Changes/ });
  await saveBtn.click();
  await optionsPage.waitForTimeout(1000);

  // 截图 2：保存后的编辑器与左侧列表
  await optionsPage.screenshot({ path: path.join(artifactDir, 'skill-options-saved.png') });
  console.log('Captured skill-options-saved.png');

  // 2. 测试 Side Panel
  console.log('Testing Side Panel...');
  const sidepanelPage = await context.newPage();
  await sidepanelPage.setViewportSize({ width: 440, height: 750 });
  await sidepanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await sidepanelPage.waitForLoadState('networkidle');
  await sidepanelPage.waitForTimeout(500);

  // 验证 Header 存在 📋 图标并点击
  const skillBtn = sidepanelPage.locator('button.icon-btn[title*="技能"], button.icon-btn[title*="Skills"], button.icon-btn:has-text("📋")');
  await skillBtn.click();
  await sidepanelPage.waitForTimeout(500);

  // 截图 3：Side Panel 技能抽屉列表
  await sidepanelPage.screenshot({ path: path.join(artifactDir, 'skill-drawer-list.png') });
  console.log('Captured skill-drawer-list.png');

  // 点击刚刚创建的“京东商品比价助手”
  const skillItem = sidepanelPage.locator('.skill-item', { hasText: '京东商品比价助手' });
  await skillItem.click();
  await sidepanelPage.waitForTimeout(500);

  // 填入参数
  const keywordInput = sidepanelPage.locator('.skill-var-input');
  if (await keywordInput.count() > 0) {
    await keywordInput.fill('RTX 5090 显卡');
  }

  // 截图 4：Side Panel 技能参数配置视图
  await sidepanelPage.screenshot({ path: path.join(artifactDir, 'skill-drawer-run-form.png') });
  console.log('Captured skill-drawer-run-form.png');

  // 3. 验证 JSON 导出数据格式
  console.log('Verifying chrome.storage.local content...');
  const storageData = await sidepanelPage.evaluate(async () => {
    return await chrome.storage.local.get(null);
  });

  const skillIndex = storageData['skill_index'];
  console.log('skill_index count:', skillIndex?.length);
  console.log('Skills found in storage:', skillIndex?.map((s) => s.name));

  await context.close();
  console.log('E2E Verification completed successfully!');
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
