// A bounded XY reference-point mask on an explicit finite grid. This does not clip tools.
import { qualifyNativePlanarLoopV1 } from '../exact-proof/native-planar-loop-qualification-v1.js';
import { exactPoint2, exactPoint2FromXY, exactOrient2, type ExactPoint2 } from '../brep/planar-arrangement.js';
import type { Point } from '../types.js';

export type FillFeaturePatternRegion = {
  readonly points: readonly (readonly [number, number])[];
  /** Nonempty straight holes; all boundary rings share the existing 16-vertex allowance. */
  readonly holes?: readonly (readonly (readonly [number, number])[])[];
};
type Refuse = (code: 'INPUT' | 'CAPABILITY' | 'PARAMETER', message: string) => never;
export interface FillCutPlacement { readonly offset: Point; readonly suffix: string }

function pointSnapshot(input: unknown, what: string, fail: Refuse): [number, number] {
  if (!Array.isArray(input) || input.length !== 2) return fail('INPUT', `${what} must be [x, y]`);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(descriptors).length !== 3) return fail('INPUT', `${what} contains an unknown field`);
  const point: [number, number] = [0, 0];
  for (let k = 0; k < 2; k++) {
    const descriptor = descriptors[String(k)];
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value)) return fail('INPUT', `${what} coordinates must be finite numbers`);
    if (Math.abs(descriptor.value) > 10000) return fail('PARAMETER', `${what} coordinates must be within ±10000 mm`);
    point[k] = descriptor.value;
  }
  return point;
}

/** Capture array slots as own data once; do not invoke iterators or element getters. */
function arraySnapshot(input: unknown, minimum: number, maximum: number, what: string, fail: Refuse): unknown[] {
  if (!Array.isArray(input) || input.length < minimum || input.length > maximum) return fail('INPUT', `${what} needs ${minimum} to ${maximum} entries`);
  const descriptors = Object.getOwnPropertyDescriptors(input as object), length = descriptors.length;
  if (!length || !('value' in length) || !Number.isSafeInteger(length.value) || length.value < minimum || length.value > maximum || Reflect.ownKeys(descriptors).length !== length.value + 1) return fail('INPUT', `${what} must be a dense array without unknown fields`);
  const values: unknown[] = [];
  for (let k = 0; k < length.value; k++) {
    const entry = descriptors[String(k)];
    if (!entry || !('value' in entry)) return fail('INPUT', `${what} must be plain numeric data`);
    values.push(entry.value);
  }
  return values;
}
function loopSnapshot(input: unknown, what: string, fail: Refuse): [number, number][] {
  const points: [number, number][] = [];
  for (const point of arraySnapshot(input, 3, 16, what, fail)) points.push(pointSnapshot(point, what, fail));
  return points;
}
function qualifyLoop(points: readonly (readonly [number, number])[], what: string, fail: Refuse): void {
  const loop: { x: number; y: number }[] = [];
  for (const point of points) loop.push({ x: point[0], y: point[1] });
  const qualification = qualifyNativePlanarLoopV1(loop);
  if (qualification.status === 'refused') return fail('INPUT', `${what} must be a simple straight polygon: ${qualification.reason}`);
  if (qualification.status !== 'qualified') return fail('CAPABILITY', `${what} is unsupported: ${qualification.reason}`);
}
function exactLoop(points: readonly (readonly [number, number])[]): ExactPoint2[] {
  const exact: ExactPoint2[] = [];
  for (const point of points) exact.push(exactPoint2FromXY([point[0], point[1]]));
  return exact;
}

/** Own numeric data and qualify all rings before any placements or tool copies. */
export function fillCutSnapshot(region: unknown, anchor: unknown, fail: Refuse): { region: FillFeaturePatternRegion; anchor: [number, number] } {
  if (!region || typeof region !== 'object' || Array.isArray(region)) return fail('INPUT', 'region must be { points } with optional nonempty holes');
  const proto = Object.getPrototypeOf(region), descriptors = Object.getOwnPropertyDescriptors(region), keys = Reflect.ownKeys(descriptors);
  if ((proto !== Object.prototype && proto !== null) || !Object.hasOwn(descriptors, 'points') || !('value' in descriptors.points)) return fail('INPUT', 'region needs plain points data');
  for (const key of keys) if (key !== 'points' && key !== 'holes') return fail('INPUT', 'region contains an unknown field');
  const points = loopSnapshot(descriptors.points.value, 'region points', fail), holes: [number, number][][] = [];
  let vertices = points.length;
  if (Object.hasOwn(descriptors, 'holes')) {
    const entry = descriptors.holes;
    if (!('value' in entry)) return fail('INPUT', 'region holes must be plain numeric data');
    // The outer has at least three vertices, so the shared 16-vertex bound allows at most four holes.
    for (const input of arraySnapshot(entry.value, 1, 4, 'region holes', fail)) {
      const hole = loopSnapshot(input, 'hole points', fail); vertices += hole.length;
      if (vertices > 16) return fail('INPUT', 'all region boundaries must share at most 16 vertices');
      holes.push(hole);
    }
  }
  qualifyLoop(points, 'region', fail);
  for (const hole of holes) qualifyLoop(hole, 'hole', fail);
  if (holes.length) qualifyHoles(exactLoop(points), holes, fail);
  return { region: holes.length ? { points, holes } : { points }, anchor: pointSnapshot(anchor, 'anchor', fail) };
}

