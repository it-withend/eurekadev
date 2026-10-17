import type { SensorKind } from '../types';

/** One live sample for previews: channel name → value. */
export type LiveSample = Record<string, number>;

export interface Capture {
  sampleRate: number;
  channels: Record<string, Float64Array>;
  device?: string;
}

/**
 * Hardware adapter. Lifecycle: prepare() → start() → stop().
 *
 * `prepare` asks for permission and MUST be called synchronously from a user
 * gesture (iOS refuses motion/microphone access otherwise). `start` may be
 * called later, e.g. after a countdown.
 */
export interface SensorSource {
  readonly kind: SensorKind;
  prepare(): Promise<void>;
  start(onSample: (sample: LiveSample) => void): void;
  stop(): Capture;
  /** Releases hardware without producing a capture (e.g. on cancel). */
  dispose(): void;
}

export class SensorError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}
