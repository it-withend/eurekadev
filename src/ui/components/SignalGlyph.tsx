import type { ExperimentDefinition } from '@core/types';

/**
 * A small drawing of the signal each experiment produces — the "fingerprint"
 * on its catalogue card. Students learn to recognise the shapes they will see
 * in their results.
 */
export type Glyph = NonNullable<ExperimentDefinition['glyph']>;

const W = 240;
const H = 56;

function path(f: (u: number) => number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const u = i / 120;
    pts.push(`${(u * W).toFixed(1)},${(H / 2 - f(u) * (H / 2 - 6)).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

const SHAPES: Record<Glyph, { d: string; axis: 'x' | 'y' | 'z' }> = {
  swing: { d: path((u) => Math.exp(-u * 1.4) * Math.sin(u * 2 * Math.PI * 4.5)), axis: 'z' },
  bounce: { d: path((u) => Math.exp(-u * 0.8) * Math.sin(u * 2 * Math.PI * 7)), axis: 'y' },
  spectrum: {
    d: path((u) => -0.85 + 1.75 * Math.exp(-(((u - 0.38) / 0.025) ** 2)) + 0.5 * Math.exp(-(((u - 0.82) / 0.02) ** 2)) + 0.25 * Math.exp(-u * 6)),
    axis: 'z',
  },
  spin: { d: path((u) => -0.85 + 1.75 * (u < 0.12 ? u / 0.12 : Math.exp(-(u - 0.12) * 2.2))), axis: 'x' },
  jolt: {
    d: path((u) => 0.9 * Math.exp(-(((u - 0.55) / 0.018) ** 2)) - 0.5 * Math.exp(-(((u - 0.47) / 0.05) ** 2)) + 0.25 * Math.sin(u * 60) * Math.exp(-(((u - 0.62) / 0.06) ** 2))),
    axis: 'x',
  },
  tilt: { d: path((u) => (u < 0.7 ? -0.8 + (1.6 * u) / 0.7 : u < 0.74 ? 0.8 - (u - 0.7) * 30 : -0.4)), axis: 'y' },
  level: { d: path((u) => (u < 0.15 ? -0.8 + (u / 0.15) * 1.2 : 0.4 + 0.03 * Math.sin(u * 80))), axis: 'y' },
};

export function SignalGlyph({ glyph }: { glyph: Glyph }) {
  const s = SHAPES[glyph];
  return (
    <svg className={`glyph axis-${s.axis}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} className="glyph-zero" />
      <path d={s.d} />
    </svg>
  );
}
