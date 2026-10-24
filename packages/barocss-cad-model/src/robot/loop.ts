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
import { rotationMatrix } from '../engine/placement';
import { tablesFor } from '../assembly/faces';
import { solvedFaces } from '../assembly/mates';
import { solveDoc } from '../assembly/edit';
import { refusal } from '../engine/refusal';

export interface Closure {
  /** The loop's two parts (links), and the pin both share at the solved pose (world, mm) and its axis. */
  a: string; b: string; point: [number, number, number]; axis: [number, number, number];
  /** +1 or −1: the assembled pose's branch. */
  branch: 1 | -1;
}
export type LoopCode = 'NOT_PLANAR' | 'NOT_ONE_LOOP' | 'NO_CLOSURE' | 'BRANCH_FLIP' | 'NO_PIN';
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
  if (onA.length + onB.length !== 3) throw refusal('NOT_ONE_LOOP', `a planar loop has three moving joints round it besides its pin; this one has ${onA.length + onB.length}`);
  for (const j of all) { const d = j.axis[0] * axis[0] + j.axis[1] * axis[1] + j.axis[2] * axis[2]; if ((j.type !== 'revolute' && j.type !== 'continuous') || Math.abs(Math.abs(d) - 1) > 1e-9) throw refusal('NOT_PLANAR', `${j.key} is not a turn about the pin's axis direction`); }
  c.branch = branchAt(tree, c, {});
  return c;
}
/** The loop's closure in a document's assembly: the pin is the loop's concentric mate's axis, where it meets the pair's flat mate. */
export function closureOfDoc(doc: StudioDoc, tree: JointTree, loop: Loop): Closure {
  const solved = solveDoc(doc).doc, tables = tablesFor(solved), mates = (solved.mates ?? []).filter(m => loop.mates.includes(m.id)), conc = mates.find(m => m.kind === 'concentric');
  if (!conc) throw refusal('NO_PIN', `the loop ${loop.parts.join('–')} has no concentric mate to close on`);
  const side = conc.a, f = tables(side.part)?.[side.face];
  if (!f || f.kind !== 'cylinder') throw refusal('NO_PIN', `${side.part}.${side.face} is not a round face`);
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
  if (!all.some(j => j.key === driver)) throw refusal('NOT_ONE_LOOP', `${driver} is not a joint round the loop`);
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
  if (!(res <= 1e-9)) throw refusal('NO_CLOSURE', `${driver} at ${value} rad: the loop does not close (its pin ${res.toExponential(3)} mm apart after ${it} steps)`);
  const branch = branchAt(tree, c, q);
  if (branch !== c.branch) throw refusal('BRANCH_FLIP', `${driver} at ${value} rad closes on the other branch: not the one the linkage was assembled in`);
  return { q, residualMM: res, branch, iterations: it };
}

// ── O24 (a), PG-7: a loop closed on its own mates (the API lane's check.ts close(), lifted) ──
// Any loop — slides, chains, several loops at once — is held by the mates the tree left out, each as it holds at the
// solved pose: a concentric pair as two points of a's axis on b's line; two planes (coincident, distance) as a's point
// at b's plane's offset and the normals kept as they were; an angle as the normals' cosine; a lock as three of b's
// points where a carries them. The unknowns are every moving joint round the loops but the drivers (a gear follower
// moves with its leader); damped Gauss–Newton on the analytic Jacobian from the previous pose, reached by continuation
// in steps of at most 5° (5 mm), halved near trouble, so the assembled branch is kept. Where the passive joints lose
// rank against the assembled pose (a dead point), the step is refused, never let wander onto the other branch.
type V3 = [number, number, number];
/** A loop mate's term: rows of residual, world at the solved pose. `p`: points on a (home world); `o`, `d` on b. */
export interface LoopTerm { mate: string; kind: 'line' | 'plane' | 'normal' | 'angle' | 'point'; a: string; b: string; p: V3[]; n: V3; o: V3; d: V3; at0: number }
const ROWS = { line: 6, plane: 1, normal: 3, angle: 1, point: 9 } as const;
/** (A point term holds each of its points: three for a lock, one for a ball, O24 c.) */
export const termRows = (terms: readonly LoopTerm[]) => terms.reduce((n, t) => n + (t.kind === 'point' ? 3 * t.p.length : ROWS[t.kind]), 0);
export const LOOP_RESIDUAL_MM = 1e-9;
const STEP_TURN = (5 * Math.PI) / 180, STEP_SLIDE = 5, MIN_STEP = 1e-3 / 5, LOOP_ITER = 60;

