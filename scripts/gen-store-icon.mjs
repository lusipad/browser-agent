import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function main() {
  console.log('Generating Chrome Web Store 128x128 Icons...');
  const browser = await chromium.launch({ headless: true });
  const htmlPath = 'file:///' + path.resolve(__dirname, 'assets/icon-prism-template.html').replace(/\\/g, '/');

  const downloadsDir = 'C:/Users/lus/Downloads';
  const storeDocsDir = path.resolve(projectRoot, 'docs/store');
  const publicIconsDir = path.resolve(projectRoot, 'public/icons');
  const distIconsDir = path.resolve(projectRoot, 'dist/icons');

  fs.mkdirSync(storeDocsDir, { recursive: true });
  fs.mkdirSync(publicIconsDir, { recursive: true });
  fs.mkdirSync(distIconsDir, { recursive: true });

  // 1. Standard Store Icon (Full-Bleed Squircle, 128x128)
  {
    const page = await browser.newPage({ viewport: { width: 128, height: 128 }, deviceScaleFactor: 1 });
    await page.goto(htmlPath, { waitUntil: 'load' });
    await page.evaluate(() => {
      document.body.style.width = '128px';
      document.body.style.height = '128px';
      const c = document.querySelector('.icon-container');
      c.style.width = '128px';
      c.style.height = '128px';
    });
    await page.waitForTimeout(50);
    const buf = await page.screenshot({ omitBackground: true });
    
    // Save to docs/store, public/icons, dist/icons, and user Downloads
    const standardOut = path.resolve(storeDocsDir, 'icon-128x128-standard.png');
    const storeIconUpload = path.resolve(storeDocsDir, 'store-icon-128.png');
    const pubOut = path.resolve(publicIconsDir, 'icon128.png');
    const distOut = path.resolve(distIconsDir, 'icon128.png');
    const dlOut = path.resolve(downloadsDir, 'browser-agent-store-icon-128x128.png');

    fs.writeFileSync(standardOut, buf);
    fs.writeFileSync(storeIconUpload, buf);
    fs.writeFileSync(pubOut, buf);
    fs.writeFileSync(distOut, buf);
    fs.writeFileSync(dlOut, buf);

    console.log(`✓ Generated Standard 128x128 Store Icon:`);
    console.log(`  - ${path.relative(projectRoot, storeIconUpload)}`);
    console.log(`  - ${dlOut}`);
    await page.close();
  }

  // 2. Safe-Padding Store Icon (Google CWS Recommended 16px Padding: 96x96 content inside 128x128 canvas)
  {
    const page = await browser.newPage({ viewport: { width: 128, height: 128 }, deviceScaleFactor: 1 });
    await page.goto(htmlPath, { waitUntil: 'load' });
    await page.evaluate(() => {
      document.body.style.width = '128px';
      document.body.style.height = '128px';
      document.body.style.display = 'flex';
      document.body.style.alignItems = 'center';
      document.body.style.justifyContent = 'center';
      const c = document.querySelector('.icon-container');
      c.style.width = '96px';
      c.style.height = '96px';
    });
    await page.waitForTimeout(50);
    const buf = await page.screenshot({ omitBackground: true });

    const paddedOut = path.resolve(storeDocsDir, 'icon-128x128-padded.png');
    const dlPaddedOut = path.resolve(downloadsDir, 'browser-agent-store-icon-128x128-padded.png');

    fs.writeFileSync(paddedOut, buf);
    fs.writeFileSync(dlPaddedOut, buf);

    console.log(`✓ Generated Google-Recommended Padded 128x128 Store Icon (16px margin, 96x96 safe zone):`);
    console.log(`  - ${path.relative(projectRoot, paddedOut)}`);
    console.log(`  - ${dlPaddedOut}`);
    await page.close();
  }

  // 3. Also re-render all manifest icons (48, 32, 16) with exact matching dimensions
  const sizes = [
    { size: 48, name: 'icon48.png' },
    { size: 32, name: 'icon32.png' },
    { size: 16, name: 'icon16.png' }
  ];

  for (const { size, name } of sizes) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.goto(htmlPath, { waitUntil: 'load' });
    await page.evaluate((s) => {
      document.body.style.width = `${s}px`;
      document.body.style.height = `${s}px`;
      const c = document.querySelector('.icon-container');
      c.style.width = `${s}px`;
      c.style.height = `${s}px`;
    }, size);
    await page.waitForTimeout(50);
    const buf = await page.screenshot({ omitBackground: true });
    fs.writeFileSync(path.resolve(publicIconsDir, name), buf);
    fs.writeFileSync(path.resolve(distIconsDir, name), buf);
    console.log(`✓ Rendered exact ${size}x${size} -> public/icons/${name} & dist/icons/${name}`);
    await page.close();
  }

  await browser.close();
  console.log('\nDone! Both 128x128 icon variants and all extension icons are ready.');
}

main().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
