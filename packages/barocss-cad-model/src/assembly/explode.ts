// The exploded view of an assembly: each part instance pushed out from the middle of everything along
// the line from it to its own middle (straight up when it sits in the middle), by `k` times that
// distance — for display only: the parts, their placements and their mates stay as they are.
import type { BodyResult } from '../engine/evaluate';
import type { DisplayMesh, Vec3 } from '../engine/mesh';
import { boundsOf } from '../engine/bounds';

/** The middle of the bodies' box. */
function centre(bs: readonly BodyResult[]): Vec3 { const { min, max } = boundsOf(bs); return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]; }

/** Each instance's display offset (mm). */
export function explodeOffsets(part: readonly BodyResult[], instances: readonly { id: string; bodies: readonly BodyResult[] }[], k: number): Map<string, Vec3> {
  const all = [...part, ...instances.flatMap(i => i.bodies)], out = new Map<string, Vec3>();
  if (!all.length || !(k > 0)) return out;
  const { min: lo, max: hi } = boundsOf(all), C: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], size = Math.max(1, hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  for (const inst of instances) {
    if (!inst.bodies.length) continue;
    const c = centre(inst.bodies), d = [c[0] - C[0], c[1] - C[1], c[2] - C[2]], l = Math.hypot(d[0], d[1], d[2]);
    out.set(inst.id, l > 1e-6 * size ? d.map(v => v * k) as Vec3 : [0, 0, size * 0.5 * k]);
  }
  return out;
}

/** A body's display mesh moved by `d` (a copy; its faces and edges keep their indices). */
export function movedBody(b: BodyResult, d: Vec3): BodyResult {
  const m = b.mesh, P = new Float32Array(m.positions), L = new Float32Array(m.edgeLines);
  for (let i = 0; i < P.length; i++) P[i] += d[i % 3];
  for (let i = 0; i < L.length; i++) L[i] += d[i % 3];
  const add = (p: readonly number[]): Vec3 => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
  const mesh: DisplayMesh = { ...m, positions: P, edgeLines: L, faces: m.faces.map(f => ({ ...f, centroid: add(f.centroid) })), edges: m.edges.map(e => ({ ...e, a: add(e.a), b: add(e.b) })), bounds: { min: add(m.bounds.min), max: add(m.bounds.max) } };
  return { ...b, mesh, ...(b.centroid ? { centroid: add(b.centroid) } : {}) };
}
