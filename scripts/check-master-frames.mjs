import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const videoDir = path.resolve(__dirname, '../docs/videos');
const artifactDir = 'C:/Users/lus/.gemini/antigravity/brain/f8a6c147-f2e5-4ca5-b4b3-89c0ac214584';

async function check() {
  const masterFile = path.join(videoDir, 'browser-agent-v0.6.0-real-demo.webm');

  const server = http.createServer((req, res) => {
    if (req.url === '/video.webm') {
      const stat = fs.statSync(masterFile);
      res.writeHead(200, {
        'Content-Type': 'video/webm',
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(masterFile).pipe(res);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((r) => server.listen(8799, r));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.setContent('<video id="v" src="http://localhost:8799/video.webm" muted></video>');
  await page.waitForTimeout(600);

  const times = [2.5, 6.0, 11.5, 15.5];
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    await page.evaluate(async (time) => {
      const v = document.getElementById('v');
      v.currentTime = time;
      await new Promise((r) => (v.onseeked = r));
    }, t);
    await page.waitForTimeout(200);
    const shotPath = path.join(artifactDir, `real-demo-frame-${i + 1}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`Captured frame at ${t}s -> ${shotPath}`);
  }

  await browser.close();
  server.close();
}

check().catch(console.error);
