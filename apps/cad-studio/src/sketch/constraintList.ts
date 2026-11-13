import { ELLIPSE_POINTS, ellipseMatches } from '@barocss/cad-model/sketch/ellipse';
import { circlePairKeys, constraintEntries, samePick, type ConstraintEntry, type Polygon, type SketchPick } from '@barocss/cad-model/sketch/rules';

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

/** The active circle distance can be inspected even when Dimension consumed its pair of picks. */
export function activeCircleDistanceRow(shape: Polygon, editDim: string | null | undefined): string | undefined {
  if (!editDim?.startsWith('cc')) return;
  const index = shape.rules?.findIndex(rule => {
    if (rule.kind !== 'ccdist' && rule.kind !== 'ccdx' && rule.kind !== 'ccdy') return false;
    const keys = circlePairKeys(rule.a, rule.b);
    return editDim === keys[rule.kind === 'ccdist' ? 'dist' : rule.kind === 'ccdx' ? 'dx' : 'dy'];
  });
  if (index !== undefined && index >= 0) return 'rule:' + index;
}

export function filterConstraintList(rows: readonly ConstraintEntry[], kind: string, pickedOnly: boolean,
  picked: readonly SketchPick[], activeId?: string): ConstraintEntry[] {
  return rows.filter(row => (!kind || row.label === kind) && (!pickedOnly || row.id === activeId || constraintInvolves(row, picked)));
}
