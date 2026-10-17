import { useEffect, useMemo, useState } from 'react';
import { summarizeTrials } from '@core/aggregate';
import { parseRecording } from '@core/recording';
import type { AnalysisResult, ExperimentDefinition, Recording, TrialData } from '@core/types';
import { load, saveList } from '../storage';

export type TrialOrigin = 'sensor' | 'sample' | 'file';

export interface Trial {
  id: string;
  origin: TrialOrigin;
  recording: Recording;
}

export interface AnalyzedTrial extends Trial {
  number: number;
  result: AnalysisResult;
}

const MAX_TRIALS = 12;

function safeAnalyze(def: ExperimentDefinition, rec: Recording): AnalysisResult {
  try {
    return def.analyze(rec);
  } catch (e) {
    return { ok: false, error: 'Analysis failed unexpectedly.', hint: e instanceof Error ? e.message : String(e) };
  }
}

function restore(def: ExperimentDefinition): Trial[] {
  const raw = load<Trial[]>(`pocketlab.trials.${def.id}`, []);
  const valid: Trial[] = [];
  for (const t of Array.isArray(raw) ? raw : []) {
    try {
      valid.push({ ...t, recording: parseRecording(t.recording) });
    } catch {
      // skip corrupted entries
    }
  }
  return valid;
}

/** All trials of one experiment, persisted on the device, analysed and summarised. */
export function useTrials(def: ExperimentDefinition) {
  const [trials, setTrials] = useState<Trial[]>(() => restore(def));
  const [selectedId, setSelectedId] = useState<string | null>(() => trials[trials.length - 1]?.id ?? null);

  useEffect(() => saveList(`pocketlab.trials.${def.id}`, trials), [def.id, trials]);

  const analyzed = useMemo<AnalyzedTrial[]>(
    () => trials.map((t, i) => ({ ...t, number: i + 1, result: safeAnalyze(def, t.recording) })),
    [def, trials],
  );

  const summary = useMemo(() => {
    const ok: TrialData[] = analyzed.flatMap((t) => (t.result.ok ? [{ recording: t.recording, result: t.result }] : []));
    return summarizeTrials(def, ok);
  }, [def, analyzed]);

  const add = (recording: Recording, origin: TrialOrigin) => {
    const trial: Trial = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, origin, recording };
    setTrials((prev) => [...prev, trial].slice(-MAX_TRIALS));
    setSelectedId(trial.id);
    return trial;
  };

  const addMany = (items: { recording: Recording; origin: TrialOrigin }[]) => {
    const created = items.map((it, i) => ({ id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`, ...it }));
    setTrials((prev) => [...prev, ...created].slice(-MAX_TRIALS));
    setSelectedId(created[created.length - 1]?.id ?? null);
  };

  const remove = (id: string) => {
    setTrials((prev) => prev.filter((t) => t.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const clear = () => {
    setTrials([]);
    setSelectedId(null);
  };

  const selected = analyzed.find((t) => t.id === selectedId) ?? analyzed[analyzed.length - 1] ?? null;

  return { trials: analyzed, selected, select: setSelectedId, summary, add, addMany, remove, clear };
}
