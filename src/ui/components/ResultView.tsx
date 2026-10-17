import type { AnalysisResult, Comparison } from '@core/types';
import { Chart } from './Chart';

type Ok = Extract<AnalysisResult, { ok: true }>;

const f = (v: number, d: number) => (Number.isFinite(v) ? v.toFixed(d) : '—');

/** Agreement within 2σ is the usual "consistent with the accepted value" criterion. */
export function agreement(c: Comparison): { errorPct: number; sigmas: number; verdict: 'agrees' | 'close' | 'off' } {
  const diff = c.measured - c.accepted;
  const errorPct = (Math.abs(diff) / Math.abs(c.accepted)) * 100;
  const sigmas = c.uncertainty > 0 ? Math.abs(diff) / c.uncertainty : Infinity;
  const verdict = sigmas <= 2 ? 'agrees' : errorPct <= 5 ? 'close' : 'off';
  return { errorPct, sigmas, verdict };
}

const VERDICT_TEXT = {
  agrees: 'Agrees with the accepted value within uncertainty',
  close: 'Within 5 % — but outside the estimated uncertainty',
  off: 'Far from the accepted value — check the setup and parameters',
};

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
        Accepted: {f(c.accepted, c.digits)} {c.unit} <span className="src">({c.acceptedSource})</span>
      </div>
      <div className="headline-verdict">
        <strong>{f(a.errorPct, 2)} % error</strong>
        <span>·</span>
        <span>{Number.isFinite(a.sigmas) ? `${f(a.sigmas, 1)}σ` : '—'}</span>
        <span>·</span>
        <span>{VERDICT_TEXT[a.verdict]}</span>
      </div>
    </section>
  );
}

export function ResultView({ result }: { result: Ok }) {
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
