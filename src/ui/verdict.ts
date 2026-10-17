import type { Comparison } from '@core/types';

export type Verdict = 'agrees' | 'close' | 'off' | 'imprecise';

/** Above this relative uncertainty a result cannot confirm or refute anything. */
const MAX_RELATIVE_UNCERTAINTY = 0.1;

/**
 * Agreement within 2σ is the usual "consistent with the accepted value"
 * criterion — but only meaningful when the uncertainty itself is small:
 * 14 ± 22 m/s² "agrees" with 9.81 without having measured anything.
 */
export function agreement(c: Comparison): { errorPct: number; sigmas: number; verdict: Verdict } {
  const diff = c.measured - c.accepted;
  const errorPct = (Math.abs(diff) / Math.abs(c.accepted)) * 100;
  // Both sides can be uncertain (a ruler reading is), so combine them.
  const combined = Math.hypot(c.uncertainty, c.acceptedUncertainty ?? 0);
  const sigmas = combined > 0 ? Math.abs(diff) / combined : Infinity;
  const relative = c.uncertainty / Math.abs(c.measured || c.accepted);
  const verdict: Verdict =
    relative > MAX_RELATIVE_UNCERTAINTY ? 'imprecise' : sigmas <= 2 ? 'agrees' : errorPct <= 5 ? 'close' : 'off';
  return { errorPct, sigmas, verdict };
}

export const VERDICT_TITLE: Record<Verdict, string> = {
  agrees: 'Your result agrees with the accepted value',
  close: 'Close — but something shifted your result',
  off: 'Far from the accepted value',
  imprecise: 'Too uncertain to draw a conclusion',
};

/** Plain-language interpretation for a 13-year-old, no statistics vocabulary required. */
export function explain(c: Comparison): string {
  const { errorPct, verdict } = agreement(c);
  const pct = errorPct < 0.1 ? 'less than 0.1 %' : `${errorPct.toFixed(errorPct < 10 ? 1 : 0)} %`;
  switch (verdict) {
    case 'agrees':
      return `You are ${pct} away from the accepted value. Every measurement has some uncertainty (the ± part), and the accepted value lies inside the range you could expect — so your experiment confirms it. Great work!`;
    case 'close':
      return `You are only ${pct} away, but that is more than your measurement uncertainty explains. Something consistent probably pushed the result one way — look at the possible sources of error in the worksheet below, then try another trial.`;
    case 'imprecise':
      return `The uncertainty (± part) is so large that this result could match almost anything. The measurements disagree with each other, or the signal was too weak. Check each trial below for one that looks wrong, fix or delete it, and record more trials.`;
    case 'off': {
      const ratio = c.measured / c.accepted;
      const units =
        ratio > 50 || ratio < 0.02
          ? ' The result is off by a factor of about 100, which usually means a value was entered in the wrong unit (cm vs m) — use "Fix parameters".'
          : '';
      return `Your result is ${pct} away from the accepted value. That usually means something in the setup went wrong: check the values you entered and repeat the procedure carefully.${units}`;
    }
  }
}
