// A 3D convex hull (RM4, O17): quickhull, our own. The collision geometry a URDF gives each link is its part's convex
// hull, as onshape-to-robot and simulators take it. Faces keep their outside points; each round the farthest point of
// one face sees a cap of faces, which is replaced by a fan from the cap's horizon to the point. Points within `eps` of
// the hull (a scale-relative tolerance) are inside. Flat or line-like input has no hull: refused, typed.

export class HullError extends Error { constructor(readonly code: 'TOO_FEW' | 'DEGENERATE', message: string) { super(message); this.name = 'HullError'; } }
export interface Hull { /** The hull's corners, x, y, z each. */ positions: Float64Array; /** Triangles into `positions`, counter-clockwise from outside. */ indices: Uint32Array }

interface Face { a: number; b: number; c: number; nx: number; ny: number; nz: number; d: number; outside: number[]; alive: boolean }
let P: Float64Array = new Float64Array(0);
const faceOf = (a: number, b: number, c: number): Face => {
  const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  return { a, b, c, nx, ny, nz, d: nx * P[a * 3] + ny * P[a * 3 + 1] + nz * P[a * 3 + 2], outside: [], alive: true };
};
const dist = (f: Face, i: number) => f.nx * P[i * 3] + f.ny * P[i * 3 + 1] + f.nz * P[i * 3 + 2] - f.d;
const edgeKey = (u: number, v: number) => u * 0x100000000 + v;

/** The convex hull of points (x, y, z each). Throws HullError for fewer than 4 points or flat input. */
export function convexHull(points: ArrayLike<number>): Hull {
  P = Float64Array.from(points);
  const n = P.length / 3;
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
  const base = faceOf(i0, i1, i2);
  let i3 = -1; best = eps;
  for (let i = 0; i < n; i++) { const h = Math.abs(dist(base, i)); if (h > best) { best = h; i3 = i; } }
  if (i3 < 0) throw new HullError('DEGENERATE', 'the points lie in one plane (no volume)');
  const faces: Face[] = [], edges = new Map<number, number>();
  const add = (a: number, b: number, c: number) => { const f = faceOf(a, b, c); faces.push(f); edges.set(edgeKey(a, b), faces.length - 1); edges.set(edgeKey(b, c), faces.length - 1); edges.set(edgeKey(c, a), faces.length - 1); return faces.length - 1; };
  // (Oriented so the fourth point is behind the base.)
  const [a, b, c] = dist(base, i3) > 0 ? [i0, i2, i1] : [i0, i1, i2];
  const first = [add(a, b, c), add(a, i3, b), add(b, i3, c), add(c, i3, a)];
  for (let i = 0; i < n; i++) {
    if (i === i0 || i === i1 || i === i2 || i === i3) continue;
    assign(faces, first, i, eps);
  }
  // Each round: a face with outside points, its farthest; the faces it sees; the horizon; the fan.
  const visible: number[] = [], stack: number[] = [], horizon: [number, number][] = [], orphans: number[] = [];
  for (let guard = 0; guard < 4 * n + 16; guard++) {
    let fi = -1;
    for (let k = 0; k < faces.length; k++) if (faces[k].alive && faces[k].outside.length) { fi = k; break; }
    if (fi < 0) break;
    const f0 = faces[fi];
    let eye = f0.outside[0], far = dist(f0, eye);
    for (const i of f0.outside) { const h = dist(f0, i); if (h > far) { far = h; eye = i; } }
    visible.length = 0; stack.length = 0; horizon.length = 0; orphans.length = 0;
    // (The faces the point sees, grown across edges from the first; the horizon: their edges to faces it does not.)
    const seen = new Set<number>([fi]); stack.push(fi);
    while (stack.length) {
      const k = stack.pop()!, f = faces[k]; visible.push(k);
      for (let e = 0; e < 3; e++) {
        const u = e === 0 ? f.a : e === 1 ? f.b : f.c, v = e === 0 ? f.b : e === 1 ? f.c : f.a, nb = edges.get(edgeKey(v, u))!;
        if (!seen.has(nb) && dist(faces[nb], eye) > eps) { seen.add(nb); stack.push(nb); }
      }
    }
    for (const k of visible) {
      const f = faces[k];
      for (let e = 0; e < 3; e++) {
        const u = e === 0 ? f.a : e === 1 ? f.b : f.c, v = e === 0 ? f.b : e === 1 ? f.c : f.a;
        if (!seen.has(edges.get(edgeKey(v, u))!)) horizon.push([u, v]);
      }
    }
    for (const k of visible) { const f = faces[k]; f.alive = false; for (const i of f.outside) if (i !== eye) orphans.push(i); f.outside = []; edges.delete(edgeKey(f.a, f.b)); edges.delete(edgeKey(f.b, f.c)); edges.delete(edgeKey(f.c, f.a)); }
    const fresh: number[] = [];
    for (const [u, v] of horizon) fresh.push(add(u, v, eye));
    for (const i of orphans) assign(faces, fresh, i, eps);
  }
  // The live faces, their corners renumbered.
  const map = new Map<number, number>(), pos: number[] = [], idx: number[] = [];
  for (const f of faces) if (f.alive) for (const v of [f.a, f.b, f.c]) { let m = map.get(v); if (m === undefined) { m = map.size; map.set(v, m); pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); } idx.push(m); }
  return { positions: Float64Array.from(pos), indices: Uint32Array.from(idx) };
}
/** A point to the first of `candidates` it is in front of (beyond eps); else it is inside and dropped. */
function assign(faces: Face[], candidates: readonly number[], i: number, eps: number): void {
  for (const k of candidates) if (dist(faces[k], i) > eps) { faces[k].outside.push(i); return; }
}
