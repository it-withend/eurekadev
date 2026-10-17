import { variance, mean } from '@dsp/stats';
import type { Recording, Series } from '@core/types';

export const GYRO = ['gx', 'gy', 'gz'] as const;
export const ACCEL = ['ax', 'ay', 'az'] as const;

/** The channel among `names` with the largest variance (where the motion is). */
export function dominantChannel(rec: Recording, names: readonly string[]): { name: string; data: number[]; variance: number } {
  let best = { name: names[0], data: rec.channels[names[0]] ?? [], variance: -1 };
  for (const name of names) {
    const data = rec.channels[name];
    if (!data) continue;
    const v = variance(data);
    if (v > best.variance) best = { name, data, variance: v };
  }
  return best;
}

/** The channel among `names` with the largest mean magnitude (a steady rotation axis). */
export function steadiestChannel(rec: Recording, names: readonly string[]): { name: string; data: number[] } {
  let best = { name: names[0], data: rec.channels[names[0]] ?? [], score: -1 };
  for (const name of names) {
    const data = rec.channels[name];
    if (!data) continue;
    const score = Math.abs(mean(data));
    if (score > best.score) best = { name, data, score };
  }
  return best;
}

/** Downsamples a series for drawing; charts never need more than ~1500 points. */
export function thin(x: ArrayLike<number>, y: ArrayLike<number>, max = 1500): { x: number[]; y: number[] } {
  const step = Math.max(1, Math.ceil(x.length / max));
  const ox: number[] = [];
  const oy: number[] = [];
  for (let i = 0; i < x.length; i += step) {
    ox.push(x[i]);
    oy.push(y[i]);
  }
  return { x: ox, y: oy };
}

export function timeAxis(n: number, sampleRate: number): Float64Array {
  return Float64Array.from({ length: n }, (_, i) => i / sampleRate);
}

export function line(name: string, x: ArrayLike<number>, y: ArrayLike<number>, color = 0): Series {
  return { name, ...thin(x, y), style: 'line', color };
}

export function points(name: string, x: ArrayLike<number>, y: ArrayLike<number>, color = 1): Series {
  return { name, ...thin(x, y, 800), style: 'points', color };
}

export const fmt = (v: number, digits = 3) => v.toFixed(digits);
