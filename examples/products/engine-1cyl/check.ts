// P1's checks: what a single-cylinder four-stroke engine document has to show, for any StudioDoc — this build's own
// engine.bcad or one an AI made from brief.md (P1-L3). Nothing here reads this build's bytes, ids or face names: parts
// are found by their names, the mechanism by the joint tree the core makes of the mates.
//
//   parts      every part the brief names is there (by name: crankshaft, connecting rod, piston …)
//   solves     the assembly's mates solve and the joint tree has no problems
//   cycle      the crank turns 720° (one four-stroke cycle) in 5° steps with the loops closed at every step — the
//              slider-crank's piston kept on its bore by the loop's own mates — and the stroke, bore and
//              displacement the brief asks for
//   timing     the camshaft follows the crank at 1:2 (a gear coupling the joint tree found)
//   sweep      no two parts touch anywhere through the cycle (the core's certified sweep, pose to pose)
//   masses     every part has a material and a mass; the engine's mass in range
//   balance    the crank's counterweights: the balance factor in range
//
// Run: node examples/products/engine-1cyl/run.mjs --check <doc.bcad>
import { readFileSync } from 'node:fs';
import type { StudioDoc } from '../../../packages/barocss-cad-model/src/engine/doc';
import { part } from '../../../packages/barocss-cad-model/src/api';
import { viewOf } from '../../../packages/barocss-cad-model/src/api/robotCore';
import { treeOf, sweepLinksOf, type RobotView } from '../../../packages/barocss-cad-model/src/robot/verbs';
import { evaluateDoc, type BodyResult } from '../../../packages/barocss-cad-model/src/engine/evaluate';
import { forwardKinematics, type Motion } from '../../../packages/barocss-cad-model/src/robot/fk';
import { pathTo } from '../../../packages/barocss-cad-model/src/robot/ik';
import { sweepPath } from '../../../packages/barocss-cad-model/src/robot/sweep';
import type { Joint, JointTree } from '../../../packages/barocss-cad-model/src/robot/joints';
import { solveDoc } from '../../../packages/barocss-cad-model/src/assembly/edit';
import { tablesFor } from '../../../packages/barocss-cad-model/src/assembly/faces';
import { BASE, type MateFace } from '../../../packages/barocss-cad-model/src/assembly/mates';
import { rotationMatrix } from '../../../packages/barocss-cad-model/src/engine/placement';

type V3 = [number, number, number];

/** The brief's numbers (brief.md): what the checks hold a design to. */
export const BRIEF = {
  displacementCC: [110, 135] as const,
  /** The counterweights' share of the reciprocating mass, on top of all the turning mass. */
  balanceFactor: [0.4, 0.8] as const,
  /** The modelled parts together, dry. */
  massKg: [3, 12] as const,
  /** The camshaft's turns per crank turn. */
  camRatio: 0.5,
  stepDeg: 5,
  /**
   * The sweep's meshes: segments per quarter turn. The display's 8 put a chord 0.13 inside a bore of 28 — more than a
   * piston's running clearance — so the sweep tessellates finer (24: 0.015) and a running fit reads as one (PG-6).
   */
  sweepQuality: 24,
};

export interface Check { id: string; ok: boolean; detail: string; ms: number }
export interface EngineFigures {
  strokeMM?: number; boreMM?: number; displacementCC?: number; crankRadiusMM?: number;
  massKg?: number; reciprocatingG?: number; rotatingG?: number; counterweightGMM?: number; balanceFactor?: number;
  camRatio?: number; minClearanceMM?: number; cycleSteps?: number; maxLoopResidualMM?: number;
}
export interface EngineCheck { ok: boolean; checks: Check[]; figures: EngineFigures; ms: number }

