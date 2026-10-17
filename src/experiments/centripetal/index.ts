import type { ExperimentDefinition } from '@core/types';
import { analyzeCentripetal, centripetalParams } from './analyze';

export const centripetal: ExperimentDefinition = {
  id: 'centripetal',
  title: 'Circular Motion on a Spinning Chair',
  tagline: 'Prove a = ω²r with a desk chair and recover the radius from the slope.',
  subject: 'Mechanics',
  sensor: 'motion',
  durationSec: 20,
  params: centripetalParams,
  materials: ['Your phone', 'A swivel chair, lazy Susan or turntable', 'Tape', 'A ruler'],
  instructions: [
    'Tape the phone flat on the seat, screen up, some distance from the centre.',
    'Measure r from the spin axis to the centre of the phone and enter it below.',
    'Press Start, give the chair a strong spin and step back.',
    'Let it slow down by itself until the recording ends.',
  ],
  theory: {
    summary:
      'Anything moving in a circle accelerates towards the centre. The gyroscope gives ω and the accelerometer gives a; as the chair slows, the points (ω², a) trace a straight line whose slope is the radius.',
    formula: 'a = ω²r',
  },
  demoDataset: 'datasets/centripetal-demo.json',
  preview: (s) => Math.hypot(s.gx, s.gy, s.gz),
  previewLabel: 'spin rate (rad/s)',
  analyze: analyzeCentripetal,
};