const unit3 = (v: readonly number[]): V3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const dot3 = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The loops' terms from the document's own mates (solved), refused where a mate has no term (LOOP_MATE_UNSUPPORTED). */
export function loopTermsOf(doc: StudioDoc, tree: JointTree): LoopTerm[] {
  const solved = solveDoc(doc).doc, tables = tablesFor(solved), out: LoopTerm[] = [];
  const placeOf = (part: string) => { const i = (solved.instances ?? []).find(x => x.id === part); return { R: i ? rotationMatrix(i.rotation) : [1, 0, 0, 0, 1, 0, 0, 0, 1], t: i ? i.position : [0, 0, 0] }; };
  const worldP = (part: string, p: readonly number[]): V3 => { const { R, t } = placeOf(part); return [0, 1, 2].map(i => R[i * 3] * p[0] + R[i * 3 + 1] * p[1] + R[i * 3 + 2] * p[2] + t[i]) as V3; };
  const worldV = (part: string, v: readonly number[]): V3 => { const { R } = placeOf(part); return unit3([0, 1, 2].map(i => R[i * 3] * v[0] + R[i * 3 + 1] * v[1] + R[i * 3 + 2] * v[2])); };
  for (const loop of tree.loops) for (const id of loop.mates) {
    const m = (solved.mates ?? []).find(x => x.id === id);
    if (!m) continue;
    const base = { mate: id, a: m.a.part, b: m.b.part, n: [0, 0, 0] as V3, at0: 0 };
    if (m.kind === 'lock') {
      const o = worldP(m.b.part, [0, 0, 0]);
      out.push({ ...base, kind: 'point', p: [o, worldP(m.b.part, [20, 0, 0]), worldP(m.b.part, [0, 20, 0])], o, d: [0, 0, 0] });
      continue;
    }
    const fa0 = tables(m.a.part)?.[m.a.face], fb0 = tables(m.b.part)?.[m.b.face], sf = fa0 && fb0 ? solvedFaces(m.kind, fa0, fb0) : null;
    const fa = sf?.a, fb = sf?.b, kind = sf?.as ?? m.kind;
    if (fa?.kind === 'sphere' && fb?.kind === 'sphere' && kind === 'concentric') {
      // (O24 c: a ball closing a loop — b's centre where a carries it.)
      const o = worldP(m.b.part, fb.point);
      out.push({ ...base, kind: 'point', p: [o], o, d: [0, 0, 0] });
    } else if (fa?.kind === 'cylinder' && fb?.kind === 'cylinder' && kind === 'concentric') {
      const p0 = worldP(m.a.part, fa.point), ax = worldV(m.a.part, fa.axis);
      out.push({ ...base, kind: 'line', p: [p0, [p0[0] + 20 * ax[0], p0[1] + 20 * ax[1], p0[2] + 20 * ax[2]]], o: worldP(m.b.part, fb.point), d: worldV(m.b.part, fb.axis) });
    } else if (fa?.kind === 'plane' && fb?.kind === 'plane' && (kind === 'coincident' || kind === 'distance' || kind === 'angle')) {
      const pa = worldP(m.a.part, fa.point), na = worldV(m.a.part, fa.normal), o = worldP(m.b.part, fb.point), nb = worldV(m.b.part, fb.normal);
      if (kind === 'angle') { out.push({ ...base, kind: 'angle', p: [], n: na, o, d: nb, at0: dot3(na, nb) }); continue; }
      out.push({ ...base, kind: 'plane', p: [pa], o, d: nb, at0: dot3([pa[0] - o[0], pa[1] - o[1], pa[2] - o[2]], nb) });
      out.push({ ...base, kind: 'normal', p: [], n: na, o, d: nb });
    } else throw refusal('LOOP_MATE_UNSUPPORTED', `${id} (${m.kind} between ${m.a.part}.${m.a.face} and ${m.b.part}.${m.b.face}) closes a loop, and no loop closure holds that mate yet: concentric round faces, edges, cones or spheres, coincident, distance or angle between flat faces, and lock do`);
  }
  return out;
}

