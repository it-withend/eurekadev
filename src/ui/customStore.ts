import { useMemo, useSyncExternalStore } from 'react';
import type { ExperimentDefinition } from '@core/types';
import { createRegistry, type ExperimentRegistry } from '@core/registry';
import { registry as builtIn } from '@experiments/index';
import { createCustomExperiment } from '@experiments/custom/factory';
import { newCustomId, parseCustomSpec, type CustomExperimentSpec } from '@experiments/custom/spec';
import { load, save } from './storage';

/** Student-made experiments, kept on this device. A tiny external store so every page stays in sync. */
const KEY = 'pocketlab.custom';
const listeners = new Set<() => void>();

function read(): CustomExperimentSpec[] {
  const raw = load<unknown[]>(KEY, []);
  const out: CustomExperimentSpec[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    try {
      out.push(parseCustomSpec(item));
    } catch {
      // skip corrupted entries rather than breaking the app
    }
  }
  return out;
}

let snapshot = read();

function commit(next: CustomExperimentSpec[]) {
  snapshot = next;
  save(KEY, next);
  listeners.forEach((l) => l());
}

export const customStore = {
  list: () => snapshot,
  get: (id: string) => snapshot.find((s) => s.id === id),
  upsert(spec: CustomExperimentSpec) {
    const exists = snapshot.some((s) => s.id === spec.id);
    commit(exists ? snapshot.map((s) => (s.id === spec.id ? spec : s)) : [...snapshot, spec]);
  },
  remove(id: string) {
    commit(snapshot.filter((s) => s.id !== id));
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useCustomSpecs(): CustomExperimentSpec[] {
  return useSyncExternalStore(customStore.subscribe, customStore.list);
}

/** Built-in plugins plus the student's own, as one registry. */
export function useExperiments(): ExperimentRegistry & { custom: ExperimentDefinition[] } {
  const specs = useCustomSpecs();
  return useMemo(() => {
    const custom = specs.map(createCustomExperiment);
    const all = createRegistry([...builtIn.list(), ...custom]);
    return { ...all, custom };
  }, [specs]);
}

/** Reads a shared experiment file; a clash with an existing id gets a fresh one. */
export async function importExperimentFile(file: File): Promise<CustomExperimentSpec> {
  const spec = parseCustomSpec(JSON.parse(await file.text()));
  if (customStore.get(spec.id)) spec.id = newCustomId(spec.title);
  customStore.upsert(spec);
  return spec;
}
