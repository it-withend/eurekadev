import { newCustomId, type CustomExperimentSpec } from './spec';

type Template = Omit<CustomExperimentSpec, 'id' | 'format' | 'version'>;

/** Starting points in the builder: real investigations students can do at home. */
export const TEMPLATES: { key: string; emoji: string; name: string; spec: Template }[] = [
  {
    key: 'spring',
    emoji: '🪀',
    name: 'Spring constant',
    spec: {
      title: 'Stiffness of a spring',
      description: 'Hang the phone from a spring (or rubber band) and let it bounce. The bounce period reveals how stiff the spring is.',
      measure: 'period',
      durationSec: 15,
      variables: [{ symbol: 'm', label: 'Mass hanging on the spring (phone + case)', unit: 'kg', value: 0.2, uncertainty: 0.005 }],
      formula: '4*pi^2*m/T^2',
      result: { name: 'Spring constant', symbol: 'k', unit: 'N/m', digits: 1 },
      materials: ['Your phone in a case or bag', 'A spring or a strong rubber band', 'Kitchen scale'],
      instructions: [
        'Weigh the phone (with its case or bag) and enter the mass in kg.',
        'Hang it from the spring so it can bounce up and down freely.',
        'Press Start, pull it down a little and release at the beep.',
      ],
    },
  },
  {
    key: 'swing',
    emoji: '🛝',
    name: 'Playground swing',
    spec: {
      title: 'How long is the swing?',
      description: 'Ride a swing holding the phone and find the effective length of the swing from its period.',
      measure: 'period',
      durationSec: 30,
      variables: [{ symbol: 'g', label: 'Gravitational acceleration', unit: 'm/s²', value: 9.81, uncertainty: 0 }],
      formula: 'g*T^2/(4*pi^2)',
      result: { name: 'Effective length of the swing', symbol: 'L', unit: 'm', digits: 2 },
      materials: ['Your phone (in a zipped pocket!)', 'A playground swing'],
      instructions: ['Put the phone in a zipped pocket.', 'Press Start, then swing gently without pumping your legs.'],
    },
  },
  {
    key: 'note',
    emoji: '🎸',
    name: 'Musical note',
    spec: {
      title: 'Which note is this?',
      description: 'Play a note on an instrument (or tap a glass) and find its pitch.',
      measure: 'pitch',
      durationSec: 3,
      variables: [],
      formula: '',
      result: { name: 'Pitch', symbol: 'f', unit: 'Hz', digits: 1 },
      expected: { value: 440, uncertainty: 0, source: 'note A4 (concert pitch)' },
      materials: ['Your phone', 'An instrument, tuning fork or a glass'],
      instructions: ['Hold the phone near the instrument in a quiet room.', 'Press Start and play one long note.'],
    },
  },
  {
    key: 'jump',
    emoji: '🦘',
    name: 'Jump landing',
    spec: {
      title: 'How hard do you land?',
      description: 'Jump holding the phone against your chest and measure the force on landing, in "g".',
      measure: 'peak',
      durationSec: 6,
      variables: [],
      formula: 'a/9.81',
      result: { name: 'Landing jolt', symbol: 'n', unit: 'g', digits: 1 },
      materials: ['Your phone held firmly against your chest'],
      instructions: ['Hold the phone firmly against your chest with both hands.', 'Press Start and jump once after the beep.'],
    },
  },
  {
    key: 'turntable',
    emoji: '💿',
    name: 'Turntable speed',
    spec: {
      title: 'Rotation speed in rpm',
      description: 'Put the phone on a turntable or lazy Susan and measure how many turns per minute it makes.',
      measure: 'spin',
      durationSec: 10,
      variables: [],
      formula: 'w*60/(2*pi)',
      result: { name: 'Turns per minute', symbol: 'n', unit: 'rpm', digits: 1 },
      materials: ['Your phone', 'A turntable, lazy Susan or office chair'],
      instructions: ['Place the phone flat on the turntable.', 'Press Start and let it turn steadily.'],
    },
  },
  {
    key: 'blank',
    emoji: '✏️',
    name: 'Start from scratch',
    spec: {
      title: '',
      description: '',
      measure: 'period',
      durationSec: 15,
      variables: [],
      formula: '',
      result: { name: '', symbol: '', unit: '', digits: 3 },
      materials: [],
      instructions: [],
    },
  },
];

export function fromTemplate(t: Template): CustomExperimentSpec {
  return { ...structuredClone(t), format: 'pocketlab.experiment', version: 1, id: newCustomId(t.title || 'experiment') };
}
