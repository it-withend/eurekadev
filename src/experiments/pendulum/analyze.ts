import {
  bandPower,
  detrend,
  dominantFrequency,
  estimatePeriod,
  linearRegression,
  lowPass,
  nextPow2,
  powerSpectrum,
  std,
  variance,
} from '@dsp/index';
import { readParam } from '@core/params';
import type { AnalysisResult, ParamSpec, Recording, TrialData } from '@core/types';
import { ACCEL, GYRO, dominantChannel, fmt, line, points, timeAxis } from '../shared';

export const STANDARD_GRAVITY = 9.80665;
/** Local g ranges from ≈ 9.78 (equator) to 9.83 m/s² (poles); we do not know where the student is. */
const LOCAL_G_SPREAD = 0.025;

export const pendulumParams: ParamSpec[] = [
  {
    kind: 'number',
    id: 'length',
    label: 'Pendulum length L',
    unit: 'cm',
    scale: 0.01,
    default: 100,
    min: 10,
    max: 500,
    step: 0.5,
    help: 'From the pivot point to the centre of the phone.',
  },
  {
    kind: 'number',
    id: 'lengthUncertainty',
    label: 'Length uncertainty ΔL',
    unit: 'cm',
    scale: 0.01,
    default: 0.5,
    min: 0,
    max: 10,
    step: 0.1,
    help: 'How precisely you could measure L. 0.5 cm is typical for a tape measure.',
  },
];

/**
 * Measures g from a phone swinging as a pendulum.
 *
 * 1. Pick the gyroscope axis that oscillates most (the swing axis).
 * 2. Remove bias/drift and low-pass at 3 Hz (zero-phase, so timing is kept).
 * 3. Period T from upward zero crossings; cross-checked with an FFT.
 * 4. Swing amplitude θ₀ ≈ ω_max·T/2π; correct T to its small-angle value
 *    with the series T = T₀(1 + θ₀²/16 + 11θ₀⁴/3072).
 * 5. g = 4π²L/T₀², with first-order uncertainty propagation.
 */