// ── parts, by name ──
interface Role { role: string; min: number; test: (name: string) => boolean }
const ROLES: readonly Role[] = [
  { role: 'crankshaft', min: 1, test: n => /crank-?shaft/.test(n) },
  { role: 'connecting rod', min: 1, test: n => /(^|[^a-z])rod/.test(n) },
  { role: 'piston', min: 1, test: n => /piston/.test(n) && !/pin|ring/.test(n) },
  { role: 'piston pin', min: 1, test: n => /pin/.test(n) && /piston|gudgeon|wrist/.test(n) },
  { role: 'piston rings', min: 2, test: n => /ring/.test(n) },
  { role: 'cylinder', min: 1, test: n => /cylinder|block|barrel/.test(n) && !/head/.test(n) },
  { role: 'cylinder head', min: 1, test: n => /head/.test(n) && !/bolt|screw|stud/.test(n) },
  { role: 'camshaft', min: 1, test: n => /cam-?shaft/.test(n) },
  { role: 'valves', min: 2, test: n => /valve/.test(n) && !/spring/.test(n) },
  { role: 'valve springs', min: 2, test: n => /spring/.test(n) },
  { role: 'crankcase', min: 1, test: n => /case/.test(n) && !/screw|bolt/.test(n) },
];
/** Followers, tappets, lifters: what a cam would drive (the core has no cam joint yet — PG-5). */
const FOLLOWER = /follower|tappet|lifter/;

// ── small vector helpers (module level: they run per pose) ──
const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: readonly number[]): V3 => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const point = (m: Motion, p: readonly number[]): V3 => [m.R[0] * p[0] + m.R[1] * p[1] + m.R[2] * p[2] + m.t[0], m.R[3] * p[0] + m.R[4] * p[1] + m.R[5] * p[2] + m.t[1], m.R[6] * p[0] + m.R[7] * p[1] + m.R[8] * p[2] + m.t[2]];
const vector = (m: Motion, v: readonly number[]): V3 => [m.R[0] * v[0] + m.R[1] * v[1] + m.R[2] * v[2], m.R[3] * v[0] + m.R[4] * v[1] + m.R[5] * v[2], m.R[6] * v[0] + m.R[7] * v[1] + m.R[8] * v[2]];
const placed = (R: readonly number[], t: readonly number[], p: readonly number[]): V3 => [R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + t[0], R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + t[1], R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + t[2]];
const perp = (v: readonly number[], axis: readonly number[]): V3 => { const k = dot(v, axis); return [v[0] - k * axis[0], v[1] - k * axis[1], v[2] - k * axis[2]]; };
const r3 = (v: number) => Math.round(v * 1000) / 1000;

// ── the loops' closure: each loop's mates, as they hold at the assembled pose, held again at every crank angle ──
/** A loop's mate between parts a and b, world at the assembled pose: a's axis (two points) on b's line, or a's point at b's plane's distance. */
interface Term { a: string; b: string; kind: 'line' | 'plane'; p0: V3; p1: V3; o: V3; d: V3; at0: number }

function worldFace(doc: StudioDoc, tables: ReturnType<typeof tablesFor>, part: string, face: string): MateFace | undefined {
  const f = tables(part)?.[face];
  if (!f) return undefined;
  const inst = (doc.instances ?? []).find(i => i.id === part), R = inst ? rotationMatrix(inst.rotation) : [1, 0, 0, 0, 1, 0, 0, 0, 1], t = inst ? inst.position : [0, 0, 0];
  return f.kind === 'plane' ? { kind: 'plane', point: placed(R, t, f.point), normal: placed(R, [0, 0, 0], f.normal) }
    : { ...f, point: placed(R, t, f.point), axis: placed(R, [0, 0, 0], f.axis) };
}

