import { CadNumericPolicy } from '@barocss/cad';
import { offsetShape } from '../offset';
import { arcOf, type P2 } from '../profile';
import type { SketchShape } from '../types';

type Polygon = Extract<SketchShape, { kind: 'polygon' }>;
type Plan = { shape: Polygon; retiredIds: string[] } | { error: string; openingClosed?: true };

const minimumRadius = 0.01; // The current circular-arc offset floor.
const minimumSpan = 0.01; // The current rectangle offset floor.
const angularTolerance = 1e-9;
const tolerance = CadNumericPolicy.linearTolerance;
const tangentDirections: P2[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const at = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
const safeId = (id: string) => /^e[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id.slice(1)));
const badOutline = 'The inset requires a CCW tangent rounded rectangle starting on its lower edge.';

function rectangleOf(s: Polygon) {
  if (!s.closed || s.pending || s.construction || s.fromSpline || s.spline || s.fromEllipse || s.ellipse
    || s.circles?.length || s.circleIds?.length || s.points.length !== 8 || s.bulges?.length !== 8) return null;
  for (const point of s.points) {
    if (point?.length !== 2 || !point.every(v => Number.isFinite(v) && Math.abs(v) <= CadNumericPolicy.coordinateAbs)) return null;
  }

  const [a, b, c, d, e, f, g, h] = s.points;
  const left = h[0], right = c[0], bottom = a[1], top = e[1];
  const radius = a[0] - left;
  if (!(radius > minimumRadius && right - left - 2 * radius > minimumSpan && top - bottom - 2 * radius > minimumSpan)
    || b[1] !== bottom || d[0] !== right || f[1] !== top || g[0] !== left) return null;

  const centers: P2[] = [[right - radius, bottom + radius], [right - radius, top - radius],
    [left + radius, top - radius], [left + radius, bottom + radius]];
  for (const [i, center] of centers.entries()) {
    const edge = 2 * i;
    const lineStart = s.points[edge], start = s.points[edge + 1], end = s.points[(edge + 2) % 8];
    const [tx, ty] = tangentDirections[i], [ux, uy] = tangentDirections[(i + 1) % 4];
    const bulge = s.bulges[edge + 1];
    if (s.bulges[edge] !== 0 || !(bulge > 0)
      || (start[0] - lineStart[0]) * tx + (start[1] - lineStart[1]) * ty <= minimumSpan) return null;
    const arc = arcOf(start, end, bulge);
    if (!at(arc.center, center) || !(Math.abs(arc.radius - radius) <= tolerance)
      || !(Math.abs(arc.sweep - Math.PI / 2) <= angularTolerance)) return null;

    // A positive quarter arc meets both straight supports in their forward direction.
    if (!at(start, [center[0] + radius * ty, center[1] - radius * tx])
      || !at(end, [center[0] + radius * uy, center[1] - radius * ux])
      || Math.hypot(-Math.sin(arc.start) - tx, Math.cos(arc.start) - ty) > angularTolerance
      || Math.hypot(-Math.sin(arc.start + arc.sweep) - ux, Math.cos(arc.start + arc.sweep) - uy) > angularTolerance) return null;
  }
  return { left, right, bottom, top, radius };
}

/** Plan an inset from the same authored source for each distance. The source starts on the lower edge
 * in +X, followed by the lower-right arc. Active and retired IDs both follow source traversal. */
export function planRoundedRectangleInset(source: SketchShape, inset: number, derivedIdsBySource: ReadonlyMap<string, string>): Plan {
  if (!(Number.isFinite(inset) && inset > 0)) return { error: 'Give the inset a positive finite distance.' };
  if (source.kind !== 'polygon') return { error: badOutline };
  const rectangle = rectangleOf(source);
  if (!rectangle) return { error: badOutline };

  const sourceIds = source.ids;
  if (sourceIds?.length !== 8 || new Set(sourceIds).size !== 8 || derivedIdsBySource.size !== 8) {
    return { error: 'The inset requires one distinct derived ID per source side.' };
  }
  const ids: string[] = [];
  for (const id of sourceIds) {
    const derived = derivedIdsBySource.get(id);
    if (!id || !safeId(id) || !derived || !safeId(derived) || sourceIds.includes(derived) || ids.includes(derived)) {
      return { error: 'The inset requires distinct safe side IDs disjoint from the source.' };
    }
    ids.push(derived);
  }

  const { left, right, bottom, top, radius } = rectangle;
  const loX = left + inset, hiX = right - inset, loY = bottom + inset, hiY = top - inset;
  if (!(hiX - loX > minimumSpan && hiY - loY > minimumSpan)) return { error: 'That inset closes the rectangle up.', openingClosed: true };

  if (inset < radius) {
    if (inset >= radius - minimumRadius) return { error: 'That inset leaves an arc at or below the minimum offset radius.' };
    const result = offsetShape(source, -inset);
    if ('error' in result) return result;
    const shape = result.shape;
    if (shape.kind !== 'polygon' || shape.points.length !== 8 || !(shape.points[0][1] - bottom > tolerance
      && right - shape.points[2][0] > tolerance && top - shape.points[4][1] > tolerance && shape.points[6][0] - left > tolerance)) {
      return { error: 'That inset leaves no clear gap from the source.' };
    }
    return { shape: { ...shape, ids }, retiredIds: [] };
  }

  return {
    shape: { kind: 'polygon', closed: true, points: [[loX, loY], [hiX, loY], [hiX, hiY], [loX, hiY]],
      bulges: [0, 0, 0, 0], ids: ids.filter((_, i) => i % 2 === 0) },
    retiredIds: ids.filter((_, i) => i % 2 === 1),
  };
}
