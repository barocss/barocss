// G17: the 3D sketch's panel — Draw / Select, the work plane and an axis lock, the diagnosis (well, under, over,
// conflict: what is free, redundant or unmet), the constraints the selection offers, the constraints with their
// values (a bound one shows its parameter), the session's undo, and Apply / Cancel. O16: its actions, fields and
// values on shadcn (Button, Input, FIELD); the Tool, plane and axis toggles stay the studio's segmented buttons.
import { useId } from 'react';
import type { BoundConstraint3D } from '@barocss/cad-model/frames/sketch3d';
import { constraintText, offers, statusText } from '../skeleton/skeletonTool';
import { constraintNumberError, type SkeletonEditor } from '../skeleton/useSkeletonEditor';
import { FIELD } from './panelStyles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const KIND_NAME: Record<string, string> = { length: 'Length', distance: 'Distance', angle: 'Angle', parallel: 'Parallel', perpendicular: 'Perpendicular', along: 'Along', 'on-axis': 'On axis', 'on-plane': 'On plane', fixed: 'Fixed', coincident: 'Coincident' };

function ConstraintValueField({ index, constraint, value, editor }: { index: number; constraint: BoundConstraint3D; value: number; editor: SkeletonEditor }) {
  const hintId = useId();
  const draft = editor.constraintInputs.get(constraint) ?? String(value);
  const error = constraintNumberError(constraint.kind, draft);
  const range = constraint.kind === 'angle' ? '0° < angle < 180°' : '> 0 mm';
  const commit = () => editor.commitConstraintInput(constraint);
  return <div className="min-w-0">
    <Input type="number" aria-label={`Constraint ${index + 1} value`} aria-invalid={!!error} aria-describedby={hintId} value={draft} step="any"
    onChange={event => editor.setConstraintInput(constraint, event.currentTarget.value)} onBlur={commit}
    onKeyDown={event => {
      if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      commit();
    }} />
    <span id={hintId} className={error ? 'warn small block' : 'muted small block'}>{error ?? range}</span>
  </div>;
}

export function SkeletonPanel({ editor, name }: { editor: SkeletonEditor; name: string }) {
  const s = editor.session; if (!s) return null;
  const d = editor.diagnosis, sel = editor.selection, solve = d && !('error' in d) ? d.solve : null;
  const picked = [sel.points.length && `${sel.points.length} point${sel.points.length === 1 ? '' : 's'}`, sel.segments.length && `${sel.segments.length} segment${sel.segments.length === 1 ? '' : 's'}`, sel.constraints.length && `${sel.constraints.length} constraint${sel.constraints.length === 1 ? '' : 's'}`].filter(Boolean).join(', ') || 'nothing';
  const unmet = new Set(solve?.unmet.map(u => u.constraint) ?? []), redundant = new Set(solve?.redundant ?? []);
  return <aside className="card props skeleton-panel" aria-label="3D sketch">
    <div className="card-title">3D SKETCH · {name}</div>
    <div className="seg" role="group" aria-label="Tool">
      <button className={editor.mode === 'draw' ? 'on' : ''} aria-pressed={editor.mode === 'draw'} data-tip="Line" data-tip-desc="Click points; each joins the last (L). Esc ends the line." onClick={() => editor.setMode('draw')}>Line</button>
      <button className={editor.mode === 'select' ? 'on' : ''} aria-pressed={editor.mode === 'select'} data-tip="Select" data-tip-desc="Pick and drag points, pick segments (S)" onClick={() => editor.setMode('select')}>Select</button></div>
    <div className="seg" role="group" aria-label="Work plane">{(['xy', 'xz', 'yz'] as const).map((p, i) =>
      <button key={p} className={editor.plane === p ? 'on' : ''} aria-pressed={editor.plane === p} data-tip={`${p.toUpperCase()} plane`} data-tip-desc={`Points go on it, through the last one (key ${i + 1}; Tab cycles)`} onClick={() => editor.setPlane(p)}>{p.toUpperCase()}</button>)}</div>
    <div className="seg" role="group" aria-label="Axis lock">{(['x', 'y', 'z'] as const).map(a =>
      <button key={a} className={editor.axis === a ? 'on' : ''} aria-pressed={editor.axis === a} data-tip={`Along ${a.toUpperCase()}`} data-tip-desc={`The next point (or the dragged one) along ${a.toUpperCase()} from the last (key ${a.toUpperCase()})`} onClick={() => editor.setAxis(editor.axis === a ? null : a)}>{a.toUpperCase()}</button>)}</div>
    <div className={'skeleton-status ' + (solve?.status ?? 'error')} aria-label="Sketch status" data-status={solve?.status ?? 'error'}>
      {d && 'error' in d ? d.error : solve ? statusText(solve) : '—'}
      {solve && solve.status === 'under' && <span className="muted small"> · free points blue</span>}
    </div>
    <div className={FIELD}><span>Picked</span> <b aria-label="Picked">{picked}</b></div>
    <div className="cage-ops" aria-label="Constraints offered">{offers(s.draft, sel, editor.plane).map(o =>
      <Button key={o.label} variant="ghost" aria-label={'Add ' + o.label} onClick={() => editor.addConstraint(o.constraint)}>{o.label}</Button>)}</div>
    {!!s.draft.constraints.length && <ul className="skeleton-constraints" aria-label="Constraints">{s.draft.constraints.map((c, k) => {
      const v = c.kind === 'angle' ? c.degrees : c.kind === 'length' || c.kind === 'distance' ? c.value : null;
      return <li key={k} className={(unmet.has(k) ? 'bad ' : redundant.has(k) ? 'over ' : '') + (sel.constraints.includes(k) ? 'sel' : '')} aria-label={`Constraint ${k + 1}`}>
        <Button variant="ghost" onClick={() => editor.select({ points: [], segments: [], constraints: [k] })}>{KIND_NAME[c.kind]}</Button>
        {typeof v === 'number' ? <ConstraintValueField index={k} constraint={c} value={v} editor={editor} />
          : <span className="mono">{constraintText(c)}</span>}
        {unmet.has(k) && <span className="warn small">unmet</span>}{redundant.has(k) && <span className="muted small">redundant</span>}
      </li>;
    })}</ul>}
    <div className="muted small">{s.draft.points.length} points · {s.draft.segments.length} segments{solve ? ` · ${solve.dof} degrees of freedom` : ''}</div>
    <div className="flex items-center gap-1 pt-1">
      <Button variant="ghost" aria-label="Undo 3D sketch step" onClick={editor.undo}>Undo</Button>
      <Button variant="ghost" aria-label="Delete picked" disabled={!sel.points.length && !sel.segments.length && !sel.constraints.length} onClick={editor.removeSelected}>Delete</Button>
      <span className="flex-1" />
      <Button variant="ghost" aria-label="Cancel 3D sketch" onClick={editor.cancel}>Cancel</Button>
      <Button variant="default" aria-label="Apply 3D sketch" disabled={editor.invalidConstraintInput || solve?.status === 'conflict' || !!(d && 'error' in d)} onClick={editor.apply}>Apply</Button>
    </div>
  </aside>;
}
