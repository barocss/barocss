import { useLayoutEffect, useMemo, useState } from 'react';
import { outlineMobility } from '@barocss/cad-model/sketch/mobility';
import { isSettled, samePick, type SketchPick } from '@barocss/cad-model/sketch/rules';
import type { SketchState } from '@barocss/cad-model/sketch/types';
import { keepsDimensionDraft, type ConstraintInspection, type ConstraintInspectionStore } from '../sketch/constraintInspection';

export function SketchMobility({ owner, inspection, onDimEdit }: {
  owner: SketchState;
  inspection: ConstraintInspectionStore;
  onDimEdit(key: string | null): void;
}) {
  const [open, setOpen] = useState(false);
  const shape = owner.shape;
  const eligible = isSettled(shape) && !shape.construction && !owner.association ? shape : null;
  const result = useMemo(() => open && eligible ? outlineMobility(eligible) : null, [open, eligible]);
  useLayoutEffect(() => () => {
    const current = inspection.get();
    if (current?.owner === owner && current.target === 'mobility') inspection.set(null);
  }, [inspection, owner, open]);

  const enter = (entity: SketchPick, input: ConstraintInspection['input']) => {
    const current = inspection.get();
    if (current?.owner === owner && current.target === 'mobility' && current.input === input
      && samePick(current.entity, entity)) return;
    inspection.set({ owner, target: 'mobility', entity, input });
  };
  const leave = (entity: SketchPick, input: ConstraintInspection['input']) => {
    const current = inspection.get();
    if (current?.owner === owner && current.target === 'mobility' && current.input === input
      && samePick(current.entity, entity)) inspection.set(null);
  };
  const row = (kind: 'point' | 'edge', i: number) => {
    const entity = { kind, i };
    return <li key={kind + i} tabIndex={0} aria-label={`Locally movable ${kind} ${i + 1}`}
      onPointerMove={() => enter(entity, 'pointer')} onPointerLeave={() => leave(entity, 'pointer')}
      onFocus={() => enter(entity, 'focus')} onBlur={() => leave(entity, 'focus')}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
      }}>{kind === 'point' ? 'Point' : 'Edge'} {i + 1}</li>;
  };

  return <details className="sk-mobility" onToggle={event => setOpen(event.currentTarget.open)} data-sketch-dimension-focus
    onBlur={event => { if (owner.editDim && !keepsDimensionDraft(event.relatedTarget)) onDimEdit(null); }}>
    <summary>Active outline mobility</summary>
    {open && (!result ? <p role="status">Mobility unavailable for this outline.</p>
      : result.points.length === 0 ? <p role="status">No locally movable points or edges.</p>
        : <ul aria-label="Locally movable geometry">{result.points.map(i => row('point', i))}
          {result.edges.map(i => row('edge', i))}</ul>)}
  </details>;
}
