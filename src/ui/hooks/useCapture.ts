import { useCallback, useEffect, useRef, useState } from 'react';
import { createRecording } from '@core/recording';
import { createSensor, SensorError, type SensorSource } from '@core/sensors';
import type { ExperimentDefinition, Recording } from '@core/types';

export type CapturePhase =
  | { phase: 'idle' }
  | { phase: 'preparing' }
  | { phase: 'countdown'; remaining: number }
  | { phase: 'recording'; elapsed: number }
  | { phase: 'error'; message: string; hint?: string };

/** Rolling buffer of preview values, read by the live chart every frame. */
export interface LiveBuffer {
  t: number[];
  v: number[];
}

const COUNTDOWN = 3;

/**
 * Drives one measurement: permission → countdown → capture → Recording.
 * All hardware details live in core/sensors; this hook only sequences them.
 */
export function useCapture(def: ExperimentDefinition, onRecorded: (rec: Recording) => void) {
  const [state, setState] = useState<CapturePhase>({ phase: 'idle' });
  const live = useRef<LiveBuffer>({ t: [], v: [] });
  const sensor = useRef<SensorSource | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearInterval(id));
    timers.current = [];
  };

  const cancel = useCallback(() => {
    clearTimers();
    sensor.current?.dispose();
    sensor.current = null;
    setState({ phase: 'idle' });
  }, []);

  useEffect(() => cancel, [cancel]);

  const fail = (e: unknown) => {
    clearTimers();
    sensor.current?.dispose();
    sensor.current = null;
    if (e instanceof SensorError) setState({ phase: 'error', message: e.message, hint: e.hint });
    else setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) });
  };

  const record = (s: SensorSource, params: Record<string, number>) => {
    const startedAt = new Date();
    const t0 = performance.now();
    live.current = { t: [], v: [] };
    s.start((sample) => {
      const buf = live.current;
      buf.t.push((performance.now() - t0) / 1000);
      buf.v.push(def.preview(sample));
      if (buf.t.length > 4000) {
        buf.t.splice(0, 1000);
        buf.v.splice(0, 1000);
      }
    });
    setState({ phase: 'recording', elapsed: 0 });
    const tick = window.setInterval(() => {
      const elapsed = (performance.now() - t0) / 1000;
      if (elapsed < def.durationSec) return setState({ phase: 'recording', elapsed });
      window.clearInterval(tick);
      try {
        const capture = s.stop();
        sensor.current = null;
        setState({ phase: 'idle' });
        onRecorded(
          createRecording({
            experimentId: def.id,
            sensor: def.sensor,
            sampleRate: capture.sampleRate,
            channels: capture.channels,
            params,
            startedAt,
            meta: { device: capture.device },
          }),
        );
      } catch (e) {
        fail(e);
      }
    }, 100);
    timers.current.push(tick);
  };

  /** Must be invoked directly from a click handler (iOS permission prompts). */
  const start = (params: Record<string, number>) => {
    const s = createSensor(def.sensor);
    sensor.current = s;
    setState({ phase: 'preparing' });
    s.prepare().then(() => {
      let remaining = COUNTDOWN;
      setState({ phase: 'countdown', remaining });
      const countdown = window.setInterval(() => {
        remaining -= 1;
        if (remaining > 0) return setState({ phase: 'countdown', remaining });
        window.clearInterval(countdown);
        record(s, params);
      }, 1000);
      timers.current.push(countdown);
    }, fail);
  };

  return { state, start, cancel, live };
}
