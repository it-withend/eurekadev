import type { SensorKind } from '../types';
import { AudioSource } from './audio';
import { MotionSource } from './motion';
import type { SensorSource } from './types';

export * from './types';

/** Sensor factory. A new sensor family = one adapter class + one line here. */
const factories: Record<SensorKind, () => SensorSource> = {
  motion: () => new MotionSource(),
  audio: () => new AudioSource(),
};

export function createSensor(kind: SensorKind): SensorSource {
  return factories[kind]();
}
