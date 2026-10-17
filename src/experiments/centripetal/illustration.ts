export const centripetalIllustration = `
<svg viewBox="0 0 320 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Top view of a spinning chair seat with the phone taped near the edge">
  <defs><marker id="ca" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--accent)"/></marker></defs>
  <circle cx="150" cy="108" r="86" fill="currentColor" opacity=".06" stroke="currentColor" stroke-width="2"/>
  <circle cx="150" cy="108" r="4" fill="currentColor"/>
  <text x="128" y="128" font-size="11" fill="var(--ink-2)">axis</text>
  <line x1="150" y1="108" x2="208" y2="108" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4"/>
  <text x="172" y="100" font-size="14" fill="currentColor" font-style="italic">r</text>
  <rect x="208" y="90" width="26" height="40" rx="5" fill="var(--surface)" stroke="currentColor" stroke-width="2"/>
  <circle cx="221" cy="110" r="2.5" fill="var(--accent)"/>
  <line x1="204" y1="140" x2="168" y2="140" stroke="var(--accent)" stroke-width="2" marker-end="url(#ca)"/>
  <text x="176" y="156" font-size="13" fill="var(--accent)" font-style="italic">a = ω²r</text>
  <path d="M84 52 A92 92 0 0 1 150 16" fill="none" stroke="var(--accent)" stroke-width="2" marker-end="url(#ca)"/>
  <text x="84" y="34" font-size="14" fill="var(--accent)" font-style="italic">ω</text>
  <text x="246" y="64" font-size="11" fill="var(--ink-2)">phone flat,</text>
  <text x="246" y="78" font-size="11" fill="var(--ink-2)">screen up,</text>
  <text x="246" y="92" font-size="11" fill="var(--ink-2)">taped down</text>
</svg>`;
