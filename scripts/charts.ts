/**
 * README figures, generated from the same code as the validation report:
 *   npm run charts  →  docs/images/{accuracy,false-alarms,code-layers}.svg
 *
 * SVGs adapt to GitHub's light and dark themes (prefers-color-scheme inside the
 * file). Palette: the app's sensor-axis colours, validated for colour-blind
 * readers (ΔE ≥ 12 between every pair); status colours only for verdicts.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runPlatformMatrix } from './lib/validation';
import { stress } from './stress';

const out = join(process.cwd(), 'docs', 'images');
mkdirSync(out, { recursive: true });

const FONT = `font-family="Atkinson Hyperlegible, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"`;
const STYLE = `<style>
  .bg { fill: #ffffff } .ink { fill: #15213a } .ink2 { fill: #56627b } .grid { stroke: #e3e8f1 } .axis { stroke: #c4cddc }
  .z { fill: #2b59c3 } .x { fill: #e5484d } .y { fill: #0f9d9a } .zs { stroke: #2b59c3 } .xs { stroke: #e5484d } .ys { stroke: #0f9d9a }
  .good { fill: #2f9e66 } .warn { fill: #c27c0e } .bad { fill: #d93d42 } .muted { fill: #b8c2d3 } .onfill { fill: #ffffff }
  @media (prefers-color-scheme: dark) {
    .bg { fill: #0d1117 } .ink { fill: #e8edf7 } .ink2 { fill: #9aa6bf } .grid { stroke: #222b3d } .axis { stroke: #33405a }
    .z { fill: #6c8ef5 } .x { fill: #f2555a } .y { fill: #22a8a0 } .zs { stroke: #6c8ef5 } .xs { stroke: #f2555a } .ys { stroke: #22a8a0 }
    .good { fill: #3fb27a } .warn { fill: #e0a32e } .bad { fill: #f2555a } .muted { fill: #46536e } .onfill { fill: #0d1117 }
  }
</style>`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = (w: number, h: number, title: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}" ${FONT}>
${STYLE}
<rect class="bg" width="${w}" height="${h}" rx="12"/>
${body}
</svg>
`;

/* ---------- 1. Accuracy on every simulated phone (small multiples) ---------- */
function accuracyChart() {
  const rows = runPlatformMatrix();
  const panels = [
    { name: 'Pendulum → g', match: 'Pendulum', cls: 'z', stroke: 'zs' },
    { name: 'Spinning chair → r', match: 'Chair', cls: 'x', stroke: 'xs' },
    { name: 'Singing tube → v', match: 'Tube', cls: 'y', stroke: 'ys' },
  ];
  const shortName = (p: string) =>
    p
      .replace('Android Chrome, fast sensor (200 Hz)', 'Android, 200 Hz')
      .replace('Android Chrome, throttled (60 Hz, drops)', 'Android, 60 Hz')
      .replace('iPhone Safari (60 Hz, inverted accel, relabelled gyro)', 'iPhone Safari')
      .replace('Firefox Android (50 Hz, jittery, batched)', 'Firefox, jittery')
      .replace('Budget phone without gyroscope (50 Hz)', 'No gyroscope')
      .replace('Old phone, slow sensor (25 Hz)', 'Old phone, 25 Hz')
      .replace('Microphone at ', 'Mic ');
  const W = 960;
  const panelW = 300;
  const rowH = 26;
  const top = 112;
  const maxPct = 2;
  const labelW = 112;
  const plotW = panelW - labelW - 58;
  let body = `<text class="ink" x="24" y="38" font-size="20" font-weight="700">Accurate on every phone we could simulate</text>
<text class="ink2" x="24" y="62" font-size="13">Mean error (bar) and worst error (line) over 20 randomised set-ups per row. Lower is better.</text>`;
  let maxRows = 0;
  panels.forEach((panel, pi) => {
    const x0 = 24 + pi * (panelW + 12);
    const mine = rows.filter((r) => r.experiment.includes(panel.match === 'Chair' ? 'Spinning Chair' : panel.match === 'Tube' ? 'Singing Tube' : 'Pendulum'));
    maxRows = Math.max(maxRows, mine.length);
    body += `<text class="ink" x="${x0}" y="${top - 14}" font-size="14" font-weight="700">${esc(panel.name)}</text>`;
    body += `<text class="ink2" x="${x0 + panelW - 6}" y="${top - 14}" font-size="11" text-anchor="end">mean</text>`;
    const px = (p: number) => x0 + labelW + (Math.min(p, maxPct) / maxPct) * plotW;
    for (const tick of [0, 0.5, 1, 1.5, 2]) {
      body += `<line class="grid" x1="${px(tick)}" x2="${px(tick)}" y1="${top}" y2="${top + mine.length * rowH}" stroke-width="1"/>`;
      body += `<text class="ink2" x="${px(tick)}" y="${top + mine.length * rowH + 16}" font-size="11" text-anchor="middle">${tick}%</text>`;
    }
    mine.forEach((r, i) => {
      const y = top + i * rowH;
      body += `<text class="ink2" x="${x0 + labelW - 8}" y="${y + 17}" font-size="12" text-anchor="end">${esc(shortName(r.platform))}</text>`;
      if (!r.ok) {
        body += `<text class="ink2" x="${px(0) + 4}" y="${y + 17}" font-size="12" font-style="italic">refuses, explains why</text>`;
        return;
      }
      const mean = (r.errors.reduce((a, b) => a + b, 0) / r.errors.length) * 100;
      const worst = Math.max(...r.errors) * 100;
      body += `<line class="${panel.stroke}" x1="${px(0)}" x2="${px(worst)}" y1="${y + 13}" y2="${y + 13}" stroke-width="2" stroke-linecap="round" opacity="0.45"/>`;
      body += `<circle class="${panel.cls}" cx="${px(worst)}" cy="${y + 13}" r="4"/>`;
      body += `<rect class="${panel.cls}" x="${px(0)}" y="${y + 5}" width="${Math.max(2, px(mean) - px(0))}" height="16" rx="4"/>`;
      body += `<text class="ink" x="${x0 + panelW - 6}" y="${y + 18}" font-size="11" text-anchor="end">${mean.toFixed(2)}%</text>`;
    });
  });
  const H = top + maxRows * rowH + 44;
  writeFileSync(join(out, 'accuracy.svg'), svg(W, H, 'Mean and worst error of each experiment on each simulated phone platform; all under 2 %', body));
}

