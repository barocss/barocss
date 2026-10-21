// AM4 (D75): which way up to print. Candidate build directions — a fixed Fibonacci sphere of 64, then each large
// planar face set down on the bed (its normal's opposite) — are scored first cheaply by every candidate's overhang
// area, height and bed contact, then the best eight again with their support volume: rays straight down from each
// overhanging triangle, through a bounding-volume tree of the display mesh, to what is below it or the bed. The
// choice is deterministic: by score, then the lower height, then the candidate's index. The top three are reported.
import type { DisplayMesh } from '../engine/mesh';
import type { FaceTable } from '../assembly/mates';
import { overhangOf, type Vec3 } from './overhang';

/** A triangle bounding-volume tree over a display mesh: nodes' boxes, children or triangle runs, in typed arrays. */
export interface TriangleBvh { readonly box: Float64Array; readonly left: Int32Array; readonly start: Int32Array; readonly count: Int32Array; readonly order: Uint32Array; readonly mesh: DisplayMesh }
const LEAF = 8;
export function buildBvh(mesh: DisplayMesh): TriangleBvh {
  const P = mesh.positions, I = mesh.indices, T = I.length / 3, order = new Uint32Array(T), cx = new Float64Array(3 * T);
  for (let t = 0; t < T; t++) { order[t] = t; for (let k = 0; k < 3; k++) cx[3 * t + k] = (P[3 * I[3 * t] + k] + P[3 * I[3 * t + 1] + k] + P[3 * I[3 * t + 2] + k]) / 3; }
  // A split run has more than LEAF triangles, so each half (and every leaf below the root) has at least LEAF / 2.
  const cap = 2 * Math.max(1, Math.ceil(T / (LEAF >> 1))) + 1, box = new Float64Array(6 * cap), left = new Int32Array(cap).fill(-1), start = new Int32Array(cap), count = new Int32Array(cap);
  let nodes = 0;
  const stack: [number, number, number][] = [[nodes++, 0, T]];
  while (stack.length) {
    const [n, s, c] = stack.pop()!;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = s; i < s + c; i++) for (let v = 0; v < 3; v++) { const p = 3 * I[3 * order[i] + v]; const x = P[p], y = P[p + 1], z = P[p + 2]; if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z; if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z; }
    box.set([x0, y0, z0, x1, y1, z1], 6 * n);
    if (c <= LEAF) { start[n] = s; count[n] = c; continue; }
    // Split at the median along the box's longest side.
    const ax = x1 - x0 >= y1 - y0 && x1 - x0 >= z1 - z0 ? 0 : y1 - y0 >= z1 - z0 ? 1 : 2;
    const part = Array.from(order.subarray(s, s + c)).sort((a, b) => cx[3 * a + ax] - cx[3 * b + ax] || a - b);
    order.set(part, s);
    const half = c >> 1, l = nodes++, r = nodes++;
    left[n] = l;
    stack.push([l, s, half], [r, s + half, c - half]);
  }
  return { box, left, start, count, order, mesh };
}
const stackBuf = new Int32Array(256);
/** The nearest hit along o + t·d (t > eps) with the mesh, or Infinity. */
export function rayHit(bvh: TriangleBvh, o: readonly number[], d: readonly number[], eps = 1e-6): number {
  const P = bvh.mesh.positions, I = bvh.mesh.indices, B = bvh.box, inv0 = 1 / d[0], inv1 = 1 / d[1], inv2 = 1 / d[2];
  let best = Infinity, sp = 0; stackBuf[sp++] = 0;
  while (sp) {
    const n = stackBuf[--sp], b = 6 * n;
    // Slab test.
    let t0 = (B[b] - o[0]) * inv0, t1 = (B[b + 3] - o[0]) * inv0; let lo = Math.min(t0, t1), hi = Math.max(t0, t1);
    t0 = (B[b + 1] - o[1]) * inv1; t1 = (B[b + 4] - o[1]) * inv1; lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1));
    t0 = (B[b + 2] - o[2]) * inv2; t1 = (B[b + 5] - o[2]) * inv2; lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1));
    if (!(hi >= Math.max(lo, 0)) || lo > best) continue;
    if (bvh.left[n] >= 0) { stackBuf[sp++] = bvh.left[n]; stackBuf[sp++] = bvh.left[n] + 1; continue; }
    for (let i = bvh.start[n], e = i + bvh.count[n]; i < e; i++) {
      const t = 3 * bvh.order[i], a = 3 * I[t], c = 3 * I[t + 1], f = 3 * I[t + 2];
      const e1x = P[c] - P[a], e1y = P[c + 1] - P[a + 1], e1z = P[c + 2] - P[a + 2], e2x = P[f] - P[a], e2y = P[f + 1] - P[a + 1], e2z = P[f + 2] - P[a + 2];
      const hx = d[1] * e2z - d[2] * e2y, hy = d[2] * e2x - d[0] * e2z, hz = d[0] * e2y - d[1] * e2x, det = e1x * hx + e1y * hy + e1z * hz;
      if (det > -1e-14 && det < 1e-14) continue;
      const sx = o[0] - P[a], sy = o[1] - P[a + 1], sz = o[2] - P[a + 2], u = (sx * hx + sy * hy + sz * hz) / det;
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (d[0] * qx + d[1] * qy + d[2] * qz) / det;
      if (v < 0 || u + v > 1) continue;
      const tt = (e2x * qx + e2y * qy + e2z * qz) / det;
      if (tt > eps && tt < best) best = tt;
    }
  }
  return best;
}

