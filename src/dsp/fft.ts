import { mean, standardError, type Signal } from './stats';

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** In-place iterative radix-2 Cooley–Tukey FFT. Length must be a power of two. */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0) {
    throw new Error('fftInPlace: length must be a power of two');
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

export function hann(n: number): Float64Array {
  const w = new Float64Array(n);
  if (n === 1) { w[0] = 1; return w; }
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}

export interface Spectrum {
  /** Bin centre frequencies in Hz, 0 … Nyquist. */
  freqs: Float64Array;
  /** Power per bin (arbitrary but consistent units). */
  power: Float64Array;
  binWidth: number;
}

/**
 * One-sided power spectrum of a Hann-windowed, mean-removed segment,
 * zero-padded to `fftSize` (≥ segment length) for finer interpolation.
 */
export function powerSpectrum(x: Signal, sampleRate: number, fftSize = nextPow2(x.length)): Spectrum {
  const n = x.length;
  const size = nextPow2(Math.max(fftSize, n));
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const w = hann(n);
  const m = mean(x);
  for (let i = 0; i < n; i++) re[i] = (x[i] - m) * w[i];
  fftInPlace(re, im);
  const bins = size / 2 + 1;
  const power = new Float64Array(bins);
  const freqs = new Float64Array(bins);
  const binWidth = sampleRate / size;
  for (let k = 0; k < bins; k++) {
    power[k] = re[k] * re[k] + im[k] * im[k];
    freqs[k] = k * binWidth;
  }
  return { freqs, power, binWidth };
}

/** Total power between fMin and fMax (inclusive bins). */
export function bandPower(s: Spectrum, fMin: number, fMax: number): number {
  let sum = 0;
  for (let k = 0; k < s.freqs.length; k++) if (s.freqs[k] >= fMin && s.freqs[k] <= fMax) sum += s.power[k];
  return sum;
}

export interface WelchResult extends Spectrum {
  /** Individual segment spectra, kept so callers can measure peak scatter. */
  segments: Spectrum[];
}

/**
 * Welch's method: average the spectra of overlapping windowed segments.
 * Trades frequency resolution for a much less noisy estimate.
 */
export function welch(x: Signal, sampleRate: number, segmentSize: number, overlap = 0.5): WelchResult {
  const seg = Math.min(segmentSize, x.length);
  const step = Math.max(1, Math.floor(seg * (1 - overlap)));
  const segments: Spectrum[] = [];
  for (let start = 0; start + seg <= x.length; start += step) {
    const slice = Array.prototype.slice.call(x, start, start + seg) as number[];
    segments.push(powerSpectrum(slice, sampleRate, seg));
  }
  if (segments.length === 0) throw new Error('welch: signal too short');
  const { freqs, binWidth } = segments[0];
  const power = new Float64Array(freqs.length);
  for (const s of segments) for (let k = 0; k < power.length; k++) power[k] += s.power[k];
  for (let k = 0; k < power.length; k++) power[k] /= segments.length;
  return { freqs, power, binWidth, segments };
}

export interface Peak {
  frequency: number;
  power: number;
  index: number;
  /** Peak power over the median power in the search band, in dB. */
  prominenceDb: number;
}

/**
 * Highest bin within [fMin, fMax], refined with parabolic interpolation on
 * log-power — gives sub-bin accuracy (typically < 0.1 bin for clean tones).
 */
export function findPeak(s: Spectrum, fMin: number, fMax: number): Peak | null {
  const lo = Math.max(1, Math.ceil(fMin / s.binWidth));
  const hi = Math.min(s.power.length - 2, Math.floor(fMax / s.binWidth));
  if (hi <= lo) return null;
  let best = lo;
  for (let k = lo; k <= hi; k++) if (s.power[k] > s.power[best]) best = k;
  const eps = 1e-300;
  const a = Math.log(s.power[best - 1] + eps);
  const b = Math.log(s.power[best] + eps);
  const c = Math.log(s.power[best + 1] + eps);
  const denom = a - 2 * b + c;
  const delta = denom === 0 ? 0 : Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom));
  const band = Array.from(s.power.subarray(lo, hi + 1)).sort((x, y) => x - y);
  const med = band[band.length >> 1] || eps;
  return {
    frequency: (best + delta) * s.binWidth,
    power: s.power[best],
    index: best,
    prominenceDb: 10 * Math.log10(s.power[best] / med),
  };
}

/** Dominant frequency with an uncertainty from the scatter across Welch segments. */
export function dominantFrequency(
  x: Signal,
  sampleRate: number,
  opts: { segmentSize: number; fMin: number; fMax: number },
): { peak: Peak; uncertainty: number; spectrum: WelchResult } | null {
  const spectrum = welch(x, sampleRate, opts.segmentSize);
  const peak = findPeak(spectrum, opts.fMin, opts.fMax);
  if (!peak) return null;
  const perSegment = spectrum.segments
    .map((s) => findPeak(s, opts.fMin, opts.fMax)?.frequency)
    .filter((f): f is number => f !== undefined && Math.abs(f - peak.frequency) < 5 * spectrum.binWidth);
  // Never claim better than a quarter bin: interpolation has its own bias.
  const uncertainty = Math.max(spectrum.binWidth / 4, standardError(perSegment));
  return { peak, uncertainty, spectrum };
}
