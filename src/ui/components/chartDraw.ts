/** Dependency-free canvas plotting. Small on purpose: we draw a few kinds of chart well. */

export interface DrawSeries {
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  style: 'line' | 'points';
  color: number;
}

export interface Frame {
  xLabel: string;
  yLabel: string;
  xRange?: [number, number];
  yRange?: [number, number];
}

/** "Nice" tick values (1, 2, 5 × 10ⁿ) covering [min, max]. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return ticks;
}

function extent(series: DrawSeries[], key: 'x' | 'y'): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of series) {
    const a = s[key];
    for (let i = 0; i < a.length; i++) {
      const v = a[i];
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (lo === Infinity) return [0, 1];
  if (lo === hi) return [lo - 1, hi + 1];
  return [lo, hi];
}

function formatTick(v: number, step: number): string {
  const decimals = Math.max(0, -Math.floor(Math.log10(step || 1)));
  return v.toFixed(Math.min(decimals, 4));
}

export function drawChart(canvas: HTMLCanvasElement, series: DrawSeries[], frame: Frame): void {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
  if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const css = getComputedStyle(canvas);
  const ink = css.getPropertyValue('--ink-2').trim() || '#555';
  const grid = css.getPropertyValue('--rule').trim() || '#ddd';
  const palette = [1, 2, 3].map((i) => css.getPropertyValue(`--series-${i}`).trim() || '#06c');
  const font = css.getPropertyValue('--font-mono').trim() || 'monospace';

  const pad = { left: 52, right: 12, top: 10, bottom: 38 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;
  const [x0, x1] = frame.xRange ?? extent(series, 'x');
  let [y0, y1] = frame.yRange ?? extent(series, 'y');
  if (!frame.yRange) {
    const m = (y1 - y0) * 0.06;
    y0 -= m;
    y1 += m;
  }
  const sx = (v: number) => pad.left + ((v - x0) / (x1 - x0 || 1)) * pw;
  const sy = (v: number) => pad.top + ph - ((v - y0) / (y1 - y0 || 1)) * ph;

  ctx.font = `11px ${font}`;
  ctx.lineWidth = 1;
  ctx.strokeStyle = grid;
  ctx.fillStyle = ink;

  const xt = niceTicks(x0, x1, Math.max(3, Math.floor(pw / 80)));
  const yt = niceTicks(y0, y1, Math.max(3, Math.floor(ph / 45)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const v of xt) {
    const px = Math.round(sx(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, pad.top);
    ctx.lineTo(px, pad.top + ph);
    ctx.stroke();
    ctx.fillText(formatTick(v, xt[1] - xt[0]), px, pad.top + ph + 6);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of yt) {
    const py = Math.round(sy(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, py);
    ctx.lineTo(pad.left + pw, py);
    ctx.stroke();
    ctx.fillText(formatTick(v, yt[1] - yt[0]), pad.left - 6, py);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(frame.xLabel, pad.left + pw / 2, h - 2);
  ctx.save();
  ctx.translate(12, pad.top + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'middle';
  ctx.fillText(frame.yLabel, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.left, pad.top, pw, ph);
  ctx.clip();
  for (const s of series) {
    const color = palette[s.color % palette.length];
    if (s.style === 'line') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.75;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < s.x.length; i++) {
        if (!Number.isFinite(s.y[i])) { pen = false; continue; }
        const px = sx(s.x[i]);
        const py = sy(s.y[i]);
        if (pen) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
        pen = true;
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      for (let i = 0; i < s.x.length; i++) {
        ctx.beginPath();
        ctx.arc(sx(s.x[i]), sy(s.y[i]), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}
