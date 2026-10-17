import type { ExperimentDefinition } from './types';

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
