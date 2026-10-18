import { describe, expect, it } from 'vitest';
import { synthCentripetal, synthPendulum, synthResonance } from '@testing/synthetic';
import { parseRecording, withParams } from '@core/recording';
import { summarizeTrials } from '@core/aggregate';
import type { AnalysisResult } from '@core/types';
import { registry } from './index';
import { speedOfSound } from './resonance/analyze';

function expectOk(r: AnalysisResult) {
  if (!r.ok) throw new Error(`analysis failed: ${r.error}`);
  return r;
}

const pendulum = registry.get('pendulum')!;
const resonance = registry.get('resonance')!;
const centripetal = registry.get('centripetal')!;

describe('registry', () => {
  it('lists all experiments with unique ids', () => {
    expect(registry.list().map((e) => e.id)).toEqual(['pendulum', 'resonance', 'centripetal']);
  });
});

describe('pendulum', () => {
  it('recovers g within 0.5 % from a simulated small swing', () => {
    const r = expectOk(pendulum.analyze(synthPendulum({ length: 1, g: 9.81, theta0: 0.15 })));
    expect(Math.abs(r.primary.measured - 9.81) / 9.81).toBeLessThan(0.005);
    expect(r.primary.uncertainty).toBeGreaterThan(0);
  });

  it('applies the large-amplitude correction', () => {
    const rec = synthPendulum({ length: 0.8, g: 9.81, theta0: 0.6, seed: 7 });
    const r = expectOk(pendulum.analyze(rec));
    // Without the correction a 34° swing reads ~2 % low.
    expect(Math.abs(r.primary.measured - 9.81) / 9.81).toBeLessThan(0.01);
  });

  it('result scales with the entered length (re-analysis with new params)', () => {
    const rec = synthPendulum({ length: 1, g: 9.81 });
    const a = expectOk(pendulum.analyze(rec)).primary.measured;
    const b = expectOk(pendulum.analyze(withParams(rec, { length: 2 }))).primary.measured;
    // g ∝ the physical-pendulum length L + ℓ²/(12L) for a 15 cm phone.
    const leq = (L: number) => L + 0.15 ** 2 / 12 / L;
    expect(b / a).toBeCloseTo(leq(2) / leq(1), 6);
  });

  it('ignores the phone twisting on the string', () => {
    // Twist is 3× stronger than the swing but at a different frequency.
    const rec = synthPendulum({ length: 1, g: 9.81, theta0: 0.15, twist: { amplitude: 1.5, period: 4.7 }, seed: 5 });
    const r = expectOk(pendulum.analyze(rec));
    expect(Math.abs(r.primary.measured - 9.81) / 9.81).toBeLessThan(0.01);
  });

  it('falls back to the accelerometer (tension oscillates twice per swing)', () => {
    const rec = synthPendulum({ length: 0.8, g: 9.81, theta0: 0.3, noGyro: true, seed: 6 });
    const r = expectOk(pendulum.analyze(rec));
    expect(Math.abs(r.primary.measured - 9.81) / 9.81).toBeLessThan(0.02);
    expect(r.warnings.join(' ')).toMatch(/No gyroscope/);
  });

  it('fits T² against L when the length is varied across trials', () => {
    const trials = [0.5, 0.75, 1.0, 1.25].map((L, i) => {
      // A constant 3 cm error in where L is measured from must not affect g.
      const rec = withParams(synthPendulum({ length: L, g: 9.81, theta0: 0.15, seed: 20 + i }), { length: L - 0.03 });
      return { recording: rec, result: expectOk(pendulum.analyze(rec)) };
    });
    const s = expectOk(summarizeTrials(pendulum, trials)!);
    expect(s.primary.quantity).toMatch(/T² vs L/);
    expect(Math.abs(s.primary.measured - 9.81) / 9.81).toBeLessThan(0.01);
  });

  it('averages repeated trials at one length', () => {
    const trials = [1, 2, 3].map((seed) => {
      const rec = synthPendulum({ length: 1, g: 9.81, seed });
      return { recording: rec, result: expectOk(pendulum.analyze(rec)) };
    });
    const s = expectOk(summarizeTrials(pendulum, trials)!);
    expect(s.measurements[0].value).toBe(3);
    expect(Math.abs(s.primary.measured - 9.81) / 9.81).toBeLessThan(0.005);
  });

  it('fails gracefully when the phone is still', () => {
    const rec = synthPendulum({ length: 1, theta0: 0, noise: 0.001 });
    expect(pendulum.analyze(rec).ok).toBe(false);
  });
});

describe('resonance', () => {
  it('measures the speed of sound in a closed tube within 2 %', () => {
    const rec = synthResonance({ length: 0.3, diameter: 0.04, temperature: 22 });
    const r = expectOk(resonance.analyze(rec));
    expect(Math.abs(r.primary.measured - speedOfSound(22)) / speedOfSound(22)).toBeLessThan(0.02);
  });

  it('handles an open tube', () => {
    const rec = synthResonance({ length: 0.25, diameter: 0.045, temperature: 18, mode: 1, seed: 9 });
    const r = expectOk(resonance.analyze(rec));
    expect(Math.abs(r.primary.measured - speedOfSound(18)) / speedOfSound(18)).toBeLessThan(0.02);
  });
});

describe('centripetal', () => {
  it('recovers the radius from the slope of a vs ω²', () => {
    const r = expectOk(centripetal.analyze(synthCentripetal({ radius: 0.3 })));
    expect(Math.abs(r.primary.measured - 30)).toBeLessThan(1);
    expect(r.measurements[0].value).toBeGreaterThan(0.98);
  });

  it('works whichever gyroscope channel carries the spin (iPhone axis labels)', () => {
    // Regression: a real iPhone test reported the spin on gy; gravity then leaked into
    // the "centripetal" axes and gave r = 0.2 cm instead of 25 cm.
    for (const spinChannel of ['gx', 'gy', 'gz'] as const) {
      const rec = synthCentripetal({ radius: 0.25, profile: 'pushed', spinChannel, seed: 8 });
      const r = expectOk(centripetal.analyze(rec));
      expect(Math.abs(r.primary.measured - 25)).toBeLessThan(1); // reported in cm
    }
  });

  it('separates gravity from centripetal acceleration on a tilted seat', () => {
    const r = expectOk(centripetal.analyze(synthCentripetal({ radius: 0.3, tiltDeg: 8, seed: 9 })));
    expect(Math.abs(r.primary.measured - 30)).toBeLessThan(1);
    expect(r.values?.gravity).toBeCloseTo(9.81, 1);
  });

  it('asks for a faster spin when there is not enough data', () => {
    expect(centripetal.analyze(synthCentripetal({ radius: 0.3, omega0: 1 })).ok).toBe(false);
  });
});

describe('recording format', () => {
  it('round-trips through JSON and rejects junk', () => {
    const rec = synthPendulum({ length: 1, seconds: 5 });
    expect(parseRecording(JSON.parse(JSON.stringify(rec)))).toEqual(rec);
    expect(() => parseRecording({ format: 'nope' })).toThrow(/valid PocketLab/);
    expect(() => parseRecording({ ...rec, channels: { a: [1, 2], b: [1] } })).toThrow(/different lengths/);
  });
});
