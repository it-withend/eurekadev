/**
 * Physics simulations that produce realistic sensor recordings. Used by the
 * test-suite (ground truth is known exactly) and to generate the demo datasets
 * that let anyone try PocketLab on a laptop. Demo files are flagged
 * `meta.synthetic` and labelled as such in the UI.
 */
import { applyBiquad, bandPassCoefficients } from '@dsp/filters';
import { createRecording } from '@core/recording';
import type { Recording } from '@core/types';

/** Deterministic PRNG (mulberry32) so tests never flake. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    const u = Math.max(uniform(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform());
  };
  return { uniform, gauss };
}

export function synthPendulum(o: {
  length: number;
  g?: number;
  theta0?: number;
  seconds?: number;
  sampleRate?: number;
  qualityFactor?: number;
  noise?: number;
  seed?: number;
  /** Torsional twisting of the phone around the string (larger than the swing signal if strong). */
  twist?: { amplitude: number; period: number };
  /** Simulate a phone without a gyroscope. */
  noGyro?: boolean;
}): Recording {
  const g = o.g ?? 9.81;
  const L = o.length;
  const sr = o.sampleRate ?? 100;
  const n = Math.round((o.seconds ?? 25) * sr);
  const w0 = Math.sqrt(g / L);
  const damping = w0 / (o.qualityFactor ?? 300);
  const noise = o.noise ?? 0.02;
  const r = rng(o.seed ?? 1);
  const ch = { ax: [] as number[], ay: [] as number[], az: [] as number[], gx: [] as number[], gy: [] as number[], gz: [] as number[] };
  // Full non-linear pendulum θ'' = −(g/L)·sin θ − γθ', integrated with RK4.
  let th = o.theta0 ?? 0.2;
  let om = 0;
  const dt = 1 / sr;
  const sub = 10;
  const h = dt / sub;
  const f = (t: number, w: number) => -(g / L) * Math.sin(t) - damping * w;
  const bias = 0.01;
  for (let i = 0; i < n; i++) {
    const twist = o.twist ? o.twist.amplitude * Math.sin((2 * Math.PI * i) / sr / o.twist.period) : 0;
    const gyroOn = o.noGyro ? 0 : 1;
    ch.gx.push(gyroOn * (om + bias + noise * r.gauss()));
    ch.gy.push(gyroOn * (twist + noise * r.gauss()));
    ch.gz.push(gyroOn * noise * r.gauss());
    // A swinging phone feels no tangential force: only tension along the string.
    ch.ax.push(noise * 5 * r.gauss());
    ch.ay.push(g * Math.cos(th) + L * om * om + noise * 5 * r.gauss());
    ch.az.push(noise * 5 * r.gauss());
    for (let s = 0; s < sub; s++) {
      const k1t = om, k1w = f(th, om);
      const k2t = om + (h / 2) * k1w, k2w = f(th + (h / 2) * k1t, om + (h / 2) * k1w);
      const k3t = om + (h / 2) * k2w, k3w = f(th + (h / 2) * k2t, om + (h / 2) * k2w);
      const k4t = om + h * k3w, k4w = f(th + h * k3t, om + h * k3w);
      th += (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
      om += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    }
  }
  return createRecording({
    experimentId: 'pendulum',
    sensor: 'motion',
    sampleRate: sr,
    channels: ch,
    params: { length: L, lengthUncertainty: 0.005 },
    startedAt: new Date('2026-10-17T10:00:00Z'),
    meta: { synthetic: true, note: `Simulated pendulum, L = ${L} m, g = ${g} m/s²` },
  });
}

export function synthResonance(o: {
  length: number;
  diameter: number;
  temperature: number;
  mode?: 0 | 1;
  seconds?: number;
  sampleRate?: number;
  seed?: number;
}): Recording {
  const sr = o.sampleRate ?? 8000;
  const n = Math.round((o.seconds ?? 3) * sr);
  const v = 331.3 * Math.sqrt(1 + o.temperature / 273.15);
  const closed = (o.mode ?? 0) === 0;
  const f0 = closed ? v / (4 * (o.length + 0.3 * o.diameter)) : v / (2 * (o.length + 0.6 * o.diameter));
  const r = rng(o.seed ?? 2);
  const white = Float64Array.from({ length: n }, () => r.gauss());
  // Breath noise excites the air column; it rings at f0 and its harmonics
  // (odd harmonics only for a tube closed at one end).
  const out = new Float64Array(n);
  const harmonics = closed ? [1, 3, 5] : [1, 2, 3];
  harmonics.forEach((h, idx) => {
    const ring = applyBiquad(white, bandPassCoefficients(sr, f0 * h, 40));
    const gain = 1 / (1 + idx * 2);
    for (let i = 0; i < n; i++) out[i] += gain * ring[i];
  });
  for (let i = 0; i < n; i++) out[i] = 0.25 * out[i] + 0.01 * r.gauss();
  return createRecording({
    experimentId: 'resonance',
    sensor: 'audio',
    sampleRate: sr,
    channels: { audio: out },
    params: { length: o.length, diameter: o.diameter, temperature: o.temperature, mode: o.mode ?? 0 },
    startedAt: new Date('2026-10-17T10:00:00Z'),
    meta: { synthetic: true, note: `Simulated air column, f₀ = ${f0.toFixed(1)} Hz` },
  });
}

export function synthCentripetal(o: {
  radius: number;
  omega0?: number;
  decaySeconds?: number;
  seconds?: number;
  sampleRate?: number;
  seed?: number;
  /**
   * Gyroscope channel that carries the spin. Real browsers disagree on how
   * rotationRate alpha/beta/gamma map to axes (iOS Safari differs), so the
   * spin of a flat phone can show up on any channel.
   */
  spinChannel?: 'gx' | 'gy' | 'gz';
  /** Seat tilt in degrees: part of gravity leaks into the horizontal axes. */
  tiltDeg?: number;
  /** Speed profile: free spin-down, or a chair pushed by hand once per turn (as in a real iPhone test). */
  profile?: 'decay' | 'pushed';
}): Recording {
  const sr = o.sampleRate ?? 100;
  const n = Math.round((o.seconds ?? 20) * sr);
  const w0 = o.omega0 ?? 7;
  const tau = o.decaySeconds ?? 9;
  const r = rng(o.seed ?? 3);
  const tilt = ((o.tiltDeg ?? 0) * Math.PI) / 180;
  const spin = o.spinChannel ?? 'gz';
  const ch = { ax: [] as number[], ay: [] as number[], az: [] as number[], gx: [] as number[], gy: [] as number[], gz: [] as number[] };
  const speed = (t: number) =>
    o.profile === 'pushed'
      ? Math.min(w0 * t, 2 + 0.9 * Math.sin((2 * Math.PI * t) / 3.2))
      : t < 1
        ? w0 * t
        : w0 * Math.exp(-(t - 1) / tau); // spin up for 1 s, then friction slows it down
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const w = speed(t);
    const dw = (speed(t + 1e-3) - w) / 1e-3;
    for (const g of ['gx', 'gy', 'gz'] as const) ch[g].push((g === spin ? w : 0) + 0.03 * r.gauss());
    ch.ax.push(-w * w * o.radius + 0.08 * r.gauss());
    ch.ay.push(dw * o.radius + 9.81 * Math.sin(tilt) + 0.08 * r.gauss());
    ch.az.push(9.81 * Math.cos(tilt) + 0.08 * r.gauss());
  }
  return createRecording({
    experimentId: 'centripetal',
    sensor: 'motion',
    sampleRate: sr,
    channels: ch,
    params: { radius: o.radius, radiusUncertainty: 0.005 },
    startedAt: new Date('2026-10-17T10:00:00Z'),
    meta: { synthetic: true, note: `Simulated spinning chair, r = ${o.radius} m` },
  });
}

