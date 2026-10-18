import { readParam, toDisplay } from '@core/params';
import type { AnalysisResult, ExperimentDefinition } from '@core/types';
import { agreement, VERDICT_TITLE } from './verdict';

/**
 * Everything the AI tutor needs to know about this experiment, as plain text.
 * Pure (unit-tested). The tutor is told to use only these numbers.
 */
export function tutorContext(
  def: ExperimentDefinition,
  input: { params?: Record<string, number>; result?: AnalysisResult | null; summary?: AnalysisResult | null; trials: number },
): string {
  const lines: string[] = [
    `Experiment: ${def.title} — ${def.tagline}`,
    `Physics: ${def.theory.summary}`,
    `Formula: ${def.theory.formula}`,
    `Procedure: ${def.instructions.join(' ')}`,
  ];
  if (input.params) {
    const ps = def.params
      .filter((p) => p.kind === 'number')
      .map((p) => `${p.label} = ${toDisplay(p, readParam(input.params!, def.params, p.id))} ${p.kind === 'number' ? p.unit : ''}`);
    if (ps.length) lines.push(`Values the student entered: ${ps.join('; ')}`);
  }
  const describe = (label: string, r: AnalysisResult | null | undefined) => {
    if (!r) return;
    if (!r.ok) {
      lines.push(`${label}: the analysis failed — ${r.error}${r.hint ? ` (${r.hint})` : ''}`);
      return;
    }
    const c = r.primary;
    const a = agreement(c);
    lines.push(`${label}: ${c.quantity} ${c.symbol} = ${c.measured.toFixed(c.digits)} ± ${c.uncertainty.toFixed(c.digits)} ${c.unit}`);
    if (c.accepted !== undefined) {
      lines.push(`Accepted value: ${c.accepted.toFixed(c.digits)} ${c.unit} (${c.acceptedSource}); error ${a.errorPct.toFixed(2)} %; verdict shown to the student: "${VERDICT_TITLE[a.verdict]}"`);
    }
    if (r.story?.length) lines.push(`Plain explanation shown: ${r.story.join(' ')}`);
    lines.push(`Calculation shown: ${r.steps.join(' ')}`);
    if (r.warnings.length) lines.push(`Warnings shown: ${r.warnings.join(' ')}`);
  };
  lines.push(`Number of trials so far: ${input.trials}`);
  describe('Combined result of all trials', input.summary);
  describe('Result of the selected trial', input.result);
  if (def.errorSources?.length) lines.push(`Possible sources of error: ${def.errorSources.join(' ')}`);
  if (def.takeaways?.length) lines.push(`Key ideas: ${def.takeaways.join(' ')}`);
  return lines.join('\n');
}

export const SUGGESTIONS = [
  'Explain my result in simple words',
  'Why isn’t my result exactly the textbook value?',
  'What does the graph show?',
  'How can I make my measurement more accurate?',
];
