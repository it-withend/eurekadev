# Changing the stack

PocketLab was built so that its valuable part — the measurement engine — does
not depend on the web framework, the hosting provider or the AI vendor. This page
says what each part depends on and what it takes to swap it.

## What depends on what

| Layer | Lines | Depends on | Framework-free? |
|---|---:|---|---|
| `src/dsp` — FFT, filters, period, regression | ~480 | nothing | ✅ pure TypeScript |
| `src/core` — contracts, recording format, params, formulas, sensor adapters | ~940 | `dsp`; browser APIs only in `core/sensors/{motion,audio}.ts` | ✅ (adapters are thin) |
| `src/experiments` — all 12 experiments, builder engine, virtual labs | ~1 840 | `core`, `dsp` | ✅ pure TypeScript |
| `src/server` — AI tutor back end | ~160 | standard `fetch` / `Request` / `Response` | ✅ |
| `src/ui` — React pages and components | ~3 400 | React 18 | ❌ the only React code |

**Half of the application code has no framework dependency at all**, and ESLint
(`eslint.config.js`) fails the build if `dsp`, `core` or `experiments` ever import
React or the UI. The rule keeps it that way.

## Swapping the UI framework (Vue, Svelte, Solid, Angular…)

Rewrite `src/ui` only. Everything a page needs is a plain function call:

```ts
import { registry } from '@experiments/index';
const def = registry.get('pendulum')!;
const result = def.analyze(recording);      // pure: Recording → AnalysisResult
result.story;    // explanation in simple words
result.steps;    // explanation with formulas
result.charts;   // data for any chart library
```

Capture is the same in any framework: `createSensor(def.sensor)` →
`prepare()` (inside a tap) → `start(onSample)` → `stop()` → `createRecording(...)`.

## Native apps (React Native, Kotlin, Swift, Flutter)

- **React Native / Expo:** reuse `dsp`, `core` (except the two browser sensor
  adapters), `experiments` and `server` unchanged. Write two new `SensorSource`
  adapters on top of `expo-sensors` / `expo-av` and register them in
  `core/sensors/index.ts`; the raw-data post-processing (`core/sensors/processing.ts`)
  is already shared and tested.
- **Kotlin / Swift / Flutter:** the contracts are language-neutral data. Recordings
  (`pocketlab.recording`, v1) and student experiments (`pocketlab.experiment`, v1)
  are plain JSON, so a native app can capture data and still use the same
  experiment files, sample datasets and validation suite. The DSP is ~500 lines of
  textbook algorithms (radix-2 FFT, RBJ biquads, least squares) with tests that
  serve as a specification for a port.

## Hosting

The site is static (`npm run build` → `dist/`) and runs on any static host —
Vercel, Netlify, GitHub Pages, Cloudflare Pages, a school server — or offline as
an installed PWA. Hash routing means no server rewrites are needed.

Only the optional AI tutor needs a server. `src/server/tutor.ts` exports
`handleChat(body, { apiKey, client })` and uses nothing but `fetch`, so the adapter
is a few lines anywhere:

| Platform | Adapter |
|---|---|
| Vercel | `api/chat.ts` (included) |
| Netlify Functions / Cloudflare Workers | `export default { fetch: (req) => … handleChat(await req.json(), …) }` |
| Express / Fastify | `app.post('/api/chat', async (req, res) => res.status(r.status).json((r = await handleChat(req.body, …)).body))` |
| Vite dev server | `vite.config.ts` (included) |

## AI provider

The tutor talks to Groq's OpenAI-compatible endpoint (`GROQ_URL` in
`src/server/tutor.ts`). Any OpenAI-compatible provider — OpenAI, Together,
OpenRouter, a local Ollama server — works by changing the URL, the key and the
model name. The prompt and the context builder (`src/ui/tutor.ts`) are provider-neutral.

## Adding to the engine

- A new experiment from existing measures: a few lines of data in
  `src/experiments/library.ts` ([guide](ADDING_AN_EXPERIMENT.md)).
- A new kind of measurement: one extractor in `src/experiments/custom/measures.ts`
  (it becomes available in the builder too).
- A new sensor family: one `SensorSource` adapter plus one line in
  `core/sensors/index.ts`.
- A virtual lab for an experiment: a `simulate()` function and a scene.
