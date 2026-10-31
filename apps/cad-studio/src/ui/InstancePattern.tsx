import { useEffect, useState } from 'react';
import type { InstancePattern, PartInstance } from '@barocss/cad-model/engine/doc';
import type { AddPatternOptions, EditPatternOptions } from '@barocss/cad-model/assembly/patterns';
import { Button } from '@/components/ui/button';
import { FIELD } from './panelStyles';

// Roadmap 10 ③ (#2180, RS7.4): a part instance repeated along a line or about an axis. The seed's panel makes, edits and
// deletes its pattern; an occurrence's panel names its pattern and offers Skip (its placement is the seed's to drive).

const AXES = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] } as const;
type Axis = keyof typeof AXES | 'Custom';
/** The axis a direction is exactly (+X, +Y, +Z), else 'Custom': a direction a chat or a file made is shown as it is and kept unless the choice changes. */
export const axisOf = (v: readonly number[]): Axis => (Object.keys(AXES) as (keyof typeof AXES)[]).find(a => AXES[a].every((x, k) => x === v[k])) ?? 'Custom';

export interface Draft { kind: 'linear' | 'circular'; count: string; spacing: string; angle: string; axis: Axis }
export function draftOf(p: InstancePattern | undefined): Draft {
  if (!p) return { kind: 'linear', count: '3', spacing: '20', angle: '120', axis: 'X' };
  return p.kind === 'linear' ? { kind: 'linear', count: String(p.count), spacing: String(p.spacing), angle: '120', axis: axisOf(p.dir) }
    : { kind: 'circular', count: String(p.count), spacing: '20', angle: String(p.angle), axis: axisOf(p.axis) };
}

/** What Apply sends for an existing pattern: its numbers, and the direction or axis only when the choice changed (a custom one stays as it is). */
export function patternEdit(pattern: InstancePattern, draft: Draft): EditPatternOptions {
  const count = Number(draft.count), turned = draft.axis !== draftOf(pattern).axis && draft.axis !== 'Custom' ? [...AXES[draft.axis]] as [number, number, number] : undefined;
  return pattern.kind === 'linear' ? { id: pattern.id, count, spacing: Number(draft.spacing), ...(turned ? { dir: turned } : {}) } : { id: pattern.id, count, angle: Number(draft.angle), ...(turned ? { axis: turned } : {}) };
}

/** The seed's pattern (to make, edit or delete) or an occurrence's pattern (to skip it). */
export function InstancePatternControls({ inst, pattern, occurrenceOf, onAdd, onEdit, onDelete, onSkip }: {
  inst: PartInstance;
  /** The pattern this instance seeds, if any. */
  pattern?: InstancePattern;
  /** The pattern this instance is an occurrence of, if any. */
  occurrenceOf?: InstancePattern;
  onAdd(o: AddPatternOptions): void; onEdit(o: EditPatternOptions): void; onDelete(id: string): void; onSkip(): void;
}) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<Draft>(() => draftOf(pattern));
  useEffect(() => setDraft(draftOf(pattern)), [pattern]);
  if (occurrenceOf && inst.pattern) return (
    <div className="kv" role="status" aria-label="Pattern occurrence">
      <span>Pattern <b>{occurrenceOf.id}</b> · {inst.pattern.k + 1} of {occurrenceOf.count}</span>
      <Button variant="ghost" title="Leave this occurrence out of the pattern (editing the pattern's skip list brings it back)" onClick={onSkip}>Skip</Button>
    </div>);
  const set = (k: keyof Draft, v: string) => setDraft(d => ({ ...d, [k]: v }));
  const apply = () => {
    if (pattern) onEdit(patternEdit(pattern, draft));
    else {
      const count = Number(draft.count), dir = [...AXES[draft.axis === 'Custom' ? 'X' : draft.axis]] as [number, number, number];
      onAdd(draft.kind === 'linear' ? { seed: inst.id, kind: 'linear', count, spacing: Number(draft.spacing), dir } : { seed: inst.id, kind: 'circular', count, angle: Number(draft.angle), axis: dir, origin: [0, 0, 0] });
    }
    setOpen(false);
  };
  if (!open && !pattern) return <Button variant="ghost" onClick={() => setOpen(true)} title="Repeat this part along a line or about an axis">Pattern…</Button>;
  const kind = pattern?.kind ?? draft.kind;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-2" role="group" aria-label="Instance pattern">
      <div className="card-title">PATTERN{pattern ? ` · ${pattern.id}` : ''}</div>
      {!pattern && <label className={FIELD}><span>Kind</span>
        <select aria-label="Pattern kind" value={draft.kind} onChange={e => set('kind', e.target.value)}><option value="linear">Linear</option><option value="circular">Circular</option></select></label>}
      <label className={FIELD}><span>Count</span><input aria-label="Pattern count" type="number" step="1" value={draft.count} onChange={e => set('count', e.target.value)} /></label>
      {kind === 'linear'
        ? <label className={FIELD}><span>Spacing mm</span><input aria-label="Pattern spacing" type="number" step="any" value={draft.spacing} onChange={e => set('spacing', e.target.value)} /></label>
        : <label className={FIELD}><span>Angle °</span><input aria-label="Pattern angle" type="number" step="any" value={draft.angle} onChange={e => set('angle', e.target.value)} /></label>}
      <label className={FIELD}><span>{kind === 'linear' ? 'Along' : 'About'}</span>
        <select aria-label="Pattern axis" value={draft.axis} onChange={e => set('axis', e.target.value)}>{(pattern && draftOf(pattern).axis === 'Custom' ? ['Custom', ...Object.keys(AXES)] as Axis[] : Object.keys(AXES) as Axis[]).map(a => <option key={a} value={a}>{a === 'Custom' ? 'Custom (as made)' : a}{kind === 'circular' ? ' (through the origin)' : ''}</option>)}</select></label>
      {!!pattern?.skip?.length && <div className="kv">Skipped <b>{pattern.skip.map(k => k + 1).join(', ')}</b>
        <Button variant="ghost" onClick={() => onEdit({ id: pattern.id, skip: [] })}>Restore</Button></div>}
      <div className="row-actions" style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
        <Button variant="default" onClick={apply}>{pattern ? 'Apply' : 'Make pattern'}</Button>
        {pattern ? <Button variant="ghost" onClick={() => onDelete(pattern.id)}>Delete pattern</Button> : <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>}
      </div>
    </div>);
}
