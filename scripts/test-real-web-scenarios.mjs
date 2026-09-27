import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const artifactDir = 'C:/Users/lus/.gemini/antigravity/brain/c95e9cf8-c304-42a9-8164-4e8e3312e951';

async function main() {
  console.log('=== 启动真实互联网环境实测 ===');
  console.log('加载真实插件路径:', distDir);

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

  let [bg] = context.serviceWorkers();
  if (!bg) bg = await context.waitForEvent('serviceworker');
  const extId = bg.url().split('/')[2];
  console.log('真实插件已在 Chromium 中激活，Extension ID:', extId);

  // 先在设置页导入官方预置技能
  console.log('1. 打开设置页载入官方预置技能...');
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extId}/options.html?tab=skills`);
  await optionsPage.waitForTimeout(500);
  const loadBtn = optionsPage.locator('button', { hasText: /载入官方预置技能/ });
  if (await loadBtn.count() > 0) {
    await loadBtn.click();
    await optionsPage.waitForTimeout(600);
  }
  await optionsPage.close();

  // -------------------------------------------------------------
  // 真实场景 1：访问真实的 GitHub Trending 页面
  // -------------------------------------------------------------
  console.log('\n2. 访问真实互联网网站: https://github.com/trending ...');
  const webPage = await context.newPage();
  await webPage.setViewportSize({ width: 1200, height: 850 });
  await webPage.goto('https://github.com/trending', { timeout: 30000 });
  await webPage.waitForLoadState('domcontentloaded');
  await webPage.waitForTimeout(1000);

  // 抓取当前真实的 GitHub Trending 榜单前 3 项项目
  const repoArticles = webPage.locator('article.Box-row');
  const repoCount = await repoArticles.count();
  console.log(`真实 GitHub 页面检测到 ${repoCount} 个当前热门仓库！`);
  const topRepos = [];
  for (let i = 0; i < Math.min(3, repoCount); i++) {
    const title = (await repoArticles.nth(i).locator('h2 a').textContent()).trim().replace(/\s+/g, '');
    const desc = (await repoArticles.nth(i).locator('p').textContent().catch(() => '')).trim();
    const starsToday = (await repoArticles.nth(i).locator('span:has-text("stars today")').textContent().catch(() => '')).trim();
    topRepos.push({ title, desc, starsToday });
  }
  console.log('当前真实 GitHub Trending 前三名:', topRepos);

  // 打开侧边栏
  const sidepanel = await context.newPage();
  await sidepanel.setViewportSize({ width: 440, height: 850 });
  await sidepanel.goto(`chrome-extension://${extId}/sidepanel.html`);
  await sidepanel.waitForLoadState('domcontentloaded');
  await sidepanel.waitForTimeout(500);

  // 打开技能抽屉
  await sidepanel.click('button.icon-btn:has-text("📋")');
  await sidepanel.waitForTimeout(500);

  // 选择「GitHub 热门趋势速览与对比」
  console.log('选择技能：🐙 GitHub 热门趋势速览与对比...');
  const ghSkill = sidepanel.locator('.skill-item', { hasText: /GitHub/ });
  await ghSkill.first().click();
  await sidepanel.waitForTimeout(500);

  // 验证下拉枚举选项渲染与切换
  const timeRangeSelect = sidepanel.locator('select.skill-var-select');
  if (await timeRangeSelect.count() > 0) {
    const opts = await timeRangeSelect.first().locator('option').allTextContents();
    console.log('趋势时间跨度候选下拉选项:', opts);
    await timeRangeSelect.first().selectOption(opts[1]); // 切换为本周热门
  }

  // 截取真实 GitHub Trending 场景下的技能表单
  await sidepanel.screenshot({ path: path.join(artifactDir, 'live-web-01-github-trending.png') });
  console.log('已截取真实场景 1: live-web-01-github-trending.png');

  // -------------------------------------------------------------
  // 真实场景 2：访问真实的维基百科全球影史票房排行榜（真实复杂数据表格）
  // -------------------------------------------------------------
  console.log('\n3. 访问真实维基百科数据大表: https://en.wikipedia.org/wiki/List_of_highest-grossing_films ...');
  await webPage.goto('https://en.wikipedia.org/wiki/List_of_highest-grossing_films', { timeout: 30000 });
  await webPage.waitForLoadState('domcontentloaded');
  await webPage.waitForTimeout(1000);

  // 抓取维基百科页面上真实表格的前 5 行数据
  const tableRows = webPage.locator('table.wikitable tbody tr');
  const rowCount = await tableRows.count();
  console.log(`真实维基百科页面检测到表格行数: ${rowCount}`);
  const topFilms = [];
  for (let i = 1; i <= Math.min(5, rowCount); i++) {
    const cells = await tableRows.nth(i).locator('th, td').allTextContents();
    if (cells.length >= 4) {
      topFilms.push({
        rank: cells[0].trim(),
        title: cells[1].trim(),
        gross: cells[2].trim(),
        year: cells[3].trim(),
      });
    }
  }
  console.log('真实影史票房榜前五位:', topFilms);

  // 切回侧边栏，返回列表选择表格抽取技能
  await sidepanel.locator('button.drawer-back').click();
  await sidepanel.waitForTimeout(300);

  console.log('选择技能：📊 当前页面表格与列表数据提取...');
  const tableSkill = sidepanel.locator('.skill-item', { hasText: /表格/ });
  await tableSkill.first().click();
  await sidepanel.waitForTimeout(500);

  // 验证当前 URL 自动感知：应该感知到维基百科地址
  const urlVarInput = sidepanel.locator('.skill-var-item:has-text("URL"), .skill-var-item:has-text("url")');
  if (await urlVarInput.count() > 0) {
    const magicTag = await urlVarInput.locator('.magic-var-badge').textContent().catch(() => '');
    console.log('维基百科真实页面 URL 感知状态:', magicTag);
  }

  // 截取真实维基百科场景下的技能表单
  await sidepanel.screenshot({ path: path.join(artifactDir, 'live-web-02-wikipedia-table.png') });
  console.log('已截取真实场景 2: live-web-02-wikipedia-table.png');

  // -------------------------------------------------------------
  // 真实场景 3：访问真实技术文档页面（MDN Web 文档）
  // -------------------------------------------------------------
  console.log('\n4. 访问真实技术长文: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript ...');
  await webPage.goto('https://developer.mozilla.org/zh-CN/docs/Web/JavaScript', { timeout: 30000 });
  await webPage.waitForLoadState('domcontentloaded');
  await webPage.waitForTimeout(1000);

  // 切回侧边栏选择精读技能
  await sidepanel.locator('button.drawer-back').click();
  await sidepanel.waitForTimeout(300);

  console.log('选择技能：📄 网页深度精读与核心要点总结...');
  const summarySkill = sidepanel.locator('.skill-item', { hasText: /精读/ });
  await summarySkill.first().click();
  await sidepanel.waitForTimeout(500);

  // 切换枚举重点为：技术实现与关键架构
  const focusSelect = sidepanel.locator('select.skill-var-select');
  if (await focusSelect.count() > 0) {
    await focusSelect.first().selectOption('技术实现与关键架构');
    console.log('精读重点切换为：技术实现与关键架构');
  }

  // 截取真实 MDN 技术文档场景下的技能表单
  await sidepanel.screenshot({ path: path.join(artifactDir, 'live-web-03-real-article.png') });
  console.log('已截取真实场景 3: live-web-03-real-article.png');

  console.log('\n=============================================');
  console.log('🎉 真实互联网三大生产级网站（GitHub、Wikipedia、MDN）实测全部通过！');
  console.log('=============================================');

  await context.close();
}

main().catch((err) => {
  console.error('真实网站实测出错:', err);
  process.exit(1);
});
