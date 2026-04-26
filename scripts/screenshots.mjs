// Captures README screenshots for every public route in both themes.
// Requires the dev server to be running on http://localhost:3000.
//
// Run from the repo root:
//   npm run screenshots
//
// Output: public/screenshots/<route>-<theme>.png (1440px, full-page).

import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = process.env.SCREENSHOT_ORIGIN ?? 'http://localhost:3000';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(__dirname, '../public/screenshots');

const ROUTES = [
  { name: 'home',    path: '/' },
  { name: 'resume',  path: '/resume/' },
  { name: 'blog',    path: '/blog/' },
  { name: 'article', path: '/article/welcome-to-my-blog/' },
  { name: 'contact', path: '/contact/' },
];

try {
  const probe = await fetch(ORIGIN, { method: 'HEAD' });
  if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
} catch (err) {
  console.error(`dev server not reachable at ${ORIGIN} — start it with \`npm run dev\` in another terminal.`);
  console.error(`(${err.message})`);
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});

const autoScroll = (page) => page.evaluate(async () => {
  await new Promise((resolve) => {
    let total = 0;
    const step = 400;
    const timer = setInterval(() => {
      const max = document.documentElement.scrollHeight;
      window.scrollBy(0, step);
      total += step;
      if (total >= max - window.innerHeight) {
        clearInterval(timer);
        window.scrollTo(0, 0);
        resolve();
      }
    }, 60);
  });
});

for (const theme of ['dark', 'light']) {
  for (const r of ROUTES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);

    // The site bootstraps theme from localStorage in an inline <head> script
    // that runs before any of our hooks. To control it we (1) hit the origin
    // so localStorage has a real key, (2) write the desired theme, (3) reload
    // so the inline script reads the seeded value on the next paint.
    await page.goto(`${ORIGIN}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate((t) => { localStorage.setItem('theme', t); }, theme);
    await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });

    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.addStyleTag({ content: `
      .reveal { opacity: 1 !important; transform: none !important; }
      .reveal.in { opacity: 1 !important; transform: none !important; }
      *, *::before, *::after { animation-duration: 0.001s !important; transition-duration: 0.001s !important; }
      *:focus, *:focus-visible { outline: none !important; box-shadow: none !important; }
    `});
    await page.evaluate(() => { document.activeElement?.blur?.(); });
    await autoScroll(page);
    await new Promise((res) => setTimeout(res, 600));

    const actual = await page.evaluate(() => document.documentElement.dataset.theme);
    const out = path.join(SHOTS, `${r.name}-${theme}.png`);
    await page.screenshot({ path: out, fullPage: true, type: 'png' });
    console.log(`saved ${path.relative(process.cwd(), out)}  (data-theme=${actual})`);
    await page.close();
  }
}

await browser.close();
