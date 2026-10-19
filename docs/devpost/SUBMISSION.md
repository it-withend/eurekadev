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

Paste the whole of [ABOUT.md](ABOUT.md) (open it, select all, copy). It uses only
what Devpost supports: `##` headlines, **bold**, _italics_, links, images, code
blocks, `\( … \)` inline maths and `$$ … $$` displayed equations.

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
