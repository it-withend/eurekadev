import { decimate, linearRegression, lowPass, type LinearFit } from '@dsp/index';
import { readParam } from '@core/params';
import type { AnalysisResult, ParamSpec, Recording } from '@core/types';
import { ACCEL, GYRO, fmt, line, points, timeAxis } from '../shared';

export const centripetalParams: ParamSpec[] = [
  { kind: 'number', id: 'radius', label: 'Radius r (ruler)', unit: 'cm', scale: 0.01, default: 25, min: 2, max: 200, step: 0.5, help: 'Distance from the spin axis to the centre of the phone.' },
  { kind: 'number', id: 'radiusUncertainty', label: 'Radius uncertainty Δr', unit: 'cm', scale: 0.01, default: 0.5, min: 0, max: 10, step: 0.1 },
];

const MIN_OMEGA = 1.5; // rad/s — below this the centripetal signal drowns in noise.
const FIT_RATE = 10; // Hz — thin samples so neighbouring points are not strongly correlated.
const CM = 100;
/** Where the accelerometer chip sits inside the phone is unknown: ±1 cm of radius. */
const SENSOR_POSITION_UNCERTAINTY = 0.01;

/**
 * Verifies a = ω²r while a chair spins at varying speed.
 *
 * Deliberately independent of axis labels and phone orientation (browsers
 * disagree on how gyroscope axes are named, and seats tilt):
 * - ω is the magnitude of the gyroscope vector, the same in any labelling;
 * - in the phone's frame both gravity and the centripetal acceleration point
 *   in fixed directions, so every accelerometer axis obeys aᵢ = gᵢ + cᵢ·ω².
 *   Fitting each axis against ω² splits them: the intercepts form gravity,
 *   the slopes form a vector whose length is the radius.
 */
export function analyzeCentripetal(rec: Recording): AnalysisResult {
  const rRuler = readParam(rec.params, centripetalParams, 'radius');
  const dr = readParam(rec.params, centripetalParams, 'radiusUncertainty');
  const sr = rec.sampleRate;
  const warnings: string[] = [];

  const gyro = GYRO.map((c) => rec.channels[c]);
  const accel = ACCEL.map((c) => rec.channels[c]);
  if (gyro.some((c) => !c) || accel.some((c) => !c)) {
    return { ok: false, error: 'Recording is missing motion channels.' };
  }

  const n = gyro[0].length;
  const omegaRaw = Float64Array.from({ length: n }, (_, i) => Math.hypot(gyro[0][i], gyro[1][i], gyro[2][i]));
  const omega = lowPass(omegaRaw, sr, 2);
  const factor = Math.max(1, Math.round(sr / FIT_RATE));
  const w = decimate(omega, factor);
  const a = accel.map((c) => decimate(lowPass(c, sr, 2), factor));

  const keep: number[] = [];
  for (let i = 0; i < w.length; i++) if (w[i] >= MIN_OMEGA) keep.push(i);
  if (keep.length < 15) {
    return {
      ok: false,
      error: 'Not enough fast spinning was recorded.',
      hint: `Spin faster (above ${MIN_OMEGA} rad/s, about one turn every 4 s) for most of the recording.`,
    };
  }
  const x = keep.map((i) => w[i] ** 2);
  const xSpread = Math.max(...x) - Math.min(...x);
  if (xSpread < 2) {
    return {
      ok: false,
      error: 'The spin speed barely changed.',
      hint: 'The method needs different speeds: spin hard, then let the chair slow down by itself.',
    };
  }

  const fits: LinearFit[] = a.map((axis) => linearRegression(x, keep.map((i) => axis[i])));
  const slope = fits.map((f) => f.slope);
  const r = Math.hypot(...slope);
  const dFit = Math.sqrt(fits.reduce((s, f, k) => s + ((slope[k] / r) * f.slopeStdErr) ** 2, 0));
  const dR = Math.hypot(dFit, SENSOR_POSITION_UNCERTAINTY);
  const gravity = Math.hypot(...fits.map((f) => f.intercept));

  // Project onto the centripetal direction: the scalar a_c the student can plot.
  const dir = slope.map((s) => s / r);
  const ac = keep.map((i) => a.reduce((s, axis, k) => s + (axis[i] - fits[k].intercept) * dir[k], 0));
  const scalar = linearRegression(x, ac);

  if (scalar.r2 < 0.9) {
    warnings.push(`The points are scattered (R² = ${fmt(scalar.r2, 2)}). Tape the phone down firmly and spin smoothly.`);
  }
  if (Math.abs(gravity - 9.81) > 0.4) {
    warnings.push(`The phone measured gravity as ${fmt(gravity, 2)} m/s² instead of ≈ 9.8 — the phone may have moved during the spin.`);
  }

  const xMax = Math.max(...x);
  const t = timeAxis(omega.length, sr);
  return {
    ok: true,
    primary: {
      quantity: 'Radius from a = ω²r',
      symbol: 'r',
      measured: r * CM,
      uncertainty: dR * CM,
      accepted: rRuler * CM,
      acceptedUncertainty: dr * CM,
      acceptedSource: 'your ruler measurement',
      unit: 'cm',
      digits: 1,
    },
    measurements: [
      { label: 'Linearity of a vs ω² (R²)', value: scalar.r2, unit: '', digits: 3 },
      { label: 'Gravity seen by the phone (check)', value: gravity, unit: 'm/s²', digits: 2 },
      { label: 'Peak angular velocity', value: Math.sqrt(xMax), unit: 'rad/s', digits: 2 },
      { label: 'Points in fit', value: keep.length, unit: '', digits: 0 },
    ],
    charts: [
      {
        title: 'Centripetal acceleration vs ω²',
        xLabel: 'ω² (rad²/s²)',
        yLabel: 'a (m/s²)',
        series: [
          points('measurements', x, ac, 0),
          line('best fit a = rω²', [0, xMax], [scalar.intercept, scalar.intercept + scalar.slope * xMax], 1),
        ],
      },
      { title: 'Spin rate over time', xLabel: 'time (s)', yLabel: 'ω (rad/s)', series: [line('ω', t, omega, 2)] },
    ],
    steps: [
      `ω is the length of the gyroscope vector; ${keep.length} samples (thinned to ${FIT_RATE} Hz) with ω ≥ ${MIN_OMEGA} rad/s were used.`,
      `Each accelerometer axis was fitted as a = (constant) + (slope)·ω². The constants add up to gravity, ${fmt(gravity, 2)} m/s² — a built-in check that the phone stayed put.`,
      `The slopes form a vector of length ${fmt(r, 4)} m: the part of the acceleration that grows with ω².`,
      `Newton’s second law for circular motion, a = ω²r, says that length is the radius: r = ${fmt(r * CM, 1)} cm (fit quality R² = ${fmt(scalar.r2, 3)}).`,
      `Uncertainty: ± ${fmt(dFit * CM, 1)} cm from the fit, combined with ± ${fmt(SENSOR_POSITION_UNCERTAINTY * CM, 0)} cm because the sensor’s exact position inside the phone is unknown → ± ${fmt(dR * CM, 1)} cm.`,
    ],
    warnings,
    values: { r, gravity, r2: scalar.r2 },
  };
}
