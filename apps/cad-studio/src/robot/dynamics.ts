// Robot statics and dynamics over the joint tree (RD1–RD2, O20…): what the joints must provide.
// RD1 — static gravity torques G(q): what each joint must hold for the robot to stand still at q,
//   G_j = ∂V/∂q_j, V = −Σ_L m_L g·c_L(q);   a turning joint: G_j = Σ_L m_L (−g)·(a_j × (c_L − p_j))   (N·m)
//                                             a slide:         G_j = Σ_L m_L (−g)·a_j                  (N)
// over the links L beyond joint j, with the joint's axis a_j, a point p_j on it and each link's centre of mass c_L at q
// (RM2's forward kinematics; RM3's masses and centres). A gear follower moves with its leader, so its share is the
// leader's too (virtual work: ×multiplier): `generalized` holds one value an independent joint. Standard gravity
// 9.80665 m/s² (the CGPM's defined value) on −Z unless given; SI throughout (lengths in m).
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { rotationMatrix } from '../assembly/mates';
import type { JointTree } from './joints';
import { applyTo, forwardKinematics, type Motion } from './fk';
import { linkFrames, linkInertia, type Mat3, type V3 } from './inertia';
import { pathOf } from './sweep';
import { onSegment, sCurve, trapezoid, ProfileError, type Profile, type ProfileKind, type Segment } from '@barocss/cad-model/robot/profile';

export const STANDARD_GRAVITY = 9.80665;
/** A link's mass (kg) and its centre of mass at home (world, mm). */
export interface LinkMass { massKg: number; com: V3 }

/** Each link's mass and centre of mass at home, in the world (RM3's, through each part's placement). */
export function linkMasses(tree: JointTree, partOf: (part: string) => { doc: StudioDoc; bodies: readonly BodyResult[]; position: readonly number[]; rotation: readonly number[] } | null): Map<string, LinkMass> {
  const frames = linkFrames(tree, p => partOf(p)), out = new Map<string, LinkMass>();
  for (const l of tree.links) {
    if (l.part === null) { out.set(l.id, { massKg: 0, com: [0, 0, 0] }); continue; }
    const part = partOf(l.part), F = frames.get(l.id)!, li = linkInertia(l.id, l.part, part?.doc ?? null, part?.bodies ?? [], F);
    const local = [0, 1, 2].map(i => F.origin[i] + (F.R[i * 3] * li.comM[0] + F.R[i * 3 + 1] * li.comM[1] + F.R[i * 3 + 2] * li.comM[2]) * 1000);
    const P = (part ? rotationMatrix(part.rotation) : [1, 0, 0, 0, 1, 0, 0, 0, 1]) as Mat3, t = part?.position ?? [0, 0, 0];
    out.set(l.id, { massKg: li.massKg, com: [0, 1, 2].map(i => P[i * 3] * local[0] + P[i * 3 + 1] * local[1] + P[i * 3 + 2] * local[2] + t[i]) as V3 });
  }
  return out;
}

export interface GravityResult {
  /** Each joint's static torque (N·m) or force (N), by key; a follower's at its own axis. */
  torques: Record<string, number>;
  /** One value an independent joint: a leader with its followers' shares (×multiplier) added. */
  generalized: Record<string, number>;
}

