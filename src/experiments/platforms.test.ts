/**
 * Compatibility matrix: every experiment × every simulated phone platform.
 * This is the automated half of device testing; the other half (real phones)
 * is tracked in docs/COMPATIBILITY.md.
 */
import { describe, expect, it } from 'vitest';
import { AUDIO_RATES, captureAudio, captureOnPlatform, MOTION_PLATFORMS } from '@testing/platforms';
import { synthCentripetal, synthPendulum, synthResonance } from '@testing/synthetic';
import { speedOfSound } from './resonance/analyze';
import { registry } from './index';

const pendulum = registry.get('pendulum')!;
const centripetal = registry.get('centripetal')!;
const resonance = registry.get('resonance')!;

const TRUTH_RATE = 400;
const pendulumTruth = synthPendulum({ length: 0.9, g: 9.81, theta0: 0.2, sampleRate: TRUTH_RATE, seed: 31 });
const chairTruth = synthCentripetal({ radius: 0.25, sampleRate: TRUTH_RATE, profile: 'pushed', seconds: 18, seed: 32 });

describe.each(MOTION_PLATFORMS)('$name', (platform) => {
  it('pendulum measures g within 1.5 %', () => {
    const r = pendulum.analyze(captureOnPlatform(pendulumTruth, platform, 7));
    if (!r.ok) throw new Error(r.error);
    expect(Math.abs(r.primary.measured - 9.81) / 9.81).toBeLessThan(0.015);
  });

  it(platform.noGyroscope ? 'spinning chair explains that a gyroscope is needed' : 'spinning chair measures r within 1.5 cm', () => {
    const r = centripetal.analyze(captureOnPlatform(chairTruth, platform, 8));
    if (platform.noGyroscope) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/gyroscope/);
      return;
    }
    if (!r.ok) throw new Error(r.error);
    expect(Math.abs(r.primary.measured - 25)).toBeLessThan(1.5);
  });
});

describe.each(AUDIO_RATES)('microphone at %i Hz', (rate) => {
  it('singing tube measures the speed of sound within 2 %', () => {
    const truth = synthResonance({ length: 0.28, diameter: 0.05, temperature: 22, sampleRate: rate, seed: 33 });
    const r = resonance.analyze(captureAudio(truth));
    if (!r.ok) throw new Error(r.error);
    expect(Math.abs(r.primary.measured - speedOfSound(22)) / speedOfSound(22)).toBeLessThan(0.02);
  });
});

describe('sensor stream edge cases', () => {
  it('rejects a sensor that is throttled too far to time oscillations', () => {
    expect(() => captureOnPlatform(pendulumTruth, { name: 'background tab', rate: 5, jitter: 0 })).toThrow(/readings per second/);
  });
});
