import { describe, expect, it } from 'vitest';
import { createRegistry } from '@core/registry';
import { synthGenericMotion, synthTone } from '@testing/synthetic';
import { createCustomExperiment, substitute } from './factory';
import { parseCustomSpec, validateSpec } from './spec';
import { fromTemplate, TEMPLATES } from './templates';
import type { CustomExperimentSpec } from './spec';

const template = (key: string) => fromTemplate(TEMPLATES.find((t) => t.key === key)!.spec);
const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r as Extract<T, { ok: true }>;
};

describe('student-made experiments', () => {
  it('every template (except the blank one) is valid and builds a plugin', () => {
    for (const t of TEMPLATES.filter((t) => t.key !== 'blank')) {
      const spec = fromTemplate(t.spec);
      expect(validateSpec(spec), t.key).toEqual({});
      const def = createCustomExperiment(spec);
      expect(() => createRegistry([def])).not.toThrow();
    }
  });

  it('spring template: k = 4π²m/T² from a simulated bounce', () => {
    const def = createCustomExperiment(template('spring'));
    const rec = { ...synthGenericMotion({ kind: 'oscillation', value: 0.6 }), params: { m: 0.2 } };
    const r = ok(def.analyze(rec));
    const k = (4 * Math.PI ** 2 * 0.2) / 0.6 ** 2;
    expect(Math.abs(r.primary.measured - k) / k).toBeLessThan(0.01);
    expect(r.primary.uncertainty).toBeGreaterThan(0);
    // m is known to ±5 g out of 200 g, so it must dominate the uncertainty.
    expect(r.steps.join(' ')).toMatch(/biggest share comes from m/);
  });

  it('note template: pitch compared with A4', () => {
    const r = ok(createCustomExperiment(template('note')).analyze(synthTone({ frequency: 438 })));
    expect(r.primary.measured).toBeCloseTo(438, 0);
    expect(r.primary.accepted).toBe(440);
  });

  it('jump and turntable templates', () => {
    const jump = ok(createCustomExperiment(template('jump')).analyze(synthGenericMotion({ kind: 'jolt', value: 19.62 })));
    expect(jump.primary.measured).toBeCloseTo(2, 1);
    const spin = ok(createCustomExperiment(template('turntable')).analyze(synthGenericMotion({ kind: 'spin', value: (33.3 * 2 * Math.PI) / 60 })));
    expect(spin.primary.measured).toBeCloseTo(33.3, 0);
  });

  it('jump: noise is measured on the quiet part, not on the jump itself (iPhone 12 Pro regression)', () => {
    // A real recording gave 3.8 ± 0.4 g, "too uncertain", because the noise estimate included the jump.
    const rec = synthGenericMotion({ kind: 'jolt', value: 37, realisticJump: true, seconds: 6 });
    const r = ok(createCustomExperiment(template('jump')).analyze(rec));
    expect(r.primary.measured).toBeCloseTo(37 / 9.81, 1);
    expect(r.primary.uncertainty / r.primary.measured).toBeLessThan(0.06);
  });

  it('sample recordings of every template analyse successfully', () => {
    for (const t of TEMPLATES.filter((t) => t.key !== 'blank')) {
      const def = createCustomExperiment(fromTemplate(t.spec));
      for (const rec of def.sampleRecordings!()) expect(def.analyze(rec).ok, t.key).toBe(true);
    }
  });

  it('reports student mistakes per field', () => {
    const spec: CustomExperimentSpec = {
      ...template('spring'),
      title: ' ',
      formula: '4*pi^2*mass/T^2',
      variables: [
        { symbol: 'T', label: 'clash', unit: '', value: 1, uncertainty: 0 },
        { symbol: 'pi', label: 'reserved', unit: '', value: 1, uncertainty: 0 },
        { symbol: '2x', label: '', unit: '', value: NaN, uncertainty: -1 },
      ],
    };
    const e = validateSpec(spec);
    expect(e.title).toBeDefined();
    expect(e['variables.0.symbol']).toMatch(/already the measured period/);
    expect(e['variables.1.symbol']).toMatch(/reserved/);
    expect(e['variables.2.symbol']).toMatch(/start with a letter/);
    expect(e['variables.2.value']).toBeDefined();
    expect(e['variables.2.uncertainty']).toBeDefined();
    expect(e.formula).toMatch(/"mass" is not defined/);
  });

  it('round-trips through a shared file and rejects tampered ones', () => {
    const spec = template('spring');
    expect(parseCustomSpec(JSON.parse(JSON.stringify(spec)))).toEqual(spec);
    expect(() => parseCustomSpec({ format: 'nope' })).toThrow(/not a PocketLab experiment/);
    expect(() => parseCustomSpec({ ...spec, formula: 'alert(1)' })).toThrow(/problem/);
    expect(parseCustomSpec({ ...spec, id: '../../evil' }).id).toMatch(/^my-/);
  });

  it('shows the substituted formula readably', () => {
    expect(substitute('4π²m/T²', { m: 0.2, T: 1.5 }, 2)).toBe('4π²·0.20/1.50²');
    expect(substitute('4*pi^2*m/T^2', { m: 0.2, T: 1.5 }, 2)).toBe('4*pi^2*0.20/1.50^2');
  });

  it('a division by zero gives a helpful error, not NaN', () => {
    const spec = { ...template('spring'), formula: 'm/(T-T)' };
    const r = createCustomExperiment(spec).analyze({ ...synthGenericMotion({ kind: 'oscillation', value: 0.6 }), params: { m: 0.2 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hint).toMatch(/division by zero/);
  });
});
