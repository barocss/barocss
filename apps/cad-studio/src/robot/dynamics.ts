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
