// IM3 (O79): undercuts by ±d visibility. A mould opens along the pull d: the half moving along +d frees what it sees
// along +d, the other half what it sees along −d. Each triangle of a body's display mesh is split into n² equal
// sub-triangles (n from its longest edge and the sampling step, at most 64 a side), and each sub-triangle's centre is
// moved 0.01 mm off the triangle along its normal (into the open side: a point on a face's rim lies on its neighbour
// too, and its ray grazes it — IM S0); a ray is cast from it along +d and along −d through the studio's triangle BVH
// (AM4). A sample hidden both ways is an undercut, its share of its triangle's area with it — a big flat face under a
// small overhang is caught, not only its centre. Triangles with hidden samples joined at shared positions are one
// region; for each, the directions across the pull (the two axes across d, both ways) are tried as a side action's:
// the one that frees all its hidden samples, else the one that frees the most, said. Rays on the display mesh: a
// surface sampled to its chord error, and to the step.
import type { BodyResult } from '../engine/evaluate';
import type { Vec3 } from '../engine/mesh';
import { rayHit, triangleBvh, type TriangleBvh } from '@barocss/cad';

export interface UndercutRegion {
  body: string; faces: string[]; areaMM2: number; centroid: Vec3; triangles: number;
  /** The side action across the pull that frees all of it (null: none does), and the best one tried with the share it frees. */
  sideAction: Vec3 | null; best: { direction: Vec3; clearShare: number };
}
/** `coarsestMM`: the largest spacing used — the step where triangles allowed it, more on the largest (n capped): an undercut under it may be missed. */
export interface UndercutReport { pull: Vec3; regions: UndercutRegion[]; samples: number; stepMM: number; coarsestMM: number; method: string }
const OFF = 0.01, MAX_N = 64;

const unit = (v: readonly number[]): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
/** Two unit vectors across d: an axis's where d is along an axis (so ±X, ±Y for a pull along Z). */
function across(d: Vec3): [Vec3, Vec3] {
  const a: Vec3 = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], k = a[0] * d[0] + a[1] * d[1] + a[2] * d[2], u = unit([a[0] - k * d[0], a[1] - k * d[1], a[2] - k * d[2]]);
  return [u, [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]];
}
/** Whether the ray from p along dir leaves the mesh (no hit). */
function clear(bvh: TriangleBvh, p: ArrayLike<number>, k: number, dir: readonly number[]): boolean {
  o[0] = p[k]; o[1] = p[k + 1]; o[2] = p[k + 2];
  return rayHit(bvh, o, dir) === Infinity;
}
const o = [0, 0, 0];
/** Union–find root. */
function root(parent: Int32Array, x: number): number { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }

/**
 * Each body's undercuts against the pull d; `stepMM` the sampling step on the surface (default: the part's diagonal
 * over 400, at least 0.05 mm).
 */
