import { useEffect, useId, useState } from 'react';

interface NativeSurfacePositionProps {
  translate: readonly [number, number, number];
  disabled: boolean;
  onChange: (axis: number, value: number) => void;
}

interface PositionDraft { numeric: number; text: string }

const DECIMAL = /^[\t\n\v\f\r ]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[\t\n\v\f\r ]*$/;

function format(value: number): string {
  if (Object.is(value, -0)) return '-0';
  return Number.isNaN(value) ? '' : String(value);
}

function numeric(text: string): number {
  if (!DECIMAL.test(text)) return NaN;
  const value = Number(text);
  return Number.isFinite(value) ? value : NaN;
}

function positionError(value: number, text: string): string | null {
  if (!Number.isFinite(value)) return text.trim() === '' ? 'Enter a position.' : 'Enter a finite decimal number.';
  if (value < -1000 || value > 1000) return 'Use a value from -1000 to 1000.';
  return null;
}

function PositionField({ axis, value, disabled, onChange }: {
  axis: number; value: number; disabled: boolean; onChange: (axis: number, value: number) => void;
}) {
  const id = useId(), errorId = `${id}-error`;
  const [draft, setDraft] = useState<PositionDraft>(() => ({ numeric: value, text: format(value) }));
  // A prop change takes effect during this render, before the effect synchronizes
  // local state. Equal numbers (including NaN and signed zero) retain raw input.
  const sameValue = Object.is(value, draft.numeric);
  const text = sameValue ? draft.text : format(value);
  const message = positionError(value, text);
  useEffect(() => {
    setDraft((current) => Object.is(value, current.numeric) ? current : { numeric: value, text: format(value) });
  }, [value]);
  const name = ['X', 'Y', 'Z'][axis];
  return <div className="re-native-position-field">
    <label htmlFor={id}><span>{name}</span><input id={id} type="text" inputMode="decimal"
      aria-label={`Native ${name}`} aria-invalid={message !== null} aria-describedby={message ? errorId : undefined}
      disabled={disabled} value={text} onChange={(event) => {
        const text = event.target.value, value = numeric(text);
        setDraft({ numeric: value, text });
        onChange(axis, value);
      }} /></label>
    {message && <p id={errorId} className="re-native-position-error">{message}</p>}
  </div>;
}

/** Private raw-text controls. The host owns document drafts and Apply. */
export function NativeSurfacePosition({ translate, disabled, onChange }: NativeSurfacePositionProps) {
  return <>
    <fieldset className="re-native-position"><legend>Position · scene units</legend>
      <div className="re-vector">{translate.map((value, axis) => <PositionField key={axis}
        axis={axis} value={value} disabled={disabled} onChange={onChange} />)}</div>
    </fieldset>
    <details className="re-camera-advanced re-native-position-help"><summary>Help: Surface position</summary>
      <p className="re-caption">Preview position = native mm × scene units/mm + X/Y/Z. These values change the display position. The original native geometry stays unchanged.</p>
      <p className="re-caption">Each axis must be from -1000 to 1000. The complete transformed Surface must also fit the preview bounds.</p>
      <p className="re-caption">Apply shows the draft. Discard restores accepted values. Cancel leaves the draft unchanged.</p>
    </details>
  </>;
}
