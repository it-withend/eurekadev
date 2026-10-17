export const pendulumIllustration = `
<svg viewBox="0 0 320 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Phone hanging from a string, swinging as a pendulum">
  <rect x="70" y="14" width="180" height="10" rx="2" fill="currentColor" opacity=".18"/>
  <line x1="160" y1="24" x2="160" y2="196" stroke="currentColor" stroke-dasharray="4 5" opacity=".35"/>
  <line x1="160" y1="24" x2="214" y2="166" stroke="currentColor" stroke-width="2"/>
  <circle cx="160" cy="24" r="4" fill="currentColor"/>
  <g transform="rotate(-21 214 170)">
    <rect x="200" y="152" width="28" height="48" rx="5" fill="var(--surface)" stroke="currentColor" stroke-width="2"/>
    <circle cx="214" cy="176" r="2.5" fill="var(--accent)"/>
  </g>
  <path d="M160 74 A50 50 0 0 0 178 71" fill="none" stroke="var(--accent)" stroke-width="2"/>
  <text x="168" y="92" font-size="13" fill="var(--accent)" font-style="italic">θ</text>
  <text x="196" y="96" font-size="14" fill="currentColor" font-style="italic">L</text>
  <path d="M120 170 Q160 196 200 182" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="1 0" marker-end="url(#pa)" opacity=".8"/>
  <defs><marker id="pa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--accent)"/></marker></defs>
  <text x="18" y="120" font-size="11" fill="var(--ink-2)">L = pivot → centre</text>
  <text x="18" y="135" font-size="11" fill="var(--ink-2)">of the phone</text>
  <text x="18" y="160" font-size="11" fill="var(--ink-2)">swing ≈ 10–15°</text>
</svg>`;
