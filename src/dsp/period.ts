import { median, std, standardError, type Signal } from './stats';

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
 * Period of a roughly sinusoidal, zero-mean signal from the intervals between
 * consecutive upward zero crossings. Intervals deviating > 20 % from the median
 * (missed or double crossings) are discarded.
 */
export function estimatePeriod(x: Signal, sampleRate: number, hysteresisFraction = 0.2): PeriodEstimate | null {
  const h = hysteresisFraction * std(x);
  const crossings = zeroCrossings(x, sampleRate, h);
  if (crossings.length < 2) return null;
  const intervals: number[] = [];
  for (let i = 1; i < crossings.length; i++) intervals.push(crossings[i] - crossings[i - 1]);
  const med = median(intervals);
  const good = intervals.filter((d) => Math.abs(d - med) <= 0.2 * med);
  if (good.length === 0) return null;
  const period = good.reduce((a, b) => a + b, 0) / good.length;
  return {
    period,
    uncertainty: standardError(good),
    cycles: good.length,
    crossings,
    rejected: intervals.length - good.length,
  };
}
