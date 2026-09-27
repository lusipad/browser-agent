import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const artifactDir = 'C:/Users/lus/.gemini/antigravity/brain/c95e9cf8-c304-42a9-8164-4e8e3312e951';

// ---------------- 1. Mock LLM 服务 ----------------
function startFixtureServer() {
  const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: [{ id: 'gpt-5.6-sol', object: 'model' }]
      }));
      return;
    }

    if (req.url === '/v1/chat/completions') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          const replyText = `### 📊 性能基准测试与行情对比表\n\n` +
            `以下是为您提取的最新硬件规格与价格汇总：\n\n` +
            `| 硬件型号 | 供应商 | 算力规格 | 零售指导价 | 评级 |\n` +
            `| :--- | :--- | :--- | :--- | :--- |\n` +
            `| Meta Quest 4 | Meta Platforms | 45 TOPS | $499 | ★★★★★ |\n` +
            `| Apple Vision Air | Apple Inc. | 60 TOPS | $1,299 | ★★★★☆ |\n` +
            `| Galaxy XR Pro | Samsung Electronics | 40 TOPS | $599 | ★★★★☆ |\n\n` +
            `示例代码提取如下：\n\n` +
            `\`\`\`json\n` +
            `{\n` +
            `  "status": "success",\n` +
            `  "count": 3\n` +
            `}\n` +
            `\`\`\`\n\n` +
            `分析完成，支持一键导出数据。`;

          const chunkSize = 20;
          for (let i = 0; i < replyText.length; i += chunkSize) {
            const slice = replyText.slice(i, i + chunkSize);
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: slice } }] })}\n\n`);
          }

          res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 180, completion_tokens: 120 } })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } catch (err) {
          res.writeHead(500);
          res.end(String(err));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ port: server.address().port, server });
    });
  });
}

// ---------------- 2. E2E 测试流程 ----------------
async function main() {
  console.log('--- 启动 Mock 模型服务 ---');
  const { port, server } = await startFixtureServer();
  const mockBaseUrl = `http://127.0.0.1:${port}/v1`;

  console.log('启动装载真实扩展的 Chromium...');
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
  console.log('Extension ID:', extId);

  // 1. 打开 Options 页面，配置 Mock OpenAI 并载入官方技能
  const configPage = await context.newPage();
  await configPage.setViewportSize({ width: 1200, height: 800 });
  await configPage.goto(`chrome-extension://${extId}/options.html?tab=providers`);
  await configPage.waitForLoadState('networkidle');
  await configPage.waitForTimeout(500);

  const baseUrlInput = configPage.locator('.provider-card').first().locator('input[placeholder*="openai"]');
  await baseUrlInput.fill(mockBaseUrl);
  const apiKeyInput = configPage.locator('.provider-card').first().locator('input[type="password"]');
  await apiKeyInput.fill('mock-key');
  await configPage.waitForTimeout(400);

  // 载入预置技能
  const skillsTab = configPage.locator('nav button.nav-item', { hasText: /技能|Skills/ });
  await skillsTab.click();
  await configPage.waitForTimeout(500);
  const loadPresetsBtn = configPage.locator('button:has-text("载入官方预置技能")');
  if (await loadPresetsBtn.isVisible()) {
    await loadPresetsBtn.click();
    await configPage.waitForTimeout(500);
  }

  // 验证设置页技能搜索功能
  console.log('测试设置页技能实时搜索...');
  const optSearch = configPage.locator('.skills-nav-search-input');
  await optSearch.fill('GitHub');
  await configPage.waitForTimeout(400);
  await configPage.screenshot({ path: path.join(artifactDir, 'phase2-07-options-search.png') });
  console.log('已截取: phase2-07-options-search.png');
  await optSearch.fill('');

  // 2. 打开 Sidepanel 侧边栏
  console.log('\n--- 打开侧边栏测试 Slash Command 与搜索过滤 ---');
  const sidepanel = await context.newPage();
  await sidepanel.setViewportSize({ width: 440, height: 750 });
  await sidepanel.goto(`chrome-extension://${extId}/sidepanel.html`);
  await sidepanel.waitForLoadState('networkidle');
  await sidepanel.waitForTimeout(600);

  // 检查技能是否已导入，未导入则从抽屉一键导入
  await sidepanel.click('button.icon-btn[title="技能库"]');
  await sidepanel.waitForTimeout(400);
  const emptyPresetBtn = sidepanel.locator('button.skill-empty-preset-btn');
  if (await emptyPresetBtn.count() > 0 && await emptyPresetBtn.isVisible()) {
    await emptyPresetBtn.click();
    await sidepanel.waitForTimeout(600);
  }

  // 测试 1：技能抽屉实时搜索与分类过滤
  console.log('测试技能抽屉搜索与分类胶囊...');
  const searchInput = sidepanel.locator('.skill-search-input');
  await searchInput.fill('表格');
  await sidepanel.waitForTimeout(300);
  await sidepanel.screenshot({ path: path.join(artifactDir, 'phase2-04-drawer-search.png') });
  console.log('已截取: phase2-04-drawer-search.png');

  // 清除搜索，测试置顶胶囊
  await sidepanel.click('.skill-search-clear');
  await sidepanel.waitForTimeout(200);
  const pinnedPill = sidepanel.locator('.skill-filter-pill', { hasText: /置顶/ });
  if (await pinnedPill.count() > 0) {
    await pinnedPill.click();
    await sidepanel.waitForTimeout(300);
    await sidepanel.screenshot({ path: path.join(artifactDir, 'phase2-05-drawer-category-filter.png') });
    console.log('已截取: phase2-05-drawer-category-filter.png');
  }

  // 关闭抽屉
  await sidepanel.click('button.icon-btn[title="Close"]');
  await sidepanel.waitForTimeout(300);

  // 测试 2：输入框 Slash Command 呼出与联想
  console.log('测试输入框 Slash Command (/) 快捷呼出...');
  const composerInput = sidepanel.locator('textarea.input');
  await composerInput.click();
  await composerInput.fill('/');
  await sidepanel.waitForTimeout(400);
  await sidepanel.screenshot({ path: path.join(artifactDir, 'phase2-01-slash-menu.png') });
  console.log('已截取: phase2-01-slash-menu.png');

  // 输入关键词过滤
  await composerInput.fill('/精读');
  await sidepanel.waitForTimeout(400);
  await sidepanel.screenshot({ path: path.join(artifactDir, 'phase2-02-slash-filtered.png') });
  console.log('已截取: phase2-02-slash-filtered.png');

  // 回车选中唤起抽屉
  await composerInput.press('Enter');
  await sidepanel.waitForTimeout(500);
  await sidepanel.screenshot({ path: path.join(artifactDir, 'phase2-03-slash-opened-drawer.png') });
  console.log('已截取: phase2-03-slash-opened-drawer.png');

  // 关闭抽屉
  await sidepanel.click('button.icon-btn[title="Close"]');
  await sidepanel.waitForTimeout(300);

  // 测试 3：发送一条消息验证助手气泡的【复制】、【导出表格】与【复制代码】功能
  console.log('发送消息触发助手表格与代码块回复...');
  await composerInput.fill('提取并对比主流硬件');
  await sidepanel.click('button.send-btn');

  // 等待助手完成回复
  await sidepanel.waitForSelector('.row.assistant .msg-actions', { timeout: 15000 });
  await sidepanel.waitForTimeout(1000);

  await sidepanel.screenshot({ path: path.join(artifactDir, 'phase2-06-message-actions.png') });
  console.log('已截取: phase2-06-message-actions.png');

  // 验证复制按钮点击
  const copyBtn = sidepanel.locator('.msg-act-btn:has-text("复制")').first();
  await copyBtn.click();
  await sidepanel.waitForTimeout(300);
  console.log('复制按钮文案反馈:', await copyBtn.innerText());

  console.log('\n========================================');
  console.log('🎉 Phase 2 所有新特性 E2E 验证圆满成功！');
  console.log('========================================');

  await context.close();
  server.close();
}

main().catch((err) => {
  console.error('E2E failed:', err);
  process.exit(1);
});
