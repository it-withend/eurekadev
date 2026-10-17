import { useRef } from 'react';
import { validateParams } from '@core/params';
import type { ExperimentDefinition } from '@core/types';
import type { CapturePhase } from '../hooks/useCapture';
import { ParamForm } from './ParamForm';

/** Parameters + the ways to get data in: measure, sample data, or a saved file. */
export function MeasurePanel({
  def,
  params,
  onParamsChange,
  capture,
  trialCount,
  onStart,
  onLoadSamples,
  onLoadFile,
  loadError,
}: {
  def: ExperimentDefinition;
  params: Record<string, number>;
  onParamsChange: (p: Record<string, number>) => void;
  capture: CapturePhase;
  trialCount: number;
  onStart: () => void;
  onLoadSamples: () => void;
  onLoadFile: (file: File) => void;
  loadError: string | null;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = capture.phase === 'preparing' || capture.phase === 'countdown' || capture.phase === 'recording';
  const invalid = Object.keys(validateParams(def.params, params)).length > 0;
  const samples = def.demoDatasets?.length ?? 0;

  return (
    <section className="panel measure no-print">
      <h2>Measure</h2>
      <ParamForm specs={def.params} values={params} onChange={onParamsChange} disabled={busy} />
      <div className="actions">
        <button className="primary" onClick={onStart} disabled={busy || invalid}>
          {trialCount ? `Record trial ${trialCount + 1}` : 'Start measurement'} · {def.durationSec} s
        </button>
        {invalid && <p className="param-error">Fix the highlighted values first.</p>}
        <button onClick={onLoadSamples} disabled={busy || !samples}>
          {samples > 1 ? `Try sample data (${samples} trials)` : 'Try sample data'}
        </button>
        <button onClick={() => fileInput.current?.click()} disabled={busy}>
          Open recording…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onLoadFile(file);
            e.target.value = '';
          }}
        />
      </div>
      <p className="hint">
        Results are more trustworthy with several trials.
        {def.summarize && ' Change the length between trials to plot T² against L.'}
      </p>
      {capture.phase === 'error' && (
        <div className="error" role="alert">
          <strong>{capture.message}</strong>
          {capture.hint && <p>{capture.hint}</p>}
        </div>
      )}
      {loadError && (
        <div className="error" role="alert">
          <strong>{loadError}</strong>
        </div>
      )}
    </section>
  );
}
