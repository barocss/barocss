import { useState, type KeyboardEvent } from 'react';
import { keepsDimensionDraft } from '../sketch/constraintInspection';
import type { ScreenBox } from './sketchConstraintMarkLayout';

type ArcMode = 'radius' | 'diameter';
export type DimensionAxis = 'a' | 'h' | 'v';

interface Props {
  at: readonly [number, number];
  area: ScreenBox;
  value: number;
  label: string;
  driving: boolean;
  arc: boolean;
  onConfirm(value: number): void;
  onClose(): void;
  onAxis?(axis: DimensionAxis): void;
}

export function InlineSketchDimension({ at, area, value, label, driving, arc, onConfirm, onClose, onAxis }: Props) {
  const [entry, setEntry] = useState<{ mode: ArcMode; text: string }>({ mode: 'radius', text: String(value) });
  const inputLabel = entry.mode === 'diameter' ? label.replace(/^Radius/, 'Diameter') : label;
  const width = arc ? 141 : 84, height = 26;
  const clamp = (preferred: number, lower: number, upper: number) =>
    Number.isFinite(preferred) ? Math.max(lower, Math.min(upper, preferred)) : lower;
  const left = clamp(at[0] - 42, area.x, area.x + area.width - width);
  const top = clamp(at[1] - 13, area.y, area.y + area.height - height);

  function changeMode(mode: ArcMode) {
    setEntry(current => {
      if (mode === current.mode) return current;
      const number = current.text === '' ? NaN : Number(current.text);
      const converted = mode === 'diameter' ? number * 2 : number / 2;
      return { mode, text: Number.isFinite(converted) ? String(converted) : '' };
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      const number = input.valueAsNumber;
      onConfirm(entry.mode === 'diameter' ? number / 2 : number);
      input.blur();
    } else if (onAxis && /^[ahv]$/i.test(event.key)) {
      event.preventDefault();
      onAxis(event.key.toLowerCase() as DimensionAxis);
    }
  }

  return (
    <div className="dim-editor" data-sketch-dimension-focus style={{ left, top, width, height }}
      onKeyDown={onKeyDown} onBlur={event => { if (!keepsDimensionDraft(event.relatedTarget)) onClose(); }}>
      <input className="dim-edit" data-sketch-action type="number" step="any" autoFocus value={entry.text}
        aria-label={inputLabel} title={`${inputLabel}${arc ? ' (mm)' : ''}${driving ? '' : ' · Enter adds it as a driving dimension'}${onAxis ? ' · H horizontal, V vertical, A aligned' : ''} · Esc cancels`}
        onFocus={event => event.currentTarget.select()}
        onChange={event => { const text = event.currentTarget.value; setEntry(current => ({ ...current, text })); }} />
      {arc && <div className="dim-mode" role="group" aria-label="Arc dimension mode">
        <button type="button" aria-label="Radius (R)" title="Radius (mm)" aria-pressed={entry.mode === 'radius'}
          onMouseDown={event => event.preventDefault()} onClick={() => changeMode('radius')}>R</button>
        <button type="button" aria-label="Diameter (Ø)" title="Diameter (mm)" aria-pressed={entry.mode === 'diameter'}
          onMouseDown={event => event.preventDefault()} onClick={() => changeMode('diameter')}>Ø</button>
      </div>}
    </div>
  );
}
