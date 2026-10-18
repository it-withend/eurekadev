/** Shared by `npm run validate` (report) and `npm run charts` (README figures), so both show the same numbers. */
import { registry } from '../../src/experiments/index';
import { speedOfSound } from '../../src/experiments/resonance/analyze';
import { AUDIO_RATES, captureAudio, captureOnPlatform, MOTION_PLATFORMS } from '../../src/testing/platforms';
import { rng, synthCentripetal, synthPendulum, synthResonance } from '../../src/testing/synthetic';
import type { Recording } from '../../src/core/types';

export const RUNS = 20;

export interface Row {
  experiment: string;
  platform: string;
  ok: number;
  errors: number[];
  within2: number;
}

function run(experiment: string, platform: string, make: (i: number) => { rec: Recording; truth: number }): Row {
  const def = registry.get(experiment)!;
  const row: Row = { experiment: def.title, platform, ok: 0, errors: [], within2: 0 };
  for (let i = 0; i < RUNS; i++) {
    let rec: Recording;
    let truth: number;
    try {
      ({ rec, truth } = make(i));
    } catch {
      continue; // the platform rejected the capture (counted as a failure)
    }
    const r = def.analyze(rec);
    if (!r.ok) continue;
    row.ok++;
    const err = Math.abs(r.primary.measured - truth) / Math.abs(truth);
    row.errors.push(err);
    // Compare with the measurement's own uncertainty (reference uncertainty excluded: truth is exact here).
    if (Math.abs(r.primary.measured - truth) <= 2 * r.primary.uncertainty) row.within2++;
  }
  return row;
}

/** Every experiment × every simulated platform, RUNS seeded randomised set-ups each. Deterministic. */
export function runPlatformMatrix(): Row[] {
  const rows: Row[] = [];
  const g = 9.81;

  for (const p of MOTION_PLATFORMS) {
    rows.push(
      run('pendulum', p.name, (i) => {
        const r = rng(1000 + i);
        const L = 0.4 + 1.1 * r.uniform();
        const truth = synthPendulum({ length: L, g, theta0: 0.1 + 0.3 * r.uniform(), sampleRate: 400, seed: 2000 + i });
        return { rec: captureOnPlatform(truth, p, 3000 + i), truth: g };
      }),
    );
    rows.push(
      run('centripetal', p.name, (i) => {
        const r = rng(4000 + i);
        const radius = 0.1 + 0.3 * r.uniform();
        const truth = synthCentripetal({
          radius,
          sampleRate: 400,
          seconds: 18,
          profile: i % 2 ? 'pushed' : 'decay',
          omega0: 5 + 4 * r.uniform(),
          seed: 5000 + i,
        });
        return { rec: captureOnPlatform(truth, p, 6000 + i), truth: radius * 100 };
      }),
    );
  }

  for (const rate of AUDIO_RATES) {
    rows.push(
      run('resonance', `Microphone at ${rate / 1000} kHz`, (i) => {
        const r = rng(7000 + i);
        const temperature = 15 + 13 * r.uniform();
        const truth = synthResonance({
          length: 0.15 + 0.25 * r.uniform(),
          diameter: 0.03 + 0.04 * r.uniform(),
          temperature,
          mode: i % 2 ? 1 : 0,
          sampleRate: rate,
          seed: 8000 + i,
        });
        return { rec: captureAudio(truth), truth: speedOfSound(temperature) };
      }),
    );
  }

  return rows;
}
