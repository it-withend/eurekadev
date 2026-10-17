import { describe, expect, it } from 'vitest';
import { defaultParams, fromDisplay, parseDecimal, readParam, toDisplay, validateParams } from './params';
import { meanOfTrials } from './aggregate';
import { createRegistry } from './registry';
import type { ExperimentDefinition, ParamSpec, SuccessfulAnalysis, TrialData } from './types';

const length: ParamSpec = { kind: 'number', id: 'L', label: 'L', unit: 'cm', scale: 0.01, default: 100, min: 10, max: 500 };
const temp: ParamSpec = { kind: 'number', id: 'T', label: 'T', unit: '°C', default: 20 };

describe('params', () => {
  it('converts between displayed cm and SI metres without float noise', () => {
    expect(fromDisplay(length, 92)).toBe(0.92);
    expect(toDisplay(length, 0.92)).toBe(92);
    expect(toDisplay(temp, 21.5)).toBe(21.5);
    expect(defaultParams([length, temp])).toEqual({ L: 1, T: 20 });
  });

  it('accepts a decimal comma and rejects junk', () => {
    expect(parseDecimal('0,92')).toBe(0.92);
    expect(parseDecimal(' 92.5 ')).toBe(92.5);
    expect(parseDecimal('92.')).toBe(92);
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal('9 2')).toBeNaN();
    expect(parseDecimal('abc')).toBeNaN();
  });

  it('flags empty and out-of-range values in displayed units', () => {
    expect(validateParams([length], { L: 0.92 })).toEqual({});
    expect(validateParams([length], { L: NaN }).L).toMatch(/number/);
    expect(validateParams([length], { L: 0.05 }).L).toMatch(/at least 10 cm/);
    expect(validateParams([length], { L: 92 }).L).toMatch(/at most 500 cm/);
  });

  it('reads SI values and falls back to the default', () => {
    expect(readParam({ L: 0.5 }, [length], 'L')).toBe(0.5);
    expect(readParam({}, [length], 'L')).toBe(1);
    expect(() => readParam({}, [length], 'nope')).toThrow();
  });
});

describe('registry', () => {
  const def = (id: string, params: ParamSpec[] = []) => ({ id, params }) as unknown as ExperimentDefinition;
  it('rejects bad and duplicate ids and duplicate params', () => {
    expect(() => createRegistry([def('Bad Id')])).toThrow(/Invalid/);
    expect(() => createRegistry([def('a'), def('a')])).toThrow(/Duplicate/);
    expect(() => createRegistry([def('a', [temp, temp])])).toThrow(/duplicate param/);
    expect(createRegistry([def('a'), def('b')]).get('b')?.id).toBe('b');
  });
});

describe('meanOfTrials', () => {
  const trial = (measured: number, uncertainty: number): TrialData => ({
    recording: {} as TrialData['recording'],
    result: {
      ok: true,
      primary: { quantity: 'g', symbol: 'g', measured, uncertainty, accepted: 9.81, acceptedSource: '', unit: 'm/s²', digits: 2 },
      measurements: [],
      charts: [],
      steps: [],
      warnings: [],
    } as SuccessfulAnalysis,
  });

  it('averages and reports the larger of scatter and combined uncertainty', () => {
    const r = meanOfTrials([trial(9.7, 0.01), trial(9.9, 0.01), trial(9.8, 0.01)]) as SuccessfulAnalysis;
    expect(r.primary.measured).toBeCloseTo(9.8, 10);
    // Scatter (s/√3 ≈ 0.058) dominates the tiny per-trial uncertainties.
    expect(r.primary.uncertainty).toBeCloseTo(0.1 / Math.sqrt(3), 6);
  });

  it('never claims more precision than the individual trials support', () => {
    const r = meanOfTrials([trial(9.8, 0.2), trial(9.8, 0.2)]) as SuccessfulAnalysis;
    expect(r.primary.uncertainty).toBeCloseTo(Math.sqrt(0.08) / 2, 6);
    expect(r.warnings.join()).toMatch(/at least 3/);
  });
});
