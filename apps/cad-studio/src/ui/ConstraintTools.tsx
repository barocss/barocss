// The sketch panel's constraint section for a closed outline: what is picked, the constraints that can
// apply to it, and every constraint with a remove button. Refusals are shown with their reason.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { roundCorner } from '@barocss/cad-model/sketch/corner';
import { ELLIPSE_POINTS, ellipseMatches } from '@barocss/cad-model/sketch/ellipse';
import {
  applyConstraint, circleDimensionKeys, circlePairKeys, constraintEntries, constraintOptions, dimensionKey, isSettled, pointDimensionKeys, removeConstraint, samePick,
  type ConstraintEntry, type ConstraintKind, type Polygon, type SketchPick,
} from '@barocss/cad-model/sketch/rules';
import { settleShape } from '@barocss/cad-model/sketch/settle';
import type { SketchState } from '@barocss/cad-model/sketch/types';
import { clearConstraintInspection, keepsDimensionDraft, type ConstraintComparison, type ConstraintInspection, type ConstraintInspectionStore } from '../sketch/constraintInspection';
import { useStoreValue } from '../state/valueStore';
import './constraints.css';

const TOOLS: { kind: ConstraintKind; sym: string; label: string; short: string }[] = [
  { kind: 'horizontal', sym: 'H', label: 'Horizontal', short: 'Horiz' }, { kind: 'vertical', sym: 'V', label: 'Vertical', short: 'Vert' },
  { kind: 'parallel', sym: '∥', label: 'Parallel', short: 'Parallel' }, { kind: 'perpendicular', sym: '⊥', label: 'Perpendicular', short: 'Perp' },
  { kind: 'equal', sym: '=', label: 'Equal', short: 'Equal' }, { kind: 'coincident', sym: '◎', label: 'Coincident', short: 'Centre' }, { kind: 'tangent', sym: '⌒', label: 'Tangent', short: 'Tangent' }, { kind: 'symmetric', sym: '⟷', label: 'Symmetric', short: 'Sym' }, { kind: 'fix', sym: '⚓', label: 'Fix', short: 'Fix' },
];

const pickName = (s: Polygon, p: SketchPick) => p.kind === 'point' ? `point ${p.i + 1}` : p.kind === 'circle' ? `circle ${p.i + 1}` : `${s.bulges?.[p.i] ? 'arc' : 'edge'} ${p.i + 1}`;

