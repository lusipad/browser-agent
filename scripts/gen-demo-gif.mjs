import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import gifencPkg from 'gifenc';
import { fileURLToPath } from 'url';

const { GIFEncoder, quantize, applyPalette } = gifencPkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function main() {
  console.log('Generating dynamic demonstration GIF for README...');
  const browser = await chromium.launch({ headless: true });

  // Width 800, Height 500 for compact, crisp README display
  const width = 800;
  const height = 500;

  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif; }
    body { width: ${width}px; height: ${height}px; background: #0f172a; overflow: hidden; display: flex; flex-direction: column; }

    /* Chrome Titlebar */
    .titlebar { height: 32px; background: #1e293b; display: flex; align-items: center; padding: 0 10px; gap: 8px; border-bottom: 1px solid #334155; }
    .dots { display: flex; gap: 5px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; }
    .red { background: #ef4444; } .yellow { background: #f59e0b; } .green { background: #10b981; }
    .tab { background: #0f172a; height: 26px; padding: 0 12px; border-radius: 6px 6px 0 0; display: flex; align-items: center; gap: 6px; font-size: 11px; color: #f8fafc; font-weight: 600; }
    .agent-pill { background: #2563eb; color: #fff; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px; }

    /* Address Bar */
    .addressbar { height: 30px; background: #1e293b; display: flex; align-items: center; padding: 0 10px; gap: 8px; border-bottom: 1px solid #334155; font-size: 11px; color: #94a3b8; }
    .url { flex: 1; background: #0f172a; height: 22px; border-radius: 11px; display: flex; align-items: center; padding: 0 10px; color: #38bdf8; font-family: monospace; font-size: 10px; }

    /* Main split */
    .main { flex: 1; display: flex; background: #f8fafc; overflow: hidden; }

    /* Left: Webpage */
    .webpage { flex: 1; background: #fff; padding: 14px 18px; position: relative; border-right: 1px solid #e2e8f0; font-size: 11px; }
    .site-nav { border-bottom: 2px solid #ff6600; padding-bottom: 6px; margin-bottom: 10px; font-weight: 800; color: #ff6600; display: flex; justify-content: space-between; }
    .item { padding: 8px 0; border-bottom: 1px solid #f1f5f9; display: flex; align-items: flex-start; gap: 6px; position: relative; }
    .item-title { font-weight: 600; color: #0f172a; line-height: 1.3; }
    .item-meta { font-size: 10px; color: #64748b; margin-top: 3px; }

    /* SOM Tag */
    .som-tag { position: absolute; background: #ef4444; color: #fff; font-size: 9px; font-weight: 800; padding: 1px 4px; border-radius: 3px; z-index: 10; display: none; }
    .som-box { border: 1.5px dashed #ef4444; background: rgba(239, 68, 68, 0.06); position: absolute; border-radius: 4px; display: none; }

    /* Right: Sidepanel */
    .sidepanel { width: 300px; background: #f8fafc; display: flex; flex-direction: column; border-left: 1px solid #cbd5e1; }
    .sp-header { height: 38px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; font-size: 11px; font-weight: 700; color: #0f172a; }
    .sp-body { flex: 1; padding: 10px; display: flex; flex-direction: column; gap: 8px; font-size: 11px; }
    .bubble { background: #2563eb; color: #fff; padding: 6px 10px; border-radius: 8px 8px 2px 8px; align-self: flex-end; max-width: 90%; font-size: 11px; }
    .step { background: #fff; border: 1px solid #e2e8f0; padding: 5px 8px; border-radius: 5px; font-size: 10px; color: #334155; display: flex; align-items: center; gap: 4px; }
    .step.ok { background: #f0fdf4; border-color: #bbf7d0; color: #166534; font-weight: 600; }
    .table-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
    th { background: #f1f5f9; text-align: left; padding: 3px 4px; color: #475569; }
    td { padding: 3px 4px; border-bottom: 1px solid #f8fafc; color: #0f172a; }
    .export-btn { background: #2563eb; color: #fff; border: none; border-radius: 4px; padding: 4px; font-size: 10px; font-weight: 700; width: 100%; margin-top: 6px; text-align: center; }

    /* Overlay states */
    .show-som .som-tag, .show-som .som-box { display: block !important; }
  </style>
</head>
<body id="b">
  <div class="titlebar">
    <div class="dots"><div class="dot red"></div><div class="dot yellow"></div><div class="dot green"></div></div>
    <div class="tab"><span class="agent-pill">🤖 Agent</span> Hacker News 实时热搜</div>
  </div>
  <div class="addressbar">
    <span>🔒</span>
    <div class="url">https://news.ycombinator.com</div>
    <span style="color:#38bdf8; font-weight:700;">🧩 🤖</span>
  </div>
  <div class="main">
    <div class="webpage" id="webpage">
      <div class="site-nav"><span>Hacker News Top Stories</span><span>news | past | ask | show</span></div>
      <div class="item">
        <div class="som-tag" style="top: 4px; left: 0;">1</div>
        <div class="som-box" style="top: 3px; left: 16px; width: 320px; height: 18px;"></div>
        <div style="width:16px; color:#94a3b8; font-weight:700;">1.</div>
        <div>
          <div class="item-title">DeepSeek-V3 架构深度解析与多模态实测</div>
          <div class="item-meta">682 points by geek · 214 comments</div>
        </div>
      </div>
      <div class="item">
        <div class="som-tag" style="top: 4px; left: 0;">2</div>
        <div class="som-box" style="top: 3px; left: 16px; width: 280px; height: 18px;"></div>
        <div style="width:16px; color:#94a3b8; font-weight:700;">2.</div>
        <div>
          <div class="item-title">SQLite in Production: Local-first Architecture</div>
          <div class="item-meta">418 points by db_pro · 165 comments</div>
        </div>
      </div>
      <div class="item">
        <div class="som-tag" style="top: 4px; left: 0;">3</div>
        <div class="som-box" style="top: 3px; left: 16px; width: 300px; height: 18px;"></div>
        <div style="width:16px; color:#94a3b8; font-weight:700;">3.</div>
        <div>
          <div class="item-title">Building Browser Agents with Chrome MV3 & CDP</div>
          <div class="item-meta">329 points by webhacker · 88 comments</div>
        </div>
      </div>
    </div>
    <div class="sidepanel">
      <div class="sp-header">
        <div style="display:flex; align-items:center; gap:5px;">
          <div style="width:6px; height:6px; background:#10b981; border-radius:50%;"></div>
          <span>DeepSeek (deepseek-chat)</span>
        </div>
        <span style="color:#64748b; font-family:monospace; font-size:10px;">$0.002</span>
      </div>
      <div class="sp-body" id="chat">
        <!-- Dynamic steps injected via script -->
      </div>
    </div>
  </div>
</body>
</html>
`;

  await page.setContent(htmlContent, { waitUntil: 'load' });

  // Define the frames sequence
  const frames = [
    {
      action: async () => {
        await page.evaluate(() => {
          document.getElementById('chat').innerHTML = `
            <div class="bubble">提取前 3 条热门文章的标题和分数，导出表格</div>
          `;
          document.getElementById('b').className = '';
        });
      },
      delay: 1500
    },
    {
      action: async () => {
        await page.evaluate(() => {
          document.getElementById('chat').innerHTML += `
            <div class="step"><span>🧭</span> 已连接标签页 news.ycombinator.com</div>
          `;
        });
      },
      delay: 1000
    },
    {
      action: async () => {
        await page.evaluate(() => {
          document.getElementById('b').className = 'show-som';
          document.getElementById('chat').innerHTML += `
            <div class="step"><span>👁️</span> 视觉识别：检测到 14 个可交互元素 (Set-of-Marks)</div>
          `;
        });
      },
      delay: 1800
    },
    {
      action: async () => {
        await page.evaluate(() => {
          document.getElementById('chat').innerHTML += `
            <div class="step ok"><span>✔</span> 结构化数据提取完成</div>
            <div class="table-box">
              <div style="font-weight:700; color:#334155; font-size:10px;">📊 提取结果 (3 条)</div>
              <table>
                <thead><tr><th>#</th><th>标题</th><th>分数</th></tr></thead>
                <tbody>
                  <tr><td>1</td><td>DeepSeek-V3 架构深度解析</td><td>682</td></tr>
                  <tr><td>2</td><td>SQLite in Production</td><td>418</td></tr>
                  <tr><td>3</td><td>Building Browser Agents</td><td>329</td></tr>
                </tbody>
              </table>
              <div class="export-btn">📥 导出 Markdown / CSV</div>
            </div>
          `;
        });
      },
      delay: 3000
    }
  ];

  console.log('Capturing frames and encoding GIF...');
  const gif = GIFEncoder();

  // Create an offscreen canvas in page to extract RGBA pixel buffer
  await page.evaluate(() => {
    window.canvas = document.createElement('canvas');
    window.canvas.width = 800;
    window.canvas.height = 500;
    window.ctx = window.canvas.getContext('2d', { willReadFrequently: true });
  });

  for (let i = 0; i < frames.length; i++) {
    console.log(`Rendering frame ${i + 1}/${frames.length}...`);
    await frames[i].action();
    await page.waitForTimeout(300);

    // Take screenshot buffer as PNG
    const pngBuffer = await page.screenshot({ type: 'png' });
    const base64Png = pngBuffer.toString('base64');

    // Convert PNG to raw RGBA pixels via browser canvas
    const rawPixels = await page.evaluate((dataUri) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          window.ctx.clearRect(0, 0, 800, 500);
          window.ctx.drawImage(img, 0, 0);
          const imgData = window.ctx.getImageData(0, 0, 800, 500);
          resolve(Array.from(imgData.data));
        };
        img.src = 'data:image/png;base64,' + dataUri;
      });
    }, base64Png);

    const rgba = new Uint8Array(rawPixels);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);

    gif.writeFrame(index, width, height, {
      palette,
      delay: frames[i].delay
    });
  }

  gif.finish();
  const gifBuffer = Buffer.from(gif.bytes());
  const outPath = path.resolve(projectRoot, 'docs/screenshots/demo.gif');
  fs.writeFileSync(outPath, gifBuffer);
  console.log(`\nSuccessfully created demo.gif at: ${outPath} (${(gifBuffer.length / 1024).toFixed(1)} KB)`);

  await browser.close();
}

main().catch(err => {
  console.error('Error generating GIF:', err);
  process.exit(1);
});
