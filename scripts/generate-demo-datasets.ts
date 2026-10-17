/**
 * Writes the bundled sample recordings to public/datasets.
 * Usage: npm run datasets
 *
 * These are physics simulations (flagged meta.synthetic) so the app is
 * explorable on a laptop. Real phone recordings can replace them: save a
 * recording from the app and drop the JSON in the same folder.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { synthCentripetal, synthPendulum, synthResonance } from '../src/testing/synthetic';

const out = join(process.cwd(), 'public', 'datasets');
mkdirSync(out, { recursive: true });

// The pendulum sample is a small investigation: four lengths, so the
// T² vs L fit can be explored without a phone.
const pendulumLengths = [0.45, 0.68, 0.92, 1.2];

const datasets = {
  ...Object.fromEntries(
    pendulumLengths.map((L, i) => [
      `pendulum-demo-${i + 1}.json`,
      synthPendulum({ length: L, g: 9.807, theta0: 0.18 + 0.03 * i, seconds: 25, noise: 0.03, seed: 11 + i }),
    ]),
  ),
  'resonance-demo.json': synthResonance({ length: 0.24, diameter: 0.065, temperature: 21, seconds: 3, seed: 12 }),
  'centripetal-demo.json': synthCentripetal({ radius: 0.27, omega0: 7.5, seconds: 20, seed: 13 }),
};

for (const [name, rec] of Object.entries(datasets)) {
  writeFileSync(join(out, name), JSON.stringify(rec));
  console.log(`wrote ${name}`);
}