/** The joints' static gravity torques at joint values q (by key; absent: 0). `g`: gravity (m/s²), world. */
export function gravityTorques(tree: JointTree, masses: ReadonlyMap<string, LinkMass>, q: Readonly<Record<string, number>>, g: V3 = [0, 0, -STANDARD_GRAVITY]): GravityResult {
  const fk = forwardKinematics(tree, q), torques: Record<string, number> = {}, below = new Map<string, string[]>();
  // (The links beyond each joint: those whose path from the base goes through it.)
  for (const l of tree.links) for (const k of pathOf(tree, l.id)) (below.get(k) ?? below.set(k, []).get(k)!).push(l.id);
  const centre = new Map<string, V3>();
  for (const l of tree.links) { const m = masses.get(l.id); if (m && m.massKg > 0) centre.set(l.id, applyTo(fk.motions.get(l.id)!, m.com)); }
  for (const j of tree.joints) {
    if (j.type === 'fixed') { torques[j.key] = 0; continue; }
    const P: Motion = fk.motions.get(j.parent)!, a = [0, 1, 2].map(i => P.R[i * 3] * j.axis[0] + P.R[i * 3 + 1] * j.axis[1] + P.R[i * 3 + 2] * j.axis[2]) as V3, p = applyTo(P, j.origin);
    let t = 0;
    for (const id of below.get(j.key) ?? []) {
      const c = centre.get(id); if (!c) continue;
      const m = masses.get(id)!.massKg;
      if (j.type === 'prismatic') { t += m * -(g[0] * a[0] + g[1] * a[1] + g[2] * a[2]); continue; }
      // (a × (c − p), lengths in metres, against −g.)
      const r = [(c[0] - p[0]) / 1000, (c[1] - p[1]) / 1000, (c[2] - p[2]) / 1000];
      const v = [a[1] * r[2] - a[2] * r[1], a[2] * r[0] - a[0] * r[2], a[0] * r[1] - a[1] * r[0]];
      t += m * -(g[0] * v[0] + g[1] * v[1] + g[2] * v[2]);
    }
    torques[j.key] = t;
  }
  const generalized: Record<string, number> = {};
  for (const j of tree.joints) if (j.type !== 'fixed' && !j.mimic) generalized[j.key] = torques[j.key];
  for (const j of tree.joints) if (j.mimic && j.mimic.joint in generalized) generalized[j.mimic.joint] += j.mimic.multiplier * torques[j.key];
  return { torques, generalized };
}

// ── RD2: inverse dynamics (RNEA), the mass matrix (an independent route), moves and their torques ──────────────────
// RNEA in world coordinates: outward, each link's angular velocity and acceleration and the acceleration of its joint
// point and centre (gravity as the base accelerating upward, the usual device); inward, each link's force m·a_c and
// moment I ω̇ + ω × I ω about its centre gathered to its joint, τ = a·N (a turn) or a·F (a slide). Slides are in mm
// (q, q̇, q̈) as everywhere in the studio, converted to metres inside; torques N·m, forces N.
// M(q) is built from the geometric Jacobians, M = Σ m J_vᵀ J_v + J_ωᵀ I J_ω, not from the RNEA — the oracle for it.

