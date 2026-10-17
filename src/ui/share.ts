import type { AnalysisResult, ExperimentDefinition, Recording } from '@core/types';
import { agreement, VERDICT_TITLE } from './verdict';

/** Plain-text result a student can send to a teacher in any messenger. Pure, so it is unit-tested. */
export function resultSummary(
  def: ExperimentDefinition,
  okTrials: number,
  best: AnalysisResult | null,
  link: string,
): string {
  const lines = [`PocketLab — ${def.title}`];
  if (best?.ok) {
    const c = best.primary;
    lines.push(`${c.quantity}: ${c.symbol} = ${c.measured.toFixed(c.digits)} ± ${c.uncertainty.toFixed(c.digits)} ${c.unit}`);
    if (c.accepted !== undefined) {
      const a = agreement(c);
      lines.push(`Accepted: ${c.accepted.toFixed(c.digits)} ${c.unit} (${a.errorPct.toFixed(1)} % error) — ${VERDICT_TITLE[a.verdict]}`);
    }
  }
  lines.push(`Trials: ${okTrials}`, link);
  return lines.join('\n');
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unavailable';

/**
 * Uses the phone's share sheet (Telegram, WhatsApp, mail…) and attaches the
 * recording when the browser allows files; otherwise copies the text.
 */
export async function shareResult(text: string, recording?: Recording, filename = 'pocketlab-recording.json'): Promise<ShareOutcome> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share) {
    const file = recording ? new File([JSON.stringify(recording)], filename, { type: 'application/json' }) : null;
    const withFile: ShareData = file ? { title: 'PocketLab result', text, files: [file] } : { title: 'PocketLab result', text };
    const data = file && nav.canShare?.(withFile) ? withFile : { title: 'PocketLab result', text };
    try {
      await nav.share(data);
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'unavailable';
  }
}
