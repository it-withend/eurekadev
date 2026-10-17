import { useState } from 'react';
import { parseDecimal } from '@core/params';

/** Number box that keeps the raw text while typing and accepts a decimal comma. Reports NaN when invalid. */
export function DecimalInput({
  value,
  onChange,
  ...rest
}: { value: number; onChange: (v: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const shown = Number.isFinite(value) ? String(value) : '';
  const [text, setText] = useState(shown);
  const typed = parseDecimal(text);
  if (Number.isFinite(value) && typed !== value && text !== shown) setText(shown);
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseDecimal(e.target.value));
      }}
    />
  );
}
