import { useEffect, useRef, useState } from 'react';
import { defaultParams } from '@core/params';
import { parseRecording } from '@core/recording';
import type { ExperimentDefinition, Recording } from '@core/types';
import { useCapture } from '../hooks/useCapture';
import { useTrials, type TrialOrigin } from '../hooks/useTrials';
import { CaptureOverlay } from '../components/CaptureOverlay';
import { MeasurePanel } from '../components/MeasurePanel';
import { VirtualPanel } from '../components/VirtualPanel';
import { TutorChat } from '../components/TutorChat';
import { tutorContext } from '../tutor';
import { ResultsSection } from '../components/ResultsSection';
import { Worksheet } from '../components/Worksheet';
import { StepBar, StepHeading, StepNav, type StepId } from '../components/Steps';
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
  // Phones start in the real lab, laptops (no motion sensors) in the virtual one.
  const [mode, setMode] = useState<'real' | 'virtual'>(() =>
    def.virtual && !window.matchMedia?.('(pointer: coarse)').matches ? 'virtual' : 'real',
  );
  const [step, setStep] = useState<StepId>(() => (demo ? 'step-results' : 'step-setup'));
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorQuestion, setTutorQuestion] = useState<string | null>(null);
  const trials = useTrials(def);

  const go = (next: StepId) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // A new result is the reward for the work: show it right away.
  const reveal = () => go('step-results');
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

  const hidden = (id: StepId) => (step === id ? '' : ' step-hidden');

  return (
    <article className="experiment">
      <CaptureOverlay def={def} state={state} live={live} onCancel={cancel} />
      <Tour id="experiment" steps={EXPERIMENT_TOUR} autoStart={!demo} />
      {demo && (
        <p className="demo-banner no-print">
          This is a finished example with simulated sample data.{' '}
          <a href={href({ page: 'experiment', id: def.id })}>Measure it yourself</a>
        </p>
      )}

      <header className="exp-header">
        <a className="back no-print" href={href({ page: 'catalog' })}>
          All experiments
        </a>
        <div className="exp-title">
          <span className="exp-icon" aria-hidden="true">
            {def.icon ?? '🧪'}
          </span>
          <div>
            <p className="eyebrow">{def.subject}</p>
            <h1>{def.title}</h1>
          </div>
        </div>
        <p className="lede">{def.tagline}</p>
        {def.custom && (
          <a className="button no-print" href={href({ page: 'create', id: def.id })}>
            Edit this experiment
          </a>
        )}
        <p className="print-only report-meta">PocketLab lab report, printed {new Date().toLocaleDateString()}</p>
      </header>

      <StepBar current={step} onSelect={go} count={trials.trials.length} />

      <section className={`step-page setup-page${hidden('step-setup')}`} id="step-setup" data-tour="setup">
        <div className="panel guide">
          <StepHeading id="step-setup">What you need and what to do</StepHeading>
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
        </div>
        <div className="panel physics">
          <h2>The physics behind it</h2>
          <p>{def.theory.summary}</p>
          <code className="formula">{def.theory.formula}</code>
          {def.takeaways && def.takeaways.length > 0 && (
            <>
              <h3>You will find out that</h3>
              <ul>
                {def.takeaways.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section className={`step-page${hidden('step-measure')}`}>
        {def.virtual && (
          <div className="mode-switch no-print" role="tablist" aria-label="Lab mode" data-tour="mode">
            <button role="tab" aria-selected={mode === 'real'} className={mode === 'real' ? 'on' : ''} onClick={() => setMode('real')}>
              📱 Real lab
              <small>Measure with your phone’s sensors</small>
            </button>
            <button role="tab" aria-selected={mode === 'virtual'} className={mode === 'virtual' ? 'on' : ''} onClick={() => setMode('virtual')}>
              🖥 Virtual lab
              <small>Practise with a simulation</small>
            </button>
          </div>
        )}
        {mode === 'virtual' && def.virtual ? (
          <VirtualPanel def={def} params={params} onParamsChange={setParams} onResult={(rec) => accept(rec, 'virtual')} />
        ) : (
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
        )}
      </section>

      <section className={`step-page${hidden('step-results')}`} id="step-results">
        {trials.trials.length === 0 ? (
          <div className="empty no-print">
            <h2>No results yet</h2>
            <p>Record a trial in the Measure step — with your phone, in the virtual lab, or from sample data.</p>
            <button className="primary" onClick={() => go('step-measure')}>
              Go to Measure
            </button>
          </div>
        ) : (
          <ResultsSection
            def={def}
            trials={trials.trials}
            selected={trials.selected}
            summary={trials.summary}
            onSelect={trials.select}
            onRemove={trials.remove}
            onClear={trials.clear}
            onParamsChange={trials.updateParams}
            onAsk={() => {
              setTutorQuestion('Explain my result in simple words');
              setTutorOpen(true);
            }}
          />
        )}
      </section>

      <section className={`step-page${hidden('step-report')}`}>
        <Worksheet def={def} />
      </section>

      <StepNav current={step} onSelect={go} />

      {!tutorOpen && (
        <button className="tutor-fab no-print" data-tour="tutor" onClick={() => setTutorOpen(true)}>
          🤖 Ask the AI tutor
        </button>
      )}
      <TutorChat
        open={tutorOpen}
        onClose={() => setTutorOpen(false)}
        initialQuestion={tutorQuestion}
        context={() =>
          tutorContext(def, {
            params,
            result: trials.selected?.result,
            summary: trials.summary,
            trials: trials.trials.length,
          })
        }
      />
    </article>
  );
}
