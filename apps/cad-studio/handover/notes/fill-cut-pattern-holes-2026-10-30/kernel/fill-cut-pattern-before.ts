// A bounded XY reference-point mask on an explicit finite grid. This does not clip tools.
import { qualifyNativePlanarLoopV1 } from '../exact-proof/native-planar-loop-qualification-v1.js';
import { exactPoint2, exactPoint2FromXY, exactOrient2, type ExactPoint2 } from '../brep/planar-arrangement.js';
import type { Point } from '../types.js';

export type FillFeaturePatternRegion = { readonly points: readonly (readonly [number, number])[] };
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

/** Own the recipe's numeric snapshot; reuse the native simple-loop qualifier unchanged. */
export function fillCutSnapshot(region: unknown, anchor: unknown, fail: Refuse): { region: FillFeaturePatternRegion; anchor: [number, number] } {
  if (!region || typeof region !== 'object' || Array.isArray(region)) return fail('INPUT', 'region must be { points }');
  const proto = Object.getPrototypeOf(region), descriptors = Object.getOwnPropertyDescriptors(region);
  if ((proto !== Object.prototype && proto !== null) || Reflect.ownKeys(descriptors).length !== 1 || !Object.hasOwn(descriptors, 'points') || !('value' in descriptors.points)) return fail('INPUT', 'region must contain only points');
  const input: unknown = descriptors.points.value;
  if (!Array.isArray(input) || input.length < 3 || input.length > 16) return fail('INPUT', 'region needs 3 to 16 distinct XY vertices, with implicit closure');
  const entries = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(entries).length !== input.length + 1) return fail('INPUT', 'region points contain an unknown field');
  const points: [number, number][] = [], loop: { x: number; y: number }[] = [];
  for (let k = 0; k < input.length; k++) {
    const entry = entries[String(k)];
    if (!entry || !('value' in entry)) return fail('INPUT', 'region points must be plain numeric data');
    const point = pointSnapshot(entry.value, 'region', fail);
    points.push(point); loop.push({ x: point[0], y: point[1] });
  }
  const qualification = qualifyNativePlanarLoopV1(loop);
  if (qualification.status === 'refused') return fail('INPUT', `region must be a simple straight polygon: ${qualification.reason}`);
  if (qualification.status !== 'qualified') return fail('CAPABILITY', `region is unsupported: ${qualification.reason}`);
  return { region: { points }, anchor: pointSnapshot(anchor, 'anchor', fail) };
}

function compareCoordinate(a: ExactPoint2, b: ExactPoint2, axis: 'x' | 'y'): number {
  const difference = a[axis] * b.w - b[axis] * a.w;
  return difference > 0n ? 1 : difference < 0n ? -1 : 0;
}
function insideOrBoundary(points: readonly ExactPoint2[], p: ExactPoint2): boolean {
  let inside = false;
  for (let k = 0; k < points.length; k++) {
    const a = points[k], b = points[(k + 1) % points.length], side = exactOrient2(a, b, p);
    const ay = compareCoordinate(a, p, 'y'), by = compareCoordinate(b, p, 'y');
    if (side === 0 && compareCoordinate(a, p, 'x') * compareCoordinate(b, p, 'x') <= 0 && ay * by <= 0) return true;
    if ((ay > 0) !== (by > 0) && (by > ay ? side > 0 : side < 0)) inside = !inside;
  }
  return inside;
}

/** Counts/product are checked by the caller before any mask work. Original (0,0) stays unconditional. */
export function fillCutPlacements(region: FillFeaturePatternRegion, anchor: readonly [number, number], spacing: number, count: number, spacing2: number, count2: number): FillCutPlacement[] {
  const points: ExactPoint2[] = [];
  for (const point of region.points) points.push(exactPoint2FromXY([point[0], point[1]]));
  const origin = exactPoint2FromXY([anchor[0], anchor[1]]), placements: FillCutPlacement[] = [];
  for (let j = 0; j < count2; j++) for (let i = 0; i < count; i++) {
    if (i === 0 && j === 0) continue;
    const offset: Point = [i * spacing, j * spacing2, 0], delta = exactPoint2FromXY([offset[0], offset[1]]);
    // Sum the authored anchor and the represented binary64 offset as rational values, without Number rounding.
    const reference = exactPoint2(origin.x * delta.w + delta.x * origin.w, origin.w * delta.w, origin.y * delta.w + delta.y * origin.w, origin.w * delta.w);
    if (insideOrBoundary(points, reference)) placements.push({ offset, suffix: `@${i},${j}` });
  }
  return placements;
}
