/**
 * Would a careful student get a false error? npm run stress
 *
 * Runs many correctly performed, realistically imperfect experiments
 * (src/testing/realistic.ts) through simulated phones and counts which
 * verdict the student would see. Prints the failures for inspection.
 */
import { registry } from '../src/experiments/index';
import { captureAudio, captureOnPlatform, MOTION_PLATFORMS } from '../src/testing/platforms';
import { realisticChair, realisticPendulum, realisticTube, type RealisticTrial } from '../src/testing/realistic';
import { agreement } from '../src/ui/verdict';

const N = Number(process.env.N ?? 40);
const iphone = MOTION_PLATFORMS.find((p) => p.name.startsWith('iPhone'))!;
const android = MOTION_PLATFORMS.find((p) => p.name.includes('throttled'))!;

type Case = { name: string; experiment: string; make: (seed: number) => RealisticTrial; deliver: (t: RealisticTrial, seed: number) => RealisticTrial['rec'] };
const cases: Case[] = [
  { name: 'Pendulum · iPhone', experiment: 'pendulum', make: realisticPendulum, deliver: (t, s) => captureOnPlatform(t.rec, iphone, s) },
  { name: 'Pendulum · Android 60 Hz', experiment: 'pendulum', make: realisticPendulum, deliver: (t, s) => captureOnPlatform(t.rec, android, s) },
  { name: 'Chair · iPhone', experiment: 'centripetal', make: realisticChair, deliver: (t, s) => captureOnPlatform(t.rec, iphone, s) },
  { name: 'Chair · Android 60 Hz', experiment: 'centripetal', make: realisticChair, deliver: (t, s) => captureOnPlatform(t.rec, android, s) },
  { name: 'Tube · 48 kHz', experiment: 'resonance', make: (s) => realisticTube(s, 48000), deliver: (t) => captureAudio(t.rec) },
  { name: 'Tube · 44.1 kHz', experiment: 'resonance', make: (s) => realisticTube(s, 44100), deliver: (t) => captureAudio(t.rec) },
];

export function stress(n = N, verbose = true) {
  const summary: Record<string, Record<string, number>> = {};
  for (const c of cases) {
    const def = registry.get(c.experiment)!;
    const counts: Record<string, number> = { agrees: 0, close: 0, off: 0, imprecise: 0, failed: 0 };
    for (let i = 0; i < n; i++) {
      const seed = 100 + i;
      const trial = c.make(seed);
      const r = def.analyze(c.deliver(trial, seed));
      if (!r.ok) {
        counts.failed++;
        if (verbose) console.log(`  ${c.name} #${seed}: FAILED — ${r.error}`);
        continue;
      }
      const v = agreement(r.primary).verdict;
      counts[v]++;
      if (verbose && v !== 'agrees') {
        const p = r.primary;
        console.log(
          `  ${c.name} #${seed}: ${v} — ${p.measured.toFixed(3)} ± ${p.uncertainty.toFixed(3)} vs ${p.accepted?.toFixed(3)} (truth ${trial.truth.toFixed(3)}); ${r.warnings.join(' / ')}`,
        );
      }
    }
    summary[c.name] = counts;
  }
  return summary;
}

if (process.argv[1]?.includes('stress')) {
  const s = stress();
  console.table(s);
}
