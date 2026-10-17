import { compileFormula, evaluate } from '@core/expression';
import { readParam } from '@core/params';
import type { AnalysisResult, ExperimentDefinition, Measurement, ParamSpec, Recording } from '@core/types';
import { synthGenericMotion, synthTone } from '@testing/synthetic';
import { fmt } from '../shared';
import { MEASURES } from './measures';
import type { CustomExperimentSpec } from './spec';

/** Shows a formula with the student's numbers substituted, e.g. "4·π²·0.2 / 1.42²". */
export function substitute(formula: string, values: Record<string, number>, digits: number): string {
  return formula.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name, offset: number, all: string) => {
    if (!(name in values)) return name;
    const v = values[name];
    const text = Math.abs(v) >= 1e4 || (v !== 0 && Math.abs(v) < 1e-3) ? v.toExponential(3) : v.toFixed(digits);
    // Implicit products ("4π²m") need a visible dot once m becomes a number.
    const before = offset > 0 && /[0-9A-Za-z_²³)π.]/.test(all[offset - 1]) ? '·' : '';
    const after = /^[0-9A-Za-z_(π√]/.test(all.slice(offset + name.length)) ? '·' : '';
    return `${before}${text}${after}`;
  });
}

/**
 * Turns a student's experiment description into a regular plugin. The engine
 * (capture, trials, uncertainty display, report) treats it exactly like the
 * built-in experiments.
 */
export function createCustomExperiment(spec: CustomExperimentSpec): ExperimentDefinition {
  const measure = MEASURES[spec.measure];
  const symbols = [measure.symbol, ...spec.variables.map((v) => v.symbol)];
  const formula = spec.formula.trim() || measure.symbol;
  const compiled = compileFormula(formula, symbols);
  const result = spec.formula.trim()
    ? spec.result
    : { ...spec.result, symbol: spec.result.symbol || measure.symbol, unit: spec.result.unit || measure.unit };

  const params: ParamSpec[] = spec.variables.map((v) => ({
    kind: 'number',
    id: v.symbol,
    label: `${v.label} (${v.symbol})`,
    unit: v.unit,
    default: v.value,
    help: v.uncertainty ? `Known to ± ${v.uncertainty} ${v.unit}.` : undefined,
  }));

  const analyze = (rec: Recording): AnalysisResult => {
    if (!compiled.ok) return { ok: false, error: `The formula has a problem: ${compiled.error}`, hint: 'Edit the experiment to fix it.' };
    const ex = measure.extract(rec);
    if (!ex.ok) return ex;

    const values: Record<string, number> = { [measure.symbol]: ex.value };
    for (const v of spec.variables) values[v.symbol] = readParam(rec.params, params, v.symbol);
    const calc = (vals: Record<string, number>) => evaluate(compiled.node, vals);
    const R = calc(values);
    if (!Number.isFinite(R)) {
      return { ok: false, error: 'The formula did not give a number with these values.', hint: 'Check for division by zero or a square root of a negative number.' };
    }

    // Uncertainty: vary each uncertain input by its ± and see how much the result moves.
    const inputs = [
      { symbol: measure.symbol, delta: ex.uncertainty },
      ...spec.variables.map((v) => ({ symbol: v.symbol, delta: v.uncertainty })),
    ].filter((i) => i.delta > 0);
    const contributions = inputs.map(({ symbol, delta }) => {
      const up = calc({ ...values, [symbol]: values[symbol] + delta });
      const down = calc({ ...values, [symbol]: values[symbol] - delta });
      return { symbol, size: Math.abs(up - down) / 2 };
    });
    const dR = Math.sqrt(contributions.reduce((s, c) => s + c.size ** 2, 0));
    const main = contributions.reduce((a, b) => (b.size > a.size ? b : a), { symbol: '', size: 0 });

    const measurements: Measurement[] = [
      { label: `${measure.quantity} ${measure.symbol}`, value: ex.value, uncertainty: ex.uncertainty, unit: measure.unit, digits: 4 },
      ...ex.measurements,
      ...spec.variables.map((v) => ({ label: `${v.label} ${v.symbol}`, value: values[v.symbol], uncertainty: v.uncertainty || undefined, unit: v.unit, digits: 3 })),
    ];

    const steps = [...ex.steps];
    if (spec.formula.trim()) {
      steps.push(
        `Your formula: ${result.symbol} = ${spec.formula}.`,
        `With your numbers: ${result.symbol} = ${substitute(spec.formula, values, 4)} = ${fmt(R, result.digits)} ${result.unit}.`,
      );
    }
    if (main.symbol) {
      steps.push(
        `Uncertainty: each uncertain input was nudged by its ± and the change in ${result.symbol} combined: ± ${fmt(dR, result.digits)} ${result.unit}. The biggest share comes from ${main.symbol}.`,
      );
    }

    return {
      ok: true,
      primary: {
        quantity: result.name,
        symbol: result.symbol,
        measured: R,
        uncertainty: dR,
        accepted: spec.expected?.value,
        acceptedUncertainty: spec.expected?.uncertainty,
        acceptedSource: spec.expected?.source || 'your expected value',
        unit: result.unit,
        digits: result.digits,
      },
      measurements,
      charts: ex.charts,
      steps,
      warnings: ex.warnings,
      values: { ...values, result: R },
    };
  };

  const sample = (): Recording[] => {
    const seeded = (rec: Recording) => ({
      ...rec,
      experimentId: spec.id,
      params: Object.fromEntries(spec.variables.map((v) => [v.symbol, v.value])),
    });
    switch (measure.id) {
      case 'pitch':
        return [seeded(synthTone({ frequency: measure.example }))];
      case 'peak':
        return [seeded(synthGenericMotion({ kind: 'jolt', value: measure.example }))];
      case 'spin':
        return [seeded(synthGenericMotion({ kind: 'spin', value: measure.example }))];
      default:
        return [seeded(synthGenericMotion({ kind: 'oscillation', value: measure.example }))];
    }
  };

  return {
    id: spec.id,
    custom: true,
    title: spec.title,
    tagline: spec.description || `Measures ${measure.quantity.toLowerCase()}${spec.formula.trim() ? ` and computes ${result.name.toLowerCase()}` : ''}.`,
    subject: 'Your experiment',
    sensor: measure.sensor,
    durationSec: spec.durationSec,
    countdownSec: measure.sensor === 'motion' ? 5 : 3,
    params,
    materials: spec.materials.length ? spec.materials : ['Your phone'],
    instructions: spec.instructions.length ? spec.instructions : [measure.explain],
    theory: {
      summary: `${measure.explain} ${spec.formula.trim() ? `Then your formula turns ${measure.symbol} into ${result.name.toLowerCase()}.` : ''}`,
      formula: spec.formula.trim() ? `${result.symbol} = ${spec.formula}` : `${measure.symbol} (${measure.unit})`,
    },
    sampleRecordings: sample,
    preview: measure.sensor === 'audio' ? (s) => s.rms : (s) => Math.hypot(s.ax, s.ay, s.az),
    previewLabel: measure.sensor === 'audio' ? 'loudness (RMS)' : '|a| (m/s²)',
    analyze,
  };
}
