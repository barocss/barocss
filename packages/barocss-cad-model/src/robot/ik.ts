// Inverse kinematics (RM7, O43): damped least squares with Levenberg–Marquardt damping, over RM2's joint tree. The
// target is an end link's motion from the solved pose, read at a tool point; the error a 6-vector — the tool point's
// offset in metres and the rotation left over (axis-angle, radians). The space Jacobian comes from each joint's screw
// at the current pose; a step Δq = Jᵀ (J Jᵀ + λ² I)⁻¹ e is kept when it lowers the error (λ halves) and undone when it
// does not (λ × 4). Restarts from a deterministic sequence of seeds; the best kept. A result says whether it reached
// the target (both errors within the acceptance, never claimed otherwise) and whether the arm is singular there
// (σmin / σmax of J below 1e-4). Per iteration: typed arrays reused, no closures.
import { composeInto, forwardKinematics, invert, rootOf, type Motion } from './fk';
import { frameOf } from './frames';
import type { Joint, JointTree } from './joints';
import { refusal } from '../engine/refusal';

export const IK_POSITION_TOL_M = 1e-4;
export const IK_ANGLE_TOL_RAD = 1e-3;
/**
 * σmin / σmax below this: singular — a condition number past 1e4 (O44). Not O43's 1e-6: along a singular direction the
 * error grows only as δ², so a solve refined to machine precision still ends ~1e-5 rad off the singular pose, where the
 * ratio is 1e-6 – 1e-5; 1e-6 would miss a solve sitting on a singularity. Flagging more is the conservative side.
 */
export const SINGULAR_RATIO = 1e-4;
// (A seed that gets within 1e-7 is not restarted; each descent goes on refining to 1e-12, or until a step stops helping,
// so a solve on a singularity ends on it — stopped at 1e-7 it sits ~√(1e-7) rad off, where J is no longer singular.)
const DONE_M = 1e-7, DONE_RAD = 1e-7, STOP_M = 1e-12, STOP_RAD = 1e-12, MAX_ITER = 200, SEEDS = 15;

export interface IkTarget { link: string; motion: Motion; /** The tool point at the solved pose (world, mm); default the link's joint origin. */ tool?: readonly number[]; /** `position`: the tool point only (3 rows), its turn left free. */ mode?: 'pose' | 'position' }
export interface IkResult {
  q: Record<string, number>; reached: boolean; iterations: number; restarts: number;
  errorM: number; errorRad: number; singular: boolean; sigmaMin: number; sigmaMax: number;
}
export type IkCode = 'NO_LINK' | 'NO_JOINTS' | 'NO_FRAME';

/** The joints from the base to a link, base first. */
export function pathTo(tree: JointTree, link: string): Joint[] {
  const byChild = new Map(tree.joints.map(j => [j.child, j])), out: Joint[] = [];
  for (let l = link, guard = 0; l !== tree.base && guard < 4096; guard++) { const j = byChild.get(l); if (!j) return []; out.push(j); l = j.parent; }
  return out.reverse();
}
/** The unknowns on a path: its moving joints that follow no other. */
export const unknownsOf = (path: readonly Joint[]) => [...new Set(path.filter(j => j.type !== 'fixed' && !j.mimic).map(j => j.key))];

