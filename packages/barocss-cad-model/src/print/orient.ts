// AM4 (D75): which way up to print. Candidate build directions — a fixed Fibonacci sphere of 64, then each large
// planar face set down on the bed (its normal's opposite) — are scored first cheaply by every candidate's overhang
// area, height and bed contact, then the best eight again with their support volume: rays straight down from each
// overhanging triangle, through the kernel's triangle hierarchy of the display mesh (`triangleBvh`, K2), to what is
// below it or the bed. The
// choice is deterministic: by score, then the lower height, then the candidate's index. The top three are reported.
import { rayHit, triangleBvh } from '@barocss/cad';
import type { DisplayMesh } from '../engine/mesh';
import type { FaceTable } from '../assembly/mates';
import { overhangOf, type Vec3 } from './overhang';

/** The score's normalised terms (each before its weight): support / (area · diag), overhang / area, height / diag, contact / area. */
export interface OrientationTerms { readonly support: number; readonly overhang: number; readonly height: number; readonly contact: number }
export interface OrientationWeights { readonly support: number; readonly overhang: number; readonly height: number; readonly contact: number }
export const DEFAULT_WEIGHTS: OrientationWeights = { support: 2, overhang: 1, height: 0.5, contact: 0.5 };
export interface OrientationScore { readonly index: number; readonly direction: Vec3; readonly score: number; readonly terms: OrientationTerms; readonly overhangMM2: number; readonly height: number; readonly contactMM2: number; readonly supportMM3?: number }
export interface OrientationResult { readonly best: OrientationScore; readonly top: readonly OrientationScore[]; readonly candidates: number; readonly weights: OrientationWeights; readonly ms: number }

/** 64 directions spread over the sphere (the golden-angle spiral), always the same. */
export function fibonacciDirections(n = 64): Vec3[] {
  const out: Vec3[] = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const z = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - z * z), a = g * i; out.push([r * Math.cos(a), r * Math.sin(a), z]); }
  return out;
}
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The deterministic order: the score, then the lower height, then the candidate's index. */
function order(a: { score: number; height: number; index: number }, b: { score: number; height: number; index: number }): number {
  return (Math.abs(a.score - b.score) > 1e-12 ? a.score - b.score : 0) || (Math.abs(a.height - b.height) > 1e-9 ? a.height - b.height : 0) || a.index - b.index;
}

/**
 * The orientation search over a body's display mesh (and its part's face table for exact planar faces) with the
 * process's overhang limit and its scoring weights (the profile's, sourced; D75). Score, lower better, of normalised
 * terms: w_s·support / (area·diag) + w_o·overhang / area + w_h·height / diag − w_c·contact / area — the support volume
 * only for the eight best by the rest (then its term added to theirs).
 */
export function searchOrientation(mesh: DisplayMesh, table: FaceTable, limit: number, weights: OrientationWeights = DEFAULT_WEIGHTS): OrientationResult {
  const t0 = performance.now(), P = mesh.positions;
  let area = 0; for (const f of mesh.faces) area += f.area;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); }
  const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
  // Candidates: the sphere, then large planar faces down on the bed (by area, then name), duplicates dropped.
  const cands: Vec3[] = [];
  const add = (d: Vec3) => { if (!cands.some(c => dot(c, d) > 1 - 1e-9)) cands.push(d); };
  for (const d of fibonacciDirections()) add(d);
  [...mesh.faces].filter(f => f.kind === 'plane' && f.area >= 0.01 * area).sort((a, b) => b.area - a.area || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)).slice(0, 32)
    .forEach(f => { const e = table[f.name.replace(/#\d+$/, '')], n = e && e.kind === 'plane' ? e.normal : f.normal; add([-n[0], -n[1], -n[2]]); });
  const cheap = cands.map((b, index) => {
    const o = overhangOf(mesh, table, limit, b);
    let top = -Infinity, bottom = Infinity; for (let i = 0; i < P.length; i += 3) { const t = P[i] * b[0] + P[i + 1] * b[1] + P[i + 2] * b[2]; if (t > top) top = t; if (t < bottom) bottom = t; }
    const height = top - bottom;
    const terms = { support: 0, overhang: o.totalMM2 / area, height: height / diag, contact: o.bedMM2 / area };
    return { index, direction: b, overhangMM2: o.totalMM2, height: height, contactMM2: o.bedMM2, terms, score: weights.overhang * terms.overhang + weights.height * terms.height - weights.contact * terms.contact, bottom };
  });
  const short = [...cheap].sort(order).slice(0, 8);
  const bvh = triangleBvh(mesh.positions, mesh.indices), Ix = mesh.indices;
  const scored: OrientationScore[] = short.map(c => {
    const b = c.direction, down = [-b[0], -b[1], -b[2]], s = Math.sin(limit * Math.PI / 180);
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
    return { index: c.index, direction: b, overhangMM2: c.overhangMM2, height: c.height, contactMM2: c.contactMM2, supportMM3: support, terms, score: c.score + weights.support * terms.support };
  });
  scored.sort(order);
  return { best: scored[0], top: scored.slice(0, 3), candidates: cands.length, weights, ms: performance.now() - t0 };
}

/** The part's orientation: its largest body's search, with its printing process's limit and weights; why not, else. */
export function orientPart(doc: import('../engine/doc').StudioDoc, bodies: readonly import('../engine/evaluate').BodyResult[], table: FaceTable, profile: import('../library/materials').ProcessProfile | undefined): OrientationResult | string {
  if (!profile?.additive) return profile ? `${profile.label} is not printing` : 'no printing process is chosen';
  const body = [...bodies].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))[0];
  if (!body) return 'no body';
  const w = (k: string, d: number) => profile.thresholds[k]?.value ?? d;
  void doc;
  return searchOrientation(body.mesh, table, profile.thresholds.maxOverhangDeg.value, { support: w('orientWSupport', 2), overhang: w('orientWOverhang', 1), height: w('orientWHeight', 0.5), contact: w('orientWContact', 0.5) });
}
