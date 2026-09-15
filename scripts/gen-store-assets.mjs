import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function renderAssets() {
  console.log('Rendering high-impact store assets with Playwright...');
  const browser = await chromium.launch({ headless: true });

  // 1. Render Store Hero (1280x800)
  const heroPage = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2 // Crisp retina rendering
  });
  const heroUrl = 'file:///' + path.resolve(__dirname, 'assets/store-hero.html').replace(/\\/g, '/');
  console.log('Rendering Hero from:', heroUrl);
  await heroPage.goto(heroUrl, { waitUntil: 'load' });
  await heroPage.waitForTimeout(500);

  const heroOut = path.resolve(projectRoot, 'docs/screenshots/store-hero.png');
  await heroPage.screenshot({ path: heroOut });
  console.log('Successfully generated store-hero.png at:', heroOut);
  await heroPage.close();

  // 2. Render Promo Tile (440x280)
  const promoPage = await browser.newPage({
    viewport: { width: 440, height: 280 },
    deviceScaleFactor: 2 // Crisp retina rendering
  });
  const promoUrl = 'file:///' + path.resolve(__dirname, 'assets/promo-tile.html').replace(/\\/g, '/');
  console.log('Rendering Promo Tile from:', promoUrl);
  await promoPage.goto(promoUrl, { waitUntil: 'load' });
  await promoPage.waitForTimeout(500);

  const promoOut = path.resolve(projectRoot, 'docs/screenshots/promo-tile-440x280.png');
  await promoPage.screenshot({ path: promoOut });
  console.log('Successfully generated promo-tile-440x280.png at:', promoOut);
  await promoPage.close();

  // 3. Render Form Filling Scenario (1280x800)
  const formPage = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2
  });
  const formUrl = 'file:///' + path.resolve(__dirname, 'assets/form-filling.html').replace(/\\/g, '/');
  console.log('Rendering Form Filling from:', formUrl);
  await formPage.goto(formUrl, { waitUntil: 'load' });
  await formPage.waitForTimeout(500);

  const formOut = path.resolve(projectRoot, 'docs/screenshots/form-filling.png');
  await formPage.screenshot({ path: formOut });
  console.log('Successfully generated form-filling.png at:', formOut);
  await formPage.close();

  await browser.close();
  console.log('All store assets successfully rendered!');
}

renderAssets().catch(err => {
  console.error('Failed to render assets:', err);
  process.exit(1);
});
