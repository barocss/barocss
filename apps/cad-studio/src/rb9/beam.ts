// A beam's section as the kernel cuts it (O70 rung 6, O73): the body split across x, the cut face's boundary taken from
// its B-rep edges (exact endpoints, double precision), chained into loops, and its area, centroid and second moments by
// Green's theorem on those loops — no handbook section table. Straight edges only: a curved boundary is refused (the
// beam rung's sections are polygons; a curved one would need its arcs' exact moments).
import { withNode, type StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { bodyKeyFor } from '../engine/ids';
import { refOf } from '../app/bodyRef';
import type { Evaluate } from './core';

/** A section across x in the (y, z) plane: second moments about its own centroid; c the farthest fibre in z. */
export interface BeamSection { area: number; cy: number; cz: number; /** ∫(z − cz)² dA */ Iy: number; /** ∫(y − cy)² dA */ Iz: number; c: number; depth: number; loops: number }
const TOL = 1e-7;

/** The edges' endpoints chained into closed loops (each a list of (y, z) points); null when they do not close. */
function loopsOf(segs: readonly [number, number, number, number][]): [number, number][][] | null {
  const left = segs.slice(), out: [number, number][][] = [];
  while (left.length) {
    const [y0, z0, y1, z1] = left.pop()!, loop: [number, number][] = [[y0, z0]];
    let ey = y1, ez = z1;
    while (Math.abs(ey - y0) > TOL || Math.abs(ez - z0) > TOL) {
      loop.push([ey, ez]);
      const k = left.findIndex(s => (Math.abs(s[0] - ey) <= TOL && Math.abs(s[1] - ez) <= TOL) || (Math.abs(s[2] - ey) <= TOL && Math.abs(s[3] - ez) <= TOL));
      if (k < 0) return null;
      const s = left.splice(k, 1)[0], fwd = Math.abs(s[0] - ey) <= TOL && Math.abs(s[1] - ez) <= TOL;
      ey = fwd ? s[2] : s[0]; ez = fwd ? s[3] : s[1];
    }
    out.push(loop);
  }
  return out;
}
/** Green's theorem on one loop: [A, ∫y dA, ∫z dA, ∫z² dA, ∫y² dA], signed by its orientation. */
function green(loop: readonly [number, number][]): [number, number, number, number, number] {
  let A = 0, Sy = 0, Sz = 0, Izz = 0, Iyy = 0;
  for (let i = 0; i < loop.length; i++) {
    const [u0, v0] = loop[i], [u1, v1] = loop[(i + 1) % loop.length], x = u0 * v1 - u1 * v0;
    A += x / 2; Sy += (u0 + u1) * x / 6; Sz += (v0 + v1) * x / 6; Izz += (v0 * v0 + v0 * v1 + v1 * v1) * x / 12; Iyy += (u0 * u0 + u0 * u1 + u1 * u1) * x / 12;
  }
  return [A, Sy, Sz, Izz, Iyy];
}
function inside(p: readonly [number, number], loop: readonly [number, number][]): boolean {
  let n = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) { const [yi, zi] = loop[i], [yj, zj] = loop[j]; if ((zi > p[1]) !== (zj > p[1]) && p[0] < (yj - yi) * (p[1] - zi) / (zj - zi) + yi) n = !n; }
  return n;
}

/** The section of `body` across x = at, by the kernel's split; or why not. */
export async function beamSection(doc: StudioDoc, body: BodyResult, evaluate: Evaluate, at: number): Promise<BeamSection | string> {
  if (!body.ref) return 'the body has no feature to split';
  const probe = withNode(doc, { kind: 'split', parent: refOf(body), axis: 'x', at }), node = probe.nodes.length - 1, id = probe.nodes[node].id;
  const r = await evaluate(probe); if (!r.ok) return 'the section could not be cut';
  const half = r.bodies.find(b => b.key === bodyKeyFor(probe.nodes, node, 'negative')); if (!half) return `x = ${at} does not cut the body`;
  const cut = new Set(half.mesh.faces.filter(f => f.name.split('+').some(n => n.startsWith(`${id}.cut`))).map(f => f.index));
  const edges = half.mesh.edges.filter(e => cut.has(e.faces[0]) !== cut.has(e.faces[1]));
  if (!edges.length) return `x = ${at} cuts no face`;
  if (edges.some(e => !e.straight)) return 'the section has a curved boundary (polygons only)';
  const loops = loopsOf(edges.map(e => [e.a[1], e.a[2], e.b[1], e.b[2]] as [number, number, number, number])); if (!loops) return 'the section\'s boundary does not close';
  // (Each loop counted outward: positive, or negative inside an odd number of others — a hole.)
  const sum = [0, 0, 0, 0, 0];
  for (const l of loops) {
    const g = green(l), hole = loops.filter(o => o !== l && inside(l[0], o)).length % 2 === 1, s = (g[0] < 0 ? -1 : 1) * (hole ? -1 : 1);
    for (let k = 0; k < 5; k++) sum[k] += s * g[k];
  }
  const [A, Sy, Sz, Izz, Iyy] = sum, cy = Sy / A, cz = Sz / A;
  let c = 0, lo = Infinity, hi = -Infinity;
  for (const l of loops) for (const [, z] of l) { c = Math.max(c, Math.abs(z - cz)); lo = Math.min(lo, z); hi = Math.max(hi, z); }
  return { area: A, cy, cz, Iy: Izz - A * cz * cz, Iz: Iyy - A * cy * cy, c, depth: hi - lo, loops: loops.length };
}