/** A link's mass (kg), centre at home (world, mm) and inertia about it at home (world axes, kg·m²). */
export interface LinkBody extends LinkMass { I: Mat3 }
/** Each link's mass, centre and world inertia at home (RM3's, through its part's placement and its link frame). */
export function linkBodies(tree: JointTree, partOf: Parameters<typeof linkMasses>[1]): Map<string, LinkBody> {
  const frames = linkFrames(tree, p => partOf(p)), masses = linkMasses(tree, partOf), out = new Map<string, LinkBody>();
  for (const l of tree.links) {
    const m = masses.get(l.id)!;
    if (l.part === null) { out.set(l.id, { ...m, I: [0, 0, 0, 0, 0, 0, 0, 0, 0] }); continue; }
    const part = partOf(l.part), F = frames.get(l.id)!, li = linkInertia(l.id, l.part, part?.doc ?? null, part?.bodies ?? [], F);
    const P = (part ? rotationMatrix(part.rotation) : [1, 0, 0, 0, 1, 0, 0, 0, 1]) as Mat3, R = mul3(P, F.R);
    out.set(l.id, { ...m, I: mul3(mul3(R, li.inertia), tr3(R)) });
  }
  return out;
}
const mul3 = (a: Mat3, b: Mat3): Mat3 => { const r = new Array(9).fill(0) as Mat3; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]; return r; };
const tr3 = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const mv = (m: ArrayLike<number>, v: readonly number[]): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const cr = (a: readonly number[], b: readonly number[]): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const ad = (a: readonly number[], b: readonly number[]): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sb = (a: readonly number[], b: readonly number[]): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const sc = (a: readonly number[], s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dt3 = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The posed tree: each joint's axis and point (m), each link's centre (m) and world inertia, at q. */
function posed(tree: JointTree, bodies: ReadonlyMap<string, LinkBody>, q: Readonly<Record<string, number>>) {
  const fk = forwardKinematics(tree, q), joint = new Map<string, { a: V3; p: V3 }>(), link = new Map<string, { c: V3; I: Mat3; m: number }>();
  for (const j of tree.joints) { const P = fk.motions.get(j.parent)!; joint.set(j.key, { a: mv(P.R, j.axis), p: sc(applyTo(P, j.origin), 1e-3) }); }
  for (const l of tree.links) {
    const b = bodies.get(l.id), D = fk.motions.get(l.id)!;
    if (!b || !(b.massKg > 0)) { link.set(l.id, { c: [0, 0, 0], I: [0, 0, 0, 0, 0, 0, 0, 0, 0], m: 0 }); continue; }
    const R = [...D.R] as Mat3;
    link.set(l.id, { c: sc(applyTo(D, b.com), 1e-3), I: mul3(mul3(R, b.I), tr3(R)), m: b.massKg });
  }
  return { fk, joint, link, values: fk.values };
}
/** A joint's rate in SI (radians, or a slide's mm in metres); a follower's from its leader. */
function jointRate(j: JointTree['joints'][number], m: Readonly<Record<string, number>>): number {
  const v = j.mimic ? j.mimic.multiplier * (m[j.mimic.joint] ?? 0) : m[j.key] ?? 0;
  return j.type === 'prismatic' ? v * 1e-3 : v;
}
/** Each link's child joints, once a tree (the RNEA runs thousands of times a move). */
const kidsOf = new WeakMap<JointTree, Map<string, JointTree['joints']>>();
function childJoints(tree: JointTree): Map<string, JointTree['joints']> {
  let m = kidsOf.get(tree);
  if (!m) { m = new Map(); for (const j of tree.joints) (m.get(j.parent) ?? m.set(j.parent, []).get(j.parent)!).push(j); kidsOf.set(tree, m); }
  return m;
}

/** τ = RNEA(q, q̇, q̈): each joint's torque (N·m) or force (N), gravity `g` (m/s²) included (none: pass [0, 0, 0]). */
export function rnea(tree: JointTree, bodies: ReadonlyMap<string, LinkBody>, q: Readonly<Record<string, number>>, qd: Readonly<Record<string, number>>, qdd: Readonly<Record<string, number>>, g: V3 = [0, 0, -STANDARD_GRAVITY]): Record<string, number> {
  const { joint, link } = posed(tree, bodies, q), kids = childJoints(tree);
  // Outward: ω, ω̇ and the acceleration of a reference point (the joint point) of each link; the base accelerates at −g.
  const w = new Map<string, V3>([[tree.base, [0, 0, 0]]]), wd = new Map<string, V3>([[tree.base, [0, 0, 0]]]), ref = new Map<string, { o: V3; v: V3; acc: V3 }>([[tree.base, { o: [0, 0, 0], v: [0, 0, 0], acc: sc(g, -1) }]]);
  for (const j of tree.joints) {
    const { a, p } = joint.get(j.key)!, wp = w.get(j.parent)!, wdp = wd.get(j.parent)!, r = ref.get(j.parent)!, d = j.type === 'fixed' ? 0 : jointRate(j, qd), dd = j.type === 'fixed' ? 0 : jointRate(j, qdd);
    // (The parent's motion carried to the joint point.)
    const rp = sb(p, r.o), vP = ad(r.v, cr(wp, rp)), aP = ad(ad(r.acc, cr(wdp, rp)), cr(wp, cr(wp, rp)));
    if (j.type === 'prismatic') {
      w.set(j.child, wp); wd.set(j.child, wdp);
      ref.set(j.child, { o: p, v: ad(vP, sc(a, d)), acc: ad(ad(aP, sc(a, dd)), sc(cr(wp, a), 2 * d)) });
    } else {
      const wc = ad(wp, sc(a, d));
      w.set(j.child, wc); wd.set(j.child, ad(ad(wdp, sc(a, dd)), cr(wp, sc(a, d))));
      ref.set(j.child, { o: p, v: vP, acc: aP });
    }
  }
  // Inward: each link's force and moment about its joint point, summed into its parent's.
  const F = new Map<string, V3>(), N = new Map<string, V3>(), tau: Record<string, number> = {};
  for (let k = tree.joints.length - 1; k >= 0; k--) {
    const j = tree.joints[k], L = link.get(j.child)!, r = ref.get(j.child)!, wc = w.get(j.child)!, wdc = wd.get(j.child)!, rc = sb(L.c, r.o);
    const ac = ad(ad(r.acc, cr(wdc, rc)), cr(wc, cr(wc, rc))), f = sc(ac, L.m), n = ad(mv(L.I, wdc), cr(wc, mv(L.I, wc)));
    let Fj = f, Nj = ad(n, cr(rc, f));
    for (const c of kids.get(j.child) ?? []) { const Fc = F.get(c.child)!, Nc = N.get(c.child)!, rcj = sb(ref.get(c.child)!.o, r.o); Fj = ad(Fj, Fc); Nj = ad(ad(Nj, Nc), cr(rcj, Fc)); }
    F.set(j.child, Fj); N.set(j.child, Nj);
    const { a } = joint.get(j.key)!;
    tau[j.key] = j.type === 'fixed' ? 0 : j.type === 'prismatic' ? dt3(a, Fj) : dt3(a, Nj);
  }
  return tau;
}

/** The independent joints (not fixed, not followers), in order: the coordinates of M. */
export const coordinates = (tree: JointTree) => tree.joints.filter(j => j.type !== 'fixed' && !j.mimic).map(j => j.key);
/**
 * M(q) from the geometric Jacobians (not from the RNEA): M = Σ_L m_L J_v,Lᵀ J_v,L + J_ω,Lᵀ I_L J_ω,L over the
 * independent coordinates (a follower's column into its leader's, ×multiplier); a slide's column per metre.
 */
export function massMatrix(tree: JointTree, bodies: ReadonlyMap<string, LinkBody>, q: Readonly<Record<string, number>>): { keys: string[]; M: number[][] } {
  const { joint, link } = posed(tree, bodies, q), keys = coordinates(tree), n = keys.length, M = keys.map(() => new Array(n).fill(0));
  const col = (j: (typeof tree.joints)[number]) => (j.mimic ? { k: keys.indexOf(j.mimic.joint), s: j.mimic.multiplier } : { k: keys.indexOf(j.key), s: 1 });
  for (const l of tree.links) {
    const L = link.get(l.id)!; if (!(L.m > 0)) continue;
    const Jv = keys.map(() => [0, 0, 0] as V3), Jw = keys.map(() => [0, 0, 0] as V3);
    for (const key of pathOf(tree, l.id)) {
      const j = tree.joints.find(x => x.key === key)!; if (j.type === 'fixed') continue;
      const { a, p } = joint.get(key)!, { k, s } = col(j); if (k < 0) continue;
      if (j.type === 'prismatic') Jv[k] = ad(Jv[k], sc(a, s));
      else { Jv[k] = ad(Jv[k], sc(cr(a, sb(L.c, p)), s)); Jw[k] = ad(Jw[k], sc(a, s)); }
    }
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) M[r][c] += L.m * dt3(Jv[r], Jv[c]) + dt3(Jw[r], mv(L.I, Jw[c]));
  }
  return { keys, M };
}