export function analyzePendulum(rec: Recording): AnalysisResult {
  const L = readParam(rec.params, pendulumParams, 'length');
  const dL = readParam(rec.params, pendulumParams, 'lengthUncertainty');
  const sr = rec.sampleRate;
  const warnings: string[] = [];

  const hasGyro = dominantChannel(rec, GYRO).variance > 1e-4;
  if (!hasGyro) warnings.push('No gyroscope signal: using the accelerometer, so the large-swing correction is skipped.');
  // String tension (seen by the accelerometer) peaks at both ends of the swing:
  // it oscillates twice per period, so its period is T/2.
  const periodFactor = hasGyro ? 1 : 2;
  const source = pickSwingAxis(rec, hasGyro ? GYRO : ACCEL, L, periodFactor);
  if (!source) {
    return { ok: false, error: 'No swinging motion detected.', hint: 'Let the phone swing freely on the string while recording.' };
  }
  const signal = source.signal;
  const est = estimatePeriod(signal, sr);
  if (!est || est.cycles < 3) {
    return { ok: false, error: 'Fewer than 3 full swings were found.', hint: 'Record for longer and keep the swing going.' };
  }
  if (est.rejected > est.cycles / 3) warnings.push(`${est.rejected} irregular swings were discarded — try a smoother swing.`);

  const T = est.period * periodFactor;
  const dT = Math.max(est.uncertainty, 0.5 / sr / Math.sqrt(est.cycles)) * periodFactor;

  let theta0 = 0;
  let correction = 1;
  if (hasGyro) {
    // Robust peak angular velocity: 95th percentile of |ω| avoids noise spikes.
    const abs = Array.from(signal, Math.abs).sort((a, b) => a - b);
    const omegaMax = abs[Math.floor(abs.length * 0.95)];
    theta0 = (omegaMax * T) / (2 * Math.PI);
    correction = 1 + theta0 ** 2 / 16 + (11 * theta0 ** 4) / 3072;
    if (theta0 > 0.6) warnings.push(`Large swing (≈${fmt((theta0 * 180) / Math.PI, 0)}°). Smaller swings (< 15°) are more accurate.`);
  }
  const T0 = T / correction;
  const g = (4 * Math.PI ** 2 * L) / T0 ** 2;
  const relErr = Math.sqrt((dL / L) ** 2 + ((2 * dT) / T) ** 2);
  const dg = g * relErr;

  const fMaxSearch = 3 * periodFactor;
  const fft = dominantFrequency(signal, sr, { segmentSize: Math.min(signal.length, 4096), fMin: 0.1, fMax: fMaxSearch });
  const Tfft = fft ? periodFactor / fft.peak.frequency : NaN;
  if (fft && Math.abs(Tfft - T) / T > 0.05) {
    warnings.push(`FFT period (${fmt(Tfft)} s) disagrees with zero-crossing period — the motion may not be a clean swing.`);
  }
  if (std(signal) < 0.05) warnings.push('The swing is very small; the signal is close to the sensor noise.');

  const t = timeAxis(signal.length, sr);
  const crossingsY = est.crossings.map(() => 0);
  const charts = [
    {
      title: hasGyro ? `Angular velocity (${source.name}, filtered)` : `String tension signal (${source.name}, filtered)`,
      xLabel: 'time (s)',
      yLabel: hasGyro ? 'ω (rad/s)' : 'a (m/s²)',
      caption: hasGyro
        ? 'Each wave is one swing: how fast the phone was rotating back and forth. Orange dots mark the start of each swing — the time between two dots is the period T.'
        : 'The string tension rises at the bottom of every swing, so this signal wiggles twice per swing. Orange dots mark the cycles used to time it.',
      series: [line('signal', t, signal, 0), points('zero crossings', est.crossings, crossingsY, 1)],
    },
  ];
  if (fft) {
    const { freqs, power } = fft.spectrum;
    const lim = freqs.findIndex((f) => f > fMaxSearch);
    charts.push({
      title: 'Frequency spectrum',
      caption: 'The same motion split into frequencies. The tall peak is how many times per second the pendulum swings — a second, independent way to find T.',
      xLabel: 'frequency (Hz)',
      yLabel: 'power',
      series: [line('spectrum', freqs.subarray(0, lim), power.subarray(0, lim), 2)],
    });
  }

  return {
    ok: true,
    primary: {
      quantity: 'Gravitational acceleration',
      symbol: 'g',
      measured: g,
      uncertainty: dg,
      accepted: STANDARD_GRAVITY,
      acceptedUncertainty: LOCAL_G_SPREAD,
      acceptedSource: 'standard gravity (local g varies 9.78–9.83 m/s²)',
      unit: 'm/s²',
      digits: 3,
    },
    measurements: [
      { label: 'Measured period T', value: T, uncertainty: dT, unit: 's', digits: 4 },
      { label: 'Full swings analysed', value: est.cycles, unit: '', digits: 0 },
      { label: 'Swing amplitude θ₀', value: (theta0 * 180) / Math.PI, unit: '°', digits: 1 },
      { label: 'Small-angle period T₀', value: T0, unit: 's', digits: 4 },
      { label: 'FFT cross-check period', value: Tfft, unit: 's', digits: 4 },
    ],
    charts,
    steps: [
      hasGyro
        ? `Found ${est.cycles} full swings on the ${source.name} axis; mean period T = ${fmt(T, 4)} ± ${fmt(dT, 4)} s.`
        : `Found ${est.cycles} tension cycles on ${source.name}; tension peaks twice per swing, so T = 2 × ${fmt(est.period, 4)} = ${fmt(T, 4)} ± ${fmt(dT, 4)} s.`,
      hasGyro
        ? `Peak angular velocity gives amplitude θ₀ ≈ ${fmt((theta0 * 180) / Math.PI, 1)}°, so T₀ = T / (1 + θ₀²/16 + …) = ${fmt(T0, 4)} s.`
        : 'Amplitude unknown without a gyroscope: assuming small swings, T₀ = T.',
      `g = 4π²L / T₀² = 4π² × ${fmt(L, 3)} / ${fmt(T0, 4)}² = ${fmt(g, 3)} m/s².`,
      `Δg/g = √((ΔL/L)² + (2ΔT/T)²) = ${fmt(relErr * 100, 2)} %, so Δg = ${fmt(dg, 3)} m/s².`,
    ],
    warnings,
    values: { L, T, T0, dT, g },
  };
}

/**
 * The swing axis is the one with the most power near the frequency a pendulum
 * of the entered length should have (g anywhere in ≈ 6–16 m/s²). This ignores
 * twisting of the phone on the string, which happens at other frequencies.
 * L only selects the axis; it does not bias the measured period.
 */
