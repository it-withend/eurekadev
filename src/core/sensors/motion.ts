import { MOTION_CHANNELS, processMotionEvents } from './processing';
import { SensorError, type Capture, type LiveSample, type SensorSource } from './types';

export { MOTION_RATE } from './processing';

const DEG = Math.PI / 180;

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * Accelerometer + gyroscope via the DeviceMotion API.
 *
 * Platform notes (handled downstream, see docs/COMPATIBILITY.md): iOS Safari
 * needs a permission prompt, reports accelerations with the opposite sign to
 * Android, and labels rotation axes differently. Analyses are therefore written
 * to be independent of axis labels and signs.
 */
export class MotionSource implements SensorSource {
  readonly kind = 'motion' as const;
  private times: number[] = [];
  private rows: number[][] = [];
  private hasGyroscope = false;
  private handler: ((e: DeviceMotionEvent) => void) | null = null;

  async prepare(): Promise<void> {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      throw new SensorError('This device has no motion sensors.', 'Open PocketLab on a phone, or try the sample data.');
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
    this.rows = [];
    this.hasGyroscope = false;
    this.handler = (e) => {
      const a = e.accelerationIncludingGravity;
      const g = e.rotationRate;
      if (!a || a.x === null) return;
      if (g && (g.alpha !== null || g.beta !== null || g.gamma !== null)) this.hasGyroscope = true;
      // Spec: rotation about x/y/z = beta/gamma/alpha, in deg/s.
      const row = [a.x ?? 0, a.y ?? 0, a.z ?? 0, (g?.beta ?? 0) * DEG, (g?.gamma ?? 0) * DEG, (g?.alpha ?? 0) * DEG];
      this.times.push(e.timeStamp / 1000);
      this.rows.push(row);
      onSample(Object.fromEntries(MOTION_CHANNELS.map((c, i) => [c, row[i]])));
    };
    window.addEventListener('devicemotion', this.handler);
  }

  stop(): Capture {
    this.dispose();
    const capture = processMotionEvents({ times: this.times, rows: this.rows, hasGyroscope: this.hasGyroscope });
    return { ...capture, device: navigator.userAgent };
  }

  dispose(): void {
    if (this.handler) window.removeEventListener('devicemotion', this.handler);
    this.handler = null;
  }
}
