import { ELLIPSE_POINTS, ellipseMatches } from '@barocss/cad-model/sketch/ellipse';
import { constraintEntries, samePick, type ConstraintEntry, type Polygon, type SketchPick } from '@barocss/cad-model/sketch/rules';

export function constraintListRows(shape: Polygon): ConstraintEntry[] {
  const rows = constraintEntries(shape);
  if (!shape.ellipse || !ellipseMatches(shape)) return rows;
  const arcs = rows.filter(row => row.label === 'Arc');
  return [{
    id: 'ellipse', label: 'Ellipse', detail: `${2 * ELLIPSE_POINTS} tangent arcs`, removable: false,
    involves: arcs.flatMap(row => row.involves),
  }, ...rows.filter(row => row.label !== 'Arc')];
}

export function constraintInvolves(row: ConstraintEntry, picked: readonly SketchPick[]): boolean {
  return row.involves.some(entity => picked.some(pick => samePick(entity, pick)));
}

export function filterConstraintList(rows: readonly ConstraintEntry[], kind: string, pickedOnly: boolean,
  picked: readonly SketchPick[]): ConstraintEntry[] {
  return rows.filter(row => (!kind || row.label === kind) && (!pickedOnly || constraintInvolves(row, picked)));
}