/** The loops' joints: every moving joint round them (on one part's path, not both), and those that follow no other. */
export function loopJointsOf(tree: JointTree): { all: string[]; free: string[] } {
  const all = new Set<string>();
  for (const l of tree.loops) {
    const pa = pathTo(tree, l.parts[0]), pb = pathTo(tree, l.parts[1]), common = new Set(pa.filter(j => pb.includes(j)).map(j => j.key));
    for (const j of [...pa, ...pb]) if (!common.has(j.key) && j.type !== 'fixed') all.add(j.key);
  }
  const keys = [...all], free = keys.filter(k => !tree.joints.find(j => j.key === k)!.mimic);
  return { all: keys, free };
}

/** Each unknown's columns: itself, and the followers that move with it (× their multiplier, followers of followers too). */
function columnsOf(tree: JointTree, unknowns: readonly string[]): { key: string; k: number }[][] {
  return unknowns.map(u => {
    const out = [{ key: u, k: 1 }];
    for (let i = 0; i < out.length; i++) for (const j of tree.joints) if (j.mimic?.joint === out[i].key) out.push({ key: j.key, k: out[i].k * j.mimic.multiplier });
    return out;
  });
}
const mv = (m: { R: Float64Array; t: Float64Array }, p: readonly number[], out: number[], vec: boolean) => { const R = m.R; out[0] = R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + (vec ? 0 : m.t[0]); out[1] = R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + (vec ? 0 : m.t[1]); out[2] = R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + (vec ? 0 : m.t[2]); return out; };
const cross3 = (a: readonly number[], b: readonly number[], out: number[]) => { out[0] = a[1] * b[2] - a[2] * b[1]; out[1] = a[2] * b[0] - a[0] * b[2]; out[2] = a[0] * b[1] - a[1] * b[0]; return out; };

