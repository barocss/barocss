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
//   sweep      no two parts touch anywhere through the cycle: pair by pair, certified between the poses (below)
//   masses     every part has a material and a mass; the engine's mass in range
//   balance    the crank's counterweights: the balance factor in range
//   outputs    every made part has a process, its manufacturability report, a dimensioned drawing without errors and,
//              cast, its pattern's inputs; machined, its CAM package (or a typed wait for a person's stock list); the
//              assembly's BOM lists every part, its mass the parts' own
//
// Run: node examples/products/engine-1cyl/run.mjs --check <doc.bcad>
import { readFileSync } from 'node:fs';
import type { StudioDoc } from '../../../packages/barocss-cad-model/src/engine/doc';
import { BarocssError, part } from '../../../packages/barocss-cad-model/src/api';
import { viewOf } from '../../../packages/barocss-cad-model/src/api/robotCore';
import { treeOf, sweepLinksOf } from '../../../packages/barocss-cad-model/src/robot/verbs';
import { convexDistance, meshClearance, spurGearDimensions, triangleBvh, type TriangleBvh } from '@barocss/cad';
import { forwardKinematics, type FkResult, type Motion } from '../../../packages/barocss-cad-model/src/robot/fk';
import { pathTo } from '../../../packages/barocss-cad-model/src/robot/ik';
import { partParent, type SweepLink } from '../../../packages/barocss-cad-model/src/robot/sweep';
import type { Joint, JointTree } from '../../../packages/barocss-cad-model/src/robot/joints';
import { solveDoc } from '../../../packages/barocss-cad-model/src/assembly/edit';
import { tablesFor } from '../../../packages/barocss-cad-model/src/assembly/faces';
import { BASE, type MateFace } from '../../../packages/barocss-cad-model/src/assembly/mates';
import { rotationMatrix } from '../../../packages/barocss-cad-model/src/engine/placement';
import { madeBodies } from '../../../packages/barocss-cad-model/src/engine/elements';
import { bodiesOf } from '../../../packages/barocss-cad-model/src/api/core';
import { drawingOf, manufacturabilityOf, outputOf } from '../../../packages/barocss-cad-model/src/api/outputs';

type V3 = [number, number, number];

/** The brief's numbers (brief.md): what the checks hold a design to. */
export const BRIEF = {
  displacement: [110000, 135000] as const,
  /** The counterweights' share of the reciprocating mass, on top of all the turning mass. */
  balanceFactor: [0.4, 0.8] as const,
  /** The modelled parts together, dry. */
  mass: [3000, 12000] as const,
  /** The camshaft's turns per crank turn. */
  camRatio: 0.5,
  step: 5,
};

export interface Check { id: string; ok: boolean; detail: string; ms: number }
export interface EngineFigures {
  stroke?: number; bore?: number; displacement?: number; crankRadius?: number;
  mass?: number; reciprocating?: number; rotating?: number; counterweightMoment?: number; balanceFactor?: number;
  camRatio?: number; minClearance?: number; cycleSteps?: number; maxLoopResidual?: number;
  drawings?: number; dimensions?: number; reports?: number; findings?: number; camPackages?: number; camWaiting?: number; bomLines?: number;
}
/** What the outputs check made of each made part (its report's failing rules are findings, said, not the check's failure). */
export interface PartOutputs { part: string; process: string | null; dimensions: number; drawingErrors: string[]; findings: string[]; cam?: 'made' | 'waiting' | string }
/** An output file, when the check is asked to keep them (`files`): its path under the outputs' folder and its bytes or text. */
export interface OutputFile { path: string; data: string | Uint8Array }
export interface EngineCheck { ok: boolean; checks: Check[]; figures: EngineFigures; parts?: PartOutputs[]; files?: OutputFile[]; ms: number }

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
  if (f.kind === 'plane') return { kind: 'plane', point: placed(R, t, f.point), normal: placed(R, [0, 0, 0], f.normal) };
  if (f.kind === 'cylinder') return { ...f, point: placed(R, t, f.point), axis: placed(R, [0, 0, 0], f.axis) };
  throw new BarocssError('P1_MATE_KIND', `[P1_MATE_KIND] the engine oracle checks planar and cylindrical mate faces; ${part}/${face} is ${f.kind}`, 'evaluate');
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
        const m = sp.body(key).mass(), w = placed(p.R, p.t, m.centroid);
        g += m.mass; c = [c[0] + m.mass * w[0], c[1] + m.mass * w[1], c[2] + m.mass * w[2]];
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

