// The collision sweep (RM6, O19): a straight joint-space path q(s) = q0 + s (q1 − q0), s ∈ [0, 1], checked for contact
// between links by conservative advancement (Schwarzer, Saha & Latombe): at a sample, each pair's clearance d; over the
// next step Δs no point of one link moves towards the other more than
//   |Δp| ≤ Δs · Σ_i |q1_i − q0_i| · r_i          (r_i: how far joint i's motion can carry a point of either link)
// so the step d / Σ|Δq_i| r_i is free of contact — the whole path is certified, not just its samples. Only the joints
// between the two links count (a common ancestor moves both together). r_i is a bound that holds in every pose: the
// joint-to-joint distances down the chain to the link (fixed in their links) plus the link's own reach from its joint;
// a slide moves a point by exactly |Δq|. The clearance comes from the links' convex hulls first (GJK: a prefilter; a
// hull distance is never more than the true one); where hulls meet, from the meshes themselves: an exact test for
// contact (an edge through the inside of a triangle, or one inside the other) and else their least distance (the
// kernel's exact `meshClearance`, K3).
// Parent and child are not checked (they meet at their joint by design, as simulators do), nor pairs whose relative
// pose the path does not change (said so if they touch).
// O22: two links seated together by design are checked without that seat, as the clearance map's `designed` state
// keeps a seat apart from a clash; anything else between them is still a contact.
// - Meshing gears (a coupling): each gear's zone is its triangles inside its tip cylinder over its teeth's face width;
//   zone against zone (the teeth) is the coupling's to hold, by its phase, and every other triangle pair is checked.
//   Two bare gears have nothing else: the pair is left out, said so.
// - A loop's pin (a closure) in a planar loop: every joint between the two links turns about an axis parallel to the
//   pin's (or slides across it), so each point keeps its place along that axis. Two triangles whose extents along it
//   meet at most at a plane can only touch, never cross: only the triangles within the slab both links fill are
//   checked. Stacked links (a face shared, no slab) cannot meet and are left out, said so; a part of one reaching
//   into the other's slab (a post) is checked as any other.
import type { BodyResult } from '../engine/evaluate';
import type { JointTree } from './joints';
import { spurGearDimensions } from '@barocss/cad';
import { forwardKinematics, type Motion } from './fk';
import { convexDistance, meshClearance } from '@barocss/cad';

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
  /** O22: pairs checked without their designed seat (meshing gears' teeth, a loop pin's shared face), and how. */
  designed: { links: [string, string]; why: string }[];
}

const TOL = 1e-6;
type V3 = readonly [number, number, number];
/**
 * A designed seat between two links: the triangle sets (index triples) still checked against each other, the first
 * of each pair on `first`; `probes`: a triangle of a link whose centre, inside the other link, is a contact too.
 */
interface Seat { why: string; first: string; checks: [Uint32Array, Uint32Array][]; probes: { link: string; tri: Uint32Array }[] }

