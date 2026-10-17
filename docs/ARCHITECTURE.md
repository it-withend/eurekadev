# PocketLab architecture

PocketLab is a static, client-only web app. There is no backend: sensors are
read, processed and reported entirely on the student's device. That keeps it
free to host, private by default, and usable offline in a classroom.

## Layers

```
┌──────────────────────────────────────────────────────────────┐
│ ui/            React pages & components (catalog, experiment │
│                page, charts, lab report)                     │
├──────────────────────────────────────────────────────────────┤
│ experiments/   Plugins. Each = metadata + analyze(recording) │
│   pendulum/  resonance/  centripetal/   index.ts (registry)  │
├──────────────────────────────────────────────────────────────┤
│ core/          Contracts (types.ts), registry, Recording     │
│                format, sensor adapters (motion, audio)       │
├──────────────────────────────────────────────────────────────┤
│ dsp/           Pure numeric library: filters, FFT/Welch,     │
│                period estimation, regression, resampling     │
└──────────────────────────────────────────────────────────────┘
```

Dependencies point **downwards only**:

| Layer | May import | Must not import |
|---|---|---|
| `dsp` | nothing | everything else |
| `core` | `dsp` | `experiments`, `ui` |
| `experiments` | `core`, `dsp` | `ui`, browser APIs |
| `ui` | all of the above | — |

Consequences:

- `dsp` and `experiments` are pure TypeScript with no DOM, so they run in
  Node and are covered by fast unit tests.
- An analysis can never depend on how the data was captured. A live phone
  measurement, the bundled sample, and a file a teacher uploads all go
  through exactly the same code path.

## Data flow of one measurement

```
 click Start
     │  (user gesture → permission prompt on iOS)
     ▼
 SensorSource.prepare() ── countdown ── start(onSample) ──► LiveChart (preview)
     │
     ▼ stop()
 Capture { sampleRate, channels }      ← motion data resampled to a uniform 100 Hz,
     │                                    audio decimated to ~8 kHz
     ▼ createRecording()
 Recording (plain JSON, versioned)  ──► Save / CSV / reload later
     │
     ▼ experiment.analyze(withParams(recording, params))   ← pure, re-runs on every param edit
 AnalysisResult { primary, measurements, charts, steps, warnings }
     │
     ▼
 ResultView + print stylesheet = lab report
```

## Key decisions

**Experiments are plugins, not screens.** `ExperimentDefinition`
(`src/core/types.ts`) describes an experiment as data (title, parameters,
materials, procedure, theory) plus one pure `analyze` function. The UI renders
any definition generically. Adding an experiment is one folder and one line in
`src/experiments/index.ts`; see [ADDING_AN_EXPERIMENT.md](ADDING_AN_EXPERIMENT.md).

**Recordings are the unit of reproducibility.** Every measurement is saved in
a small versioned JSON format (`format: "pocketlab.recording"`, `version: 1`)
holding the raw channels and the parameters. `parseRecording` validates untrusted
files. This enables replay, sharing with teachers, sample datasets for people
without a phone, and regression tests on real captures.

**Analysis returns explanations, not just numbers.** `AnalysisResult.steps` is
the derivation with the student's numbers plugged in. It is educational, and it
is also an audit trail for anyone checking the result.

**Honest uncertainty.** Every primary result carries an uncertainty
from first-order error propagation (and regression standard errors), and the
UI judges agreement with the accepted value in units of σ, not just percent error.

**Own DSP, no heavy dependencies.** The numeric code (radix-2 FFT, Welch, RBJ
biquads with forward-backward zero-phase filtering, Schmitt-trigger zero crossings,
OLS with standard errors) is ~400 lines, fully tested, and has no runtime
dependencies. The only runtime dependency of the whole app is React.

**Sensor adapters behind one interface.** `SensorSource` hides platform quirks:
iOS permission prompts, jittery event timing (fixed by resampling), browser
voice-processing on microphones (disabled), desktop browsers that report a motion
API but never fire events (detected and explained). New sensor families
(magnetometer, ambient light, camera) plug into `createSensor`.

**Synthetic data comes from physics, not curve drawing.** `src/testing/synthetic.ts`
integrates the full non-linear pendulum equation with RK4, excites air-column
resonances with filtered noise, and so on. Tests therefore check the analysis
against known ground truth, including effects such as large-amplitude swings.

## Scaling paths

- **More experiments:** add plugins (e.g. free-fall timing via the microphone,
  Doppler shift, magnetic field of a coil, damped oscillations → Q factor).
- **More sensors:** add `SensorSource` adapters (Generic Sensor API,
  `getUserMedia` video for optics experiments).
- **Heavier analysis:** `analyze` is pure and synchronous, so it can move to a
  Web Worker without changing any plugin.
- **Classrooms:** recordings are JSON, so a teacher dashboard that collects
  class results could be an optional backend added later without changing the
  client architecture.
- **Localisation:** all user-facing experiment text lives in the definitions,
  which makes them a natural unit for translation.
