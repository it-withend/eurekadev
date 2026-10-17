# Adding an experiment

An experiment is a plugin: one folder under `src/experiments/` and one line in
the registry. You do not need to touch the UI, the sensor code or the DSP library.

## 1. Write the analysis (pure function)

`src/experiments/my-experiment/analyze.ts`

```ts
import { readParam } from '@core/registry';
import type { AnalysisResult, ParamSpec, Recording } from '@core/types';
import { dominantChannel, GYRO, line, timeAxis } from '../shared';

export const myParams: ParamSpec[] = [
  { kind: 'number', id: 'mass', label: 'Mass m', unit: 'kg', default: 0.2, min: 0, step: 0.01 },
];

export function analyzeMine(rec: Recording): AnalysisResult {
  const m = readParam(rec.params, myParams, 'mass');
  const { name, data } = dominantChannel(rec, GYRO);
  if (data.length === 0) return { ok: false, error: 'No data', hint: 'Try again' };

  const value = /* … your physics … */ 0;
  return {
    ok: true,
    primary: {
      quantity: 'Something', symbol: 'k', measured: value, uncertainty: 0.1,
      accepted: 1, acceptedSource: 'textbook', unit: 'N/m', digits: 2,
    },
    measurements: [{ label: 'Mass', value: m, unit: 'kg', digits: 3 }],
    charts: [{ title: 'Signal', xLabel: 'time (s)', yLabel: name,
               series: [line('signal', timeAxis(data.length, rec.sampleRate), data)] }],
    steps: [`k = … = ${value.toFixed(2)} N/m`],
    warnings: [],
  };
}
```

Rules:

- No DOM or browser APIs: analysis must run in Node for tests.
- Never throw for bad data. Return `{ ok: false, error, hint }` with advice the student can act on.
- Put the derivation, with real numbers, in `steps`.

## 2. Describe it

`src/experiments/my-experiment/index.ts`

```ts
import type { ExperimentDefinition } from '@core/types';
import { analyzeMine, myParams } from './analyze';

export const myExperiment: ExperimentDefinition = {
  id: 'my-experiment',
  title: 'Spring Constant from Oscillations',
  tagline: 'One-line pitch shown on the catalog card.',
  subject: 'Mechanics',
  sensor: 'motion',            // or 'audio'
  durationSec: 20,
  params: myParams,
  materials: ['…'],
  instructions: ['…'],
  theory: { summary: '…', formula: 'T = 2π√(m/k)' },
  demoDataset: 'datasets/my-experiment-demo.json',
  preview: (s) => s.gz,        // one number per live sample
  previewLabel: 'rotation (rad/s)',
  analyze: analyzeMine,
};
```

## 3. Register it

`src/experiments/index.ts`

```ts
export const registry = createRegistry([pendulum, resonance, centripetal, myExperiment]);
```

## 4. Test it against physics

Add a simulator to `src/testing/synthetic.ts` that produces a `Recording`
from known ground truth, then assert that `analyze` recovers it in
`src/experiments/experiments.test.ts`. Add it to
`scripts/generate-demo-datasets.ts` so laptop users get a sample.
