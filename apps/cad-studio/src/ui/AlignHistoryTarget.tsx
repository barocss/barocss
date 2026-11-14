import { useEffect, useState } from 'react';
import type { AlignNode } from '@barocss/cad-model/engine/doc';

type Target = AlignNode['target'];
export type AlignTargetOption = { target: Target; bodyName: string; hidden?: true };
const keyOf = (target: Target) => JSON.stringify([target.feature, target.face, target.axis, target.sign]);

export function AlignHistoryTarget({ value, disabled, read, onChange }: {
  value: Target;
  disabled: boolean;
  read(): Promise<AlignTargetOption[]>;
  onChange(target: Target): void;
}) {
  const [options, setOptions] = useState<AlignTargetOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    void read().then(targets => { if (current) { setOptions(targets); setFailed(false); } },
      () => { if (current) { setOptions([]); setFailed(true); } });
    return () => { current = false; };
  }, [read]);
  const key = keyOf(value);
  const current = options?.find(({ target }) => keyOf(target) === key);
  const available = options?.filter(option => !option.hidden) ?? [];
  const choices = current && !current.hidden ? available : [current ?? { target: value, bodyName: '' }, ...available];
  return <div className="field">
    <span>Target face</span>
    <select aria-label="Target face" disabled={disabled || !available.length} value={key} onChange={event => {
      const next = available.find(({ target }) => keyOf(target) === event.target.value);
      if (next) onChange(next.target);
    }}>
      {choices.map(({ target, bodyName, hidden }) => <option key={keyOf(target)} value={keyOf(target)} disabled={hidden}>
        {bodyName ? `${bodyName} · ${target.face}` : target.face}
      </option>)}
    </select>
    {current && (
      <div className="col-start-2 min-w-0 [overflow-wrap:anywhere]" role="group" aria-label="Current Align target">
        <div>{current.bodyName}</div>
        <div><span>{value.face}</span>{current.hidden && <> · <span>Hidden</span></>}</div>
      </div>
    )}
    {failed && <span className="muted small col-span-2">The preceding model could not be evaluated.</span>}
  </div>;
}