export interface MoveLimits { velocity: number; acceleration: number; jerk?: number }
export interface MoveTorques {
  kind: ProfileKind; duration: number;
  joints: Record<string, { peak: number; rms: number; atPeak: number; distance: number; vPeak: number; aPeak: number; jPeak: number }>;
  sampling: string;
}
const SAMPLES_PER_SEGMENT = 256;
/** A straight move on one profile on the path parameter s ∈ [0, 1]; null profile when nothing moves. */
export interface MoveMotion { keys: string[]; q0: Readonly<Record<string, number>>; dq: Record<string, number>; profile: Profile | null }
/** The move's profile: its limits the tightest over the joints (each joint's limit over its share |Δq|). */
export function moveMotion(tree: JointTree, q0: Readonly<Record<string, number>>, q1: Readonly<Record<string, number>>, kind: ProfileKind, limits: (key: string) => MoveLimits): MoveMotion {
  const keys = coordinates(tree), dq = Object.fromEntries(keys.map(k => [k, (q1[k] ?? 0) - (q0[k] ?? 0)]));
  let v = Infinity, a = Infinity, jk = Infinity;
  for (const k of keys) { const D = Math.abs(dq[k]); if (!D) continue; const l = limits(k); v = Math.min(v, l.velocity / D); a = Math.min(a, l.acceleration / D); jk = Math.min(jk, (l.jerk ?? Infinity) / D); }
  if (!Number.isFinite(v)) return { keys, q0, dq, profile: null };
  if (kind === 's-curve' && !Number.isFinite(jk)) throw new ProfileError('an S-curve needs a jerk limit for each moving joint');
  return { keys, q0, dq, profile: kind === 'trapezoid' ? trapezoid(1, v, a) : sCurve(1, v, a, jk) };
}
/** The joints' values, rates and accelerations at time t within one segment of the move (by its own polynomial). */
export function moveState(m: MoveMotion, seg: Segment, t: number): { q: Record<string, number>; qd: Record<string, number>; qdd: Record<string, number> } {
  const s = onSegment(seg, t), q: Record<string, number> = {}, qd: Record<string, number> = {}, qdd: Record<string, number> = {};
  for (const k of m.keys) { q[k] = (m.q0[k] ?? 0) + s.s * m.dq[k]; qd[k] = s.v * m.dq[k]; qdd[k] = s.a * m.dq[k]; }
  return { q, qd, qdd };
}
/**
 * The torques of a straight move from q0 to q1 under a profile: one profile on the path parameter s ∈ [0, 1], its
 * limits the tightest over the joints (each joint's limit over its share |Δq|), so every joint stays within its own;
 * τ(t) = RNEA along it. The peak and RMS come from every segment end plus 256 samples a segment (inside a segment the
 * motion is a polynomial), the largest |τ| refined by golden section between its neighbours, the RMS by Simpson's rule.
 */
