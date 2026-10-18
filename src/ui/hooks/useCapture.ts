import { useCallback, useEffect, useRef, useState } from 'react';
import { createRecording } from '@core/recording';
import { createSensor, SensorError, type SensorSource } from '@core/sensors';
import type { ExperimentDefinition, Recording } from '@core/types';
import { cues, keepAwake, unlockAudio, voice } from '../feedback';
import { capturePrompts } from '../capturePrompts';

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

/**
 * Drives one measurement: permission → countdown → capture → Recording.
 * All hardware details live in core/sensors; this hook only sequences them.
 */
export function useCapture(def: ExperimentDefinition, onRecorded: (rec: Recording) => void) {
  const [state, setState] = useState<CapturePhase>({ phase: 'idle' });
  const live = useRef<LiveBuffer>({ t: [], v: [] });
  const sensor = useRef<SensorSource | null>(null);
  const timers = useRef<number[]>([]);
  const releaseWakeLock = useRef<() => void>(() => undefined);

  const teardown = useCallback(() => {
    voice.stop();
    timers.current.forEach((id) => window.clearInterval(id));
    timers.current = [];
    sensor.current?.dispose();
    sensor.current = null;
    releaseWakeLock.current();
    releaseWakeLock.current = () => undefined;
  }, []);

  const cancel = useCallback(() => {
    teardown();
    setState({ phase: 'idle' });
  }, [teardown]);

  useEffect(() => teardown, [teardown]);

  // Phones pause sensors in background tabs: switching apps mid-measurement
  // would silently produce a broken recording, so abort with an explanation.
  const active = state.phase === 'countdown' || state.phase === 'recording';
  useEffect(() => {
    if (!active) return;
    const onHide = () => {
      if (!document.hidden) return;
      teardown();
      setState({
        phase: 'error',
        message: 'Measurement stopped because the app went to the background.',
        hint: 'Keep PocketLab open on screen until the double beep.',
      });
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [active, teardown]);

  const fail = (e: unknown) => {
    teardown();
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
        teardown();
        cues.stop();
        voice.say('Done. Your result is ready.');
        setState({ phase: 'idle' });
        onRecorded(
          createRecording({
            experimentId: def.id,
            sensor: def.sensor,
            sampleRate: capture.sampleRate,
            channels: capture.channels,
            params,
            startedAt,
            meta: { device: capture.device, ...capture.meta },
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
    unlockAudio();
    // Spoken inside the tap: this also unlocks speech on iOS for the rest of the measurement.
    voice.say(`${capturePrompts(def).countdown} Recording starts after the beep.`);
    const s = createSensor(def.sensor);
    sensor.current = s;
    setState({ phase: 'preparing' });
    s.prepare().then(async () => {
      // Cancelled while the permission prompt was open: this sensor is no longer ours.
      if (sensor.current !== s) return;
      releaseWakeLock.current = await keepAwake();
      if (sensor.current !== s) return releaseWakeLock.current();
      let remaining = def.countdownSec ?? 3;
      setState({ phase: 'countdown', remaining });
      cues.tick();
      const countdown = window.setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          cues.tick();
          return setState({ phase: 'countdown', remaining });
        }
        window.clearInterval(countdown);
        cues.start();
        if (def.sensor === 'audio') {
          // The microphone must hear only the experiment: silence the voice, let the beep die away.
          voice.stop();
          timers.current.push(window.setTimeout(() => record(s, params), 400));
        } else {
          record(s, params);
          voice.say(capturePrompts(def).recording);
        }
      }, 1000);
      timers.current.push(countdown);
    }, (e) => {
      if (sensor.current === s) fail(e);
    });
  };

  return { state, start, cancel, live };
}
