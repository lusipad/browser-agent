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

  // 4. Render Region Selection Showcase (1280x800)
  const regionPage = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2
  });
  const regionUrl = 'file:///' + path.resolve(__dirname, 'assets/region-showcase.html').replace(/\\/g, '/');
  console.log('Rendering Region Selection from:', regionUrl);
  await regionPage.goto(regionUrl, { waitUntil: 'load' });
  await regionPage.waitForTimeout(500);

  const regionOut = path.resolve(projectRoot, 'docs/screenshots/region-selection.png');
  await regionPage.screenshot({ path: regionOut });
  console.log('Successfully generated region-selection.png at:', regionOut);
  await regionPage.close();

  // 5. Render Teach-Me Showcase (1280x800)
  const teachPage = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2
  });
  const teachUrl = 'file:///' + path.resolve(__dirname, 'assets/teach-me-showcase.html').replace(/\\/g, '/');
  console.log('Rendering Teach-Me from:', teachUrl);
  await teachPage.goto(teachUrl, { waitUntil: 'load' });
  await teachPage.waitForTimeout(500);

  const teachOut = path.resolve(projectRoot, 'docs/screenshots/teach-me.png');
  await teachPage.screenshot({ path: teachOut });
  console.log('Successfully generated teach-me.png at:', teachOut);
  await teachPage.close();

  // 6. Render Cron & Captcha Intervention Showcase (1280x800)
  const cronPage = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2
  });
  const cronUrl = 'file:///' + path.resolve(__dirname, 'assets/cron-showcase.html').replace(/\\/g, '/');
  console.log('Rendering Cron & Intervention from:', cronUrl);
  await cronPage.goto(cronUrl, { waitUntil: 'load' });
  await cronPage.waitForTimeout(500);

  const cronOut = path.resolve(projectRoot, 'docs/screenshots/cron-intervention.png');
  await cronPage.screenshot({ path: cronOut });
  console.log('Successfully generated cron-intervention.png at:', cronOut);
  await cronPage.close();

  await browser.close();
  console.log('All store assets successfully rendered!');
}

renderAssets().catch(err => {
  console.error('Failed to render assets:', err);
  process.exit(1);
});
