// IM5 (O81): the parting line, where the mould's two halves meet. Each face goes to a half by its draft field (IM2,
// exact normals): + (it releases along the pull: the half that moves along it), − (against it); a wall along the pull
// (n·d 0 throughout) goes where the person says, else to −; any face where the person says. The line runs along every
// edge between the halves — each display edge segment judged at its middle, a straddling face's side there by its
// exact normal — and across every straddling face along its isocline n·d = 0, traced by marching its triangles (each
// mesh edge's crossing bisected on the exact normal). Its pieces are chained into loops. A straddling face would need
// splitting along that isocline to mould as two halves: a face split by a curve, a kernel operation not built — said,
// not done; the person can instead put the whole face in one half.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';
import { draftField, exactNormals } from './draft';

export type Half = '+' | '-';
export interface PartingLoop { body: string; points: Vec3[]; closed: boolean; lengthMM: number; /** Its extent along the pull: flat when 0 (to the mesh's single precision). */ rangeMM: [number, number]; flat: boolean }
export interface PartingReport {
  pull: Vec3;
  faces: { body: string; face: string; half: Half | 'split'; basis: 'draft' | 'override' | 'wall default' | 'straddle' }[];
  /** Straddling faces the line crosses: their isocline's length (to split them along, kernel lane). */
  split: { body: string; face: string; isoclineMM: number }[];
  loops: PartingLoop[];
}
type Seg = [number, number, number, number, number, number];
const SIGN = 1e-12, FLAT = 1e-4;
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The isocline's crossing on a mesh edge a–b, by bisection on the face's exact normal (sa: n·d's sign at a). */
function crossing(normal: (p: readonly number[]) => Vec3, a: readonly number[], b: readonly number[], d: Vec3, sa: number): Vec3 {
  let lo = 0, hi = 1;
  const p = [0, 0, 0];
  for (let it = 0; it < 60; it++) {
    const t = (lo + hi) / 2; p[0] = a[0] + t * (b[0] - a[0]); p[1] = a[1] + t * (b[1] - a[1]); p[2] = a[2] + t * (b[2] - a[2]);
    if ((dot(normal(p), d) >= 0 ? 1 : -1) === sa) lo = t; else hi = t;
  }
  const t = (lo + hi) / 2;
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
}
/** The isocline segments across a straddling face: marching its triangles (n·d ≥ 0 counted +). */
function isoclineSegments(m: DisplayMesh, f: number, normal: (p: readonly number[]) => Vec3, d: Vec3): Seg[] {
  const P = m.positions, I = m.indices, sign = new Map<number, number>(), cut = new Map<string, Vec3>(), out: Seg[] = [];
  const at = (i: number) => [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
  const sOf = (i: number) => { let s = sign.get(i); if (s === undefined) { s = dot(normal(at(i)), d) >= 0 ? 1 : -1; sign.set(i, s); } return s; };
  for (let t = 0; t < I.length; t += 3) {
    if (m.faceOfVertex[I[t]] !== f) continue;
    const pts: Vec3[] = [];
    for (let k = 0; k < 3; k++) {
      const i = I[t + k], j = I[t + (k + 1) % 3], si = sOf(i), sj = sOf(j); if (si === sj) continue;
      // (By position, not index: the display mesh repeats a vertex per face; two triangles share the crossing exactly.)
      const key = [at(i), at(j)].map(p => p.map(v => v.toFixed(6)).join(',')).sort().join('|');
      let c = cut.get(key); if (!c) { c = crossing(normal, at(i), at(j), d, si); cut.set(key, c); }
      pts.push(c);
    }
    if (pts.length === 2) out.push([pts[0][0], pts[0][1], pts[0][2], pts[1][0], pts[1][1], pts[1][2]]);
  }
  return out;
}
/** Segments chained into polylines, each end joined to the nearest free end within `tol`. */
function chain(segs: readonly Seg[], tol: number): { pts: Vec3[]; closed: boolean }[] {
  const used = new Uint8Array(segs.length), out: { pts: Vec3[]; closed: boolean }[] = [];
  const end = (s: Seg, k: 0 | 1): Vec3 => k ? [s[3], s[4], s[5]] : [s[0], s[1], s[2]];
  for (let start = 0; start < segs.length; start++) {
    if (used[start]) continue;
    used[start] = 1;
    const pts: Vec3[] = [end(segs[start], 0), end(segs[start], 1)];
    for (const grow of [1, 0] as const) {
      for (;;) {
        const tip = grow ? pts[pts.length - 1] : pts[0];
        let best = -1, bk: 0 | 1 = 0, bd = tol;
        for (let i = 0; i < segs.length; i++) {
          if (used[i]) continue;
          for (const k of [0, 1] as const) { const e = end(segs[i], k), dd = Math.hypot(e[0] - tip[0], e[1] - tip[1], e[2] - tip[2]); if (dd <= bd) { bd = dd; best = i; bk = k; } }
        }
        if (best < 0) break;
        used[best] = 1;
        const far = end(segs[best], bk === 0 ? 1 : 0);
        if (grow) pts.push(far); else pts.unshift(far);
      }
    }
    const a = pts[0], z = pts[pts.length - 1];
    out.push({ pts, closed: pts.length > 2 && Math.hypot(a[0] - z[0], a[1] - z[1], a[2] - z[2]) <= tol });
  }
  return out;
}

/** The parting line of each body against the pull, with the person's halves (`sides`: face name → + or −) first. */
export function partingLine(doc: StudioDoc, bodies: readonly BodyResult[], pull: readonly number[], sides: Readonly<Record<string, Half>> = {}): PartingReport {
  const field = draftField(doc, bodies, pull, 0), d = field.pull, faces: PartingReport['faces'] = [], split: PartingReport['split'] = [], loops: PartingLoop[] = [];
  for (const body of bodies) {
    const m = body.mesh, normal = exactNormals(doc, body), half = new Map<number, Half | 'split'>();
    for (const df of m.faces) {
      const f = field.faces.find(x => x.body === body.key && x.face === df.name.split('+')[0]); if (!f) continue;
      const own = sides[f.face];
      const h: Half | 'split' = own ?? (f.side === '+' ? '+' : f.side === '-' ? '-' : f.side === '0' ? '-' : 'split');
      half.set(df.index, h);
      if (!faces.some(x => x.body === body.key && x.face === f.face)) faces.push({ body: body.key, face: f.face, half: h, basis: own ? 'override' : f.side === '0' ? 'wall default' : f.side === '±' ? 'straddle' : 'draft' });
    }
    // The edges between the halves: each segment at its middle (a straddling face's half there by its exact normal).
    const segs: Seg[] = [], L = m.edgeLines, E = m.edgeOfSegment;
    let longest = 0;
    for (let k = 0; 6 * k < L.length; k++) {
      const e = m.edges[E[2 * k]]; if (!e) continue;
      const mid = [(L[6 * k] + L[6 * k + 3]) / 2, (L[6 * k + 1] + L[6 * k + 4]) / 2, (L[6 * k + 2] + L[6 * k + 5]) / 2];
      const sideAt = (f: number): Half | null => { const h = half.get(f); if (h !== 'split') return h ?? null; const s = dot(normal(f, mid), d); return s > SIGN ? '+' : s < -SIGN ? '-' : null; };
      const a = sideAt(e.faces[0]), b = sideAt(e.faces[1]);
      longest = Math.max(longest, Math.hypot(L[6 * k + 3] - L[6 * k], L[6 * k + 4] - L[6 * k + 1], L[6 * k + 5] - L[6 * k + 2]));
      if (a && b && a !== b) segs.push([L[6 * k], L[6 * k + 1], L[6 * k + 2], L[6 * k + 3], L[6 * k + 4], L[6 * k + 5]]);
    }
    // Across each straddling face, its isocline.
    for (const df of m.faces) {
      if (half.get(df.index) !== 'split') continue;
      const iso = isoclineSegments(m, df.index, p => normal(df.index, p), d);
      let len = 0; for (const s of iso) { len += Math.hypot(s[3] - s[0], s[4] - s[1], s[5] - s[2]); longest = Math.max(longest, Math.hypot(s[3] - s[0], s[4] - s[1], s[5] - s[2])); }
      const name = df.name.split('+')[0], have = split.find(x => x.body === body.key && x.face === name);
      if (have) have.isoclineMM += len; else split.push({ body: body.key, face: name, isoclineMM: len });
      segs.push(...iso);
    }
    // (A crossing on a face's rim meets its edge's segments within a segment: joined within half the longest piece.)
    for (const c of chain(segs, Math.max(1e-6, longest / 2))) {
      let len = 0, lo = Infinity, hi = -Infinity;
      for (let i = 0; i < c.pts.length; i++) { const h = dot(c.pts[i], d); lo = Math.min(lo, h); hi = Math.max(hi, h); if (i) len += Math.hypot(c.pts[i][0] - c.pts[i - 1][0], c.pts[i][1] - c.pts[i - 1][1], c.pts[i][2] - c.pts[i - 1][2]); }
      if (c.closed) len += Math.hypot(c.pts[0][0] - c.pts[c.pts.length - 1][0], c.pts[0][1] - c.pts[c.pts.length - 1][1], c.pts[0][2] - c.pts[c.pts.length - 1][2]);
      loops.push({ body: body.key, points: c.pts, closed: c.closed, lengthMM: len, rangeMM: [lo, hi], flat: hi - lo <= FLAT });
    }
  }
  return { pull: d, faces, split, loops };
}
