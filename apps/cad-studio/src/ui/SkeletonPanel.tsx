// G17: the 3D sketch's panel — Draw / Select, the work plane and an axis lock, the diagnosis (well, under, over,
// conflict: what is free, redundant or unmet), the constraints the selection offers, the constraints with their
// values (a bound one shows its parameter), the session's undo, and Apply / Cancel.
import { constraintText, offers, statusText } from '../skeleton/skeletonTool';
import type { SkeletonEditor } from '../skeleton/useSkeletonEditor';

const KIND_NAME: Record<string, string> = { length: 'Length', distance: 'Distance', angle: 'Angle', parallel: 'Parallel', perpendicular: 'Perpendicular', along: 'Along', 'on-axis': 'On axis', 'on-plane': 'On plane', fixed: 'Fixed', coincident: 'Coincident' };

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
    <div className="kv">Picked <b aria-label="Picked">{picked}</b></div>
    <div className="cage-ops" aria-label="Constraints offered">{offers(s.draft, sel, editor.plane).map(o =>
      <button key={o.label} className="ghost small" aria-label={'Add ' + o.label} onClick={() => editor.addConstraint(o.constraint)}>{o.label}</button>)}</div>
    {!!s.draft.constraints.length && <ul className="skeleton-constraints" aria-label="Constraints">{s.draft.constraints.map((c, k) => {
      const v = c.kind === 'angle' ? c.degrees : c.kind === 'length' || c.kind === 'distance' ? c.value : null;
      return <li key={k} className={(unmet.has(k) ? 'bad ' : redundant.has(k) ? 'over ' : '') + (sel.constraints.includes(k) ? 'sel' : '')} aria-label={`Constraint ${k + 1}`}>
        <button className="ghost small" onClick={() => editor.select({ points: [], segments: [], constraints: [k] })}>{KIND_NAME[c.kind]}</button>
        {typeof v === 'number' ? <input type="number" aria-label={`Constraint ${k + 1} value`} defaultValue={v} key={v} step="any" onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); editor.setValue(k, Number((e.target as HTMLInputElement).value)); } }} onBlur={e => { const n = Number(e.target.value); if (n !== v) editor.setValue(k, n); }} />
          : <span className="mono">{constraintText(c)}</span>}
        {unmet.has(k) && <span className="warn small">unmet</span>}{redundant.has(k) && <span className="muted small">redundant</span>}
      </li>;
    })}</ul>}
    <div className="muted small">{s.draft.points.length} points · {s.draft.segments.length} segments{solve ? ` · ${solve.dof} degrees of freedom` : ''}</div>
    <div className="row-buttons">
      <button className="ghost small" aria-label="Undo 3D sketch step" onClick={editor.undo}>Undo</button>
      <button className="ghost small" aria-label="Delete picked" disabled={!sel.points.length && !sel.segments.length && !sel.constraints.length} onClick={editor.removeSelected}>Delete</button>
      <span className="grow" />
      <button className="ghost small" aria-label="Cancel 3D sketch" onClick={editor.cancel}>Cancel</button>
      <button className="primary small" aria-label="Apply 3D sketch" disabled={solve?.status === 'conflict' || !!(d && 'error' in d)} onClick={editor.apply}>Apply</button>
    </div>
  </aside>;
}
