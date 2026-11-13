import type { HoleOutline, LoopSegment } from '../../engine/doc';
import { arcOf, inferTangents, outlineSegments, type P2 } from '../profile';

const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const samePoint = (a: readonly unknown[], b: readonly unknown[]) => a[0] === b[0] && a[1] === b[1];
const linearTolerance = 1e-7;

/** Restore only constraints that describe this exact literal native hole, in its existing order. */
export function matchesHoleOutline(value: unknown, loop: readonly LoopSegment[], sides: readonly string[]): value is HoleOutline {
  const count = loop.length;
  if (count < 3 || sides.length !== count || new Set(sides).size !== count
    || !record(value) || Object.keys(value).length !== 2) return false;
  const { outline, sides: saved } = value;
  if (!Array.isArray(saved) || saved.length !== count || !sides.every((id, i) => id && id === saved[i])
    || !record(outline) || Object.keys(outline).some(key => !['points', 'bulges', 'radii', 'lengths', 'tangents', 'hv'].includes(key))) return false;
  const { points, bulges, radii, lengths, tangents, hv } = outline;
  if (!Array.isArray(points) || points.length !== count || ![...points].every(p => Array.isArray(p) && p.length === 2 && finite(p[0]) && finite(p[1]))
    || !Array.isArray(bulges) || bulges.length !== count || ![...bulges].every(finite)
    || !bulges.some(Boolean) || !bulges.includes(0)
    || (radii !== undefined && !record(radii)) || (lengths !== undefined && !record(lengths))) return false;
  const coords = points as P2[], next = (i: number) => coords[(i + 1) % count];
  const delta = (i: number, axis: number) => next(i)[axis] - coords[i][axis];
  const chord = (i: number) => Math.hypot(delta(i, 0), delta(i, 1));
  const native = outlineSegments(coords, bulges);
  if (!native.every((segment, i) => {
    const raw = loop[i];
    return !!raw && Array.isArray(raw.start) && raw.start.length === 2
      && Number.isFinite(chord(i)) && chord(i) > 0 && samePoint(segment.start, raw.start)
      && (segment.kind === 'line' ? raw.kind === 'line' : raw.kind === 'arc'
        && Array.isArray(raw.center) && raw.center.length === 2 && segment.direction === raw.direction
        && segment.center.every(finite) && samePoint(segment.center, raw.center));
  })) return false;
  const index = (i: number) => Number.isInteger(i) && i >= 0 && i < count;
  const mapMatches = (map: Record<string, unknown>, arc: boolean) => Object.entries(map).every(([key, v]) => {
    const i = Number(key);
    if (key !== String(i) || !index(i) || Boolean(bulges[i]) !== arc || !finite(v) || v < 0.001) return false;
    if (!arc) return Math.abs(chord(i) - v) <= linearTolerance;
    const { center, radius } = arcOf(coords[i], next(i), bulges[i]);
    const endRadius = Math.hypot(next(i)[0] - center[0], next(i)[1] - center[1]);
    return Math.abs(radius - v) <= linearTolerance && Math.abs(endRadius - v) <= linearTolerance;
  });
  if ((radii !== undefined && !mapMatches(radii, true)) || (lengths !== undefined && !mapMatches(lengths, false))) return false;
  let axisLocks = 0;
  if (hv !== undefined) {
    if (!record(hv) || Object.keys(hv).length !== 2 || !Array.isArray(hv.h) || !Array.isArray(hv.v)) return false;
    const locks = [...hv.h, ...hv.v];
    if (new Set(locks).size !== locks.length
      || ![...hv.h].every(i => index(i) && !bulges[i] && Math.abs(delta(i, 1)) <= linearTolerance)
      || ![...hv.v].every(i => index(i) && !bulges[i] && Math.abs(delta(i, 0)) <= linearTolerance)) return false;
    axisLocks = locks.length;
  }
  if (tangents !== undefined) {
    if (!Array.isArray(tangents) || new Set(tangents).size !== tangents.length) return false;
    const tangent = new Set(inferTangents(coords, bulges, 1e-9));
    if (![...tangents].every(i => tangent.has(i))) return false;
    if (tangents.length) return true;
  }
  return axisLocks > 0 || Object.keys(radii ?? {}).length > 0 || Object.keys(lengths ?? {}).length > 0;
}
