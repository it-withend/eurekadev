/**
 * Non-visual cues. During a measurement the phone is swinging on a string or
 * spinning on a chair, so the student cannot look at the screen: beeps and
 * vibration tell them when recording starts and stops.
 */

let ctx: AudioContext | null = null;

/** Call from a user gesture once, so later beeps are allowed to play. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function beep(frequency = 880, durationMs = 120, volume = 0.2): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
}

export function vibrate(pattern: number | number[]): void {
  navigator.vibrate?.(pattern);
}

export const cues = {
  tick: () => beep(660, 90),
  start: () => {
    beep(1320, 220, 0.3);
    vibrate(150);
  },
  stop: () => {
    beep(990, 120, 0.3);
    setTimeout(() => beep(660, 220, 0.3), 160);
    vibrate([100, 80, 100]);
  },
};

/**
 * Keeps the screen on while recording: on many phones a sleeping screen
 * throttles or stops sensor events.
 */
export async function keepAwake(): Promise<() => void> {
  try {
    const lock = await navigator.wakeLock?.request('screen');
    return () => void lock?.release().catch(() => undefined);
  } catch {
    return () => undefined;
  }
}

/**
 * Spoken instructions. During a measurement the phone is swinging or spinning
 * and the student cannot read the screen, so the key instruction is also said
 * out loud. The first utterance happens inside the Start tap, which unlocks
 * speech on iOS. Never used while a microphone is recording.
 */
const VOICE_KEY = 'pocketlab.voice';
let voiceOn = (() => {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'off';
  } catch {
    return true;
  }
})();

export const voice = {
  supported: () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  enabled: () => voiceOn,
  setEnabled(on: boolean) {
    voiceOn = on;
    try {
      localStorage.setItem(VOICE_KEY, on ? 'on' : 'off');
    } catch {
      // preference only
    }
    if (!on) voice.stop();
  },
  say(text: string) {
    if (!voiceOn || !voice.supported()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  },
  stop() {
    if (voice.supported()) window.speechSynthesis.cancel();
  },
};