// ── the sweep, pair by pair ──
// The core's sweep_path advances all pairs together, each step as short as the tightest pair allows, so a piston ring
// 0.05 from its bore makes every pair crawl; and its display meshes put a bore's chord 0.13 inside the circle (PG-6), so
// a running fit reads as contact. Here each pair of parts that moves relative to the other is certified on its own
// between the cycle's poses: with clearances d0, d1 at two poses and no point of either part travelling more than m
// between them (the chord of its hull's corners, 1 % over for the arc), there is no contact between if d0 + d1 > m;
// else the interval is halved (the loop closed at the middle angle) and each half checked, down to 1/1024 of a step.
// A pair's designed seats are left out of its meshes, as O22's sweep leaves meshing teeth out: a running fit — each
// part's triangles lying within the fit's chord tolerance of a concentric mate's cylinder between their rigid groups —
// and the zone of meshing gears' teeth (root to tip about each joint's axis). Parent and child of a joint seated on a
// flat mate (coincident, or a distance of 0) are not checked, as the core's sweep checks no parent and child; nor a
// follower no joint drives against its camshaft (PG-5).
const CONTACT = 1e-6, DEPTH = 10, ARC = 1.01;
/** The chord a display mesh's facets put inside a circle of radius r (8 segments a quarter turn), and a margin. */
const band = (r: number) => r * (1 - Math.cos(Math.PI / 32)) + 0.05;
interface Ring { o: V3; d: V3; lo: number; hi: number }
/** Gear teeth: the disc within the tip radius about the joint's axis, over the axial span the teeth have (O22's zone). */
interface Disc { o: V3; d: V3; ra: number; rf: number }
/** A pair's meshes to check: triangle sets of each, one or more (a gear zone against the other's rest only). */
interface SubCheck { ia: Uint32Array; ib: Uint32Array; ka: string; kb: string }
interface PairCheck { a: SweepLink; b: SweepLink; checks: SubCheck[] }
interface Pose { deg: number; q: Record<string, number>; fk: FkResult; pos: Map<string, Float64Array>; hull: Map<string, Float64Array>; bvh: Map<string, TriangleBvh> }