// ——— small dense linear algebra (n ≤ 6 rows; scratch reused)
const A = new Float64Array(36), L = new Float64Array(36), Y = new Float64Array(6), E = new Float64Array(36), V = new Float64Array(36);
/** Solves the SPD system (n × n in A) for b in place (Cholesky); false when not positive definite. */
function choleskySolve(n: number, b: Float64Array): boolean {
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i * n + j];
    for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
    if (i === j) { if (!(s > 0)) return false; L[i * n + i] = Math.sqrt(s); } else L[i * n + j] = s / L[j * n + j];
  }
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * n + k] * b[k]; b[i] = s / L[i * n + i]; }
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= L[k * n + i] * b[k]; b[i] = s / L[i * n + i]; }
  return true;
}
/** The eigenvalues of a symmetric n × n (in E, destroyed) by cyclic Jacobi, ascending, into `out`. */
function symmetricEigenvalues(n: number, out: Float64Array): void {
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0, diag = 0;
    for (let i = 0; i < n; i++) { diag += E[i * n + i] * E[i * n + i]; for (let j = i + 1; j < n; j++) off += E[i * n + j] * E[i * n + j]; }
    if (off <= 1e-32 * Math.max(diag, 1e-300)) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      const apq = E[p * n + q]; if (Math.abs(apq) < 1e-300) continue;
      const theta = (E[q * n + q] - E[p * n + p]) / (2 * apq), t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = E[k * n + p], akq = E[k * n + q]; E[k * n + p] = c * akp - s * akq; E[k * n + q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = E[p * n + k], aqk = E[q * n + k]; E[p * n + k] = c * apk - s * aqk; E[q * n + k] = s * apk + c * aqk; }
    }
  }
  for (let i = 0; i < n; i++) out[i] = E[i * n + i];
  out.subarray(0, n).sort();
}