/** Generic samples for student-made experiments (one per measure kind). */
export function synthGenericMotion(o: {
  kind: 'oscillation' | 'jolt' | 'spin';
  /** Oscillation period (s), jolt size (m/s²) or spin rate (rad/s). */
  value: number;
  seconds?: number;
  seed?: number;
  /** Jolt only: surround it with a whole jump (crouch, push-off, free fall, wobble), like a real iPhone recording. */
  realisticJump?: boolean;
}): Recording {
  const sr = 100;
  const n = Math.round((o.seconds ?? 15) * sr);
  const r = rng(o.seed ?? 4);
  const ch = { ax: [] as number[], ay: [] as number[], az: [] as number[], gx: [] as number[], gy: [] as number[], gz: [] as number[] };
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let bounce = 0;
    let jolt = 0;
    let spin = 0;
    if (o.kind === 'oscillation') bounce = 2.5 * Math.exp(-t / 30) * Math.sin((2 * Math.PI * t) / o.value); // a weight on a spring
    if (o.kind === 'jolt') {
      const land = (o.seconds ?? 15) / 2;
      jolt = o.value * Math.exp(-(((t - land) / 0.05) ** 2));
      if (o.realisticJump) {
        const dt = t - land;
        if (dt > -1.4 && dt < -0.5) jolt += 0.6 * o.value * Math.sin(9 * dt) * Math.sin((Math.PI * (dt + 1.4)) / 0.9); // crouch and push
        if (dt > -0.45 && dt < -0.05) jolt -= 9.81; // free fall: the phone feels almost nothing
        if (dt > 0.05 && dt < 1) jolt += 0.4 * o.value * Math.exp(-dt * 4) * Math.sin(25 * dt); // knees absorbing
      }
    }
    if (o.kind === 'spin') spin = t > 2 && t < n / sr - 2 ? o.value : 0;
    ch.ax.push(0.05 * r.gauss());
    ch.ay.push(0.05 * r.gauss());
    ch.az.push(9.81 + bounce + jolt + 0.05 * r.gauss());
    ch.gx.push(0.01 * r.gauss());
    ch.gy.push(0.01 * r.gauss());
    ch.gz.push(spin + 0.01 * r.gauss());
  }
  return createRecording({
    experimentId: 'custom',
    sensor: 'motion',
    sampleRate: sr,
    channels: ch,
    params: {},
    meta: { synthetic: true, note: `Simulated ${o.kind}` },
  });
}

export function synthTone(o: { frequency: number; seconds?: number; sampleRate?: number; seed?: number }): Recording {
  const sr = o.sampleRate ?? 8000;
  const n = Math.round((o.seconds ?? 3) * sr);
  const r = rng(o.seed ?? 5);
  const audio = Float64Array.from({ length: n }, (_, i) => {
    const t = i / sr;
    // A plucked string: fundamental plus weaker harmonics, slowly decaying.
    const env = Math.exp(-t / 2);
    return env * (0.4 * Math.sin(2 * Math.PI * o.frequency * t) + 0.15 * Math.sin(4 * Math.PI * o.frequency * t)) + 0.01 * r.gauss();
  });
  return createRecording({
    experimentId: 'custom',
    sensor: 'audio',
    sampleRate: sr,
    channels: { audio },
    params: {},
    meta: { synthetic: true, note: `Simulated tone at ${o.frequency} Hz` },
  });
}
