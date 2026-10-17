import type { ExperimentDefinition, ParamSpec } from './types';

export interface ExperimentRegistry {
  list(): readonly ExperimentDefinition[];
  get(id: string): ExperimentDefinition | undefined;
}

/** Builds an immutable registry, validating plugin definitions up front. */
export function createRegistry(defs: readonly ExperimentDefinition[]): ExperimentRegistry {
  const byId = new Map<string, ExperimentDefinition>();
  for (const def of defs) {
    if (!/^[a-z][a-z0-9-]*$/.test(def.id)) throw new Error(`Invalid experiment id "${def.id}"`);
    if (byId.has(def.id)) throw new Error(`Duplicate experiment id "${def.id}"`);
    const paramIds = new Set<string>();
    for (const p of def.params) {
      if (paramIds.has(p.id)) throw new Error(`${def.id}: duplicate param "${p.id}"`);
      paramIds.add(p.id);
    }
    byId.set(def.id, def);
  }
  const all = Object.freeze([...defs]);
  return { list: () => all, get: (id) => byId.get(id) };
}

export function defaultParams(specs: readonly ParamSpec[]): Record<string, number> {
  return Object.fromEntries(specs.map((p) => [p.id, p.default]));
}

/** Reads a numeric parameter, falling back to the spec default. */
export function readParam(params: Record<string, number>, specs: readonly ParamSpec[], id: string): number {
  const v = params[id];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const spec = specs.find((p) => p.id === id);
  if (!spec) throw new Error(`Unknown parameter "${id}"`);
  return spec.default;
}
