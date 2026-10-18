/**
 * Building blocks for student-made experiments: each "measure" pulls one
 * physical quantity out of a raw recording, without knowing what the student
 * is investigating. All of them are axis-label and sign independent, like the
 * built-in experiments (see docs/COMPATIBILITY.md).
 */
import {
  decimate,
  removeMean,
  dominantFrequency,
  estimatePeriod,
  lowPass,
  mean,
  median,
  standardError,
  std,
} from '@dsp/index';
import type { ChartSpec, Measurement, Recording, SensorKind } from '@core/types';
import { ACCEL, GYRO, fmt, line, points, timeAxis } from '../shared';

export type MeasureKind = 'period' | 'frequency' | 'pitch' | 'peak' | 'spin' | 'tiltMax' | 'tilt';

export type Extraction =
  | {
      ok: true;
      value: number;
      uncertainty: number;
      charts: ChartSpec[];
      steps: string[];
      measurements: Measurement[];
      warnings: string[];
    }
  | { ok: false; error: string; hint?: string };

export interface MeasureDef {
  id: MeasureKind;
  sensor: SensorKind;
  /** Variable name the formula uses for the measured value. */
  symbol: string;
  quantity: string;
  unit: string;
  /** What a student picks in the builder. */
  label: string;
  explain: string;
  examples: string;
  /** Typical value, for previewing formulas before any measurement. */
  example: number;
  extract: (rec: Recording) => Extraction;
}

/* ---------- oscillations (period / frequency) ---------- */

interface Oscillation {
  channel: string;
  signal: Float64Array;
  period: number;
  dPeriod: number;
  cycles: number;
  crossings: number[];
  prominenceDb: number;
}

/**
 * Finds the channel that oscillates most cleanly. Prominence (peak over median
 * spectral power, in dB) is unit-free, so gyroscope and accelerometer channels
 * compete fairly; the gyroscope wins ties because it sees rotation directly.
 */
function findOscillation(rec: Recording): Oscillation | null {
  const sr = rec.sampleRate;
  let best: (Oscillation & { score: number }) | null = null;
  for (const name of [...GYRO, ...ACCEL]) {
    const data = rec.channels[name];
    if (!data || std(data) < (name.startsWith('g') ? 0.02 : 0.1)) continue;
    const signal = lowPass(removeMean(data), sr, 8);
    const spec = dominantFrequency(signal, sr, { segmentSize: Math.min(signal.length, 2048), fMin: 0.1, fMax: 8 });
    if (!spec) continue;
    const score = spec.peak.prominenceDb + (name.startsWith('g') ? 3 : 0);
    if (best && score <= best.score) continue;
    const est = estimatePeriod(signal, sr);
    if (!est || est.cycles < 2) continue;
    best = {
      channel: name,
      signal,
      period: est.period,
      dPeriod: Math.max(est.uncertainty, 0.5 / sr / Math.sqrt(est.cycles)),
      cycles: est.cycles,
      crossings: est.crossings,
      prominenceDb: spec.peak.prominenceDb,
      score,
    };
  }
  return best;
}

function oscillationExtract(rec: Recording, as: 'period' | 'frequency'): Extraction {
  const o = findOscillation(rec);
  if (!o || o.cycles < 3) {
    return {
      ok: false,
      error: 'No regular back-and-forth motion was found.',
      hint: 'Make sure the phone moves with the oscillating object for at least 3 full cycles.',
    };
  }
  const warnings: string[] = [];
  if (o.prominenceDb < 10) warnings.push('The oscillation is weak compared with the noise; try a bigger swing or bounce.');
  const t = timeAxis(o.signal.length, rec.sampleRate);
  const f = 1 / o.period;
  const df = o.dPeriod / o.period ** 2;
  return {
    ok: true,
    value: as === 'period' ? o.period : f,
    uncertainty: as === 'period' ? o.dPeriod : df,
    charts: [
      {
        title: `Motion signal (${o.channel})`,
        caption: 'The sensor channel that oscillated most clearly. Orange dots mark the start of each cycle; the time between them is the period.',
        xLabel: 'time (s)',
        yLabel: o.channel.startsWith('g') ? 'ω (rad/s)' : 'a (m/s²)',
        series: [line('signal', t, o.signal, 0), points('cycle starts', o.crossings, o.crossings.map(() => 0), 1)],
      },
    ],
    steps: [
      `The ${o.channel.startsWith('g') ? 'gyroscope' : 'accelerometer'} channel ${o.channel} oscillated most clearly (${fmt(o.prominenceDb, 0)} dB above the noise).`,
      `${o.cycles} full cycles were timed between zero crossings: T = ${fmt(o.period, 4)} ± ${fmt(o.dPeriod, 4)} s${as === 'frequency' ? `, so f = 1/T = ${fmt(f, 4)} Hz` : ''}.`,
    ],
    measurements: [
      { label: 'Cycles timed', value: o.cycles, unit: '', digits: 0 },
      { label: as === 'period' ? 'Frequency (1/T)' : 'Period (1/f)', value: as === 'period' ? f : o.period, unit: as === 'period' ? 'Hz' : 's', digits: 4 },
    ],
    warnings,
  };
}