export function moveTorques(tree: JointTree, bodies: ReadonlyMap<string, LinkBody>, q0: Readonly<Record<string, number>>, q1: Readonly<Record<string, number>>, kind: ProfileKind, limits: (key: string) => MoveLimits, g: V3 = [0, 0, -STANDARD_GRAVITY]): MoveTorques {
  const motion = moveMotion(tree, q0, q1, kind, limits), { keys, dq } = motion, prof = motion.profile;
  if (!prof) { const zero = Object.fromEntries(keys.map(k => [k, { peak: 0, rms: 0, atPeak: 0, distance: 0, vPeak: 0, aPeak: 0, jPeak: 0 }])); return { kind, duration: 0, joints: zero, sampling: 'no motion' }; }
  // (Each segment by its own polynomial: at its ends one-sided, so a jump in acceleration is on the right side of the RMS.)
  const tauAt = (seg: Segment, t: number) => { const x = moveState(motion, seg, t); return rnea(tree, bodies, x.q, x.qd, x.qdd, g); };
  const out: MoveTorques['joints'] = {};
  for (const k of keys) out[k] = { peak: 0, rms: 0, atPeak: 0, distance: dq[k], vPeak: prof.vPeak * Math.abs(dq[k]), aPeak: prof.aPeak * Math.abs(dq[k]), jPeak: prof.jPeak * Math.abs(dq[k]) };
  const sq: Record<string, number> = Object.fromEntries(keys.map(k => [k, 0]));
  for (const seg of prof.segments) {
    const n = SAMPLES_PER_SEGMENT, h = (seg.t1 - seg.t0) / n, taus: Record<string, number>[] = [];
    for (let i = 0; i <= n; i++) taus.push(tauAt(seg, seg.t0 + i * h));
    for (const k of keys) {
      // (Simpson over the segment; the peak's sample, then golden section between its neighbours.)
      let acc = 0; for (let i = 0; i <= n; i++) acc += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * taus[i][k] ** 2;
      sq[k] += acc * h / 3;
      let best = 0; for (let i = 1; i <= n; i++) if (Math.abs(taus[i][k]) > Math.abs(taus[best][k])) best = i;
      let lo = seg.t0 + Math.max(0, best - 1) * h, hi = seg.t0 + Math.min(n, best + 1) * h;
      for (let it = 0; it < 40; it++) { const m1 = hi - (hi - lo) * 0.618033988749895, m2 = lo + (hi - lo) * 0.618033988749895; if (Math.abs(tauAt(seg, m1)[k]) > Math.abs(tauAt(seg, m2)[k])) hi = m2; else lo = m1; }
      const t = (lo + hi) / 2, refined = Math.abs(tauAt(seg, t)[k]), peak = Math.max(Math.abs(taus[best][k]), refined);
      if (peak > Math.abs(out[k].peak)) { out[k].peak = peak; out[k].atPeak = refined >= Math.abs(taus[best][k]) ? t : seg.t0 + best * h; }
    }
  }
  for (const k of keys) out[k].rms = Math.sqrt(sq[k] / prof.duration);
  return { kind, duration: prof.duration, joints: out, sampling: `every segment end and ${SAMPLES_PER_SEGMENT} samples a segment (${prof.segments.length} segments); the peak refined by golden section between its neighbours; RMS by Simpson's rule` };
}
