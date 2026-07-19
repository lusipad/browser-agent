/**
 * Take English-locale screenshots of the extension UI via Playwright.
 * Usage: node scripts/screenshot-en.mjs
 */
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const out = join(root, 'docs', 'screenshots');

async function main() {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
      '--lang=en-US',
      '--no-first-run',
      '--disable-infobars',
    ],
    locale: 'en-US',
    viewport: { width: 1280, height: 800 },
  });

  // Wait for service worker to register
  let sw;
  for (let i = 0; i < 30; i++) {
    sw = ctx.serviceWorkers().find(w => w.url().includes('background'));
    if (sw) break;
    await new Promise(r => setTimeout(r, 500));
  }
  if (!sw) {
    console.error('Service worker not found');
    await ctx.close();
    process.exit(1);
  }

  // Set uiLang to 'en' via the service worker
  await sw.evaluate(() => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('config', (res) => {
        const cfg = res.config || {};
        cfg.uiLang = 'en';
        chrome.storage.local.set({ config: cfg }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });
    });
  });

  // Get extension ID
  const extId = sw.url().match(/chrome-extension:\/\/([^/]+)/)?.[1];
  if (!extId) {
    console.error('Cannot determine extension ID');
    await ctx.close();
    process.exit(1);
  }
  console.log('Extension ID:', extId);

  // --- Options page screenshot (English) ---
  const optionsUrl = `chrome-extension://${extId}/options.html`;
  const optionsPage = await ctx.newPage();
  await optionsPage.goto(optionsUrl, { waitUntil: 'networkidle' });
  await optionsPage.waitForTimeout(1000);
  await optionsPage.setViewportSize({ width: 1280, height: 800 });
  await optionsPage.screenshot({ path: join(out, 'options-en.png') });
  console.log('Saved options-en.png');

  // --- Sidepanel screenshot (English, empty state) ---
  const sidepanelUrl = `chrome-extension://${extId}/sidepanel.html`;
  const sidepanelPage = await ctx.newPage();
  await sidepanelPage.setViewportSize({ width: 400, height: 800 });
  await sidepanelPage.goto(sidepanelUrl, { waitUntil: 'networkidle' });
  await sidepanelPage.waitForTimeout(1000);
  await sidepanelPage.screenshot({ path: join(out, 'sidepanel-en.png') });
  console.log('Saved sidepanel-en.png (updated)');

  await ctx.close();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
