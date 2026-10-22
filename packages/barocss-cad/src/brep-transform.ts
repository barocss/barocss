// Affine maps of B-reps: every vertex, curve pole and surface pole is mapped (rational weights are
// unchanged, so lines, circles and planes stay exact). A map that reverses orientation (det < 0) also
// reverses every loop and face sense, so faces still point out of the solid.
import { BrepError, type Brep, type BrepCoedge, type BrepFace, type BrepLoop } from './brep-core.js';
import type { Curve, FacetPatch, Point, Surface } from './types.js';
import { transformFacetPatch } from './facet-patch.js';

/** x' = M·x + t with M row-major 3×3. */
export interface BrepAffine { readonly matrix: readonly [number, number, number, number, number, number, number, number, number]; readonly offset?: readonly [number, number, number] }

export function transformBrep(brep: Brep, map: BrepAffine, rename?: (name: string) => string): Brep {
  const m = map.matrix, t = map.offset ?? [0, 0, 0];
  const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  if (!(Number.isFinite(det) && det !== 0)) throw new BrepError('INPUT', 'an invertible finite affine map is required');
  const at = (p: readonly number[]): Point => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + t[0], m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + t[1], m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + t[2]];
  const curve = (c: Curve): Curve => ({ ...c, controlPoints: c.controlPoints.map(at) });
  // (A facet patch: its positions mapped into new arrays, shared untouched by an identity map — a rename.)
  const identity = m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 0 && m[4] === 1 && m[5] === 0 && m[6] === 0 && m[7] === 0 && m[8] === 1 && t[0] === 0 && t[1] === 0 && t[2] === 0;
  const surface = (s: Surface | FacetPatch): Surface | FacetPatch => s.kind === 'facets' ? (identity ? s : transformFacetPatch(s, m, t)) : { ...s, controlPoints: s.controlPoints.map(row => row.map(at)) };
  const flip = det < 0, nameOf = <T extends { name?: string }>(x: T) => rename && x.name !== undefined ? { name: rename(x.name) } : {};
  const loops: BrepLoop[] = brep.loops.map(l => flip ? { ...l, coedges: [...l.coedges].reverse() } : l);
  const coedges: BrepCoedge[] = brep.coedges.map(c => flip ? { ...c, sense: c.sense === 'forward' ? 'reversed' : 'forward', next: c.prev, prev: c.next } : c);
  const faces: BrepFace[] = brep.faces.map(f => ({ ...f, surface: surface(f.surface), ...(flip ? { sense: f.sense === 'forward' ? 'reversed' as const : 'forward' as const } : {}), ...nameOf(f) }));
  return { ...brep, faces, loops, coedges,
    edges: brep.edges.map(e => ({ ...e, curve: curve(e.curve), ...nameOf(e) })),
    vertices: brep.vertices.map(v => ({ ...v, point: at(v.point) })) };
}

/** Rotation by a multiple of 90° about a coordinate axis: exact entries 0 and ±1. */
export function quarterTurn(axis: 'x' | 'y' | 'z', degrees: number): BrepAffine['matrix'] {
  const k = Math.round(degrees / 90);
  if (k * 90 !== degrees) throw new BrepError('INPUT', 'a multiple of 90 degrees is required');
  const turns = ((k % 4) + 4) % 4, c = [1, 0, -1, 0][turns], s = [0, 1, 0, -1][turns];
  if (axis === 'x') return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 'y') return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