// ——— the problem: its Jacobian and error at q
interface Problem { tree: JointTree; path: Joint[]; keys: string[]; link: string; tool: readonly number[]; target: Motion; xs: [number, number, number]; /** 6: the pose; 3: the position only. */ rows: number }
const J = new Float64Array(36), ERR = new Float64Array(6), EIG = new Float64Array(6);
/** Rotation vector of R* Rᵀ (radians), into ERR[3..5]: the turn still to make. */
function rotationError(Rt: Float64Array, R: Float64Array): number {
  // (M = Rt · Rᵀ.)
  const m = V;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i * 3 + j] = Rt[i * 3] * R[j * 3] + Rt[i * 3 + 1] * R[j * 3 + 1] + Rt[i * 3 + 2] * R[j * 3 + 2];
  const c = Math.max(-1, Math.min(1, (m[0] + m[4] + m[8] - 1) / 2)), ang = Math.acos(c);
  let x = m[7] - m[5], y = m[2] - m[6], z = m[3] - m[1];
  if (ang < 1e-12) { ERR[3] = x / 2; ERR[4] = y / 2; ERR[5] = z / 2; return Math.hypot(ERR[3], ERR[4], ERR[5]); }
  const s = Math.sin(ang);
  if (s > 1e-6) { const k = ang / (2 * s); ERR[3] = x * k; ERR[4] = y * k; ERR[5] = z * k; return ang; }
  // (Near a half turn: the axis from the diagonal of (M + I) / 2.)
  x = Math.sqrt(Math.max(0, (m[0] + 1) / 2)); y = Math.sqrt(Math.max(0, (m[4] + 1) / 2)); z = Math.sqrt(Math.max(0, (m[8] + 1) / 2));
  if (x >= y && x >= z) { y = Math.sign(m[1] + m[3] || 1) * y; z = Math.sign(m[2] + m[6] || 1) * z; } else if (y >= z) { x = Math.sign(m[1] + m[3] || 1) * x; z = Math.sign(m[5] + m[7] || 1) * z; } else { x = Math.sign(m[2] + m[6] || 1) * x; y = Math.sign(m[5] + m[7] || 1) * y; }
  const n = Math.hypot(x, y, z) || 1; ERR[3] = ang * x / n; ERR[4] = ang * y / n; ERR[5] = ang * z / n;
  return ang;
}
/** The error (ERR, m and rad) and, when `jac`, the Jacobian (J, 6 × keys, row major) at q; returns [|Δp| m, |Δθ| rad]. */
function evaluateAt(p: Problem, q: Readonly<Record<string, number>>, jac: boolean): [number, number] {
  const fk = forwardKinematics(p.tree, q), D = fk.motions.get(p.link)!, x0 = p.tool;
  const x = [D.R[0] * x0[0] + D.R[1] * x0[1] + D.R[2] * x0[2] + D.t[0], D.R[3] * x0[0] + D.R[4] * x0[1] + D.R[5] * x0[2] + D.t[1], D.R[6] * x0[0] + D.R[7] * x0[1] + D.R[8] * x0[2] + D.t[2]];
  ERR[0] = (p.xs[0] - x[0]) / 1000; ERR[1] = (p.xs[1] - x[1]) / 1000; ERR[2] = (p.xs[2] - x[2]) / 1000;
  const ang = p.rows === 6 ? rotationError(p.target.R, D.R) : 0;
  if (jac) {
    const n = p.keys.length; J.fill(0, 0, 6 * n);
    for (const j of p.path) {
      if (j.type === 'fixed') continue;
      // (A follower's column into its root joint's, × its rate there: a gear's multiplier, a cam's lift rate, O24 a.)
      const root = j.mimic ? rootOf(p.tree, j.key, fk.values) : null, col = p.keys.indexOf(root ? root.key : j.key), k = root ? root.rate : 1;
      if (col < 0) continue;
      const P = fk.motions.get(j.parent)!, R = P.R, a = j.axis, o = j.origin;
      const w0 = R[0] * a[0] + R[1] * a[1] + R[2] * a[2], w1 = R[3] * a[0] + R[4] * a[1] + R[5] * a[2], w2 = R[6] * a[0] + R[7] * a[1] + R[8] * a[2];
      if (j.type === 'prismatic') { J[col] += k * w0 / 1000; J[n + col] += k * w1 / 1000; J[2 * n + col] += k * w2 / 1000; continue; }
      const p0 = R[0] * o[0] + R[1] * o[1] + R[2] * o[2] + P.t[0], p1 = R[3] * o[0] + R[4] * o[1] + R[5] * o[2] + P.t[1], p2 = R[6] * o[0] + R[7] * o[1] + R[8] * o[2] + P.t[2];
      const r0 = (x[0] - p0) / 1000, r1 = (x[1] - p1) / 1000, r2 = (x[2] - p2) / 1000;
      J[col] += k * (w1 * r2 - w2 * r1); J[n + col] += k * (w2 * r0 - w0 * r2); J[2 * n + col] += k * (w0 * r1 - w1 * r0);
      J[3 * n + col] += k * w0; J[4 * n + col] += k * w1; J[5 * n + col] += k * w2;
    }
  }
  return [Math.hypot(ERR[0], ERR[1], ERR[2]), ang];
}
/** σmin and σmax of J (rows × n): from J Jᵀ, or Jᵀ J when n < rows. */
function singularValues(n: number, rows: number): [number, number] {
  const m = Math.min(rows, n);
  if (n >= rows) { for (let i = 0; i < rows; i++) for (let j = 0; j < rows; j++) { let s = 0; for (let k = 0; k < n; k++) s += J[i * n + k] * J[j * n + k]; E[i * rows + j] = s; } }
  else for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { let s = 0; for (let k = 0; k < rows; k++) s += J[k * n + i] * J[k * n + j]; E[i * n + j] = s; }
  symmetricEigenvalues(m, EIG);
  return [Math.sqrt(Math.max(0, EIG[0])), Math.sqrt(Math.max(0, EIG[m - 1]))];
}
const DQ = new Float64Array(6 * 8);
/** One LM descent from q (changed in place); returns iterations used. */
function descend(p: Problem, q: Record<string, number>, lambda0: number): number {
  const n = p.keys.length; let lam = lambda0, [em, er] = evaluateAt(p, q, true), it = 0;
  const trial: Record<string, number> = { ...q };
  for (; it < MAX_ITER && (em > STOP_M || er > STOP_RAD); it++) {
    // (y = (J Jᵀ + λ² I)⁻¹ e, Δq = Jᵀ y, on the problem's rows.)
    const m = p.rows;
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) { let s = i === j ? lam * lam : 0; for (let k = 0; k < n; k++) s += J[i * n + k] * J[j * n + k]; A[i * m + j] = s; }
    for (let i = 0; i < m; i++) Y[i] = ERR[i];
    if (!choleskySolve(m, Y)) { lam *= 4; continue; }
    for (let k = 0; k < n; k++) { let s = 0; for (let i = 0; i < m; i++) s += J[i * n + k] * Y[i]; DQ[k] = s; }
    for (let k = 0; k < n; k++) trial[p.keys[k]] = clamp(p, p.keys[k], q[p.keys[k]] + DQ[k]);
    const [tm, tr] = evaluateAt(p, trial, false);
    if (tm * tm + tr * tr < em * em + er * er) {
      for (const key of p.keys) q[key] = trial[key];
      [em, er] = evaluateAt(p, q, true); lam = Math.max(lam / 2, 1e-12);
    } else { for (const key of p.keys) trial[key] = q[key]; lam *= 4; evaluateAt(p, q, true); if (lam > 1e6) break; }
  }
  return it;
}
function clamp(p: Problem, key: string, v: number): number {
  const l = p.tree.joints.find(j => j.key === key)?.limit;
  return l ? Math.min(l.upper ?? Infinity, Math.max(l.lower ?? -Infinity, v)) : v;
}
/** A deterministic seed sequence (mulberry32), seeded from the target's numbers: module state, no closure. */
let rngState = 0;
function seedRandom(t: Motion): void { let a = 0x9e3779b9; for (let i = 0; i < 3; i++) a = (a ^ Math.round(t.t[i] * 1e6)) * 0x85ebca6b >>> 0; rngState = a; }
function nextRandom(): number { rngState = (rngState + 0x6d2b79f5) >>> 0; let x = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }
function randomSeed(p: Problem): Record<string, number> {
  const q: Record<string, number> = {};
  for (const key of p.keys) {
    const j = p.tree.joints.find(x => x.key === key)!, l = j.limit;
    q[key] = l?.lower !== undefined && l.upper !== undefined ? l.lower + nextRandom() * (l.upper - l.lower) : j.type === 'prismatic' ? (nextRandom() - 0.5) * 100 : (nextRandom() * 2 - 1) * Math.PI;
  }
  return q;
}