/** The triangles of a link not lying wholly in any of the rings (radial bands about axes, world at home). */
function outside(l: SweepLink, rings: readonly Ring[]): Uint32Array {
  if (!rings.length) return l.indices;
  const P = l.positions, I = l.indices, keep: number[] = [];
  for (let t = 0; t < I.length; t += 3) {
    let inAny = false;
    for (const g of rings) {
      let all = true;
      for (let c = 0; c < 3 && all; c++) {
        const v = I[t + c] * 3, x = P[v] - g.o[0], y = P[v + 1] - g.o[1], z = P[v + 2] - g.o[2], a = x * g.d[0] + y * g.d[1] + z * g.d[2];
        const rho = Math.hypot(x - a * g.d[0], y - a * g.d[1], z - a * g.d[2]);
        all = rho >= g.lo && rho <= g.hi;
      }
      if (all) { inAny = true; break; }
    }
    if (!inAny) keep.push(I[t], I[t + 1], I[t + 2]);
  }
  return Uint32Array.from(keep);
}
/** A link's triangles split at a gear disc: inside it over the teeth's span (the zone), and the rest. */
function splitDisc(l: SweepLink, set: Uint32Array, g: Disc): { zone: Uint32Array; rest: Uint32Array } {
  const P = l.positions, nv = P.length / 3, rho = new Float64Array(nv), h = new Float64Array(nv), tol = band(g.ra);
  let lo = Infinity, hi = -Infinity;
  for (let v = 0; v < nv; v++) {
    const x = P[v * 3] - g.o[0], y = P[v * 3 + 1] - g.o[1], z = P[v * 3 + 2] - g.o[2], a = x * g.d[0] + y * g.d[1] + z * g.d[2];
    h[v] = a; rho[v] = Math.hypot(x - a * g.d[0], y - a * g.d[1], z - a * g.d[2]);
    if (rho[v] >= g.rf - tol && rho[v] <= g.ra + tol) { lo = Math.min(lo, a); hi = Math.max(hi, a); }
  }
  const zone: number[] = [], rest: number[] = [];
  for (let t = 0; t < set.length; t += 3) {
    let inZone = true;
    for (let c = 0; c < 3 && inZone; c++) { const v = set[t + c]; inZone = rho[v] <= g.ra + tol && h[v] >= lo - tol && h[v] <= hi + tol; }
    (inZone ? zone : rest).push(set[t], set[t + 1], set[t + 2]);
  }
  return { zone: Uint32Array.from(zone), rest: Uint32Array.from(rest) };
}
const posed = (m: Motion, home: Float64Array): Float64Array => {
  const out = new Float64Array(home.length), R = m.R, t = m.t;
  for (let i = 0; i < home.length; i += 3) { const x = home[i], y = home[i + 1], z = home[i + 2]; out[i] = R[0] * x + R[1] * y + R[2] * z + t[0]; out[i + 1] = R[3] * x + R[4] * y + R[5] * z + t[1]; out[i + 2] = R[6] * x + R[7] * y + R[8] * z + t[2]; }
  return out;
};
function poseOf(tree: JointTree, deg: number, q: Record<string, number>): Pose {
  return { deg, q, fk: forwardKinematics(tree, q), pos: new Map(), hull: new Map(), bvh: new Map() };
}
function hullAt(p: Pose, l: SweepLink): Float64Array {
  let h = p.hull.get(l.link);
  if (!h) p.hull.set(l.link, h = posed(motionOf(p.fk, l.link), l.hull));
  return h;
}
function bvhAt(p: Pose, key: string, positions: Float64Array, set: Uint32Array): TriangleBvh {
  let b = p.bvh.get(key);
  if (!b) p.bvh.set(key, b = triangleBvh(positions, set));
  return b;
}
function positionsAt(p: Pose, l: SweepLink): Float64Array {
  let x = p.pos.get(l.link);
  if (!x) p.pos.set(l.link, x = posed(motionOf(p.fk, l.link), l.positions));
  return x;
}
function clearance(p: Pose, c: PairCheck): number {
  const d = convexDistance(hullAt(p, c.a), hullAt(p, c.b));
  if (d > CONTACT) return d;
  const pa = positionsAt(p, c.a), pb = positionsAt(p, c.b);
  let least = Infinity;
  for (const k of c.checks) {
    if (!k.ia.length || !k.ib.length) continue;
    least = Math.min(least, meshClearance(pa, k.ia, pb, k.ib, { bvhA: bvhAt(p, k.ka, pa, k.ia), bvhB: bvhAt(p, k.kb, pb, k.ib) }).distance);
  }
  return least;
}
/** The most any corner of a link's hull travels between two poses (the chord, ARC over for the arc between). */
function travel(p0: Pose, p1: Pose, l: SweepLink): number {
  const h0 = hullAt(p0, l), h1 = hullAt(p1, l);
  let m = 0;
  for (let i = 0; i < h0.length; i += 3) m = Math.max(m, Math.hypot(h1[i] - h0[i], h1[i + 1] - h0[i + 1], h1[i + 2] - h0[i + 2]));
  return ARC * m;
}

interface SweepState { tree: JointTree; terms: readonly Term[]; unknowns: readonly string[]; driver: string; poses: number; least: { mm: number; deg: number; links: [string, string] } | null }
/** A pair between two poses: clear, or the angle of its first contact. */
function certify(s: SweepState, c: PairCheck, p0: Pose, p1: Pose, d0: number, d1: number, depth: number): number | null {
  if (d0 <= CONTACT) return p0.deg;
  if (d1 <= CONTACT) return p1.deg;
  if (d0 + d1 > travel(p0, p1, c.a) + travel(p0, p1, c.b)) return null;
  if (depth >= DEPTH) return (p0.deg + p1.deg) / 2;
  const deg = (p0.deg + p1.deg) / 2, q = { ...p0.q, [s.driver]: deg * Math.PI / 180 };
  close(s.tree, s.terms, s.unknowns, q); s.poses++;
  const pm = poseOf(s.tree, deg, q), dm = clearance(pm, c);
  if (!s.least || dm < s.least.mm) s.least = { mm: dm, deg, links: [c.a.link, c.b.link] };
  return certify(s, c, p0, pm, d0, dm, depth + 1) ?? certify(s, c, pm, p1, dm, d1, depth + 1);
}

