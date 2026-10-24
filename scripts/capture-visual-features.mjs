import * as esbuild from 'esbuild';
import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/lus/.gemini/antigravity/brain/dc275f1f-5009-4b9f-95c7-d65f6a821fcc';

const FIXTURE = `<!doctype html><html><head><meta charset="utf-8">
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
  .container { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 28px; margin-bottom: 8px; color: #38bdf8; }
  p.sub { color: #94a3b8; margin-bottom: 30px; font-size: 15px; }
  .demo-text { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; line-height: 1.7; font-size: 15px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; }
  .card { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; display: flex; flex-direction: column; }
  .card-img { height: 140px; background: linear-gradient(135deg, #1e3a8a, #0284c7); display: flex; align-items: center; justify-content: center; font-size: 36px; }
  .card-body { padding: 16px; flex: 1; display: flex; flex-direction: column; }
  .card h3 { margin: 0 0 8px 0; font-size: 17px; color: #f1f5f9; }
  .price { font-size: 20px; font-weight: 700; color: #38bdf8; margin-bottom: 8px; }
  .desc { font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 16px; flex: 1; }
  .btn { display: inline-block; text-align: center; background: #0284c7; color: #fff; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; }
</style>
</head><body>
  <div class="container">
    <h1>Antigravity Browser Agent 体验验证</h1>
    <p class="sub">新一代自主 AI 浏览器智能体 · 视觉活体交互与划选操作体验</p>

    <div class="demo-text">
      <p id="selectable-p">Antigravity Browser Agent 现已全面升级原生划选胶囊、活体毛玻璃 HUD、高精度点击激光波纹以及无选择器智能流抽取。用户可在任意网页即选即问、秒级翻译与结构化提取。</p>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-img">⌨️</div>
        <div class="card-body">
          <h3>客制化机械键盘 RGB</h3>
          <div class="price">¥599.00</div>
          <div class="desc">Gasket 结构设计，全键热插拔，三模无线连接，超长续航。</div>
          <a href="#buy" class="btn">立即选购</a>
        </div>
      </div>
      <div class="card">
        <div class="card-img">🖱️</div>
        <div class="card-body">
          <h3>轻量化电竞无线鼠标</h3>
          <div class="price">¥299.00</div>
          <div class="desc">54g 极致轻量化，原相 PAW3395 旗舰光学传感器，4K 回报率。</div>
          <a href="#buy" class="btn">立即选购</a>
        </div>
      </div>
      <div class="card">
        <div class="card-img">🎧</div>
        <div class="card-body">
          <h3>主动降噪无线耳机</h3>
          <div class="price">¥899.00</div>
          <div class="desc">48dB 深度自适应主动降噪，Hi-Res 空间音频认证，65 小时续航。</div>
          <a href="#buy" class="btn">立即选购</a>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

async function main() {
  console.log('Compiling page bundle with esbuild...');
  const built = await esbuild.build({
    entryPoints: ['test/e2e/pageAgent.entry.ts'],
    bundle: true,
    format: 'iife',
    write: false,
    logLevel: 'error',
  });
  const bundle = built.outputFiles[0].text;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });

  await page.setContent(FIXTURE, { waitUntil: 'load' });
  await page.evaluate(() => {
    window.chrome = {
      runtime: {
        sendMessage: () => Promise.resolve({ ok: true }),
      },
    };
  });
  await page.addScriptTag({ content: bundle });

  // 1. 触发毛玻璃 HUD 与 激光点击波纹
  console.log('Triggering HUD and Pointer Ripple...');
  await page.evaluate(() => {
    window.__pageAgent('hud_update', { text: '🔍 正在比对全网数码产品价格与评测 (3/8)...', status: 'running' });
    window.__pageAgent('pointer_ripple', { x: 380, y: 310, color: '#38bdf8' });
  });
  await page.waitForTimeout(100);

  const hudPath = path.join(ARTIFACT_DIR, 'hud_ripple_preview.png').replace(/\\/g, '/');
  await page.screenshot({ path: hudPath });
  console.log(`Saved HUD & Ripple preview: ${hudPath}`);

  // 3. 执行 auto_cards 提取并输出结果
  console.log('Testing auto_cards extraction...');
  const extractRes = await page.evaluate(() => {
    return window.__pageAgent('extract', { mode: 'auto_cards' });
  });
  console.log('Extracted cards count:', extractRes.count);

  await browser.close();
  console.log('All visual captures completed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