/** A gear link's triangles split at its tip cylinder about the joint's axis, over the axial span its teeth have. */
function splitGear(l: SweepLink, o: V3, n: V3, ra: number, rf: number): { zone: Uint32Array; rest: Uint32Array } {
  const P = l.positions, I = l.indices, nv = P.length / 3, rho = new Float64Array(nv), h = new Float64Array(nv), tol = 1e-6 * Math.max(1, ra);
  let lo = Infinity, hi = -Infinity;
  for (let v = 0; v < nv; v++) {
    const x = P[v * 3] - o[0], y = P[v * 3 + 1] - o[1], z = P[v * 3 + 2] - o[2], a = x * n[0] + y * n[1] + z * n[2];
    h[v] = a; rho[v] = Math.hypot(x - a * n[0], y - a * n[1], z - a * n[2]);
    if (rho[v] >= rf - tol && rho[v] <= ra + tol) { lo = Math.min(lo, a); hi = Math.max(hi, a); }
  }
  const zone: number[] = [], rest: number[] = [];
  for (let k = 0; k < I.length; k += 3) {
    let inZone = true;
    for (let e = 0; e < 3; e++) { const v = I[k + e]; if (rho[v] > ra + tol || h[v] < lo - tol || h[v] > hi + tol) { inZone = false; break; } }
    (inZone ? zone : rest).push(I[k], I[k + 1], I[k + 2]);
  }
  return { zone: Uint32Array.from(zone), rest: Uint32Array.from(rest) };
}
/** Each point's extent along n: [min, max]. */
function extent(P: ArrayLike<number>, n: V3): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < P.length; i += 3) { const a = P[i] * n[0] + P[i + 1] * n[1] + P[i + 2] * n[2]; if (a < lo) lo = a; if (a > hi) hi = a; }
  return [lo, hi];
}
/** A link's triangles reaching into the open slab (lo, hi) along n. */
function inSlab(l: SweepLink, n: V3, lo: number, hi: number): Uint32Array {
  const P = l.positions, I = l.indices, out: number[] = [];
  for (let k = 0; k < I.length; k += 3) {
    let a = Infinity, b = -Infinity;
    for (let e = 0; e < 3; e++) { const v = I[k + e] * 3, h = P[v] * n[0] + P[v + 1] * n[1] + P[v + 2] * n[2]; if (h < a) a = h; if (h > b) b = h; }
    if (b > lo + TOL && a < hi - TOL) out.push(I[k], I[k + 1], I[k + 2]);
  }
  return Uint32Array.from(out);
}
/** Whether every joint between two links moves them in the plane across n: turns about axes along it, slides across it. */
function planar(tree: JointTree, a: string, b: string, n: V3): boolean {
  const pa = pathOf(tree, a), pb = pathOf(tree, b), common = new Set(pa.filter(k => pb.includes(k)));
  for (const key of [...pa, ...pb]) {
    if (common.has(key)) continue;
    const j = tree.joints.find(x => x.key === key)!, d = Math.abs(j.axis[0] * n[0] + j.axis[1] * n[1] + j.axis[2] * n[2]);
    if (j.type === 'fixed') continue;
    if (j.type === 'prismatic' ? d > 1e-9 : Math.abs(d - 1) > 1e-9) return false;
  }
  return true;
}
/** O22: the designed seats between the links, by pair (`a|b`, both orders): meshing gears and planar loop pins; null: none to check. */
function seatsOf(tree: JointTree, byId: ReadonlyMap<string, SweepLink>): Map<string, Seat | { why: string; skip: true }> {
  const out = new Map<string, Seat | { why: string; skip: true }>();
  for (const c of tree.couplings) {
    const jl = tree.joints.find(j => j.key === c.leader), jf = tree.joints.find(j => j.key === c.follower), a = jl && byId.get(jl.child), b = jf && byId.get(jf.child);
    if (!jl || !jf || !a || !b) continue;
    const da = spurGearDimensions(c.g1.spec), db = spurGearDimensions(c.g2.spec), sa = splitGear(a, jl.origin, jl.axis, da.ra, da.rf), sb = splitGear(b, jf.origin, jf.axis, db.ra, db.rf);
    const why = `meshing gears (${c.leader} drives ${c.follower}): their teeth are the coupling's to hold, by its phase`;
    const seat = !sa.rest.length && !sb.rest.length ? { why: `${why}; nothing else on either`, skip: true as const }
      : { why, first: a.link, checks: [[sa.rest, b.indices], [sa.zone, sb.rest]] as [Uint32Array, Uint32Array][], probes: [...(sa.rest.length ? [{ link: a.link, tri: sa.rest.subarray(0, 3) }] : []), ...(sb.rest.length ? [{ link: b.link, tri: sb.rest.subarray(0, 3) }] : [])] };
    out.set(`${a.link}|${b.link}`, seat); out.set(`${b.link}|${a.link}`, seat);
  }
  for (const loop of tree.loops) {
    const [x, y] = loop.parts, a = byId.get(x), b = byId.get(y), j = tree.joints.find(k => k.child === x);
    if (!a || !b || !j || !planar(tree, x, y, j.axis)) continue;
    const n = j.axis, [la, ha] = extent(a.positions, n), [lb, hb] = extent(b.positions, n), lo = Math.max(la, lb), hi = Math.min(ha, hb);
    const ia = hi - lo > 2 * TOL ? inSlab(a, n, lo, hi) : new Uint32Array(), ib = hi - lo > 2 * TOL ? inSlab(b, n, lo, hi) : new Uint32Array();
    const why = `a planar loop's pin (${loop.mates.join(', ')}): each keeps its place along the pin's axis`;
    const seat = !ia.length || !ib.length ? { why: `${why}, and they share no slab along it (stacked), so they cannot meet`, skip: true as const }
      : { why: `${why}: only what both fill along it checked`, first: x, checks: [[ia, ib]] as [Uint32Array, Uint32Array][], probes: [{ link: x, tri: ia.subarray(0, 3) }, { link: y, tri: ib.subarray(0, 3) }] };
    out.set(`${x}|${y}`, seat); out.set(`${y}|${x}`, seat);
  }
  return out;
}
/** A seat's contact: an edge of one checked set through a triangle of the other, or a probe's centre inside the other link. */
function seatMeets(seat: Seat, A: string, PA: Float64Array, IA: Uint32Array, PB: Float64Array, IB: Uint32Array): boolean {
  const flip = seat.first !== A;
  for (const [s1, s2] of seat.checks) if (flip ? piercesAny(PA, s2, PB, s1) : piercesAny(PA, s1, PB, s2)) return true;
  for (const p of seat.probes) {
    const mine = p.link === A, P = mine ? PA : PB, t = p.tri, cx = (P[t[0] * 3] + P[t[1] * 3] + P[t[2] * 3]) / 3, cy = (P[t[0] * 3 + 1] + P[t[1] * 3 + 1] + P[t[2] * 3 + 1]) / 3, cz = (P[t[0] * 3 + 2] + P[t[1] * 3 + 2] + P[t[2] * 3 + 2]) / 3;
    if (mine ? inside(cx, cy, cz, PB, IB) : inside(cx, cy, cz, PA, IA)) return true;
  }
  return false;
}
/** A seat's clearance: the least over its checked sets. */
function seatClearance(seat: Seat, A: string, PA: Float64Array, PB: Float64Array): number {
  const flip = seat.first !== A;
  let d = Infinity;
  for (const [s1, s2] of seat.checks) { if (!s1.length || !s2.length) continue; const m = flip ? meshClearance(PA, s2, PB, s1).distanceMM : meshClearance(PA, s1, PB, s2).distanceMM; if (m < d) d = m; }
  return d;
}
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
  const seats = seatsOf(tree, byId), designed: SweepResult['designed'] = [];
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const A = ids[a], B = ids[b], pair: [string, string] = [A, B];
    if (partParent(parentOf, A) === B || partParent(parentOf, B) === A) { skipped.push({ links: pair, why: 'parent and child (they meet at their joint)' }); continue; }
    const seat = seats.get(`${A}|${B}`);
    if (seat && 'skip' in seat) { skipped.push({ links: pair, why: seat.why }); continue; }
    if (seat) designed.push({ links: pair, why: seat.why });
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
      const pa = posed.get(A)!, pb = posed.get(B)!, r = rate.get(`${A}|${B}`)!, seat = seats.get(`${A}|${B}`) as Seat | undefined;
      let d = convexDistance(pa.hull, pb.hull);
      if (d <= tol) {
        // (The hulls meet: the meshes decide — in contact, or their own least distance; a gear seat without zone against zone.)
        const la = byId.get(A)!, lb = byId.get(B)!;
        if (seat ? seatMeets(seat, A, pa.mesh, la.indices, pb.mesh, lb.indices) : meshesMeet(pa.mesh, la.indices, pb.mesh, lb.indices)) {
          if (r === 0 && s === 0) { skipped.push({ links: [A, B], why: 'in contact where the path starts and not moved by it' }); rate.set(`${A}|${B}`, -1); continue; }
          return { contact: { s, values: fk.values, links: [A, B] }, clear: false, minClearance: { mm: 0, s, links: [A, B] }, samples, pairs, skipped, designed };
        }
        d = seat ? seatClearance(seat, A, pa.mesh, pb.mesh) : meshClearance(pa.mesh, la.indices, pb.mesh, lb.indices).distanceMM;
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
      if (limiting) return { contact: { s, values: fk.values, links: limiting }, clear: false, minClearance: min, samples, pairs, skipped, designed };
      break;
    }
    s = Math.min(1, s + step);
  }
  return { clear: true, minClearance: min, samples, pairs, skipped, designed };
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
  return piercesAny(PA, IA, PB, IB) || inside(PA[0], PA[1], PA[2], PB, IB) || inside(PB[0], PB[1], PB[2], PA, IA);
}
/** Whether an edge of one set of triangles passes through the inside of a triangle of the other. */
function piercesAny(PA: ArrayLike<number>, IA: ArrayLike<number>, PB: ArrayLike<number>, IB: ArrayLike<number>): boolean {
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
  return false;
}
/** A point inside a closed mesh, by the parity of a ray's crossings (an oblique ray, off every edge and corner). */
function inside(x: number, y: number, z: number, P: ArrayLike<number>, I: ArrayLike<number>): boolean {
  let n = 0;
  for (let k = 0; k < I.length / 3; k++) { load(tB, P, I, k); if (pierces(x, y, z, x + 1e6 * 0.5773, y + 1e6 * 0.5782, z + 1e6 * 0.5763, tB)) n++; }
  return n % 2 === 1;
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