interface Jframe { turn: boolean; w: number[]; o: number[] }
/** The point x's (or direction's) rate on link L for a joint (its posed frame), 0 off L's path. */
function rateOn(f: Jframe, x: readonly number[], vec: boolean, out: number[]): number[] {
  if (!f.turn) { if (vec) { out[0] = out[1] = out[2] = 0; } else { out[0] = f.w[0]; out[1] = f.w[1]; out[2] = f.w[2]; } return out; }
  if (vec) return cross3(f.w, x, out);
  REL[0] = x[0] - f.o[0]; REL[1] = x[1] - f.o[1]; REL[2] = x[2] - f.o[2];
  return cross3(f.w, REL, out);
}
const REL = [0, 0, 0], PA = [0, 0, 0], O = [0, 0, 0], D = [0, 0, 0], NA = [0, 0, 0], V = [0, 0, 0], T1 = [0, 0, 0], T2 = [0, 0, 0], T3 = [0, 0, 0], T4 = [0, 0, 0], X = [0, 0, 0];
/** The terms' residuals at q (into r) and, given J, their Jacobian over the unknowns' columns (row-major, rows × n). */
function evalLoop(tree: JointTree, terms: readonly LoopTerm[], q: Readonly<Record<string, number>>, r: Float64Array, J: Float64Array | null, cols: readonly { key: string; k: number }[][], onPath: ReadonlyMap<string, ReadonlySet<string>>): number {
  const fk = forwardKinematics(tree, q), n = cols.length, frames = new Map<string, Jframe>();
  if (J) { J.fill(0); for (const c of cols) for (const { key } of c) { const j = tree.joints.find(x => x.key === key)!, P = fk.motions.get(j.parent)!; frames.set(key, { turn: j.type !== 'prismatic', w: mv(P, j.axis, [0, 0, 0], true), o: mv(P, j.origin, [0, 0, 0], false) }); } }
  let row = 0, ss = 0;
  for (const t of terms) {
    const A = fk.motions.get(t.a)!, B = fk.motions.get(t.b)!, onA = onPath.get(t.a)!, onB = onPath.get(t.b)!;
    mv(B, t.o, O, false); mv(B, t.d, D, true);
    if (t.kind === 'line' || t.kind === 'point') {
      for (const p of t.p) {
        mv(A, p, PA, false);
        if (t.kind === 'line') { V[0] = PA[0] - O[0]; V[1] = PA[1] - O[1]; V[2] = PA[2] - O[2]; const s = dot3(V, D); for (let i = 0; i < 3; i++) { r[row + i] = V[i] - s * D[i]; ss += r[row + i] ** 2; } }
        else { mv(B, p, X, false); for (let i = 0; i < 3; i++) { r[row + i] = X[i] - PA[i]; ss += r[row + i] ** 2; } }
        if (J) for (let c = 0; c < n; c++) for (const { key, k } of cols[c]) {
          const f = frames.get(key)!, inA = onA.has(key), inB = onB.has(key);
          if (!inA && !inB) continue;
          if (t.kind === 'point') { // d(M_B p − M_A p)
            if (inB) { rateOn(f, X, false, T1); for (let i = 0; i < 3; i++) J[(row + i) * n + c] += k * T1[i]; }
            if (inA) { rateOn(f, PA, false, T1); for (let i = 0; i < 3; i++) J[(row + i) * n + c] -= k * T1[i]; }
            continue;
          }
          // r = v − (v·d) d, v = pA − o: dr = dv − (dv·d) d − (v·dd) d − (v·d) dd
          V[0] = PA[0] - O[0]; V[1] = PA[1] - O[1]; V[2] = PA[2] - O[2];
          T1[0] = T1[1] = T1[2] = 0; T2[0] = T2[1] = T2[2] = 0;
          if (inA) rateOn(f, PA, false, T1);
          if (inB) { rateOn(f, O, false, T3); T1[0] -= T3[0]; T1[1] -= T3[1]; T1[2] -= T3[2]; rateOn(f, D, true, T2); }
          const dvd = dot3(T1, D), vdd = dot3(V, T2), vd = dot3(V, D);
          for (let i = 0; i < 3; i++) J[(row + i) * n + c] += k * (T1[i] - dvd * D[i] - vdd * D[i] - vd * T2[i]);
        }
        row += 3;
      }
    } else if (t.kind === 'plane') {
      mv(A, t.p[0], PA, false); V[0] = PA[0] - O[0]; V[1] = PA[1] - O[1]; V[2] = PA[2] - O[2];
      r[row] = dot3(V, D) - t.at0; ss += r[row] ** 2;
      if (J) for (let c = 0; c < n; c++) for (const { key, k } of cols[c]) {
        const f = frames.get(key)!, inA = onA.has(key), inB = onB.has(key);
        if (!inA && !inB) continue;
        T1[0] = T1[1] = T1[2] = 0; T2[0] = T2[1] = T2[2] = 0;
        if (inA) rateOn(f, PA, false, T1);
        if (inB) { rateOn(f, O, false, T3); T1[0] -= T3[0]; T1[1] -= T3[1]; T1[2] -= T3[2]; rateOn(f, D, true, T2); }
        J[row * n + c] += k * (dot3(T1, D) + dot3(V, T2));
      }
      row += 1;
    } else {
      mv(A, t.n, NA, true);
      if (t.kind === 'normal') { cross3(NA, D, T4); for (let i = 0; i < 3; i++) { r[row + i] = T4[i]; ss += T4[i] ** 2; } }
      else { r[row] = dot3(NA, D) - t.at0; ss += r[row] ** 2; }
      if (J) for (let c = 0; c < n; c++) for (const { key, k } of cols[c]) {
        const f = frames.get(key)!, inA = onA.has(key), inB = onB.has(key);
        if (!inA && !inB) continue;
        T1[0] = T1[1] = T1[2] = 0; T2[0] = T2[1] = T2[2] = 0;
        if (inA) rateOn(f, NA, true, T1);
        if (inB) rateOn(f, D, true, T2);
        if (t.kind === 'normal') { cross3(T1, D, T3); cross3(NA, T2, T4); for (let i = 0; i < 3; i++) J[(row + i) * n + c] += k * (T3[i] + T4[i]); }
        else J[row * n + c] += k * (dot3(T1, D) + dot3(NA, T2));
      }
      row += t.kind === 'normal' ? 3 : 1;
    }
  }
  return ss;
}
/** (JᵀJ + λI) x = −Jᵀr by Gaussian elimination with pivoting (n a handful); false when singular. */
function solveNormal(J: Float64Array, r: Float64Array, m: number, n: number, A: Float64Array, b: Float64Array): boolean {
  let diag = 0;
  for (let a = 0; a < n; a++) {
    for (let c = 0; c < n; c++) { let s = 0; for (let i = 0; i < m; i++) s += J[i * n + a] * J[i * n + c]; A[a * n + c] = s; }
    let s = 0; for (let i = 0; i < m; i++) s += J[i * n + a] * r[i]; b[a] = -s; diag = Math.max(diag, A[a * n + a]);
  }
  const lambda = 1e-12 * Math.max(1, diag);
  for (let a = 0; a < n; a++) A[a * n + a] += lambda;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let rr = c + 1; rr < n; rr++) if (Math.abs(A[rr * n + c]) > Math.abs(A[piv * n + c])) piv = rr;
    if (!(Math.abs(A[piv * n + c]) > 1e-300)) return false;
    if (piv !== c) { for (let k = 0; k < n; k++) { const t = A[c * n + k]; A[c * n + k] = A[piv * n + k]; A[piv * n + k] = t; } const t = b[c]; b[c] = b[piv]; b[piv] = t; }
    for (let rr = c + 1; rr < n; rr++) { const f = A[rr * n + c] / A[c * n + c]; for (let k = c; k < n; k++) A[rr * n + k] -= f * A[c * n + k]; b[rr] -= f * b[c]; }
  }
  for (let rr = n - 1; rr >= 0; rr--) { let s = b[rr]; for (let k = rr + 1; k < n; k++) s -= A[rr * n + k] * b[k]; b[rr] = s / A[rr * n + rr]; }
  return true;
}
/** The numerical rank of JᵀJ (n×n) by its eigenvalues (cyclic Jacobi), relative to the largest. */
function rankOf(J: Float64Array, m: number, n: number): number {
  const A = new Float64Array(n * n);
  for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) { let s = 0; for (let i = 0; i < m; i++) s += J[i * n + a] * J[i * n + c]; A[a * n + c] = s; }
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0; for (let a = 0; a < n; a++) for (let c = a + 1; c < n; c++) off += A[a * n + c] ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++) for (let qq = p + 1; qq < n; qq++) {
      const apq = A[p * n + qq]; if (Math.abs(apq) < 1e-300) continue;
      const th = (A[qq * n + qq] - A[p * n + p]) / (2 * apq), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = A[k * n + p], akq = A[k * n + qq]; A[k * n + p] = c * akp - s * akq; A[k * n + qq] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p * n + k], aqk = A[qq * n + k]; A[p * n + k] = c * apk - s * aqk; A[qq * n + k] = s * apk + c * aqk; }
    }
  }
  const ev = Array.from({ length: n }, (_, i) => Math.abs(A[i * n + i])), top = Math.max(...ev, 0);
  return ev.filter(e => e > 1e-14 * top && e > 1e-24).length;
}

