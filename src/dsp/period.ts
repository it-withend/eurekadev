import { linearRegression, median, std, type Signal } from './stats';

/**
 * Upward zero-crossing times in seconds, linearly interpolated between samples.
 * A Schmitt-trigger style hysteresis (signal must dip below −h before the next
 * crossing counts) rejects jitter from residual noise around zero.
 */
export function zeroCrossings(x: Signal, sampleRate: number, hysteresis = 0): number[] {
  const times: number[] = [];
  let armed = false;
  for (let i = 1; i < x.length; i++) {
    if (x[i - 1] < -hysteresis) armed = true;
    if (armed && x[i - 1] < 0 && x[i] >= 0) {
      const frac = x[i - 1] / (x[i - 1] - x[i]);
      times.push((i - 1 + frac) / sampleRate);
      armed = false;
    }
  }
  return times;
}

export interface PeriodEstimate {
  period: number;
  /** Standard error of the period, seconds. */
  uncertainty: number;
  cycles: number;
  crossings: number[];
  /** Number of cycles rejected as outliers. */
  rejected: number;
}

/**
 * Period of a roughly sinusoidal, zero-mean signal from its upward zero crossings.
 *
 * Each crossing gets a cycle number, and the period is the slope of a
 * least-squares line through (cycle, time). Averaging the intervals instead
 * would reduce to (last − first) / n, so a single disturbed crossing — the
 * moment a hand lets go — would shift the result directly; the fit spreads it
 * over all crossings. Crossings far off the line (missed or double crossings,
 * > 15 % of a period) are dropped and the line refitted.
 */
export function estimatePeriod(x: Signal, sampleRate: number, hysteresisFraction = 0.2): PeriodEstimate | null {
  const h = hysteresisFraction * std(x);
  const crossings = zeroCrossings(x, sampleRate, h);
  if (crossings.length < 3) return null;
  const intervals: number[] = [];
  for (let i = 1; i < crossings.length; i++) intervals.push(crossings[i] - crossings[i - 1]);
  const guess = median(intervals);
  if (!(guess > 0)) return null;
  const cycleOf = crossings.map((t) => Math.round((t - crossings[0]) / guess));
  let keep = crossings.map((_, i) => i);
  let fit = linearRegression(keep.map((i) => cycleOf[i]), keep.map((i) => crossings[i]));
  for (let pass = 0; pass < 2; pass++) {
    const next = keep.filter((i) => Math.abs(crossings[i] - (fit.intercept + fit.slope * cycleOf[i])) <= 0.15 * fit.slope);
    if (next.length === keep.length || next.length < 3) break;
    keep = next;
    fit = linearRegression(keep.map((i) => cycleOf[i]), keep.map((i) => crossings[i]));
  }
  const span = cycleOf[keep[keep.length - 1]] - cycleOf[keep[0]];
  if (span < 1) return null;
  return {
    period: fit.slope,
    uncertainty: fit.slopeStdErr,
    cycles: span,
    crossings: keep.map((i) => crossings[i]),
    rejected: crossings.length - keep.length,
  };
}
