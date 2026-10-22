// K1 (D140): a 3D convex hull — quickhull, our own; moved down from the studio's robot track (RM4, O17), where a URDF's
// collision geometry is each link's convex hull. Faces keep their outside points; each round the farthest point of one
// face sees a cap of faces, which is replaced by a fan from the cap's horizon to the point. Points within `eps` of the
// hull (a scale-relative tolerance) are inside. Flat or line-like input has no hull: refused, typed.

export type HullErrorCode = 'TOO_FEW' | 'DEGENERATE';
export class HullError extends Error { constructor(readonly code: HullErrorCode, message: string) { super(message); this.name = 'HullError'; } }
export interface ConvexHull { /** The hull's corners, x, y, z each. */ readonly positions: Float64Array; /** Triangles into `positions`, counter-clockwise from outside. */ readonly indices: Uint32Array }

interface Face { a: number; b: number; c: number; nx: number; ny: number; nz: number; d: number; outside: number[]; alive: boolean }
/** One hull's working state: the points, the faces, and each directed edge's face. */
interface Work { readonly P: Float64Array; readonly eps: number; readonly faces: Face[]; readonly edges: Map<number, number> }

function faceOf(P: Float64Array, a: number, b: number, c: number): Face {
  const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  return { a, b, c, nx, ny, nz, d: nx * P[a * 3] + ny * P[a * 3 + 1] + nz * P[a * 3 + 2], outside: [], alive: true };
}
const dist = (P: Float64Array, f: Face, i: number) => f.nx * P[i * 3] + f.ny * P[i * 3 + 1] + f.nz * P[i * 3 + 2] - f.d;
const edgeKey = (u: number, v: number) => u * 0x100000000 + v;
function addFace(w: Work, a: number, b: number, c: number): number {
  const k = w.faces.length;
  w.faces.push(faceOf(w.P, a, b, c));
  w.edges.set(edgeKey(a, b), k); w.edges.set(edgeKey(b, c), k); w.edges.set(edgeKey(c, a), k);
  return k;
}
/** A point to the first of `candidates` it is in front of (beyond eps); else it is inside and dropped. */
function assign(w: Work, candidates: readonly number[], i: number): void {
  for (const k of candidates) {
    const f = w.faces[k];
    if (dist(w.P, f, i) > w.eps) { f.outside.push(i); return; }
  }
}
const corner = (f: Face, e: number) => e === 0 ? f.a : e === 1 ? f.b : f.c;

