import type { TourStep } from './Tour';

/** Tour texts live here, apart from the components, so they are easy to edit or translate. */

export const CATALOG_TOUR: TourStep[] = [
  {
    title: 'Welcome to PocketLab! 👋',
    body: 'Your phone has sensors that real scientists use: an accelerometer, a gyroscope and a microphone. PocketLab turns them into lab equipment. This 30-second tour shows you around.',
  },
  {
    target: 'experiments',
    title: 'Pick an experiment',
    body: 'Each card is a complete lab: what you need, what to do, and the physics behind it. Filter by topic or search. Cards marked “Virtual lab” can also be done as a simulation, without equipment.',
  },
  {
    target: 'nav-sensors',
    title: 'Check your phone first',
    body: 'Not every phone has every sensor. The sensor check tells you in 10 seconds which experiments will work on yours.',
  },
  {
    target: 'create',
    title: 'Invent your own experiment',
    body: 'Measure anything that swings, vibrates or makes a sound — a swing, a spring, a guitar string — and write your own formula. Your experiments appear here next to the built-in ones.',
  },
  {
    target: 'nav-guide',
    title: 'Lost? Press Guide',
    body: 'Every page has its own tour. Press Guide at any time to see it again.',
  },
];

export const EXPERIMENT_TOUR: TourStep[] = [
  {
    target: 'steps',
    title: 'Four steps to a result',
    body: 'Every experiment goes Set up → Measure → Results → Write up. This bar shows where you are; tap a step to jump to it.',
  },
  {
    target: 'mode',
    title: 'Real or virtual?',
    body: 'Real lab measures with your phone’s sensors. Virtual lab is a simulation with sliders — practise there first, or use it when you have no phone or equipment. Both are analysed the same way.',
  },
  {
    target: 'setup',
    title: '1 · Set up',
    body: 'The picture and the steps show exactly how to arrange things. Read them once before you start.',
  },
  {
    target: 'measure',
    title: '2 · Enter what you measured',
    body: 'Type the lengths you measured with a ruler — in centimetres, a comma is fine too. If you get something wrong you can fix it later.',
  },
  {
    target: 'start',
    title: 'Start the measurement',
    body: 'Press Start, then follow the big instructions on screen. A beep tells you when recording begins and a double beep when it ends — the phone will be moving, so you do not need to watch it.',
  },
  {
    target: 'samples',
    title: 'No phone at hand?',
    body: 'Load sample data to see a complete analysis straight away. Sample data is simulated and clearly labelled.',
  },
  {
    target: 'trials',
    title: '3 · Your results',
    body: 'Every measurement becomes a trial. Repeat it 3 or more times: PocketLab combines the trials and tells you how close you are to the textbook value, in plain words.',
  },
  {
    target: 'worksheet',
    title: '4 · Write it up',
    body: 'Add your hypothesis and conclusion, then press "Lab report (PDF)" to get a finished report you can hand in.',
  },
  {
    target: 'tutor',
    title: 'Stuck? Ask the AI tutor',
    body: 'The tutor knows this experiment and sees your numbers. Ask “why is my result different?” or “explain the formula” — in any language.',
  },
];

export const CREATE_TOUR: TourStep[] = [
  {
    target: 'create-basics',
    title: 'Name your experiment',
    body: 'Give it a title and choose which sensor listens: motion for things that swing or spin, microphone for sounds.',
  },
  {
    target: 'create-measure',
    title: 'What should the phone measure?',
    body: 'Pick one quantity: the period of a swing, the pitch of a sound, the biggest jolt… PocketLab extracts it from the sensor data for you.',
  },
  {
    target: 'create-formula',
    title: 'Your own formula',
    body: 'Combine the measured value with your own variables (like the mass of a weight) in a formula. PocketLab checks it as you type and shows the result for example numbers.',
  },
  {
    target: 'create-save',
    title: 'Save and measure',
    body: 'Your experiment is saved on this phone and works exactly like the built-in ones — trials, uncertainty, graphs and the lab report. You can also export it to share with classmates.',
  },
];
