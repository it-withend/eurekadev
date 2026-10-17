import { useEffect, useRef } from 'react';
import type { LiveBuffer } from '../hooks/useCapture';
import { drawChart } from './chartDraw';

const WINDOW_SEC = 8;

/** Scrolling oscilloscope view of the incoming sensor stream (rAF-driven, no React re-renders). */
export function LiveChart({ buffer, label }: { buffer: React.MutableRefObject<LiveBuffer>; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const canvas = ref.current;
      if (canvas) {
        const { t, v } = buffer.current;
        const now = t.length ? t[t.length - 1] : 0;
        const start = Math.max(0, now - WINDOW_SEC);
        let i = t.length - 1;
        while (i > 0 && t[i - 1] >= start) i--;
        drawChart(canvas, [{ x: t.slice(i), y: v.slice(i), style: 'line', color: 0 }], {
          xLabel: 'time (s)',
          yLabel: label,
          xRange: [start, Math.max(start + WINDOW_SEC, now)],
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [buffer, label]);
  return <canvas ref={ref} className="live-chart" aria-label="Live sensor signal" />;
}
