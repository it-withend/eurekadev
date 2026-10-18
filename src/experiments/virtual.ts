/**
 * Virtual-lab versions of the core experiments. Each one runs the physics
 * simulation used by the test-suite with the student's settings, and returns a
 * recording that goes through exactly the same analysis as a real capture.
 */
import type { VirtualLab } from '@core/types';
import { synthCentripetal, synthPendulum, synthResonance } from '@testing/synthetic';

export const PLANETS = [
  { value: 9.81, label: 'Earth' },
  { value: 1.62, label: 'Moon' },
  { value: 3.71, label: 'Mars' },
  { value: 24.79, label: 'Jupiter' },
];

export const pendulumVirtual: VirtualLab = {
  scene: 'pendulum',
  controls: [
    { id: 'angle', label: 'Swing angle', unit: '°', min: 3, max: 45, step: 1, default: 12 },
    { id: 'gravity', label: 'Gravity', unit: 'm/s²', min: 1, max: 25, step: 0.01, default: 9.81, presets: PLANETS },
  ],
  simulate: (params, knobs, seed) => {
    // At least 10 swings, however weak the gravity (one swing on the Moon takes ~5 s).
    const period = 2 * Math.PI * Math.sqrt(params.length / knobs.gravity);
    const rec = synthPendulum({
      length: params.length,
      g: knobs.gravity,
      theta0: (knobs.angle * Math.PI) / 180,
      seconds: Math.max(25, 10 * period + 3),
      noise: 0.02,
      seed,
    });
    return { ...rec, params: { ...params }, meta: { synthetic: true, virtual: { ...knobs } } };
  },
};

export const resonanceVirtual: VirtualLab = {
  scene: 'tube',
  controls: [],
  simulate: (params, knobs, seed) => {
    const rec = synthResonance({
      length: params.length,
      diameter: params.diameter,
      temperature: params.temperature,
      mode: params.mode === 1 ? 1 : 0,
      seconds: 3,
      seed,
    });
    return { ...rec, params: { ...params }, meta: { synthetic: true, virtual: { ...knobs } } };
  },
};

export const centripetalVirtual: VirtualLab = {
  scene: 'chair',
  controls: [{ id: 'spin', label: 'Starting spin', unit: 'rad/s', min: 3, max: 10, step: 0.5, default: 7 }],
  simulate: (params, knobs, seed) => {
    const rec = synthCentripetal({ radius: params.radius, omega0: knobs.spin, seconds: 20, seed });
    return { ...rec, params: { ...params }, meta: { synthetic: true, virtual: { ...knobs } } };
  },
};
