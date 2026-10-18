import { useEffect, useRef, useState } from 'react';

/**
 * The home page's one big moment: the phone's three sensor axes drawn live on
 * graph paper. On phones that deliver motion events without a prompt (most
 * Android browsers) the trace follows the reader's own hand; everywhere else it
 * shows what a gyroscope sees on a swinging pendulum. Static under reduced motion.
 */
const WINDOW = 6; // seconds shown
const COLORS = ['--axis-x', '--axis-y', '--axis-z'] as const;

function demoSample(t: number): [number, number, number] {
  // A pendulum as the phone feels it: rotation (z) swings, tension (y) pulses twice per swing.
  const T = 1.9;
  const decay = 0.35 + 0.65 * Math.exp(-((t % 24) / 16));
  return [
    0.15 * Math.sin(2 * Math.PI * 0.37 * t) * decay,
    0.45 * Math.cos((4 * Math.PI * t) / T) * decay * decay,
    Math.sin((2 * Math.PI * t) / T) * decay,
  ];
}

export function HeroTrace() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const history: { t: number; v: [number, number, number] }[] = [];
    let liveUntil = 0;
    let latest: [number, number, number] = [0, 0, 0];
    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.rotationRate;
      if (!g || g.alpha === null) return;
      // deg/s → a comfortable on-screen scale
      latest = [(g.beta ?? 0) / 120, (g.gamma ?? 0) / 120, (g.alpha ?? 0) / 120];
      if (!liveUntil) setLive(true);
      liveUntil = performance.now() + 1500;
    };
    window.addEventListener('devicemotion', onMotion);

    const draw = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (el.width !== Math.round(w * dpr)) el.width = Math.round(w * dpr);
      if (el.height !== Math.round(h * dpr)) el.height = Math.round(h * dpr);
      const ctx = el.getContext('2d');
      if (!ctx || !w || !h) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const t = now / 1000;
      const sample = liveUntil > now ? latest : demoSample(t);
      history.push({ t, v: sample });
      while (history.length && history[0].t < t - WINDOW) history.shift();

      const css = getComputedStyle(el);
      const lanes = 3;
      const laneH = h / lanes;
      COLORS.forEach((name, axis) => {
        const mid = laneH * axis + laneH / 2;
        ctx.strokeStyle = css.getPropertyValue(name).trim();
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        history.forEach((p, i) => {
          const x = w - ((t - p.t) / WINDOW) * w;
          const y = mid - Math.max(-1, Math.min(1, p.v[axis])) * laneH * 0.42;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.stroke();
        // The pen: where the newest reading is being written.
        const last = history[history.length - 1];
        if (last) {
          ctx.fillStyle = ctx.strokeStyle;
          ctx.beginPath();
          ctx.arc(w - 2, mid - Math.max(-1, Math.min(1, last.v[axis])) * laneH * 0.42, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    };

    let raf = 0;
    if (reduced) {
      // Draw a static window of the demo signal once.
      for (let i = 0; i <= 240; i++) history.push({ t: (i / 240) * WINDOW, v: demoSample((i / 240) * WINDOW) });
      draw(WINDOW * 1000);
    } else {
      const loop = (now: number) => {
        draw(now);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('devicemotion', onMotion);
    };
  }, []);

  return (
    <figure className="hero-trace">
      <div className="hero-trace-plot">
        <span className="axis-label x">x</span>
        <span className="axis-label y">y</span>
        <span className="axis-label z">z</span>
        <canvas ref={canvas} aria-hidden="true" />
      </div>
      <figcaption>
        {live ? (
          <>
            <span className="live-dot" /> Live from your phone’s gyroscope — tilt it and watch.
          </>
        ) : (
          'A swinging pendulum, as a phone’s motion sensors record it.'
        )}
      </figcaption>
    </figure>
  );
}
