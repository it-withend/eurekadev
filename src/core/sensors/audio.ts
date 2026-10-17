import { decimateAudio } from './processing';
import { SensorError, type Capture, type LiveSample, type SensorSource } from './types';

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

/**
 * Microphone via Web Audio. Disables browser voice processing that would
 * distort the physics. Uses an AudioWorklet where available and falls back to
 * the older ScriptProcessorNode (iOS < 14.5, old Android WebViews).
 */
export class AudioSource implements SensorSource {
  readonly kind = 'audio' as const;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioNode | null = null;
  private chunks: Float32Array[] = [];
  private useWorklet = false;

  async prepare(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new SensorError('Microphone access is not available.', 'Use https and a modern browser.');
    }
    // Create and resume the context synchronously inside the user gesture:
    // iOS Safari refuses to start audio from a timer later on.
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    void this.ctx.resume();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      this.dispose();
      throw new SensorError('Microphone access was denied.', 'Allow microphone access and try again.');
    }
    this.useWorklet = typeof AudioWorkletNode !== 'undefined' && !!this.ctx.audioWorklet;
    if (this.useWorklet) {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      try {
        await this.ctx.audioWorklet.addModule(url);
      } catch {
        this.useWorklet = false;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  }

  start(onSample: (s: LiveSample) => void): void {
    const ctx = this.ctx;
    if (!ctx || !this.stream) throw new SensorError('Microphone not prepared.');
    void ctx.resume();
    this.chunks = [];
    const push = (block: Float32Array) => {
      this.chunks.push(block);
      let s = 0;
      for (let i = 0; i < block.length; i++) s += block[i] * block[i];
      onSample({ rms: Math.sqrt(s / block.length) });
    };
    const src = ctx.createMediaStreamSource(this.stream);
    if (this.useWorklet) {
      const node = new AudioWorkletNode(ctx, 'pocketlab-tap');
      node.port.onmessage = (e: MessageEvent<Float32Array>) => push(e.data);
      src.connect(node);
      this.node = node;
    } else {
      const node = ctx.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = (e) => push(e.inputBuffer.getChannelData(0).slice(0));
      src.connect(node);
      // ScriptProcessor only runs when connected to the output; it writes silence.
      node.connect(ctx.destination);
      this.node = node;
    }
  }

  stop(): Capture {
    const rate = this.ctx?.sampleRate ?? 48000;
    const chunks = this.chunks;
    this.dispose();
    return { ...decimateAudio(chunks, rate), device: navigator.userAgent };
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
