import type { ExperimentDefinition } from '@core/types';
import { analyzePendulum, pendulumParams, summarizePendulum } from './analyze';
import { pendulumIllustration } from './illustration';
import { pendulumVirtual } from '../virtual';

export const pendulum: ExperimentDefinition = {
  id: 'pendulum',
  title: 'Measure Gravity with a Pendulum',
  tagline: 'Swing your phone on a string and measure g to within 1 %.',
  subject: 'Mechanics',
  icon: '🕰️',
  glyph: 'swing',
  sensor: 'motion',
  durationSec: 25,
  countdownSec: 5,
  capturePrompts: {
    countdown: 'Pull the phone aside about 10–15° and hold it still…',
    recording: 'Let go now! Let it swing freely until the double beep.',
  },
  params: pendulumParams,
  materials: ['Your phone', 'A string or shoelace ~1 m long', 'Tape or a phone case with a strap hole', 'A ruler or tape measure'],
  instructions: [
    'Tie the string to a fixed point (door frame, table edge) and attach the phone firmly so it cannot twist. Hang it low over a bed or sofa in case it slips.',
    'Measure L from the pivot to the centre of the phone and enter it below.',
    'Press Start, then pull the phone aside by a small angle (about 10–15°).',
    'Release it gently at the high beep and let it swing until the double beep.',
  ],
  illustration: pendulumIllustration,
  theory: {
    summary:
      'For small swings a pendulum’s period depends only on its length and on gravity. The phone’s gyroscope measures its angular velocity, which oscillates once per swing — so timing the oscillation gives T, and T gives g.',
    formula: 'T = 2π√(L/g)  ⇒  g = 4π²L / T²',
  },
  takeaways: [
    'A pendulum’s swing time depends on its length and on gravity — not on its mass.',
    'Four times longer string → twice the swing time (T grows with √L).',
    'Plotting T² against L gives a straight line whose slope is 4π²/g.',
  ],
  errorSources: [
    'Measuring L: the effective length is to the phone’s centre of mass, which is hard to locate exactly.',
    'The phone is an extended object, not a point mass (physical pendulum), which slightly lengthens the period.',
    'Air resistance and a stretchy string damp the swing.',
    'Twisting or elliptical swings mix other motions into the signal.',
  ],
  demoDatasets: [1, 2, 3, 4].map((i) => `datasets/pendulum-demo-${i}.json`),
  preview: (s) => Math.hypot(s.gx, s.gy, s.gz),
  previewLabel: 'rotation (rad/s)',
  virtual: pendulumVirtual,
  analyze: analyzePendulum,
  summarize: summarizePendulum,
};
