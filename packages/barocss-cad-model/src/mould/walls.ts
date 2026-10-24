// IM4 (O80): a moulded part's walls, ribs, bosses, inside corners and thick sections. The walls are the local thickness
// at each display triangle (chat/analysis.ts wallSamples: the inscribed sphere at the inward ray's middle, so a rim reads
// its wall, not the wall's length); the nominal wall their area-weighted median. Ribs are plates inside the part — two
// opposite exact planes, close, each facing more of the part (a ray out of either side hits the body; a box's own walls
// face out on one side). Bosses are an outer and an inner exact cylinder on one axis. Inside corners are concave
// fillets (exact cylinders around less than half a turn, facing their axis) and sharp concave edges between planes.
// Thick sections are where the local thickness passes the nominal over the adjacent-wall ratio.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { DisplayMesh, Vec3 } from '../engine/mesh';
import { wallSamples } from '../analysis/analysis';
import { faceTableOf } from '../assembly/faces';
import { rayHit, triangleBvh, type TriangleBvh } from '@barocss/cad';

export interface Rib { body: string; faces: [string, string]; thickness: number }
export interface Boss { outer: string; inner: string; wall: number }
export interface InsideCorner { face: string; radius: number }
export interface SharpCorner { body: string; faces: [string, string]; length: number }
export interface ThickSection { body: string; faces: string[]; area: number; max: number }
export interface WallReport {
  body: string; nominal: number | null; thinnestMM: number | null; thick95MM: number | null;
  ribs: Rib[]; bosses: Boss[]; fillets: InsideCorner[]; sharp: SharpCorner[]; thick: ThickSection | null;
}

const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const name = (m: DisplayMesh, f: number) => m.faces[f]?.name.split('+')[0] ?? '?';
/** The area-weighted q-quantile of the finite values. */
function quantile(v: Float64Array, w: Float64Array, q: number): number | null {
  const idx: number[] = []; for (let i = 0; i < v.length; i++) if (Number.isFinite(v[i]) && w[i] > 0) idx.push(i);
  if (!idx.length) return null;
  idx.sort((a, b) => v[a] - v[b]);
  const total = idx.reduce((s, i) => s + w[i], 0);
  let acc = 0; for (const i of idx) { acc += w[i]; if (acc >= q * total) return v[i]; }
  return v[idx[idx.length - 1]];
}
/** A face's vertex box (display mesh). */
function faceBox(m: DisplayMesh, f: number): { lo: Vec3; hi: Vec3 } {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.faceOfVertex.length; i++) if (m.faceOfVertex[i] === f) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.positions[3 * i + k]); hi[k] = Math.max(hi[k], m.positions[3 * i + k]); }
  return { lo, hi };
}
/** Whether a ray out of a face (from its largest triangle's centre, along its normal) hits the body. */
function facesInward(m: DisplayMesh, bvh: TriangleBvh, f: number, n: readonly number[]): boolean {
  let best = -1, A = 0;
  for (let t = 0; t < m.indices.length; t += 3) {
    if (m.faceOfVertex[m.indices[t]] !== f) continue;
    const p = [0, 1, 2].map(j => 3 * m.indices[t + j]), P = m.positions;
    const ux = P[p[1]] - P[p[0]], uy = P[p[1] + 1] - P[p[0] + 1], uz = P[p[1] + 2] - P[p[0] + 2], vx = P[p[2]] - P[p[0]], vy = P[p[2] + 1] - P[p[0] + 1], vz = P[p[2] + 2] - P[p[0] + 2];
    const a = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); if (a > A) { A = a; best = t; }
  }
  if (best < 0) return false;
  const c = [0, 1, 2].map(k => (m.positions[3 * m.indices[best] + k] + m.positions[3 * m.indices[best + 1] + k] + m.positions[3 * m.indices[best + 2] + k]) / 3 + 0.01 * n[k]);
  return rayHit(bvh, c, n) !== Infinity;
}

