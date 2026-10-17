import type { ParamSpec } from '@core/types';

export function ParamForm({
  specs,
  values,
  onChange,
  disabled,
}: {
  specs: ParamSpec[];
  values: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  disabled?: boolean;
}) {
  const set = (id: string, v: number) => onChange({ ...values, [id]: v });
  return (
    <div className="params">
      {specs.map((p) => (
        <label key={p.id} className="param">
          <span className="param-label">{p.label}</span>
          {p.kind === 'number' ? (
            <span className="param-input">
              <input
                type="number"
                inputMode="decimal"
                value={Number.isFinite(values[p.id]) ? values[p.id] : ''}
                min={p.min}
                max={p.max}
                step={p.step ?? 'any'}
                disabled={disabled}
                onChange={(e) => set(p.id, e.target.valueAsNumber)}
              />
              <span className="unit">{p.unit}</span>
            </span>
          ) : (
            <select value={values[p.id]} disabled={disabled} onChange={(e) => set(p.id, Number(e.target.value))}>
              {p.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {p.help && <span className="param-help">{p.help}</span>}
        </label>
      ))}
    </div>
  );
}