function loopTerms(solved: StudioDoc, tree: JointTree): Term[] {
  const tables = tablesFor(solved), out: Term[] = [];
  for (const loop of tree.loops) for (const id of loop.mates) {
    const m = (solved.mates ?? []).find(x => x.id === id);
    if (!m) continue;
    const fa = worldFace(solved, tables, m.a.part, m.a.face), fb = worldFace(solved, tables, m.b.part, m.b.face);
    if (!fa || !fb) continue;
    if (m.kind === 'concentric' && fa.kind === 'cylinder' && fb.kind === 'cylinder') {
      const ax = unit(fa.axis), p1: V3 = [fa.point[0] + 20 * ax[0], fa.point[1] + 20 * ax[1], fa.point[2] + 20 * ax[2]];
      out.push({ a: m.a.part, b: m.b.part, kind: 'line', p0: [...fa.point] as V3, p1, o: [...fb.point] as V3, d: unit(fb.axis), at0: 0 });
    } else if ((m.kind === 'coincident' || m.kind === 'distance') && fa.kind === 'plane' && fb.kind === 'plane') {
      const n = unit(fb.normal);
      out.push({ a: m.a.part, b: m.b.part, kind: 'plane', p0: [...fa.point] as V3, p1: [...fa.point] as V3, o: [...fb.point] as V3, d: n, at0: dot(sub(fa.point, fb.point), n) });
    }
  }
  return out;
}

const motionOf = (fk: { motions: Map<string, Motion> }, link: string) => fk.motions.get(link)!;
/** The terms' residuals at q, into r (each line term 6, each plane term 1); the sum of squares. */
function residual(tree: JointTree, terms: readonly Term[], q: Readonly<Record<string, number>>, r: Float64Array): number {
  const fk = forwardKinematics(tree, q);
  let k = 0, ss = 0;
  for (const t of terms) {
    const A = motionOf(fk, t.a), B = motionOf(fk, t.b), o = point(B, t.o), d = vector(B, t.d);
    if (t.kind === 'line') {
      for (const p of [t.p0, t.p1]) { const v = perp(sub(point(A, p), o), d); r[k++] = v[0]; r[k++] = v[1]; r[k++] = v[2]; }
    } else r[k++] = dot(sub(point(A, t.p0), o), d) - t.at0;
  }
  for (let i = 0; i < k; i++) ss += r[i] * r[i];
  return ss;
}
const termRows = (terms: readonly Term[]) => terms.reduce((n, t) => n + (t.kind === 'line' ? 6 : 1), 0);

/** Solves the small normal equations (JᵀJ + λI) x = b in place (n ≤ a handful): Gaussian elimination with pivoting. */
function solveSmall(A: Float64Array, b: Float64Array, n: number): boolean {
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r * n + c]) > Math.abs(A[piv * n + c])) piv = r;
    if (!(Math.abs(A[piv * n + c]) > 1e-300)) return false;
    if (piv !== c) { for (let k = 0; k < n; k++) { const t = A[c * n + k]; A[c * n + k] = A[piv * n + k]; A[piv * n + k] = t; } const t = b[c]; b[c] = b[piv]; b[piv] = t; }
    for (let r = c + 1; r < n; r++) { const f = A[r * n + c] / A[c * n + c]; for (let k = c; k < n; k++) A[r * n + k] -= f * A[c * n + k]; b[r] -= f * b[c]; }
  }
  for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r * n + k] * b[k]; b[r] = s / A[r * n + r]; }
  return true;
}

/** The loops closed with the driver at its value: the unknowns moved by damped Gauss–Newton from q (the previous pose). */
function close(tree: JointTree, terms: readonly Term[], unknowns: readonly string[], q: Record<string, number>): number {
  const m = termRows(terms), n = unknowns.length, r = new Float64Array(m), r2 = new Float64Array(m), J = new Float64Array(m * n), A = new Float64Array(n * n), b = new Float64Array(n);
  for (const k of unknowns) q[k] ??= 0;
  let ss = residual(tree, terms, q, r);
  for (let it = 0; it < 60 && ss > 1e-20 && n; it++) {
    for (let j = 0; j < n; j++) {
      const k = unknowns[j], was = q[k], h = 1e-7;
      q[k] = was + h; residual(tree, terms, q, r2); q[k] = was;
      for (let i = 0; i < m; i++) J[i * n + j] = (r2[i] - r[i]) / h;
    }
    for (let a = 0; a < n; a++) {
      for (let c = 0; c < n; c++) { let s = 0; for (let i = 0; i < m; i++) s += J[i * n + a] * J[i * n + c]; A[a * n + c] = s + (a === c ? 1e-12 : 0); }
      let s = 0; for (let i = 0; i < m; i++) s += J[i * n + a] * r[i]; b[a] = -s;
    }
    if (!solveSmall(A, b, n)) break;
    for (let j = 0; j < n; j++) q[unknowns[j]] += b[j];
    ss = residual(tree, terms, q, r);
  }
  return Math.sqrt(ss);
}