export function ConstraintTools({ shape: s, owner, inspection, picked, onShape, onPicked, onEditDim }: {
  shape: Polygon; owner: SketchState; inspection: ConstraintInspectionStore; picked: readonly SketchPick[];
  onShape(shape: Polygon): void; onPicked(picks: SketchPick[]): void; onEditDim(key: string | null): void;
}) {
  const [refused, setRefused] = useState<string | null>(null);
  const [roundR, setRoundR] = useState(2);
  const current = useStoreValue(inspection);
  const active = current?.owner === owner ? current : null;
  const inspectedId = active?.target === 'row' ? active.entry.id : null;
  const comparison = active?.target === 'comparison' ? active : null;
  const comparisonReason = comparison && !comparison.result.ok ? comparison.result.reason : null;
  const cached = useRef<{ owner: SketchState; results: Map<ConstraintKind, ConstraintComparison> } | null>(null);
  useLayoutEffect(() => () => { clearConstraintInspection(inspection, owner); }, [inspection, owner]);
  // The last input to enter a row or button owns the inspection.
  const enter = (entry: ConstraintEntry, input: ConstraintInspection['input']) => inspection.set({ owner, target: 'row', entry, input });
  const leave = (entry: ConstraintEntry, input: ConstraintInspection['input']) => {
    const current = inspection.get();
    if (current?.owner === owner && current.target === 'row' && current.entry.id === entry.id && current.input === input) inspection.set(null);
  };
  useEffect(() => setRefused(null), [s, picked]);
  const options = constraintOptions(s, picked), dim = dimensionKey(s, picked);
  const canCompare = !owner.association && !owner.done?.length && !s.construction && !s.circles?.length &&
    !s.bulges?.some(Boolean) && picked.length === 2 && picked.every(p => p.kind === 'edge');
  const compare = (kind: ConstraintKind, input: ConstraintInspection['input']) => {
    if (!canCompare || options[kind] || (kind !== 'parallel' && kind !== 'perpendicular' && kind !== 'equal')) return;
    const cache = cached.current?.owner === owner ? cached.current : { owner, results: new Map<ConstraintKind, ConstraintComparison>() };
    cached.current = cache;
    let result = cache.results.get(kind);
    if (!result) {
      const applied = applyConstraint(s, picked, kind);
      if (!applied.ok) result = applied;
      else {
        const settled = settleShape(applied.shape, s);
        result = settled.error || !isSettled(settled.shape)
          ? { ok: false, reason: settled.error ?? 'Could not settle the outline' }
          : { ok: true, shape: applied.shape, display: settled.shape };
      }
      cache.results.set(kind, result);
    }
    inspection.set({ owner, target: 'comparison', kind, input, result });
  };
  const stopComparing = (kind: ConstraintKind, input: ConstraintInspection['input']) => {
    const current = inspection.get();
    if (current?.owner === owner && current.target === 'comparison' && current.kind === kind && current.input === input) inspection.set(null);
  };
  const point = picked.find(p => p.kind === 'point'), circle = picked.find(p => p.kind === 'circle');
  const twoPoints = picked.length === 2 && picked.every(p => p.kind === 'point') ? pointDimensionKeys(picked[0].i, picked[1].i)
    : picked.length === 2 && point && circle ? circleDimensionKeys(point.i, circle.i)
      : picked.length === 2 && picked.every(p => p.kind === 'circle') ? circlePairKeys(picked[0].i, picked[1].i) : null;
  const apply = (kind: ConstraintKind) => {
    const current = inspection.get();
    const r = current?.owner === owner && current.target === 'comparison' && current.kind === kind
      ? current.result : applyConstraint(s, picked, kind);
    clearConstraintInspection(inspection, owner);
    if (!r.ok) { setRefused(r.reason); return; }
    onShape(r.shape); onPicked([]);
  };
  // A matching ellipse lists its arc-direction rows (one per arc) as one summary row.
  const ell = !!s.ellipse && ellipseMatches(s), all = constraintEntries(s), entries = ell ? all.filter(c => c.label !== 'Arc') : all;
  return <>
    <div className="card-title" style={{ marginTop: 10 }}>ADD CONSTRAINT</div>
    <div className="cons-sel" aria-live="polite">{picked.length
      ? <>Picked <b>{picked.map(p => pickName(s, p)).join(', ')}</b></>
      : 'Pick points and edges with Select (S) · Shift adds'}</div>
    <div className="cons-tools" role="group" aria-label="Constraints for the selection" data-sketch-dimension-focus
      onBlur={e => { if (owner.editDim && !keepsDimensionDraft(e.relatedTarget)) onEditDim(null); }}>
      {TOOLS.map(t => <button key={t.kind} type="button" aria-label={t.label} disabled={!!options[t.kind]}
        data-sketch-constraint-action className={comparison?.kind === t.kind ? 'comparing' : undefined}
        onPointerEnter={() => compare(t.kind, 'pointer')} onPointerLeave={() => stopComparing(t.kind, 'pointer')}
        onFocus={() => compare(t.kind, 'focus')} onBlur={() => stopComparing(t.kind, 'focus')}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
        title={options[t.kind] ?? `${t.label}: apply to the picked ${picked.length > 1 ? 'entities' : 'entity'}`} onClick={() => apply(t.kind)}><b>{t.sym}</b><span>{t.short}</span></button>)}
      <button type="button" aria-label="Dimension the selection" disabled={!dim} title={dim ? 'Add or edit this dimension in the viewport' : 'Select an edge or arc, two straight edges (angle), two points, or a circle with a point, a horizontal or vertical edge or another circle'}
        onClick={() => dim && onEditDim(dim)}><b>↔</b><span>Dimension</span></button>
    </div>
    {comparisonReason && comparisonReason !== refused && <div className="sk-status open" role="status" aria-label="Constraint preview"><i />{comparisonReason}</div>}
    {twoPoints && <div className="cons-tools cons-dims" role="group" aria-label="Dimensions between the points">
      <button type="button" aria-label="Distance between the points" title="Straight distance" onClick={() => onEditDim(circle ? twoPoints.dist : dim ?? twoPoints.dist)}><b>⤢</b><span>Distance</span></button>
      <button type="button" aria-label="Horizontal distance" title="Distance along the sketch X axis" onClick={() => onEditDim(twoPoints.dx)}><b>↔</b><span>Horizontal</span></button>
      <button type="button" aria-label="Vertical distance" title="Distance along the sketch Y axis" onClick={() => onEditDim(twoPoints.dy)}><b>↕</b><span>Vertical</span></button>
    </div>}
    {/* One corner picked: round it (a tangent arc of this radius). */}
    {picked.length === 1 && point && <div className="sk-offset" role="group" aria-label="Round the corner">
      <span className="muted">Round corner</span>
      <span className="num"><input aria-label="Corner radius" type="number" step="any" min={0.1} value={roundR} onChange={e => setRoundR(Number(e.target.value))} /><em>mm</em></span>
      <button className="ghost" aria-label="Round the corner" onClick={() => { const r = roundCorner(s, point.i, roundR); if ('error' in r) { setRefused(r.error); return; } onShape(r.shape); onPicked([]); }}>Round</button>
    </div>}
    {refused && <div className="sk-status open" role="alert"><i />{refused}</div>}
    <div className="card-title" style={{ marginTop: 10 }}>CONSTRAINTS · {entries.length + (ell ? 1 : 0)}</div>
    <div role="list" aria-label="Constraints" data-sketch-dimension-focus
      onBlur={e => { if (owner.editDim && !keepsDimensionDraft(e.relatedTarget)) onEditDim(null); }}>
      {ell && <div className="cons-row" role="listitem"><div className="kv">Ellipse<b>{2 * ELLIPSE_POINTS} tangent arcs</b></div></div>}
      {entries.map(c => {
        const hit = c.involves.some(p => picked.some(q => samePick(p, q)));
        return <div className={'cons-row' + (hit ? ' hit' : '') + (inspectedId === c.id ? ' inspecting' : '')}
          role="listitem" tabIndex={0} key={`${c.id}:${c.label}:${c.detail}`} data-constraint-id={c.id}
          onPointerEnter={() => enter(c, 'pointer')} onPointerLeave={() => leave(c, 'pointer')}
          onFocus={() => enter(c, 'focus')}
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) leave(c, 'focus'); }}
          onKeyDown={e => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.stopPropagation();
            if (e.target === e.currentTarget) e.preventDefault();
          }}>
          <div className="kv">{c.label}<b>{c.detail}</b></div>
          <button type="button" data-sketch-constraint-action className={'x' + (c.removable ? '' : ' off')} disabled={!c.removable} aria-label={`Remove ${c.label} ${c.detail}`}
            title={c.removable ? 'Remove this constraint' : undefined} onClick={() => onShape(removeConstraint(s, c.id))}>×</button>
        </div>;
      })}
    </div>
  </>;
}