/** Where a pair meets at an angle (the loop closed there): the point on each, world. */
function contactAt(s: SweepState, c: PairCheck, from: Record<string, number>, deg: number) {
  const q = { ...from, [s.driver]: deg * Math.PI / 180 };
  close(s.tree, s.terms, s.unknowns, q);
  const p = poseOf(s.tree, deg, q);
  const pa = positionsAt(p, c.a), pb = positionsAt(p, c.b);
  let m = { distance: Infinity, pointA: null as readonly [number, number, number] | null };
  for (const k of c.checks) { if (!k.ia.length || !k.ib.length) continue; const x = meshClearance(pa, k.ia, pb, k.ib); if (x.distance < m.distance) m = x; }
  return { deg, links: [c.a.link, c.b.link] as [string, string], at: m.pointA ? m.pointA.map(r3) as V3 : null, mm: m.distance };
}

/** The cycle swept pair by pair: the first contact, the least clearance, what was left out and why. */
function sweepCycle(tree: JointTree, links: readonly SweepLink[], solved: StudioDoc, cycle: { poses: Record<string, number>[]; terms: Term[]; unknowns: string[] }, driver: string, step: number, followers: readonly string[]) {
  const group = new Map<string, Set<string>>(), parentOf = new Map(tree.joints.map(j => [j.child, j.parent])), tables = tablesFor(solved);
  for (const l of links) group.set(l.link, rigidGroup(tree, l.link));
  const groupOf = (id: string) => group.get(id) ?? rigidGroup(tree, id);
  // (Each concentric mate's fit, and each coupling's teeth, as rings for the pairs between their rigid groups.)
  const fits: { ga: Set<string>; gb: Set<string>; ring: Ring }[] = [];
  for (const m of solved.mates ?? []) {
    if (m.kind !== 'concentric') continue;
    const fa = worldFace(solved, tables, m.a.part, m.a.face), fb = worldFace(solved, tables, m.b.part, m.b.face);
    if (fa?.kind !== 'cylinder' || fb?.kind !== 'cylinder') continue;
    const lo = Math.min(fa.radius, fb.radius), hi = Math.max(fa.radius, fb.radius);
    fits.push({ ga: groupOf(m.a.part), gb: groupOf(m.b.part), ring: { o: [...fb.point] as V3, d: unit(fb.axis), lo: lo - band(hi), hi: hi + band(hi) } });
  }
  const teeth: { ga: Set<string>; gb: Set<string>; da: Disc; db: Disc }[] = [];
  for (const c of tree.couplings) {
    const jl = tree.joints.find(j => j.key === c.leader)!, jf = tree.joints.find(j => j.key === c.follower)!, dl = spurGearDimensions(c.g1.spec), df = spurGearDimensions(c.g2.spec);
    teeth.push({ ga: groupOf(jl.child), gb: groupOf(jf.child), da: { o: jl.origin, d: unit(jl.axis), ra: dl.ra, rf: dl.rf }, db: { o: jf.origin, d: unit(jf.axis), ra: df.ra, rf: df.rf } });
  }
  const pairs: PairCheck[] = [], skipped: { links: [string, string]; why: string }[] = [];
  let seated = 0;
  const camGroups = tree.joints.filter(j => turning(j) && /cam-?shaft/.test((solved.instances ?? []).find(i => i.id === j.child)?.name.toLowerCase() ?? '')).map(j => groupOf(j.child));
  for (let i = 0; i < links.length; i++) for (let k = i + 1; k < links.length; k++) {
    const a = links[i], b = links[k], ga = groupOf(a.link);
    if (ga.has(b.link)) continue;
    const pair: [string, string] = [a.link, b.link];
    if (partParent(parentOf, a.link) === b.link || partParent(parentOf, b.link) === a.link) {
      const flat = (solved.mates ?? []).some(m => [m.a.part, m.b.part].includes(a.link) && [m.a.part, m.b.part].includes(b.link) && (m.kind === 'coincident' || (m.kind === 'distance' && Math.abs(m.distance ?? 0) < 1e-9)));
      if (flat) { skipped.push({ links: pair, why: 'parent and child seated on a flat mate' }); continue; }
    }
    const parked = followers.find(f => f === a.link || f === b.link);
    if (parked && camGroups.some(g => g.has(parked === a.link ? b.link : a.link))) { skipped.push({ links: pair, why: 'a follower no joint drives, on its cam (PG-5)' }); continue; }
    const rings: Ring[] = [];
    for (const f of fits) if ((f.ga.has(a.link) && f.gb.has(b.link)) || (f.gb.has(a.link) && f.ga.has(b.link))) rings.push(f.ring);
    const tooth = teeth.find(t => (t.ga.has(a.link) && t.gb.has(b.link)) || (t.gb.has(a.link) && t.ga.has(b.link)));
    if (rings.length || tooth) seated++;
    const tag = `@${a.link}|${b.link}`, sa = outside(a, rings), sb = outside(b, rings), ka = rings.length ? a.link + tag : a.link, kb = rings.length ? b.link + tag : b.link;
    if (!tooth) { pairs.push({ a, b, checks: [{ ia: sa, ib: sb, ka, kb }] }); continue; }
    // (Meshing gears: each one's teeth zone against the other's rest, and the rest against all — O22's seat.)
    const [da, db] = tooth.ga.has(a.link) ? [tooth.da, tooth.db] : [tooth.db, tooth.da], za = splitDisc(a, sa, da), zb = splitDisc(b, sb, db);
    pairs.push({ a, b, checks: [{ ia: za.rest, ib: sb, ka: `${a.link}${tag}:rest`, kb }, { ia: za.zone, ib: zb.rest, ka: `${a.link}${tag}:zone`, kb: `${b.link}${tag}:rest` }] });
  }
  const s: SweepState = { tree, terms: cycle.terms, unknowns: cycle.unknowns, driver, poses: cycle.poses.length, least: null };
  let p0 = poseOf(tree, 0, cycle.poses[0]), d0 = pairs.map(c => clearance(p0, c));
  for (let k = 0; k + 1 < cycle.poses.length; k++) {
    const p1 = poseOf(tree, (k + 1) * step, cycle.poses[k + 1]), d1 = pairs.map(c => clearance(p1, c));
    for (let n = 0; n < pairs.length; n++) {
      if (!s.least || d0[n] < s.least.mm) s.least = { mm: d0[n], deg: p0.deg, links: [pairs[n].a.link, pairs[n].b.link] };
      const hit = certify(s, pairs[n], p0, p1, d0[n], d1[n], 0);
      if (hit !== null) return { contact: contactAt(s, pairs[n], p0.q, hit), least: s.least, skipped, pairs: pairs.length, poses: s.poses, seated };
    }
    p0 = p1; d0 = d1;
  }
  return { contact: null, least: s.least, skipped, pairs: pairs.length, poses: s.poses, seated };
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
export async function checkEngine(doc: StudioDoc, o: { sweep?: boolean; step?: number; outputs?: boolean; files?: boolean } = {}): Promise<EngineCheck> {
  const t0 = performance.now(), checks: Check[] = [], figures: EngineFigures = {}, step = o.step ?? BRIEF.step;
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
  if (crankR !== undefined) figures.crankRadius = r3(crankR);

  // cycle
  const cycle = timed<{ poses: Record<string, number>[]; terms: Term[]; unknowns: string[] }>(checks, 'cycle', () => {
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
    const stroke = hi - lo, boreD = boreFace?.kind === 'cylinder' ? 2 * boreFace.radius : undefined, displacement = boreD ? Math.PI / 4 * boreD * boreD * stroke : undefined;
    Object.assign(figures, { stroke: r3(stroke), cycleSteps: out.length, maxLoopResidual: worst, ...(boreD ? { bore: r3(boreD) } : {}), ...(displacement ? { displacement: r3(displacement) } : {}) });
    const problems: string[] = [];
    if (!(stroke > 1)) problems.push(`the piston hardly moves (${r3(stroke)} mm)`);
    if (crankR !== undefined && Math.abs(stroke - 2 * crankR) > 0.01) problems.push(`stroke ${r3(stroke)} is not twice the crank radius ${r3(crankR)}`);
    if (Math.abs(at0 - hi) > 1e-6 && Math.abs(at0 - lo) > 1e-6) problems.push('the assembled pose is neither top nor bottom dead centre');
    if (displacement === undefined) problems.push('no bore: the piston has no round mate in its loop');
    else if (displacement < BRIEF.displacement[0] || displacement > BRIEF.displacement[1]) problems.push(`displacement ${r3(displacement)} mm³ is outside ${BRIEF.displacement.join('–')} mm³`);
    return { ok: !problems.length, detail: problems.length ? problems.join('; ') : `720° in ${step}° steps, the loop closed at each (worst ${worst.toExponential(1)} mm); stroke ${r3(stroke)}, bore ${r3(boreD!)}, ${r3(displacement!)} mm³`, value: { poses: out, terms, unknowns } };
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
    return { ok: Math.abs(ratio - BRIEF.camRatio) < 1e-9, detail: `camshaft at ${r3(ratio)} of the crank's turn (backlash ${r3(c.backlash)} mm, contact ratio ${r3(c.contactRatio)})` };
  });

  // sweep
  if (o.sweep !== false) timed(checks, 'sweep', () => {
    if (!cycle || !driver) return { ok: false, detail: 'no cycle to sweep' };
    const name = (id: string) => instances.find(i => i.id === id)?.name ?? id;
    const r = sweepCycle(tree, sweepLinksOf(view, tree), solved, cycle, driver.key, step, instances.filter(i => FOLLOWER.test(i.name.toLowerCase())).map(i => i.id));
    if (r.contact) return { ok: false, detail: `${name(r.contact.links[0])} touches ${name(r.contact.links[1])} at ${r3(r.contact.deg)}°${r.contact.at ? `, near (${r.contact.at.join(', ')}) mm` : ''}` };
    if (r.least) figures.minClearance = r3(r.least.mm);
    const notes = [...r.skipped.map(x => `${name(x.links[0])}–${name(x.links[1])}: ${x.why}`)];
    return { ok: true, detail: `no contact through 720° (${r.pairs} pairs, ${r.poses} poses with the subdivisions)${r.least ? `; least clearance ${r3(r.least.mm)} mm (${name(r.least.links[0])}–${name(r.least.links[1])} at ${r3(r.least.deg)}°)` : ''}${r.seated ? `; ${r.seated} pairs checked without their running fits' surfaces and gear teeth` : ''}${notes.length ? `; not checked: ${notes.join('; ')}` : ''}` };
  });

  // masses and balance
  const massProblems: string[] = [], masses = partMasses(solved, doc, massProblems), total = masses.reduce((s, m) => s + m.g, 0);
  timed(checks, 'masses', () => {
    figures.mass = r3(total);
    const empty = masses.filter(m => !(m.g > 0)).map(m => m.name), problems = [...massProblems, ...(empty.length ? [`no mass: ${empty.join(', ')}`] : [])];
    if (total < BRIEF.mass[0] || total > BRIEF.mass[1]) problems.push(`${r3(total)} g is outside ${BRIEF.mass.join('–')} g`);
    return { ok: !problems.length, detail: problems.length ? problems.join('; ') : `${masses.length} parts, ${r3(total)} g` };
  });
  timed(checks, 'balance', () => {
    if (!driver || !rodJoint || crankR === undefined || !pistonId || !rodId) return { ok: false, detail: 'no crank, rod and piston to balance' };
    const of = (ids: Set<string>) => masses.filter(m => ids.has(m.id)), sum = (ms: PartMass[]) => ms.reduce((s, m) => s + m.g, 0);
    const rod = sum(of(rigidGroup(tree, rodId))), recip = sum(of(rigidGroup(tree, pistonId))) + rod / 3, rot = rod * 2 / 3;
    // (The crank group's unbalance on the counterweights' side: −Σ m e, e the centre's offset toward the crankpin.)
    const axis = unit(driver.axis), u = unit(perp(sub(rodJoint.origin, driver.origin), axis));
    const U = -of(rigidGroup(tree, crankId!)).reduce((s, m) => s + m.g * dot(sub(m.centroid, driver.origin), u), 0);
    const bf = (U - rot * crankR) / (recip * crankR);
    Object.assign(figures, { reciprocating: r3(recip), rotating: r3(rot), counterweightMoment: r3(U), balanceFactor: r3(bf) });
    const ok = bf >= BRIEF.balanceFactor[0] && bf <= BRIEF.balanceFactor[1];
    return { ok, detail: `balance factor ${r3(bf)} (counterweights ${r3(U)} g·mm; turning ${r3(rot)} g, reciprocating ${r3(recip)} g at ${r3(crankR)} mm)${ok ? '' : `: outside ${BRIEF.balanceFactor.join('–')}`}` };
  });

  // outputs
  let parts: PartOutputs[] | undefined, files: OutputFile[] | undefined;
  if (o.outputs !== false) {
    const t1 = performance.now(), r = await outputsOf(doc, masses, o.files ? (files = []) : null);
    parts = r.parts;
    Object.assign(figures, r.figures);
    checks.push({ id: 'outputs', ok: !r.problems.length, detail: r.problems.length ? r.problems.slice(0, 6).join('; ') : r.detail, ms: Math.round(performance.now() - t1) });
  }

  return { ok: checks.every(c => c.ok), checks, figures, ...(parts ? { parts } : {}), ...(files ? { files } : {}), ms: Math.round(performance.now() - t0) };
}

// ── outputs: each made part's, and the assembly's BOM ──
const CAST_PROCESSES = new Set(['die-casting', 'sand-casting']), MACHINED = new Set(['cnc-milling', 'cnc-turning']);
const message = (e: unknown) => e instanceof Error ? e.message : String(e);
const codeOf = (e: unknown) => (e as { code?: string })?.code;
const jsonText = (v: unknown) => JSON.stringify(v, null, 1) + '\n';
/** An output tool's first file's text (bom.json, purchase.csv, cam-package.json). */
const fileText = (content: Record<string, unknown>) => ((content.files as { text?: string }[] | undefined)?.[0]?.text) ?? jsonText(content);
async function partOutputs(name: string, d: StudioDoc, files: OutputFile[] | null): Promise<{ out: PartOutputs; problems: string[] }> {
  const problems: string[] = [], out: PartOutputs = { part: name, process: d.process ?? null, dimensions: 0, drawingErrors: [], findings: [] };
  if (!d.process) problems.push(`${name}: no process (the Library panel's Process)`);
  try {
    const report = await manufacturabilityOf(d);
    files?.push({ path: `${name}/manufacturability.json`, data: jsonText(report) });
    out.findings = report.rules.filter(r => r.status === 'fail').map(r => `${r.id}: ${r.message}`);
    if (CAST_PROCESSES.has(d.process ?? '') && !d.casting?.machined?.length) problems.push(`${name}: cast, with no pattern inputs (set_casting: its machined faces)`);
  } catch (e) { problems.push(`${name}: no manufacturability report — ${message(e)}`); }
  try {
    const dr = drawingOf(d);
    files?.push({ path: `${name}/drawing.svg`, data: dr.svg }, { path: `${name}/drawing.dxf`, data: dr.dxf }, { path: `${name}/drawing.pdf`, data: dr.pdf });
    out.dimensions = (dr.sheet.dimensions as unknown[] | undefined)?.length ?? 0;
    out.drawingErrors = dr.issues.filter(i => i.severity === 'error').map(i => `${i.code}: ${i.message}`);
    if (!out.dimensions) problems.push(`${name}: its drawing has no dimensions (auto_dimension)`);
    if (out.drawingErrors.length) problems.push(`${name}: drawing errors — ${out.drawingErrors.join('; ')}`);
  } catch (e) { problems.push(`${name}: no drawing — ${message(e)}`); }
  if (MACHINED.has(d.process ?? '')) {
    try { const c = await outputOf(d, 'output_cam_package'); out.cam = 'made'; files?.push({ path: `${name}/cam-package.json`, data: fileText(c) }); } catch (e) {
      files?.push({ path: `${name}/cam-package.refused.txt`, data: `${message(e)}\n` });
      // (No stock is built in: the shop's list comes from a person's file — rows rule b. Without one the package waits.)
      if (codeOf(e) === 'STOCK_NONE_LOADED') out.cam = 'waiting';
      else { out.cam = message(e); problems.push(`${name}: no CAM package — ${message(e)}`); }
    }
  }
  return { out, problems };
}
async function outputsOf(doc: StudioDoc, masses: readonly PartMass[], files: OutputFile[] | null) {
  const problems: string[] = [], parts: PartOutputs[] = [];
  // (The BOM first: a part it lists whole as bought — a fastener, a catalogue part — is bought, not made here.)
  let lines = 0, bought = new Set<string>();
  try {
    const content = await outputOf(doc, 'output_bom'), bom = content.bom as { lines: { parts: string[]; kind?: string; source: string | null }[]; totalMass: number };
    files?.push({ path: 'bom.json', data: fileText(content) }, { path: 'purchase.csv', data: fileText(await outputOf(doc, 'output_purchase_csv')) });
    bought = new Set(bom.lines.filter(l => l.kind !== undefined || l.source !== null).flatMap(l => l.parts.filter(x => !x.includes(':'))));
    lines = bom.lines.length;
    const listed = new Set(bom.lines.flatMap(l => l.parts.map(x => x.split(':')[0])));
    const missing = (doc.instances ?? []).filter(i => !listed.has(i.id)).map(i => i.name);
    if (missing.length) problems.push(`the BOM leaves out ${missing.join(', ')}`);
    const total = masses.reduce((s, m) => s + m.g, 0);
    if (Math.abs(bom.totalMass - total) > 0.01 * total) problems.push(`the BOM's mass ${r3(bom.totalMass)} g is not the parts' ${r3(total)} g`);
  } catch (e) { problems.push(`no BOM — ${message(e)}`); }
  const made = [{ id: BASE, name: 'base', doc }, ...(doc.instances ?? []).map(i => ({ id: i.id, name: i.name, doc: i.doc }))]
    .filter(p => !bought.has(p.id) && p.doc.nodes.length && madeBodies(p.doc.nodes, bodiesOf(p.doc)).length);
  for (const p of made) { const r = await partOutputs(p.name, p.doc, files); parts.push(r.out); problems.push(...r.problems); }
  const findings = parts.reduce((n, p) => n + p.findings.length, 0), waiting = parts.filter(p => p.cam === 'waiting').map(p => p.part);
  const figures: EngineFigures = { drawings: parts.length, dimensions: parts.reduce((n, p) => n + p.dimensions, 0), reports: parts.length, findings, camPackages: parts.filter(p => p.cam === 'made').length, camWaiting: waiting.length, bomLines: lines };
  const detail = `${parts.length} made parts, each with its process, report and a dimensioned drawing (${figures.dimensions} dimensions); the BOM, ${lines} lines${findings ? `; ${findings} failing manufacturability rules, as findings: ${parts.filter(p => p.findings.length).map(p => `${p.part} (${p.findings.map(f => f.split(':')[0]).join(', ')})`).join(', ')}` : ''}${waiting.length ? `; CAM waits for a person's stock list (set_stock; PG-9): ${waiting.join(', ')}` : ''}`;
  return { problems, parts, figures, detail };
}

// (node run.mjs --check <doc.bcad>: the checks over a saved document, their report on stdout; exit 1 when one fails.)
if (process.argv[1]?.endsWith('check.mjs')) {
  const r = await checkEngine(JSON.parse(readFileSync(process.argv[2], 'utf8')) as StudioDoc, { sweep: !process.argv.includes('--no-sweep'), outputs: !process.argv.includes('--no-outputs') });
  console.log(JSON.stringify(r, null, 1));
  process.exitCode = r.ok ? 0 : 1;
}
