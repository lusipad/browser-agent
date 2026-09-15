import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function renderIcons() {
  console.log('Rendering modern vector icons with Playwright...');
  const browser = await chromium.launch({ headless: true });
  const htmlPath = 'file:///' + path.resolve(__dirname, 'assets/icon-prism-template.html').replace(/\\/g, '/');

  const sizes = [
    { size: 512, out: path.resolve(projectRoot, 'docs/screenshots/icon-512.png') },
    { size: 128, out: path.resolve(projectRoot, 'public/icons/icon128.png') },
    { size: 48, out: path.resolve(projectRoot, 'public/icons/icon48.png') },
    { size: 32, out: path.resolve(projectRoot, 'public/icons/icon32.png') },
    { size: 16, out: path.resolve(projectRoot, 'public/icons/icon16.png') },
  ];

  fs.mkdirSync(path.resolve(projectRoot, 'public/icons'), { recursive: true });
  fs.mkdirSync(path.resolve(projectRoot, 'dist/icons'), { recursive: true });
  fs.mkdirSync(path.resolve(projectRoot, 'docs/screenshots'), { recursive: true });

  for (const { size, out } of sizes) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: size <= 48 ? 2 : 1 // Crisp rendering
    });
    await page.goto(htmlPath, { waitUntil: 'load' });
    await page.waitForTimeout(100);

    // Take screenshot of the container
    const container = page.locator('.icon-container');
    await container.screenshot({ path: out, omitBackground: true });
    console.log(`✓ Rendered ${size}x${size} -> ${path.relative(projectRoot, out)}`);

    // Also copy to dist if it's in public/icons
    if (out.includes('public\\icons') || out.includes('public/icons')) {
      const distOut = out.replace('public', 'dist');
      fs.copyFileSync(out, distOut);
      console.log(`  -> Copied to ${path.relative(projectRoot, distOut)}`);
    }
    await page.close();
  }

  await browser.close();
  console.log('All icons generated successfully!');
}

renderIcons().catch(err => {
  console.error('Error rendering icons:', err);
  process.exit(1);
});
