/**
 * "A careful student, a real phone": simulations of correctly performed
 * experiments with the imperfections that happen anyway. Used to check that
 * PocketLab does not report an error, or a false "you got it wrong", when the
 * student did everything right.
 *
 * Imperfections modelled (all randomised per trial, seeded):
 *  - pendulum: phone held with a trembling hand before release, delayed release,
 *    phone hanging at an angle to the swing plane, slow twist on the string,
 *    damping, gyroscope bias, the phone being a 15 cm object (physical pendulum),
 *    local g between 9.78 and 9.83, tape-measure error;
 *  - chair: floor not level (axis tilt), seat vibration, accelerometer chip off
 *    the phone's centre, gyroscope bias, free or hand-pushed spins, ruler error;
 *  - tube: silence before blowing, strong low-frequency breath noise, mains hum,
 *    varying resonance sharpness, real end corrections, ruler and thermometer error.
 * Truth is generated at 400 Hz / 48 kHz and then delivered through a simulated
 * phone platform (see platforms.ts), exactly like real captures.
 */
import { applyBiquad, bandPassCoefficients, lowPass } from '@dsp/filters';
import { createRecording } from '@core/recording';
import type { Recording } from '@core/types';
import { rng } from './synthetic';

const TRUTH_RATE = 400;
const round = (v: number, step: number) => Math.round(v / step) * step;

export interface RealisticTrial {
  rec: Recording;
  /** What the student should get if the app is right. */
  truth: number;
}

/** Switches for isolating single imperfections in diagnostics. */
export interface PendulumImperfections {
  yaw: boolean;
  twist: boolean;
  hold: boolean;
  bias: boolean;
  damping: boolean;
}

