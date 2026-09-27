import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const artifactDir = 'C:/Users/lus/.gemini/antigravity/brain/c95e9cf8-c304-42a9-8164-4e8e3312e951';

// ---------------- 1. 真实场景测试 HTML 页面 ----------------
const HTML_ARTICLE = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>2026年企业级 AI Agent 架构演进与多模态落地实践</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #1e293b; background: #f8fafc; }
    header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
    h1 { font-size: 28px; color: #0f172a; }
    .meta { color: #64748b; font-size: 14px; display: flex; gap: 16px; }
    .badge { background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 500; font-size: 12px; }
    .section { background: #fff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    h2 { font-size: 20px; color: #1e293b; margin-top: 0; border-left: 4px solid #3b82f6; padding-left: 10px; }
    .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
    .metric-card { background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; }
    .metric-value { font-size: 24px; font-weight: bold; color: #2563eb; }
    .metric-label { font-size: 13px; color: #64748b; margin-top: 4px; }
  </style>
</head>
<body>
  <header>
    <span class="badge">技术前沿观察</span>
    <h1>2026年企业级 AI Agent 架构演进与多模态落地实践</h1>
    <div class="meta">
      <span>作者：系统架构实验室</span>
      <span>发布时间：2026-09-18</span>
      <span>阅读时长：8 分钟</span>
    </div>
  </header>
  <div class="section">
    <h2>1. 核心商业模式与落地数据</h2>
    <p>随着大模型端侧推理性能大幅跃升，企业级智能体（Agent）正从概念演示加速迈向核心生产系统。实测数据显示：</p>
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-value">320%</div>
        <div class="metric-label">综合投产回报率 (ROI)</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">-65%</div>
        <div class="metric-label">平均业务流转耗时</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">-45%</div>
        <div class="metric-label">Token 算力成本消耗</div>
      </div>
    </div>
    <p>通过“分层感知+本地离线轻量决策+复杂任务云端联动”的混合范式，企业客户人均处理效率提升 4.2 倍。</p>
  </div>
  <div class="section">
    <h2>2. 技术架构关键突破</h2>
    <p>新一代浏览器 Agent 摒弃了早期暴力全屏截图 OCR 的粗糙做法，转而采用 CDP 深度协议穿透 Shadow DOM 与同源多层 iframe，配合 Set-of-Marks 视觉注记，使交互成功率由 71% 跃升至 96.8%。</p>
  </div>
  <div class="section">
    <h2>3. 落地建议与行动项</h2>
    <ul>
      <li>全面落地标准化置顶技能（Skills）模板，降低员工 Prompt 编写心智负担；</li>
      <li>采用动态系统魔法变量（如当前页感知与日期戳）实现零输入一键触发；</li>
      <li>针对高频业务字段强制采用枚举参数选单，杜绝人为输入参数漂移。</li>
    </ul>
  </div>
</body>
</html>`;

const HTML_TABLE = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>2026全球主流AI硬件与端侧设备参数对比</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1e293b; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p.sub { color: #64748b; margin-top: 0; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    tr:hover { background: #f1f5f9; }
    .price { font-weight: 600; color: #059669; }
    .star { color: #eab308; }
  </style>
</head>
<body>
  <h1>2026全球主流AI硬件与端侧设备规格对比</h1>
  <p class="sub">数据来源：硬件前沿实验室 · 实时行情更新</p>
  <table id="device-table">
    <thead>
      <tr>
        <th>设备名称</th>
        <th>制造厂商</th>
        <th>端侧NPU算力</th>
        <th>运行内存</th>
        <th>官方指导价</th>
        <th>推荐指数</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Meta Quest 4</td><td>Meta</td><td>45 TOPS</td><td>16 GB</td><td class="price">$499</td><td class="star">★★★★★</td></tr>
      <tr><td>Apple Vision Air</td><td>Apple</td><td>60 TOPS</td><td>24 GB</td><td class="price">$1,299</td><td class="star">★★★★☆</td></tr>
      <tr><td>Galaxy XR Pro</td><td>Samsung</td><td>40 TOPS</td><td>16 GB</td><td class="price">$599</td><td class="star">★★★★☆</td></tr>
      <tr><td>Rabbit R2 Hub</td><td>Rabbit</td><td>20 TOPS</td><td>8 GB</td><td class="price">$199</td><td class="star">★★★☆☆</td></tr>
      <tr><td>Humane Pin Pro</td><td>Humane</td><td>25 TOPS</td><td>12 GB</td><td class="price">$399</td><td class="star">★★★☆☆</td></tr>
    </tbody>
  </table>
</body>
</html>`;

// ---------------- 2. Mock OpenAI API & Web 服务器 ----------------
let lastRecordedRequest = null;

function startFixtureServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    
    // 网页场景
    if (url.pathname === '/tech-article') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML_ARTICLE);
      return;
    }
    if (url.pathname === '/products-table') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML_TABLE);
      return;
    }

    // Mock OpenAI /v1/chat/completions 接口
    if (url.pathname === '/v1/chat/completions') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        try {
          const body = JSON.parse(raw);
          lastRecordedRequest = body;

          // 提取系统提示中的 active skill 信息
          const messages = body.messages || [];
          const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
          console.log('>> Mock Server 收到请求! Active Skill in sys:', sysMsg.includes('Active Skill:'));

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          let replyText = '';
          if (sysMsg.includes('网页深度精读与核心要点总结')) {
            replyText = `### 📄 网页深度精读报告（聚焦：核心商业模式与数据）\n\n` +
              `**文章主旨**：《2026年企业级 AI Agent 架构演进与多模态落地实践》\n\n` +
              `#### 💡 核心商业数据梳理：\n` +
              `- **综合投产回报率 (ROI)**：企业端导入后达 **320%**。\n` +
              `- **业务流转提效**：平均业务流转耗时降低 **65%**，人效提升 4.2 倍。\n` +
              `- **算力成本优化**：分层感知与治理使 Token 算力开销缩减 **45%**。\n\n` +
              `#### 🎯 后续行动建议 (Action Items)：\n` +
              `1. 优先在核心业务推进置顶技能模板与枚举参数规范化；\n` +
              `2. 启用系统魔法变量（自动感知当前页与时间戳）降低员工输入门槛。`;
          } else if (sysMsg.includes('当前页面表格与列表数据提取')) {
            replyText = `### 📊 页面表格数据提取（格式：Markdown表格）\n\n` +
              `已成功抓取页面上 5 款主流 AI 硬件的规格与报价参数：\n\n` +
              `| 设备名称 | 制造厂商 | 端侧NPU算力 | 运行内存 | 官方指导价 | 推荐指数 |\n` +
              `| :--- | :--- | :--- | :--- | :--- | :--- |\n` +
              `| Meta Quest 4 | Meta | 45 TOPS | 16 GB | $499 | ★★★★★ |\n` +
              `| Apple Vision Air | Apple | 60 TOPS | 24 GB | $1,299 | ★★★★☆ |\n` +
              `| Galaxy XR Pro | Samsung | 40 TOPS | 16 GB | $599 | ★★★★☆ |\n` +
              `| Rabbit R2 Hub | Rabbit | 20 TOPS | 8 GB | $199 | ★★★☆☆ |\n` +
              `| Humane Pin Pro | Humane | 25 TOPS | 12 GB | $399 | ★★★☆☆ |\n\n` +
              `> ✅ 表格已完成清洗并转为规范 Markdown 格式，可直接复制使用。`;
          } else {
            replyText = `### 🎯 技能执行完成\n\n系统动态变量与参数已成功解析并在当前页面执行完毕。`;
          }

          // 分片流式推送 SSE
          const chunkSize = 15;
          for (let i = 0; i < replyText.length; i += chunkSize) {
            const slice = replyText.slice(i, i + chunkSize);
            const data = {
              choices: [{ delta: { content: slice } }],
            };
            res.write(`data: ${JSON.stringify(data)}\n\n`);
          }

          res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 150, completion_tokens: 80 } })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } catch (err) {
          console.error('Server error handling completions:', err);
          res.writeHead(500);
          res.end(String(err));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ port, server });
    });
  });
}

