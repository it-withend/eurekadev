/** Descriptive statistics and least-squares fitting. All functions are pure. */

export type Signal = ArrayLike<number>;

export function mean(x: Signal): number {
  if (x.length === 0) return NaN;
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i];
  return s / x.length;
}

/** Sample variance (n - 1 denominator). */
export function variance(x: Signal): number {
  const n = x.length;
  if (n < 2) return 0;
  const m = mean(x);
  let s = 0;
  for (let i = 0; i < n; i++) s += (x[i] - m) ** 2;
  return s / (n - 1);
}

export function std(x: Signal): number {
  return Math.sqrt(variance(x));
}

/** Standard error of the mean. */
export function standardError(x: Signal): number {
  return x.length < 2 ? 0 : std(x) / Math.sqrt(x.length);
}

export function median(x: Signal): number {
  if (x.length === 0) return NaN;
  const s = Array.from(x).sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Subtracts the mean (e.g. a gyroscope's constant bias). */
export function removeMean(x: Signal): Float64Array {
  const m = mean(x);
  return Float64Array.from(x, (v) => v - m);
}

/**
 * Removes the mean and any linear drift. Do NOT use before timing an
 * oscillation: over a non-whole number of cycles the fitted line is not zero,
 * and subtracting it shifts the zero crossings progressively (up to 0.25 % in
 * the period). Use `removeMean` there.
 */
export function detrend(x: Signal): Float64Array {
  const n = x.length;
  const out = new Float64Array(n);
  if (n === 0) return out;
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) t[i] = i;
  const { slope, intercept } = linearRegression(t, x);
  for (let i = 0; i < n; i++) out[i] = x[i] - (slope * i + intercept);
  return out;
}

export interface LinearFit {
  slope: number;
  intercept: number;
  /** Coefficient of determination. */
  r2: number;
  slopeStdErr: number;
  interceptStdErr: number;
  n: number;
}

/** Ordinary least squares y = slope * x + intercept, with standard errors. */
export function linearRegression(x: Signal, y: Signal): LinearFit {
  const n = Math.min(x.length, y.length);
  if (n < 2) throw new Error('linearRegression needs at least 2 points');
  const mx = mean(x);
  const my = mean(y);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) throw new Error('linearRegression: x has zero variance');
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (y[i] - (slope * x[i] + intercept)) ** 2;
  const r2 = syy === 0 ? 1 : 1 - sse / syy;
  const s2 = n > 2 ? sse / (n - 2) : 0;
  const slopeStdErr = Math.sqrt(s2 / sxx);
  const interceptStdErr = Math.sqrt(s2 * (1 / n + (mx * mx) / sxx));
  return { slope, intercept, r2, slopeStdErr, interceptStdErr, n };
}

/** Keeps every `factor`-th sample. Callers low-pass first to avoid aliasing. */
export function decimate(x: Signal, factor: number): Float64Array {
  const f = Math.max(1, Math.floor(factor));
  const out = new Float64Array(Math.ceil(x.length / f));
  for (let i = 0, j = 0; i < x.length; i += f, j++) out[j] = x[i];
  return out;
}
