import { useRef, useState } from 'react';
import { defaultParams } from '@core/registry';
import { durationOf, parseRecording, recordingToCsv } from '@core/recording';
import type { ExperimentDefinition, Recording } from '@core/types';
import { useCapture } from '../hooks/useCapture';
import { useTrials, type TrialOrigin } from '../hooks/useTrials';
import { CaptureOverlay } from '../components/CaptureOverlay';
import { ParamForm } from '../components/ParamForm';
import { ResultView } from '../components/ResultView';
import { TrialsTable } from '../components/TrialsTable';
import { Worksheet } from '../components/Worksheet';
import { downloadText } from '../download';
import { href } from '../router';

export function ExperimentPage({ def }: { def: ExperimentDefinition }) {
  const [params, setParams] = useState(() => defaultParams(def.params));
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { trials, selected, select, summary, add, addMany, remove, clear } = useTrials(def);

  const reveal = () => requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const accept = (rec: Recording, origin: TrialOrigin) => {
    setLoadError(null);
    add(rec, origin);
    reveal();
  };

  const { state, start, cancel, live } = useCapture(def, (rec) => accept(rec, 'sensor'));
  const busy = state.phase === 'preparing' || state.phase === 'countdown' || state.phase === 'recording';

  const loadSamples = async () => {
    try {
      const recs = await Promise.all(
        (def.demoDatasets ?? []).map(async (path) => {
          const res = await fetch(`${import.meta.env.BASE_URL}${path}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return parseRecording(await res.json());
        }),
      );
      setLoadError(null);
      addMany(recs.map((recording) => ({ recording, origin: 'sample' as const })));
      reveal();
    } catch (e) {
      setLoadError(`Could not load the sample: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const loadFile = async (file: File) => {
    try {
      const rec = parseRecording(JSON.parse(await file.text()));
      if (rec.experimentId !== def.id) throw new Error(`This recording belongs to the "${rec.experimentId}" experiment.`);
      accept(rec, 'file');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  const rec = selected?.recording;
  const stamp = rec ? rec.startedAt.slice(0, 19).replace(/[:T]/g, '-') : '';
  const sampleCount = def.demoDatasets?.length ?? 0;

  return (
    <article className="experiment">
      <CaptureOverlay def={def} state={state} live={live} onCancel={cancel} />

      <a className="back no-print" href={href({ page: 'catalog' })}>
        ← All experiments
      </a>
      <header className="exp-header">
        <p className="eyebrow">{def.subject}</p>
        <h1>{def.title}</h1>
        <p className="lede">{def.tagline}</p>
        <p className="print-only report-meta">PocketLab lab report · printed {new Date().toLocaleDateString()}</p>
      </header>

      <div className="exp-grid">
        <section className="panel guide">
          {def.illustration && <div className="illustration" dangerouslySetInnerHTML={{ __html: def.illustration }} />}
          <h3>You need</h3>
          <ul>
            {def.materials.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <h3>Procedure</h3>
          <ol className="procedure">
            {def.instructions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>

        <section className="panel measure no-print">
          <h2>Measure</h2>
          <ParamForm specs={def.params} values={params} onChange={setParams} disabled={busy} />
          <div className="actions">
            <button className="primary" onClick={() => start(params)} disabled={busy}>
              {trials.length ? `Record trial ${trials.length + 1}` : 'Start measurement'} · {def.durationSec} s
            </button>
            <button onClick={loadSamples} disabled={busy || !sampleCount}>
              {sampleCount > 1 ? `Try sample data (${sampleCount} trials)` : 'Try sample data'}
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
                if (file) void loadFile(file);
                e.target.value = '';
              }}
            />
          </div>
          <p className="hint">
            Results are more trustworthy with several trials.
            {def.summarize && ' Vary the length between trials to plot T² against L.'}
          </p>
          {state.phase === 'error' && (
            <div className="error" role="alert">
              <strong>{state.message}</strong>
              {state.hint && <p>{state.hint}</p>}
            </div>
          )}
          {loadError && (
            <div className="error" role="alert">
              <strong>{loadError}</strong>
            </div>
          )}
        </section>
      </div>

      <details className="panel physics">
        <summary>
          <h2>The physics behind it</h2>
        </summary>
        <p>{def.theory.summary}</p>
        <code className="formula">{def.theory.formula}</code>
      </details>
      <section className="print-only">
        <h2>Theory</h2>
        <p>{def.theory.summary}</p>
        <code className="formula">{def.theory.formula}</code>
      </section>

      <div ref={resultsRef} className="results-anchor">
        {trials.length > 0 && (
          <section className="results">
            <div className="results-bar">
              <h2>Results</h2>
              <span className="spacer" />
              <span className="no-print bar-actions">
                <button onClick={() => window.print()}>Lab report (PDF)</button>
                {rec && (
                  <>
                    <button onClick={() => downloadText(`pocketlab-${def.id}-${stamp}.json`, JSON.stringify(rec))}>Save recording</button>
                    <button onClick={() => downloadText(`pocketlab-${def.id}-${stamp}.csv`, recordingToCsv(rec), 'text/csv')}>CSV</button>
                  </>
                )}
                <button onClick={() => window.confirm('Delete all trials of this experiment?') && clear()}>Clear all</button>
              </span>
            </div>

            <div className="panel trials-panel">
              <h3>Trials</h3>
              <TrialsTable def={def} trials={trials} selectedId={selected?.id ?? null} onSelect={select} onRemove={remove} />
            </div>

            {summary && (
              <div className="result-block">
                <h3 className="block-title">Combined result · {trials.filter((t) => t.result.ok).length} trials</h3>
                {summary.ok ? (
                  <ResultView result={summary} />
                ) : (
                  <div className="error" role="alert">
                    <strong>{summary.error}</strong>
                    {summary.hint && <p>{summary.hint}</p>}
                  </div>
                )}
              </div>
            )}

            {selected && (
              <div className="result-block">
                <h3 className="block-title">
                  Trial {selected.number}
                  <span className="tag">
                    {selected.origin === 'sample' && selected.recording.meta?.synthetic
                      ? 'sample data (simulated)'
                      : selected.origin === 'file'
                        ? 'loaded recording'
                        : 'measured with your phone'}
                    {' · '}
                    {durationOf(selected.recording).toFixed(1)} s @ {Math.round(selected.recording.sampleRate)} Hz
                  </span>
                </h3>
                {selected.result.ok ? (
                  <ResultView result={selected.result} />
                ) : (
                  <div className="error" role="alert">
                    <strong>{selected.result.error}</strong>
                    {selected.result.hint && <p>{selected.result.hint}</p>}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      <Worksheet def={def} />
    </article>
  );
}