/* ---------- sound pitch ---------- */

function pitchExtract(rec: Recording): Extraction {
  const audio = rec.channels.audio;
  const sr = rec.sampleRate;
  if (!audio || audio.length < sr * 0.5) return { ok: false, error: 'Not enough sound was recorded.' };
  const res = dominantFrequency(audio, sr, { segmentSize: Math.min(sr >= 6000 ? 4096 : 2048, audio.length), fMin: 50, fMax: Math.min(4000, sr / 2 - 50) });
  if (!res) return { ok: false, error: 'Could not analyse the sound.' };
  const warnings = res.peak.prominenceDb < 10 ? ['The note is weak against the background; record closer to the sound in a quieter room.'] : [];
  const { freqs, power } = res.spectrum;
  const top = Math.min(freqs.length, Math.ceil(Math.min(4000, res.peak.frequency * 4) / res.spectrum.binWidth));
  const db = Array.from(power.subarray(0, top), (x) => 10 * Math.log10(x + 1e-20));
  return {
    ok: true,
    value: res.peak.frequency,
    uncertainty: res.uncertainty,
    charts: [
      {
        title: 'Sound spectrum',
        caption: 'Your sound split into pitches. The marked peak is the strongest pitch — its frequency is f.',
        xLabel: 'frequency (Hz)',
        yLabel: 'power (dB)',
        series: [line('spectrum', freqs.subarray(0, top), db, 0), points('strongest pitch', [res.peak.frequency], [10 * Math.log10(res.peak.power + 1e-20)], 1)],
      },
    ],
    steps: [
      `Averaged ${res.spectrum.segments.length} FFT spectra of the recording (${fmt(res.spectrum.binWidth, 2)} Hz resolution).`,
      `Strongest pitch: f = ${fmt(res.peak.frequency, 1)} ± ${fmt(res.uncertainty, 1)} Hz.`,
    ],
    measurements: [{ label: 'Peak prominence', value: res.peak.prominenceDb, unit: 'dB', digits: 1 }],
    warnings,
  };
}

/* ---------- peak acceleration ---------- */

/**
 * Sensor noise from the quietest half-second of the recording. Taking the
 * whole recording would count the activity itself (a crouch before a jump)
 * as "noise" — a real iPhone test reported 4.2 m/s² that way instead of ~0.05.
 */
function quietNoise(x: ArrayLike<number>, sampleRate: number): number {
  const win = Math.max(10, Math.round(sampleRate / 2));
  let best = Infinity;
  for (let start = 0; start + win <= x.length; start += Math.ceil(win / 2)) {
    best = Math.min(best, std(Array.prototype.slice.call(x, start, start + win) as number[]));
  }
  return Number.isFinite(best) ? best : std(x);
}

/** A 60 Hz sensor samples an impact only every 17 ms, so a sharp peak can be missed by a few percent. */
const PEAK_SAMPLING_UNCERTAINTY = 0.03;

function peakExtract(rec: Recording): Extraction {
  const [ax, ay, az] = ACCEL.map((c) => rec.channels[c]);
  if (!ax || !ay || !az) return { ok: false, error: 'Recording is missing accelerometer data.' };
  const mag = Float64Array.from(ax, (_, i) => Math.hypot(ax[i], ay[i], az[i]));
  // Gravity is always there: the jolt is how far |a| departs from its typical (resting) value.
  const rest = median(mag);
  const jolt = Float64Array.from(mag, (m) => m - rest);
  let peak = 0;
  let at = 0;
  for (let i = 0; i < jolt.length; i++) if (Math.abs(jolt[i]) > Math.abs(peak)) [peak, at] = [jolt[i], i];
  const noise = quietNoise(jolt, rec.sampleRate);
  if (Math.abs(peak) < 5 * noise) {
    return { ok: false, error: 'No clear jolt was found.', hint: 'The event must be stronger than the phone simply being held.' };
  }
  const t = timeAxis(jolt.length, rec.sampleRate);
  return {
    ok: true,
    value: Math.abs(peak),
    uncertainty: Math.hypot(noise, Math.abs(peak) * PEAK_SAMPLING_UNCERTAINTY),
    charts: [
      {
        title: 'Acceleration beyond gravity',
        caption: 'How much the phone felt pushed or pulled on top of normal gravity. The marked point is the biggest jolt.',
        xLabel: 'time (s)',
        yLabel: 'a − g (m/s²)',
        series: [line('jolt', t, jolt, 0), points('peak', [at / rec.sampleRate], [peak], 1)],
      },
    ],
    steps: [
      `Total acceleration |a| at rest was ${fmt(rest, 2)} m/s² (that is gravity).`,
      `The biggest departure from rest was ${fmt(Math.abs(peak), 2)} m/s² at t = ${fmt(at / rec.sampleRate, 2)} s (≈ ${fmt(Math.abs(peak) / 9.81, 1)} g).`,
      `Uncertainty: sensor noise (${fmt(noise, 3)} m/s², from the quietest moment) combined with ${PEAK_SAMPLING_UNCERTAINTY * 100} % because the sensor reads only every few milliseconds and can miss the very top of a sharp impact.`,
    ],
    measurements: [
      { label: 'Gravity at rest (check)', value: rest, unit: 'm/s²', digits: 2 },
      { label: 'Sensor noise', value: noise, unit: 'm/s²', digits: 3 },
    ],
    warnings: rec.meta?.eventRate && rec.meta.eventRate < 90 ? ['Short jolts can fall between sensor readings on this phone; the true peak may be higher.'] : [],
  };
}

