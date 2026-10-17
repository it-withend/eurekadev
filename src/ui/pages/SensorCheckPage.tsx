import { useEffect, useRef, useState } from 'react';
import { createSensor, SensorError, type SensorSource } from '@core/sensors';
import type { SensorKind } from '@core/types';
import { LiveChart } from '../components/LiveChart';
import type { LiveBuffer } from '../hooks/useCapture';

const INFO: Record<SensorKind, { title: string; what: string; preview: (s: Record<string, number>) => number; label: string }> = {
  motion: {
    title: 'Accelerometer + gyroscope',
    what: 'Used by the pendulum and spinning-chair experiments. Tilt or shake the phone: the numbers should change.',
    preview: (s) => Math.hypot(s.ax, s.ay, s.az),
    label: '|a| (m/s²)',
  },
  audio: {
    title: 'Microphone',
    what: 'Used by the singing-tube experiment. Talk or clap: the level should jump.',
    preview: (s) => s.rms,
    label: 'loudness (RMS)',
  },
};

type Status = { state: 'idle' } | { state: 'running'; rate: number; values: Record<string, number> } | { state: 'error'; message: string; hint?: string };

function SensorCard({ kind }: { kind: SensorKind }) {
  const info = INFO[kind];
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const sensor = useRef<SensorSource | null>(null);
  const live = useRef<LiveBuffer>({ t: [], v: [] });
  const timer = useRef(0);

  const stop = () => {
    window.clearInterval(timer.current);
    sensor.current?.dispose();
    sensor.current = null;
  };
  useEffect(() => stop, []);

  const run = () => {
    const s = createSensor(kind);
    sensor.current = s;
    s.prepare().then(
      () => {
        const t0 = performance.now();
        let count = 0;
        let latest: Record<string, number> = {};
        live.current = { t: [], v: [] };
        s.start((sample) => {
          count++;
          latest = sample;
          live.current.t.push((performance.now() - t0) / 1000);
          live.current.v.push(info.preview(sample));
        });
        setStatus({ state: 'running', rate: 0, values: {} });
        timer.current = window.setInterval(() => {
          const elapsed = (performance.now() - t0) / 1000;
          if (elapsed > 1.5 && count === 0) {
            stop();
            setStatus({ state: 'error', message: 'No data received from this sensor.', hint: 'Desktop browsers often report sensors that do not exist. Try on a phone.' });
            return;
          }
          setStatus({ state: 'running', rate: count / elapsed, values: latest });
        }, 250);
      },
      (e: unknown) => {
        stop();
        setStatus({
          state: 'error',
          message: e instanceof Error ? e.message : String(e),
          hint: e instanceof SensorError ? e.hint : undefined,
        });
      },
    );
  };

  return (
    <section className="panel sensor-card">
      <h2>{info.title}</h2>
      <p className="hint">{info.what}</p>
      {status.state === 'running' ? (
        <>
          <p className="sensor-ok">
            {status.rate > 0 ? `✓ Working · ${kind === 'motion' ? `${status.rate.toFixed(0)} samples/s` : 'receiving audio'}` : 'Starting…'}
          </p>
          <div className="sensor-values">
            {Object.entries(status.values).map(([k, v]) => (
              <span key={k}>
                <b>{k}</b> {v.toFixed(kind === 'audio' ? 3 : 2)}
              </span>
            ))}
          </div>
          <LiveChart buffer={live} label={info.label} />
          <button
            onClick={() => {
              stop();
              setStatus({ state: 'idle' });
            }}
          >
            Stop
          </button>
        </>
      ) : (
        <>
          {status.state === 'error' && (
            <div className="error" role="alert">
              <strong>{status.message}</strong>
              {status.hint && <p>{status.hint}</p>}
            </div>
          )}
          <button className="primary" onClick={run}>
            Test {kind === 'motion' ? 'motion sensors' : 'microphone'}
          </button>
        </>
      )}
    </section>
  );
}

export function SensorCheckPage() {
  return (
    <article>
      <p className="eyebrow">Before you start</p>
      <h1>Check your phone’s sensors</h1>
      <p className="lede">A ten-second test that tells you which experiments this device can run. Nothing is recorded or sent anywhere.</p>
      <div className="exp-grid sensor-grid">
        <SensorCard kind="motion" />
        <SensorCard kind="audio" />
      </div>
    </article>
  );
}
