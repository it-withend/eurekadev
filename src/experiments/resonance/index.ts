import type { ExperimentDefinition } from '@core/types';
import { analyzeResonance, resonanceParams } from './analyze';
import { resonanceIllustration } from './illustration';

export const resonance: ExperimentDefinition = {
  id: 'resonance',
  title: 'Speed of Sound from a Singing Tube',
  tagline: 'Blow across a tube, let the microphone hear its note, compute the speed of sound.',
  subject: 'Waves & Sound',
  sensor: 'audio',
  durationSec: 4,
  capturePrompts: {
    countdown: 'Hold the microphone next to the opening…',
    recording: 'Blow gently across the top now — keep the note steady.',
  },
  params: resonanceParams,
  materials: ['Your phone', 'A tall cylindrical glass, vase or a paper-towel roll', 'A ruler'],
  instructions: [
    'Measure the inside length and diameter of the tube and enter them below.',
    'Pick the tube type: a glass is closed at one end, a paper roll is open at both.',
    'Hold the phone’s microphone near the open end, in a quiet room.',
    'Press Start and, after the high beep, blow gently across the opening (like a flute) until you hear a steady low note.',
  ],
  illustration: resonanceIllustration,
  theory: {
    summary:
      'An air column resonates when a whole number of quarter-wavelengths fits inside it. The microphone hears that note; a Fourier transform finds its exact frequency, and wavelength × frequency gives the speed of sound.',
    formula: 'closed: v = 4f(L + 0.3d)    open: v = 2f(L + 0.6d)',
  },
  errorSources: [
    'The end correction (0.3d per open end) is an approximation that depends on the shape of the rim.',
    'A glass that narrows or a thick base changes the effective length.',
    'Humidity and CO₂ from your breath raise or lower the speed of sound slightly.',
    'Background noise can hide the resonance peak.',
  ],
  demoDatasets: ['datasets/resonance-demo.json'],
  preview: (s) => s.rms,
  previewLabel: 'loudness (RMS)',
  analyze: analyzeResonance,
};