/* ---------- rotation speed ---------- */

function spinExtract(rec: Recording): Extraction {
  const [gx, gy, gz] = GYRO.map((c) => rec.channels[c]);
  if (!gx || !gy || !gz) return { ok: false, error: 'Recording is missing gyroscope data.' };
  const omega = lowPass(Float64Array.from(gx, (_, i) => Math.hypot(gx[i], gy[i], gz[i])), rec.sampleRate, 2);
  const thinned = decimate(omega, Math.max(1, Math.round(rec.sampleRate / 5)));
  // Average the steady part only: starting and stopping would pull the mean down.
  const sorted = Array.from(thinned).sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  const moving = thinned.filter((w) => w > 0.3 && w > 0.85 * typical);
  if (moving.length < 5) {
    return {
      ok: false,
      error: 'The phone hardly rotated.',
      hint: rec.meta?.hasGyroscope === false ? 'This phone has no gyroscope.' : 'Spin it during the recording.',
    };
  }
  const w = mean(moving);
  return {
    ok: true,
    value: w,
    uncertainty: standardError(moving),
    charts: [
      {
        title: 'Rotation speed over time',
        caption: 'How fast the phone turned. Only the part where it was really spinning is averaged.',
        xLabel: 'time (s)',
        yLabel: 'ω (rad/s)',
        series: [line('ω', timeAxis(omega.length, rec.sampleRate), omega, 2)],
      },
    ],
    steps: [
      `ω is the length of the gyroscope vector; averaged over ${fmt(moving.length / 5, 1)} s of spinning: ω = ${fmt(w, 3)} rad/s.`,
    ],
    measurements: [{ label: 'Turns per minute', value: (w * 60) / (2 * Math.PI), unit: 'rpm', digits: 1 }],
    warnings: [],
  };
}

/* ---------- tilt angle ---------- */

/**
 * Angle between the phone's screen and the horizontal, from where gravity
 * points in the phone's frame: θ = atan2(|in-plane part|, |normal part|).
 * Sign- and axis-label independent (iOS reports the opposite sign).
 */
function tiltSeries(rec: Recording): Float64Array | null {
  const [ax, ay, az] = ACCEL.map((c) => rec.channels[c]);
  if (!ax || !ay || !az) return null;
  const sr = rec.sampleRate;
  const fx = lowPass(ax, sr, 2);
  const fy = lowPass(ay, sr, 2);
  const fz = lowPass(az, sr, 2);
  return Float64Array.from(fx, (_, i) => (Math.atan2(Math.hypot(fx[i], fy[i]), Math.abs(fz[i])) * 180) / Math.PI);
}

/** A phone resting on a surface is not perfectly parallel to it (case, camera bump): ±0.5°. */
const TILT_SEATING = 0.5;

