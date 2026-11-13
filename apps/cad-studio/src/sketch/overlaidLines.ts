import { isSettled } from '@barocss/cad-model/sketch/rules';
import { rectangleOutline } from '@barocss/cad-model/sketch/select';
import { shapeOutline } from '@barocss/cad-model/sketch/loops';
import type { P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';

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

/** Activate the scanned occurrence, even when the displayed position has two owners. */
export function selectOverlaidEdge(sketch: SketchState, occurrence: OverlaidLine): SketchState | null {
  const done = sketch.done ?? [];
  const current = sketch.shape;
  const source = occurrence.shape === done.length ? current : done[occurrence.shape];
  if (!source || source.construction) return null;
  const shape = source.kind === 'rectangle' ? rectangleOutline(source) : source;
  if (!isSettled(shape)) return null;
  const samePoint = (a: P2, b: P2) => a[0] === b[0] && a[1] === b[1];
  const matches = (point: P2, index: number, points: P2[]) => {
    if ((shape.bulges?.[index] ?? 0) !== 0 || (occurrence.id && shape.ids?.[index] !== occurrence.id)) return false;
    const end = points[(index + 1) % points.length];
    return samePoint(point, occurrence.start) && samePoint(end, occurrence.end)
      || samePoint(point, occurrence.end) && samePoint(end, occurrence.start);
  };
  const side = source.kind === 'rectangle' ? shape.points.findIndex(matches) : occurrence.side;
  if (!shape.points[side] || !matches(shape.points[side], side, shape.points)) return null;
  if (source === current) return { ...sketch, shape, picked: [{ kind: 'edge', i: side }], editDim: null };
  const ordered = [...done];
  const priorIndex = sketch.activeOutlineIndex ?? done.length;
  if (current) ordered.splice(priorIndex, 0, current);
  const index = occurrence.shape + Number(!!current && occurrence.shape >= priorIndex);
  ordered.splice(index, 1);
  return { ...sketch, shape, done: ordered, activeOutlineIndex: index, picked: [{ kind: 'edge', i: side }], editDim: null };
}
