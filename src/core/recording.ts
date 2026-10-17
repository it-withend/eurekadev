import type { Recording, SensorKind } from './types';

const SENSORS: readonly SensorKind[] = ['motion', 'audio'];

/** Rounds samples so recordings stay small as JSON without losing precision that matters. */
function compact(values: ArrayLike<number>, decimals: number): number[] {
  const f = 10 ** decimals;
  return Array.from(values, (v) => Math.round(v * f) / f);
}

export function createRecording(input: {
  experimentId: string;
  sensor: SensorKind;
  sampleRate: number;
  channels: Record<string, ArrayLike<number>>;
  params: Record<string, number>;
  startedAt?: Date;
  meta?: Recording['meta'];
}): Recording {
  const decimals = input.sensor === 'audio' ? 4 : 5;
  return {
    format: 'pocketlab.recording',
    version: 1,
    experimentId: input.experimentId,
    sensor: input.sensor,
    sampleRate: input.sampleRate,
    startedAt: (input.startedAt ?? new Date()).toISOString(),
    channels: Object.fromEntries(Object.entries(input.channels).map(([k, v]) => [k, compact(v, decimals)])),
    params: { ...input.params },
    meta: input.meta,
  };
}

export class RecordingFormatError extends Error {}

/** Validates untrusted JSON (e.g. an uploaded file) into a Recording. */
export function parseRecording(json: unknown): Recording {
  const fail = (msg: string): never => {
    throw new RecordingFormatError(`Not a valid PocketLab recording: ${msg}`);
  };
  if (typeof json !== 'object' || json === null) fail('expected an object');
  const r = json as Record<string, unknown>;
  if (r.format !== 'pocketlab.recording') fail('missing format marker');
  if (r.version !== 1) fail(`unsupported version ${String(r.version)}`);
  if (typeof r.experimentId !== 'string') fail('experimentId must be a string');
  if (!SENSORS.includes(r.sensor as SensorKind)) fail('unknown sensor');
  if (typeof r.sampleRate !== 'number' || !(r.sampleRate > 0)) fail('sampleRate must be positive');
  if (typeof r.channels !== 'object' || r.channels === null) fail('channels missing');
  const channels = r.channels as Record<string, unknown>;
  let length = -1;
  for (const [name, data] of Object.entries(channels)) {
    if (!Array.isArray(data) || data.some((v) => typeof v !== 'number')) fail(`channel "${name}" must be numbers`);
    const len = (data as number[]).length;
    if (length >= 0 && len !== length) fail('channels have different lengths');
    length = len;
  }
  if (length <= 0) fail('no samples');
  const params = (r.params ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(params)) if (typeof v !== 'number') fail(`param "${k}" must be a number`);
  return json as Recording;
}

export function withParams(rec: Recording, params: Record<string, number>): Recording {
  return { ...rec, params: { ...rec.params, ...params } };
}

export function durationOf(rec: Recording): number {
  const first = Object.values(rec.channels)[0];
  return first ? first.length / rec.sampleRate : 0;
}

export function recordingToCsv(rec: Recording): string {
  const names = Object.keys(rec.channels);
  const n = rec.channels[names[0]]?.length ?? 0;
  const lines = [['t_s', ...names].join(',')];
  for (let i = 0; i < n; i++) {
    lines.push([(i / rec.sampleRate).toFixed(5), ...names.map((c) => rec.channels[c][i])].join(','));
  }
  return lines.join('\n');
}
