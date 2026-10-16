// The sketch panel's constraint section for a closed outline: what is picked, the constraints that can
// apply to it, and every constraint with a remove button. Refusals are shown with their reason.
import { useEffect, useState } from 'react';
import {
  applyConstraint, constraintEntries, constraintOptions, dimensionKey, pointDimensionKeys, removeConstraint, samePick,
  type ConstraintKind, type Polygon, type SketchPick,
} from '../sketch/rules';
import './constraints.css';

const TOOLS: { kind: ConstraintKind; sym: string; label: string; short: string }[] = [
  { kind: 'horizontal', sym: 'H', label: 'Horizontal', short: 'Horiz' }, { kind: 'vertical', sym: 'V', label: 'Vertical', short: 'Vert' },
  { kind: 'parallel', sym: '∥', label: 'Parallel', short: 'Parallel' }, { kind: 'perpendicular', sym: '⊥', label: 'Perpendicular', short: 'Perp' },
  { kind: 'equal', sym: '=', label: 'Equal', short: 'Equal' }, { kind: 'coincident', sym: '◎', label: 'Coincident', short: 'Centre' }, { kind: 'fix', sym: '⚓', label: 'Fix', short: 'Fix' },
];

const pickName = (s: Polygon, p: SketchPick) => p.kind === 'point' ? `point ${p.i + 1}` : `${s.bulges?.[p.i] ? 'arc' : 'edge'} ${p.i + 1}`;

export function ConstraintTools({ shape: s, picked, onShape, onPicked, onEditDim }: {
  shape: Polygon; picked: readonly SketchPick[];
  onShape(shape: Polygon): void; onPicked(picks: SketchPick[]): void; onEditDim(key: string): void;
}) {
  const [refused, setRefused] = useState<string | null>(null);
  useEffect(() => setRefused(null), [s, picked]);
  const options = constraintOptions(s, picked), dim = dimensionKey(s, picked);
  const twoPoints = picked.length === 2 && picked.every(p => p.kind === 'point') ? pointDimensionKeys(picked[0].i, picked[1].i) : null;
  const apply = (kind: ConstraintKind) => {
    const r = applyConstraint(s, picked, kind);
    if (!r.ok) { setRefused(r.reason); return; }
    onShape(r.shape); onPicked([]);
  };
  const entries = constraintEntries(s);
  return <>
    <div className="card-title" style={{ marginTop: 10 }}>ADD CONSTRAINT</div>
    <div className="cons-sel" aria-live="polite">{picked.length
      ? <>Picked <b>{picked.map(p => pickName(s, p)).join(', ')}</b></>
      : 'Pick points and edges with Select (S) · Shift adds'}</div>
    <div className="cons-tools" role="group" aria-label="Constraints for the selection">
      {TOOLS.map(t => <button key={t.kind} type="button" aria-label={t.label} disabled={!!options[t.kind]}
        title={options[t.kind] ?? `${t.label}: apply to the picked ${picked.length > 1 ? 'entities' : 'entity'}`} onClick={() => apply(t.kind)}><b>{t.sym}</b><span>{t.short}</span></button>)}
      <button type="button" aria-label="Dimension the selection" disabled={!dim} title={dim ? 'Add or edit this dimension in the viewport' : 'Select one edge or arc, two straight edges (angle), or two points'}
        onClick={() => dim && onEditDim(dim)}><b>↔</b><span>Dimension</span></button>
    </div>
    {twoPoints && <div className="cons-tools cons-dims" role="group" aria-label="Dimensions between the points">
      <button type="button" aria-label="Distance between the points" title="Straight distance" onClick={() => onEditDim(dim ?? twoPoints.dist)}><b>⤢</b><span>Distance</span></button>
      <button type="button" aria-label="Horizontal distance" title="Distance along the sketch X axis" onClick={() => onEditDim(twoPoints.dx)}><b>↔</b><span>Horizontal</span></button>
      <button type="button" aria-label="Vertical distance" title="Distance along the sketch Y axis" onClick={() => onEditDim(twoPoints.dy)}><b>↕</b><span>Vertical</span></button>
    </div>}
    {refused && <div className="sk-status open" role="alert"><i />{refused}</div>}
    <div className="card-title" style={{ marginTop: 10 }}>CONSTRAINTS · {entries.length}</div>
    <div role="list" aria-label="Constraints">
      {entries.map(c => {
        const hit = c.involves.some(p => picked.some(q => samePick(p, q)));
        return <div className={'cons-row' + (hit ? ' hit' : '')} role="listitem" key={c.id}>
          <div className="kv">{c.label}<b>{c.detail}</b></div>
          <button type="button" className={'x' + (c.removable ? '' : ' off')} disabled={!c.removable} aria-label={`Remove ${c.label} ${c.detail}`}
            title={c.removable ? 'Remove this constraint' : undefined} onClick={() => onShape(removeConstraint(s, c.id))}>×</button>
        </div>;
      })}
    </div>
  </>;
}