function pickSwingAxis(rec: Recording, axes: readonly string[], L: number, periodFactor: number) {
  const sr = rec.sampleRate;
  const fExpected = (periodFactor * Math.sqrt(STANDARD_GRAVITY / L)) / (2 * Math.PI);
  let best: { name: string; signal: Float64Array; score: number } | null = null;
  for (const name of axes) {
    const data = rec.channels[name];
    if (!data || variance(data) < 1e-4) continue;
    // Ignore the first second: hands releasing the phone.
    const skip = Math.min(Math.round(sr), Math.floor(data.length / 4));
    const signal = lowPass(detrend(data.slice(skip)), sr, 3 * periodFactor);
    const score = bandPower(powerSpectrum(signal, sr, nextPow2(signal.length) * 2), fExpected * 0.78, fExpected * 1.28);
    if (!best || score > best.score) best = { name, signal, score };
  }
  return best;
}

/**
 * Several trials: if the length was varied (≥ 3 different lengths), fit
 * T₀² = (4π²/g)·L — the classic school investigation — and get g from the
 * slope. This also cancels a constant error in where L is measured from,
 * which ends up in the intercept instead of in g.
 */
export function summarizePendulum(trials: TrialData[]): AnalysisResult | null {
  const pts = trials
    .map((t) => ({ L: t.result.values?.L, T0: t.result.values?.T0 }))
    .filter((p): p is { L: number; T0: number } => p.L !== undefined && p.T0 !== undefined);
  const lengths = pts.map((p) => p.L);
  const distinct = new Set(lengths.map((l) => l.toFixed(3))).size;
  if (distinct < 3 || Math.max(...lengths) / Math.min(...lengths) < 1.3) return null;

  const x = lengths;
  const y = pts.map((p) => p.T0 ** 2);
  const fit = linearRegression(x, y);
  const g = (4 * Math.PI ** 2) / fit.slope;
  const dg = (g * fit.slopeStdErr) / fit.slope;
  const xMax = Math.max(...x) * 1.05;
  return {
    ok: true,
    primary: {
      quantity: 'Gravitational acceleration from T² vs L',
      symbol: 'g',
      measured: g,
      uncertainty: dg,
      accepted: STANDARD_GRAVITY,
      acceptedUncertainty: LOCAL_G_SPREAD,
      acceptedSource: 'standard gravity (local g varies 9.78–9.83 m/s²)',
      unit: 'm/s²',
      digits: 3,
    },
    measurements: [
      { label: 'Slope 4π²/g', value: fit.slope, uncertainty: fit.slopeStdErr, unit: 's²/m', digits: 4 },
      { label: 'Intercept', value: fit.intercept, uncertainty: fit.interceptStdErr, unit: 's²', digits: 4 },
      { label: 'Linearity (R²)', value: fit.r2, unit: '', digits: 4 },
      { label: 'Different lengths', value: distinct, unit: '', digits: 0 },
    ],
    charts: [
      {
        title: 'Period² against length',
        caption: 'Each dot is one trial. Theory says longer pendulums swing slower so that T² grows in a straight line with L. The steepness of the line gives g.',
        xLabel: 'L (m)',
        yLabel: 'T₀² (s²)',
        series: [
          { name: 'trials', x, y, style: 'points', color: 0 },
          { name: 'best fit', x: [0, xMax], y: [fit.intercept, fit.intercept + fit.slope * xMax], style: 'line', color: 1 },
        ],
      },
    ],
    steps: [
      `Squaring T = 2π√(L/g) gives T² = (4π²/g)·L: a straight line through the origin.`,
      `Least-squares fit of ${pts.length} trials: T₀² = ${fmt(fit.slope, 4)}·L + ${fmt(fit.intercept, 4)}, R² = ${fmt(fit.r2, 4)}.`,
      `g = 4π² / slope = 4π² / ${fmt(fit.slope, 4)} = ${fmt(g, 3)} ± ${fmt(dg, 3)} m/s².`,
      `A non-zero intercept means L was measured to the wrong point by a constant offset — the slope (and g) is unaffected.`,
    ],
    warnings: fit.r2 < 0.99 ? [`Points are scattered (R² = ${fmt(fit.r2, 3)}). Repeat trials that look off.`] : [],
  };
}
