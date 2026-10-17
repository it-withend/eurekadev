import { detrend, dominantFrequency, estimatePeriod, lowPass, std } from '@dsp/index';
import { readParam } from '@core/registry';
import type { AnalysisResult, Recording, ParamSpec } from '@core/types';
import { ACCEL, GYRO, dominantChannel, fmt, line, points, timeAxis } from '../shared';

export const STANDARD_GRAVITY = 9.80665;

export const pendulumParams: ParamSpec[] = [
  {
    kind: 'number',
    id: 'length',
    label: 'Pendulum length L',
    unit: 'm',
    default: 1,
    min: 0.1,
    max: 5,
    step: 0.01,
    help: 'From the pivot point to the centre of the phone.',
  },
  {
    kind: 'number',
    id: 'lengthUncertainty',
    label: 'Length uncertainty ΔL',
    unit: 'm',
    default: 0.005,
    min: 0,
    max: 0.1,
    step: 0.001,
    help: 'How precisely you measured L (half the smallest ruler division is a fair start).',
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

  let source = dominantChannel(rec, GYRO);
  const hasGyro = source.variance > 1e-4;
  if (!hasGyro) {
    source = dominantChannel(rec, ACCEL);
    warnings.push('No gyroscope signal: using the accelerometer, so the large-swing correction is skipped.');
  }
  if (source.variance < 1e-4) {
    return { ok: false, error: 'No swinging motion detected.', hint: 'Let the phone swing freely on the string while recording.' };
  }

  // Ignore the first second: hands releasing the phone.
  const skip = Math.min(Math.round(sr), Math.floor(source.data.length / 4));
  const raw = source.data.slice(skip);
  const signal = lowPass(detrend(raw), sr, 3);
  const est = estimatePeriod(signal, sr);
  if (!est || est.cycles < 3) {
    return { ok: false, error: 'Fewer than 3 full swings were found.', hint: 'Record for longer and keep the swing going.' };
  }
  if (est.rejected > est.cycles / 3) warnings.push(`${est.rejected} irregular swings were discarded — try a smoother swing.`);

  const T = est.period;
  const dT = Math.max(est.uncertainty, 0.5 / sr / Math.sqrt(est.cycles));

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

  const fft = dominantFrequency(signal, sr, { segmentSize: Math.min(signal.length, 4096), fMin: 0.1, fMax: 3 });
  const Tfft = fft ? 1 / fft.peak.frequency : NaN;
  if (fft && Math.abs(Tfft - T) / T > 0.05) {
    warnings.push(`FFT period (${fmt(Tfft)} s) disagrees with zero-crossing period — the motion may not be a clean swing.`);
  }
  if (std(signal) < 0.05) warnings.push('The swing is very small; the signal is close to the sensor noise.');

  const t = timeAxis(signal.length, sr);
  const crossingsY = est.crossings.map(() => 0);
  const charts = [
    {
      title: `Angular velocity (${source.name}, filtered)`,
      xLabel: 'time (s)',
      yLabel: hasGyro ? 'ω (rad/s)' : 'a (m/s²)',
      series: [line('signal', t, signal, 0), points('zero crossings', est.crossings, crossingsY, 1)],
    },
  ];
  if (fft) {
    const { freqs, power } = fft.spectrum;
    const lim = freqs.findIndex((f) => f > 3);
    charts.push({
      title: 'Frequency spectrum',
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
      `Found ${est.cycles} full swings on the ${source.name} axis; mean period T = ${fmt(T, 4)} ± ${fmt(dT, 4)} s.`,
      hasGyro
        ? `Peak angular velocity gives amplitude θ₀ ≈ ${fmt((theta0 * 180) / Math.PI, 1)}°, so T₀ = T / (1 + θ₀²/16 + …) = ${fmt(T0, 4)} s.`
        : 'Amplitude unknown without a gyroscope: assuming small swings, T₀ = T.',
      `g = 4π²L / T₀² = 4π² × ${fmt(L, 3)} / ${fmt(T0, 4)}² = ${fmt(g, 3)} m/s².`,
      `Δg/g = √((ΔL/L)² + (2ΔT/T)²) = ${fmt(relErr * 100, 2)} %, so Δg = ${fmt(dg, 3)} m/s².`,
    ],
    warnings,
  };
}