export function undercuts(bodies: readonly BodyResult[], pull: readonly number[], stepMM?: number): UndercutReport {
  const d = unit(pull), back: Vec3 = [-d[0], -d[1], -d[2]], [u, v] = across(d), sides: Vec3[] = [u, [-u[0], -u[1], -u[2]], v, [-v[0], -v[1], -v[2]]];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of bodies) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], b.mesh.bounds.min[k]); hi[k] = Math.max(hi[k], b.mesh.bounds.max[k]); }
  const h = stepMM ?? Math.max(0.05, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 400);
  const regions: UndercutRegion[] = [];
  let samples = 0, coarsest = 0;
  for (const body of bodies) {
    const m = body.mesh, P = m.positions, I = m.indices, T = I.length / 3, bvh = triangleBvh(m.positions, m.indices);
    // Per triangle: its hidden samples (offset points, packed) and their area.
    const hiddenPts: number[][] = new Array(T), hiddenArea = new Float64Array(T), centre = new Float64Array(3 * T);
    for (let t = 0; t < T; t++) {
      const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      if (!(l > 0)) continue;
      const edge = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(P[c] - P[b], P[c + 1] - P[b + 1], P[c + 2] - P[b + 2]));
      const n = Math.min(MAX_N, Math.max(1, Math.ceil(edge / h))), cell = l / 2 / (n * n);
      if (edge / n > coarsest) coarsest = edge / n;
      const ox = OFF * nx / l, oy = OFF * ny / l, oz = OFF * nz / l, pts: number[] = [];
      let sx = 0, sy = 0, sz = 0, hidden = 0;
      // The n² sub-triangles' centres: n(n+1)/2 upright, n(n−1)/2 inverted.
      for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) for (let up = 0; up < 2; up++) {
        if (up === 1 && i + j > n - 2) continue;
        const s = (i + (up ? 2 : 1) / 3) / n, r = (j + (up ? 2 : 1) / 3) / n;
        const px = P[a] + s * ux + r * vx + ox, py = P[a + 1] + s * uy + r * vy + oy, pz = P[a + 2] + s * uz + r * vz + oz;
        samples++;
        o[0] = px; o[1] = py; o[2] = pz;
        if (rayHit(bvh, o, d) !== Infinity) { o[0] = px; o[1] = py; o[2] = pz; if (rayHit(bvh, o, back) !== Infinity) { pts.push(px, py, pz); hidden++; sx += px; sy += py; sz += pz; } }
      }
      if (hidden) { hiddenPts[t] = pts; hiddenArea[t] = hidden * cell; centre[3 * t] = sx / hidden; centre[3 * t + 1] = sy / hidden; centre[3 * t + 2] = sz / hidden; }
    }
    // Regions: triangles with hidden samples joined at a shared position (the display mesh repeats a vertex per face).
    const parent = new Int32Array(T); for (let t = 0; t < T; t++) parent[t] = t;
    const owner = new Map<string, number>();
    for (let t = 0; t < T; t++) {
      if (!hiddenArea[t]) continue;
      for (let k = 0; k < 3; k++) {
        const p = 3 * I[3 * t + k], key = `${Math.round(P[p] * 1e4)},${Math.round(P[p + 1] * 1e4)},${Math.round(P[p + 2] * 1e4)}`, other = owner.get(key);
        if (other === undefined) owner.set(key, t); else { const ra = root(parent, t), rb = root(parent, other); if (ra !== rb) parent[ra] = rb; }
      }
    }
    const groups = new Map<number, number[]>();
    for (let t = 0; t < T; t++) if (hiddenArea[t]) { const r = root(parent, t); const g = groups.get(r); if (g) g.push(t); else groups.set(r, [t]); }
    for (const tris of groups.values()) {
      let A = 0; const c: Vec3 = [0, 0, 0], faces = new Set<string>();
      for (const t of tris) { A += hiddenArea[t]; for (let k = 0; k < 3; k++) c[k] += hiddenArea[t] * centre[3 * t + k]; faces.add(m.faces[m.faceOfVertex[I[3 * t]]]?.name.split('+')[0] ?? '?'); }
      // A side action across the pull: the share of the region's hidden samples each direction frees (by their area).
      // (All freed is counted, not summed: a share of exactly 1 by the samples, not by a float sum of their areas.)
      let best = { direction: sides[0], clearShare: -1 }, bestAll = false;
      for (const s of sides) {
        let freed = 0, left = 0;
        for (const t of tris) {
          const pts = hiddenPts[t], each = hiddenArea[t] / (pts.length / 3);
          for (let k = 0; k < pts.length; k += 3) if (clear(bvh, pts, k, s)) freed += each; else left++;
        }
        const share = left === 0 ? 1 : A > 0 ? Math.min(freed / A, 1 - 1e-15) : 0;
        if (share > best.clearShare) { best = { direction: s, clearShare: share }; bestAll = left === 0; }
      }
      regions.push({ body: body.key, faces: [...faces].sort(), areaMM2: A, centroid: [c[0] / A, c[1] / A, c[2] / A], triangles: tris.length, sideAction: bestAll ? best.direction : null, best });
    }
  }
  regions.sort((a, b) => b.areaMM2 - a.areaMM2);
  return { pull: d, regions, samples, stepMM: h, coarsestMM: coarsest, method: `each display triangle split into n² equal parts (n from its longest edge over a ${+h.toFixed(4)} mm step, at most ${MAX_N}); each part's centre ${OFF} mm off the triangle along its normal, a ray along +d and −d through the triangle BVH; hidden both ways: an undercut, its share of the area with it; regions joined at shared positions; side actions tried along the two axes across d, both ways` };
}
