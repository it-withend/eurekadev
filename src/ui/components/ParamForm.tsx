import { useState } from 'react';
import { fromDisplay, parseDecimal, toDisplay, validateParams } from '@core/params';
import type { ParamSpec } from '@core/types';

type NumberSpec = Extract<ParamSpec, { kind: 'number' }>;

/**
 * A number field that keeps the student's raw text while typing ("0," or
 * an empty box are fine mid-edit) and reports SI values upwards.
 */
function NumberField({
  spec,
  si,
  error,
  disabled,
  onChange,
}: {
  spec: NumberSpec;
  si: number;
  error?: string;
  disabled?: boolean;
  onChange: (si: number) => void;
}) {
  const shown = Number.isFinite(si) ? String(toDisplay(spec, si)) : '';
  const [text, setText] = useState(shown);
  // Follow external changes (e.g. loading a recording) unless they match what is typed.
  const typed = parseDecimal(text);
  if (Number.isFinite(si) && (!Number.isFinite(typed) || fromDisplay(spec, typed) !== si) && text !== shown) {
    setText(shown);
  }
  const id = `param-${spec.id}`;
  return (
    <div className={`param${error ? ' invalid' : ''}`}>
      <label className="param-label" htmlFor={id}>
        {spec.label}
      </label>
      <span className="param-input">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={`${id}-note`}
          onChange={(e) => {
            setText(e.target.value);
            const v = parseDecimal(e.target.value);
            onChange(Number.isFinite(v) ? fromDisplay(spec, v) : NaN);
          }}
        />
        <span className="unit">{spec.unit}</span>
      </span>
      <span id={`${id}-note`} className={error ? 'param-error' : 'param-help'}>
        {error ?? spec.help}
      </span>
    </div>
  );
}

export function ParamForm({
  specs,
  values,
  onChange,
  disabled,
}: {
  specs: ParamSpec[];
  /** SI values. */
  values: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  disabled?: boolean;
}) {
  const errors = validateParams(specs, values);
  const set = (id: string, v: number) => onChange({ ...values, [id]: v });
  return (
    <div className="params">
      {specs.map((p) =>
        p.kind === 'number' ? (
          <NumberField
            key={p.id}
            spec={p}
            si={values[p.id]}
            error={errors[p.id]}
            disabled={disabled}
            onChange={(v) => set(p.id, v)}
          />
        ) : (
          <div key={p.id} className="param">
            <label className="param-label" htmlFor={`param-${p.id}`}>
              {p.label}
            </label>
            <select
              id={`param-${p.id}`}
              value={values[p.id]}
              disabled={disabled}
              onChange={(e) => set(p.id, Number(e.target.value))}
            >
              {p.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {p.help && <span className="param-help">{p.help}</span>}
          </div>
        ),
      )}
    </div>
  );
}
