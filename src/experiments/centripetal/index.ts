import type { ExperimentDefinition } from '@core/types';
import { analyzeCentripetal, centripetalParams } from './analyze';
import { centripetalIllustration } from './illustration';
import { centripetalVirtual } from '../virtual';

export const centripetal: ExperimentDefinition = {
  id: 'centripetal',
  title: 'Circular Motion on a Spinning Chair',
  tagline: 'Prove a = ω²r with a desk chair and recover the radius from the slope.',
  subject: 'Rotation',
  icon: '🪑',
  glyph: 'spin',
  sensor: 'motion',
  durationSec: 20,
  countdownSec: 5,
  capturePrompts: {
    countdown: 'Hand on the chair, get ready to spin…',
    recording: 'Spin it hard now, then step back and let it slow down.',
  },
  params: centripetalParams,
  materials: ['Your phone', 'An empty swivel chair, lazy Susan or turntable', 'Tape', 'A ruler'],
  instructions: [
    'Tape the phone flat on the seat, screen up, some distance from the centre. Nobody sits on the chair.',
    'Measure r from the spin axis to the centre of the phone and enter it below.',
    'Press Start; at the high beep give the chair a strong spin and step back.',
    'Let it slow down by itself until the double beep.',
  ],
  illustration: centripetalIllustration,
  theory: {
    summary:
      'Anything moving in a circle accelerates towards the centre. The gyroscope gives ω and the accelerometer gives a; as the chair slows, the points (ω², a) trace a straight line whose slope is the radius.',
    formula: 'a = ω²r',
  },
  takeaways: [
    'Moving in a circle needs a pull towards the centre (centripetal acceleration).',
    'That pull grows with the square of the spin speed: a = ω²r.',
    'Further from the centre at the same spin speed → stronger pull.',
  ],
  errorSources: [
    'The accelerometer chip is not exactly at the centre of the phone, so its true radius differs by up to a few cm.',
    'A tilted seat lets gravity leak into the horizontal axes.',
    'Wobble of the chair adds vibration noise.',
  ],
  demoDatasets: ['datasets/centripetal-demo.json'],
  preview: (s) => Math.hypot(s.gx, s.gy, s.gz),
  previewLabel: 'spin rate (rad/s)',
  virtual: centripetalVirtual,
  analyze: analyzeCentripetal,
};
