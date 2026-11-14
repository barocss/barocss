import { useEffect, useState } from 'react';
import type { AlignNode } from '@barocss/cad-model/engine/doc';

type Target = AlignNode['target'];
export type AlignTargetOption = { target: Target; bodyName: string };
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
    void read().then(targets => { if (current) setOptions(targets); },
      () => { if (current) { setOptions([]); setFailed(true); } });
    return () => { current = false; };
  }, [read]);
  const key = keyOf(value);
  const choices = options?.some(({ target }) => keyOf(target) === key)
    ? options : [{ target: value, bodyName: '' }, ...(options ?? [])];
  return <div className="field">
    <span>Target face</span>
    <select aria-label="Target face" disabled={disabled || !options?.length} value={key} onChange={event => {
      const next = choices.find(({ target }) => keyOf(target) === event.target.value);
      if (next) onChange(next.target);
    }}>
      {choices.map(({ target, bodyName }) => <option key={keyOf(target)} value={keyOf(target)}>
        {bodyName ? `${bodyName} · ${target.face}` : target.face}
      </option>)}
    </select>
    {failed && <span className="muted small col-span-2">The preceding model could not be evaluated.</span>}
  </div>;
}
