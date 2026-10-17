import { useEffect, useRef } from 'react';
import type { ChartSpec } from '@core/types';
import { drawChart } from './chartDraw';

export function Chart({ spec }: { spec: ChartSpec }) {
  const ref = useRef<HTMLCanvasElement>(null);

  // Redraw when the data changes, on resize, and on light/dark theme switches.
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () =>
      drawChart(
        canvas,
        spec.series.map((s, i) => ({ x: s.x, y: s.y, style: s.style, color: s.color ?? i })),
        { xLabel: spec.xLabel, yLabel: spec.yLabel },
      );
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', draw);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', draw);
    };
  }, [spec]);

  return (
    <figure className="chart">
      <figcaption>
        <span>{spec.title}</span>
        <span className="legend">
          {spec.series.map((s, i) => (
            <span key={s.name} className={`legend-item c${(s.color ?? i) % 3}`}>
              <i className={s.style} />
              {s.name}
            </span>
          ))}
        </span>
      </figcaption>
      <canvas ref={ref} role="img" aria-label={`${spec.title}: ${spec.yLabel} against ${spec.xLabel}`} />
    </figure>
  );
}