/** The score's normalised terms (each before its weight): support / (area · diag), overhang / area, height / diag, contact / area. */
export interface OrientationTerms { readonly support: number; readonly overhang: number; readonly height: number; readonly contact: number }
export interface OrientationWeights { readonly support: number; readonly overhang: number; readonly height: number; readonly contact: number }
export const DEFAULT_WEIGHTS: OrientationWeights = { support: 2, overhang: 1, height: 0.5, contact: 0.5 };
export interface OrientationScore { readonly index: number; readonly direction: Vec3; readonly score: number; readonly terms: OrientationTerms; readonly overhangMM2: number; readonly heightMM: number; readonly contactMM2: number; readonly supportMM3?: number }
export interface OrientationResult { readonly best: OrientationScore; readonly top: readonly OrientationScore[]; readonly candidates: number; readonly weights: OrientationWeights; readonly ms: number }

/** 64 directions spread over the sphere (the golden-angle spiral), always the same. */
export function fibonacciDirections(n = 64): Vec3[] {
  const out: Vec3[] = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const z = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - z * z), a = g * i; out.push([r * Math.cos(a), r * Math.sin(a), z]); }
  return out;
}
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The deterministic order: the score, then the lower height, then the candidate's index. */
function order(a: { score: number; heightMM: number; index: number }, b: { score: number; heightMM: number; index: number }): number {
  return (Math.abs(a.score - b.score) > 1e-12 ? a.score - b.score : 0) || (Math.abs(a.heightMM - b.heightMM) > 1e-9 ? a.heightMM - b.heightMM : 0) || a.index - b.index;
}

/**
 * The orientation search over a body's display mesh (and its part's face table for exact planar faces) with the
 * process's overhang limit and its scoring weights (the profile's, sourced; D75). Score, lower better, of normalised
 * terms: w_s·support / (area·diag) + w_o·overhang / area + w_h·height / diag − w_c·contact / area — the support volume
 * only for the eight best by the rest (then its term added to theirs).
 */
