import type { ExperimentDefinition } from '@core/types';

const DEFAULTS = {
  motion: { countdown: 'Get into position…', recording: 'Recording — let it move.' },
  audio: { countdown: 'Get ready to make the sound…', recording: 'Recording — make the sound now.' },
} as const;

/** What the student should do during the countdown and the recording: shown full-screen and spoken. */
export function capturePrompts(def: ExperimentDefinition): { countdown: string; recording: string } {
  return def.capturePrompts ?? DEFAULTS[def.sensor];
}
