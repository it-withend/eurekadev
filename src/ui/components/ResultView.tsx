import { useState } from 'react';
import type { Comparison, SuccessfulAnalysis } from '@core/types';
import { load, save } from '../storage';
import { agreement, explain, VERDICT_TITLE } from '../verdict';
import { Chart } from './Chart';

const f = (v: number, d: number) => (Number.isFinite(v) ? v.toFixed(d) : '—');

function Headline({ c }: { c: Comparison }) {
  const a = agreement(c);
  return (
    <section className={`headline ${a.verdict}`}>
      <div className="headline-label">{c.quantity}</div>
      <div className="headline-value">
        <span className="sym">{c.symbol} =</span> {f(c.measured, c.digits)}
        <span className="pm"> ± {f(c.uncertainty, c.digits)}</span>
        <span className="unit"> {c.unit}</span>
      </div>
      {c.accepted !== undefined && (
        <div className="headline-ref">
          Accepted: {f(c.accepted, c.digits)}
          {c.acceptedUncertainty ? ` ± ${f(c.acceptedUncertainty, c.digits)}` : ''} {c.unit}{' '}
          <span className="src">({c.acceptedSource})</span>
        </div>
      )}
      <div className="headline-verdict">
        <strong>{VERDICT_TITLE[a.verdict]}</strong>
        {c.accepted !== undefined && (
          <span className="stats">
            {f(a.errorPct, 2)} % error · {Number.isFinite(a.sigmas) ? `${f(a.sigmas, 1)}σ` : '—'}
          </span>
        )}
      </div>
      <p className="headline-explain">{explain(c)}</p>
      <details className="explain-more no-print">
        <summary>What do ± and σ mean?</summary>
        <p>
          <strong>±</strong> is the <em>uncertainty</em>: no measurement is perfect, so the true value very likely lies
          between {f(c.measured - c.uncertainty, c.digits)} and {f(c.measured + c.uncertainty, c.digits)} {c.unit}.
        </p>
        <p>
          <strong>σ</strong> (sigma) counts how many of those uncertainties separate your result from the accepted
          value. Scientists call two values consistent when they are less than about 2σ apart.
        </p>
      </details>
    </section>
  );
}

type ExplainMode = 'simple' | 'formulas';
const EXPLAIN_KEY = 'pocketlab.explain';

/** The same result explained two ways: everyday words, or the full derivation. */
function Explanation({ result, onAsk }: { result: SuccessfulAnalysis; onAsk?: () => void }) {
  const [mode, setMode] = useState<ExplainMode>(() => (result.story ? load<ExplainMode>(EXPLAIN_KEY, 'simple') : 'formulas'));
  const choose = (m: ExplainMode) => {
    setMode(m);
    save(EXPLAIN_KEY, m);
  };
  const showSimple = mode === 'simple' && !!result.story;
  return (
    <section className="explain" aria-label="What does this result mean?">
      <div className="explain-head">
        <h3>What happened?</h3>
        {result.story && (
          <div className="segmented no-print" role="tablist" aria-label="Explanation style">
            <button role="tab" aria-selected={showSimple} className={showSimple ? 'on' : ''} onClick={() => choose('simple')}>
              💬 In simple words
            </button>
            <button role="tab" aria-selected={!showSimple} className={!showSimple ? 'on' : ''} onClick={() => choose('formulas')}>
              ∑ With formulas
            </button>
          </div>
        )}
      </div>
      <ol className={`steps ${showSimple ? 'story' : ''}`} role="tabpanel">
        {(showSimple ? result.story! : result.steps).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {/* The printed report always contains the full derivation as well. */}
      {showSimple && (
        <ol className="steps print-only">
          {result.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      {onAsk && (
        <button className="link ask-link no-print" onClick={onAsk}>
          🤖 Still unclear? Ask the AI tutor about this result
        </button>
      )}
    </section>
  );
}

export function ResultView({
  result,
  takeaways,
  onAsk,
}: {
  result: SuccessfulAnalysis;
  takeaways?: string[];
  onAsk?: () => void;
}) {
  return (
    <div className="result">
      <Headline c={result.primary} />

      {result.warnings.length > 0 && (
        <ul className="warnings">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <Explanation result={result} onAsk={onAsk} />

      {takeaways && takeaways.length > 0 && (
        <section className="takeaways">
          <h3>💡 Key ideas to remember</h3>
          <ul>
            {takeaways.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="charts">
        {result.charts.map((c) => (
          <Chart key={c.title} spec={c} />
        ))}
      </div>

      <details className="numbers">
        <summary>All the numbers</summary>
        <table className="measurements">
          <tbody>
            {result.measurements.map((m) => (
              <tr key={m.label}>
                <th>{m.label}</th>
                <td>
                  {f(m.value, m.digits ?? 3)}
                  {m.uncertainty !== undefined && <span className="pm"> ± {f(m.uncertainty, m.digits ?? 3)}</span>}
                  {m.unit && <span className="unit"> {m.unit}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
