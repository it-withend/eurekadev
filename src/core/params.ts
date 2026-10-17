import type { ParamSpec } from './types';

/**
 * Experiment parameters. Students type values in friendly units (cm),
 * analyses read SI units (m). Everything stored in a Recording is SI.
 */

const scaleOf = (spec: ParamSpec) => (spec.kind === 'number' ? (spec.scale ?? 1) : 1);

/** Removes float noise such as 92.00000000000001 from unit conversion. */
const tidy = (v: number) => Math.round(v * 1e9) / 1e9;

export function toDisplay(spec: ParamSpec, si: number): number {
  return tidy(si / scaleOf(spec));
}

export function fromDisplay(spec: ParamSpec, shown: number): number {
  return tidy(shown * scaleOf(spec));
}

/** SI defaults for every parameter. */
export function defaultParams(specs: readonly ParamSpec[]): Record<string, number> {
  return Object.fromEntries(specs.map((p) => [p.id, fromDisplay(p, p.default)]));
}

/** Reads a parameter in SI units, falling back to the spec default. */
export function readParam(params: Record<string, number>, specs: readonly ParamSpec[], id: string): number {
  const v = params[id];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const spec = specs.find((p) => p.id === id);
  if (!spec) throw new Error(`Unknown parameter "${id}"`);
  return fromDisplay(spec, spec.default);
}

/**
 * Parses what a student typed. Accepts a decimal comma ("0,92") as used on
 * many keyboards outside the English-speaking world. Returns NaN if invalid.
 */
export function parseDecimal(text: string): number {
  const t = text.trim().replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return Number(t);
}

/** Problems with the entered values, keyed by parameter id. Empty = all valid. */
export function validateParams(specs: readonly ParamSpec[], params: Record<string, number>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const p of specs) {
    if (p.kind !== 'number') continue;
    const si = params[p.id];
    if (typeof si !== 'number' || !Number.isFinite(si)) {
      errors[p.id] = 'Enter a number.';
      continue;
    }
    const shown = toDisplay(p, si);
    if (p.min !== undefined && shown < p.min) errors[p.id] = `Must be at least ${p.min} ${p.unit}.`;
    else if (p.max !== undefined && shown > p.max) errors[p.id] = `Must be at most ${p.max} ${p.unit}.`;
  }
  return errors;
}
