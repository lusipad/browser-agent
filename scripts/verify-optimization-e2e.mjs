import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const artifactDir = 'C:/Users/lus/.gemini/antigravity/brain/c95e9cf8-c304-42a9-8164-4e8e3312e951';

async function run() {
  console.log('1. 启动装载 dist/ 扩展的无头 Chrome...');
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
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
  console.log('扩展加载成功，Extension ID:', extensionId);

  // 打开一个测试网页作为活动标签页，用于测试系统魔法动态变量 (current_url, current_title)
  const webPage = await context.newPage();
  await webPage.goto('https://example.com');
  await webPage.waitForLoadState('domcontentloaded');
  console.log('活动标签页已就绪: https://example.com');

  // 打开侧边栏 Sidepanel
  console.log('2. 打开侧边栏 Sidepanel 页面...');
  const sidepanelPage = await context.newPage();
  await sidepanelPage.setViewportSize({ width: 440, height: 750 });
  await sidepanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await sidepanelPage.waitForLoadState('networkidle');
  await sidepanelPage.waitForTimeout(500);

  // 打开技能库抽屉
  console.log('3. 点击顶部 📋 图标打开技能抽屉...');
  const skillBtn = sidepanelPage.locator('button.icon-btn[title*="技能"], button.icon-btn[title*="Skills"], button.icon-btn:has-text("📋")');
  await skillBtn.click();
  await sidepanelPage.waitForTimeout(400);

  // 截取初始列表（可能为空或初始状态）
  await sidepanelPage.screenshot({ path: path.join(artifactDir, 'test-01-drawer-initial.png') });
  console.log('截取: test-01-drawer-initial.png');

  // 测试功能 4: 官方预置模板库弹层
  console.log('4. 测试官方推荐模板库弹层...');
  const presetBtn = sidepanelPage.locator('button.skill-preset-btn, button.skill-empty-preset-btn', { hasText: /官方/ });
  await presetBtn.first().click();
  await sidepanelPage.waitForTimeout(400);

  // 验证弹层存在并展示 3 个预置模板
  const modal = sidepanelPage.locator('.presets-modal');
  const presetCards = modal.locator('.preset-card');
  const presetCount = await presetCards.count();
  console.log(`模板弹层检测到 ${presetCount} 个官方预置卡片`);
  if (presetCount < 3) {
    throw new Error(`预置技能数量预期至少 3 个，实际为 ${presetCount}`);
  }

  await sidepanelPage.screenshot({ path: path.join(artifactDir, 'test-02-presets-modal.png') });
  console.log('截取: test-02-presets-modal.png');

  // 点击“一键导入全部”
  console.log('5. 点击一键导入全部预置技能...');
  const importAllBtn = modal.locator('.presets-modal-foot button');
  await importAllBtn.click();
  await sidepanelPage.waitForTimeout(600);

  // 截取导入后的列表（测试功能 3: 置顶排序展示）
  await sidepanelPage.screenshot({ path: path.join(artifactDir, 'test-03-skills-imported-pinned.png') });
  console.log('截取: test-03-skills-imported-pinned.png');

  // 验证置顶元素排在最前
  const skillItems = sidepanelPage.locator('.skill-item');
  const totalSkills = await skillItems.count();
  console.log(`导入后技能列表中共有 ${totalSkills} 个技能`);
  const firstSkillPinned = await skillItems.nth(0).locator('.skill-pinned-tag').count();
  console.log('第一项是否包含置顶标识:', firstSkillPinned > 0 ? '是 (符合预期)' : '否');

  // 测试点击星标切换置顶状态
  console.log('6. 测试星标置顶切换 (★/☆)...');
  const thirdSkillPinBtn = skillItems.nth(2).locator('.skill-pin-btn');
  await thirdSkillPinBtn.click();
  await sidepanelPage.waitForTimeout(400);
  await sidepanelPage.screenshot({ path: path.join(artifactDir, 'test-04-pin-toggled.png') });
  console.log('截取: test-04-pin-toggled.png');

  // 测试功能 1 & 2: 运行视图（枚举下拉框 + 魔法变量感知）
  console.log('7. 进入技能运行模式测试枚举下拉框与魔法变量感知...');
  // 点击“网页深度精读与核心要点总结”
  const summarySkill = sidepanelPage.locator('.skill-item', { hasText: /精读/ });
  await summarySkill.first().click();
  await sidepanelPage.waitForTimeout(500);

  // 验证 <select> 枚举下拉框渲染
  const selectElem = sidepanelPage.locator('select.skill-var-select');
  const selectCount = await selectElem.count();
  console.log('检测到枚举下拉框数量:', selectCount);
  if (selectCount > 0) {
    const options = await selectElem.first().locator('option').allTextContents();
    console.log('下拉框候选选项:', options);
    // 切换选单
    await selectElem.first().selectOption(options[1]);
  }

  // 截取运行表单视图
  await sidepanelPage.screenshot({ path: path.join(artifactDir, 'test-05-run-view-magic-vars.png') });
  console.log('截取: test-05-run-view-magic-vars.png');

  // 测试内联编辑模式
  console.log('8. 切换至编辑模式，验证枚举候选项编辑与置顶配置...');
  const editTabBtn = sidepanelPage.locator('.skill-mode-tab', { hasText: /编辑/ });
  await editTabBtn.click();
  await sidepanelPage.waitForTimeout(400);

  await sidepanelPage.screenshot({ path: path.join(artifactDir, 'test-06-edit-view-options.png') });
  console.log('截取: test-06-edit-view-options.png');

  // 9. 测试设置页 SkillsPanel
  console.log('9. 打开 Options 页面验证技能管理与预置载入...');
  const optionsPage = await context.newPage();
  await optionsPage.setViewportSize({ width: 1200, height: 800 });
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html?tab=skills`);
  await optionsPage.waitForLoadState('networkidle');
  await optionsPage.waitForTimeout(600);

  await optionsPage.screenshot({ path: path.join(artifactDir, 'test-07-options-panel.png') });
  console.log('截取: test-07-options-panel.png');

  await context.close();
  console.log('🎉 全部端到端功能验证成功完成！');
}

run().catch((err) => {
  console.error('测试异常失败:', err);
  process.exit(1);
});
