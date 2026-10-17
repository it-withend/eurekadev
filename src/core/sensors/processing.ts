/**
 * Pure post-processing of raw sensor streams, shared by the live adapters and
 * the platform-compatibility tests (so tests exercise the exact code phones run).
 */
import { estimateRate, resampleUniform } from '@dsp/resample';
import { SensorError, type Capture } from './types';

export const MOTION_CHANNELS = ['ax', 'ay', 'az', 'gx', 'gy', 'gz'] as const;
/** Output grid. Phones deliver 50–200 Hz; 100 Hz is ample for human-scale motion. */
export const MOTION_RATE = 100;
/** Below this, oscillations of ~1 Hz can no longer be timed reliably. */
const MIN_EVENT_RATE = 15;

export interface MotionEvents {
  /** Event timestamps, seconds. */
  times: number[];
  /** One row per event: ax, ay, az (m/s²), gx, gy, gz (rad/s). */
  rows: number[][];
  /** Whether any event carried rotation-rate data. */
  hasGyroscope: boolean;
}

/**
 * Turns an irregular event stream into a uniformly sampled capture.
 * Browsers may batch events with identical or even out-of-order timestamps;
 * those are dropped before resampling.
 */
export function processMotionEvents(ev: MotionEvents): Capture {
  const times: number[] = [];
  const rows: number[][] = [];
  for (let i = 0; i < ev.times.length; i++) {
    if (times.length && ev.times[i] <= times[times.length - 1]) continue;
    times.push(ev.times[i]);
    rows.push(ev.rows[i]);
  }
  if (times.length < 10) {
    throw new SensorError(
      'No motion data was received.',
      'Desktop browsers often report a sensor but never send data. Use a phone, or try the sample data.',
    );
  }
  const rate = estimateRate(times);
  if (rate < MIN_EVENT_RATE) {
    throw new SensorError(
      `The motion sensor only delivered ${rate.toFixed(0)} readings per second.`,
      'Turn off battery saver / low power mode, keep the app on screen, and try again.',
    );
  }
  const columns = MOTION_CHANNELS.map((_, c) => rows.map((r) => r[c]));
  const resampled = resampleUniform(times, columns, MOTION_RATE);
  return {
    sampleRate: MOTION_RATE,
    channels: Object.fromEntries(MOTION_CHANNELS.map((c, i) => [c, resampled[i]])),
    meta: { eventRate: rate, hasGyroscope: ev.hasGyroscope },
  };
}

/** Target rate after decimation: plenty for resonances below ~3 kHz, and keeps recordings small. */
export const AUDIO_TARGET_RATE = 8000;

/** Box-car average then decimate: a cheap anti-aliasing low-pass. */
export function decimateAudio(chunks: ArrayLike<number>[], inputRate: number): Capture {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  if (total < inputRate * 0.5) throw new SensorError('Too little audio was captured.');
  const factor = Math.max(1, Math.floor(inputRate / AUDIO_TARGET_RATE));
  const out = new Float64Array(Math.floor(total / factor));
  let acc = 0;
  let k = 0;
  let j = 0;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++) {
      acc += c[i];
      if (++k === factor) {
        if (j < out.length) out[j++] = acc / factor;
        acc = 0;
        k = 0;
      }
    }
  }
  return { sampleRate: inputRate / factor, channels: { audio: out }, meta: { eventRate: inputRate } };
}
