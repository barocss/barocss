// The collision sweep (RM6, O19): a straight joint-space path q(s) = q0 + s (q1 − q0), s ∈ [0, 1], checked for contact
// between links by conservative advancement (Schwarzer, Saha & Latombe): at a sample, each pair's clearance d; over the
// next step Δs no point of one link moves towards the other more than
//   |Δp| ≤ Δs · Σ_i |q1_i − q0_i| · r_i          (r_i: how far joint i's motion can carry a point of either link)
// so the step d / Σ|Δq_i| r_i is free of contact — the whole path is certified, not just its samples. Only the joints
// between the two links count (a common ancestor moves both together). r_i is a bound that holds in every pose: the
// joint-to-joint distances down the chain to the link (fixed in their links) plus the link's own reach from its joint;
// a slide moves a point by exactly |Δq|. The clearance comes from the links' convex hulls first (GJK: a prefilter; a
// hull distance is never more than the true one); where hulls meet, from the meshes themselves: an exact test for
// contact (an edge through the inside of a triangle, or one inside the other) and else their least distance.
// Parent and child are not checked (they meet at their joint by design, as simulators do), nor pairs whose relative
// pose the path does not change (said so if they touch).
import type { BodyResult } from '../engine/evaluate';
import type { JointTree } from './joints';
import { forwardKinematics, type Motion } from './fk';
import { convexDistance } from './gjk';

export interface SweepLink { link: string; /** Its mesh at home (world, mm): every body of its part, merged. */ positions: Float64Array; indices: Uint32Array; /** Its convex hull's corners at home (world, mm). */ hull: Float64Array }
export interface SweepResult {
  /** The first contact along the path: where, between which links, how (an edge through a triangle, or inside). */
  contact?: { s: number; values: Record<string, number>; links: [string, string] };
  /** The path is free of contact (certified between samples by the bound). */
  clear: boolean;
  /** The least clearance met (mm) and where. */
  minClearance: { mm: number; s: number; links: [string, string] } | null;
  samples: number;
  /** Pairs checked, and those left out (parent and child; no relative motion). */
  pairs: [string, string][]; skipped: { links: [string, string]; why: string }[];
}

const TOL = 1e-6;
/** A pose's points: the home points moved (into `out`). */
function moved(m: Motion, home: ArrayLike<number>, out: Float64Array): Float64Array {
  const R = m.R, t = m.t;
  for (let i = 0; i < home.length; i += 3) { const x = home[i], y = home[i + 1], z = home[i + 2]; out[i] = R[0] * x + R[1] * y + R[2] * z + t[0]; out[i + 1] = R[3] * x + R[4] * y + R[5] * z + t[1]; out[i + 2] = R[6] * x + R[7] * y + R[8] * z + t[2]; }
  return out;
}

/** A link's parent part: past the dummy links of its joint chain (they are one pair's joint). */
export function partParent(parentOf: ReadonlyMap<string, string>, link: string): string | undefined { let p = parentOf.get(link); while (p && p.includes('__')) p = parentOf.get(p); return p; }
/** The joints on a link's path from the base (keys), in order. */
export function pathOf(tree: JointTree, link: string): string[] {
  const out: string[] = [];
  for (let l = link, j = tree.joints.find(x => x.child === l); j; l = j.parent, j = tree.joints.find(x => x.child === l)) out.unshift(j.key);
  return out;
}
/** r_i for each joint on a link's path: the joint-to-joint distances from i down to the link, plus the link's reach. */
export function reaches(tree: JointTree, link: string, hull: ArrayLike<number>): Map<string, number> {
  const path = pathOf(tree, link), joints = path.map(k => tree.joints.find(j => j.key === k)!), out = new Map<string, number>();
  const own = joints[joints.length - 1]?.origin ?? [0, 0, 0];
  let reach = 0;
  for (let i = 0; i < hull.length; i += 3) reach = Math.max(reach, Math.hypot(hull[i] - own[0], hull[i + 1] - own[1], hull[i + 2] - own[2]));
  let down = reach;
  for (let k = joints.length - 1; k >= 0; k--) {
    if (k < joints.length - 1) { const a = joints[k].origin, b = joints[k + 1].origin; down += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }
    out.set(joints[k].key, joints[k].type === 'prismatic' ? 1 : down);
  }
  return out;
}