/** How far the loops' mates are from holding at q (mm, the residual's norm): a chord's midpoint between two closed poses, RS6. */
export function loopResidual(tree: JointTree, c: LoopCloser, q: Readonly<Record<string, number>>): number {
  return Math.sqrt(evalLoop(tree, c.terms, q, new Float64Array(termRows(c.terms)), null, [], c.onPath));
}
/** A closer for a tree's loops: its terms, and which joints are round them. */
export interface LoopCloser { terms: LoopTerm[]; all: string[]; free: string[]; freedom: number; onPath: Map<string, Set<string>> }
/** The closer of a document's loops (null: none): its loops' freedom from the Jacobian's rank at the solved pose. */
export function loopCloserOf(doc: StudioDoc, tree: JointTree): LoopCloser | null {
  if (!tree.loops.length) return null;
  const terms = loopTermsOf(doc, tree), { all, free } = loopJointsOf(tree), onPath = new Map<string, Set<string>>();
  // (A cam's follower round a loop moves by its lobe's lift, not linearly: the closer does not hold it yet.)
  const cam = columnsOf(tree, free).flat().map(c => tree.joints.find(j => j.key === c.key)!).find(j => j.cam);
  if (cam) throw refusal('CAM_IN_LOOP', `${cam.key} follows a cam (${cam.cam!.mate}) and moves a closed loop: a loop through a cam is not closed yet`);
  for (const t of terms) for (const l of [t.a, t.b]) if (!onPath.has(l)) onPath.set(l, new Set(pathTo(tree, l).map(j => j.key)));
  const m = termRows(terms), r = new Float64Array(m), J = new Float64Array(m * free.length);
  evalLoop(tree, terms, {}, r, J, columnsOf(tree, free), onPath);
  return { terms, all, free, freedom: free.length - rankOf(J, m, free.length), onPath };
}
/**
 * The loops closed with the drivers at their values: the other free loop joints solved, from `from` (their previous
 * values; absent: the solved pose's 0) by continuation. Refused: more drivers than the loops' freedom (LOOP_PASSIVE), a
 * driver that is not round a loop, no closure (NO_CLOSURE), a dead point (DEAD_POINT).
 */
