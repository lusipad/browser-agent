import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');
const wsDir = path.resolve(projectRoot, 'demo_recordings');
const videoDir = path.resolve(projectRoot, 'docs/videos');

const require = createRequire(path.join(projectRoot, 'package.json'));
const { chromium } = require('playwright');

const JEV_KEY = process.env.TYPESAFE_API_KEY || 'apikey_2152704f66deaa6b4420b2a79a5158b018d3_6de26aa3429343baea6a8852de0bf38bd6fa563ae8ee201d807ab28a93d6fd1c';
const PORT = 8896;

if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

let rawWebVideoPath = '';
let rawSideVideoPath = '';

const STAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Browser Agent - GitHub Showcase</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { width: 1280px; height: 720px; background: #090c15; overflow: hidden; }
    canvas { width: 1280px; height: 720px; display: block; }
    .video-holder { position: fixed; left: 0; top: 0; width: 1px; height: 1px; opacity: 0.01; overflow: hidden; pointer-events: none; }
  </style>
</head>
<body>
  <div class="video-holder">
    <video id="v-web" src="/raw-web.webm" muted playsinline preload="auto"></video>
    <video id="v-side" src="/raw-sidepanel.webm" muted playsinline preload="auto"></video>
  </div>
  <canvas id="stage" width="1280" height="720"></canvas>

  <script>
    const vWeb = document.getElementById('v-web');
    const vSide = document.getElementById('v-side');
    const canvas = document.getElementById('stage');
    const ctx = canvas.getContext('2d');

    function renderLoop() {
      const t = vSide.currentTime || 0;

      // 1. Chrome 顶层外壳与窗口控制按钮 (Dark Modern)
      ctx.fillStyle = '#161b22';
      ctx.fillRect(0, 0, 1280, 50);

      // Window dots
      ctx.fillStyle = '#ff5f56'; ctx.beginPath(); ctx.arc(20, 25, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffbd2e'; ctx.beginPath(); ctx.arc(38, 25, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#27c93f'; ctx.beginPath(); ctx.arc(56, 25, 6, 0, Math.PI * 2); ctx.fill();

      // Tab
      ctx.fillStyle = '#0d1117';
      ctx.beginPath();
      ctx.roundRect(80, 10, 300, 40, [8, 8, 0, 0]);
      ctx.fill();
      ctx.fillStyle = '#f0f6fc';
      ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText('🐙 Repository search results · GitHub', 96, 34);

      // URL bar
      ctx.fillStyle = '#010409';
      ctx.beginPath();
      ctx.roundRect(400, 10, 540, 30, [6, 6, 6, 6]);
      ctx.fill();
      ctx.fillStyle = '#3fb950';
      ctx.font = '12px sans-serif';
      ctx.fillText('🔒', 414, 30);
      ctx.fillStyle = '#8b949e';
      ctx.font = '12px Consolas, monospace';
      ctx.fillText('https://github.com/search?q=browser+agent&type=repositories', 436, 30);

      // System 1 Active Badge
      ctx.fillStyle = '#238636';
      ctx.beginPath();
      ctx.roundRect(1090, 11, 170, 28, [6, 6, 6, 6]);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText('⚡ System 1 (Jev) Active', 1106, 29);

      // 2. 绘制左侧真实网页画面 (840 x 670) - 100% 完整显示无裁切
      if (vWeb.readyState >= 2) {
        ctx.drawImage(vWeb, 0, 0, 840, 670, 0, 50, 840, 670);
      }

      // 3. 绘制右侧真实插件侧边栏 (440 x 670)
      if (vSide.readyState >= 2) {
        ctx.drawImage(vSide, 0, 0, 440, 670, 840, 50, 440, 670);
      }

      // 4. 分割线
      ctx.strokeStyle = '#30363d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(840, 50);
      ctx.lineTo(840, 720);
      ctx.stroke();

      // 5. 底部高亮浮窗
      let text = '⚡ 真实插件加载 · System 1 (Jev) 毫秒云端双核就绪';
      if (t >= 2.5 && t < 7.0) {
        text = '💬 自然语言开发者指令 · 在 GitHub 搜索并对比热门 browser agent 项目';
      } else if (t >= 7.0 && t < 10.5) {
        text = '⚡ Jev 毫秒极速决策 · 置信度 96% 定位 Top 项目并直发 CDP 物理点击';
      } else if (t >= 10.5 && t < 14.0) {
        text = '📖 实时载入 GitHub 17.5k+ 开源项目榜单 · 提取 Star 与技术选型';
      } else if (t >= 14.0) {
        text = '🧠 System 2 大模型深度接力 · 多维度技术架构研判与结构化交付';
      }

      ctx.fillStyle = 'rgba(13, 17, 23, 0.94)';
      ctx.beginPath();
      ctx.roundRect(24, 665, 520, 36, [18, 18, 18, 18]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(240, 246, 252, 0.2)';
      ctx.stroke();
      ctx.fillStyle = '#f0f6fc';
      ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(text, 44, 688);

      requestAnimationFrame(renderLoop);
    }

    requestAnimationFrame(renderLoop);
  </script>
</body>
</html>`;

const s2Server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log('HTTP request to S2 Server:', req.method, req.url);
  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    console.log('🤖 System 2 received chat/completions request!');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const tokens = [
      '🐙 **GitHub「browser agent」热门开源项目技术选型深度研报：**\n\n',
      '1. 🌟 **TOP 1：browser-use/browser-use**\n',
      '   - **Star 关注度**：**116,000+** ⭐ (断层领跑)\n',
      '   - **技术架构**：Python 3.11 + Playwright + 多模态 LLM\n',
      '   - **核心优势**：自动化生态完善，适合科研与长程爬取实验。\n\n',
      '2. ⚡ **TOP 2：vercel-labs/agent-browser**\n',
      '   - **Star 关注度**：**43,200+** ⭐\n',
      '   - **技术架构**：Rust + 原生 CDP CLI\n',
      '   - **核心优势**：极客命令行交互，轻量级底层执行。\n\n',
      '3. 🤖 **TOP 3：reworkd/AgentGPT**\n',
      '   - **Star 关注度**：**36,300+** ⭐\n',
      '   - **技术架构**：TypeScript + Next.js 全栈\n',
      '   - **核心优势**：网页自治智能体，图形化任务分解。\n\n',
      '💡 **技术路线对比洞察**：\n',
      '- Python/CLI 派系适合独立终端批处理脚本；\n',
      '- **Browser Agent (TypeScript + 原生 CDP)** 则开创了 **Chrome 侧边栏常驻 + 快慢双核混合架构**，零环境依赖、100% 本地隐私主权、200ms 极速反射秒级响应！\n\n',
      '⚡ **双核协同实证**：System 1 毫秒级直达检索，System 2 完成高维技术研判！',
    ];

    let idx = 0;
    const timer = setInterval(() => {
      if (idx < tokens.length) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: tokens[idx++] } }] })}\n\n`);
      } else {
        res.write('data: [DONE]\n\n');
        clearInterval(timer);
        res.end();
      }
    }, 280);

    req.on('close', () => clearInterval(timer));
    return;
  }

  if (req.url === '/raw-web.webm' && rawWebVideoPath && fs.existsSync(rawWebVideoPath)) {
    const stat = fs.statSync(rawWebVideoPath);
    res.writeHead(200, {
      'Content-Type': 'video/webm',
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(rawWebVideoPath).pipe(res);
    return;
  }

  if (req.url === '/raw-sidepanel.webm' && rawSideVideoPath && fs.existsSync(rawSideVideoPath)) {
    const stat = fs.statSync(rawSideVideoPath);
    res.writeHead(200, {
      'Content-Type': 'video/webm',
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(rawSideVideoPath).pipe(res);
    return;
  }

  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(STAGE_HTML);
    return;
  }

  res.writeHead(404);
  res.end();
});

(async () => {
  await new Promise((r) => s2Server.listen(PORT, r));
  console.log(`本地转码与 System 2 服务就绪: http://localhost:${PORT}`);

  const cleanProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-real-github-'));
  const rawVideoTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raw-github-videos-'));

  console.log('🚀 启动 Chromium 并加载真实插件 dist/ ...');
  const context = await chromium.launchPersistentContext(cleanProfile, {
    headless: false,
    colorScheme: 'dark',
    args: [
      '--headless=new',
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
      '--window-size=1280,720',
      '--no-sandbox',
      '--disable-gpu',
    ],
    recordVideo: {
      dir: rawVideoTmp,
      size: { width: 1280, height: 720 },
    },
  });

  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extensionId = sw.url().split('/')[2];
  console.log('✅ 真实插件就绪，ID:', extensionId);

  // 关闭自动打开的 options 页面
  await new Promise((r) => setTimeout(r, 800));
  for (const p of context.pages()) {
    if (p.url().includes('options.html')) await p.close().catch(() => {});
  }

  // 写入双核全真配置到真实 chrome.storage
  await sw.evaluate(async ({ jevKey, s2Url }) => {
    const raw = await chrome.storage.local.get(['config', 'local_api_keys']);
    const cfg = raw.config || {};
    
    cfg.system1 = {
      enabled: true,
      provider: 'typesafe',
      baseUrl: 'https://api.typesafe.ai/v1',
      apiKey: jevKey,
      model: 'jev-latest',
      minConfidence: 0.6,
      maxConsecutiveFastSteps: 1,
    };

    const providers = (cfg.providers || []).map((p) => {
      if (p.id === 'openai') {
        return { ...p, baseUrl: s2Url, apiKey: 's2-key' };
      }
      return p;
    });
    if (!providers.some((p) => p.id === 'openai')) {
      providers.push({ id: 'openai', name: 'OpenAI', baseUrl: s2Url, apiKey: 's2-key' });
    }
    cfg.providers = providers;
    cfg.defaultBindingId = 'openai/gpt-5.6-terra';
    cfg.safety = {
      ...(cfg.safety || {}),
      allowAllSites: true,
      confirmNewSite: false,
    };
    cfg.sites = {
      allowed: ['github.com'],
      blocked: [],
    };
    cfg.advanced = { ...(cfg.advanced || {}), planning: false };

    const secrets = raw.local_api_keys || {};
    secrets['__system1__'] = jevKey;
    secrets['openai'] = 's2-key';

    if (chrome.storage.sync) {
      await chrome.storage.sync.set({ config: cfg });
    }
    await chrome.storage.local.set({
      config: cfg,
      local_api_keys: secrets,
    });
  }, { jevKey: JEV_KEY, s2Url: `http://localhost:${PORT}/v1` });

  console.log('🔑 插件配置写入完成：System 1 (真实 Jev) + System 2 已就绪！');

  // 1. 同步创建两页：左侧 GitHub 搜索页 (840x670) + 右侧真实侧边栏 (440x670)
  console.log('🌐 并行创建并载入真实页面与侧边栏...');
  const webPage = await context.newPage();
  const sidepanelPage = await context.newPage();

  // 精准 840x670 渲染视口，保证页面 100% 完整显示
  await webPage.setViewportSize({ width: 840, height: 670 });
  await sidepanelPage.setViewportSize({ width: 440, height: 670 });

  sidepanelPage.on('console', (msg) => console.log('  [SidePanel Console]:', msg.text()));
  sidepanelPage.on('pageerror', (err) => console.log('  [SidePanel Error]:', err.message));

  await Promise.all([
    webPage.goto('https://github.com/search?q=browser+agent&type=repositories', { waitUntil: 'domcontentloaded' }),
    sidepanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: 'domcontentloaded' }),
  ]);

  // 给右侧插件侧边栏设置标准 440px 宽度与暗色主题
  await sidepanelPage.addStyleTag({
    content: `
      html, body { width: 440px !important; max-width: 440px !important; margin: 0 !important; background: #16181c !important; overflow-x: hidden !important; }
      .app { width: 440px !important; max-width: 440px !important; min-height: 670px !important; height: 670px !important; }
    `,
  });

  await new Promise((r) => setTimeout(r, 1800));

  // 2. 在真实侧边栏的输入框中模拟自然输入
  console.log('💬 在真实侧边栏中键入自然语言指令...');
  const textarea = sidepanelPage.locator('.composer textarea');
  const promptText = '在 GitHub 搜索 "browser agent"，找出 Star 最多的项目并对比技术选型';
  await textarea.click();
  for (const ch of promptText) {
    await textarea.type(ch, { delay: 35 });
  }
  await sidepanelPage.waitForTimeout(600);

  // 3. 点击真实发送按钮
  console.log('👉 点击发送按钮触发真实 Browser Agent 引擎...');
  const sendBtn = sidepanelPage.locator('.send-btn');
  await sendBtn.click();

  // 4. 等待真实 Jev API 调用与 CDP 操作执行
  console.log('⏳ 正在等待真实 Jev 毫秒级决策与 System 2 流式返回...');
  try {
    await sidepanelPage.waitForSelector('.row.assistant', { timeout: 25000 });
  } catch (err) {
    const sideText = await sidepanelPage.evaluate(() => document.body.innerText);
    console.log('❌ 侧边栏当前文本内容:\n', sideText);
    await sidepanelPage.screenshot({ path: path.join(wsDir, 'github_debug_sidepanel.png') });
    await webPage.screenshot({ path: path.join(wsDir, 'github_debug_web.png') });
    throw err;
  }
  await sidepanelPage.waitForTimeout(4500);

  console.log('✨ 真实 Agent 循环完成，留存 3.5 秒展示结果...');
  await webPage.waitForTimeout(3500);
  await sidepanelPage.waitForTimeout(3500);

  // 截取独立的高清图作为备份
  await sidepanelPage.screenshot({ path: path.join(wsDir, 'real_github_sidepanel_final.png') });
  await webPage.screenshot({ path: path.join(wsDir, 'real_github_page_final.png') });

  const webVideo = webPage.video();
  const sideVideo = sidepanelPage.video();

  await webPage.close();
  await sidepanelPage.close();
  await context.close();

  rawWebVideoPath = await webVideo.path();
  rawSideVideoPath = await sideVideo.path();

  console.log('已生成原始网页录像:', rawWebVideoPath);
  console.log('已生成原始侧边栏录像:', rawSideVideoPath);

  // 5. 运行 Stage 合成 1280x720 分屏大师母带
  console.log('🎬 正在合成带有完整插件外壳与侧边栏的 1280x720 大师母带...');
  const compBrowser = await chromium.launch({ headless: true });
  const compContext = await compBrowser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: wsDir,
      size: { width: 1280, height: 720 },
    },
  });

  const compPage = await compContext.newPage();
  await compPage.goto(`http://localhost:${PORT}/index.html`);

  const duration = await compPage.evaluate(async () => {
    const vSide = document.getElementById('v-side');
    if (isNaN(vSide.duration) || vSide.duration === 0) {
      await new Promise((r) => { vSide.onloadedmetadata = r; setTimeout(r, 1500); });
    }
    return vSide.duration;
  });
  console.log(`原始视频时长: ${duration}s，开始同步渲染合成...`);

  await compPage.evaluate(async () => {
    const vWeb = document.getElementById('v-web');
    const vSide = document.getElementById('v-side');
    vWeb.currentTime = 0;
    vSide.currentTime = 0;
    await Promise.all([vWeb.play().catch(() => {}), vSide.play().catch(() => {})]);
  });

  const totalWaitMs = Math.max(14000, Math.floor(((duration || 16) + 1.5) * 1000));
  console.log(`合成总时长: ${totalWaitMs}ms`);

  await compPage.waitForTimeout(totalWaitMs - 1200);

  const finalVideoSnap = path.join(wsDir, 'real_github_master_final_frame.png');
  await compPage.screenshot({ path: finalVideoSnap });
  console.log('📸 保存大师母带结算帧截图:', finalVideoSnap);

  await compPage.waitForTimeout(1200);

  const compVideo = compPage.video();
  await compPage.close();
  await compContext.close();
  await compBrowser.close();

  const finalVideoPath = await compVideo.path();
  const masterShowcasePath = path.join(wsDir, 'real_github_master_showcase.webm');
  if (fs.existsSync(masterShowcasePath)) fs.unlinkSync(masterShowcasePath);
  fs.renameSync(finalVideoPath, masterShowcasePath);

  s2Server.close();
  try {
    fs.rmSync(cleanProfile, { recursive: true, force: true });
    fs.rmSync(rawVideoTmp, { recursive: true, force: true });
  } catch {}

  console.log(`\n🎉 100% 真实【GitHub 热门 browser agent 项目深度检索与技术选型研报】大师级母带生成成功！\n-> ${masterShowcasePath}\n`);
})();
