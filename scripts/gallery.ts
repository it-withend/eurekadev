/**
 * Devpost gallery and thumbnail (3:2 PNGs) from the README screenshots and charts:
 *   npm run screenshots && npm run charts && npm run gallery  →  docs/devpost/*.png
 *
 * Uses Playwright's Chromium (PW_CHANNEL=msedge to use an installed browser).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const images = join(process.cwd(), 'docs', 'images');
const out = join(process.cwd(), 'docs', 'devpost');
const W = 1800;
const H = 1200;

const src = (file: string) => {
  const type = file.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  return `data:${type};base64,${readFileSync(join(images, file)).toString('base64')}`;
};

const PAGE = (body: string) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=block" rel="stylesheet">
<style>
  :root { --paper:#f4f7fc; --ink:#15213a; --ink2:#56627b; --accent:#2b59c3; --x:#e5484d; --y:#0f9d9a; --rule:#dfe6f2; }
  * { box-sizing: border-box; margin: 0; }
  body { width:${W}px; height:${H}px; overflow:hidden; background: var(--paper); color: var(--ink);
    font-family: 'Atkinson Hyperlegible', 'Segoe UI', sans-serif; padding: 72px 96px;
    background-image: linear-gradient(var(--rule) 1px, transparent 1px), linear-gradient(90deg, var(--rule) 1px, transparent 1px);
    background-size: 40px 40px; display:flex; flex-direction:column; }
  h1 { font: 800 64px/1.05 'Bricolage Grotesque', sans-serif; letter-spacing: -0.02em; }
  .sub { font-size: 30px; color: var(--ink2); margin-top: 14px; }
  .shot { flex:1; min-height:0; display:flex; align-items:center; justify-content:center; margin-top: 44px; }
  .shot img { max-width:100%; max-height:100%; border-radius: 18px; box-shadow: 0 24px 60px rgba(21,33,58,.18); border: 1px solid var(--rule); background:#fff; }
  .phones { display:flex; gap: 48px; justify-content:center; }
  .phones figure { display:flex; flex-direction:column; align-items:center; gap: 16px; }
  .phones img { height: 820px; border-radius: 36px; border: 10px solid var(--ink); box-shadow: 0 24px 60px rgba(21,33,58,.2); }
  .phones figcaption { font-size: 26px; font-weight: 700; }
  .chart img { box-shadow:none; border:none; background:transparent; width:100%; }
</style></head><body>${body}</body></html>`;

const slide = (title: string, sub: string, inner: string) =>
  PAGE(`<h1>${title}</h1><p class="sub">${sub}</p><div class="shot">${inner}</div>`);

/** Charts carry their own title, so they fill the slide and the note goes underneath. */
const chart = (file: string, note: string) =>
  PAGE(`<div class="shot chart" style="margin:0;flex-direction:column;gap:40px"><img src="${src(file)}"><p class="sub">${note}</p></div>`);

const steps = [
  ['Set up', 'A drawing, what to gather and exactly what to do.'],
  ['Measure', 'With the phone’s sensors — hands-free, with beeps and spoken cues — or in the virtual lab.'],
  ['Results', 'Value ± uncertainty, the accepted value and a fair verdict, explained in simple words or formulas.'],
  ['Write up', 'Hypothesis, conclusion and sources of error, printable as a lab report.'],
];

const slides: Record<string, string> = {
  'thumbnail.png': PAGE(`
    <h1 style="font-size:220px;letter-spacing:-0.045em;margin-top:40px">PocketLab</h1>
    <p class="sub" style="font-size:64px;margin-top:20px;color:var(--ink)">Your phone is a physics lab.</p>
    <svg viewBox="0 0 1600 520" style="width:100%;margin-top:auto">
      <g fill="none" stroke-width="12" stroke-linecap="round">
        <path stroke="#e5484d" d="M0 70 C200 30 400 110 600 70 S1000 30 1200 70 S1450 100 1580 70"/>
        <path stroke="#0f9d9a" d="M0 250 C50 190 100 190 150 250 S250 310 300 250 S400 190 450 250 S550 310 600 250 S700 190 750 250 S850 310 900 250 S1000 190 1050 250 S1150 310 1200 250 S1300 190 1350 250 S1450 310 1500 250 S1560 210 1580 230"/>
        <path stroke="#2b59c3" d="M0 430 C110 330 220 330 330 430 S550 530 660 430 S880 330 990 430 S1210 530 1320 430 S1500 360 1580 400"/>
      </g>
      <circle cx="1580" cy="70" r="18" fill="#e5484d"/><circle cx="1580" cy="230" r="18" fill="#0f9d9a"/><circle cx="1580" cy="400" r="18" fill="#2b59c3"/>
    </svg>`),
  '1-home.png': slide('Your phone is a physics lab', 'Open a link. No install, no account — iPhone and Android.', `<img src="${src('home.png')}">`),
  '2-phones.png': slide(
    'Made for the phone in your pocket',
    'Simple words or formulas, an AI tutor that knows your numbers, a sensor check, dark mode.',
    `<div class="phones">
      <figure><img src="${src('phone-explain.png')}"><figcaption>In simple words</figcaption></figure>
      <figure><img src="${src('phone-tutor.png')}"><figcaption>AI tutor</figcaption></figure>
      <figure><img src="${src('phone-sensors-dark.png')}"><figcaption>Sensor check</figcaption></figure>
    </div>`,
  ),
  '3-result.png': slide('An honest result', 'Value ± uncertainty, the accepted value, and a verdict a careful student can trust.', `<img src="${src('result-verdict.png')}">`),
  '4-virtual-lab.png': slide('Real lab or virtual lab', 'Practise on Earth, the Moon or Jupiter — the simulated data goes through the same analysis.', `<img src="${src('virtual-lab.png')}">`),
  '5-how-it-works.png': PAGE(`<h1>One experiment at a time</h1>
    <p class="sub">From set-up to conclusion, with the method visible at every step.</p>
    <div style="flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:28px;align-items:center;margin-top:40px">
      ${steps
        .map(
          ([t, d], i) => `<div style="background:#fff;border:1px solid var(--rule);border-radius:22px;padding:40px 34px;height:440px;box-shadow:0 16px 40px rgba(21,33,58,.08)">
          <div style="width:72px;height:72px;border-radius:50%;background:var(--accent);color:#fff;font:800 38px/72px 'Bricolage Grotesque';text-align:center">${i + 1}</div>
          <h2 style="font:800 46px 'Bricolage Grotesque';margin:30px 0 18px">${t}</h2>
          <p style="font-size:29px;line-height:1.45;color:var(--ink2)">${d}</p></div>`,
        )
        .join('')}
    </div>`),
  '6-accuracy.png': chart('accuracy.svg', 'Simulated iPhone, Android, Firefox, budget and old-phone sensor streams. Reproduce it: npm run validate.'),
  '7-false-alarms.png': chart('false-alarms.svg', '360 correctly performed experiments with real-world imperfections. This check runs in CI on every push.'),
  '8-architecture.png': chart('code-layers.svg', 'The measurement engine has no UI framework in it, and ESLint keeps it that way.'),
};

async function main() {
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  for (const [file, html] of Object.entries(slides)) {
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(out, file) });
  }
  await browser.close();
  console.log(`wrote ${Object.keys(slides).length} images to docs/devpost/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
