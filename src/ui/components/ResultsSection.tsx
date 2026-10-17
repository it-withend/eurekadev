import { useState } from 'react';
import { durationOf, recordingToCsv } from '@core/recording';
import type { AnalysisResult, ExperimentDefinition } from '@core/types';
import type { AnalyzedTrial } from '../hooks/useTrials';
import { downloadText } from '../download';
import { ParamForm } from './ParamForm';
import { ResultView } from './ResultView';
import { TrialsTable } from './TrialsTable';
import { StepHeading } from './Steps';

function Failure({ result }: { result: Extract<AnalysisResult, { ok: false }> }) {
  return (
    <div className="error" role="alert">
      <strong>{result.error}</strong>
      {result.hint && <p>{result.hint}</p>}
    </div>
  );
}

const ORIGIN_TEXT = (t: AnalyzedTrial) =>
  t.origin === 'sample' && t.recording.meta?.synthetic
    ? 'sample data (simulated)'
    : t.origin === 'file'
      ? 'loaded recording'
      : 'measured with your phone';

function TrialDetail({
  def,
  trial,
  onParamsChange,
}: {
  def: ExperimentDefinition;
  trial: AnalyzedTrial;
  onParamsChange: (p: Record<string, number>) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="result-block">
      <h3 className="block-title">
        Trial {trial.number}
        <span className="tag">
          {ORIGIN_TEXT(trial)} · {durationOf(trial.recording).toFixed(1)} s ·{' '}
          {/* Show what the hardware delivered, not the rate we resampled to. */}
          {Math.round(trial.recording.meta?.eventRate ?? trial.recording.sampleRate)} Hz
          {trial.recording.sensor === 'motion' ? ' sensor' : ' audio'}
        </span>
        <button className="link no-print" onClick={() => setEditing(!editing)} aria-expanded={editing}>
          {editing ? 'Done' : 'Fix parameters'}
        </button>
      </h3>
      {editing && (
        <div className="panel edit-params no-print">
          <p className="hint">Entered a wrong length, or forgot to? Correct it here — the analysis updates instantly.</p>
          <ParamForm key={trial.id} specs={def.params} values={trial.recording.params} onChange={onParamsChange} />
        </div>
      )}
      {trial.result.ok ? <ResultView result={trial.result} /> : <Failure result={trial.result} />}
    </div>
  );
}

export function ResultsSection({
  def,
  trials,
  selected,
  summary,
  onSelect,
  onRemove,
  onClear,
  onParamsChange,
}: {
  def: ExperimentDefinition;
  trials: AnalyzedTrial[];
  selected: AnalyzedTrial | null;
  summary: AnalysisResult | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onParamsChange: (id: string, p: Record<string, number>) => void;
}) {
  if (trials.length === 0) return null;
  const rec = selected?.recording;
  const stamp = rec ? rec.startedAt.slice(0, 19).replace(/[:T]/g, '-') : '';
  const okCount = trials.filter((t) => t.result.ok).length;

  return (
    <section className="results">
      <div className="results-bar">
        <StepHeading id="step-results" />
        <span className="spacer" />
        <span className="no-print bar-actions">
          <button onClick={() => window.print()}>Lab report (PDF)</button>
          {rec && (
            <>
              <button onClick={() => downloadText(`pocketlab-${def.id}-${stamp}.json`, JSON.stringify(rec))}>
                Save recording
              </button>
              <button onClick={() => downloadText(`pocketlab-${def.id}-${stamp}.csv`, recordingToCsv(rec), 'text/csv')}>
                CSV
              </button>
            </>
          )}
          <button onClick={() => window.confirm('Delete all trials of this experiment?') && onClear()}>Clear all</button>
        </span>
      </div>

      <div className="panel trials-panel" data-tour="trials">
        <h3>Trials</h3>
        <TrialsTable def={def} trials={trials} selectedId={selected?.id ?? null} onSelect={onSelect} onRemove={onRemove} />
      </div>

      {summary && (
        <div className="result-block">
          <h3 className="block-title">Combined result · {okCount} trials</h3>
          {summary.ok ? <ResultView result={summary} /> : <Failure result={summary} />}
        </div>
      )}

      {selected && (
        <TrialDetail
          key={selected.id}
          def={def}
          trial={selected}
          onParamsChange={(p) => onParamsChange(selected.id, p)}
        />
      )}
    </section>
  );
}
