import { useEffect, useState } from 'react';
import type { PartInstance } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { fmt } from '../engine/doc';

/** A placed part: its name, position and rotation (applied on Enter or when a box is left), duplicate, hide, remove. */
export function InstancePanel({ inst, bodies, onChange, onDuplicate, onRemove, onGround }: {
  inst: PartInstance; bodies: BodyResult[] | undefined;
  onChange(next: PartInstance): void; onDuplicate(): void; onRemove(): void;
  /** Fixes it in place (mates never move it) or frees it. */
  onGround?(on: boolean): void;
}) {
  const volume = bodies?.reduce((v, b) => v + (b.volumeMM3 ?? 0), 0);
  return (
    <aside className="card props" aria-label="Instance">
      <div className="card-title">PART INSTANCE</div>
      <Field label="Name" value={inst.name} text onCommit={v => onChange({ ...inst, name: String(v) })} />
      <div className="kv">Bodies <b>{bodies ? bodies.length : '…'}</b></div>
      {volume !== undefined && <div className="kv">Volume <b>{fmt(Math.round(volume))} mm³</b></div>}
      <div className="card-title" style={{ marginTop: 8 }}>POSITION · MM</div>
      {(['X', 'Y', 'Z'] as const).map((a, k) => <Field key={a} label={a} value={inst.position[k]} onCommit={v => onChange({ ...inst, position: inst.position.map((x, j) => j === k ? Number(v) : x) as [number, number, number] })} />)}
      <div className="card-title" style={{ marginTop: 8 }}>ROTATION · ° (X, THEN Y, THEN Z)</div>
      {(['X', 'Y', 'Z'] as const).map((a, k) => <Field key={a} label={a} value={inst.rotation[k]} onCommit={v => onChange({ ...inst, rotation: inst.rotation.map((x, j) => j === k ? Number(v) : x) as [number, number, number] })} />)}
      <div className="row-actions" style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <button className="ghost" onClick={onDuplicate}>Duplicate</button>
        <button className="ghost" onClick={() => onChange({ ...inst, hidden: !inst.hidden })}>{inst.hidden ? 'Show' : 'Hide'}</button>
        {onGround && <button className={'ghost' + (inst.grounded ? ' on' : '')} title="A fixed part stays where it is: mates move the other part" onClick={() => onGround(!inst.grounded)}>{inst.grounded ? 'Unfix' : 'Fix in place'}</button>}
        <button className="ghost" onClick={onRemove}>Remove</button>
      </div>
    </aside>
  );
}

function Field({ label, value, onCommit, text }: { label: string; value: number | string; onCommit(v: number | string): void; text?: boolean }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    if (draft === String(value)) return;
    if (text) { if (draft.trim()) onCommit(draft.trim()); return; }
    const v = Number(draft); if (draft.trim() !== '' && Number.isFinite(v)) onCommit(v);
  };
  return <label className="field"><span>{label}</span><input aria-label={`Instance ${label}`} type={text ? 'text' : 'number'} step="any" value={draft}
    onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }} /></label>;
}
