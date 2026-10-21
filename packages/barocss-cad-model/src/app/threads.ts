// Cosmetic threads in the viewport: a bolt's shank, a nut's bore and a tapped hole carry no helical
// geometry, so their threads are drawn — thin rings a pitch apart along the round face, just outside an
// external thread and just inside an internal one. Which faces: those of a tapped hole feature (its
// thread noted, "M6×1"), and the faces at the nominal diameter of a fastener's own features.
import type { ModelNode } from '../engine/doc';
import type { DisplayMesh, Vec3 } from '../engine/mesh';
import { FASTENER_SIZES } from './fasteners';
import { roundFaceAxis } from './measure';
import { featureId } from '../engine/ids';

/** At most this many rings on one face (a long thread shows every few pitches). */
const MOST = 40;

/** A thread: nominal diameter and pitch, the radius of the face it is on, and whether it is a bore's. */
export interface FaceThread { d: number; pitch: number; radius?: number; internal: boolean }
/** The threads features carry, by the feature ids (engine/ids.ts) whose faces they are on. */
export function threadsOf(nodes: readonly ModelNode[]): Map<string, FaceThread> {
  const out = new Map<string, FaceThread>();
  nodes.forEach((n, i) => {
    if (n.kind === 'hole' && n.thread) {
      const m = /^M([\d.]+)×([\d.]+)/.exec(n.thread); if (m) out.set(featureId(nodes, i), { d: Number(m[1]), pitch: Number(m[2]), radius: typeof n.radius === 'number' ? n.radius : undefined, internal: true });
    }
    const made = 'made' in n ? n.made : undefined;
    if (made?.command === 'fastener' && made.values.kind !== 'washer') {
      const size = FASTENER_SIZES[String(made.values.size)]; if (!size) return;
      // (A nut's bore is a hole in its sketch; a shank's circle has none.)
      for (let k = i - (made.nodes ?? 2) + 1; k <= i; k++) {
        const e = nodes[k], sk = e?.kind === 'extrude' ? nodes[e.sketch] : undefined;
        out.set(featureId(nodes, k), { d: size.d, pitch: size.pitch, radius: size.d / 2, internal: !!(sk?.kind === 'sketch' && sk.holes?.length) });
      }
    }
  });
  return out;
}

/** The rings (line segments) of the threads on a body's round faces. */
export function threadLines(threads: ReadonlyMap<string, FaceThread>, mesh: DisplayMesh, n = 32): number[] {
  const out: number[] = [];
  if (!threads.size) return out;
  for (const f of mesh.faces) {
    if (f.kind !== 'curved' || !f.radius) continue;
    const t = [...f.name.matchAll(/\b(n\d+)\./g)].map(m => threads.get(m[1])).find(x => x && (x.radius === undefined || Math.abs(x.radius - f.radius!) < 0.01 * x.radius + 1e-3));
    if (!t) continue;
    const ax = roundFaceAxis(mesh, f.index); if (!ax) continue;
    // Its extent along the axis, and which way it faces (out: external; in: a bore).
    let lo = Infinity, hi = -Infinity, inward = 0;
    const P = mesh.positions, N = mesh.normals, d = ax.dir;
    for (let v = 0; v < mesh.faceOfVertex.length; v++) {
      if (mesh.faceOfVertex[v] !== f.index) continue;
      const q = [P[3 * v] - ax.point[0], P[3 * v + 1] - ax.point[1], P[3 * v + 2] - ax.point[2]], s = q[0] * d[0] + q[1] * d[1] + q[2] * d[2];
      lo = Math.min(lo, s); hi = Math.max(hi, s);
      inward += (q[0] - d[0] * s) * N[3 * v] + (q[1] - d[1] * s) * N[3 * v + 1] + (q[2] - d[2] * s) * N[3 * v + 2];
    }
    const length = hi - lo; if (!(length > t.pitch)) continue;
    const r = f.radius * (inward < 0 ? 0.985 : 1.015), step = t.pitch * Math.max(1, Math.ceil(length / t.pitch / MOST));
    const e: Vec3 = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let u: Vec3 = [d[1] * e[2] - d[2] * e[1], d[2] * e[0] - d[0] * e[2], d[0] * e[1] - d[1] * e[0]];
    const ul = Math.hypot(...u); u = u.map(x => x / ul) as Vec3;
    const w: Vec3 = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    for (let s = lo + step / 2; s < hi; s += step) {
      const at = (j: number) => { const a = 2 * Math.PI * j / n; return [0, 1, 2].map(k => ax.point[k] + d[k] * s + (u[k] * Math.cos(a) + w[k] * Math.sin(a)) * r); };
      for (let j = 0; j < n; j++) out.push(...at(j), ...at(j + 1));
    }
  }
  return out;
}
