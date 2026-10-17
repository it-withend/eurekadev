import { describe, expect, it } from 'vitest';
import { compileFormula, evaluate, parseExpression, variablesOf } from './expression';

const calc = (src: string, vars: Record<string, number> = {}) => evaluate(parseExpression(src), vars);

describe('formula language', () => {
  it('respects precedence and associativity', () => {
    expect(calc('1 + 2 * 3')).toBe(7);
    expect(calc('(1 + 2) * 3')).toBe(9);
    expect(calc('2 ^ 3 ^ 2')).toBe(512); // right-associative
    expect(calc('-2 ^ 2')).toBe(-4); // -(2^2)
    expect(calc('2 ^ -1')).toBe(0.5);
    expect(calc('10 / 4 / 5')).toBe(0.5);
    expect(calc('1e3 + .5')).toBe(1000.5);
  });

  it('knows functions and constants', () => {
    expect(calc('sqrt(16) + abs(-2)')).toBe(6);
    expect(calc('max(2, 7)')).toBe(7);
    expect(calc('cos(pi)')).toBeCloseTo(-1, 12);
    expect(calc('ln(e)')).toBeCloseTo(1, 12);
  });

  it('accepts textbook notation', () => {
    // k = 4π²m / T²
    expect(calc('4·π²·m / T²', { m: 0.2, T: 1 })).toBeCloseTo(4 * Math.PI ** 2 * 0.2, 12);
    expect(calc('√(9) × 2 − 1')).toBe(5);
    // Implicit multiplication exactly as in a textbook.
    expect(calc('4π²m/T²', { m: 0.2, T: 1 })).toBeCloseTo(4 * Math.PI ** 2 * 0.2, 12);
    expect(calc('2(x+1)', { x: 2 })).toBe(6);
    expect(calc('2pi')).toBeCloseTo(2 * Math.PI, 12);
    expect(calc('mT', { mT: 3 })).toBe(3); // multi-letter names stay one variable
  });

  it('computes a real experiment formula', () => {
    // Pendulum: g = 4π²L/T²  with L = 1 m, T = 2.006 s
    expect(calc('4*pi^2*L/T^2', { L: 1, T: 2.006 })).toBeCloseTo(9.81, 2);
  });

  it('lists the variables a formula uses', () => {
    expect([...variablesOf(parseExpression('4*pi^2*m/T^2 + sqrt(x)'))].sort()).toEqual(['T', 'm', 'x']);
  });

  it('explains mistakes with a position', () => {
    const cases: [string, RegExp][] = [
      ['', /empty/],
      ['2 +', /ends too early/],
      ['(1 + 2', /Expected "\)"/],
      ['1 + 2)', /Unmatched/],
      ['2 3', /Missing operator/],
      ['foo(2)', /Unknown function/],
      ['max(1)', /takes 2 values/],
      ['2 $ 3', /Unexpected "\$"/],
    ];
    for (const [src, msg] of cases) {
      const r = compileFormula(src, []);
      expect(r.ok, src).toBe(false);
      if (!r.ok) expect(r.error, src).toMatch(msg);
    }
  });

  it('flags variables that are not defined', () => {
    const r = compileFormula('4*pi^2*m/T^2', ['T']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/"m" is not defined/);
    expect(compileFormula('4*pi^2*m/T^2', ['T', 'm']).ok).toBe(true);
  });

  it('cannot execute code', () => {
    expect(compileFormula('alert(1)', []).ok).toBe(false);
    expect(compileFormula('constructor.constructor("x")()', []).ok).toBe(false);
  });
});
