# Devpost submission — copy-paste sheet

Everything to paste into the Devpost form, field by field. Images for the
gallery and the thumbnail are in this folder (`npm run gallery` regenerates them).

---

## 1. Project overview

**Project name** (60 max)

```
PocketLab: your phone is a physics lab
```

**Elevator pitch** (200 max)

```
Hang your phone on a string and measure gravity to within 1 %. 12 real experiments with your phone's sensors, a virtual lab, explanations in plain words and an AI tutor that knows your numbers.
```

**Thumbnail** → `thumbnail.png` (3:2)

---

## 2. Project details

### About the project

Paste everything between the lines.

---

## Inspiration

Physics is learned by measuring, but a data logger and a set of sensors cost more than many schools spend on a whole lab — the OECD's PISA reports show large gaps in science equipment between advantaged and disadvantaged schools. Meanwhile almost every student already carries an accelerometer, a gyroscope and a calibrated microphone: their phone. Physics-education research has shown these sensors are good enough for real experiments.

So the sensor is not the problem. The problem is everything after it. Raw-data apps give a student a wiggly graph and stop there: which axis? how do I get the period? how sure am I? is my answer right? That is exactly where a student without a teacher or lab experience gets stuck. We wanted an app that walks a student through **one experiment at a time, from set-up to conclusion**, and shows its working instead of hiding it.

## What it does

PocketLab is a web app — open a link, no install, no account.

- **12 experiments with the phone's own sensors**: gravity from a pendulum, the speed of sound from a singing tube, centripetal acceleration on a spinning chair, a spring constant, friction, musical pitch, wave speed on a string, landing force, feeling heavier in a lift, turntable speed, ramp slope and swing length.
- **Two modes.** *Real lab* records the sensors hands-free (countdown, beeps, vibration and spoken instructions, because you cannot read a phone that is swinging). *Virtual lab* is an animated simulation with sliders — try a pendulum on the Moon or Jupiter — and its data goes through **exactly the same analysis** as a real recording.
- **An honest result**: value ± uncertainty, the accepted value, the % error, and a verdict a student can trust: *agrees*, *close* or *far off*, and why.
- **Two explanations** of every result: *in simple words*, using the student's own numbers and no formulas, or *with formulas*, the full derivation — plus the 2–3 key ideas to remember.
- **An AI tutor** inside every experiment that sees the student's numbers and answers in any language. It is told to use only the measured data and to guide rather than hand out answers.
- **Real lab practice**: repeated trials with mean ± standard error, and a T² vs L investigation: \\( g = 4\pi^2 / \text{slope} \\), which also cancels a constant error in measuring the length.
- **Design your own experiment**: pick what the phone measures (period, frequency, pitch, peak acceleration, rotation speed, tilt), write a textbook formula such as `4π²m/T²`, and share the experiment as a file with classmates.
- **A lab report**: hypothesis, conclusion and error sources, printable to PDF, with raw data as CSV/JSON.
- **A game-style guided tour** on first visit, and a sensor check that tells you which experiments your phone can run.

No phone at hand? Every experiment has sample data, and there is a one-click finished example.

