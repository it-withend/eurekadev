import { decimate, linearRegression, lowPass } from '@dsp/index';
import { readParam } from '@core/params';
import type { AnalysisResult, ParamSpec, Recording } from '@core/types';
import { ACCEL, GYRO, fmt, line, points, steadiestChannel, timeAxis } from '../shared';

export const centripetalParams: ParamSpec[] = [
  { kind: 'number', id: 'radius', label: 'Radius r (ruler)', unit: 'cm', scale: 0.01, default: 25, min: 2, max: 200, step: 0.5, help: 'Distance from the spin axis to the centre of the phone.' },
  { kind: 'number', id: 'radiusUncertainty', label: 'Radius uncertainty Δr', unit: 'cm', scale: 0.01, default: 0.5, min: 0, max: 10, step: 0.1 },
];

const MIN_OMEGA = 1.5; // rad/s — below this the centripetal signal drowns in noise.
const FIT_RATE = 10; // Hz — thin samples so neighbouring points are not strongly correlated.

/**
 * Verifies a = ω²r. While a spinning chair slows down, the gyroscope reads ω
 * and the accelerometer reads the inward acceleration a. Plotting a against
 * ω² must give a straight line through the origin whose slope is the radius.
 */
export function analyzeCentripetal(rec: Recording): AnalysisResult {
  const r = readParam(rec.params, centripetalParams, 'radius');
  const dr = readParam(rec.params, centripetalParams, 'radiusUncertainty');
  const sr = rec.sampleRate;
  const warnings: string[] = [];

  const axis = steadiestChannel(rec, GYRO);
  const axisIndex = GYRO.indexOf(axis.name as (typeof GYRO)[number]);
  // The two accelerometer axes perpendicular to the spin axis carry a_c.
  const perp = ACCEL.filter((_, i) => i !== axisIndex).map((c) => rec.channels[c]);
  if (perp.some((c) => !c)) return { ok: false, error: 'Recording is missing accelerometer channels.' };

  const omega = lowPass(axis.data.map(Math.abs), sr, 2);
  const a1 = lowPass(perp[0], sr, 2);
  const a2 = lowPass(perp[1], sr, 2);
  const accel = Float64Array.from(omega, (_, i) => Math.hypot(a1[i], a2[i]));

  const factor = Math.max(1, Math.round(sr / FIT_RATE));
  const w = decimate(omega, factor);
  const a = decimate(accel, factor);
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < w.length; i++) {
    if (w[i] >= MIN_OMEGA) {
      x.push(w[i] * w[i]);
      y.push(a[i]);
    }
  }
  if (x.length < 15) {
    return { ok: false, error: 'Not enough fast spinning was recorded.', hint: `Spin faster (above ${MIN_OMEGA} rad/s, about one turn every 4 s) and let it slow down naturally.` };
  }

  const fit = linearRegression(x, y);
  const rMeasured = fit.slope;
  const dRfit = fit.slopeStdErr;
  if (fit.r2 < 0.95) warnings.push(`The points are scattered (R² = ${fmt(fit.r2, 3)}). Keep the phone flat and fixed while spinning.`);
  if (Math.abs(fit.intercept) > 0.5) {
    warnings.push(`Fit does not pass through zero (intercept ${fmt(fit.intercept, 2)} m/s²) — the phone may be tilted or the sensor offset.`);
  }

  const xMax = Math.max(...x);
  const t = timeAxis(omega.length, sr);
  return {
    ok: true,
    primary: {
      quantity: 'Radius from a = ω²r',
      symbol: 'r',
      measured: rMeasured,
      uncertainty: dRfit,
      accepted: r,
      acceptedSource: `ruler measurement (± ${fmt(dr, 3)} m)`,
      unit: 'm',
      digits: 3,
    },
    measurements: [
      { label: 'Linearity of a vs ω² (R²)', value: fit.r2, unit: '', digits: 4 },
      { label: 'Intercept', value: fit.intercept, uncertainty: fit.interceptStdErr, unit: 'm/s²', digits: 3 },
      { label: 'Peak angular velocity', value: Math.sqrt(xMax), unit: 'rad/s', digits: 2 },
      { label: 'Points in fit', value: fit.n, unit: '', digits: 0 },
    ],
    charts: [
      {
        title: 'Centripetal acceleration vs ω²',
        xLabel: 'ω² (rad²/s²)',
        yLabel: 'a (m/s²)',
        series: [
          points('measurements', x, y, 0),
          line('best fit a = rω²', [0, xMax], [fit.intercept, fit.intercept + fit.slope * xMax], 1),
        ],
      },
      {
        title: `Spin rate (${axis.name}) over time`,
        xLabel: 'time (s)',
        yLabel: 'ω (rad/s)',
        series: [line('ω', t, omega, 2)],
      },
    ],
    steps: [
      `Spin axis detected: ${axis.name}. Centripetal acceleration taken from the two perpendicular accelerometer axes.`,
      `Kept ${fit.n} samples (thinned to ${FIT_RATE} Hz) with ω ≥ ${MIN_OMEGA} rad/s.`,
      `Least-squares fit: a = ${fmt(fit.slope, 4)}·ω² + ${fmt(fit.intercept, 3)}, R² = ${fmt(fit.r2, 4)}.`,
      `Newton’s second law for circular motion says a = ω²r, so the slope is the radius: r = ${fmt(rMeasured, 3)} ± ${fmt(dRfit, 3)} m.`,
    ],
    warnings,
  };
}