function tiltExtract(rec: Recording, mode: 'max' | 'steady'): Extraction {
  const theta = tiltSeries(rec);
  if (!theta) return { ok: false, error: 'Recording is missing accelerometer data.' };
  const sr = rec.sampleRate;
  const t = timeAxis(theta.length, sr);
  const noise = quietNoise(theta, sr);
  if (mode === 'max') {
    // Largest angle before the phone slipped: while sliding it feels less of the slope, so the peak is just before.
    let peak = 0;
    let at = 0;
    for (let i = 0; i < theta.length; i++) if (theta[i] > peak) [peak, at] = [theta[i], i];
    if (peak < 2) return { ok: false, error: 'The surface was hardly tilted.', hint: 'Slowly lift one end of the surface until the phone starts to slide.' };
    return {
      ok: true,
      value: peak,
      uncertainty: Math.hypot(noise, TILT_SEATING),
      charts: [
        {
          title: 'Tilt angle over time',
          caption: 'How steep the surface was. The angle rises as you lift it; the marked point is the steepest angle just before the phone slid.',
          xLabel: 'time (s)',
          yLabel: 'angle (°)',
          series: [line('angle', t, theta, 0), points('slipped here', [at / sr], [peak], 1)],
        },
      ],
      steps: [
        `The tilt angle comes from where gravity points relative to the phone: θ = atan(in-plane part / perpendicular part).`,
        `Steepest angle before sliding: θ = ${fmt(peak, 1)}° at t = ${fmt(at / sr, 1)} s (± ${fmt(Math.hypot(noise, TILT_SEATING), 1)}°, mostly from how the phone sits on the surface).`,
      ],
      measurements: [{ label: 'Sensor noise', value: noise, unit: '°', digits: 2 }],
      warnings: [],
    };
  }
  // Steady angle: the median ignores the moments of putting the phone down and picking it up.
  const sorted = Array.from(theta).sort((a, b) => a - b);
  const mid = sorted[sorted.length >> 1];
  return {
    ok: true,
    value: mid,
    uncertainty: Math.hypot(noise, TILT_SEATING),
    charts: [
      {
        title: 'Tilt angle over time',
        caption: 'The angle of the surface the phone lay on. A flat line means the phone was steady.',
        xLabel: 'time (s)',
        yLabel: 'angle (°)',
        series: [line('angle', t, theta, 0)],
      },
    ],
    steps: [`The phone measured how its screen is tilted relative to the horizontal: typical value θ = ${fmt(mid, 1)}°.`],
    measurements: [{ label: 'Sensor noise', value: noise, unit: '°', digits: 2 }],
    warnings: [],
  };
}

export const MEASURES: Record<MeasureKind, MeasureDef> = {
  period: {
    id: 'period',
    sensor: 'motion',
    symbol: 'T',
    quantity: 'Period',
    unit: 's',
    label: 'Time of one swing or bounce (period T)',
    explain: 'Attach the phone to something that moves back and forth. PocketLab times each cycle.',
    examples: 'a swing, a spring with a weight, a ruler twanged on a table, a rocking chair',
    example: 1.5,
    extract: (r) => oscillationExtract(r, 'period'),
  },
  frequency: {
    id: 'frequency',
    sensor: 'motion',
    symbol: 'f',
    quantity: 'Frequency',
    unit: 'Hz',
    label: 'Swings or bounces per second (frequency f)',
    explain: 'Same as the period, expressed as cycles per second.',
    examples: 'a vibrating spring, a bouncing board',
    example: 0.8,
    extract: (r) => oscillationExtract(r, 'frequency'),
  },
  pitch: {
    id: 'pitch',
    sensor: 'audio',
    symbol: 'f',
    quantity: 'Pitch',
    unit: 'Hz',
    label: 'Pitch of a sound (frequency f)',
    explain: 'The microphone finds the strongest note in what it hears.',
    examples: 'a guitar string, a tuning fork, a glass of water, a whistle',
    example: 440,
    extract: pitchExtract,
  },
  peak: {
    id: 'peak',
    sensor: 'motion',
    symbol: 'a',
    quantity: 'Peak acceleration',
    unit: 'm/s²',
    label: 'Biggest jolt (peak acceleration a)',
    explain: 'Finds the strongest push or bump the phone felt, beyond normal gravity.',
    examples: 'a jump, a car braking, a lift starting, a ball hitting a padded phone',
    example: 15,
    extract: peakExtract,
  },
  spin: {
    id: 'spin',
    sensor: 'motion',
    symbol: 'w',
    quantity: 'Rotation speed',
    unit: 'rad/s',
    label: 'How fast something turns (angular speed ω, written w)',
    explain: 'Averages the rotation speed while the phone is turning.',
    examples: 'a turntable, a bicycle wheel (phone taped on), a merry-go-round',
    example: 3,
    extract: spinExtract,
  },
  tiltMax: {
    id: 'tiltMax',
    sensor: 'motion',
    symbol: 'A',
    quantity: 'Steepest angle before sliding',
    unit: '°',
    label: 'Steepest angle before the phone slides (angle A, in degrees)',
    explain: 'Lay the phone on a surface and slowly tilt it until the phone starts to slide.',
    examples: 'friction of a book cover, a cutting board, a wooden ramp',
    example: 20,
    extract: (r) => tiltExtract(r, 'max'),
  },
  tilt: {
    id: 'tilt',
    sensor: 'motion',
    symbol: 'A',
    quantity: 'Tilt angle',
    unit: '°',
    label: 'Angle of a slope (angle A, in degrees)',
    explain: 'Lay the phone flat on a slope and keep it still.',
    examples: 'a ramp, a roof window, a slide, a hill path',
    example: 8,
    extract: (r) => tiltExtract(r, 'steady'),
  },
};
