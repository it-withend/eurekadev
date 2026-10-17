# PocketLab: a physics lab in every pocket

PocketLab is a free web app that turns a smartphone into lab equipment. Students
run real physics experiments with household items. The phone's accelerometer,
gyroscope and microphone take the measurements, signal processing runs in the
browser, and the app returns a measured value with its uncertainty, compares it
with the accepted value, explains every step, and produces a lab report.

> Built for **EurekaDev 2026** · Coding Track · Math & Physics

**Live demo:** _add link after deploy_ · **Video:** _add link_

## The problem

Hands-on experiments are central to learning physics, but sensors and data
loggers are expensive, and many schools have little or no lab equipment
(the OECD's PISA 2015 report on school resources documents large gaps in science
lab resources between advantaged and disadvantaged schools [4]). Most students,
however, already carry a phone with MEMS motion sensors and a microphone that
physics-education research has shown are accurate enough for real experiments [2, 3].

## What it does

| Experiment | Sensor | What you measure | Method |
|---|---|---|---|
| Gravity with a pendulum | gyroscope (accelerometer fallback) | **g** | zero-crossing period + FFT cross-check, large-amplitude correction [5], error propagation |
| Speed of sound from a singing tube | microphone | **v_sound** | Welch-averaged FFT, sub-bin peak interpolation, end correction [6] |
| Circular motion on a spinning chair | gyroscope + accelerometer | **r** from a = ω²r | least-squares fit of a vs ω², R² and standard errors |

For every measurement, PocketLab:

- **guides the setup**: a diagram, a materials list, step-by-step procedure, a sensor check page;
- **runs the capture hands-free**: a full-screen countdown, beeps and vibration at start and stop
  (the phone is swinging or spinning, so you can't watch it), and the screen kept awake;
- **shows the result honestly**: value ± uncertainty, accepted value, % error, deviation in σ;
- **explains the calculation**: the derivation with the student's own numbers;
- **supports real lab practice**: repeated trials with mean ± standard error, and a
  **T² vs L investigation** when the pendulum length is varied (g from the slope, which also cancels
  a constant error in measuring L);
- **produces a lab report**: worksheet with hypothesis, conclusion and error-source discussion,
  printable to PDF, plus raw data as JSON/CSV.

On a laptop without sensors, every experiment has **sample data**: simulated
recordings, clearly labelled, so judges and teachers can try the full analysis.

## How it differs from existing tools

Free sensor apps such as **phyphox** (RWTH Aachen) [1] are excellent and show that
phone sensors are good enough for physics. They mostly give you raw data and graphs.
Turning those into a result (choosing the right axis, filtering, finding the period,
propagating uncertainty) is left to the student, and that is exactly where
students without a teacher or lab experience get stuck.

PocketLab is complementary: **one guided experiment at a time, from setup to
conclusion.** It does the signal processing automatically, but shows every step, so
the method is visible rather than hidden. It runs in any browser from a link, with no
install or account, and works offline once loaded.

## Validation

| Experiment | Phone | Trials | Measured | Accepted | Error |
|---|---|---|---|---|---|
| Pendulum | _to be filled from real tests_ | | | 9.81 m/s² | |
| Singing tube | | | | 343 m/s @ 20 °C | |
| Spinning chair | | | | ruler r | |

Automated tests check every analysis against physics simulations with known
ground truth: a non-linear pendulum integrated with RK4, including large swings,
twisting on the string and phones without a gyroscope; air-column resonances; and
a decelerating turntable.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173 (desktop; use sample data)
npm run dev:phone    # HTTPS on your LAN; open the printed https://<ip>:5173 on a phone
npm test             # unit + physics ground-truth tests
npm run lint         # ESLint, including architecture layer rules
npm run build        # static site in dist/
```

Phones only expose motion sensors and the microphone to **https** pages, which is
why `dev:phone` serves a self-signed certificate. Accept the warning once on the phone.
Any static host works for deployment (Vercel, Netlify, GitHub Pages): build command
`npm run build`, output directory `dist`.

## How it's built

- **TypeScript + React + Vite.** React is the only runtime dependency (~62 kB gzipped total).
- **Own DSP library** (`src/dsp`): radix-2 FFT, Welch spectra, zero-phase Butterworth
  filtering, period estimation, least-squares regression, resampling.
- **Plugin architecture**: an experiment is metadata plus a pure `analyze()` function and an
  optional `summarize()` for multi-trial investigations. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
  and [docs/ADDING_AN_EXPERIMENT.md](docs/ADDING_AN_EXPERIMENT.md).
- **Layered and enforced**: `dsp` ← `core` ← `experiments` ← `ui`, with ESLint rules that fail the
  build if a lower layer imports a higher one.
- **Reproducible recordings** in a versioned JSON format: replay, share with a teacher, test.
- **Offline-capable PWA**, with no backend and no tracking. Data never leaves the device.
- CI on GitHub Actions: typecheck, lint, tests, build.

```
src/
  dsp/           pure numeric library (+ tests)
  core/          contracts, registry, trial aggregation, recording format, sensor adapters
  experiments/   pendulum/, resonance/, centripetal/ plugins (+ tests)
  testing/       physics simulators for tests and sample data
  ui/            pages, components, hooks, canvas charts
```

## Roadmap

More experiments (Doppler effect, free fall timed by sound, magnetic field of a coil,
damped oscillations), translations (all experiment text lives in plugin definitions),
a teacher view that collects a class's recordings, and validation against school lab equipment.

## References

1. Staacks, S., Hütz, S., Heinke, H., & Stampfer, C. (2018). Advanced tools for smartphone-based experiments: phyphox. *Physics Education*, 53(4), 045009.
2. Vogt, P., & Kuhn, J. (2012). Analyzing simple pendulum phenomena with a smartphone acceleration sensor. *The Physics Teacher*, 50(7), 439–440.
3. Kuhn, J., & Vogt, P. (2013). Smartphones as experimental tools: Different methods to determine the gravitational acceleration in classroom physics by using everyday devices. *European Journal of Physics Education*, 4(1), 16–27.
4. OECD (2016). *PISA 2015 Results (Volume II): Policies and Practices for Successful Schools.* OECD Publishing, Paris.
5. Nelson, R. A., & Olsson, M. G. (1986). The pendulum — Rich physics from a simple system. *American Journal of Physics*, 54(2), 112–121.
6. Levine, H., & Schwinger, J. (1948). On the radiation of sound from an unflanged circular pipe. *Physical Review*, 73(4), 383–406.

## License

MIT
