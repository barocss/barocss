import { useEffect, useState, type ReactNode } from 'react';
import type { PartInstance } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { fmt } from '@barocss/cad-model/engine/doc';
import { FIELD } from './panelStyles';
import { Button } from '@/components/ui/button';

/** A placed part: its name, position and rotation (applied on Enter or when a box is left), duplicate, hide, remove. */
export function InstancePanel({ inst, bodies, onChange, onDuplicate, onRemove, onGround, shared = 0, pending, onIndependent, onRevision, onAccept, onDismiss, pattern, joints }: {
  inst: PartInstance; bodies: BodyResult[] | undefined;
  onChange(next: PartInstance): void; onDuplicate(): void; onRemove(): void;
  /** Fixes it in place (mates never move it) or frees it. */
  onGround?(on: boolean): void;
  /** How many instances share its definition (itself included), and a new revision waiting for it. */
  shared?: number; pending?: { rev: string; name: string };
  onIndependent?(): void; onRevision?(file: File): void; onAccept?(): void; onDismiss?(): void;
  /** Its pattern controls (roadmap 10 ③); an occurrence's placement is its seed's, so it has no placement boxes, Fix or Make independent. */
  pattern?: ReactNode;
  /** Its own joint values when it is a sub-assembly with joints (roadmap 10 4). */
  joints?: ReactNode;
}) {
  const driven = !!inst.pattern;
  const volume = bodies?.reduce((v, b) => v + (b.volume ?? 0), 0);
  return (
    <aside className="card props" aria-label="Instance">
      <div className="card-title">PART INSTANCE</div>
      <Field label="Name" value={inst.name} text onCommit={v => onChange({ ...inst, name: String(v) })} />
      <div className="kv">Bodies <b>{bodies ? bodies.length : '…'}</b></div>
      {/* (O18: while a body's mass is still being worked out, "…", not a partial sum.) */}
      {volume !== undefined && <div className="kv">Volume <b>{bodies!.some(b => b.massRef !== undefined) ? '…' : `${fmt(Math.round(volume))} mm³`}</b></div>}
      {inst.part && <>
        <div className="kv">Definition <b>Rev {inst.part.rev}{shared > 1 ? ` · shared by ${shared}` : ''}</b></div>
        {inst.part.source && <div className="kv muted small">From {inst.part.source}</div>}
        {pending && <div className="pending-rev" role="status" aria-label="Revision waiting">
          <div>Rev {pending.rev} is ready ({pending.name}): {shared > 1 ? `all ${shared} instances` : 'this instance'} would take it, each where it is.</div>
          <div className="row-actions" style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <Button variant="default" onClick={onAccept}>Accept Rev {pending.rev}</Button>
            <Button variant="ghost" onClick={onDismiss}>Keep Rev {inst.part.rev}</Button>
          </div></div>}
        <div className="row-actions" style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {onRevision && <Button variant="ghost" asChild><label className="file-button" title="Load a newer file of this part: nothing changes until you accept it">New revision…
            <input type="file" accept=".bcad,.json" aria-label="New revision file" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onRevision(f); }} /></label></Button>}
          {shared > 1 && onIndependent && !driven && <Button variant="ghost" title="This instance gets a definition of its own: later revisions of the shared one leave it as it is" onClick={onIndependent}>Make independent</Button>}
        </div>
      </>}
      {pattern}
      {!driven && joints}
      {driven ? <div className="kv muted small">Placed by its pattern: move or hide the seed, or edit the pattern (Skip leaves this one out).</div> : <>
      <div className="card-title" style={{ marginTop: 8 }}>POSITION · MM</div>
      {(['X', 'Y', 'Z'] as const).map((a, k) => <Field key={a} label={a} value={inst.position[k]} onCommit={v => onChange({ ...inst, position: inst.position.map((x, j) => j === k ? Number(v) : x) as [number, number, number] })} />)}
      <div className="card-title" style={{ marginTop: 8 }}>ROTATION · ° (X, THEN Y, THEN Z)</div>
      {(['X', 'Y', 'Z'] as const).map((a, k) => <Field key={a} label={a} value={inst.rotation[k]} onCommit={v => onChange({ ...inst, rotation: inst.rotation.map((x, j) => j === k ? Number(v) : x) as [number, number, number] })} />)}
      </>}
      <div className="row-actions" style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <Button variant="ghost" onClick={onDuplicate}>Duplicate</Button>
        {!driven && <Button variant="ghost" onClick={() => onChange({ ...inst, hidden: !inst.hidden })}>{inst.hidden ? 'Show' : 'Hide'}</Button>}
        {onGround && !driven && <Button variant={inst.grounded ? 'secondary' : 'ghost'} aria-pressed={!!inst.grounded} title="A fixed part stays where it is: mates move the other part" onClick={() => onGround(!inst.grounded)}>{inst.grounded ? 'Unfix' : 'Fix in place'}</Button>}
        {!driven && <Button variant="ghost" onClick={onRemove}>Remove</Button>}
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
  return <label className={FIELD}><span>{label}</span><input aria-label={`Instance ${label}`} type={text ? 'text' : 'number'} step="any" value={draft}
    onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }} /></label>;
}