/**
 * A frame's pose as an IK target (O12): its link, the link's motion that puts the frame at `pose` (pose · M⁻¹, M the
 * frame at the solved pose) and the frame's origin as the tool point — so the solve's position and turn errors are the
 * frame's own.
 */
export function frameTarget(tree: JointTree, name: string, pose: Motion, mode?: 'pose' | 'position'): IkTarget {
  const f = frameOf(tree, name);
  if (!f) throw refusal('NO_FRAME', `no frame ${name} on the tree (frames: ${(tree.frames ?? []).map(x => x.name).join(', ') || 'none'})`);
  const M: Motion = { R: Float64Array.from(f.R), t: Float64Array.from(f.o) };
  return { link: f.link, motion: composeInto({ R: new Float64Array(9), t: new Float64Array(3) }, pose, invert(M)), tool: f.o, ...(mode ? { mode } : {}) };
}
/** A frame's link and origin as a tool point (the workspace map's, a probe's), or NO_FRAME. */
export function frameTool(tree: JointTree, name: string): { link: string; tool: readonly number[] } {
  const f = frameOf(tree, name);
  if (!f) throw refusal('NO_FRAME', `no frame ${name} on the tree (frames: ${(tree.frames ?? []).map(x => x.name).join(', ') || 'none'})`);
  return { link: f.link, tool: f.o };
}

