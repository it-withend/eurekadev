import { dominantFrequency } from '@dsp/fft';
import { readParam } from '@core/params';
import type { AnalysisResult, ParamSpec, Recording } from '@core/types';
import { fmt, line, points, timeAxis } from '../shared';

export const CLOSED = 0;
export const OPEN = 1;

export const resonanceParams: ParamSpec[] = [
  { kind: 'number', id: 'length', label: 'Tube length L', unit: 'cm', scale: 0.01, default: 30, min: 5, max: 300, step: 0.1, help: 'Inside length of the air column (for a glass: from the bottom inside to the rim).' },
  { kind: 'number', id: 'diameter', label: 'Inner diameter d', unit: 'cm', scale: 0.01, default: 4, min: 0.5, max: 30, step: 0.1 },
  { kind: 'number', id: 'temperature', label: 'Air temperature', unit: '°C', default: 20, min: -20, max: 45, step: 0.5, help: 'Room temperature; used for the reference value.' },
  {
    kind: 'choice',
    id: 'mode',
    label: 'Tube type',
    default: CLOSED,
    options: [
      { value: CLOSED, label: 'Closed at one end (glass, bottle-shaped tube)' },
      { value: OPEN, label: 'Open at both ends (pipe, paper roll)' },
    ],
  },
  { kind: 'number', id: 'lengthUncertainty', label: 'Length uncertainty ΔL', unit: 'cm', scale: 0.01, default: 0.2, min: 0, max: 5, step: 0.1 },
];

/** Speed of sound in dry air, ideal-gas temperature dependence. */
export function speedOfSound(celsius: number): number {
  return 331.3 * Math.sqrt(1 + celsius / 273.15);
}

/**
 * Speed of sound from the fundamental resonance of an air column.
 * Closed tube: λ/4 fits the effective length; open tube: λ/2. The antinode
 * sits slightly outside each open end — the end correction 0.3·d per open end.
 */
export function analyzeResonance(rec: Recording): AnalysisResult {
  const p = (id: string) => readParam(rec.params, resonanceParams, id);
  const L = p('length');
  const d = p('diameter');
  const temp = p('temperature');
  const dL = p('lengthUncertainty');
  const closed = p('mode') === CLOSED;
  const audio = rec.channels.audio;
  const sr = rec.sampleRate;
  const warnings: string[] = [];

  if (!audio || audio.length < sr * 0.5) {
    return { ok: false, error: 'Not enough audio recorded.' };
  }

  const vRef = speedOfSound(temp);
  const Leff = closed ? L + 0.3 * d : L + 0.6 * d;
  const factor = closed ? 4 : 2;
  const fExpected = vRef / (factor * Leff);
  // Search around the expected fundamental, but wide enough (½–1.6×) to
  // be honest: a wrong length would show up as a large error, not be hidden.
  const fMin = Math.max(40, fExpected * 0.5);
  const fMax = Math.min(sr / 2 - 50, fExpected * 1.6);
  const segment = sr >= 6000 ? 4096 : 2048;
  const res = dominantFrequency(audio, sr, { segmentSize: Math.min(segment, audio.length), fMin, fMax });
  if (!res) return { ok: false, error: 'Could not analyse the spectrum.' };
  if (res.peak.prominenceDb < 8) {
    warnings.push(`The resonance is weak (${fmt(res.peak.prominenceDb, 1)} dB above background). Blow more steadily or move closer.`);
  }

  const f = res.peak.frequency;
  const df = res.uncertainty;
  const v = factor * f * Leff;
  const dLeff = Math.sqrt(dL ** 2 + (0.3 * 0.001) ** 2);
  const relErr = Math.sqrt((df / f) ** 2 + (dLeff / Leff) ** 2);
  const dv = v * relErr;

  const { freqs, power } = res.spectrum;
  const top = Math.min(freqs.length, Math.ceil(Math.max(2000, fExpected * 4) / res.spectrum.binWidth));
  const db = Array.from(power.subarray(0, top), (x) => 10 * Math.log10(x + 1e-20));
  const peakDb = 10 * Math.log10(res.peak.power + 1e-20);
  const t = timeAxis(audio.length, sr);

  return {
    ok: true,
    primary: {
      quantity: 'Speed of sound',
      symbol: 'v',
      measured: v,
      uncertainty: dv,
      accepted: vRef,
      acceptedSource: `dry air at ${fmt(temp, 1)} °C, v = 331.3·√(1 + T/273.15)`,
      unit: 'm/s',
      digits: 1,
    },
    measurements: [
      { label: 'Resonant frequency f', value: f, uncertainty: df, unit: 'Hz', digits: 1 },
      { label: 'Effective length L + end correction', value: Leff, unit: 'm', digits: 4 },
      { label: 'Expected frequency at this temperature', value: fExpected, unit: 'Hz', digits: 1 },
      { label: 'Peak prominence', value: res.peak.prominenceDb, unit: 'dB', digits: 1 },
      { label: 'Spectra averaged (Welch)', value: res.spectrum.segments.length, unit: '', digits: 0 },
    ],
    charts: [
      {
        title: 'Sound spectrum',
        xLabel: 'frequency (Hz)',
        yLabel: 'power (dB)',
        series: [line('spectrum', freqs.subarray(0, top), db, 0), points('resonance', [f], [peakDb], 1)],
      },
      { title: 'Recorded sound', xLabel: 'time (s)', yLabel: 'amplitude', series: [line('audio', t, audio, 2)] },
    ],
    steps: [
      `Averaged ${res.spectrum.segments.length} windowed FFT spectra (Welch's method, ${fmt(res.spectrum.binWidth, 2)} Hz bins).`,
      `Strongest resonance at f = ${fmt(f, 1)} ± ${fmt(df, 1)} Hz (sub-bin parabolic interpolation).`,
      `${closed ? 'Closed' : 'Open'} tube: L_eff = L + ${closed ? '0.3d' : '0.6d'} = ${fmt(Leff, 4)} m, and λ = ${factor}·L_eff.`,
      `v = f·λ = ${factor} × ${fmt(f, 1)} × ${fmt(Leff, 4)} = ${fmt(v, 1)} m/s.`,
      `Δv/v = √((Δf/f)² + (ΔL/L)²) = ${fmt(relErr * 100, 2)} %, so Δv = ${fmt(dv, 1)} m/s.`,
    ],
    warnings,
  };
}