/** Sweeps the straight path from `from` to `to` (joint values by key; absent: 0). */
/**
 * Options: `tolerance` (mm), the clearance counted as contact (RM6: 1e-6; RM9a's time of impact takes 1e-9). Each step keeps
 * the clearance ≥ it, so the first sample where it is reached is the first time it is, to the step's own 1e-12.
 * `trace`: each sample's least clearance over the pairs, as [s, mm] (RM9a's clearance profile).
 */
export function sweepPath(tree: JointTree, links: readonly SweepLink[], from: Readonly<Record<string, number>>, to: Readonly<Record<string, number>>, o: { maxSamples?: number; tolerance?: number; trace?: [number, number][] } = {}): SweepResult {
  const tol = o.tolerance ?? TOL;
  const byId = new Map(links.map(l => [l.link, l])), keys = tree.joints.filter(j => j.type !== 'fixed' && !j.mimic).map(j => j.key);
  const q0 = Object.fromEntries(keys.map(k => [k, from[k] ?? 0])), q1 = Object.fromEntries(keys.map(k => [k, to[k] ?? 0]));
  // (A follower moves by its multiplier times its leader: its own |Δq| for the bound.)
  const dq = new Map<string, number>();
  for (const j of tree.joints) dq.set(j.key, j.mimic ? Math.abs(j.mimic.multiplier) * Math.abs((q1[j.mimic.joint] ?? 0) - (q0[j.mimic.joint] ?? 0)) : Math.abs((q1[j.key] ?? 0) - (q0[j.key] ?? 0)));
  const parentOf = new Map(tree.joints.map(j => [j.child, j.parent])), pairs: [string, string][] = [], skipped: SweepResult['skipped'] = [], rate = new Map<string, number>();
  const ids = links.map(l => l.link), reach = new Map(ids.map(id => [id, reaches(tree, id, byId.get(id)!.hull)]));
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const A = ids[a], B = ids[b], pair: [string, string] = [A, B];
    if (partParent(parentOf, A) === B || partParent(parentOf, B) === A) { skipped.push({ links: pair, why: 'parent and child (they meet at their joint)' }); continue; }
    const pa = pathOf(tree, A), pb = pathOf(tree, B), common = new Set(pa.filter(k => pb.includes(k)));
    let r = 0;
    for (const k of pa) if (!common.has(k)) r += dq.get(k)! * reach.get(A)!.get(k)!;
    for (const k of pb) if (!common.has(k)) r += dq.get(k)! * reach.get(B)!.get(k)!;
    rate.set(pair.join('|'), r); pairs.push(pair);
  }
  const at = (s: number) => Object.fromEntries(keys.map(k => [k, q0[k] + s * (q1[k] - q0[k])]));
  const posed = new Map(links.map(l => [l.link, { hull: new Float64Array(l.hull.length), mesh: new Float64Array(l.positions.length) }]));
  let s = 0, samples = 0, min: SweepResult['minClearance'] = null;
  const cap = o.maxSamples ?? 20000;
  for (;;) {
    samples++;
    const values = at(s), fk = forwardKinematics(tree, values);
    for (const l of links) { const m = fk.motions.get(l.link)!, p = posed.get(l.link)!; moved(m, l.hull, p.hull); moved(m, l.positions, p.mesh); }
    let step = Infinity, limiting: [string, string] | null = null, least = Infinity;
    for (const [A, B] of pairs) {
      const pa = posed.get(A)!, pb = posed.get(B)!, r = rate.get(`${A}|${B}`)!;
      let d = convexDistance(pa.hull, pb.hull);
      if (d <= tol) {
        // (The hulls meet: the meshes decide — in contact, or their own least distance.)
        const la = byId.get(A)!, lb = byId.get(B)!;
        if (meshesMeet(pa.mesh, la.indices, pb.mesh, lb.indices)) {
          if (r === 0 && s === 0) { skipped.push({ links: [A, B], why: 'in contact where the path starts and not moved by it' }); rate.set(`${A}|${B}`, -1); continue; }
          return { contact: { s, values: fk.values, links: [A, B] }, clear: false, minClearance: { mm: 0, s, links: [A, B] }, samples, pairs, skipped };
        }
        d = meshDistance(pa.mesh, la.indices, pb.mesh, lb.indices);
      }
      if (r < 0) continue;
      if (!min || d < min.mm) min = { mm: d, s, links: [A, B] };
      if (r > 0 && Math.max(d - tol, 0) / r < step) { step = Math.max(d - tol, 0) / r; limiting = [A, B]; }
      if (d < least) least = d;
    }
    if (o.trace && least < Infinity) o.trace.push([s, least]);
    if (s >= 1) break;
    // (A step too small to make progress: the clearance is all but nothing — met, to the tolerance.)
    if (!(step > 1e-12) || samples >= cap) {
      if (limiting) return { contact: { s, values: fk.values, links: limiting }, clear: false, minClearance: min, samples, pairs, skipped };
      break;
    }
    s = Math.min(1, s + step);
  }
  return { clear: true, minClearance: min, samples, pairs, skipped };
}

