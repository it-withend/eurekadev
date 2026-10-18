/**
 * The experiment library: everyday investigations built from the same data
 * format students use in the builder (custom/spec.ts). Adding one is a few
 * lines of text — no signal-processing code — which is how the catalogue can
 * grow quickly. They double as the builder's templates.
 */
import type { ExperimentDefinition } from '@core/types';
import { createCustomExperiment } from './custom/factory';
import type { CustomExperimentSpec } from './custom/spec';

type LibrarySpec = Omit<CustomExperimentSpec, 'id' | 'format' | 'version'>;

export interface LibraryEntry {
  key: string;
  id: string;
  icon: string;
  subject: string;
  name: string;
  spec: LibrarySpec;
  capturePrompts?: { countdown: string; recording: string };
}

export const LIBRARY: LibraryEntry[] = [
  {
    key: 'spring',
    id: 'spring-constant',
    icon: '🪀',
    subject: 'Mechanics',
    name: 'Spring constant',
    capturePrompts: { countdown: 'Pull the phone down a little and hold it…', recording: 'Let go now — let it bounce.' },
    spec: {
      title: 'How Stiff Is a Spring?',
      description: 'Hang the phone from a spring or a strong rubber band and let it bounce. The bounce time reveals how stiff the spring is.',
      measure: 'period',
      durationSec: 15,
      variables: [{ symbol: 'm', label: 'Mass hanging on the spring (phone + case)', unit: 'kg', value: 0.2, uncertainty: 0.005 }],
      formula: '4π²m/T²',
      result: { name: 'Spring constant', symbol: 'k', unit: 'N/m', digits: 1 },
      materials: ['Your phone in a case or a small bag', 'A spring or a strong rubber band', 'Kitchen scale'],
      instructions: [
        'Weigh the phone (with its case or bag) and enter the mass in kg.',
        'Hang it from the spring over something soft so it can bounce up and down freely.',
        'Press Start, pull it down a little and let go at the beep.',
      ],
      takeaways: [
        'A stiffer spring (bigger k) bounces faster.',
        'A heavier mass bounces more slowly: T = 2π√(m/k).',
        'Hooke’s law: the spring’s force grows in step with how far it is stretched, F = k·x.',
      ],
    },
  },
  {
    key: 'swing',
    id: 'playground-swing',
    icon: '🛝',
    subject: 'Mechanics',
    name: 'Playground swing',
    capturePrompts: { countdown: 'Phone in a zipped pocket, start swinging gently…', recording: 'Keep swinging — don’t pump your legs.' },
    spec: {
      title: 'How Long Is a Swing?',
      description: 'Ride a playground swing with the phone in your pocket and find the swing’s length from its rhythm — without a tape measure.',
      measure: 'period',
      durationSec: 30,
      variables: [{ symbol: 'g', label: 'Gravitational acceleration', unit: 'm/s²', value: 9.81, uncertainty: 0 }],
      formula: 'g*T^2/(4*pi^2)',
      result: { name: 'Effective length of the swing', symbol: 'L', unit: 'm', digits: 2 },
      materials: ['Your phone (in a zipped pocket!)', 'A playground swing'],
      instructions: ['Put the phone in a zipped pocket.', 'Press Start and swing gently without pumping your legs.', 'Afterwards, check the length with a tape measure if you can.'],
      takeaways: ['A swing is a pendulum: its rhythm depends on its length, not on who sits on it.', 'You can measure a length using only time and gravity: L = gT²/4π².'],
    },
  },
  {
    key: 'note',
    id: 'musical-note',
    icon: '🎸',
    subject: 'Waves & Sound',
    name: 'Musical note',
    spec: {
      title: 'Which Note Is This?',
      description: 'Play a note on an instrument, sing, or tap a glass — and find its exact pitch in hertz.',
      measure: 'pitch',
      durationSec: 3,
      variables: [],
      formula: '',
      result: { name: 'Pitch', symbol: 'f', unit: 'Hz', digits: 1 },
      expected: { value: 440, uncertainty: 0, source: 'note A4 (concert pitch)' },
      materials: ['Your phone', 'An instrument, a tuning fork or a glass'],
      instructions: ['Hold the phone near the instrument in a quiet room.', 'Press Start and play one long, steady note.'],
      takeaways: [
        'Pitch is how many times per second the air vibrates (hertz).',
        'One octave higher = exactly twice the frequency.',
        'Orchestras tune to A = 440 Hz.',
      ],
    },
  },
  {
    key: 'string',
    id: 'string-wave',
    icon: '🎻',
    subject: 'Waves & Sound',
    name: 'Wave on a string',
    spec: {
      title: 'Speed of a Wave on a String',
      description: 'Pluck a guitar (or rubber-band) string: the note and the string’s length give the speed of the wave running along it.',
      measure: 'pitch',
      durationSec: 3,
      variables: [{ symbol: 'L', label: 'Vibrating length of the string', unit: 'm', value: 0.65, uncertainty: 0.005 }],
      formula: '2*L*f',
      result: { name: 'Wave speed on the string', symbol: 'v', unit: 'm/s', digits: 0 },
      materials: ['Your phone', 'A guitar, ukulele or a rubber band stretched over a box', 'A ruler'],
      instructions: [
        'Measure the vibrating length of the string (from bridge to nut) and enter it.',
        'Hold the phone near the string, press Start and pluck the open string once.',
      ],
      takeaways: [
        'A plucked string vibrates so that half a wave fits its length: λ = 2L.',
        'Wave speed = frequency × wavelength, v = f·λ.',
        'Tighter strings carry waves faster, so they sound higher.',
      ],
    },
  },
  {
    key: 'jump',
    id: 'jump-landing',
    icon: '🦘',
    subject: 'Forces & Motion',
    name: 'Jump landing',
    capturePrompts: { countdown: 'Hold the phone firmly against your chest…', recording: 'Jump now!' },
    spec: {
      title: 'How Hard Do You Land?',
      description: 'Jump holding the phone against your chest and measure the force on landing, in “g”.',
      measure: 'peak',
      durationSec: 6,
      variables: [],
      formula: 'a/9.81',
      result: { name: 'Landing jolt', symbol: 'n', unit: 'g', digits: 1 },
      materials: ['Your phone held firmly against your chest'],
      instructions: ['Hold the phone firmly against your chest with both hands.', 'Press Start and jump once after the beep.', 'Try landing with stiff legs, then with bent knees — compare.'],
      takeaways: [
        'Stopping quickly needs a big force: bending your knees makes the stop longer and the force smaller.',
        'In mid-air you are weightless: the phone feels almost no acceleration.',
      ],
    },
  },
  {
    key: 'elevator',
    id: 'elevator',
    icon: '🛗',
    subject: 'Forces & Motion',
    name: 'Elevator ride',
    capturePrompts: { countdown: 'Hold the phone flat and still, press the lift button…', recording: 'Keep the phone still while the lift moves.' },
    spec: {
      title: 'Feeling Heavier in a Lift',
      description: 'Hold the phone flat in an elevator: when it starts or stops you briefly weigh more or less. Find out by how much.',
      measure: 'peak',
      durationSec: 20,
      variables: [],
      formula: '100*(9.81+a)/9.81',
      result: { name: 'Heaviest you felt (normal = 100)', symbol: 'W', unit: '%', digits: 0 },
      materials: ['Your phone', 'An elevator'],
      instructions: ['Hold the phone flat on your hand, screen up.', 'Press Start, then ride the elevator up one or more floors, keeping the phone still.'],
      takeaways: [
        'Speeding up upwards needs an extra upward force: you feel heavier.',
        'Slowing down when going up, you feel lighter.',
        'Moving at a steady speed feels exactly like standing still (Newton’s first law).',
      ],
    },
  },
  {
    key: 'turntable',
    id: 'turntable',
    icon: '💿',
    subject: 'Rotation',
    name: 'Turntable speed',
    capturePrompts: { countdown: 'Start the turntable…', recording: 'Let it turn steadily.' },
    spec: {
      title: 'Rotation Speed in RPM',
      description: 'Put the phone on a turntable, lazy Susan or office chair and measure how many turns per minute it makes.',
      measure: 'spin',
      durationSec: 10,
      variables: [],
      formula: 'w*60/(2*pi)',
      result: { name: 'Turns per minute', symbol: 'n', unit: 'rpm', digits: 1 },
      materials: ['Your phone', 'A turntable, lazy Susan or office chair'],
      instructions: ['Place the phone flat on the turntable.', 'Press Start and let it turn steadily.'],
      takeaways: ['One full turn is 2π radians, so rpm = ω·60/2π.', 'Every point on a turning object has the same angular speed, but outer points move faster.'],
    },
  },
  {
    key: 'friction',
    id: 'friction',
    icon: '📚',
    subject: 'Forces & Motion',
    name: 'Friction',
    capturePrompts: { countdown: 'Phone flat on the board, get ready to lift one end…', recording: 'Lift one end slowly until the phone slides.' },
    spec: {
      title: 'How Grippy Is a Surface?',
      description: 'Put the phone on a book or board and slowly lift one end until it slides. The angle tells how much friction there is.',
      measure: 'tiltMax',
      durationSec: 15,
      variables: [],
      formula: 'tan(A*pi/180)',
      result: { name: 'Coefficient of static friction', symbol: 'μ', unit: '', digits: 2 },
      materials: ['Your phone (in its case or not — try both!)', 'A large book, cutting board or tray'],
      instructions: [
        'Lay the phone flat on the board, screen up, near one end.',
        'Press Start and, after the beep, lift the far end of the board very slowly.',
        'Stop as soon as the phone starts to slide; catch it at the bottom.',
      ],
      takeaways: [
        'An object starts to slide when the slope’s pull beats friction: μ = tan(angle).',
        'μ does not depend on how heavy the object is — only on the two surfaces.',
        'Rubber on wood grips more (bigger μ) than plastic on paper.',
      ],
    },
  },
  {
    key: 'ramp',
    id: 'ramp-slope',
    icon: '⛰️',
    subject: 'Math & Geometry',
    name: 'Slope of a ramp',
    capturePrompts: { countdown: 'Lay the phone flat on the slope…', recording: 'Keep it still.' },
    spec: {
      title: 'How Steep Is That Ramp?',
      description: 'Lay the phone on a ramp, a path or a slide and measure its angle and its slope in percent, like road signs do.',
      measure: 'tilt',
      durationSec: 5,
      variables: [],
      formula: '100*tan(A*pi/180)',
      result: { name: 'Slope (rise per 100 m)', symbol: 's', unit: '%', digits: 1 },
      materials: ['Your phone', 'A ramp, slope, slide or tilted surface'],
      instructions: ['Lay the phone flat on the slope.', 'Press Start and keep it still until the double beep.'],
      takeaways: [
        'A slope in percent is rise ÷ run × 100 = 100·tan(angle).',
        'A 10 % road rises 10 m for every 100 m — an angle of only 5.7°.',
        'Wheelchair ramps should be under about 8 %.',
      ],
    },
  },
];

/** Library entries as ordinary plugins. */
export function libraryExperiments(): ExperimentDefinition[] {
  return LIBRARY.map((e) => ({
    ...createCustomExperiment({ ...e.spec, id: e.id, format: 'pocketlab.experiment', version: 1 }),
    custom: false,
    subject: e.subject,
    icon: e.icon,
    capturePrompts: e.capturePrompts,
  }));
}
