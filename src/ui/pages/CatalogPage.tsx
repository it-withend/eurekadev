import { useRef, useState } from 'react';
import type { ExperimentDefinition } from '@core/types';
import { href } from '../router';
import { startTour, Tour } from '../tour/Tour';
import { CATALOG_TOUR } from '../tour/tours';
import { importExperimentFile } from './CreatePage';

const SENSOR_LABEL = { motion: 'Motion sensors', audio: 'Microphone' } as const;

function Card({ e, index }: { e: ExperimentDefinition; index: number }) {
  return (
    <a className={`card${e.custom ? ' custom' : ''}`} href={href({ page: 'experiment', id: e.id })}>
      <span className="card-no">{e.custom ? 'yours' : String(index + 1).padStart(2, '0')}</span>
      <span className="card-subject">{e.subject}</span>
      <h3>{e.title}</h3>
      <p>{e.tagline}</p>
      <code className="card-formula">{e.theory.formula}</code>
      <span className="card-meta">
        {SENSOR_LABEL[e.sensor]} · {e.durationSec} s
      </span>
    </a>
  );
}

export function CatalogPage({ builtIn, custom }: { builtIn: readonly ExperimentDefinition[]; custom: ExperimentDefinition[] }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  return (
    <>
      <Tour id="catalog" steps={CATALOG_TOUR} />
      <section className="hero">
        <p className="eyebrow">A physics lab that fits in every pocket</p>
        <h1>
          Your phone already has a lab’s worth of sensors.
          <br />
          <em>PocketLab turns them into real experiments.</em>
        </h1>
        <p className="lede">
          Measure gravity, the speed of sound and circular motion with nothing but a phone and household items — or design
          your own experiment. No equipment, no install, no account.
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={() => startTour('catalog')}>
            Show me how it works
          </button>
          <a className="button" href={href({ page: 'sensors' })}>
            Check my phone’s sensors
          </a>
        </div>
      </section>

      <ol className="how">
        <li>
          <strong>
            <span className="step-no">1</span>Pick an experiment
          </strong>
          <p>Each one tells you what to gather and exactly what to do.</p>
        </li>
        <li>
          <strong>
            <span className="step-no">2</span>Measure with your phone
          </strong>
          <p>Press Start and follow the beeps. The phone records its sensors.</p>
        </li>
        <li>
          <strong>
            <span className="step-no">3</span>Understand the result
          </strong>
          <p>See your value, how precise it is, and every step of the maths.</p>
        </li>
      </ol>

      <h2 className="section-title">Experiments</h2>
      <section className="catalog" aria-label="Experiments" data-tour="experiments">
        {builtIn.map((e, i) => (
          <Card key={e.id} e={e} index={i} />
        ))}
      </section>

      <h2 className="section-title">Your experiments</h2>
      <section className="catalog" aria-label="Your experiments">
        {custom.map((e, i) => (
          <Card key={e.id} e={e} index={i} />
        ))}
        <div className="card create-card" data-tour="create">
          <span className="template-emoji" aria-hidden="true">
            🧪
          </span>
          <h3>Invent your own</h3>
          <p>Measure a swing, a spring, a guitar string, a jump… with your own formula.</p>
          <a className="button primary" href={href({ page: 'create' })}>
            Create an experiment
          </a>
          <button onClick={() => fileInput.current?.click()}>Open a shared experiment file…</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const spec = await importExperimentFile(file);
                window.location.hash = href({ page: 'experiment', id: spec.id });
              } catch (err) {
                setImportError(err instanceof Error ? err.message : String(err));
              }
            }}
          />
          {importError && <p className="param-error">{importError}</p>}
        </div>
      </section>

      <section className="note">
        <p>
          <strong>On a laptop?</strong> Every experiment has sample data: open one and press <em>Try sample data</em> to see
          the full analysis without a phone.
        </p>
      </section>
    </>
  );
}
