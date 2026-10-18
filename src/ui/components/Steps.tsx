/** The four stages of every experiment. The page shows one at a time, so students always know where they are. */
export const STEPS = [
  { id: 'step-setup', label: 'Set up' },
  { id: 'step-measure', label: 'Measure' },
  { id: 'step-results', label: 'Results' },
  { id: 'step-report', label: 'Write up' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

export function StepHeading({ id, children }: { id: StepId; children?: React.ReactNode }) {
  const index = STEPS.findIndex((s) => s.id === id);
  return (
    <h2 className="step-heading">
      <span className="step-no" aria-hidden="true">
        {index + 1}
      </span>
      {children ?? STEPS[index].label}
    </h2>
  );
}

/** Tabs for the four stages. `count` shows how many results exist, so finished work is never hidden. */
export function StepBar({ current, onSelect, count }: { current: StepId; onSelect: (s: StepId) => void; count: number }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <nav className="step-bar no-print" aria-label="Experiment steps" data-tour="steps">
      <ol role="tablist">
        {STEPS.map((s, i) => (
          <li key={s.id} className={s.id === current ? 'current' : i < currentIndex ? 'done' : ''}>
            <button role="tab" aria-selected={s.id === current} onClick={() => onSelect(s.id)}>
              <span className="step-no">{i + 1}</span>
              <span className="step-label">{s.label}</span>
              {s.id === 'step-results' && count > 0 && <span className="step-count">{count}</span>}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Back / next at the bottom of each step. */
export function StepNav({ current, onSelect }: { current: StepId; onSelect: (s: StepId) => void }) {
  const i = STEPS.findIndex((s) => s.id === current);
  const prev = STEPS[i - 1];
  const next = STEPS[i + 1];
  return (
    <div className="step-nav no-print">
      {prev ? (
        <button onClick={() => onSelect(prev.id)}>Back: {prev.label}</button>
      ) : (
        <span />
      )}
      {next && (
        <button className="primary" onClick={() => onSelect(next.id)}>
          Next: {next.label}
        </button>
      )}
    </div>
  );
}
