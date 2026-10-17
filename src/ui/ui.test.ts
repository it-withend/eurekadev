import { describe, expect, it } from 'vitest';
import type { Comparison } from '@core/types';
import { niceTicks } from './components/chartDraw';
import { href, parseHash } from './router';
import { agreement, explain } from './verdict';

describe('router', () => {
  it('round-trips every route through the URL hash', () => {
    for (const r of [{ page: 'catalog' }, { page: 'about' }, { page: 'sensors' }, { page: 'experiment', id: 'pendulum' }] as const) {
      expect(parseHash(href(r))).toEqual(r);
    }
    expect(parseHash('#/nonsense')).toEqual({ page: 'catalog' });
    expect(parseHash('')).toEqual({ page: 'catalog' });
  });
});

describe('chart ticks', () => {
  it('produces round 1-2-5 steps covering the range', () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(9.7, 9.9, 4)).toEqual([9.7, 9.75, 9.8, 9.85, 9.9]);
    expect(niceTicks(-1, 1, 4)).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(niceTicks(NaN, 1)).toEqual([]);
  });
});

describe('verdict', () => {
  const c = (measured: number, uncertainty: number): Comparison => ({
    quantity: 'g', symbol: 'g', measured, uncertainty, accepted: 9.81, acceptedSource: '', unit: 'm/s²', digits: 2,
  });

  it('agrees within 2σ, is "close" within 5 %, otherwise "off"', () => {
    expect(agreement(c(9.9, 0.05)).verdict).toBe('agrees');
    expect(agreement(c(9.9, 0.01)).verdict).toBe('close');
    expect(agreement(c(12, 0.1)).verdict).toBe('off');
  });

  it('counts the uncertainty of the reference (a ruler reading) too', () => {
    // 27.0 ± 0.03 cm vs a ruler reading 27.3 ± 0.5 cm: consistent.
    const ruler: Comparison = { ...c(27.0, 0.03), accepted: 27.3, acceptedUncertainty: 0.5 };
    expect(agreement(ruler).verdict).toBe('agrees');
    expect(agreement({ ...ruler, acceptedUncertainty: 0 }).verdict).toBe('close');
  });

  it('never praises a result whose uncertainty is huge', () => {
    // 14 ± 22 is "within 2σ" of 9.81 but measures nothing.
    expect(agreement(c(14.4, 22.3)).verdict).toBe('imprecise');
    expect(explain(c(14.4, 22.3))).not.toMatch(/Great work/);
  });

  it('explains in plain words and spots cm/m mix-ups', () => {
    expect(explain(c(9.85, 0.05))).toMatch(/confirms it/);
    expect(explain(c(981, 5))).toMatch(/cm vs m/);
    expect(explain(c(12, 0.1))).not.toMatch(/cm vs m/);
  });
});
