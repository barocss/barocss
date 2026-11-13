import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { removeConstraint, type ConstraintEntry, type Polygon, type SketchPick } from '@barocss/cad-model/sketch/rules';
import type { SketchState } from '@barocss/cad-model/sketch/types';
import { clearConstraintInspection, keepsDimensionDraft, type ConstraintInspection, type ConstraintInspectionStore } from '../sketch/constraintInspection';
import { activeCircleDistanceRow, constraintInvolves, constraintListRows, filterConstraintList } from '../sketch/constraintList';
import { CONTROL, FIELD } from './panelStyles';

interface FilterState {
  document: object;
  plane: SketchState['plane'];
  editNode: SketchState['editNode'];
  mainIds: SketchState['mainIds'];
  kind: string;
  pickedOnly: boolean;
}

function initialFilters(document: object, owner: SketchState): FilterState {
  return { document, plane: owner.plane, editNode: owner.editNode, mainIds: owner.mainIds, kind: '', pickedOnly: false };
}

function conflictActionLabel(row: ConstraintEntry): string {
  const [first, second] = row.involves;
  if (row.label === 'Length') return `Find conflicting length on edge ${first.i + 1}`;
  const pair = first.kind === 'edge' ? `edge ${first.i + 1} and circle ${second.i + 1}` : `circles ${first.i + 1} and ${second.i + 1}`;
  return `Find conflicting ${row.label.toLowerCase()} between ${pair}`;
}

export function ConstraintList({ shape, owner, conflictIds, documentScope, inspection, inspectedId, picked, onShape, onEditDim }: {
  shape: Polygon;
  owner: SketchState;
  conflictIds?: readonly string[];
  documentScope: object;
  inspection: ConstraintInspectionStore;
  inspectedId: string | null;
  picked: readonly SketchPick[];
  onShape(shape: Polygon): void;
  onEditDim(key: string | null): void;
}) {
  const kindControl = useRef<HTMLSelectElement>(null);
  const listControl = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<string | null>(null);
  const [stored, setFilters] = useState(() => initialFilters(documentScope, owner));
  const inScope = stored.document === documentScope && stored.plane === owner.plane
    && stored.editNode === owner.editNode && stored.mainIds === owner.mainIds;
  const filters = inScope ? stored : initialFilters(documentScope, owner);
  if (!inScope) setFilters(filters);
  const { kind, pickedOnly } = filters;
  const rows = useMemo(() => constraintListRows(shape), [shape]);
  const kinds = [...new Set(rows.map(row => row.label))];
  if (kind && !kinds.includes(kind)) kinds.push(kind);
  const activeId = activeCircleDistanceRow(shape, owner.editDim);
  const visible = filterConstraintList(rows, kind, pickedOnly, picked, activeId);
  const conflictRows = (conflictIds ?? []).flatMap(id => rows.filter(row => row.id === id));
  useLayoutEffect(() => {
    const id = focusTarget.current;
    focusTarget.current = null;
    if (!id || !conflictIds?.includes(id)) return;
    listControl.current?.querySelector<HTMLElement>(`[data-constraint-id="${id}"]`)?.focus();
  }, [filters, conflictIds]);
  const hiddenInspection = inspectedId !== null && !visible.some(row => row.id === inspectedId);
  useLayoutEffect(() => {
    if (hiddenInspection) clearConstraintInspection(inspection, owner);
  }, [hiddenInspection, inspection, owner]);

  const enter = (entry: ConstraintEntry, input: ConstraintInspection['input']) => inspection.set({ owner, target: 'row', entry, input });
  const leave = (entry: ConstraintEntry, input: ConstraintInspection['input']) => {
    const current = inspection.get();
    if (current?.owner === owner && current.target === 'row' && current.entry.id === entry.id && current.input === input) inspection.set(null);
  };
  const leaveDimensions = (target: EventTarget | null) => {
    if (owner.editDim && !keepsDimensionDraft(target)) onEditDim(null);
  };

  return <>
    {conflictRows.map(row => <button key={row.id} type="button" data-sketch-action className="ghost"
      onClick={() => {
        focusTarget.current = row.id;
        setFilters({ ...filters, kind: row.label, pickedOnly: false });
      }}>{conflictActionLabel(row)}</button>)}
    <div className="card-title" style={{ marginTop: 10 }} role="status" aria-label="Constraint count">
      CONSTRAINTS · {visible.length}/{rows.length}
    </div>
    <div role="group" aria-label="Constraint filters" data-sketch-dimension-focus
      onBlur={event => leaveDimensions(event.relatedTarget)}
      onKeyDown={event => {
        const undo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z';
        // Chrome can send native Undo to the last text editor even when a select owns focus.
        if (undo) event.preventDefault();
        if (undo || event.key === 'Enter' || event.key === 'Escape' || event.key === ' ') event.stopPropagation();
      }}>
      <label className={FIELD}><span>Kind</span><NativeSelect ref={kindControl} className={CONTROL} aria-label="Constraint kind" value={kind}
        onChange={event => setFilters({ ...filters, kind: event.target.value })}>
        <option value="">All kinds</option>
        {kinds.map(label => <option key={label}>{label}</option>)}
      </NativeSelect></label>
      <label className={FIELD}><span>Picked only</span><input type="checkbox" checked={pickedOnly}
        onChange={event => setFilters({ ...filters, pickedOnly: event.target.checked })} /></label>
    </div>
    <div ref={listControl} role="list" aria-label="Constraints" data-sketch-dimension-focus onBlur={event => leaveDimensions(event.relatedTarget)}>
      {visible.map(row => {
        const hit = row.id === activeId || constraintInvolves(row, picked);
        if (row.id === 'ellipse') return <div key={row.id} className={'cons-row' + (hit ? ' hit' : '')}
          role="listitem" data-constraint-id={row.id}><div className="kv">{row.label}<b>{row.detail}</b></div></div>;
        return <div className={'cons-row' + (hit ? ' hit' : '') + (inspectedId === row.id ? ' inspecting' : '')}
          role="listitem" tabIndex={0} key={`${row.id}:${row.label}:${row.detail}`} data-constraint-id={row.id}
          onPointerEnter={() => enter(row, 'pointer')} onPointerLeave={() => leave(row, 'pointer')}
          onFocus={() => enter(row, 'focus')}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) leave(row, 'focus'); }}
          onKeyDown={event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.stopPropagation();
            if (event.target === event.currentTarget) event.preventDefault();
          }}>
          <div className="kv">{row.label}<b>{row.detail}</b></div>
          <button type="button" data-sketch-action className={'x' + (row.removable ? '' : ' off')} disabled={!row.removable}
            aria-label={`Remove ${row.label} ${row.detail}`} title={row.removable ? 'Remove this constraint' : undefined}
            onClick={event => {
              // Keyboard activation can remove the focused control from the list.
              if (event.detail === 0) kindControl.current?.focus();
              onShape(removeConstraint(shape, row.id));
            }}>×</button>
        </div>;
      })}
    </div>
    {!visible.length && <div className="muted" role="status">{pickedOnly && !picked.length ? 'Pick geometry to filter.' : 'No matching constraints.'}</div>}
  </>;
}
