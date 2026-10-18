import { useEffect, useRef, useState } from 'react';
import type { VirtualLab } from '@core/types';

/**
 * Animated apparatus for the virtual lab. The motion follows the same physics
 * as the simulation (period from length and gravity, spin from ω, standing wave
 * in the tube), so what the student sees matches the data they will analyse.
 */

function useTime(running = true) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      setT((performance.now() - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return t;
}

function PendulumScene({ length, angle, gravity }: { length: number; angle: number; gravity: number }) {
  const t = useTime();
  const Leq = length + 0.15 ** 2 / 12 / length;
  const th0 = (angle * Math.PI) / 180;
  const T = 2 * Math.PI * Math.sqrt(Leq / gravity) * (1 + th0 ** 2 / 16);
  const th = th0 * Math.cos((2 * Math.PI * t) / T);
  const px = 30 + Math.min(150, (length / 2.5) * 150); // scale: 2.5 m fills the frame
  const x = 160 + px * Math.sin(th);
  const y = 20 + px * Math.cos(th);
  return (
    <svg viewBox="0 0 320 210" role="img" aria-label={`Pendulum ${Math.round(length * 100)} cm long swinging with period ${T.toFixed(2)} s`}>
      <rect x="90" y="12" width="140" height="8" rx="2" fill="currentColor" opacity=".2" />
      <line x1="160" y1="20" x2="160" y2="200" stroke="currentColor" strokeDasharray="4 5" opacity=".25" />
      <line x1="160" y1="20" x2={x} y2={y} stroke="currentColor" strokeWidth="2" />
      <g transform={`rotate(${(-th * 180) / Math.PI} ${x} ${y})`}>
        <rect x={x - 9} y={y - 2} width="18" height="30" rx="4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
      </g>
      <text x="12" y="30" fontSize="12" fill="currentColor">T ≈ {T.toFixed(2)} s</text>
      <text x="12" y="48" fontSize="11" fill="var(--ink-2)">one full swing</text>
    </svg>
  );
}

function ChairScene({ radius, spin }: { radius: number; spin: number }) {
  const t = useTime();
  // Show the real spin, slowing down like the simulated chair (τ ≈ 9 s), then restart.
  const cycle = t % 20;
  const w = cycle < 1 ? spin * cycle : spin * Math.exp(-(cycle - 1) / 9);
  const phi = cycle < 1 ? (spin * cycle * cycle) / 2 : spin / 2 + spin * 9 * (1 - Math.exp(-(cycle - 1) / 9));
  const rpx = 20 + Math.min(70, (radius / 0.6) * 70);
  return (
    <svg viewBox="0 0 320 210" role="img" aria-label={`Chair seat seen from above, phone ${Math.round(radius * 100)} cm from the centre`}>
      <circle cx="160" cy="105" r="92" fill="currentColor" opacity=".06" stroke="currentColor" strokeWidth="2" />
      <g transform={`rotate(${(phi * 180) / Math.PI} 160 105)`}>
        <line x1="160" y1="105" x2={160 + rpx} y2="105" stroke="currentColor" strokeDasharray="4 4" />
        <rect x={160 + rpx - 9} y="91" width="18" height="28" rx="4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
      </g>
      <circle cx="160" cy="105" r="4" fill="currentColor" />
      <text x="10" y="24" fontSize="12" fill="currentColor">ω ≈ {w.toFixed(1)} rad/s</text>
      <text x="10" y="42" fontSize="12" fill="currentColor">a = ω²r ≈ {(w * w * radius).toFixed(1)} m/s²</text>
    </svg>
  );
}

function TubeScene({ length, diameter, temperature, open }: { length: number; diameter: number; temperature: number; open: boolean }) {
  const t = useTime();
  const v = 331.3 * Math.sqrt(1 + temperature / 273.15);
  const f = open ? v / (2 * (length + 0.6 * diameter)) : v / (4 * (length + 0.3 * diameter));
  const h = 40 + Math.min(130, (length / 0.6) * 130);
  const top = 190 - h;
  const wpx = 30 + Math.min(40, (diameter / 0.1) * 40);
  // Air displacement envelope: a quarter wave (closed) or half wave (open), animated slowly.
  const swing = Math.sin(2 * Math.PI * 1.2 * t);
  const pts: string[] = [];
  for (let i = 0; i <= 30; i++) {
    const y = top + (h * i) / 30;
    const depth = i / 30; // 0 at the opening, 1 at the bottom
    const env = open ? Math.abs(Math.cos(Math.PI * depth)) : Math.cos((Math.PI / 2) * depth);
    pts.push(`${160 + (wpx / 2 - 4) * env * swing},${y}`);
  }
  return (
    <svg viewBox="0 0 320 210" role="img" aria-label={`Tube ${Math.round(length * 100)} cm long resonating at ${f.toFixed(0)} hertz`}>
      <path
        d={`M${160 - wpx / 2} ${top} V190 ${open ? `M${160 + wpx / 2} 190` : `H${160 + wpx / 2}`} V${top}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" />
      <text x="12" y="30" fontSize="12" fill="currentColor">f ≈ {f.toFixed(0)} Hz</text>
      <text x="12" y="48" fontSize="11" fill="var(--ink-2)">{open ? '½ wave fits' : '¼ wave fits'}</text>
    </svg>
  );
}

export function VirtualScene({ lab, params, knobs }: { lab: VirtualLab; params: Record<string, number>; knobs: Record<string, number> }) {
  const safe = (v: number, fallback: number) => (Number.isFinite(v) && v > 0 ? v : fallback);
  return (
    <div className="scene">
      {lab.scene === 'pendulum' && <PendulumScene length={safe(params.length, 1)} angle={knobs.angle ?? 12} gravity={safe(knobs.gravity, 9.81)} />}
      {lab.scene === 'chair' && <ChairScene radius={safe(params.radius, 0.25)} spin={knobs.spin ?? 7} />}
      {lab.scene === 'tube' && (
        <TubeScene length={safe(params.length, 0.3)} diameter={safe(params.diameter, 0.04)} temperature={params.temperature ?? 20} open={params.mode === 1} />
      )}
    </div>
  );
}

/** Plays the tube's note for a moment, so the student can hear what "resonance at f" means. */
export function useTone() {
  const ctx = useRef<AudioContext | null>(null);
  return (frequency: number) => {
    ctx.current ??= new AudioContext();
    const c = ctx.current;
    void c.resume();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, c.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.5);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 1.6);
  };
}