export function closeLoops(tree: JointTree, c: LoopCloser, drivers: Readonly<Record<string, number>>, from: Readonly<Record<string, number>> = {}): { q: Record<string, number>; residualMM: number; steps: number } {
  const given = Object.keys(drivers).filter(k => c.all.includes(k));
  if (given.some(k => !c.free.includes(k))) throw refusal('JOINT_MIMIC', `${given.filter(k => !c.free.includes(k)).join(', ')} follows another joint: give its leader`);
  if (given.length > c.freedom) throw refusal('LOOP_PASSIVE', `the loop${tree.loops.length > 1 ? 's have' : ' has'} ${c.freedom} degree${c.freedom === 1 ? '' : 's'} of freedom: give ${c.freedom} of ${c.free.join(', ')}, and the rest are solved (${given.join(', ')} given)`);
  const unknowns = c.free.filter(k => !given.includes(k)), n = unknowns.length, m = termRows(c.terms), cols = columnsOf(tree, unknowns);
  const r = new Float64Array(m), J = new Float64Array(m * n), A = new Float64Array(n * n), b = new Float64Array(n);
  const q: Record<string, number> = { ...from }; for (const k of c.free) q[k] ??= 0;
  const target = (k: string) => drivers[k] ?? q[k], start = Object.fromEntries(given.map(k => [k, q[k]]));
  const turnOf = (k: string) => tree.joints.find(j => j.key === k)!.type !== 'prismatic';
  // (The solve at one set of driver values, from q: false when it does not reach the tolerance.)
  const solveAt = (): boolean => {
    let ss = evalLoop(tree, c.terms, q, r, J, cols, c.onPath);
    for (let it = 0; it < LOOP_ITER && Math.sqrt(ss) > LOOP_RESIDUAL_MM * 1e-2; it++) {
      if (!n || !solveNormal(J, r, m, n, A, b)) break;
      for (let j = 0; j < n; j++) q[unknowns[j]] += b[j];
      ss = evalLoop(tree, c.terms, q, r, J, cols, c.onPath);
    }
    return Math.sqrt(ss) <= LOOP_RESIDUAL_MM;
  };
  const rank0 = n ? rankOf((evalLoop(tree, c.terms, q, r, J, cols, c.onPath), J), m, n) : 0;
  let u = 0, du = 1, steps = 0;
  const span = Math.max(0, ...given.map(k => Math.abs(target(k) - start[k]) / (turnOf(k) ? STEP_TURN : STEP_SLIDE)));
  du = span > 1 ? 1 / Math.ceil(span) : 1;
  if (!given.length && !solveAt()) throw refusal('NO_CLOSURE', 'the loop does not close at the solved pose');
  while (u < 1 - 1e-15 && given.length) {
    const next = Math.min(1, u + du), keep = { ...q };
    for (const k of given) q[k] = start[k] + next * (target(k) - start[k]);
    const closed = solveAt(), regular = !n || rankOf(J, m, n) >= rank0, missed = Math.sqrt(evalLoop(tree, c.terms, q, r, null, cols, c.onPath));
    if (closed && regular) { u = next; steps++; if (du < 1 / Math.max(1, Math.ceil(span))) du *= 2; continue; }
    Object.assign(q, keep);
    if (du * Math.max(1, span) <= MIN_STEP) {
      const at = given.map(k => `${k} = ${(start[k] + next * (target(k) - start[k])).toPrecision(6)}`).join(', ');
      if (closed) throw refusal('DEAD_POINT', `at ${at} the loop reaches a dead point (its passive joints lose a degree of freedom): past it the linkage would change branch`);
      throw refusal('NO_CLOSURE', `at ${at} the loop does not close (its mates ${missed.toExponential(3)} mm apart after ${LOOP_ITER} steps): past a toggle, or out of the loop's reach`);
    }
    du /= 2;
  }
  const res = Math.sqrt(evalLoop(tree, c.terms, q, r, null, cols, c.onPath));
  return { q, residualMM: res, steps };
}