![Result of four pendulum trials: g = 9.789 ± 0.005 m/s², 0.18 % from the accepted value](https://raw.githubusercontent.com/it-withend/eurekadev/main/docs/devpost/3-result.png)

## How we built it

TypeScript, React and Vite, deployed on Vercel; the AI tutor is a small serverless function calling Groq.

The heart of it is a **measurement engine with no UI framework in it**, in four layers — `dsp ← core ← experiments ← ui` — and ESLint fails the build if a lower layer imports a higher one:

- **Our own signal processing** (~480 lines): radix-2 FFT, Welch spectra, a prominent-peak search, zero-phase biquad filters, period by least squares through zero crossings, uncertainty propagation.
- **Experiments are plugins**: metadata plus a pure function `analyze(recording) → result`. Nine of the twelve are pure data — a few lines each, in the same format the experiment builder saves.
- **Recordings are versioned JSON**, resampled to 100 Hz, so any measurement can be replayed, shared or turned into a test.
- The builder's formulas go through a **safe recursive-descent parser** (no `eval`) with implicit multiplication, and uncertainties are propagated through them numerically.
- The pendulum uses the physical-pendulum correction for a 15 cm phone: \\( L_{eq} = L + \frac{h^2}{12L} \\).

To know whether it is *right*, we wrote a **physics simulator of every experiment** and a model of how each phone platform delivers its data: iPhone Safari inverts accelerations and relabels the gyroscope axes, Android sends 50–200 Hz, Firefox batches events, budget phones have no gyroscope, old phones sample at 25 Hz. `npm run validate` runs every experiment 20 times on every simulated phone with randomised set-ups and writes a report anyone can reproduce:

![Mean and worst error per experiment on six simulated phones; all under 2 %](https://raw.githubusercontent.com/it-withend/eurekadev/main/docs/devpost/6-accuracy.png)

100 unit tests, 24 end-to-end tests on desktop and phone screens, 92 % line coverage of the engine, and CI on every push.

## Challenges we ran into

**A careful student was sometimes told they were wrong.** This was the biggest one. We simulated 240 *correctly performed* experiments with the things that happen anyway on a real phone — a trembling hand at release, the phone twisting on its string, sensor bias, an uneven floor, breath noise, mains hum, a guessed room temperature — and only 78 % were told "agrees"; 9 % were told "far off". Digging in found real bugs: breath rumble being mistaken for the tube's note, a detrending step that biased pendulum periods by up to 0.25 %, uncertainties that ignored the accepted value's own spread. Now 359 of 360 agree and none is told "far off", and this check runs in CI so it cannot come back.

![Before the fixes 78 % agreed; now 99.7 %](https://raw.githubusercontent.com/it-withend/eurekadev/main/docs/devpost/7-false-alarms.png)

**Every real phone surprised us.** The first iPhone test of the spinning chair returned a radius of 0.2 cm instead of 25 cm: iOS labels the gyroscope axes differently. On an iPhone 12 Pro the jump experiment said "too uncertain" because the noise estimate included the jump itself. Since then no analysis relies on an axis name or a sign.

**Phones only give sensors to https pages**, and iOS only after a permission prompt inside a tap — the whole capture flow is built around that.

## Accomplishments that we're proud of

- Gravity to about 0.1 % in simulation, and an uncertainty that honestly contains the true value.
- A student who did everything right is not told they got it wrong.
- Half of the code is framework-free, so the engine can move to another framework, a native app or a server without touching the physics.
- It works from a link on iPhone and Android, offline as a PWA, and measurements never leave the device.

## What we learned

That the hard part of a measurement app is not the measurement, it is trust: an uncertainty that means something, a verdict that is fair, and an explanation a 15-year-old can follow. And that simulations find bugs, but only real phones find the *surprising* ones.

## What's next for PocketLab

More experiments (Doppler effect, free fall timed by sound, magnetic field of a coil, damped oscillations), translations — all experiment text already lives in the plugin definitions — a teacher view that collects a class's recordings, and validation against school lab equipment.

---

### Built with (tags)

```
typescript, react, vite, vercel, groq, web-audio-api, devicemotion, pwa, fft, signal-processing, vitest, playwright, eslint, github-actions, node.js
```

### "Try it out" links

```
https://eurekadev.vercel.app
https://eurekadev.vercel.app/#/experiment/pendulum/demo
https://github.com/it-withend/eurekadev
```

### Image gallery (upload in this order; caption = text after the arrow)

1. `1-home.png` → Open a link and your phone becomes a physics lab: the live trace is what its motion sensors record on a swinging pendulum.
2. `2-phones.png` → Made for phones: explanations in simple words, an AI tutor that knows your numbers, a sensor check, dark mode.
3. `3-result.png` → An honest result: g = 9.789 ± 0.005 m/s², 0.18 % from the accepted value, with a verdict and an explanation.
4. `4-virtual-lab.png` → Virtual lab: practise on Earth, the Moon or Jupiter; the simulated data goes through the same analysis as a real one.
5. `5-how-it-works.png` → One experiment at a time: set up, measure (for real or virtually), understand the result, write it up.
6. `6-accuracy.png` → Accurate on every phone we could simulate: under 0.5 % mean error, under 2 % in the worst case.
7. `7-false-alarms.png` → A careful student is not told they got it wrong: 99.7 % of correct experiments now "agree", up from 78 %.
8. `8-architecture.png` → Half of the code works without any UI framework: the measurement engine is reusable anywhere.

### Video demo link

YouTube or Vimeo URL — see `VIDEO.md` for a 2-minute script.

---

## 3. Additional info

- **Upload a file**: optional, skip (the code is on GitHub).
- **Track**: Coding Track
- **Category**: Math & Physics
