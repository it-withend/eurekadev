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
    ch.gx.push(om + bias + noise * r.gauss());
    ch.gy.push(noise * r.gauss());
    ch.gz.push(noise * r.gauss());
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
}): Recording {
  const sr = o.sampleRate ?? 100;
  const n = Math.round((o.seconds ?? 20) * sr);
  const w0 = o.omega0 ?? 7;
  const tau = o.decaySeconds ?? 9;
  const r = rng(o.seed ?? 3);
  const ch = { ax: [] as number[], ay: [] as number[], az: [] as number[], gx: [] as number[], gy: [] as number[], gz: [] as number[] };
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // Spin up during the first second, then friction slows the chair down.
    const w = t < 1 ? w0 * t : w0 * Math.exp(-(t - 1) / tau);
    const dw = t < 1 ? w0 : -w / tau;
    ch.gz.push(w + 0.02 * r.gauss());
    ch.gx.push(0.03 * r.gauss());
    ch.gy.push(0.03 * r.gauss());
    ch.ax.push(-w * w * o.radius + 0.08 * r.gauss());
    ch.ay.push(dw * o.radius + 0.08 * r.gauss());
    ch.az.push(9.81 + 0.08 * r.gauss());
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
