import { mean, standardError } from '@dsp/stats';
import type { AnalysisResult, ExperimentDefinition, TrialData } from './types';

/**
 * Default multi-trial summary: mean of the primary quantity. The uncertainty
 * is the larger of the scatter between trials (standard error) and the
 * combined per-trial uncertainty, so two lucky trials cannot look too precise.
 */
export function meanOfTrials(trials: TrialData[]): AnalysisResult {
  const first = trials[0].result.primary;
  const values = trials.map((t) => t.result.primary.measured);
  const n = values.length;
  const m = mean(values);
  const scatter = standardError(values);
  const combined = Math.sqrt(trials.reduce((s, t) => s + t.result.primary.uncertainty ** 2, 0)) / n;
  const uncertainty = Math.max(scatter, combined);
  const idx = values.map((_, i) => i + 1);
  return {
    ok: true,
    primary: { ...first, measured: m, uncertainty },
    measurements: [
      { label: 'Trials combined', value: n, unit: '', digits: 0 },
      { label: 'Spread between trials (std. error)', value: scatter, unit: first.unit, digits: first.digits + 1 },
      { label: 'Combined measurement uncertainty', value: combined, unit: first.unit, digits: first.digits + 1 },
    ],
    charts: [
      {
        title: `${first.symbol} in each trial`,
        xLabel: 'trial',
        yLabel: `${first.symbol} (${first.unit})`,
        series: [
          { name: 'trials', x: idx, y: values, style: 'points', color: 0 },
          { name: 'accepted', x: [0.5, n + 0.5], y: [first.accepted, first.accepted], style: 'line', color: 1 },
          { name: 'mean', x: [0.5, n + 0.5], y: [m, m], style: 'line', color: 2 },
        ],
      },
    ],
    steps: [
      `Mean of ${n} trials: ${first.symbol} = (${values.map((v) => v.toFixed(first.digits)).join(' + ')}) / ${n} = ${m.toFixed(first.digits)} ${first.unit}.`,
      `Standard error from the spread: s/√n = ${scatter.toFixed(first.digits + 1)} ${first.unit}; combined per-trial uncertainty: ${combined.toFixed(first.digits + 1)} ${first.unit}.`,
      `Reported uncertainty is the larger of the two: ±${uncertainty.toFixed(first.digits + 1)} ${first.unit}.`,
    ],
    warnings: n < 3 ? ['Scientists usually repeat a measurement at least 3 times.'] : [],
  };
}

export function summarizeTrials(def: ExperimentDefinition, trials: TrialData[]): AnalysisResult | null {
  if (trials.length < 2) return null;
  try {
    return def.summarize?.(trials) ?? meanOfTrials(trials);
  } catch (e) {
    return { ok: false, error: 'Could not combine the trials.', hint: e instanceof Error ? e.message : String(e) };
  }
}
