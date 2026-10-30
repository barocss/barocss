// The Sketch panel's ellipse logic without JSX: applying an edited definition and the constraint rows of a matching ellipse.
import { ELLIPSE_POINTS, ellipseError, reellipse, type EllipseDef } from '@barocss/cad-model/sketch/ellipse';
import type { Polygon } from '@barocss/cad-model/sketch/rules';
import type { SketchShape } from '@barocss/cad-model/sketch/types';

export interface ConstraintRow { label: string; detail: string }

/** A new definition for the ellipse outline: refused with its reason (the shape stays), else the regenerated outline. */
export function applyEllipse(s: Polygon, def: EllipseDef, onShape: (shape: SketchShape | null) => void, onError: (e: string | null) => void) {
  const why = ellipseError(def);
  onError(why);
  if (!why) onShape(reellipse(s, def));
}

/** A matching ellipse's constraint rows: its arc-direction rows (one per arc, 192) become one summary row; every other row stays. */
export function ellipseConstraintRows(rows: readonly ConstraintRow[]): ConstraintRow[] {
  return [...rows.filter(r => r.label !== 'Arc'), { label: 'Ellipse', detail: `${2 * ELLIPSE_POINTS} tangent arcs` }];
}
