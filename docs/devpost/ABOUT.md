## 💡 Inspiration

Physics is learned by **measuring**, but a data logger and a set of sensors cost more than many schools spend on a whole lab — the OECD's _PISA 2015_ report shows large gaps in science equipment between advantaged and disadvantaged schools. Meanwhile almost every student already carries an accelerometer, a gyroscope and a calibrated microphone: **their phone**.

So the sensor is not the problem. The problem is everything _after_ it. Raw-data apps give a student a wiggly graph and stop there:

- _Which axis do I look at?_
- _How do I get the period out of this?_
- _How sure am I — and is my answer right?_

That is exactly where a student without a teacher or lab experience gets stuck. We wanted an app that walks a student through **one experiment at a time, from set-up to conclusion**, and shows its working instead of hiding it.

## 🔬 What it does

**PocketLab** is a web app — open a link, no install, no account. 👉 [Try it](https://eurekadev.vercel.app) · [see a finished experiment, no phone needed](https://eurekadev.vercel.app/#/experiment/pendulum/demo)

- **12 experiments with the phone's own sensors** — gravity from a pendulum, the speed of sound from a singing tube, centripetal acceleration on a spinning chair, a spring constant, friction, musical pitch, wave speed on a string, landing force, feeling heavier in a lift, turntable speed, ramp slope and swing length.
- **Two modes.** _Real lab_ records the sensors hands-free — countdown, beeps, vibration and spoken instructions, because you cannot read a phone that is swinging. _Virtual lab_ is an animated simulation with sliders (try a pendulum on the **Moon** or **Jupiter**), and its data goes through **exactly the same analysis** as a real recording.
- **An honest result** — value ± uncertainty, the accepted value, the % error and a verdict a student can trust: _agrees_, _close_ or _far off_, and **why**.
- **Two explanations** of every result — _in simple words_, using the student's own numbers and no formulas, or _with formulas_, the full derivation — plus the 2–3 key ideas to remember.
- **An AI tutor** inside every experiment that sees the student's numbers and answers in **any language**. It is told to use only the measured data and to guide rather than hand out answers.
- **Design your own experiment** — pick what the phone measures (period, frequency, pitch, peak acceleration, rotation speed, tilt), type a textbook formula such as `4π²m/T²`, and share the experiment as a file with classmates.
- **A lab report** — hypothesis, conclusion and error sources, printable to PDF, raw data as CSV/JSON.
- **A game-style guided tour** on first visit, and a **sensor check** that tells you which experiments your phone can run.

![Result of four pendulum trials: g = 9.789 ± 0.005 m/s², 0.18 % from the accepted value](https://raw.githubusercontent.com/it-withend/eurekadev/main/docs/devpost/3-result.png)

### The physics behind the flagship experiment

A pendulum's period depends only on its length and on gravity:

$$ T = 2\pi\sqrt{\frac{L}{g}} \quad\Longrightarrow\quad g = \frac{4\pi^2 L}{T^2} $$

Measure at several lengths and plot \\( T^2 \\) against \\( L \\): the points lie on a straight line, and its slope gives gravity from **all trials at once** — which also cancels a constant error in measuring the length:

$$ T^2 = \frac{4\pi^2}{g}\,L \quad\Longrightarrow\quad g = \frac{4\pi^2}{\text{slope}} $$

A phone is not a point mass, so PocketLab treats it as a physical pendulum of height \\( h \approx 15\ \text{cm} \\):

$$ L_{\text{eq}} = L + \frac{h^2}{12L} $$

The other experiments use the same idea — one clean formula per experiment, e.g. \\( a = \omega^2 r \\) on the spinning chair and \\( v = 4f\,(L + 0.3d) \\) for a singing tube closed at one end.

## 🛠️ How we built it

**TypeScript, React and Vite**, deployed on **Vercel**; the AI tutor is a small serverless function calling **Groq**.

The heart of it is a **measurement engine with no UI framework in it**, in four layers — and ESLint fails the build if a lower layer ever imports a higher one:

```
dsp  ←  core  ←  experiments  ←  ui
FFT     contracts   12 plugins      React pages
filters recordings  builder         (the only React code)
fits    sensors     virtual labs
```

- **Our own signal processing** (~480 lines): radix-2 FFT, Welch spectra, a prominent-peak search, zero-phase biquad filters, the period by least squares through zero crossings, and uncertainty propagation.
- **Every experiment is a plugin** — metadata plus one pure function. Nine of the twelve are pure data, a few lines each, in the same format the experiment builder saves:

```typescript
const def = registry.get('pendulum')!;
const result = def.analyze(recording); // pure: Recording → AnalysisResult
result.story;  // explanation in simple words
result.steps;  // explanation with formulas
```

- **Recordings are versioned JSON**, resampled to 100 Hz, so any measurement can be replayed, shared with a teacher or turned into a test.
- Builder formulas go through a **safe recursive-descent parser** — no `eval` — with implicit multiplication, and uncertainties are propagated through them numerically.

To know whether it is _right_, we wrote a **physics simulator of every experiment** and a model of how each phone platform delivers its data: iPhone Safari inverts accelerations and relabels the gyroscope axes, Android sends 50–200 Hz, Firefox batches events, budget phones have no gyroscope, old phones sample at 25 Hz. `npm run validate` runs every experiment 20 times on every simulated phone with randomised set-ups and writes a report **anyone can reproduce**:

![Mean and worst error per experiment on six simulated phones; all under 2 %](https://raw.githubusercontent.com/it-withend/eurekadev/main/docs/devpost/6-accuracy.png)

**100 unit tests, 24 end-to-end tests** on desktop and phone screens, **92 %** line coverage of the engine, and CI on every push.

## 🧗 Challenges we ran into

**1. A careful student was sometimes told they were wrong.** This was the biggest one. We simulated 240 _correctly performed_ experiments with everything that happens anyway on a real phone — a trembling hand at release, the phone twisting on its string, sensor bias, an uneven floor, breath noise, mains hum, a guessed room temperature. Only **78 %** were told "agrees"; **9 %** were told "far off". Digging in found real bugs:

- breath rumble was being mistaken for the tube's note;
- a detrending step biased pendulum periods by up to **0.25 %**;
- the verdict ignored the uncertainty of the accepted value itself.

Now **359 of 360 agree** and none is told "far off" — and this check runs in CI, so it cannot quietly come back.

![Before the fixes 78 % agreed; now 99.7 %](https://raw.githubusercontent.com/it-withend/eurekadev/main/docs/devpost/7-false-alarms.png)

**2. Every real phone surprised us.** The first iPhone test of the spinning chair returned a radius of **0.2 cm instead of 25 cm** — iOS labels the gyroscope axes differently. On an iPhone 12 Pro the jump experiment said "too uncertain" because the noise estimate included the jump itself. Since then no analysis relies on an axis name or a sign.

**3. Browsers guard sensors closely.** Phones only give motion data to **https** pages, and iOS only after a permission prompt inside a tap — the whole capture flow is built around that.

## 🏆 Accomplishments that we're proud of

- Gravity to about **0.1 %** in simulation, with an uncertainty that honestly contains the true value.
- **A student who did everything right is not told they got it wrong.**
- **Half of the code is framework-free**, so the engine can move to another framework, a native app or a server without touching the physics.
- Works from a link on iPhone and Android, **offline** as a PWA, and measurements **never leave the device**.

## 📚 What we learned

The hard part of a measurement app is not the measurement — it is **trust**: an uncertainty that means something, a verdict that is fair, and an explanation a 15-year-old can follow. And simulations find bugs, but only **real phones** find the _surprising_ ones.

## 🚀 What's next for PocketLab

- More experiments: the **Doppler effect**, free fall timed by sound, the magnetic field of a coil, damped oscillations.
- **Translations** — all experiment text already lives in the plugin definitions.
- A **teacher view** that collects a class's recordings.
- Validation against **school lab equipment**.

🔗 [Live app](https://eurekadev.vercel.app) · [Source code](https://github.com/it-withend/eurekadev) · [Accuracy report](https://github.com/it-withend/eurekadev/blob/main/docs/VALIDATION.md)
