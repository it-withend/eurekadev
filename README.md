# PocketLab: a physics lab in every pocket

PocketLab is a free web app that turns a smartphone into lab equipment. Students
run real physics experiments with household items. The phone's accelerometer,
gyroscope and microphone take the measurements, signal processing runs in the
browser, and the app returns a measured value with its uncertainty, compares it
with the accepted value, explains every step, and prints a lab report.

> Built for **EurekaDev 2026** · Coding Track · Math & Physics

**Live demo:** _add link after deploy_ · **Video:** _add link_

## The problem

Hands-on experiments are central to learning physics, but lab sensors and
data loggers cost hundreds of dollars per set, and many schools have little or no
lab equipment. Most students, however, already carry a phone with
research-grade MEMS sensors.

## What it does

| Experiment | Sensor | What you measure | Method |
|---|---|---|---|
| Gravity with a pendulum | gyroscope | **g** | zero-crossing period + FFT cross-check, large-amplitude correction, error propagation |
| Speed of sound from a singing tube | microphone | **v_sound** | Welch-averaged FFT, sub-bin peak interpolation, end correction |
| Circular motion on a spinning chair | gyroscope + accelerometer | **r** from a = ω²r | least-squares fit of a vs ω², R² and standard errors |

Every result shows:

- the measured value **± uncertainty**, the accepted value, the % error, and the deviation in σ;
- charts of the raw and processed signal;
- **"How it was calculated"**: the derivation with the student's own numbers;
- a printable **lab report** (PDF via the browser), plus the recording as JSON and CSV.

On a laptop without sensors, every experiment has **sample data**: simulated
recordings, clearly labelled, so judges and teachers can try the full analysis.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173 (desktop; use sample data)
npm run dev:phone    # HTTPS on your LAN; open the printed https://<ip>:5173 on a phone
npm test             # 21 unit tests: DSP + physics ground-truth tests
npm run build        # static site in dist/
```

Phones only expose motion sensors and the microphone to **https** pages, which is
why `dev:phone` serves a self-signed certificate. Accept the warning once on the phone.

## How it's built

- **TypeScript + React + Vite.** React is the only runtime dependency.
- **Own DSP library** (`src/dsp`): radix-2 FFT, Welch spectra, zero-phase Butterworth
  filtering, period estimation, least-squares regression, resampling.
- **Plugin architecture**: an experiment is metadata plus one pure `analyze()` function.
  See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
  [docs/ADDING_AN_EXPERIMENT.md](docs/ADDING_AN_EXPERIMENT.md).
- **Reproducible recordings** in a versioned JSON format: replay, share, test.
- **Physics-based tests**: simulators (e.g. RK4 integration of the non-linear pendulum)
  generate data with known ground truth, and the tests check the analysis recovers it.
- **Offline-capable PWA**, with no backend and no tracking. Data never leaves the device.
- CI on GitHub Actions: typecheck, tests, build.

```
src/
  dsp/           pure numeric library (+ tests)
  core/          contracts, registry, recording format, sensor adapters
  experiments/   pendulum/, resonance/, centripetal/ plugins (+ tests)
  testing/       physics simulators for tests and sample data
  ui/            pages, components, canvas charts
```

## Roadmap

More experiments (Doppler effect, free fall by sound, magnetic fields, damped
oscillations), translations, a teacher view that collects class results, and
validation against school lab equipment.

## License

MIT
