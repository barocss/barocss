import { useState } from 'react';
import { Input } from '@/components/ui/input';

// Roadmap 20 ④ ⑥: after a dimension handle is dragged, its value in a small labelled box beside the handle (as the reference
// CAD does): type a value, Enter sets it and applies the command (the App's Enter waits for its preview), Esc cancels the command.
// The box edits the same value as the HUD (one source of truth: `onType` patches the active command's values).

interface Props {
  label: string; value: number; unit: string;
  /** The handle's tip and the viewport's size, px: the box sits beside the tip, inside the viewport. */
  at: [number, number]; width: number; height: number;
  onType(value: number): void;
}

const BOX_W = 196, BOX_H = 52;

export function HandleValueBox({ label, value, unit, at, width, height, onType }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(Math.round(value * 1e6) / 1e6);
  // (Right of the tip and below it; left of it or above it where the viewport ends.)
  const right = at[0] + 18 + BOX_W <= width - 4, below = at[1] + 14 + BOX_H <= height - 4;
  const left = Math.max(4, right ? at[0] + 18 : at[0] - 18 - BOX_W), top = Math.max(4, below ? at[1] + 14 : at[1] - 14 - BOX_H);
  const commit = () => { if (draft === null) return; const v = Number(draft); setDraft(null); if (draft.trim() !== '' && Number.isFinite(v) && v !== value) onType(v); };
  return (
    <div className="handle-value absolute z-[9] flex w-[196px] flex-col gap-1 rounded-md border border-border bg-popover/95 px-2 py-1.5 text-popover-foreground shadow-md"
      style={{ left, top }} role="group" aria-label={`${label} value`}>
      <label className="flex items-center gap-2 text-xs">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <Input className="h-6 w-20 px-1.5 text-right font-mono text-xs" type="number" step="any" aria-label={label} value={shown}
          onFocus={e => e.currentTarget.select()} onChange={e => setDraft(e.target.value)} onBlur={commit}
          // (Enter: the value first, then the App's Enter applies it once its preview is ready; Esc reaches the App, which cancels.)
          onKeyDown={e => { if (e.key === 'Enter') commit(); }} />
        <span className="w-6 text-muted-foreground">{unit}</span>
      </label>
      <span className="text-[10px] leading-3 text-muted-foreground">Preview · Enter applies · Esc cancels</span>
    </div>
  );
}
