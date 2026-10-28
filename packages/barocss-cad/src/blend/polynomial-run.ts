import type { Point, Surface } from '../types.js';
import { CadNumericPolicy } from '../numeric-policy.js';

/** The left/right Bezier controls at t, including polynomial extrapolation outside [0, 1]. */
function split(controls: readonly Point[], t: number): { left: Point[]; right: Point[] } {
  const work: Point[] = [];
  for (const p of controls) work.push([p[0], p[1], p[2]]);
  const left = [work[0]], right = [work[work.length - 1]];
  for (let level = 1; level < work.length; level++) {
    for (let i = 0; i < work.length - level; i++) {
      const a = work[i], b = work[i + 1];
      work[i] = [(1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1], (1 - t) * a[2] + t * b[2]];
    }
    left.push(work[0]); right.unshift(work[work.length - level - 1]);
  }
  return { left, right };
}

interface BezierRun { readonly knots: number[]; readonly start: number; readonly end: number }
function knotsForRun(knots: readonly number[], degree: number, count: number): BezierRun | null {
  if (degree < 2 || degree > 5 || count !== degree + 1) return null;
  const lo = knots[degree], hi = knots[count];
  if (!(hi > lo)) return null;
  for (let i = 0; i <= degree; i++) if (knots[i] !== lo || knots[count + i] !== hi) return null;
  const margin = (hi - lo) / 4, result: number[] = [];
  if (!Number.isFinite(lo - margin) || !Number.isFinite(hi + margin) || !(lo - margin < lo && hi + margin > hi)) return null;
  for (let i = 0; i <= degree; i++) result.push(lo - margin);
  for (let i = 0; i <= degree; i++) result.push(hi + margin);
  // Use the represented knot interval, not the ideal quarter-domain margin: offset knots can round it.
  const start = (result[0] - lo) / (hi - lo), end = (result[result.length - 1] - lo) / (hi - lo);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { knots: result, start, end };
}

function runControls(controls: readonly Point[], run: BezierRun): Point[] {
  return split(split(controls, run.end).left, run.start / run.end).right;
}

/**
 * INTERNAL: extend a single polynomial Bezier direction by one quarter of its domain at both ends.
 * Knots move with the new controls: every point in the original domain stays on the same polynomial.
 * Rational, periodic and multi-span directions keep their original domain. Used only for an open fillet's solve;
 * the body's surfaces and trims are never replaced. No offset fit or larger contact tolerance is introduced.
 */
export function polynomialRunSurface(surface: Surface): Surface {
  const rows = surface.controlPoints.length, columns = surface.controlPoints[0].length;
  let knotsU = knotsForRun(surface.knotsU, surface.degreeU, rows);
  let knotsV = knotsForRun(surface.knotsV, surface.degreeV, columns);
  if (!knotsU && !knotsV) return surface;
  let size = 1, closedU = true, closedV = true;
  for (const row of surface.controlPoints) for (const point of row) for (const value of point) size = Math.max(size, Math.abs(value));
  for (let i = 0; i < rows; i++) {
    const a = surface.controlPoints[i][0], b = surface.controlPoints[i][columns - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 1e-9 * size) closedV = false;
  }
  for (let j = 0; j < columns; j++) {
    const a = surface.controlPoints[0][j], b = surface.controlPoints[rows - 1][j];
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 1e-9 * size) closedU = false;
  }
  if (closedU) knotsU = null;
  if (closedV) knotsV = null;
  for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
    if (surface.weights[i][j] !== surface.weights[0][j]) knotsU = null;
    if (surface.weights[i][j] !== surface.weights[i][0]) knotsV = null;
  }
  if (!knotsU && !knotsV) return surface;
  const points: Point[][] = [];
  for (const row of surface.controlPoints) {
    const copy: Point[] = [];
    for (const point of row) copy.push([point[0], point[1], point[2]]);
    points.push(copy);
  }
  if (knotsU) for (let j = 0; j < columns; j++) {
    const controls: Point[] = [];
    for (let i = 0; i < rows; i++) controls.push(points[i][j]);
    const run = runControls(controls, knotsU);
    for (let i = 0; i < rows; i++) points[i][j] = run[i];
  }
  if (knotsV) for (let i = 0; i < rows; i++) points[i] = runControls(points[i], knotsV);
  for (const row of points) for (const point of row) for (const value of point) if (!Number.isFinite(value) || Math.abs(value) > CadNumericPolicy.geometryCoordinateAbs) return surface;
  return { ...surface, controlPoints: points, knotsU: knotsU?.knots ?? surface.knotsU, knotsV: knotsV?.knots ?? surface.knotsV };
}
