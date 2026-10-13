import { qualifyNativePlanarLoopV1 } from './native-planar-loop-qualification-v1.js';
import type { Binary64PointV1 } from './exact-binary64-orientation-v1.js';

export interface NativeBoundaryVertexV1 { readonly id: string; readonly pointMM: Readonly<Binary64PointV1> }
export interface NativeBoundaryHalfEdgeV1 {
  readonly id: string; readonly originVertexId: string; readonly destinationVertexId: string;
  readonly nextId: string; readonly previousId: string; readonly twinId: null;
}
export type NativePlanarFaceBoundaryV1 =
  | { readonly status: 'qualified'; readonly faceId: string;
      readonly winding: 'clockwise' | 'counterclockwise';
      readonly vertices: readonly NativeBoundaryVertexV1[];
      readonly halfEdges: readonly NativeBoundaryHalfEdgeV1[] }
  | { readonly status: 'refused' | 'unsupported'; readonly reason: string };

/** One immutable oriented boundary cycle, not a sewn B-Rep Face/Shell. Twin is absent. */
export function constructNativePlanarFaceBoundaryV1(faceId: unknown, loop: unknown): NativePlanarFaceBoundaryV1 {
  if (typeof faceId !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(faceId))
    return { status: 'refused', reason: 'invalid-face-id' };
  // Snapshot descriptors, not property getters: construction must consume the
  // same finite represented coordinates that the loop qualifier admitted.
  if (!Array.isArray(loop) || loop.length < 3 || loop.length > 16)
    return { status: 'refused', reason: 'invalid-loop' };
  const points: Binary64PointV1[] = [];
  try {
    for (let i = 0; i < loop.length; i++) {
      const input: unknown = Object.getOwnPropertyDescriptor(loop, String(i))?.value;
      if (!input || typeof input !== 'object' || Array.isArray(input)) return { status: 'refused', reason: 'invalid-loop' };
      const proto = Object.getPrototypeOf(input);
      if (proto !== Object.prototype && proto !== null) return { status: 'refused', reason: 'invalid-loop' };
      const fields = Object.getOwnPropertyDescriptors(input);
      const keys = Reflect.ownKeys(fields);
      if (keys.length !== 2 || !['x', 'y'].every(key =>
        Object.hasOwn(fields, key) && 'value' in fields[key] &&
        typeof fields[key].value === 'number')) return { status: 'refused', reason: 'invalid-loop' };
      points.push({ x: fields.x.value as number, y: fields.y.value as number });
    }
  } catch {
    return { status: 'refused', reason: 'invalid-loop' };
  }
  const result = qualifyNativePlanarLoopV1(points);
  if (result.status !== 'qualified') return result;
  const n = points.length;
  const vertices = Object.freeze(points.map((p, i) => Object.freeze({
    id: faceId + ':v' + i,
    pointMM: Object.freeze({ x: p.x, y: p.y }),
  })));
  const edgeId = (i: number) => faceId + ':h' + i;
  const halfEdges = Object.freeze(points.map((_, i) => Object.freeze({
    id: edgeId(i), originVertexId: vertices[i].id,
    destinationVertexId: vertices[(i + 1) % n].id,
    nextId: edgeId((i + 1) % n), previousId: edgeId((i + n - 1) % n),
    twinId: null,
  })));
  return Object.freeze({ status: 'qualified', faceId, winding: result.winding, vertices, halfEdges });
}