function compareCoordinate(a: ExactPoint2, b: ExactPoint2, axis: 'x' | 'y'): number {
  const difference = a[axis] * b.w - b[axis] * a.w;
  return difference > 0n ? 1 : difference < 0n ? -1 : 0;
}
/** -1 outside, 0 boundary, 1 inside, using the existing exact ray and boundary predicates. */
function pointClass(points: readonly ExactPoint2[], p: ExactPoint2): -1 | 0 | 1 {
  let inside = false;
  for (let k = 0; k < points.length; k++) {
    const a = points[k], b = points[(k + 1) % points.length], side = exactOrient2(a, b, p);
    const ay = compareCoordinate(a, p, 'y'), by = compareCoordinate(b, p, 'y');
    if (side === 0 && compareCoordinate(a, p, 'x') * compareCoordinate(b, p, 'x') <= 0 && ay * by <= 0) return 0;
    if ((ay > 0) !== (by > 0) && (by > ay ? side > 0 : side < 0)) inside = !inside;
  }
  return inside ? 1 : -1;
}

function onSegment(a: ExactPoint2, b: ExactPoint2, p: ExactPoint2, orientation: number): boolean {
  return orientation === 0 && compareCoordinate(a, p, 'x') * compareCoordinate(b, p, 'x') <= 0 && compareCoordinate(a, p, 'y') * compareCoordinate(b, p, 'y') <= 0;
}
/** Existing exact orientation/on-segment semantics; collinear extensions alone are not contact. */
function segmentsMeet(a: ExactPoint2, b: ExactPoint2, c: ExactPoint2, d: ExactPoint2): boolean {
  const ac = exactOrient2(a, b, c), ad = exactOrient2(a, b, d), ca = exactOrient2(c, d, a), cb = exactOrient2(c, d, b);
  return ac * ad < 0 && ca * cb < 0 || onSegment(a, b, c, ac) || onSegment(a, b, d, ad) || onSegment(c, d, a, ca) || onSegment(c, d, b, cb);
}
function qualifyHoles(outer: readonly ExactPoint2[], holes: readonly (readonly (readonly [number, number])[])[], fail: Refuse): void {
  const rings: ExactPoint2[][] = [[...outer]];
  for (const hole of holes) rings.push(exactLoop(hole));
  for (let i = 1; i < rings.length; i++) {
    const ring = rings[i];
    for (let j = 0; j < i; j++) {
      const other = rings[j];
      for (let a = 0; a < ring.length; a++) for (let b = 0; b < other.length; b++) {
        if (segmentsMeet(ring[a], ring[(a + 1) % ring.length], other[b], other[(b + 1) % other.length])) return fail('INPUT', 'region boundaries must not cross, touch or overlap');
      }
      if (j > 0 && (pointClass(other, ring[0]) !== -1 || pointClass(ring, other[0]) !== -1)) return fail('INPUT', 'holes must be disjoint without nesting');
    }
    if (pointClass(outer, ring[0]) !== 1) return fail('INPUT', 'every hole must lie strictly inside the outer boundary');
  }
}

/** Counts/product are checked by the caller before any mask work. Original (0,0) stays unconditional. */
export function fillCutPlacements(region: FillFeaturePatternRegion, anchor: readonly [number, number], spacing: number, count: number, spacing2: number, count2: number): FillCutPlacement[] {
  const points = exactLoop(region.points), holes: ExactPoint2[][] = [];
  for (const hole of region.holes ?? []) holes.push(exactLoop(hole));
  const origin = exactPoint2FromXY([anchor[0], anchor[1]]), placements: FillCutPlacement[] = [];
  for (let j = 0; j < count2; j++) for (let i = 0; i < count; i++) {
    if (i === 0 && j === 0) continue;
    const offset: Point = [i * spacing, j * spacing2, 0], delta = exactPoint2FromXY([offset[0], offset[1]]);
    // Sum the authored anchor and the represented binary64 offset as rational values, without Number rounding.
    const reference = exactPoint2(origin.x * delta.w + delta.x * origin.w, origin.w * delta.w, origin.y * delta.w + delta.y * origin.w, origin.w * delta.w);
    if (pointClass(points, reference) < 0) continue;
    let excluded = false;
    for (const hole of holes) if (pointClass(hole, reference) >= 0) { excluded = true; break; }
    if (!excluded) placements.push({ offset, suffix: `@${i},${j}` });
  }
  return placements;
}
