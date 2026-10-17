import type { Comparison, SuccessfulAnalysis } from '@core/types';
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
      <div className="headline-ref">
        Accepted: {f(c.accepted, c.digits)}
        {c.acceptedUncertainty ? ` ± ${f(c.acceptedUncertainty, c.digits)}` : ''} {c.unit}{' '}
        <span className="src">({c.acceptedSource})</span>
      </div>
      <div className="headline-verdict">
        <strong>{VERDICT_TITLE[a.verdict]}</strong>
        <span className="stats">
          {f(a.errorPct, 2)} % error · {Number.isFinite(a.sigmas) ? `${f(a.sigmas, 1)}σ` : '—'}
        </span>
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

export function ResultView({ result }: { result: SuccessfulAnalysis }) {
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

      <div className="charts">
        {result.charts.map((c) => (
          <Chart key={c.title} spec={c} />
        ))}
      </div>

      <div className="two-col">
        <section>
          <h3>Measurements</h3>
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
        </section>
        <section>
          <h3>How it was calculated</h3>
          <ol className="steps">
            {result.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