// ── masses: each part's bodies in its own materials, placed ──
interface PartMass { id: string; name: string; g: number; centroid: V3 }
function partMasses(solved: StudioDoc, base: StudioDoc, problems: string[]): PartMass[] {
  const out: PartMass[] = [];
  const parts = [{ id: BASE, name: 'base', doc: base, R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }, ...(solved.instances ?? []).map(i => ({ id: i.id, name: i.name, doc: i.doc, R: rotationMatrix(i.rotation), t: i.position }))];
  for (const p of parts) {
    if (!p.doc.nodes.length) continue;
    let g = 0, c: V3 = [0, 0, 0];
    try {
      const sp = part(p.name, p.doc);
      for (const key of sp.bodies()) {
        const m = sp.body(key).mass(), w = placed(p.R, p.t, m.centroidMM);
        g += m.massG; c = [c[0] + m.massG * w[0], c[1] + m.massG * w[1], c[2] + m.massG * w[2]];
      }
    } catch (e) { problems.push(`${p.name}: ${e instanceof Error ? e.message : String(e)}`); continue; }
    out.push({ id: p.id, name: p.name, g, centroid: g > 0 ? [c[0] / g, c[1] / g, c[2] / g] : c });
  }
  return out;
}
/** The links held to `link` by fixed joints (its locked parts, and theirs). */
function rigidGroup(tree: JointTree, link: string): Set<string> {
  const out = new Set([link]), queue = [link];
  while (queue.length) {
    const l = queue.pop()!;
    for (const j of tree.joints) {
      if (j.type !== 'fixed') continue;
      const other = j.parent === l ? j.child : j.child === l ? j.parent : null;
      if (other !== null && !out.has(other)) { out.add(other); queue.push(other); }
    }
  }
  return out;
}

/** The robot's view with its meshes at a quality of the sweep's own (the facade's viewOf at the display's). */
function sweepView(doc: StudioDoc, solved: StudioDoc, quality: number): RobotView {
  const own = (d: StudioDoc): readonly BodyResult[] => {
    if (!d.nodes.length) return [];
    const r = evaluateDoc(d, 1, quality);
    if (!r.ok) throw new Error(`${r.error.title}: ${r.error.detail}`);
    return r.bodies;
  };
  const parts = new Map<string, readonly BodyResult[]>();
  for (const inst of solved.instances ?? []) parts.set(inst.id, own(inst.doc));
  return { doc, bodies: own(doc), parts };
}

const turning = (j: Joint) => j.type === 'revolute' || j.type === 'continuous';
const timed = <T>(checks: Check[], id: string, run: () => { ok: boolean; detail: string; value?: T }): T | undefined => {
  const t0 = performance.now();
  let r: { ok: boolean; detail: string; value?: T };
  try { r = run(); } catch (e) { r = { ok: false, detail: e instanceof Error ? e.message : String(e) }; }
  checks.push({ id, ok: r.ok, detail: r.detail, ms: Math.round(performance.now() - t0) });
  return r.value;
};

