import { readParam, toDisplay } from '@core/params';
import type { ExperimentDefinition } from '@core/types';
import type { AnalyzedTrial } from '../hooks/useTrials';
import { agreement } from '../verdict';

const ORIGIN = { sensor: 'phone', sample: 'sample', file: 'file' } as const;

export function TrialsTable({
  def,
  trials,
  selectedId,
  onSelect,
  onRemove,
}: {
  def: ExperimentDefinition;
  trials: AnalyzedTrial[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  // The first numeric parameter (L, r, …) is what students usually vary.
  const keyParam = def.params.find((p) => p.kind === 'number');
  return (
    <div className="table-scroll">
      <table className="trials">
        <thead>
          <tr>
            <th>#</th>
            {keyParam && keyParam.kind === 'number' && (
              <th>
                {keyParam.label.replace(/\s*\(.*\)$/, '')} ({keyParam.unit})
              </th>
            )}
            <th>Result</th>
            <th>Error</th>
            <th className="no-print">Source</th>
            <th className="no-print" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {trials.map((t) => {
            const p = t.result.ok ? t.result.primary : null;
            return (
              <tr
                key={t.id}
                className={t.id === selectedId ? 'selected' : ''}
                onClick={() => onSelect(t.id)}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(t.id)}
              >
                <td>{t.number}</td>
                {keyParam && <td>{toDisplay(keyParam, readParam(t.recording.params, def.params, keyParam.id))}</td>}
                <td>
                  {p ? (
                    <>
                      {p.measured.toFixed(p.digits)} <span className="pm">± {p.uncertainty.toFixed(p.digits)}</span> {p.unit}
                    </>
                  ) : (
                    <span className="bad">failed</span>
                  )}
                </td>
                <td>{p && p.accepted !== undefined ? `${agreement(p).errorPct.toFixed(2)} %` : '—'}</td>
                <td className="no-print">{ORIGIN[t.origin]}</td>
                <td className="no-print">
                  <button
                    className="icon"
                    aria-label={`Delete trial ${t.number}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(t.id);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
