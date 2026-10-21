// Closing a planar loop (RM8, O43). RM1's tree keeps one pair of a loop out (`Loop`); its pin — a point both parts
// share at the solved pose — must stay shared as a driver joint moves. Given the driver's value, the two other joints
// round the loop are solved by Gauss–Newton on the pin's residual (its place on one part minus its place on the
// other), from the previous solution, so the motion follows the branch the linkage was assembled in. The branch is
// the sign of the turn between the two levers that meet at the pin (each from its part's own joint): a solution on
// the other branch is refused (BRANCH_FLIP), never taken; a driver value with no closure is NO_CLOSURE.
import type { StudioDoc } from '../engine/doc';
import { forwardKinematics } from './fk';
import { pathTo } from './ik';
import type { Joint, JointTree, Loop } from './joints';
import { rotationMatrix } from '../assembly/mates';
import { tablesFor } from '../assembly/faces';
import { solveDoc } from '../chat/assembly';

export interface Closure {
  /** The loop's two parts (links), and the pin both share at the solved pose (world, mm) and its axis. */
  a: string; b: string; point: [number, number, number]; axis: [number, number, number];
  /** +1 or −1: the assembled pose's branch. */
  branch: 1 | -1;
}
export type LoopCode = 'NOT_PLANAR' | 'NOT_ONE_LOOP' | 'NO_CLOSURE' | 'BRANCH_FLIP' | 'NO_PIN';
export class LoopError extends Error { constructor(public code: LoopCode, message: string) { super(`[${code}] ${message}`); this.name = 'LoopError'; } }
export interface Closed { q: Record<string, number>; residualMM: number; branch: 1 | -1; iterations: number }

const RESIDUAL_MM = 1e-12, MAX_ITER = 60;
const point = (m: { R: Float64Array; t: Float64Array }, p: readonly number[]): [number, number, number] => [m.R[0] * p[0] + m.R[1] * p[1] + m.R[2] * p[2] + m.t[0], m.R[3] * p[0] + m.R[4] * p[1] + m.R[5] * p[2] + m.t[1], m.R[6] * p[0] + m.R[7] * p[1] + m.R[8] * p[2] + m.t[2]];
const vector = (m: { R: Float64Array }, v: readonly number[]): [number, number, number] => [m.R[0] * v[0] + m.R[1] * v[1] + m.R[2] * v[2], m.R[3] * v[0] + m.R[4] * v[1] + m.R[5] * v[2], m.R[6] * v[0] + m.R[7] * v[1] + m.R[8] * v[2]];

/** The joints round the loop: on a's path or b's, not both (the common ones move the loop as a whole). */
function loopJoints(tree: JointTree, c: Closure): { onA: Joint[]; onB: Joint[] } {
  const pa = pathTo(tree, c.a), pb = pathTo(tree, c.b), common = new Set(pa.filter(j => pb.includes(j)).map(j => j.key));
  return { onA: pa.filter(j => !common.has(j.key)), onB: pb.filter(j => !common.has(j.key)) };
}
/** The branch at q: the sign of axis · (lever a × lever b), each lever from its part's own joint to the pin. */
export function branchAt(tree: JointTree, c: Closure, q: Readonly<Record<string, number>>): 1 | -1 {
  const { onA, onB } = loopJoints(tree, c), fk = forwardKinematics(tree, q), ja = onA[onA.length - 1], jb = onB[onB.length - 1];
  const pin = point(fk.motions.get(c.a)!, c.point), oa = point(fk.motions.get(ja.parent)!, ja.origin), ob = point(fk.motions.get(jb.parent)!, jb.origin);
  const la = [pin[0] - oa[0], pin[1] - oa[1], pin[2] - oa[2]], lb = [pin[0] - ob[0], pin[1] - ob[1], pin[2] - ob[2]];
  const n = vector(fk.motions.get(c.a)!, c.axis), x = la[1] * lb[2] - la[2] * lb[1], y = la[2] * lb[0] - la[0] * lb[2], z = la[0] * lb[1] - la[1] * lb[0];
  return n[0] * x + n[1] * y + n[2] * z >= 0 ? 1 : -1;
}
/** A closure from a loop's pin (world, mm) at the solved pose; its branch the assembled one. Planar: every loop joint a turn about parallel axes. */
export function closureOf(tree: JointTree, a: string, b: string, pin: readonly number[], axis: readonly number[]): Closure {
  const c: Closure = { a, b, point: [pin[0], pin[1], pin[2]], axis: [axis[0], axis[1], axis[2]], branch: 1 };
  const { onA, onB } = loopJoints(tree, c), all = [...onA, ...onB];
  if (onA.length + onB.length !== 3) throw new LoopError('NOT_ONE_LOOP', `a planar loop has three moving joints round it besides its pin; this one has ${onA.length + onB.length}`);
  for (const j of all) { const d = j.axis[0] * axis[0] + j.axis[1] * axis[1] + j.axis[2] * axis[2]; if ((j.type !== 'revolute' && j.type !== 'continuous') || Math.abs(Math.abs(d) - 1) > 1e-9) throw new LoopError('NOT_PLANAR', `${j.key} is not a turn about the pin's axis direction`); }
  c.branch = branchAt(tree, c, {});
  return c;
}
/** The loop's closure in a document's assembly: the pin is the loop's concentric mate's axis, where it meets the pair's flat mate. */
export function closureOfDoc(doc: StudioDoc, tree: JointTree, loop: Loop): Closure {
  const solved = solveDoc(doc).doc, tables = tablesFor(solved), mates = (solved.mates ?? []).filter(m => loop.mates.includes(m.id)), conc = mates.find(m => m.kind === 'concentric');
  if (!conc) throw new LoopError('NO_PIN', `the loop ${loop.parts.join('–')} has no concentric mate to close on`);
  const side = conc.a, f = tables(side.part)?.[side.face];
  if (!f || f.kind !== 'cylinder') throw new LoopError('NO_PIN', `${side.part}.${side.face} is not a round face`);
  const inst = (solved.instances ?? []).find(i => i.id === side.part), R = inst ? rotationMatrix(inst.rotation) : [1, 0, 0, 0, 1, 0, 0, 0, 1], t = inst ? inst.position : [0, 0, 0];
  const p = [0, 1, 2].map(i => R[i * 3] * f.point[0] + R[i * 3 + 1] * f.point[1] + R[i * 3 + 2] * f.point[2] + t[i]), n = [0, 1, 2].map(i => R[i * 3] * f.axis[0] + R[i * 3 + 1] * f.axis[1] + R[i * 3 + 2] * f.axis[2]);
  const [a, b] = loop.parts;
  return closureOf(tree, a, b, p, n);
}

