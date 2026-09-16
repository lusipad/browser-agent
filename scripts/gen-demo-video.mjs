import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const videoDir = path.resolve(projectRoot, 'docs/videos');

if (!fs.existsSync(videoDir)) {
  fs.mkdirSync(videoDir, { recursive: true });
}

async function record() {
  console.log('--- Starting Automated Video Recording with Playwright ---');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();
  const stageUrl = 'file:///' + path.resolve(__dirname, 'assets/demo-video-stage.html').replace(/\\/g, '/');

  console.log('Loading animated demo stage from:', stageUrl);
  await page.goto(stageUrl);

  console.log('Recording in progress (waiting for DEMO_DONE)...');
  await page.waitForFunction(() => window.DEMO_DONE === true, { timeout: 60000 });
  console.log('Animation completed! Saving video...');

  // Closing page & context finishes video writing
  await page.close();
  await context.close();
  await browser.close();

  // Find the generated webm file in videoDir and rename it to browser-agent-v0.6.0-demo.webm
  const files = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm'));
  const targetName = 'browser-agent-v0.6.0-demo.webm';
  const targetPath = path.join(videoDir, targetName);

  if (files.length > 0) {
    // Pick the newest file
    files.sort((a, b) => {
      return fs.statSync(path.join(videoDir, b)).mtimeMs - fs.statSync(path.join(videoDir, a)).mtimeMs;
    });
    const newest = path.join(videoDir, files[0]);
    if (newest !== targetPath) {
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      fs.renameSync(newest, targetPath);
    }
    const stat = fs.statSync(targetPath);
    console.log(`Successfully recorded video: ${targetPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    console.warn('No webm video file found in videoDir');
  }

  console.log('--- Automated Video Recording Finished! ---');
}

record().catch((err) => {
  console.error('Video recording failed:', err);
  process.exit(1);
});