/* ---------- 2. False alarms before / after (100 % stacked bars) ---------- */
function falseAlarmChart() {
  // "Before" is the first realistic stress run (40 attempts × 6 cases), recorded in the
  // commit history before the fixes; "after" is recomputed now.
  const before = { agrees: 187, close: 32, off: 21, total: 240 };
  const now = stress(60, false);
  const after = Object.values(now).reduce(
    (a, c) => ({ agrees: a.agrees + c.agrees, close: a.close + c.close, off: a.off + c.off + c.imprecise + c.failed, total: a.total + c.agrees + c.close + c.off + c.imprecise + c.failed }),
    { agrees: 0, close: 0, off: 0, total: 0 },
  );
  const W = 960;
  const x0 = 170;
  const barW = W - x0 - 40;
  let body = `<text class="ink" x="24" y="38" font-size="20" font-weight="700">A careful student is not told they got it wrong</text>
<text class="ink2" x="24" y="62" font-size="13">Verdicts for correctly performed experiments with real-world imperfections (shaky hands, breath noise, uneven floors…), simulated on iPhone and Android.</text>`;
  const rows = [
    { label: 'Before the fixes', d: before },
    { label: 'Now', d: after },
  ];
  rows.forEach((r, i) => {
    const y = 96 + i * 62;
    body += `<text class="ink" x="${x0 - 14}" y="${y + 20}" font-size="14" font-weight="700" text-anchor="end">${r.label}</text>`;
    body += `<text class="ink2" x="${x0 - 14}" y="${y + 38}" font-size="11" text-anchor="end">${r.d.total} attempts</text>`;
    let x = x0;
    const segs = [
      { n: r.d.agrees, cls: 'good', name: 'agrees' },
      { n: r.d.close, cls: 'warn', name: 'close' },
      { n: r.d.off, cls: 'bad', name: 'told “far off”' },
    ];
    segs.forEach((s) => {
      if (!s.n) return;
      const w = (s.n / r.d.total) * barW;
      body += `<rect class="${s.cls}" x="${x}" y="${y}" width="${Math.max(2, w - 2)}" height="32" rx="4"/>`;
      const pct = (s.n / r.d.total) * 100;
      if (w > 120) body += `<text class="onfill" x="${x + 10}" y="${y + 21}" font-size="13" font-weight="700">${pct.toFixed(pct > 99 && pct < 100 ? 1 : 0)}% ${s.name}</text>`;
      x += w;
    });
    // Small segments are labelled beside the bar, never by colour alone.
    const small = segs.filter((s) => s.n && (s.n / r.d.total) * barW <= 120);
    if (small.length) {
      body += `<text class="ink2" x="${x0 + barW}" y="${y + 50}" font-size="11" text-anchor="end">${small.map((s) => `${((s.n / r.d.total) * 100).toFixed(1)}% ${s.name}`).join(', ')}</text>`;
    }
  });
  writeFileSync(join(out, 'false-alarms.svg'), svg(W, 236, `Before the fixes ${((before.agrees / before.total) * 100).toFixed(0)}% of correct attempts were told they agree; now ${((after.agrees / after.total) * 100).toFixed(1)}%`, body));
}