/** The checks over a document (a StudioDoc whose instances are the engine's parts, as Save writes it). */
export function checkEngine(doc: StudioDoc, o: { sweep?: boolean; stepDeg?: number; sweepQuality?: number } = {}): EngineCheck {
  const t0 = performance.now(), checks: Check[] = [], figures: EngineFigures = {}, step = o.stepDeg ?? BRIEF.stepDeg;
  const instances = doc.instances ?? [], named = (role: Role) => instances.filter(i => role.test(i.name.toLowerCase()));

  // parts
  const found = new Map(ROLES.map(r => [r.role, named(r)]));
  timed(checks, 'parts', () => {
    const missing = ROLES.filter(r => found.get(r.role)!.length < r.min && !(r.role === 'crankcase' && doc.nodes.length));
    return { ok: !missing.length, detail: missing.length ? `missing: ${missing.map(r => `${r.role}${r.min > 1 ? ` (${r.min})` : ''}`).join(', ')}` : `${instances.length + (doc.nodes.length ? 1 : 0)} parts; every part the brief names is there` };
  });
  const one = (role: string) => found.get(role)?.[0]?.id;
  const crankId = one('crankshaft'), rodId = one('connecting rod'), pistonId = one('piston'), camId = one('camshaft');

  // solves
  const solvedR = solveDoc(doc), solved = solvedR.doc, view = viewOf(doc);
  const tree = timed(checks, 'solves', () => {
    const t = treeOf(view), bad = [...solvedR.problems.map(p => `${p.mate}: ${p.reason}`), ...t.problems.map(p => `[${p.code}] ${p.message}`)];
    return { ok: !bad.length, detail: bad.length ? bad.slice(0, 4).join(' · ') : `${(doc.mates ?? []).length} mates solve; ${t.joints.filter(j => j.type !== 'fixed').length} moving joints, ${t.loops.length} loop(s), ${t.couplings.length} gear coupling(s)`, value: t };
  });
  if (!tree) return { ok: false, checks, figures, ms: Math.round(performance.now() - t0) };
  const driver = tree.joints.find(j => turning(j) && j.child === crankId);
  const rodJoint = tree.joints.find(j => turning(j) && j.parent === crankId && (j.child === rodId || j.child.startsWith(`${rodId}__`)));
  const crankR = driver && rodJoint ? Math.hypot(...perp(sub(rodJoint.origin, driver.origin), unit(driver.axis))) : undefined;
  if (crankR !== undefined) figures.crankRadiusMM = r3(crankR);

  // cycle
  const poses = timed<Record<string, number>[]>(checks, 'cycle', () => {
    if (!driver) return { ok: false, detail: 'no turning joint carries the crankshaft' };
    if (!pistonId) return { ok: false, detail: 'no piston' };
    if (!tree.loops.length) return { ok: false, detail: 'no closed loop: the piston is not held in its bore by a second path (the slider-crank needs one)' };
    const terms = loopTerms(solved, tree), loopParts = new Set(tree.loops.flatMap(l => l.parts));
    const unknowns = [...new Set(tree.loops.flatMap(l => {
      const pa = pathTo(tree, l.parts[0]), pb = pathTo(tree, l.parts[1]), common = new Set(pa.filter(j => pb.includes(j)).map(j => j.key));
      return [...pa, ...pb].filter(j => !common.has(j.key) && j.type !== 'fixed' && !j.mimic && j.key !== driver.key).map(j => j.key);
    }))];
    if (!pathTo(tree, pistonId).some(j => j.key === driver.key) && !loopParts.has(pistonId)) return { ok: false, detail: 'the crank does not move the piston' };
    // (The bore: the piston's round mate in its loop — its axis the stroke's direction, the other side's radius the bore.)
    const bore = terms.find(t => t.kind === 'line' && (t.a === pistonId || t.b === pistonId));
    const tables = tablesFor(solved), borem = bore ? (solved.mates ?? []).find(m => tree.loops.some(l => l.mates.includes(m.id)) && m.kind === 'concentric' && (m.a.part === pistonId || m.b.part === pistonId)) : undefined;
    const other = borem ? (borem.a.part === pistonId ? borem.b : borem.a) : undefined, boreFace = other ? tables(other.part)?.[other.face] : undefined;
    const axis = bore ? bore.d : [0, 0, 1] as V3, inst = instances.find(i => i.id === pistonId)!, p0 = inst.position;
    const q: Record<string, number> = {}, out: Record<string, number>[] = [];
    let lo = Infinity, hi = -Infinity, worst = 0, at0 = 0;
    for (let deg = 0; deg <= 720 + 1e-9; deg += step) {
      q[driver.key] = deg * Math.PI / 180;
      const res = close(tree, terms, unknowns, q);
      if (!(res < 1e-6)) return { ok: false, detail: `the loop does not close at ${deg}° (residual ${res.toExponential(2)} mm)` };
      worst = Math.max(worst, res);
      const fk = forwardKinematics(tree, q), s = dot(sub(point(motionOf(fk, pistonId), p0), p0), axis);
      if (deg === 0) at0 = s;
      lo = Math.min(lo, s); hi = Math.max(hi, s);
      out.push({ ...q });
    }
    const stroke = hi - lo, boreD = boreFace?.kind === 'cylinder' ? 2 * boreFace.radius : undefined, cc = boreD ? Math.PI / 4 * boreD * boreD * stroke / 1000 : undefined;
    Object.assign(figures, { strokeMM: r3(stroke), cycleSteps: out.length, maxLoopResidualMM: worst, ...(boreD ? { boreMM: r3(boreD) } : {}), ...(cc ? { displacementCC: r3(cc) } : {}) });
    const problems: string[] = [];
    if (!(stroke > 1)) problems.push(`the piston hardly moves (${r3(stroke)} mm)`);
    if (crankR !== undefined && Math.abs(stroke - 2 * crankR) > 0.01) problems.push(`stroke ${r3(stroke)} is not twice the crank radius ${r3(crankR)}`);
    if (Math.abs(at0 - hi) > 1e-6 && Math.abs(at0 - lo) > 1e-6) problems.push('the assembled pose is neither top nor bottom dead centre');
    if (cc === undefined) problems.push('no bore: the piston has no round mate in its loop');
    else if (cc < BRIEF.displacementCC[0] || cc > BRIEF.displacementCC[1]) problems.push(`displacement ${r3(cc)} cc is outside ${BRIEF.displacementCC.join('–')} cc`);
    return { ok: !problems.length, detail: problems.length ? problems.join('; ') : `720° in ${step}° steps, the loop closed at each (worst ${worst.toExponential(1)} mm); stroke ${r3(stroke)}, bore ${r3(boreD!)}, ${r3(cc!)} cc`, value: out };
  });

  // timing
  timed(checks, 'timing', () => {
    const cam = tree.joints.find(j => turning(j) && j.child === camId);
    if (!driver || !cam) return { ok: false, detail: !cam ? 'no turning joint carries the camshaft' : 'no crank joint' };
    const c = tree.couplings.find(x => (x.leader === driver.key && x.follower === cam.key) || (x.leader === cam.key && x.follower === driver.key));
    if (!c) {
      const why = tree.notes.filter(n => n.code === 'GEAR_NOT_COUPLED').map(n => n.message);
      return { ok: false, detail: `the camshaft is not geared to the crank${why.length ? `: ${why.join(' ')}` : ' (no meshing gears on the two shafts themselves — a gear on a part locked to a shaft is not coupled, PG-4)'}` };
    }
    const ratio = c.leader === driver.key ? Math.abs(c.multiplier) : 1 / Math.abs(c.multiplier);
    figures.camRatio = r3(ratio);
    return { ok: Math.abs(ratio - BRIEF.camRatio) < 1e-9, detail: `camshaft at ${r3(ratio)} of the crank's turn (backlash ${r3(c.backlashMM)} mm, contact ratio ${r3(c.contactRatio)})` };
  });

  // sweep
  if (o.sweep !== false) timed(checks, 'sweep', () => {
    if (!poses) return { ok: false, detail: 'no cycle to sweep' };
    // (A follower no joint moves stays where it was put while the cam turns under it: left out, said so — PG-5.)
    const parked = new Set(instances.filter(i => FOLLOWER.test(i.name.toLowerCase()) && !tree.joints.some(j => j.type !== 'fixed' && (j.child === i.id || j.child.startsWith(`${i.id}__`)))).map(i => i.id));
    const links = sweepLinksOf(sweepView(doc, solved, o.sweepQuality ?? BRIEF.sweepQuality), tree).filter(l => !parked.has(l.link)), name = (id: string) => instances.find(i => i.id === id)?.name ?? id;
    let least: { mm: number; deg: number; links: [string, string] } | null = null;
    for (let k = 0; k + 1 < poses.length; k++) {
      const r = sweepPath(tree, links, poses[k], poses[k + 1]);
      if (!r.clear) return { ok: false, detail: `${name(r.contact!.links[0])} touches ${name(r.contact!.links[1])} at ${r3((k + r.contact!.s) * step)}°` };
      if (r.minClearance && (!least || r.minClearance.mm < least.mm)) least = { mm: r.minClearance.mm, deg: (k + r.minClearance.s) * step, links: r.minClearance.links };
    }
    if (least) figures.minClearanceMM = r3(least.mm);
    return { ok: true, detail: `no contact through 720°${least ? `; least clearance ${r3(least.mm)} mm (${name(least.links[0])}–${name(least.links[1])} at ${r3(least.deg)}°)` : ''}${parked.size ? `; left out: ${[...parked].map(name).join(', ')} (no cam joint, PG-5)` : ''}` };
  });

  // masses and balance
  const massProblems: string[] = [], masses = partMasses(solved, doc, massProblems), total = masses.reduce((s, m) => s + m.g, 0) / 1000;
  timed(checks, 'masses', () => {
    figures.massKg = r3(total);
    const empty = masses.filter(m => !(m.g > 0)).map(m => m.name), problems = [...massProblems, ...(empty.length ? [`no mass: ${empty.join(', ')}`] : [])];
    if (total < BRIEF.massKg[0] || total > BRIEF.massKg[1]) problems.push(`${r3(total)} kg is outside ${BRIEF.massKg.join('–')} kg`);
    return { ok: !problems.length, detail: problems.length ? problems.join('; ') : `${masses.length} parts, ${r3(total)} kg` };
  });
  timed(checks, 'balance', () => {
    if (!driver || !rodJoint || crankR === undefined || !pistonId || !rodId) return { ok: false, detail: 'no crank, rod and piston to balance' };
    const of = (ids: Set<string>) => masses.filter(m => ids.has(m.id)), sum = (ms: PartMass[]) => ms.reduce((s, m) => s + m.g, 0);
    const rod = sum(of(rigidGroup(tree, rodId))), recip = sum(of(rigidGroup(tree, pistonId))) + rod / 3, rot = rod * 2 / 3;
    // (The crank group's unbalance on the counterweights' side: −Σ m e, e the centre's offset toward the crankpin.)
    const axis = unit(driver.axis), u = unit(perp(sub(rodJoint.origin, driver.origin), axis));
    const U = -of(rigidGroup(tree, crankId!)).reduce((s, m) => s + m.g * dot(sub(m.centroid, driver.origin), u), 0);
    const bf = (U - rot * crankR) / (recip * crankR);
    Object.assign(figures, { reciprocatingG: r3(recip), rotatingG: r3(rot), counterweightGMM: r3(U), balanceFactor: r3(bf) });
    const ok = bf >= BRIEF.balanceFactor[0] && bf <= BRIEF.balanceFactor[1];
    return { ok, detail: `balance factor ${r3(bf)} (counterweights ${r3(U)} g·mm; turning ${r3(rot)} g, reciprocating ${r3(recip)} g at ${r3(crankR)} mm)${ok ? '' : `: outside ${BRIEF.balanceFactor.join('–')}`}` };
  });

  return { ok: checks.every(c => c.ok), checks, figures, ms: Math.round(performance.now() - t0) };
}

// (node run.mjs --check <doc.bcad>: the checks over a saved document, their report on stdout; exit 1 when one fails.)
if (process.argv[1]?.endsWith('check.mjs')) {
  const r = checkEngine(JSON.parse(readFileSync(process.argv[2], 'utf8')) as StudioDoc, { sweep: !process.argv.includes('--no-sweep') });
  console.log(JSON.stringify(r, null, 1));
  process.exitCode = r.ok ? 0 : 1;
}
