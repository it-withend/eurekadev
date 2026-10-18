import { describe, expect, it } from 'vitest';
import {
  detrend,
  dominantFrequency,
  estimatePeriod,
  fftInPlace,
  findPeak,
  linearRegression,
  lowPass,
  mean,
  median,
  movingAverage,
  removeMean,
  powerSpectrum,
  resampleUniform,
  std,
  zeroCrossings,
} from './index';

const sine = (f: number, sr: number, seconds: number, phase = 0, amp = 1) =>
  Float64Array.from({ length: Math.round(sr * seconds) }, (_, i) => amp * Math.sin(2 * Math.PI * f * (i / sr) + phase));

describe('stats', () => {
  it('computes mean, median and sample std', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(std([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
  });

  it('fits an exact line with r² = 1', () => {
    const x = [0, 1, 2, 3, 4];
    const fit = linearRegression(x, x.map((v) => 3 * v - 2));
    expect(fit.slope).toBeCloseTo(3, 12);
    expect(fit.intercept).toBeCloseTo(-2, 12);
    expect(fit.r2).toBeCloseTo(1, 12);
    expect(fit.slopeStdErr).toBeCloseTo(0, 12);
  });

  it('removes linear drift', () => {
    const x = Array.from({ length: 100 }, (_, i) => 0.5 * i + 7);
    const d = detrend(x);
    expect(Math.max(...d.map(Math.abs))).toBeLessThan(1e-9);
  });
});

describe('fft', () => {
  it('matches a hand-computed DFT of an impulse and rejects bad sizes', () => {
    const re = new Float64Array([1, 0, 0, 0]);
    const im = new Float64Array(4);
    fftInPlace(re, im);
    expect(Array.from(re)).toEqual([1, 1, 1, 1]);
    expect(() => fftInPlace(new Float64Array(3), new Float64Array(3))).toThrow();
  });

  it('locates a sine with sub-bin accuracy', () => {
    const sr = 8000;
    const f = 437.3;
    const s = powerSpectrum(sine(f, sr, 0.5), sr, 4096);
    const peak = findPeak(s, 100, 2000)!;
    expect(s.binWidth).toBeGreaterThan(1.9);
    expect(Math.abs(peak.frequency - f)).toBeLessThan(0.3);
    expect(peak.prominenceDb).toBeGreaterThan(40);
  });

  it('reports a dominant frequency with uncertainty from Welch segments', () => {
    const sr = 8000;
    const x = sine(250, sr, 2).map((v, i) => v + 0.3 * Math.sin(i * 12.9898) * Math.cos(i * 78.233));
    const r = dominantFrequency(x, sr, { segmentSize: 4096, fMin: 50, fMax: 2000 })!;
    expect(Math.abs(r.peak.frequency - 250)).toBeLessThan(0.5);
    expect(r.uncertainty).toBeGreaterThan(0);
    expect(r.uncertainty).toBeLessThan(1);
  });
});

describe('filters', () => {
  it('low-pass keeps slow motion and kills fast noise without phase shift', () => {
    const sr = 100;
    const slow = sine(0.5, sr, 20);
    const noisy = slow.map((v, i) => v + 0.5 * Math.sin(2 * Math.PI * 30 * (i / sr)));
    const y = lowPass(noisy, sr, 3);
    let maxErr = 0;
    for (let i = 200; i < y.length - 200; i++) maxErr = Math.max(maxErr, Math.abs(y[i] - slow[i]));
    expect(maxErr).toBeLessThan(0.02);
  });

  it('moving average of a constant is the constant', () => {
    expect(Array.from(movingAverage([2, 2, 2, 2, 2], 3))).toEqual([2, 2, 2, 2, 2]);
  });
});

describe('period', () => {
  it('finds interpolated zero crossings', () => {
    const sr = 10;
    const z = zeroCrossings(sine(1, sr, 3.05, -0.3), sr);
    expect(z.length).toBe(3);
    expect(z[1] - z[0]).toBeCloseTo(1, 2);
  });

  it('estimates the period of a damped oscillation', () => {
    const sr = 100;
    const T = 2.007;
    const x = Float64Array.from({ length: sr * 30 }, (_, i) => {
      const t = i / sr;
      return Math.exp(-t / 40) * Math.sin((2 * Math.PI * t) / T);
    });
    const p = estimatePeriod(x, sr)!;
    expect(p.cycles).toBeGreaterThanOrEqual(13);
    expect(Math.abs(p.period - T)).toBeLessThan(0.002);
  });
});

describe('period timing regression', () => {
  it('filtering keeps the period exact for any phase and non-whole number of cycles', () => {
    // detrend() used to tilt the signal and bias the period by up to 0.25 %.
    const sr = 400;
    for (const T of [0.9, 1.82, 2.27, 2.5]) {
      for (const phase of [0, 0.7, 1.5, 2.3]) {
        const x = Float64Array.from({ length: 25 * sr }, (_, i) => Math.cos((2 * Math.PI * i) / sr / T + phase) + 0.02);
        const p = estimatePeriod(lowPass(removeMean(x), sr, 3).slice(2 * sr, x.length - sr), sr)!;
        expect(Math.abs(p.period / T - 1)).toBeLessThan(1e-4);
      }
    }
  });
});

describe('resample', () => {
  it('interpolates jittery samples onto a uniform grid', () => {
    const times = [0, 0.011, 0.019, 0.032, 0.04];
    const vals = times.map((t) => 10 * t);
    const [out] = resampleUniform(times, [vals], 100);
    expect(out.length).toBe(5);
    out.forEach((v, i) => expect(v).toBeCloseTo(i * 0.1, 9));
  });
});