// ── Meshes: the exact contact test and the least distance (triangle against triangle, boxes first) ──
const tA = new Float64Array(9), tB = new Float64Array(9);
function load(t: Float64Array, P: ArrayLike<number>, I: ArrayLike<number>, k: number): void { for (let v = 0; v < 3; v++) { const i = I[k * 3 + v]; t[v * 3] = P[i * 3]; t[v * 3 + 1] = P[i * 3 + 1]; t[v * 3 + 2] = P[i * 3 + 2]; } }
/** Whether segment pq passes through the inside of triangle t (not just touching its edge or plane), Möller–Trumbore. */
function pierces(px: number, py: number, pz: number, qx: number, qy: number, qz: number, t: Float64Array): boolean {
  const dx = qx - px, dy = qy - py, dz = qz - pz, e1x = t[3] - t[0], e1y = t[4] - t[1], e1z = t[5] - t[2], e2x = t[6] - t[0], e2y = t[7] - t[1], e2z = t[8] - t[2];
  const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x, a = e1x * hx + e1y * hy + e1z * hz;
  if (Math.abs(a) < 1e-14) return false;
  const f = 1 / a, sx = px - t[0], sy = py - t[1], sz = pz - t[2], u = f * (sx * hx + sy * hy + sz * hz);
  if (u <= 1e-9 || u >= 1 - 1e-9) return false;
  const qx2 = sy * e1z - sz * e1y, qy2 = sz * e1x - sx * e1z, qz2 = sx * e1y - sy * e1x, v = f * (dx * qx2 + dy * qy2 + dz * qz2);
  if (v <= 1e-9 || u + v >= 1 - 1e-9) return false;
  const w = f * (e2x * qx2 + e2y * qy2 + e2z * qz2);
  return w > 1e-9 && w < 1 - 1e-9;
}
const boxApart = (a: Float64Array, b: Float64Array) => {
  for (let k = 0; k < 3; k++) { const amin = Math.min(a[k], a[3 + k], a[6 + k]), amax = Math.max(a[k], a[3 + k], a[6 + k]), bmin = Math.min(b[k], b[3 + k], b[6 + k]), bmax = Math.max(b[k], b[3 + k], b[6 + k]); if (amax < bmin - 1e-9 || bmax < amin - 1e-9) return true; }
  return false;
};
/** Whether two closed meshes interpenetrate: an edge of one through a triangle of the other, or one wholly inside the other. */
export function meshesMeet(PA: ArrayLike<number>, IA: ArrayLike<number>, PB: ArrayLike<number>, IB: ArrayLike<number>): boolean {
  const na = IA.length / 3, nb = IB.length / 3;
  for (let i = 0; i < na; i++) {
    load(tA, PA, IA, i);
    for (let j = 0; j < nb; j++) {
      load(tB, PB, IB, j);
      if (boxApart(tA, tB)) continue;
      for (let e = 0; e < 3; e++) {
        const f = (e + 1) % 3;
        if (pierces(tA[e * 3], tA[e * 3 + 1], tA[e * 3 + 2], tA[f * 3], tA[f * 3 + 1], tA[f * 3 + 2], tB)) return true;
        if (pierces(tB[e * 3], tB[e * 3 + 1], tB[e * 3 + 2], tB[f * 3], tB[f * 3 + 1], tB[f * 3 + 2], tA)) return true;
      }
    }
  }
  return inside(PA[0], PA[1], PA[2], PB, IB) || inside(PB[0], PB[1], PB[2], PA, IA);
}
/** A point inside a closed mesh, by the parity of a ray's crossings (an oblique ray, off every edge and corner). */
function inside(x: number, y: number, z: number, P: ArrayLike<number>, I: ArrayLike<number>): boolean {
  let n = 0;
  for (let k = 0; k < I.length / 3; k++) { load(tB, P, I, k); if (pierces(x, y, z, x + 1e6 * 0.5773, y + 1e6 * 0.5782, z + 1e6 * 0.5763, tB)) n++; }
  return n % 2 === 1;
}
/** Each triangle's box (min x y z, max x y z) into `out`. */
function boxesOf(P: ArrayLike<number>, I: ArrayLike<number>, out: Float64Array): Float64Array {
  for (let k = 0; k < I.length / 3; k++) for (let q = 0; q < 3; q++) {
    const a = P[I[k * 3] * 3 + q], b = P[I[k * 3 + 1] * 3 + q], c = P[I[k * 3 + 2] * 3 + q];
    out[k * 6 + q] = Math.min(a, b, c); out[k * 6 + 3 + q] = Math.max(a, b, c);
  }
  return out;
}
/**
 * The least distance between two meshes' triangles (a vertex to a triangle, either way; an edge to an edge). A pair whose
 * boxes are already as far apart as the best found is skipped: a box gap is never more than its triangles' distance, so
 * the result is the same, and the near pairs alone are measured (RM9a: the time of impact's last steps measure them).
 */
