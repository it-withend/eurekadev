import { useEffect, useRef, useState } from 'react';
import { defaultParams } from '@core/params';
import { parseRecording } from '@core/recording';
import type { ExperimentDefinition, Recording } from '@core/types';
import { useCapture } from '../hooks/useCapture';
import { useTrials, type TrialOrigin } from '../hooks/useTrials';
import { CaptureOverlay } from '../components/CaptureOverlay';
import { MeasurePanel } from '../components/MeasurePanel';
import { ResultsSection } from '../components/ResultsSection';
import { Worksheet } from '../components/Worksheet';
import { StepBar, StepHeading } from '../components/Steps';
import { href } from '../router';
import { Tour } from '../tour/Tour';
import { EXPERIMENT_TOUR } from '../tour/tours';

async function fetchRecording(path: string): Promise<Recording> {
  const res = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseRecording(await res.json());
}

export function ExperimentPage({ def, demo = false }: { def: ExperimentDefinition; demo?: boolean }) {
  const [params, setParams] = useState(() => defaultParams(def.params));
  const [loadError, setLoadError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const trials = useTrials(def);

  const reveal = () =>
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const accept = (rec: Recording, origin: TrialOrigin) => {
    setLoadError(null);
    trials.add(rec, origin);
    reveal();
  };

  const { state, start, cancel, live } = useCapture(def, (rec) => accept(rec, 'sensor'));

  const loadSamples = async () => {
    try {
      const recs = [...(await Promise.all((def.demoDatasets ?? []).map(fetchRecording))), ...(def.sampleRecordings?.() ?? [])];
      setLoadError(null);
      trials.addMany(recs.map((recording) => ({ recording, origin: 'sample' as const })));
      reveal();
    } catch (e) {
      setLoadError(`Could not load the sample: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Demo link: show a finished analysis straight away (once — reloading must not duplicate samples).
  const demoLoaded = useRef(false);
  useEffect(() => {
    if (!demo || demoLoaded.current) return;
    demoLoaded.current = true;
    if (!trials.trials.some((t) => t.origin === 'sample')) void loadSamples();
    else reveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per demo visit
  }, [demo]);

  const loadFile = async (file: File) => {
    try {
      const rec = parseRecording(JSON.parse(await file.text()));
      if (rec.experimentId !== def.id) throw new Error(`This recording belongs to the "${rec.experimentId}" experiment.`);
      accept(rec, 'file');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <article className="experiment">
      <CaptureOverlay def={def} state={state} live={live} onCancel={cancel} />
      <Tour id="experiment" steps={EXPERIMENT_TOUR} autoStart={!demo} />
      {demo && (
        <p className="demo-banner no-print">
          You are looking at a finished example with simulated sample data. Scroll down to see the results, or{' '}
          <a href={href({ page: 'experiment', id: def.id })}>measure it yourself</a>.
        </p>
      )}

      <a className="back no-print" href={href({ page: 'catalog' })}>
        ← All experiments
      </a>
      <header className="exp-header">
        <p className="eyebrow">{def.subject}</p>
        <h1>{def.title}</h1>
        <p className="lede">{def.tagline}</p>
        {def.custom && (
          <a className="button no-print" href={href({ page: 'create', id: def.id })}>
            ✎ Edit this experiment
          </a>
        )}
        <p className="print-only report-meta">PocketLab lab report · printed {new Date().toLocaleDateString()}</p>
      </header>

      <StepBar current={trials.trials.length ? 'step-results' : 'step-setup'} reached={trials.trials.length ? 'step-results' : 'step-setup'} />

      <div className="exp-grid">
        <section className="panel guide" id="step-setup" data-tour="setup">
          <StepHeading id="step-setup" />
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

        <MeasurePanel
          def={def}
          params={params}
          onParamsChange={setParams}
          capture={state}
          trialCount={trials.trials.length}
          onStart={() => start(params)}
          onLoadSamples={loadSamples}
          onLoadFile={loadFile}
          loadError={loadError}
        />
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

      <div ref={resultsRef} className="results-anchor" id="step-results">
        <ResultsSection
          def={def}
          trials={trials.trials}
          selected={trials.selected}
          summary={trials.summary}
          onSelect={trials.select}
          onRemove={trials.remove}
          onClear={trials.clear}
          onParamsChange={trials.updateParams}
        />
      </div>

      <Worksheet def={def} />
    </article>
  );
}
