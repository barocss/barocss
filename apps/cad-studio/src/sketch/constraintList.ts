import { rectilinearConflict } from '@barocss/cad-model/sketch/conflict';
import { CadNumericPolicy } from '@barocss/cad';
import { ELLIPSE_POINTS, ellipseMatches } from '@barocss/cad-model/sketch/ellipse';
import { circlePairKeys, constraintEntries, hvOf, samePick, solveShape, type ConstraintEntry, type Polygon, type SketchPick } from '@barocss/cad-model/sketch/rules';

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

/** Prove the attempted length contradicts one existing opposite length and the four axis locks. */
export function opposingLengthConflict(shape: Polygon, key: string, value: number): number | undefined {
  const match = /^len([0-3])$/.exec(key);
  if (!match || !shape.closed || shape.pending || shape.points.length !== 4 || shape.bulges?.some(bulge => bulge !== 0)
    || !Number.isFinite(value) || value < 0.001) return;
  const edge = Number(match[1]), opposite = (edge + 2) % 4;
  if (!shape.lengths || !Object.hasOwn(shape.lengths, opposite)) return;
  const existing = shape.lengths[opposite];
  if (existing === undefined || !Number.isFinite(existing) || existing < 0.001) return;
  const hv = hvOf(shape);
  const alternating = (axis: number[], start: number) => axis.length === 2 && axis.includes(start) && axis.includes(start + 2);
  if (!(alternating(hv.h, 0) && alternating(hv.v, 1) || alternating(hv.h, 1) && alternating(hv.v, 0))) return;
  if (!rectilinearConflict(shape.points, { hv, lengths: { [edge]: value, [opposite]: existing } }).proven) return;
  // The subset names a participating constraint. The full solve must also classify the refusal as a conflict.
  const report = solveShape({ ...shape, hv, lengths: { ...shape.lengths, [edge]: value } });
  if (!report.ok && report.conflict) return opposite;
}

/** A centre distance cannot be shorter than a projection of that same pair. */
export function circleDistanceConflict(shape: Polygon, key: string, value: number) {
  const match = /^ccdist(\d+)_(\d+)$/.exec(key);
  const maxDistance = 2 * CadNumericPolicy.coordinateAbs * Math.SQRT2;
  if (!match || !shape.closed || shape.pending || !Number.isFinite(value) || value < 0.001 || value > maxDistance) return;
  const a = Number(match[1]), b = Number(match[2]);
  if (a >= b || !shape.circles?.[a] || !shape.circles[b]) return;
  // The axis projection can spend two tie residuals, one run residual and one length
  // residual. Allow one for the direct length and one more for floating-point roundoff.
  const margin = 6 * CadNumericPolicy.linearTolerance;
  let conflict: { id: string; axis: 'horizontal' | 'vertical'; value: number } | undefined;
  for (const [i, rule] of (shape.rules ?? []).entries()) {
    if ((rule.kind !== 'ccdx' && rule.kind !== 'ccdy') || !Number.isFinite(rule.value) || rule.value > maxDistance
      || !(rule.a === a && rule.b === b || rule.a === b && rule.b === a)
      || rule.value - value <= margin || (conflict && rule.value <= conflict.value)) continue;
    conflict = { id: `rule:${i}`, axis: rule.kind === 'ccdx' ? 'horizontal' : 'vertical', value: rule.value };
  }
  return conflict;
}