export function meshDistance(PA: ArrayLike<number>, IA: ArrayLike<number>, PB: ArrayLike<number>, IB: ArrayLike<number>): number {
  let best = Infinity;
  const na = IA.length / 3, nb = IB.length / 3, bA = boxesOf(PA, IA, new Float64Array(na * 6)), bB = boxesOf(PB, IB, new Float64Array(nb * 6));
  for (let i = 0; i < na; i++) {
    let loaded = false;
    for (let j = 0; j < nb; j++) {
      let gap = 0;
      for (let q = 0; q < 3; q++) { const g = Math.max(bB[j * 6 + q] - bA[i * 6 + 3 + q], bA[i * 6 + q] - bB[j * 6 + 3 + q], 0); gap += g * g; }
      if (gap >= best * best) continue;
      if (!loaded) { load(tA, PA, IA, i); loaded = true; }
      load(tB, PB, IB, j);
      for (let v = 0; v < 3; v++) { best = Math.min(best, pointTriangle(tA[v * 3], tA[v * 3 + 1], tA[v * 3 + 2], tB), pointTriangle(tB[v * 3], tB[v * 3 + 1], tB[v * 3 + 2], tA)); }
      for (let e = 0; e < 3; e++) for (let f = 0; f < 3; f++) best = Math.min(best, segSeg(tA, e, (e + 1) % 3, tB, f, (f + 1) % 3));
    }
  }
  return best;
}
/** A point's distance to a triangle (Ericson's regions). */
function pointTriangle(px: number, py: number, pz: number, t: Float64Array): number {
  const ax = t[0], ay = t[1], az = t[2], abx = t[3] - ax, aby = t[4] - ay, abz = t[5] - az, acx = t[6] - ax, acy = t[7] - ay, acz = t[8] - az, apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let cx: number, cy: number, cz: number;
  const bpx = px - t[3], bpy = py - t[4], bpz = pz - t[5], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  const cpx = px - t[6], cpy = py - t[7], cpz = pz - t[8], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
  if (d1 <= 0 && d2 <= 0) { cx = ax; cy = ay; cz = az; }
  else if (d3 >= 0 && d4 <= d3) { cx = t[3]; cy = t[4]; cz = t[5]; }
  else if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); cx = ax + v * abx; cy = ay + v * aby; cz = az + v * abz; }
  else if (d6 >= 0 && d5 <= d6) { cx = t[6]; cy = t[7]; cz = t[8]; }
  else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); cx = ax + w * acx; cy = ay + w * acy; cz = az + w * acz; }
  else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); cx = t[3] + w * (t[6] - t[3]); cy = t[4] + w * (t[7] - t[4]); cz = t[5] + w * (t[8] - t[5]); }
  else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; cx = ax + abx * v + acx * w; cy = ay + aby * v + acy * w; cz = az + abz * v + acz * w; }
  return Math.hypot(px - cx, py - cy, pz - cz);
}
/** The least distance between two segments (Ericson 5.1.9). */
function segSeg(a: Float64Array, i: number, j: number, b: Float64Array, k: number, l: number): number {
  const p1 = [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]], q1 = [a[j * 3], a[j * 3 + 1], a[j * 3 + 2]], p2 = [b[k * 3], b[k * 3 + 1], b[k * 3 + 2]], q2 = [b[l * 3], b[l * 3 + 1], b[l * 3 + 2]];
  const d1 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]], d2 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]], r = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
  const A = d1[0] * d1[0] + d1[1] * d1[1] + d1[2] * d1[2], E = d2[0] * d2[0] + d2[1] * d2[1] + d2[2] * d2[2], F = d2[0] * r[0] + d2[1] * r[1] + d2[2] * r[2];
  let s: number, t: number;
  if (A <= 1e-18 && E <= 1e-18) { s = 0; t = 0; }
  else if (A <= 1e-18) { s = 0; t = Math.min(1, Math.max(0, F / E)); }
  else {
    const C = d1[0] * r[0] + d1[1] * r[1] + d1[2] * r[2];
    if (E <= 1e-18) { t = 0; s = Math.min(1, Math.max(0, -C / A)); }
    else {
      const B = d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2], den = A * E - B * B;
      s = den > 1e-18 ? Math.min(1, Math.max(0, (B * F - C * E) / den)) : 0;
      t = (B * s + F) / E;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -C / A)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (B - C) / A)); }
    }
  }
  return Math.hypot(p1[0] + d1[0] * s - p2[0] - d2[0] * t, p1[1] + d1[1] * s - p2[1] - d2[1] * t, p1[2] + d1[2] * s - p2[2] - d2[2] * t);
}

/** The links of a tree for a sweep: each part's bodies (as shown, world) merged, and their hull's corners. */
export function sweepLinks(tree: JointTree, bodiesOf: (part: string) => readonly BodyResult[] | undefined, hullOf: (points: Float64Array) => Float64Array): SweepLink[] {
  const out: SweepLink[] = [];
  for (const l of tree.links) {
    if (l.part === null) continue;
    const bodies = bodiesOf(l.part) ?? [];
    let nv = 0, ni = 0; for (const b of bodies) { nv += b.mesh.positions.length; ni += b.mesh.indices.length; }
    if (!ni) continue;
    const positions = new Float64Array(nv), indices = new Uint32Array(ni); let vo = 0, io = 0;
    for (const b of bodies) { const base = vo / 3; positions.set(b.mesh.positions, vo); vo += b.mesh.positions.length; for (const k of b.mesh.indices) indices[io++] = k + base; }
    out.push({ link: l.id, positions, indices, hull: hullOf(positions) });
  }
  return out;
}