export function searchOrientation(mesh: DisplayMesh, table: FaceTable, limitDeg: number, weights: OrientationWeights = DEFAULT_WEIGHTS): OrientationResult {
  const t0 = performance.now(), P = mesh.positions;
  let area = 0; for (const f of mesh.faces) area += f.areaMM2;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); }
  const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
  // Candidates: the sphere, then large planar faces down on the bed (by area, then name), duplicates dropped.
  const cands: Vec3[] = [];
  const add = (d: Vec3) => { if (!cands.some(c => dot(c, d) > 1 - 1e-9)) cands.push(d); };
  for (const d of fibonacciDirections()) add(d);
  [...mesh.faces].filter(f => f.kind === 'plane' && f.areaMM2 >= 0.01 * area).sort((a, b) => b.areaMM2 - a.areaMM2 || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)).slice(0, 32)
    .forEach(f => { const e = table[f.name.replace(/#\d+$/, '')], n = e && e.kind === 'plane' ? e.normal : f.normal; add([-n[0], -n[1], -n[2]]); });
  const cheap = cands.map((b, index) => {
    const o = overhangOf(mesh, table, limitDeg, b);
    let top = -Infinity, bottom = Infinity; for (let i = 0; i < P.length; i += 3) { const t = P[i] * b[0] + P[i + 1] * b[1] + P[i + 2] * b[2]; if (t > top) top = t; if (t < bottom) bottom = t; }
    const height = top - bottom;
    const terms = { support: 0, overhang: o.totalMM2 / area, height: height / diag, contact: o.bedMM2 / area };
    return { index, direction: b, overhangMM2: o.totalMM2, heightMM: height, contactMM2: o.bedMM2, terms, score: weights.overhang * terms.overhang + weights.height * terms.height - weights.contact * terms.contact, bottom };
  });
  const short = [...cheap].sort(order).slice(0, 8);
  const bvh = buildBvh(mesh), Ix = mesh.indices;
  const scored: OrientationScore[] = short.map(c => {
    const b = c.direction, down = [-b[0], -b[1], -b[2]], s = Math.sin(limitDeg * Math.PI / 180);
    let support = 0;
    for (let t = 0; t < Ix.length; t += 3) {
      const a = 3 * Ix[t], e = 3 * Ix[t + 1], f = 3 * Ix[t + 2];
      const e1 = [P[e] - P[a], P[e + 1] - P[a + 1], P[e + 2] - P[a + 2]], e2 = [P[f] - P[a], P[f + 1] - P[a + 1], P[f + 2] - P[a + 2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], twice = Math.hypot(n[0], n[1], n[2]);
      if (!(twice > 0)) continue;
      const nb = dot(n, b) / twice;
      if (!(-nb > s + 1e-12)) continue;
      const o = [(P[a] + P[e] + P[f]) / 3, (P[a + 1] + P[e + 1] + P[f + 1]) / 3, (P[a + 2] + P[e + 2] + P[f + 2]) / 3];
      const toBed = dot(o, b) - c.bottom;
      if (toBed < 1e-6) continue;
      const hit = rayHit(bvh, o, down);
      support += (twice / 2) * -nb * Math.min(hit, toBed);
    }
    const terms = { ...c.terms, support: support / (area * diag) };
    return { index: c.index, direction: b, overhangMM2: c.overhangMM2, heightMM: c.heightMM, contactMM2: c.contactMM2, supportMM3: support, terms, score: c.score + weights.support * terms.support };
  });
  scored.sort(order);
  return { best: scored[0], top: scored.slice(0, 3), candidates: cands.length, weights, ms: performance.now() - t0 };
}

/** The part's orientation: its largest body's search, with its printing process's limit and weights; why not, else. */
export function orientPart(doc: import('../engine/doc').StudioDoc, bodies: readonly import('../engine/evaluate').BodyResult[], table: FaceTable, profile: import('../library/materials').ProcessProfile | undefined): OrientationResult | string {
  if (!profile?.additive) return profile ? `${profile.label} is not printing` : 'no printing process is chosen';
  const body = [...bodies].sort((a, b) => (b.volumeMM3 ?? 0) - (a.volumeMM3 ?? 0))[0];
  if (!body) return 'no body';
  const w = (k: string, d: number) => profile.thresholds[k]?.value ?? d;
  void doc;
  return searchOrientation(body.mesh, table, profile.thresholds.maxOverhangDeg.value, { support: w('orientWSupport', 2), overhang: w('orientWOverhang', 1), height: w('orientWHeight', 0.5), contact: w('orientWContact', 0.5) });
}
