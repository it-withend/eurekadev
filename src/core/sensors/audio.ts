import { SensorError, type Capture, type LiveSample, type SensorSource } from './types';

/** Target rate after decimation. Plenty for resonances below ~3 kHz, and keeps recordings small. */
const TARGET_RATE = 8000;

// Runs on the audio thread: forwards raw sample blocks to the main thread.
const WORKLET = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('pocketlab-tap', Tap);
`;

/** Microphone via Web Audio. Disables browser voice processing that would distort the physics. */
export class AudioSource implements SensorSource {
  readonly kind = 'audio' as const;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private chunks: Float32Array[] = [];

  async prepare(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new SensorError('Microphone access is not available.', 'Use https and a modern browser.');
    }
    // Create and resume the context synchronously inside the user gesture:
    // iOS Safari refuses to start audio from a timer later on.
    this.ctx = new AudioContext();
    void this.ctx.resume();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      this.dispose();
      throw new SensorError('Microphone access was denied.', 'Allow microphone access and try again.');
    }
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    try {
      await this.ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  start(onSample: (s: LiveSample) => void): void {
    if (!this.ctx || !this.stream) throw new SensorError('Microphone not prepared.');
    void this.ctx.resume();
    this.chunks = [];
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'pocketlab-tap');
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      const block = e.data;
      this.chunks.push(block);
      let s = 0;
      for (let i = 0; i < block.length; i++) s += block[i] * block[i];
      onSample({ rms: Math.sqrt(s / block.length) });
    };
    src.connect(this.node);
  }

  stop(): Capture {
    const rate = this.ctx?.sampleRate ?? 48000;
    const chunks = this.chunks;
    this.dispose();
    const total = chunks.reduce((n, c) => n + c.length, 0);
    if (total < rate * 0.5) throw new SensorError('Too little audio was captured.');
    // Box-car average then decimate: a cheap anti-aliasing low-pass.
    const factor = Math.max(1, Math.floor(rate / TARGET_RATE));
    const out = new Float64Array(Math.floor(total / factor));
    let acc = 0, k = 0, j = 0;
    for (const c of chunks) {
      for (let i = 0; i < c.length; i++) {
        acc += c[i];
        if (++k === factor) {
          if (j < out.length) out[j++] = acc / factor;
          acc = 0;
          k = 0;
        }
      }
    }
    return { sampleRate: rate / factor, channels: { audio: out }, device: navigator.userAgent };
  }

  dispose(): void {
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => undefined);
    this.node = null;
    this.stream = null;
    this.ctx = null;
  }
}