/** The joint values that bring `target.link` to `target.motion` at its tool point, from `start` (absent: 0) and up to 15 seeds. */
export function solveIk(tree: JointTree, target: IkTarget, start: Readonly<Record<string, number>> = {}): IkResult {
  const path = pathTo(tree, target.link);
  if (target.link !== tree.base && !path.length) throw refusal('NO_LINK', `no link ${target.link} on the tree`);
  const keys = unknownsOf(path);
  if (!keys.length) throw refusal('NO_JOINTS', `nothing moves ${target.link}`);
  const tool = target.tool ?? path[path.length - 1].origin, m = target.motion;
  const xs: [number, number, number] = [m.R[0] * tool[0] + m.R[1] * tool[1] + m.R[2] * tool[2] + m.t[0], m.R[3] * tool[0] + m.R[4] * tool[1] + m.R[5] * tool[2] + m.t[1], m.R[6] * tool[0] + m.R[7] * tool[1] + m.R[8] * tool[2] + m.t[2]];
  const p: Problem = { tree, path, keys, link: target.link, tool, target: m, xs, rows: target.mode === 'position' ? 3 : 6 };
  seedRandom(m);
  let best: { q: Record<string, number>; em: number; er: number } | null = null, iterations = 0, restarts = 0;
  for (let s = 0; s < SEEDS; s++) {
    const q: Record<string, number> = s === 0 ? Object.fromEntries(keys.map(k => [k, start[k] ?? 0])) : randomSeed(p);
    iterations += descend(p, q, 1e-2);
    const [em, er] = evaluateAt(p, q, false);
    if (!best || em * em + er * er < best.em * best.em + best.er * best.er) best = { q: { ...q }, em, er };
    if (em <= DONE_M && er <= DONE_RAD) break;
    restarts++;
  }
  const [em, er] = evaluateAt(p, best!.q, true), [smin, smax] = singularValues(keys.length, p.rows);
  return { q: best!.q, reached: em <= IK_POSITION_TOL_M && er <= IK_ANGLE_TOL_RAD, iterations, restarts, errorM: em, errorRad: er, singular: !(smax > 0) || smin / smax < SINGULAR_RATIO, sigmaMin: smin, sigmaMax: smax };
}
/** σmin / σmax of the Jacobian at q (the singularity measure alone). */
export function jacobianConditioning(tree: JointTree, link: string, q: Readonly<Record<string, number>>, tool?: readonly number[], mode: 'pose' | 'position' = 'pose'): { sigmaMin: number; sigmaMax: number; singular: boolean } {
  const path = pathTo(tree, link), keys = unknownsOf(path), t = tool ?? path[path.length - 1].origin, fk = forwardKinematics(tree, q), D = fk.motions.get(link)!;
  const p: Problem = { tree, path, keys, link, tool: t, target: D, xs: [0, 0, 0], rows: mode === 'position' ? 3 : 6 };
  evaluateAt(p, q, true); const [smin, smax] = singularValues(keys.length, p.rows);
  return { sigmaMin: smin, sigmaMax: smax, singular: !(smax > 0) || smin / smax < SINGULAR_RATIO };
}

/** A tool point's probe for many poses (RM9b): its path and Jacobian set up once. */
export interface ToolProbe { problem: Problem; n: number }
export function toolProbe(tree: JointTree, link: string, tool?: readonly number[]): ToolProbe {
  const path = pathTo(tree, link), keys = unknownsOf(path);
  if (!keys.length) throw refusal('NO_JOINTS', `nothing moves link ${link}`);
  const t = tool ?? path[path.length - 1].origin, D = forwardKinematics(tree, {}).motions.get(link)!;
  return { problem: { tree, path, keys, link, tool: t, target: D, xs: [0, 0, 0], rows: 3 }, n: keys.length };
}
/**
 * The tool point (world, mm, into `x`) and its manipulability at q: w = √det(J Jᵀ) of the position Jacobian (m per rad or
 * m per m), or √det(Jᵀ J) when fewer joints than its three rows — the product of J's singular values (Yoshikawa).
 */
export function probeAt(pr: ToolProbe, q: Readonly<Record<string, number>>, x: Float64Array): number {
  const p = pr.problem, n = pr.n, m = Math.min(3, n);
  evaluateAt(p, q, true);
  // (evaluateAt measured the error from xs = 0: the tool point is −ERR × 1000.)
  x[0] = -ERR[0] * 1000; x[1] = -ERR[1] * 1000; x[2] = -ERR[2] * 1000;
  if (n >= 3) { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < n; k++) s += J[i * n + k] * J[j * n + k]; E[i * 3 + j] = s; } }
  else for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { let s = 0; for (let k = 0; k < 3; k++) s += J[k * n + i] * J[k * n + j]; E[i * n + j] = s; }
  // (Its determinant directly: m ≤ 3.)
  const d = m === 1 ? E[0] : m === 2 ? E[0] * E[3] - E[1] * E[2]
    : E[0] * (E[4] * E[8] - E[5] * E[7]) - E[1] * (E[3] * E[8] - E[5] * E[6]) + E[2] * (E[3] * E[7] - E[4] * E[6]);
  return Math.sqrt(Math.max(0, d));
}
