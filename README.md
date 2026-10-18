# PocketLab: a physics lab in every pocket

PocketLab is a free web app that turns a smartphone into lab equipment. Students
run real physics experiments with household items. The phone's accelerometer,
gyroscope and microphone take the measurements, signal processing runs in the
browser, and the app returns a measured value with its uncertainty, compares it
with the accepted value, explains every step, and produces a lab report.

> Built for **EurekaDev 2026** · Coding Track · Math & Physics

**Live demo:** https://eurekadev.vercel.app · **One-click finished example (no phone needed):**
https://eurekadev.vercel.app/#/experiment/pendulum/demo · **Video:** _add link_

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

**Design your own experiment.** The builder lets students measure anything that swings, bounces,
spins, jolts or makes a sound: pick what the phone measures (period, frequency, pitch, peak
acceleration, rotation speed), add their own variables and write a formula as in a textbook
(`4π²m/T²` works). PocketLab parses it safely (no `eval`), checks it as they type, propagates
uncertainties through it and treats the result like any built-in experiment. Experiments can be
exported as files and shared with classmates. Templates: spring constant, playground swing,
musical note, jump landing, turntable speed.

**Guided from the first second.** A game-style interactive tour (the page dims and blurs around
the element being explained) on first visit, a step bar (Set up → Measure → Results → Write up),
plain-language captions under every chart and full-screen instructions during recording.

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

## Device compatibility

Browsers expose phone sensors differently (iOS inverts accelerations and labels gyroscope axes
differently, sample rates range from 25 to 200 Hz, some phones lack a gyroscope…). Every analysis
is written to be independent of those differences, and an automated matrix runs each experiment
through simulated iPhone, Android, Firefox, budget and old-phone sensor streams.
See [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

## Validation

**Reproducible accuracy report:** `npm run validate` runs every experiment 20 times on every
simulated phone platform with randomised setups and writes [docs/VALIDATION.md](docs/VALIDATION.md).
Clone the repo, run it, get the same numbers.

| Experiment | Mean error (all platforms) | Worst error | Truth within ±2σ |
|---|---|---|---|
| Pendulum → g | 0.10–0.12 % | 0.45 % | 100 % |
| Spinning chair → r | 0.22–0.47 % | 1.58 % | 100 % |
| Singing tube → v | 0.30–0.37 % | 0.96 % | 100 % |

**No false alarms.** 360 correctly performed experiments with the imperfections a real phone and a
real student bring (trembling hand at release, phone twisting on the string, sensor bias, uneven
floor, breath noise, estimated room temperature, tape-measure error…): **359 told "agrees"**, 1 told
"close" (a 3.8 % deviation from an unusual glass rim), none told "error" or "far off". This check is
part of the test suite, so a change that causes false alarms fails CI. It was added after real-phone
tests, and it caught two real bugs: breath noise could make the tube analysis lock onto half the
true frequency, and linear detrending biased pendulum periods by up to 0.25 %.

"Truth within ±2σ" checks that PocketLab's uncertainty is honest: the true value lies inside
the reported range. Real-device results are tracked in [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md):
so far an iPhone (Safari) and an iPhone 12 Pro, and each real test so far uncovered a platform
difference that is now handled.

## Limitations

What these numbers do not say, and what PocketLab does not do:

- The accuracy figures come from **simulations**. Real sensors have bias and noise that is not
  modelled, and real students do not set things up perfectly. Expect a few percent in practice.
- The physics models are school-level: the phone is treated as a point mass on the pendulum, the
  tube end correction is the textbook 0.3·d, and air temperature is whatever the student enters.
- The spinning-chair experiment needs a gyroscope; some budget phones do not have one (the app says so).
- PocketLab does not replace a teacher or a real lab. It makes measurement possible where there is
  no equipment, and makes the method visible so students can judge their own results.
- Student-made experiments can only measure what the five built-in measures extract
  (period, frequency, pitch, peak acceleration, rotation speed).

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173 (desktop; use sample data)
npm run dev:phone    # HTTPS on your LAN; open the printed https://<ip>:5173 on a phone
npm test             # 82 unit tests: DSP, physics ground truth, platform matrix, no-false-alarm check, formulas
npm run validate     # accuracy + false-alarm report over simulated phones -> docs/VALIDATION.md
npm run stress       # 40 realistic correct experiments per case, prints any non-"agrees" verdict
npm run e2e          # 12 Playwright end-to-end tests, desktop + phone viewport
npm run lint         # ESLint, including architecture layer rules
npm run build        # static site in dist/
```

First e2e run: `npx playwright install chromium`. On Windows machines that block the downloaded
browser, use the installed Edge instead: `PW_CHANNEL=msedge npm run e2e`.

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
- **Spoken instructions** during recording (Web Speech API), since the student cannot read a swinging phone.
- **Share result** through the phone's share sheet (text summary + recording file), e.g. to a teacher.
- CI on GitHub Actions: typecheck, lint, unit tests, validation report, build, and Playwright e2e tests.

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
