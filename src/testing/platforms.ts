/**
 * Simulated phone/browser platforms. Each takes a high-rate "true" motion
 * recording and reproduces how a real device would deliver it as DeviceMotion
 * events — rate, timing jitter, dropped and batched events, sign conventions,
 * axis labelling, missing gyroscope — then runs the same processing code the
 * live MotionSource uses. See docs/COMPATIBILITY.md for the sources of these quirks.
 */
import { createRecording } from '@core/recording';
import { decimateAudio, MOTION_CHANNELS, processMotionEvents } from '@core/sensors/processing';
import type { Recording } from '@core/types';
import { rng } from './synthetic';

export interface MotionPlatform {
  name: string;
  /** Nominal event rate, Hz. */
  rate: number;
  /** Timing jitter as a fraction of the event interval. */
  jitter: number;
  /** Fraction of events lost. */
  drop?: number;
  /** Browser batches events: some share a timestamp. */
  duplicateTimestamps?: boolean;
  /** iOS reports accelerationIncludingGravity with the opposite sign. */
  invertAccel?: boolean;
  /** Reported [gx, gy, gz] = true axes at these indices (browsers label rotation axes differently). */
  gyroAxes?: [number, number, number];
  noGyroscope?: boolean;
}

export const MOTION_PLATFORMS: MotionPlatform[] = [
  { name: 'Android Chrome, fast sensor (200 Hz)', rate: 200, jitter: 0.1 },
  { name: 'Android Chrome, throttled (60 Hz, drops)', rate: 60, jitter: 0.15, drop: 0.03 },
  { name: 'iPhone Safari (60 Hz, inverted accel, relabelled gyro)', rate: 60, jitter: 0.05, invertAccel: true, gyroAxes: [2, 0, 1] },
  { name: 'Firefox Android (50 Hz, jittery, batched)', rate: 50, jitter: 0.3, drop: 0.05, duplicateTimestamps: true },
  { name: 'Budget phone without gyroscope (50 Hz)', rate: 50, jitter: 0.2, noGyroscope: true },
  { name: 'Old phone, slow sensor (25 Hz)', rate: 25, jitter: 0.2, drop: 0.05 },
];

/** Linear interpolation of a uniformly sampled channel at time t (s). */
function at(data: number[], sampleRate: number, t: number): number {
  const x = t * sampleRate;
  const i = Math.min(data.length - 2, Math.max(0, Math.floor(x)));
  const f = Math.min(1, Math.max(0, x - i));
  return data[i] + (data[i + 1] - data[i]) * f;
}

export function captureOnPlatform(truth: Recording, p: MotionPlatform, seed = 1): Recording {
  const r = rng(seed);
  const duration = truth.channels.ax.length / truth.sampleRate;
  const times: number[] = [];
  const rows: number[][] = [];
  const t0 = 1234.5; // DeviceMotion timestamps are relative to page load, never 0.
  for (let k = 0; (k + 1) / p.rate < duration; k++) {
    if (p.drop && r.uniform() < p.drop) continue;
    const t = Math.max(0, k / p.rate + (r.uniform() - 0.5) * (p.jitter / p.rate));
    const truthRow = MOTION_CHANNELS.map((c) => at(truth.channels[c], truth.sampleRate, t));
    const sign = p.invertAccel ? -1 : 1;
    const accel = truthRow.slice(0, 3).map((v) => sign * v);
    const g = truthRow.slice(3);
    const axes = p.gyroAxes ?? [0, 1, 2];
    const gyro = p.noGyroscope ? [0, 0, 0] : axes.map((i) => g[i]);
    const stamp = p.duplicateTimestamps && rows.length && r.uniform() < 0.1 ? times[times.length - 1] : t0 + t;
    times.push(stamp);
    rows.push([...accel, ...gyro]);
  }
  const capture = processMotionEvents({ times, rows, hasGyroscope: !p.noGyroscope });
  return createRecording({
    experimentId: truth.experimentId,
    sensor: 'motion',
    sampleRate: capture.sampleRate,
    channels: capture.channels,
    params: truth.params,
    meta: { ...capture.meta, synthetic: true, device: p.name },
  });
}

/** Microphone input rates seen in the wild (iOS/most Android 48 kHz, some 44.1 kHz, Bluetooth headsets 16 kHz). */
export const AUDIO_RATES = [48000, 44100, 16000];

/** Feeds a recording through the live decimation path in 128-sample blocks, as an AudioWorklet delivers them. */
export function captureAudio(truth: Recording): Recording {
  const audio = truth.channels.audio;
  const chunks: Float32Array[] = [];
  for (let i = 0; i < audio.length; i += 128) chunks.push(Float32Array.from(audio.slice(i, i + 128)));
  const capture = decimateAudio(chunks, truth.sampleRate);
  return createRecording({
    experimentId: truth.experimentId,
    sensor: 'audio',
    sampleRate: capture.sampleRate,
    channels: capture.channels,
    params: truth.params,
    meta: { synthetic: true },
  });
}
