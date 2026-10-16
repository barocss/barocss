import { useEffect, useState } from 'react';
import type { PartInstance } from '../engine/doc';
import { fmt } from '../engine/doc';
import { BASE, KIND_LABEL, kindsFor, mateLabel, type FaceTable, type Mate, type MateKind, type MateRef } from '../assembly/mates';
import type { Assembly } from '../assembly/useAssembly';
import { Icon } from './atoms';

/** A face for people: its kind and where it came from ("Top face", "Hole Ø8", "Side face 2"). */
export function faceLabel(name: string, table: FaceTable | undefined): string {
  const f = table?.[name];
  if (table && !f) return `missing face (${name})`;
  if (f?.kind === 'cylinder') return `${f.outer ? 'Round face' : 'Hole'} Ø${fmt(Math.round(f.radius * 2000) / 1000)}`;
  const origin = /^origin:(xy|xz|yz)$/.exec(name);
  if (origin) return `${origin[1].toUpperCase()} plane`;
  const tail = name.split('|')[0].split('.').pop() ?? name;
  const side = /^side(\d+)$/.exec(tail);
  return side ? `Side face ${Number(side[1]) + 1}` : tail === 'top' ? 'Top face' : tail === 'bottom' ? 'Bottom face' : tail;
}

/** Mates: the list (pick one to edit or delete it), and "Add mate": a face that stays, then a face on the part to move. */
export function MatePanel({ assembly, instances, instance, onRefused }: { assembly: Assembly; instances: PartInstance[]; instance?: string; onRefused(reason: string): void }) {
  const { mates, problems, draft, tables } = assembly;
  const partName = (part: string) => part === BASE ? 'Base part' : instances.find(i => i.id === part)?.name ?? part;
  const refText = (r: MateRef) => r.face ? `${partName(r.part)} · ${faceLabel(r.face, tables.get(r.part))}` : partName(r.part);
  const sel = mates.find(m => m.id === assembly.selected) ?? null;
  const problemOf = (id: string) => problems.find(p => p.mate === id);
  // What the selected part can still do: fixed, placed by typed numbers, or its mates' remaining freedom.
  const freedomText = (id: string) => {
    if (instances.find(i => i.id === id)?.grounded) return 'fixed in place';
    const f = assembly.freedom[id];
    if (!f) return 'placed by its numbers (no mate moves it)';
    if (!f.turns && !f.slides) return 'fully placed by its mates';
    const n = (k: number, word: string) => k ? `${k} ${word}${k > 1 ? 's' : ''}` : '';
    return 'free: ' + [n(f.slides, 'slide'), n(f.turns, 'turn')].filter(Boolean).join(' · ');
  };
  return (
    <aside className="card props" aria-label="Mates">
      <div className="card-title">MATES <span className="muted">{mates.length || ''}</span>
        {!draft && <button className="ghost" style={{ marginLeft: 'auto' }} onClick={assembly.start}>Add mate</button>}</div>
      {instance && !draft && <LockRow instance={instance} instances={instances} onLock={to => { const why = assembly.lock(instance, to); if (why) onRefused(why); }} />}
      {instance && !draft && <div className="kv" aria-label="Freedom">{instances.find(i => i.id === instance)?.name ?? instance} <b>{freedomText(instance)}</b></div>}
      {draft && <div className="mate-draft" style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
        <label className="field"><span>Type</span>
          <select aria-label="Mate type" value={draft.kind} onChange={e => assembly.setDraft({ kind: e.target.value as MateKind | 'auto' })}>
            <option value="auto">Auto</option>
            {(Object.keys(KIND_LABEL) as MateKind[]).filter(k => k !== 'lock').map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select></label>
        {draft.kind === 'distance' && <NumberField label="Distance" value={draft.distance} onCommit={v => assembly.setDraft({ distance: v })} />}
        {draft.kind === 'angle' && <NumberField label="Angle" unit="°" value={draft.angle} onCommit={v => assembly.setDraft({ angle: v })} />}
        {draft.kind !== 'concentric' && <label className="field check-row"><span>Flip</span>
          <input type="checkbox" aria-label="Mate flip" checked={draft.flip} onChange={e => assembly.setDraft({ flip: e.target.checked })} /></label>}
        <PlanePicker instances={instances} onPick={assembly.pickFace} />
        <div className="kv">1 · Stays <b>{draft.picks[0] ? refText(draft.picks[0].ref) : 'click a face'}</b></div>
        <div className="kv">2 · Moves <b>{draft.picks[1] ? refText(draft.picks[1].ref) : draft.picks[0] ? 'click a face on another part' : '—'}</b></div>
        {draft.error ? <div className="hud-error" role="status" aria-label="Mate refused"><div className="hud-error-title">Can’t mate these faces</div>{draft.error}</div>
          : <div className="empty">Click a face on the part that stays, then one on the part to move: two flat faces (coincident, distance, angle), two round faces (concentric, tangent), or a flat and a round one (tangent). Flat faces end up flush and facing each other.</div>}
        <div className="row-actions"><button className="ghost" onClick={assembly.cancel}>Cancel</button></div>
      </div>}
      {mates.map((m, i) => {
        const p = problemOf(m.id);
        return <button key={m.id} className={'ol mate' + (sel?.id === m.id ? ' sel' : '')} style={p ? { color: 'var(--warn)' } : undefined}
          title={p ? p.reason : `${refText(m.a)} → ${refText(m.b)}`} onClick={() => assembly.select(sel?.id === m.id ? null : m.id)}>
          <Icon name={p ? 'link_off' : m.kind === 'concentric' ? 'radio_button_checked' : m.kind === 'distance' ? 'straighten' : m.kind === 'angle' ? 'square_foot' : m.kind === 'tangent' ? 'radio_button_unchecked' : m.kind === 'lock' ? 'lock' : 'link'} small />
          {mateLabel(m, i)}{m.kind === 'distance' ? ` · ${fmt(m.distance ?? 0)} mm` : m.kind === 'angle' ? ` · ${fmt(m.angle ?? 0)}°` : ''}<span className="muted"> · {partName(m.b.part)}</span></button>;
      })}
      {sel && <MateEditor key={sel.id} mate={sel} problem={problemOf(sel.id)?.reason} tables={tables} refText={refText}
        onEdit={patch => { const why = assembly.edit(sel.id, patch); if (why) onRefused(why); }} onDelete={() => assembly.remove(sel.id)} />}
      {!mates.length && !draft && <div className="empty">Place an instance by its faces: Add mate, then click a face that stays and a face on the part to move.</div>}
      {!!mates.length && <div className="empty" style={{ marginTop: 6 }}>The base part and fixed instances stay; mated parts follow when a part or a mate changes.</div>}
    </aside>
  );
}

function MateEditor({ mate, problem, tables, refText, onEdit, onDelete }: {
  mate: Mate; problem?: string; tables: Map<string, FaceTable>; refText(r: MateRef): string;
  onEdit(patch: Partial<Mate>): void; onDelete(): void;
}) {
  const fa = tables.get(mate.a.part)?.[mate.a.face], fb = tables.get(mate.b.part)?.[mate.b.face];
  const kinds = fa && fb ? kindsFor(fa, fb) : [mate.kind];
  return (
    <div className="mate-edit" style={{ display: 'grid', gap: 6, marginTop: 8 }}>
      <div className="kv">Stays <b>{refText(mate.a)}</b></div>
      <div className="kv">Moves <b>{refText(mate.b)}</b></div>
      <label className="field"><span>Type</span>
        <select aria-label="Edit mate type" value={mate.kind} onChange={e => {
          const kind = e.target.value as MateKind;
          onEdit({ kind, distance: kind === 'distance' ? mate.distance ?? 0 : undefined, angle: kind === 'angle' ? mate.angle ?? 90 : undefined, ...(kind === 'concentric' ? { flip: undefined } : {}) });
        }}>{kinds.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
      {mate.kind === 'distance' && <NumberField label="Distance" value={mate.distance ?? 0} onCommit={v => onEdit({ distance: v })} />}
      {mate.kind === 'angle' && <NumberField label="Angle" unit="°" value={mate.angle ?? 0} onCommit={v => onEdit({ angle: v })} />}
      {mate.kind === 'lock' ? <div className="empty">Moves with {refText(mate.a)} as one piece, where it stood when locked.</div>
        : mate.kind === 'concentric'
        ? <label className="field"><span>Axes</span>
          <select aria-label="Mate axes" value={mate.flip === undefined ? 'either' : mate.flip ? 'reversed' : 'same'}
            onChange={e => onEdit({ flip: e.target.value === 'either' ? undefined : e.target.value === 'reversed' })}>
            <option value="either">Either way</option><option value="same">Same direction</option><option value="reversed">Reversed</option>
          </select></label>
        : <label className="field check-row"><span>Flip</span>
          <input type="checkbox" aria-label="Edit mate flip" checked={!!mate.flip} onChange={e => onEdit({ flip: e.target.checked || undefined })} /></label>}
      {problem && <div className="hud-error" role="status"><div className="hud-error-title">Not met</div>{problem}</div>}
      <div className="row-actions"><button className="ghost" onClick={onDelete}>Delete mate</button></div>
    </div>
  );
}

/** Locks the selected part to another part (or the base part) where it stands. */
function LockRow({ instance, instances, onLock }: { instance: string; instances: PartInstance[]; onLock(to: string): void }) {
  const [to, setTo] = useState(BASE);
  return (
    <label className="field"><span>Lock to</span>
      <span style={{ display: 'flex', gap: 6, minWidth: 0 }}>
        <select aria-label="Lock to" value={to} onChange={e => setTo(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
          <option value={BASE}>Base part</option>
          {instances.filter(i => i.id !== instance).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <button type="button" className="ghost" onClick={() => onLock(to)}>Lock</button>
      </span></label>
  );
}

/** An origin plane of a part as the next pick: the part, then XY, XZ or YZ. */
function PlanePicker({ instances, onPick }: { instances: PartInstance[]; onPick(ref: MateRef): void }) {
  const [part, setPart] = useState(BASE);
  return (<>
    <label className="field"><span>Or a plane of</span>
      <select aria-label="Plane of" value={part} onChange={e => setPart(e.target.value)}>
        <option value={BASE}>Base part</option>
        {instances.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select></label>
    <div className="row-actions" style={{ display: 'flex', gap: 6, paddingLeft: 84 }}>
      {(['xy', 'xz', 'yz'] as const).map(p => <button key={p} type="button" className="ghost" aria-label={`Pick ${p.toUpperCase()} plane`} onClick={() => onPick({ part, face: `origin:${p}` })}>{p.toUpperCase()}</button>)}
    </div>
  </>);
}

function NumberField({ label, value, onCommit, unit = 'mm' }: { label: string; value: number; onCommit(v: number): void; unit?: string }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  // A refused value goes back to the one in force (an accepted one comes back as the new value).
  const commit = () => { const v = Number(draft); if (draft.trim() !== '' && Number.isFinite(v) && v !== value) onCommit(v); setDraft(String(value)); };
  return <label className="field"><span>{label}</span><span className="num"><input aria-label={`Mate ${label.toLowerCase()}`} type="number" step="any" value={draft}
    onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }} /><em>{unit}</em></span></label>;
}
