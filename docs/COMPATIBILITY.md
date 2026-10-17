# Device compatibility

PocketLab runs in the phone's browser, so it depends on what each browser
exposes through the **DeviceMotion** and **Web Audio / getUserMedia** APIs.
Those differ more than the specifications suggest. This page lists the
differences we design for, how each one is handled, and how it is tested.

## Known platform differences

| Difference | Where | How PocketLab handles it |
|---|---|---|
| Motion access needs an explicit permission prompt from a tap | iOS Safari 13+ | `MotionSource.prepare()` calls `DeviceMotionEvent.requestPermission()` synchronously inside the Start tap |
| Sensors only on secure origins | all modern browsers | deployed over https; `npm run dev:phone` serves a self-signed certificate |
| `accelerationIncludingGravity` has the opposite sign | iOS vs Android | analyses use magnitudes and least-squares vectors, never the sign of an axis |
| `rotationRate` alpha/beta/gamma map to different device axes | iOS vs Android | analyses never rely on axis names: ω is the magnitude of the gyroscope vector, or the axis is chosen from the data (spectral power / prominence). Found during a real iPhone test (spinning chair returned 0.2 cm instead of 25 cm) |
| Event rate 50–200 Hz, jittery, batched events with equal timestamps | varies by phone, browser and battery mode | `processMotionEvents` drops non-increasing timestamps and resamples onto a uniform 100 Hz grid |
| Sensor throttled to a few Hz (battery saver, background tab) | Android, iOS low-power mode | capture rejected below 15 Hz with advice to turn off battery saver; measurement aborts if the page goes to the background |
| No gyroscope | budget Android phones | pendulum falls back to the accelerometer (tension oscillates twice per swing, so T = 2 × measured period); the spinning chair explains that a gyroscope is required; the sensor check reports it |
| Desktop browsers expose `DeviceMotionEvent` but never fire it | Chrome/Edge/Firefox on laptops | capture fails with an explanation and a pointer to the sample data |
| Microphone sample rate 48 kHz, 44.1 kHz or 16 kHz (Bluetooth headsets) | varies | audio decimated to ~8 kHz with an anti-aliasing average; analyses use the actual rate |
| No `AudioWorklet` | iOS < 14.5, old Android WebViews | falls back to `ScriptProcessorNode` |
| Voice processing (echo cancellation, noise suppression, auto gain) distorts tones | all | requested off in `getUserMedia` constraints |
| Screen sleep throttles sensors | many phones | Screen Wake Lock held during recording |
| Audio context must be resumed from a gesture | iOS Safari | context created and resumed inside the Start tap; start beep plays before recording so it is not captured |

## Automated compatibility matrix

`src/experiments/platforms.test.ts` simulates each platform from a high-rate
physics simulation, delivering events the way that platform would (rate, timing
jitter, dropped and batched events, sign convention, axis labelling, missing
gyroscope). It then runs **the same processing code the phone runs**
(`core/sensors/processing.ts`) and every analysis:

| Simulated platform | Pendulum (g) | Spinning chair (r) |
|---|---|---|
| Android Chrome, fast sensor (200 Hz) | ✓ < 1.5 % | ✓ < 1.5 cm |
| Android Chrome, throttled (60 Hz, drops) | ✓ | ✓ |
| iPhone Safari (60 Hz, inverted accel, relabelled gyro) | ✓ | ✓ |
| Firefox Android (50 Hz, jittery, batched) | ✓ | ✓ |
| Budget phone without gyroscope (50 Hz) | ✓ (accelerometer mode) | explains a gyroscope is needed |
| Old phone, slow sensor (25 Hz) | ✓ | ✓ |
| Sensor throttled to 5 Hz | rejected with advice | rejected with advice |

| Microphone rate | Singing tube (v) |
|---|---|
| 48 kHz | ✓ < 2 % |
| 44.1 kHz | ✓ |
| 16 kHz | ✓ |

## Tested on real devices

| Device | Browser | Sensor check | Pendulum | Singing tube | Spinning chair | Notes |
|---|---|---|---|---|---|---|
| iPhone (model to fill in) | Safari | | | | ✗ → fixed | Found the gyroscope axis-label difference, fixed in `df3df26`; re-test pending |
| _add your phone_ | | | | | | |

What only a real device can confirm (and what simulations cannot):
real sensor noise and bias, how firmly a student can attach the phone, the
acoustic behaviour of real glasses and tubes, and browser bugs we do not know about.
If you test PocketLab, please add a row above.