export function realisticPendulum(seed: number, on: PendulumImperfections = { yaw: true, twist: true, hold: true, bias: true, damping: true }): RealisticTrial {
  const r = rng(seed);
  const g = 9.78 + 0.05 * r.uniform();
  const L = 0.5 + r.uniform(); // pivot → centre of the phone
  const phone = 0.15; // the phone is a 15 cm object, not a point
  const Leq = L + phone ** 2 / 12 / L; // physical-pendulum equivalent length
  const theta0 = ((8 + 12 * r.uniform()) * Math.PI) / 180;
  const hold = (0.3 + 0.9 * r.uniform()) * (on.hold ? 1 : 0); // student releases a moment after the beep
  const q = on.damping ? 80 + 220 * r.uniform() : (r.uniform(), 1e9);
  const yaw = r.uniform() * Math.PI * (on.yaw ? 1 : 0); // phone hangs turned relative to the swing plane
  const twistAmp = 0.3 * r.uniform() * (on.twist ? 1 : 0);
  const twistPeriod = 3 + 3 * r.uniform();
  const bias = [0, 0, 0].map(() => 0.01 * r.gauss() * (on.bias ? 1 : 0));
  const n = Math.round(25 * TRUTH_RATE);
  const w0 = Math.sqrt(g / Leq);
  const damping = w0 / q;
  const ch = { ax: [] as number[], ay: [] as number[], az: [] as number[], gx: [] as number[], gy: [] as number[], gz: [] as number[] };
  let th = theta0;
  let om = 0;
  const h = 1 / TRUTH_RATE / 4;
  const f = (t: number, w: number) => -(g / Leq) * Math.sin(t) - damping * w;
  for (let i = 0; i < n; i++) {
    const t = i / TRUTH_RATE;
    let swing = om;
    if (t < hold) swing = 0.05 * Math.sin(2 * Math.PI * 9 * t) + 0.03 * r.gauss(); // trembling hand
    const twist = twistAmp * Math.sin((2 * Math.PI * t) / twistPeriod);
    // Swing axis is horizontal: split between the phone's x and z axes by the yaw angle.
    ch.gx.push(swing * Math.cos(yaw) + bias[0] + 0.005 * r.gauss());
    ch.gy.push(twist + bias[1] + 0.005 * r.gauss());
    ch.gz.push(swing * Math.sin(yaw) + bias[2] + 0.005 * r.gauss());
    const tension = t < hold ? g : g * Math.cos(th) + L * om * om;
    ch.ax.push(0.03 * r.gauss());
    ch.ay.push(tension + 0.03 * r.gauss());
    ch.az.push(0.03 * r.gauss());
    if (t >= hold) {
      for (let s = 0; s < 4; s++) {
        const k1t = om, k1w = f(th, om);
        const k2t = om + (h / 2) * k1w, k2w = f(th + (h / 2) * k1t, om + (h / 2) * k1w);
        const k3t = om + (h / 2) * k2w, k3w = f(th + (h / 2) * k2t, om + (h / 2) * k2w);
        const k4t = om + h * k3w, k4w = f(th + h * k3t, om + h * k3w);
        th += (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
        om += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
      }
    }
  }
  const entered = round(L + 0.005 * r.gauss(), 0.005); // tape measure, read to 5 mm
  return {
    rec: createRecording({
      experimentId: 'pendulum',
      sensor: 'motion',
      sampleRate: TRUTH_RATE,
      channels: ch,
      params: { length: entered, lengthUncertainty: 0.01 }, // the app's default
      meta: { synthetic: true },
    }),
    truth: 9.80665,
  };
}

export function realisticChair(seed: number): RealisticTrial {
  const r = rng(seed);
  const rRuler = 0.15 + 0.25 * r.uniform(); // spin axis → centre of the phone
  const chipAngle = 2 * Math.PI * r.uniform();
  const chipOffset = 0.015 * r.uniform(); // accelerometer chip is not at the phone's centre
  const rChip = Math.hypot(rRuler + chipOffset * Math.cos(chipAngle), chipOffset * Math.sin(chipAngle));
  const tilt = ((2 * r.uniform()) * Math.PI) / 180; // floor not quite level
  const pushed = r.uniform() < 0.5;
  const w0 = 4 + 4 * r.uniform();
  const tau = 6 + 6 * r.uniform();
  const wobble = 0.1 + 0.2 * r.uniform();
  const wobbleF = 3 + 5 * r.uniform();
  const bias = [0, 0, 0].map(() => 0.01 * r.gauss());
  const n = Math.round(20 * TRUTH_RATE);
  const ch = { ax: [] as number[], ay: [] as number[], az: [] as number[], gx: [] as number[], gy: [] as number[], gz: [] as number[] };
  const speed = (t: number) =>
    pushed ? Math.min(w0 * t, 0.6 * w0 + 0.25 * w0 * Math.sin((2 * Math.PI * t) / 3.2)) : t < 1 ? w0 * t : w0 * Math.exp(-(t - 1) / tau);
  let phi = 0;
  for (let i = 0; i < n; i++) {
    const t = i / TRUTH_RATE;
    const w = speed(t);
    const dw = (speed(t + 1e-3) - w) / 1e-3;
    phi += w / TRUTH_RATE;
    // Tilted axis: part of gravity lies in the seat plane and turns round once per revolution.
    const gx = 9.81 * Math.sin(tilt) * Math.cos(-phi);
    const gy = 9.81 * Math.sin(tilt) * Math.sin(-phi);
    const vib = wobble * Math.sin(2 * Math.PI * wobbleF * t + 1.3);
    ch.ax.push(-w * w * rChip + gx + vib + 0.03 * r.gauss());
    ch.ay.push(dw * rChip + gy + 0.7 * vib + 0.03 * r.gauss());
    ch.az.push(9.81 * Math.cos(tilt) + 0.5 * vib + 0.03 * r.gauss());
    ch.gx.push(bias[0] + 0.005 * r.gauss());
    ch.gy.push(bias[1] + 0.005 * r.gauss());
    ch.gz.push(w + bias[2] + 0.005 * r.gauss());
  }
  const entered = round(rRuler + 0.003 * r.gauss(), 0.005);
  return {
    rec: createRecording({
      experimentId: 'centripetal',
      sensor: 'motion',
      sampleRate: TRUTH_RATE,
      channels: ch,
      params: { radius: entered, radiusUncertainty: 0.005 },
      meta: { synthetic: true },
    }),
    truth: entered * 100, // compared with what the student measured, as in the app
  };
}

export function realisticTube(seed: number, sampleRate = 48000): RealisticTrial {
  const r = rng(seed);
  const L = 0.12 + 0.18 * r.uniform();
  const d = 0.05 + 0.03 * r.uniform();
  const temp = 18 + 8 * r.uniform();
  const closed = r.uniform() < 0.6;
  const endCoef = 0.25 + 0.1 * r.uniform(); // real rims differ from the textbook 0.3
  const v = 331.3 * Math.sqrt(1 + temp / 273.15);
  const f0 = closed ? v / (4 * (L + endCoef * d)) : v / (2 * (L + 2 * endCoef * d));
  const q = 15 + 25 * r.uniform();
  const breath = 0.1 + 0.2 * r.uniform();
  const tone = 0.15 + 0.35 * r.uniform();
  const silence = 0.3 + 0.7 * r.uniform();
  const n = Math.round(4 * sampleRate);
  const white = Float64Array.from({ length: n }, () => r.gauss());
  // Breath is strongest at low frequencies.
  const rumble = lowPass(white, sampleRate, 250);
  const out = new Float64Array(n);
  const harmonics = closed ? [1, 3, 5] : [1, 2, 3];
  harmonics.forEach((hm, k) => {
    const ring = applyBiquad(white, bandPassCoefficients(sampleRate, f0 * hm, q));
    for (let i = 0; i < n; i++) out[i] += (tone / (1 + 2 * k)) * ring[i];
  });
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const blowing = t > silence ? 1 : 0;
    out[i] = blowing * (out[i] + breath * 3 * rumble[i]) + 0.01 * Math.sin(2 * Math.PI * 50 * t) + 0.005 * r.gauss();
  }
  return {
    rec: createRecording({
      experimentId: 'resonance',
      sensor: 'audio',
      sampleRate,
      channels: { audio: out },
      params: {
        length: round(L + 0.002 * r.gauss(), 0.001),
        diameter: round(d + 0.001 * r.gauss(), 0.001),
        temperature: Math.round(temp + 1.5 * r.gauss()),
        mode: closed ? 0 : 1,
        lengthUncertainty: 0.002,
      },
      meta: { synthetic: true },
    }),
    truth: v,
  };
}