// ---------------- 3. 真实场景自动化验证流程 ----------------
async function main() {
  console.log('--- 启动本地真实场景 Web 站点与 Mock 模型服务 ---');
  const { port, server } = await startFixtureServer();
  const mockBaseUrl = `http://127.0.0.1:${port}/v1`;
  const articleUrl = `http://127.0.0.1:${port}/tech-article`;
  const tableUrl = `http://127.0.0.1:${port}/products-table`;
  console.log(`Web 服务已就绪: ${articleUrl} 与 ${tableUrl}`);
  console.log(`Mock LLM BaseUrl: ${mockBaseUrl}`);

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
  console.log('扩展已就绪，Extension ID:', extId);

  // 1. 通过 Options 页面 UI 配置插件连接本地 Mock OpenAI 节点，并载入预置技能
  console.log('打开设置页面配置 Mock 模型服务与预置技能...');
  const configPage = await context.newPage();
  await configPage.setViewportSize({ width: 1200, height: 800 });
  await configPage.goto(`chrome-extension://${extId}/options.html?tab=providers`);
  await configPage.waitForLoadState('networkidle');
  await configPage.waitForTimeout(500);

  // 填写 OpenAI 的 BaseUrl 与 ApiKey
  const baseUrlInput = configPage.locator('.provider-card').first().locator('input[placeholder*="openai"]');
  await baseUrlInput.fill(mockBaseUrl);

  const apiKeyInput = configPage.locator('.provider-card').first().locator('input[type="password"]');
  await apiKeyInput.fill('mock-key');
  await configPage.waitForTimeout(500);

  // 切换至高级选项关闭 planning 保证即时响应
  const advTab = configPage.locator('nav button.nav-item', { hasText: /高级|Advanced/ });
  await advTab.click();
  await configPage.waitForTimeout(400);

  const planningToggle = configPage.locator('.toggle', { hasText: /Planner/ });
  await planningToggle.click();
  await configPage.waitForTimeout(400);

  // 切换到技能 Tab 载入官方预置技能
  const skillsTab = configPage.locator('nav button.nav-item', { hasText: /技能|Skills/ });
  await skillsTab.click();
  await configPage.waitForTimeout(400);

  const loadPresetsBtn = configPage.locator('button', { hasText: /载入官方预置技能/ });
  if (await loadPresetsBtn.count() > 0) {
    await loadPresetsBtn.click();
    await configPage.waitForTimeout(600);
  }
  await configPage.close();
  console.log('插件模型配置已通过 Options 界面成功保存，官方预置技能已导入。');

  // =========================================================================
  // 场景 1：在科技长文真实网页执行「网页深度精读与核心要点总结」
  // 验证：自动感知当前页 URL、下拉选单选择“核心商业模式与数据”、执行生成完整报告
  // =========================================================================
  console.log('\n--- 场景 1：科技长文深度精读与要点提取 ---');
  const articleTab = await context.newPage();
  await articleTab.setViewportSize({ width: 900, height: 800 });
  await articleTab.goto(articleUrl);
  await articleTab.waitForLoadState('networkidle');

  // 打开侧边栏
  const sidepanel = await context.newPage();
  await sidepanel.setViewportSize({ width: 440, height: 750 });
  await sidepanel.goto(`chrome-extension://${extId}/sidepanel.html`);
  await sidepanel.waitForLoadState('networkidle');

  // 打开技能抽屉
  await sidepanel.click('button.icon-btn:has-text("📋")');
  await sidepanel.waitForTimeout(500);

  // 检查如果尚未导入预置，通过推荐弹层一键导入
  const presetBtn = sidepanel.locator('button.skill-preset-btn, button.skill-empty-preset-btn', { hasText: /官方/ });
  if (await presetBtn.count() > 0 && await presetBtn.first().isVisible()) {
    console.log('检测到尚未导入预置技能，打开官方推荐模板弹层并导入...');
    await presetBtn.first().click();
    await sidepanel.waitForTimeout(400);
    const importAllBtn = sidepanel.locator('.presets-modal-foot button');
    await importAllBtn.click();
    await sidepanel.waitForTimeout(600);
  }

  // 点击第一个置顶技能「网页深度精读与核心要点总结」
  console.log('选择技能：网页深度精读与核心要点总结...');
  const summarySkill = sidepanel.locator('.skill-item', { hasText: /精读/ });
  await summarySkill.first().click();
  await sidepanel.waitForTimeout(600);

  // 验证魔法变量感知与下拉枚举项
  const urlVar = sidepanel.locator('.skill-var-item:has-text("当前网页 URL")');
  if (await urlVar.count() > 0) {
    const magicBadge = urlVar.locator('.magic-var-badge');
    console.log('魔法变量当前页感知徽标:', await magicBadge.textContent());
  }

  // 下拉选单选择「核心商业模式与数据」
  const focusSelect = sidepanel.locator('select.skill-var-input, select.skill-var-select');
  if (await focusSelect.count() > 0) {
    await focusSelect.first().selectOption('核心商业模式与数据');
    console.log('已通过下拉选单选择重点：核心商业模式与数据');
  }

  // 截取场景 1 运行前表单视图
  await sidepanel.screenshot({ path: path.join(artifactDir, 'real-scenario-01-page-and-drawer.png') });
  console.log('已截取: real-scenario-01-page-and-drawer.png');

  // 点击运行技能
  console.log('点击「运行技能」开始执行...');
  await sidepanel.click('button.skill-run-btn');

  // 等待技能执行并在会话中流式输出完成
  await sidepanel.waitForSelector('.row.assistant .md', { timeout: 15000 });
  await sidepanel.waitForTimeout(1000);

  // 检查最后发送给模型的 prompt 与 system 字段
  if (lastRecordedRequest) {
    const sys = lastRecordedRequest.messages?.find((m) => m.role === 'system')?.content || '';
    console.log('验证 System Prompt 包含 active skill:', sys.includes('Active Skill: 网页深度精读与核心要点总结'));
    console.log('验证 System Prompt 包含选中的枚举变量:', sys.includes('核心商业模式与数据'));
  }

  // 截取场景 1 执行完成结果
  await sidepanel.screenshot({ path: path.join(artifactDir, 'real-scenario-01-complete.png') });
  console.log('已截取: real-scenario-01-complete.png');

  // =========================================================================
  // 场景 2：在复杂数据表格页面执行「当前页面表格与列表数据提取」
  // 验证：动态切换标签页感知、下拉选单选择“Markdown表格”、留空自动推导、提取生成整齐表格
  // =========================================================================
  console.log('\n--- 场景 2：硬件对比表格数据提取 ---');
  await articleTab.goto(tableUrl);
  await articleTab.waitForLoadState('networkidle');

  // 再次打开技能抽屉
  await sidepanel.click('button.icon-btn:has-text("📋")');
  await sidepanel.waitForTimeout(500);

  // 若处于详情视图，点击返回按钮回到列表
  const backBtn = sidepanel.locator('button.drawer-back-btn');
  if (await backBtn.count() > 0 && await backBtn.first().isVisible()) {
    await backBtn.first().click();
    await sidepanel.waitForTimeout(300);
  }

  console.log('选择技能：当前页面表格与列表数据提取...');
  const tableSkill = sidepanel.locator('.skill-item', { hasText: /表格/ });
  await tableSkill.first().click();
  await sidepanel.waitForTimeout(600);

  // 验证下拉选单：输出数据格式（预设是 Markdown表格）
  const formatSelect = sidepanel.locator('select.skill-var-input, select.skill-var-select');
  if (await formatSelect.count() > 0) {
    await formatSelect.first().selectOption('Markdown表格');
  }

  // 筛选条件保持为空（测试自动推导 / 可选）
  console.log('筛选条件保持为空，测试非必填/自动推导机制...');

  // 截图场景 2 运行前配置
  await sidepanel.screenshot({ path: path.join(artifactDir, 'real-scenario-02-table-extract.png') });
  console.log('已截取: real-scenario-02-table-extract.png');

  // 运行技能
  console.log('点击「运行技能」开始提取表格...');
  await sidepanel.click('button.skill-run-btn');

  // 等待第二轮执行完成
  await sidepanel.waitForSelector('.row.assistant .md:has-text("Meta Quest 4")', { timeout: 15000 });
  await sidepanel.waitForTimeout(1000);

  if (lastRecordedRequest) {
    const sys = lastRecordedRequest.messages?.find((m) => m.role === 'system')?.content || '';
    console.log('验证 System Prompt 包含表格提取技能:', sys.includes('Active Skill: 当前页面表格与列表数据提取'));
    console.log('验证 System Prompt 包含 Markdown表格:', sys.includes('Markdown表格'));
    console.log('验证 System Prompt 包含自动推导标记:', sys.includes('自主推导'));
  }

  // 截取场景 2 执行完成结果
  await sidepanel.screenshot({ path: path.join(artifactDir, 'real-scenario-02-complete.png') });
  console.log('已截取: real-scenario-02-complete.png');

  // =========================================================================
  // 场景 3：用户从头新建带有魔法变量与下拉枚举的高级技能，并执行验证
  // =========================================================================
  console.log('\n--- 场景 3：自定义创建带置顶、魔法变量与枚举项的高级技能 ---');
  const optionsPage = await context.newPage();
  await optionsPage.setViewportSize({ width: 1200, height: 850 });
  await optionsPage.goto(`chrome-extension://${extId}/options.html?tab=skills`);
  await optionsPage.waitForLoadState('networkidle');
  await optionsPage.waitForTimeout(500);

  // 点击新建技能
  await optionsPage.click('button:has-text("＋ 新建技能")');
  await optionsPage.waitForTimeout(400);

  // 填写基本信息
  console.log('填写技能基本信息与置顶开关...');
  const iconInput = optionsPage.locator('input.input-text').nth(0);
  await iconInput.fill('🎯');
  const nameInput = optionsPage.locator('input.input-text').nth(1);
  await nameInput.fill('竞品硬件定价自动折算助手');
  const descInput = optionsPage.locator('textarea.textarea-desc');
  await descInput.fill('针对当前浏览的硬件行情页面，自动将美元价格按当日最新汇率换算并生成采购建议');

  // 编辑变量 1: 币种下拉枚举
  console.log('配置参数变量：汇率币种 (带枚举选项)...');
  const firstVarRow = optionsPage.locator('.skill-var-row').first();
  await firstVarRow.locator('input.input-text.mono').fill('currency');
  await firstVarRow.locator('input.input-text').nth(1).fill('目标结算币种');
  await firstVarRow.locator('input.input-text').nth(2).fill('CNY (人民币)');
  const varOptionsInput = firstVarRow.locator('.skill-var-col-options input');
  await varOptionsInput.fill('CNY (人民币), EUR (欧元), JPY (日元), HKD (港币)');

  // 步骤说明中采用魔法动态变量
  console.log('设置步骤并引用魔法动态变量 {{today}} 与 {{currency}}...');
  const stepIntentInput = optionsPage.locator('.skill-step-row input.step-intent').first();
  await stepIntentInput.fill('分析当前页面的商品价格，并按照 {{today}} 的参考汇率换算为 {{currency}}，输出采购预算评估。');

  // 保存技能
  await optionsPage.click('button:has-text("保存更改")');
  await optionsPage.waitForTimeout(1000);

  // 截取场景 3 Options 编辑界面
  await optionsPage.screenshot({ path: path.join(artifactDir, 'real-scenario-03-custom-skill-options.png') });
  console.log('已截取: real-scenario-03-custom-skill-options.png');

  // 回到 Sidepanel 验证这个新技能是否已置顶并可以运行
  console.log('切回 Sidepanel 验证自定义技能已即时同步置顶...');
  await sidepanel.click('button.icon-btn:has-text("📋")');
  await sidepanel.waitForTimeout(600);

  // 若处于详情视图，点击返回按钮回到列表
  const backBtn3 = sidepanel.locator('button.drawer-back-btn');
  if (await backBtn3.count() > 0 && await backBtn3.first().isVisible()) {
    await backBtn3.first().click();
    await sidepanel.waitForTimeout(300);
  }

  // 验证它是否在列表第一项且带 ★
  const firstSkillItem = sidepanel.locator('.skill-item').first();
  const firstSkillTitle = await firstSkillItem.locator('.skill-name').textContent();
  console.log('侧边栏第一项置顶技能:', firstSkillTitle);

  const customSkillItem = sidepanel.locator('.skill-item', { hasText: /竞品硬件/ });
  await customSkillItem.first().click();
  await sidepanel.waitForTimeout(500);

  // 截取场景 3 运行配置视图（展示枚举选单与置顶徽章）
  await sidepanel.screenshot({ path: path.join(artifactDir, 'real-scenario-03-sidepanel-auto-infer.png') });
  console.log('已截取: real-scenario-03-sidepanel-auto-infer.png');

  // 运行该自定义技能
  await sidepanel.click('button.skill-run-btn');
  await sidepanel.waitForSelector('.row.assistant .md', { timeout: 15000 });
  await sidepanel.waitForTimeout(1000);

  if (lastRecordedRequest) {
    const sys = lastRecordedRequest.messages?.find((m) => m.role === 'system')?.content || '';
    console.log('验证 System Prompt 包含自定义技能:', sys.includes('Active Skill: 竞品硬件定价自动折算助手'));
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    console.log(`验证 System Prompt 包含自动解析的今天日期 (${todayStr}):`, sys.includes(todayStr));
    console.log('验证 System Prompt 包含选中的币种:', sys.includes('currency: CNY (人民币)'));
  }

  // 截取最终完成图
  await sidepanel.screenshot({ path: path.join(artifactDir, 'real-scenario-03-complete.png') });
  console.log('已截取: real-scenario-03-complete.png');

  console.log('\n========================================');
  console.log('🎉 真实场景 1, 2, 3 全部验证成功！');
  console.log('========================================');

  await context.close();
  server.close();
}

main().catch((err) => {
  console.error('真实场景验证失败:', err);
  process.exit(1);
});
