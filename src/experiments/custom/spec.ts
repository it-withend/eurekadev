/**
 * A student-made experiment is pure data: what to measure, which variables
 * the student supplies, and a formula. It can be saved, exported and shared
 * as JSON; `createCustomExperiment` turns it into a normal plugin.
 */
import { compileFormula, CONSTANTS, FUNCTION_NAMES } from '@core/expression';
import { MEASURES, type MeasureKind } from './measures';

export interface CustomVariable {
  /** Name used in the formula, e.g. "m". */
  symbol: string;
  label: string;
  unit: string;
  /** Default value, in `unit`. */
  value: number;
  /** How precisely the student knows it (same unit); 0 if exact. */
  uncertainty: number;
}

export interface CustomExperimentSpec {
  format: 'pocketlab.experiment';
  version: 1;
  id: string;
  title: string;
  description: string;
  measure: MeasureKind;
  durationSec: number;
  variables: CustomVariable[];
  /** Empty → the result is the measured quantity itself. */
  formula: string;
  result: { name: string; symbol: string; unit: string; digits: number };
  expected?: { value: number; uncertainty: number; source: string };
  materials: string[];
  instructions: string[];
  /** Key ideas to remember (built-in experiments; optional for student-made ones). */
  takeaways?: string[];
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = new Set([...Object.keys(CONSTANTS), ...FUNCTION_NAMES]);

export function newCustomId(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'experiment';
  return `my-${slug}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Field-level problems a student can fix, keyed by field ("title", "variables.0.symbol", "formula", …). */
export function validateSpec(spec: CustomExperimentSpec): Record<string, string> {
  const errors: Record<string, string> = {};
  const measure = MEASURES[spec.measure];
  if (!spec.title.trim()) errors.title = 'Give your experiment a name.';
  if (!measure) errors.measure = 'Choose what the phone should measure.';
  if (!(spec.durationSec >= 2 && spec.durationSec <= 60)) errors.durationSec = 'Recording time must be 2–60 seconds.';
  const seen = new Set<string>();
  spec.variables.forEach((v, i) => {
    const key = `variables.${i}`;
    if (!IDENT.test(v.symbol)) errors[`${key}.symbol`] = 'Use letters, digits or _ and start with a letter (e.g. m, L, k2).';
    else if (RESERVED.has(v.symbol)) errors[`${key}.symbol`] = `"${v.symbol}" is reserved for a constant or function.`;
    else if (measure && v.symbol === measure.symbol) errors[`${key}.symbol`] = `"${v.symbol}" is already the measured ${measure.quantity.toLowerCase()}.`;
    else if (seen.has(v.symbol)) errors[`${key}.symbol`] = `"${v.symbol}" is used twice.`;
    seen.add(v.symbol);
    if (!v.label.trim()) errors[`${key}.label`] = 'Describe what this is.';
    if (!Number.isFinite(v.value)) errors[`${key}.value`] = 'Enter a number.';
    if (!(v.uncertainty >= 0)) errors[`${key}.uncertainty`] = 'Must be 0 or more.';
  });
  if (measure && spec.formula.trim()) {
    const compiled = compileFormula(spec.formula, [measure.symbol, ...spec.variables.map((v) => v.symbol)]);
    if (!compiled.ok) errors.formula = compiled.error;
  }
  if (!spec.result.name.trim()) errors['result.name'] = 'Name the result (e.g. "Spring constant").';
  if (spec.formula.trim() && !spec.result.symbol.trim()) errors['result.symbol'] = 'Give the result a symbol (e.g. k).';
  if (spec.expected && !Number.isFinite(spec.expected.value)) errors['expected.value'] = 'Enter a number or remove the expected value.';
  return errors;
}

/** Validates an untrusted file (e.g. shared by a classmate). */
export function parseCustomSpec(json: unknown): CustomExperimentSpec {
  const s = json as Partial<CustomExperimentSpec> | null;
  if (!s || s.format !== 'pocketlab.experiment' || s.version !== 1) {
    throw new Error('This is not a PocketLab experiment file.');
  }
  const spec: CustomExperimentSpec = {
    format: 'pocketlab.experiment',
    version: 1,
    id: typeof s.id === 'string' && /^my-[a-z0-9-]+$/.test(s.id) ? s.id : newCustomId(String(s.title ?? '')),
    title: String(s.title ?? '').slice(0, 80),
    description: String(s.description ?? '').slice(0, 400),
    measure: s.measure as MeasureKind,
    durationSec: Number(s.durationSec),
    variables: Array.isArray(s.variables)
      ? s.variables.slice(0, 12).map((v) => ({
          symbol: String(v?.symbol ?? ''),
          label: String(v?.label ?? '').slice(0, 60),
          unit: String(v?.unit ?? '').slice(0, 12),
          value: Number(v?.value),
          uncertainty: Number(v?.uncertainty ?? 0),
        }))
      : [],
    formula: String(s.formula ?? '').slice(0, 200),
    result: {
      name: String(s.result?.name ?? '').slice(0, 60),
      symbol: String(s.result?.symbol ?? '').slice(0, 8),
      unit: String(s.result?.unit ?? '').slice(0, 12),
      digits: Math.min(6, Math.max(0, Math.round(Number(s.result?.digits ?? 3)))),
    },
    ...(s.expected && Number.isFinite(Number(s.expected.value))
      ? { expected: { value: Number(s.expected.value), uncertainty: Math.max(0, Number(s.expected.uncertainty) || 0), source: String(s.expected.source ?? '').slice(0, 80) } }
      : {}),
    ...(Array.isArray(s.takeaways) ? { takeaways: s.takeaways.slice(0, 6).map((t) => String(t).slice(0, 200)) } : {}),
    materials: Array.isArray(s.materials) ? s.materials.slice(0, 12).map((m) => String(m).slice(0, 120)) : [],
    instructions: Array.isArray(s.instructions) ? s.instructions.slice(0, 12).map((m) => String(m).slice(0, 300)) : [],
  };
  const errors = validateSpec(spec);
  const first = Object.values(errors)[0];
  if (first) throw new Error(`The experiment file has a problem: ${first}`);
  return spec;
}
