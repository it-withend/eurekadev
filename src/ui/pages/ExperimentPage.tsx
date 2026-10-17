import { useMemo, useRef, useState } from 'react';
import { defaultParams } from '@core/registry';
import { durationOf, parseRecording, recordingToCsv, withParams } from '@core/recording';
import type { AnalysisResult, ExperimentDefinition, Recording } from '@core/types';
import { useCapture } from '../hooks/useCapture';
import { LiveChart } from '../components/LiveChart';
import { ParamForm } from '../components/ParamForm';
import { ResultView } from '../components/ResultView';
import { downloadText } from '../download';
import { href } from '../router';

type Origin = 'sensor' | 'sample' | 'file';

function safeAnalyze(def: ExperimentDefinition, rec: Recording): AnalysisResult {
  try {
    return def.analyze(rec);
  } catch (e) {
    return { ok: false, error: 'Analysis failed unexpectedly.', hint: e instanceof Error ? e.message : String(e) };
  }
}

export function ExperimentPage({ def }: { def: ExperimentDefinition }) {
  const [params, setParams] = useState(() => defaultParams(def.params));
  const [recording, setRecording] = useState<Recording | null>(null);
  const [origin, setOrigin] = useState<Origin>('sensor');
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const accept = (rec: Recording, from: Origin) => {
    setLoadError(null);
    setRecording(rec);
    setOrigin(from);
    if (from !== 'sensor') setParams({ ...defaultParams(def.params), ...rec.params });
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const { state, start, cancel, live } = useCapture(def, (rec) => accept(rec, 'sensor'));
  const busy = state.phase === 'preparing' || state.phase === 'countdown' || state.phase === 'recording';

  // Analysis is a pure function of (recording, params): editing a parameter
  // re-runs it instantly, so students can see how each input matters.
  const result = useMemo(
    () => (recording ? safeAnalyze(def, withParams(recording, params)) : null),
    [def, recording, params],
  );

  const loadSample = async () => {
    if (!def.demoDataset) return;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${def.demoDataset}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      accept(parseRecording(await res.json()), 'sample');
    } catch (e) {
      setLoadError(`Could not load the sample: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const loadFile = async (file: File) => {
    try {
      const rec = parseRecording(JSON.parse(await file.text()));
      if (rec.experimentId !== def.id) throw new Error(`this recording belongs to "${rec.experimentId}"`);
      accept(rec, 'file');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  const stamp = recording ? recording.startedAt.slice(0, 19).replace(/[:T]/g, '-') : '';

  return (
    <article className="experiment">
      <a className="back no-print" href={href({ page: 'catalog' })}>
        ← All experiments
      </a>
      <header className="exp-header">
        <p className="eyebrow">{def.subject}</p>
        <h1>{def.title}</h1>
        <p className="lede">{def.tagline}</p>
        <p className="print-only report-meta">
          PocketLab lab report · {recording ? new Date(recording.startedAt).toLocaleString() : ''} ·{' '}
          {origin === 'sensor' ? 'measured with phone sensors' : recording?.meta?.synthetic ? 'simulated sample data' : 'loaded recording'}
        </p>
      </header>

      <div className="exp-grid">
        <section className="panel theory">
          <h2>The physics</h2>
          <p>{def.theory.summary}</p>
          <code className="formula">{def.theory.formula}</code>
          <h3>You need</h3>
          <ul>
            {def.materials.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <h3 className="no-print">Procedure</h3>
          <ol className="no-print">
            {def.instructions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>

        <section className="panel setup">
          <h2>Setup</h2>
          <ParamForm specs={def.params} values={params} onChange={setParams} disabled={busy} />

          <div className="actions no-print">
            {!busy ? (
              <button className="primary" onClick={() => start(params)}>
                Start measurement · {def.durationSec} s
              </button>
            ) : (
              <button onClick={cancel}>Cancel</button>
            )}
            <button onClick={loadSample} disabled={busy || !def.demoDataset}>
              Try sample data
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

          {state.phase === 'preparing' && <p className="status">Waiting for sensor permission…</p>}
          {state.phase === 'countdown' && (
            <p className="status countdown" aria-live="assertive">
              Get ready… <strong>{state.remaining}</strong>
            </p>
          )}
          {state.phase === 'recording' && (
            <div className="recording" aria-live="polite">
              <div className="status">
                <span className="rec-dot" /> Recording {state.elapsed.toFixed(1)} / {def.durationSec} s
              </div>
              <progress max={def.durationSec} value={state.elapsed} />
              <LiveChart buffer={live} label={def.previewLabel} />
            </div>
          )}
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

      <div ref={resultsRef} className="results-anchor">
        {recording && result && (
          <section className="results">
            <div className="results-bar">
              <h2>Results</h2>
              <span className="tag">
                {origin === 'sample' && recording.meta?.synthetic ? 'Sample data (simulated)' : origin === 'file' ? 'Loaded recording' : 'Your measurement'}
                {' · '}
                {durationOf(recording).toFixed(1)} s @ {Math.round(recording.sampleRate)} Hz
              </span>
              <span className="spacer" />
              <span className="no-print bar-actions">
                <button onClick={() => window.print()}>Lab report (PDF)</button>
                <button onClick={() => downloadText(`pocketlab-${def.id}-${stamp}.json`, JSON.stringify(recording))}>Save recording</button>
                <button onClick={() => downloadText(`pocketlab-${def.id}-${stamp}.csv`, recordingToCsv(recording), 'text/csv')}>CSV</button>
              </span>
            </div>
            {result.ok ? (
              <ResultView result={result} />
            ) : (
              <div className="error" role="alert">
                <strong>{result.error}</strong>
                {result.hint && <p>{result.hint}</p>}
              </div>
            )}
          </section>
        )}
      </div>
    </article>
  );
}
