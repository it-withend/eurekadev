import type { ExperimentRegistry } from '@core/registry';
import { href } from '../router';

const SENSOR_LABEL = { motion: 'Accelerometer + gyroscope', audio: 'Microphone' } as const;

export function CatalogPage({ registry }: { registry: ExperimentRegistry }) {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">A physics lab that fits in every pocket</p>
        <h1>
          Your phone already has a lab’s worth of sensors.
          <br />
          <em>PocketLab turns them into real experiments.</em>
        </h1>
        <p className="lede">
          Measure gravity, the speed of sound and circular motion with nothing but a phone and household items. Signal
          processing runs right in the browser, every step of the calculation is shown, and you get a lab report at the end.
          No equipment, no install, no account.
        </p>
      </section>

      <section className="catalog" aria-label="Experiments">
        {registry.list().map((e, i) => (
          <a key={e.id} className="card" href={href({ page: 'experiment', id: e.id })}>
            <span className="card-no">{String(i + 1).padStart(2, '0')}</span>
            <span className="card-subject">{e.subject}</span>
            <h2>{e.title}</h2>
            <p>{e.tagline}</p>
            <code className="card-formula">{e.theory.formula}</code>
            <span className="card-meta">
              {SENSOR_LABEL[e.sensor]} · {e.durationSec} s
            </span>
          </a>
        ))}
      </section>

      <section className="note">
        <p>
          <strong>On a phone?</strong> Start with the <a href={href({ page: 'sensors' })}>sensor check</a> to see which
          experiments your device supports. <strong>On a laptop?</strong> Every experiment ships with sample recordings:
          open one and press <em>Try sample data</em> to see the full analysis.
        </p>
      </section>
    </>
  );
}
