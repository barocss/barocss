import { shapeOutline } from '@barocss/cad-model/sketch/loops';
import type { P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape } from '@barocss/cad-model/sketch/types';

export interface OverlaidLine {
  shape: number;
  side: number;
  id?: string;
  start: P2;
  end: P2;
}

export type OverlaidLinesReport =
  | { status: 'complete'; groups: OverlaidLine[][]; checked: number; excludedShapes: number; excludedSegments: number }
  | { status: 'scan-limit' | 'result-limit' | 'unfinished' };

export const OVERLAID_LINE_SCAN_LIMIT = 4096;
export const OVERLAID_LINE_RESULT_LIMIT = 256;
const validPoint = (point: P2) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);

function keyOf(a: P2, b: P2): string {
  const inOrder = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  // JSON normalizes signed zero. The occurrence still holds the original points and direction.
  return JSON.stringify(inOrder ? [a, b] : [b, a]);
}

/** Compare exact authored endpoints in sketch coordinates. Each result names its source occurrence. */
export function findOverlaidLines(shapes: readonly SketchShape[]): OverlaidLinesReport {
  let visits = shapes.length, checked = 0, excludedShapes = 0, excludedSegments = 0;
  if (visits > OVERLAID_LINE_SCAN_LIMIT) return { status: 'scan-limit' };
  const byEndpoints = new Map<string, OverlaidLine[]>();
  for (const [shapeIndex, shape] of shapes.entries()) {
    if (shape.kind === 'polygon' && shape.pending) return { status: 'unfinished' };
    if (shape.construction || (shape.kind !== 'rectangle' && shape.kind !== 'polygon') ||
        (shape.kind === 'polygon' && (shape.spline || shape.fromSpline || shape.ellipse || shape.fromEllipse))) {
      excludedShapes++;
      continue;
    }
    const points = shape.kind === 'rectangle' ? shapeOutline(shape) : shape.points;
    const count = shape.kind === 'rectangle' || shape.closed ? points.length : Math.max(0, points.length - 1);
    const attached = shape.kind === 'polygon' ? shape.circles?.length ?? 0 : 0;
    visits += count + attached;
    if (visits > OVERLAID_LINE_SCAN_LIMIT) return { status: 'scan-limit' };
    excludedShapes += attached;
    for (let side = 0; side < count; side++) {
      const start = points[side], end = points[(side + 1) % points.length];
      if ((shape.kind === 'polygon' && (shape.bulges?.[side] ?? 0) !== 0) ||
          !validPoint(start) || !validPoint(end) || (start[0] === end[0] && start[1] === end[1])) {
        excludedSegments++;
        continue;
      }
      checked++;
      const key = keyOf(start, end);
      const occurrence = { shape: shapeIndex, side, id: shape.ids?.[side], start: [...start] as P2, end: [...end] as P2 };
      const group = byEndpoints.get(key);
      if (group) group.push(occurrence);
      else byEndpoints.set(key, [occurrence]);
    }
  }
  const groups = [...byEndpoints.values()].filter(group => group.length > 1);
  if (groups.reduce((sum, group) => sum + group.length, 0) > OVERLAID_LINE_RESULT_LIMIT) return { status: 'result-limit' };
  return { status: 'complete', groups, checked, excludedShapes, excludedSegments };
}
