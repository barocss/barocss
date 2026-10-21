// The exploded view of an assembly: each part instance pushed out from the middle of everything along
// the line from it to its own middle (straight up when it sits in the middle), by `k` times that
// distance — for display only: the parts, their placements and their mates stay as they are.
import type { BodyResult } from '../engine/evaluate';
import type { DisplayMesh, Vec3 } from '../engine/mesh';

const centre = (bs: readonly BodyResult[]): Vec3 => { const lo = [0, 1, 2].map(k => Math.min(...bs.map(b => b.mesh.bounds.min[k]))), hi = [0, 1, 2].map(k => Math.max(...bs.map(b => b.mesh.bounds.max[k]))); return [0, 1, 2].map(k => (lo[k] + hi[k]) / 2) as Vec3; };

/** Each instance's display offset (mm). */
export function explodeOffsets(part: readonly BodyResult[], instances: readonly { id: string; bodies: readonly BodyResult[] }[], k: number): Map<string, Vec3> {
  const all = [...part, ...instances.flatMap(i => i.bodies)], out = new Map<string, Vec3>();
  if (!all.length || !(k > 0)) return out;
  const C = centre(all), size = Math.max(1, ...[0, 1, 2].map(a => Math.max(...all.map(b => b.mesh.bounds.max[a])) - Math.min(...all.map(b => b.mesh.bounds.min[a]))));
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