const JTJ = new Float64Array(4), JTR = new Float64Array(2);
/**
 * The loop closed with the driver at `value`: the two other loop joints solved from `from` (the previous solution; at
 * first the solved pose). Refused: no closure there (NO_CLOSURE); a closure on the other branch (BRANCH_FLIP).
 */
export function closeLoop(tree: JointTree, c: Closure, driver: string, value: number, from: Readonly<Record<string, number>> = {}): Closed {
  const { onA, onB } = loopJoints(tree, c), all = [...onA, ...onB];
  if (!all.some(j => j.key === driver)) throw new LoopError('NOT_ONE_LOOP', `${driver} is not a joint round the loop`);
  const unknown = all.filter(j => j.key !== driver), q: Record<string, number> = { ...from, [driver]: value };
  for (const j of unknown) q[j.key] ??= 0;
  let res = Infinity, it = 0;
  for (; it < MAX_ITER; it++) {
    const fk = forwardKinematics(tree, q), pa = point(fk.motions.get(c.a)!, c.point), pb = point(fk.motions.get(c.b)!, c.point);
    const r = [pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]]; res = Math.hypot(r[0], r[1], r[2]);
    if (res <= RESIDUAL_MM) break;
    // (d r / d q_j: the joint's ω × (pin − p) on a's side, minus it on b's.)
    JTJ.fill(0); JTR.fill(0);
    const cols: number[][] = [];
    for (const j of unknown) {
      const P = fk.motions.get(j.parent)!, w = vector(P, j.axis), o = point(P, j.origin), x = onA.includes(j) ? pa : pb, s = onA.includes(j) ? 1 : -1;
      cols.push([s * (w[1] * (x[2] - o[2]) - w[2] * (x[1] - o[1])), s * (w[2] * (x[0] - o[0]) - w[0] * (x[2] - o[2])), s * (w[0] * (x[1] - o[1]) - w[1] * (x[0] - o[0]))]);
    }
    for (let i = 0; i < 2; i++) { for (let k = 0; k < 2; k++) JTJ[i * 2 + k] = cols[i][0] * cols[k][0] + cols[i][1] * cols[k][1] + cols[i][2] * cols[k][2]; JTR[i] = cols[i][0] * r[0] + cols[i][1] * r[1] + cols[i][2] * r[2]; }
    const det = JTJ[0] * JTJ[3] - JTJ[1] * JTJ[2];
    if (!(Math.abs(det) > 1e-18 * Math.max(1, JTJ[0] * JTJ[3]))) break;
    const d0 = (JTJ[3] * JTR[0] - JTJ[1] * JTR[1]) / det, d1 = (JTJ[0] * JTR[1] - JTJ[2] * JTR[0]) / det;
    // (A step no larger than a quarter turn: past a dead point Newton would wander across to anything.)
    const k = Math.min(1, (Math.PI / 4) / Math.max(Math.abs(d0), Math.abs(d1), 1e-300));
    q[unknown[0].key] -= k * d0; q[unknown[1].key] -= k * d1;
  }
  if (!(res <= 1e-9)) throw new LoopError('NO_CLOSURE', `${driver} at ${value} rad: the loop does not close (its pin ${res.toExponential(3)} mm apart after ${it} steps)`);
  const branch = branchAt(tree, c, q);
  if (branch !== c.branch) throw new LoopError('BRANCH_FLIP', `${driver} at ${value} rad closes on the other branch: not the one the linkage was assembled in`);
  return { q, residualMM: res, branch, iterations: it };
}
