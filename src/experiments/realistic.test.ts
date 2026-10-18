/**
 * No false alarms: a student who does the experiment correctly, on a real
 * phone with all its everyday imperfections, must be told their result agrees.
 * (Before the fixes this guards, the singing tube said "far from the accepted
 * value" for 1 in 4 correct attempts.)
 */
import { describe, expect, it } from 'vitest';
import { stress } from '../../scripts/stress';

describe('correctly performed experiments with realistic imperfections', () => {
  const summary = stress(20, false);
  it.each(Object.entries(summary))('%s: no errors, no "far off", at least 95 %% agree', (_, counts) => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(counts.failed).toBe(0);
    expect(counts.off).toBe(0);
    expect(counts.imprecise).toBe(0);
    expect(counts.agrees / total).toBeGreaterThanOrEqual(0.95);
  });
});
