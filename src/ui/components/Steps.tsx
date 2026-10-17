/** The four stages every experiment page walks through, so students always know where they are. */
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

/** Sticky progress bar; tapping a step scrolls to it (buttons, not links: the URL hash is the router). */
export function StepBar({ current, reached }: { current: StepId; reached: StepId }) {
  const reachedIndex = STEPS.findIndex((s) => s.id === reached);
  return (
    <nav className="step-bar no-print" aria-label="Experiment progress" data-tour="steps">
      <ol>
        {STEPS.map((s, i) => (
          <li key={s.id} className={s.id === current ? 'current' : i <= reachedIndex ? 'done' : ''}>
            <button
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              aria-current={s.id === current ? 'step' : undefined}
            >
              <span className="step-no">{i + 1}</span>
              <span className="step-label">{s.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
