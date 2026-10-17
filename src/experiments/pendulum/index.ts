import type { ExperimentDefinition } from '@core/types';
import { analyzePendulum, pendulumParams } from './analyze';

export const pendulum: ExperimentDefinition = {
  id: 'pendulum',
  title: 'Measure Gravity with a Pendulum',
  tagline: 'Swing your phone on a string and measure g to within 1 %.',
  subject: 'Mechanics',
  sensor: 'motion',
  durationSec: 25,
  params: pendulumParams,
  materials: ['Your phone', 'A string or shoelace ~1 m long', 'Tape or a phone case with a strap hole', 'A ruler or tape measure'],
  instructions: [
    'Tie the string to a fixed point (door frame, table edge) and attach the phone firmly so it cannot twist.',
    'Measure L from the pivot to the centre of the phone and enter it below.',
    'Pull the phone aside by a small angle (about 10–15°).',
    'Press Start, release the phone gently when the countdown ends and let it swing.',
  ],
  theory: {
    summary:
      'For small swings a pendulum’s period depends only on its length and on gravity. The phone’s gyroscope measures its angular velocity, which oscillates once per swing — so timing the oscillation gives T, and T gives g.',
    formula: 'T = 2π√(L/g)  ⇒  g = 4π²L / T²',
  },
  demoDataset: 'datasets/pendulum-demo.json',
  preview: (s) => s.gx + s.gy + s.gz,
  previewLabel: 'rotation (rad/s)',
  analyze: analyzePendulum,
};
