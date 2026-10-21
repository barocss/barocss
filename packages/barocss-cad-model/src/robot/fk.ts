// Forward kinematics over the joint tree (RM2, O15): the product of exponentials in the space frame (Lynch & Park).
// Each joint's screw is its axis and point at the solved pose (where every joint value is 0), so a link's motion is
//   D_link(q) = exp([S_1] q_1) · exp([S_2] q_2) · … along its path from the base link,
// and its pose is D_link · M_link (M: where the mates put it). Revolute and continuous joints turn by q radians about
// their axis, prismatic ones slide q mm along it; a follower (a gear, `mimic`) takes multiplier × its leader + offset.
// Runs per slider move: no allocation per joint beyond the poses it returns, no closures.
import { checkPlacedSpurGears, type GearPlacement } from '@barocss/cad';
import type { Joint, JointTree } from './joints';

/** A rigid motion: x ↦ R x + t (R row-major). */
export interface Motion { R: Float64Array; t: Float64Array }
export interface FkResult {
  /** Each link's motion from its solved pose. */
  motions: Map<string, Motion>;
  /** The values used, followers filled in from their leaders. */
  values: Record<string, number>;
  /** Joints given values outside their limits (kept as given: a preview shows them, an export refuses). */
  outOfLimits: string[];
  /** Joint keys given that the tree does not have. */
  unknown: string[];
}

const identity = (): Motion => ({ R: Float64Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1), t: new Float64Array(3) });
/** out = a ∘ b (b first). `out` may not be `a` or `b`. */
export function composeInto(out: Motion, a: Motion, b: Motion): Motion {
  const A = a.R, B = b.R, R = out.R, t = out.t;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    t[i] = A[i * 3] * b.t[0] + A[i * 3 + 1] * b.t[1] + A[i * 3 + 2] * b.t[2] + a.t[i];
  }
  return out;
}
/** exp([S] q) of a joint into `out`: a turn by q about the axis through its point, or a slide of q along it. */
export function screwInto(out: Motion, j: Joint, q: number): Motion {
  const [x, y, z] = j.axis, R = out.R, t = out.t;
  if (j.type === 'prismatic') { R.set([1, 0, 0, 0, 1, 0, 0, 0, 1]); t[0] = x * q; t[1] = y * q; t[2] = z * q; return out; }
  if (j.type === 'fixed' || q === 0) { R.set([1, 0, 0, 0, 1, 0, 0, 0, 1]); t.fill(0); return out; }
  const c = Math.cos(q), s = Math.sin(q), v = 1 - c;
  R[0] = v * x * x + c; R[1] = v * x * y - s * z; R[2] = v * x * z + s * y;
  R[3] = v * x * y + s * z; R[4] = v * y * y + c; R[5] = v * y * z - s * x;
  R[6] = v * x * z - s * y; R[7] = v * y * z + s * x; R[8] = v * z * z + c;
  // (About a point p: x ↦ R (x − p) + p, so t = p − R p.)
  const [px, py, pz] = j.origin;
  t[0] = px - (R[0] * px + R[1] * py + R[2] * pz); t[1] = py - (R[3] * px + R[4] * py + R[5] * pz); t[2] = pz - (R[6] * px + R[7] * py + R[8] * pz);
  return out;
}
/** The inverse of a rigid motion. */
export function invert(m: Motion): Motion {
  const R = m.R, out = identity();
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out.R[i * 3 + j] = R[j * 3 + i];
  for (let i = 0; i < 3; i++) out.t[i] = -(out.R[i * 3] * m.t[0] + out.R[i * 3 + 1] * m.t[1] + out.R[i * 3 + 2] * m.t[2]);
  return out;
}
/** A point moved. */
export const applyTo = (m: Motion, p: readonly number[]): [number, number, number] => [
  m.R[0] * p[0] + m.R[1] * p[1] + m.R[2] * p[2] + m.t[0], m.R[3] * p[0] + m.R[4] * p[1] + m.R[5] * p[2] + m.t[1], m.R[6] * p[0] + m.R[7] * p[1] + m.R[8] * p[2] + m.t[2]];

const scratch = identity();
/** Every link's motion for the joint values `q` (by joint key; absent: 0), the base link still. */
export function forwardKinematics(tree: JointTree, q: Readonly<Record<string, number>>): FkResult {
  const values: Record<string, number> = {}, outOfLimits: string[] = [], keys = new Set<string>();
  for (const j of tree.joints) { keys.add(j.key); values[j.key] = j.type === 'fixed' ? 0 : q[j.key] ?? 0; }
  // (Followers from their leaders: a gear pair turns together whatever was given for the follower.)
  for (const j of tree.joints) if (j.mimic) values[j.key] = j.mimic.multiplier * (values[j.mimic.joint] ?? 0) + j.mimic.offset;
  const motions = new Map<string, Motion>([[tree.base, identity()]]);
  for (const j of tree.joints) {
    const parent = motions.get(j.parent);
    if (!parent) continue;
    const v = values[j.key], l = j.limit;
    if (l && ((l.lower !== undefined && v < l.lower - 1e-12) || (l.upper !== undefined && v > l.upper + 1e-12))) outOfLimits.push(j.key);
    motions.set(j.child, composeInto(identity(), parent, screwInto(scratch, j, v)));
  }
  const unknown = Object.keys(q).filter(k => !keys.has(k));
  return { motions, values, outOfLimits, unknown };
}

/**
 * Where a slider for a joint runs: its limits, else a turn either way (continuous), else ±`travel` mm (a prismatic
 * joint without limits, said so by `limited: false`).
 */
export function sliderRange(j: Joint, travel = 50): { min: number; max: number; limited: boolean } {
  const l = j.limit;
  if (l?.lower !== undefined && l.upper !== undefined) return { min: l.lower, max: l.upper, limited: true };
  return j.type === 'prismatic' ? { min: -travel, max: travel, limited: false } : { min: -Math.PI, max: Math.PI, limited: false };
}

/**
 * A coupled gear pair at joint values `q` (RM2): the kernel's pair check with each gear turned by its joint, so the
 * phase the teeth stand at is read again — it stays the home phase when the follower's ratio is right.
 */
export function gearPairAt(pair: { leader: string; follower: string; g1: GearPlacement; g2: GearPlacement; s1: number; s2: number }, values: Readonly<Record<string, number>>) {
  const g1 = { ...pair.g1, rotation: pair.g1.rotation + pair.s1 * (values[pair.leader] ?? 0) }, g2 = { ...pair.g2, rotation: pair.g2.rotation + pair.s2 * (values[pair.follower] ?? 0) };
  const c = checkPlacedSpurGears(g1, g2, { mode: 'verdict' });
  return { phaseDeg: c.relativePhaseDeg, backlashMM: c.backlashMM, contactRatio: c.usableContactRatio, centerDistanceMM: c.centerDistanceMM };
}
