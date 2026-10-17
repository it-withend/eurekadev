import { resampleUniform } from '@dsp/resample';
import { SensorError, type Capture, type LiveSample, type SensorSource } from './types';

const CHANNELS = ['ax', 'ay', 'az', 'gx', 'gy', 'gz'] as const;
const DEG = Math.PI / 180;
/** Output grid. Phones deliver 60–200 Hz; 100 Hz is ample for human-scale motion. */
export const MOTION_RATE = 100;

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> };

/** Accelerometer + gyroscope via the DeviceMotion API. */
export class MotionSource implements SensorSource {
  readonly kind = 'motion' as const;
  private times: number[] = [];
  private data: number[][] = CHANNELS.map(() => []);
  private handler: ((e: DeviceMotionEvent) => void) | null = null;

  async prepare(): Promise<void> {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      throw new SensorError('This device has no motion sensors.', 'Open PocketLab on a phone, or try the demo data.');
    }
    if (!window.isSecureContext) {
      throw new SensorError('Motion sensors need a secure (https) connection.');
    }
    const api = DeviceMotionEvent as unknown as PermissionApi;
    if (typeof api.requestPermission === 'function') {
      const state = await api.requestPermission();
      if (state !== 'granted') {
        throw new SensorError('Motion access was denied.', 'Allow "Motion & Orientation Access" and try again.');
      }
    }
  }

  start(onSample: (s: LiveSample) => void): void {
    this.times = [];
    this.data = CHANNELS.map(() => []);
    this.handler = (e) => {
      const a = e.accelerationIncludingGravity;
      const g = e.rotationRate;
      if (!a || a.x === null) return;
      // DeviceMotion maps rotation about x/y/z to beta/gamma/alpha, in deg/s.
      const row = [a.x ?? 0, a.y ?? 0, a.z ?? 0, (g?.beta ?? 0) * DEG, (g?.gamma ?? 0) * DEG, (g?.alpha ?? 0) * DEG];
      this.times.push(e.timeStamp / 1000);
      row.forEach((v, i) => this.data[i].push(v));
      onSample(Object.fromEntries(CHANNELS.map((c, i) => [c, row[i]])));
    };
    window.addEventListener('devicemotion', this.handler);
  }

  stop(): Capture {
    this.dispose();
    if (this.times.length < 10) {
      throw new SensorError(
        'No motion data was received.',
        'Desktop browsers report a sensor but never send data. Use a phone, or try the demo data.',
      );
    }
    const resampled = resampleUniform(this.times, this.data, MOTION_RATE);
    return {
      sampleRate: MOTION_RATE,
      channels: Object.fromEntries(CHANNELS.map((c, i) => [c, resampled[i]])),
      device: navigator.userAgent,
    };
  }

  dispose(): void {
    if (this.handler) window.removeEventListener('devicemotion', this.handler);
    this.handler = null;
  }
}
