/**
 * README screenshots, reproducible from the production build:
 *   npm run build && npm run screenshots   →  docs/images/*.png
 *
 * Uses Playwright's Chromium (PW_CHANNEL=msedge to use an installed browser).
 * The AI tutor's reply is mocked so no API key is needed.
 */
import { join } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { preview } from 'vite';

const out = join(process.cwd(), 'docs', 'images');
const PORT = 4175;
const base = `http://localhost:${PORT}`;

const TUTOR_REPLY =
  'Your pendulum took about **1.9 s** per swing. A longer string means a longer path, so each swing takes more time — ' +
  'that is why T² grows in a straight line with L.\n\nTry this: halve the length and predict the new period before you measure.';

async function open(browser: Browser, phone: boolean, dark = false): Promise<Page> {
  const page = await browser.newPage({
    viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: dark ? 'dark' : 'light',
    isMobile: phone,
    hasTouch: phone,
  });
  await page.addInitScript(() => {
    for (const id of ['catalog', 'experiment', 'create']) localStorage.setItem(`pocketlab.tour.${id}.done`, 'true');
  });
  await page.route('**/api/chat', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: TUTOR_REPLY }) }));
  return page;
}

const step = (page: Page, name: string) => page.locator('.step-bar').getByRole('tab', { name: new RegExp(name) }).click();
const shot = (page: Page, file: string, fullPage = false) => page.screenshot({ path: join(out, file), fullPage, animations: 'disabled' });

async function main() {
  const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  try {
    // Home: live sensor trace and the experiment library.
    let page = await open(browser, false);
    await page.goto(base);
    await page.locator('.hero-trace canvas').waitFor();
    await page.waitForTimeout(6000); // let the trace fill the plot
    await shot(page, 'home.png');

    // A finished investigation: four trials, T² vs L, verdict.
    await page.goto(`${base}/#/experiment/pendulum/demo`);
    await page.locator('#step-results .headline').first().waitFor();
    await page.locator('.result-block').first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -110)); // clear of the sticky step bar
    await shot(page, 'result-verdict.png');

    // Virtual lab on the Moon.
    await page.goto(`${base}/#/experiment/pendulum`);
    await step(page, 'Measure');
    await page.getByRole('tab', { name: /Virtual lab/ }).click();
    await page.getByRole('button', { name: 'Moon' }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    await shot(page, 'virtual-lab.png');

    await page.close();

    // Phone: home, explanation in simple words, AI tutor.
    page = await open(browser, true);
    await page.goto(base);
    await page.locator('.hero-trace canvas').waitFor();
    await page.waitForTimeout(6000);
    await shot(page, 'phone-home.png');

    await page.goto(`${base}/#/experiment/pendulum/demo`);
    const result = page.locator('.result-block').first();
    await result.waitFor();
    await result.getByRole('tab', { name: /In simple words/ }).click();
    await result.locator('.steps.story').scrollIntoViewIfNeeded();
    await shot(page, 'phone-explain.png');

    await page.locator('.tutor-fab').click();
    await page.getByPlaceholder(/Type your question/).fill('Why does a longer string swing slower?');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.locator('.bubble.assistant').waitFor();
    await shot(page, 'phone-tutor.png');
    await page.close();

    // Dark theme on the phone.
    page = await open(browser, true, true);
    await page.goto(`${base}/#/sensors`);
    await page.locator('h1').first().waitFor();
    await shot(page, 'phone-sensors-dark.png');
    await page.close();
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
  }
  console.log('wrote docs/images/*.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