/* ---------- 3. Code by layer (what is framework-free) ---------- */
function countLines(dir: string): number {
  let n = 0;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) n += countLines(p);
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f)) n += readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).length;
  }
  return n;
}

function codeChart() {
  const layers = [
    { name: 'Signal processing (dsp)', dir: 'src/dsp', free: true },
    { name: 'Core contracts & sensors', dir: 'src/core', free: true },
    { name: 'Experiments & builder', dir: 'src/experiments', free: true },
    { name: 'AI tutor server', dir: 'src/server', free: true },
    { name: 'Interface (React)', dir: 'src/ui', free: false },
  ].map((l) => ({ ...l, lines: countLines(join(process.cwd(), l.dir)) }));
  const max = Math.max(...layers.map((l) => l.lines));
  const freeShare = layers.filter((l) => l.free).reduce((a, l) => a + l.lines, 0) / layers.reduce((a, l) => a + l.lines, 0);
  const W = 960;
  const x0 = 230;
  const barW = W - x0 - 90;
  let body = `<text class="ink" x="24" y="38" font-size="20" font-weight="700">${Math.round(freeShare * 100)}% of the code works without any UI framework</text>
<text class="ink2" x="24" y="62" font-size="13">Lines of code per layer. Framework-free layers can be reused in a native app, another framework or on a server.</text>
<rect class="z" x="${W - 330}" y="80" width="12" height="12" rx="3"/><text class="ink2" x="${W - 312}" y="91" font-size="12">framework-free TypeScript</text>
<rect class="muted" x="${W - 150}" y="80" width="12" height="12" rx="3"/><text class="ink2" x="${W - 132}" y="91" font-size="12">React UI</text>`;
  layers.forEach((l, i) => {
    const y = 108 + i * 34;
    const w = (l.lines / max) * barW;
    body += `<text class="ink2" x="${x0 - 12}" y="${y + 17}" font-size="13" text-anchor="end">${esc(l.name)}</text>`;
    body += `<rect class="${l.free ? 'z' : 'muted'}" x="${x0}" y="${y + 4}" width="${w}" height="18" rx="4"/>`;
    body += `<text class="ink" x="${x0 + w + 8}" y="${y + 18}" font-size="12">${l.lines.toLocaleString('en-US')}</text>`;
  });
  writeFileSync(join(out, 'code-layers.svg'), svg(W, 108 + layers.length * 34 + 20, `${Math.round(freeShare * 100)} percent of the code has no UI-framework dependency`, body));
}

accuracyChart();
falseAlarmChart();
codeChart();
console.log('wrote docs/images/accuracy.svg, false-alarms.svg, code-layers.svg');