/** The convex hull of points (x, y, z each). Throws HullError for fewer than 4 points or flat input. */
export function convexHull(points: ArrayLike<number>): ConvexHull {
  const P = Float64Array.from(points), n = P.length / 3;
  if (n < 4) throw new HullError('TOO_FEW', `${n} points have no hull`);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < P.length; i++) { if (P[i] < lo) lo = P[i]; if (P[i] > hi) hi = P[i]; }
  const eps = 1e-10 * Math.max(1, hi - lo, Math.abs(lo), Math.abs(hi));
  // The first tetrahedron: the farthest pair, the point farthest from their line, the one farthest from their plane.
  let i0 = 0, i1 = 0;
  for (let i = 0; i < n; i++) { if (P[i * 3] < P[i0 * 3]) i0 = i; if (P[i * 3] > P[i1 * 3]) i1 = i; }
  if (i0 === i1) for (let k = 1; k < 3 && i0 === i1; k++) for (let i = 0; i < n; i++) { if (P[i * 3 + k] < P[i0 * 3 + k]) i0 = i; if (P[i * 3 + k] > P[i1 * 3 + k]) i1 = i; }
  const dx = P[i1 * 3] - P[i0 * 3], dy = P[i1 * 3 + 1] - P[i0 * 3 + 1], dz = P[i1 * 3 + 2] - P[i0 * 3 + 2], dl = Math.hypot(dx, dy, dz);
  if (!(dl > eps)) throw new HullError('DEGENERATE', 'the points are all one point');
  let i2 = -1, best = eps;
  for (let i = 0; i < n; i++) {
    const wx = P[i * 3] - P[i0 * 3], wy = P[i * 3 + 1] - P[i0 * 3 + 1], wz = P[i * 3 + 2] - P[i0 * 3 + 2];
    const cx = wy * dz - wz * dy, cy = wz * dx - wx * dz, cz = wx * dy - wy * dx, h = Math.hypot(cx, cy, cz) / dl;
    if (h > best) { best = h; i2 = i; }
  }
  if (i2 < 0) throw new HullError('DEGENERATE', 'the points lie on one line');
  const base = faceOf(P, i0, i1, i2);
  let i3 = -1; best = eps;
  for (let i = 0; i < n; i++) { const h = Math.abs(dist(P, base, i)); if (h > best) { best = h; i3 = i; } }
  if (i3 < 0) throw new HullError('DEGENERATE', 'the points lie in one plane (no volume)');
  const w: Work = { P, eps, faces: [], edges: new Map() };
  // (Oriented so the fourth point is behind the base.)
  const [a, b, c] = dist(P, base, i3) > 0 ? [i0, i2, i1] : [i0, i1, i2];
  const first = [addFace(w, a, b, c), addFace(w, a, i3, b), addFace(w, b, i3, c), addFace(w, c, i3, a)];
  for (let i = 0; i < n; i++) if (i !== i0 && i !== i1 && i !== i2 && i !== i3) assign(w, first, i);
  // Each round: the first face with outside points, its farthest; the faces it sees; the horizon; the fan. Points are
  // only ever given to the newest faces, so the first such face never moves back: one cursor finds it (the faces'
  // order, and so the output's, as the studio's RM4 hull made it).
  const visible: number[] = [], stack: number[] = [], horizon: number[] = [], orphans: number[] = [], fresh: number[] = [], seen = new Set<number>();
  let cursor = 0;
  for (let guard = 0; guard < 4 * n + 16; guard++) {
    while (cursor < w.faces.length && !(w.faces[cursor].alive && w.faces[cursor].outside.length)) cursor++;
    if (cursor === w.faces.length) break;
    const fi = cursor, f0 = w.faces[fi];
    let eye = f0.outside[0], far = dist(P, f0, eye);
    for (const i of f0.outside) { const h = dist(P, f0, i); if (h > far) { far = h; eye = i; } }
    visible.length = 0; stack.length = 0; horizon.length = 0; orphans.length = 0; fresh.length = 0; seen.clear();
    // (The faces the point sees, grown across edges from the first; the horizon: their edges to faces it does not.)
    seen.add(fi); stack.push(fi);
    while (stack.length) {
      const k = stack.pop()!, f = w.faces[k]; visible.push(k);
      for (let e = 0; e < 3; e++) {
        const u = corner(f, e), v = corner(f, (e + 1) % 3), nb = w.edges.get(edgeKey(v, u))!;
        if (!seen.has(nb) && dist(P, w.faces[nb], eye) > eps) { seen.add(nb); stack.push(nb); }
      }
    }
    for (const k of visible) {
      const f = w.faces[k];
      for (let e = 0; e < 3; e++) { const u = corner(f, e), v = corner(f, (e + 1) % 3); if (!seen.has(w.edges.get(edgeKey(v, u))!)) horizon.push(u, v); }
    }
    for (const k of visible) { const f = w.faces[k]; f.alive = false; for (const i of f.outside) if (i !== eye) orphans.push(i); f.outside = []; w.edges.delete(edgeKey(f.a, f.b)); w.edges.delete(edgeKey(f.b, f.c)); w.edges.delete(edgeKey(f.c, f.a)); }
    for (let h = 0; h < horizon.length; h += 2) fresh.push(addFace(w, horizon[h], horizon[h + 1], eye));
    for (const i of orphans) assign(w, fresh, i);
  }
  // The live faces, their corners renumbered.
  const map = new Map<number, number>(), pos: number[] = [], idx: number[] = [];
  for (const f of w.faces) if (f.alive) for (let e = 0; e < 3; e++) { const v = corner(f, e); let m = map.get(v); if (m === undefined) { m = map.size; map.set(v, m); pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); } idx.push(m); }
  return { positions: Float64Array.from(pos), indices: Uint32Array.from(idx) };
}