/** Whether two exact cylinders are one: the same radius and axis line. */
function sameAxis(x: { c: Vec3; a: Vec3; r: number }, y: { c: Vec3; a: Vec3; r: number }): boolean {
  const la = Math.hypot(y.a[0], y.a[1], y.a[2]), a = [y.a[0] / la, y.a[1] / la, y.a[2] / la], lb = Math.hypot(x.a[0], x.a[1], x.a[2]);
  if (Math.abs(x.r - y.r) > 1e-9 || Math.abs(Math.abs(dot(x.a, a)) / lb - 1) > 1e-9) return false;
  const d = [x.c[0] - y.c[0], x.c[1] - y.c[1], x.c[2] - y.c[2]], s = dot(d, a);
  return Math.hypot(d[0] - s * a[0], d[1] - s * a[1], d[2] - s * a[2]) <= 1e-9;
}
/** The centre of a face's triangle lying on the segment a–b (two of its vertices on it), or null. */
export function besideEdge(m: DisplayMesh, f: number, a: readonly number[], b: readonly number[]): number[] | null {
  const P = m.positions, dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L2 = dx * dx + dy * dy + dz * dz;
  for (let t = 0; t < m.indices.length; t += 3) {
    if (m.faceOfVertex[m.indices[t]] !== f) continue;
    let on = 0;
    for (let k = 0; k < 3; k++) {
      const i = 3 * m.indices[t + k], px = P[i] - a[0], py = P[i + 1] - a[1], pz = P[i + 2] - a[2], s = (px * dx + py * dy + pz * dz) / L2;
      if (s > -1e-6 && s < 1 + 1e-6 && Math.hypot(px - s * dx, py - s * dy, pz - s * dz) < 1e-4) on++;
    }
    if (on >= 2) return [0, 1, 2].map(k => (P[3 * m.indices[t] + k] + P[3 * m.indices[t + 1] + k] + P[3 * m.indices[t + 2] + k]) / 3);
  }
  return null;
}
/** Each body's walls, ribs, bosses, inside corners and thick sections; `ratio` the adjacent-wall ratio (thick past nominal/ratio). */
export function wallsOf(doc: StudioDoc, bodies: readonly BodyResult[], ratio: number): WallReport[] {
  const table = faceTableOf(doc), out: WallReport[] = [];
  // Bosses (the part's face table, exact): an outer cylinder with an inner one on its axis.
  const cyl = Object.entries(table).flatMap(([n, f]) => f.kind === 'cylinder' ? [{ n, f }] : []), bosses: Boss[] = [];
  for (const o of cyl) if (o.f.kind === 'cylinder' && o.f.outer) for (const i of cyl) {
    if (i.f.kind !== 'cylinder' || i.f.outer || !(i.f.radius < o.f.radius)) continue;
    const a = o.f.axis, b = i.f.axis, d = [i.f.point[0] - o.f.point[0], i.f.point[1] - o.f.point[1], i.f.point[2] - o.f.point[2]], s = dot(d, a);
    if (Math.abs(Math.abs(dot(a, b)) - 1) <= 1e-9 && Math.hypot(d[0] - s * a[0], d[1] - s * a[1], d[2] - s * a[2]) <= 1e-9) bosses.push({ outer: o.n, inner: i.n, wall: o.f.radius - i.f.radius });
  }
  for (const body of bodies) {
    const m = body.mesh, w = wallSamples(body), bvh = triangleBvh(m.positions, m.indices);
    // (The thinnest by the inward ray itself: the sphere reads less than the wall by a concave corner, where its middle is
    // nearer the next wall — fine for thick sections, which it only lowers, not for the thinnest.)
    const nominal = quantile(w.local, w.area, 0.5);
    let thin = Infinity; for (let t = 0; t < w.depth.length; t++) if (w.area[t] > 0 && w.depth[t] < thin) thin = w.depth[t];
    const thinnest = Number.isFinite(thin) ? thin : null;
    // Ribs: opposite exact planes, the nearer behind each, their boxes overlapping, both facing into the part.
    const planes = m.faces.flatMap(f => f.exact?.kind === 'plane' ? [{ f: f.index, o: f.exact.o, n: f.exact.n, box: faceBox(m, f.index) }] : []), ribs: Rib[] = [], seen = new Set<string>();
    for (const A of planes) {
      let best: { B: (typeof planes)[number]; s: number } | null = null;
      for (const B of planes) {
        if (B === A || dot(A.n, B.n) > -1 + 1e-9) continue;
        const s = dot([A.o[0] - B.o[0], A.o[1] - B.o[1], A.o[2] - B.o[2]], A.n);
        if (!(s > 1e-6) || (nominal !== null && s > 3 * nominal)) continue;
        // (Their boxes overlap across the normal: the plate's two sides face each other.)
        const overlap = [0, 1, 2].every(k => Math.abs(A.n[k]) > 0.5 || Math.min(A.box.hi[k], B.box.hi[k]) - Math.max(A.box.lo[k], B.box.lo[k]) > 1e-6);
        if (overlap && (!best || s < best.s)) best = { B, s };
      }
      if (!best) continue;
      const key = [A.f, best.B.f].sort((x, y) => x - y).join(',');
      if (seen.has(key)) continue; seen.add(key);
      if (facesInward(m, bvh, A.f, A.n) && facesInward(m, bvh, best.B.f, best.B.n)) ribs.push({ body: body.key, faces: [name(m, A.f), name(m, best.B.f)].sort() as [string, string], thickness: best.s });
    }
    // Inside corners: concave fillets (exact cylinders facing their axis, around less than half a turn) and sharp concave edges.
    const fillets: InsideCorner[] = [], doneNames = new Set<number>();
    for (const f of m.faces) {
      // (A face the kernel split shows as several display faces of one name: its span is all of them.)
      // (One name can hold several cylinders — a pocket's four corner fillets are one feature: grouped by name and axis.)
      const e = f.exact; if (e?.kind !== 'cylinder' || doneNames.has(f.index) || !(f.name in table) || (table[f.name] as { outer?: boolean }).outer !== false) continue;
      const same = m.faces.filter(x => x.name === f.name && x.exact?.kind === 'cylinder' && sameAxis(x.exact, e));
      for (const x of same) doneNames.add(x.index);
      const mine = new Set(same.map(x => x.index));
      const l = Math.hypot(e.a[0], e.a[1], e.a[2]), a = [e.a[0] / l, e.a[1] / l, e.a[2] / l], u = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], k0 = dot(u, a), U = [u[0] - k0 * a[0], u[1] - k0 * a[1], u[2] - k0 * a[2]], Ul = Math.hypot(U[0], U[1], U[2]), X = U.map(x => x / Ul), Y = [a[1] * X[2] - a[2] * X[1], a[2] * X[0] - a[0] * X[2], a[0] * X[1] - a[1] * X[0]];
      const angles: number[] = [];
      for (let i = 0; i < m.faceOfVertex.length; i++) if (mine.has(m.faceOfVertex[i])) { const p = [m.positions[3 * i] - e.c[0], m.positions[3 * i + 1] - e.c[1], m.positions[3 * i + 2] - e.c[2]]; angles.push(Math.atan2(dot(p, Y), dot(p, X))); }
      angles.sort((x, y) => x - y);
      // (Its span: the full turn less the largest gap between neighbouring angles.)
      let gap = angles.length ? angles[0] + 2 * Math.PI - angles[angles.length - 1] : 2 * Math.PI;
      for (let i = 1; i < angles.length; i++) gap = Math.max(gap, angles[i] - angles[i - 1]);
      if (2 * Math.PI - gap < Math.PI - 1e-6) fillets.push({ face: f.name.split('+')[0], radius: e.r });
    }
    const sharp: SharpCorner[] = [];
    for (const e of m.edges) {
      if (!e.straight) continue;
      const F1 = m.faces[e.faces[0]], F2 = m.faces[e.faces[1]];
      if (F1?.exact?.kind !== 'plane' || F2?.exact?.kind !== 'plane') continue;
      const n1 = F1.exact.n, n2 = F2.exact.n; if (Math.abs(dot(n1, n2)) > 1 - 1e-9) continue;
      // (Concave: the second face, just off the edge — its triangle on the edge, not its centre, which an annulus has in
      // its hole — lies on the first face's outer side.)
      const mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2, (e.a[2] + e.b[2]) / 2], dir = [e.b[0] - e.a[0], e.b[1] - e.a[1], e.b[2] - e.a[2]], L = Math.hypot(dir[0], dir[1], dir[2]);
      const c2 = besideEdge(m, e.faces[1], e.a, e.b); if (!c2) continue;
      const v = [c2[0] - mid[0], c2[1] - mid[1], c2[2] - mid[2]], along = dot(v, dir) / (L * L), vp = [v[0] - along * dir[0], v[1] - along * dir[1], v[2] - along * dir[2]];
      if (dot(vp, n1) > 1e-6) {
        // (One corner a pair of faces: an edge the mesh splits in pieces is summed.)
        const faces = [name(m, e.faces[0]), name(m, e.faces[1])].sort() as [string, string], have = sharp.find(x => x.faces[0] === faces[0] && x.faces[1] === faces[1]);
        if (have) have.length += L; else sharp.push({ body: body.key, faces, length: L });
      }
    }
    // Thick sections: local thickness past the nominal over the ratio.
    let thick: ThickSection | null = null;
    if (nominal !== null) {
      const limit = nominal / ratio, faces = new Set<string>(); let A = 0, max = 0;
      for (let t = 0; t < w.local.length; t++) if (w.area[t] > 0 && w.local[t] > limit + 1e-9) { A += w.area[t]; max = Math.max(max, w.local[t]); faces.add(name(m, w.face[t])); }
      if (A > 0) thick = { body: body.key, faces: [...faces].sort(), area: A, max: max };
    }
    out.push({ body: body.key, nominal: nominal, thinnestMM: thinnest, thick95MM: quantile(w.local, w.area, 0.95), ribs, bosses: out.length ? [] : bosses, fillets, sharp, thick });
  }
  return out;
}
