import type { Signal } from './stats';

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** RBJ audio-EQ-cookbook low-pass coefficients (Q = 1/√2 → Butterworth). */
function lowPassCoefficients(sampleRate: number, cutoffHz: number, q = Math.SQRT1_2): Biquad {
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const a0 = 1 + alpha;
  return {
    b0: (1 - cos) / 2 / a0,
    b1: (1 - cos) / a0,
    b2: (1 - cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

/** RBJ band-pass (constant 0 dB peak gain). Used to synthesise resonances. */
export function bandPassCoefficients(sampleRate: number, centerHz: number, q: number): Biquad {
  const w0 = (2 * Math.PI * centerHz) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b1: 0,
    b2: -alpha / a0,
    a1: (-2 * Math.cos(w0)) / a0,
    a2: (1 - alpha) / a0,
  };
}

export function applyBiquad(x: Signal, c: Biquad): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  // Start from the first sample's steady state to avoid a start-up transient.
  if (x.length) {
    x1 = x2 = x[0];
    const dc = (c.b0 + c.b1 + c.b2) / (1 + c.a1 + c.a2);
    y1 = y2 = Number.isFinite(dc) ? x[0] * dc : 0;
  }
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = xi;
    y2 = y1; y1 = yi;
    y[i] = yi;
  }
  return y;
}

/**
 * Zero-phase Butterworth low-pass (forward-backward, like scipy's filtfilt).
 * Zero phase matters here: timing of zero crossings is what we measure.
 */
export function lowPass(x: Signal, sampleRate: number, cutoffHz: number): Float64Array {
  if (cutoffHz >= sampleRate / 2) return Float64Array.from(x);
  const c = lowPassCoefficients(sampleRate, cutoffHz);
  const forward = applyBiquad(x, c);
  forward.reverse();
  const backward = applyBiquad(forward, c);
  return backward.reverse();
}

/** Centered moving average with an odd window. */
export function movingAverage(x: Signal, window: number): Float64Array {
  const w = Math.max(1, Math.floor(window) | 1);
  const half = w >> 1;
  const out = new Float64Array(x.length);
  let sum = 0;
  let count = 0;
  let lo = 0;
  let hi = -1;
  for (let i = 0; i < x.length; i++) {
    const wantHi = Math.min(x.length - 1, i + half);
    const wantLo = Math.max(0, i - half);
    while (hi < wantHi) { hi++; sum += x[hi]; count++; }
    while (lo < wantLo) { sum -= x[lo]; lo++; count--; }
    out[i] = sum / count;
  }
  return out;
}
