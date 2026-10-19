// The robot joint tree (RM1, O14): an assembly's mate graph read as links and joints, from a chosen base link.
// Each pair of parts with mates between them is one joint; what it lets the child do relative to its parent is read
// from the mates' first-order constraints at the solved pose (their null space: the free twists), not from the mate
// kinds by name — so any mate combination the solver accepts is classified the same way:
//   no freedom → fixed; one turn → revolute (continuous without limits); one slide → prismatic;
//   a turn and the slide along its axis → cylindrical, two turns and … → a chain of 1-DoF joints through dummy links
//   (slides first, then the turn: planar = two slides and a turn; ball = three turns about one point);
//   anything else (a screw motion, two turns on different axes, more) → MOTION_UNSUPPORTED, typed, never guessed.
// A pair of parts joined twice round the graph is a loop: the tree keeps one path and reports the other as a loop with
// its mates (closed loops are RM8's), never dropped. Two meshing spur gears on revolute joints of one carrier are a
// coupled pair: the second mimics the first, ratio −z1/z2, from the kernel's checkPlacedSpurGears (D56).
// Conventions (onshape-to-robot): one link a part, the joint at the child, angles in radians, lengths in mm here
// (export, RM4, writes metres); joint values are 0 at the pose the mates solve to.
import { checkPlacedSpurGears, spurGearDimensions, type GearPlacement } from '@barocss/cad';
import type { PartInstance, StudioDoc } from '../engine/doc';
import { BASE, rotationMatrix, type FaceTable, type Mate, type MateFace, type Vec3 } from '../assembly/mates';
import { add, cross, dot, len, sub } from '../engine/vec3';

export const ROBOT_VERSION = 1;
export type JointType = 'fixed' | 'revolute' | 'continuous' | 'prismatic';
/** A joint's limits and ratings, as the person sets them (radians or mm; N·m or N; rad/s or mm/s). */
export interface JointSettings { lower?: number; upper?: number; effort?: number; velocity?: number }
/** The robot settings a document keeps (`doc.robot`, versioned): the base link, and each joint's settings by its key. */
export interface RobotSettings { version: 1; base?: string; joints?: Record<string, JointSettings> }

export interface Link { id: string; /** The part it is (base or an instance id); null for a dummy link in a joint chain. */ part: string | null; name: string }
export interface Joint {
  /**
   * The pair's two parts in the document's order (`base~p1`, whichever is the parent), a chain's joints `#0`, `#1`, …:
   * the settings' keys, so they stay when the base link changes.
   */
  key: string; type: JointType; parent: string; child: string;
  /** A point on the axis (the child's origin projected onto it) and the axis, world frame, mm. */
  origin: Vec3; axis: Vec3;
  limit?: { lower?: number; upper?: number; effort?: number; velocity?: number };
  /** The mates this pair's joint is made of. */
  mates: string[];
  /** Coupled to another joint (two meshing gears): this = multiplier × that + offset. */
  mimic?: { joint: string; multiplier: number; offset: number };
}
export type RobotCode = 'NOT_CONNECTED' | 'MOTION_UNSUPPORTED' | 'BASE_UNKNOWN' | 'MATE_PROBLEM' | 'LIMITS_MISSING' | 'LIMITS_BAD' | 'GEAR_NOT_COUPLED';
export interface RobotIssue { code: RobotCode; message: string; parts?: string[]; mates?: string[]; joint?: string }
export interface Loop { parts: [string, string]; mates: string[]; freedom: number; message: string }
export interface Coupling { leader: string; follower: string; multiplier: number; centerDistanceMM: number; nominalCenterDistanceMM: number; backlashMM: number; contactRatio: number }
export interface JointTree {
  version: 1; base: string; links: Link[]; joints: Joint[];
  /** Pairs joined again round the graph: kept as loop closures, with their mates. */
  loops: Loop[];
  couplings: Coupling[];
  /** What blocks a link or a joint (typed); `notes`: what an export will need (limits) or could not couple. */
  problems: RobotIssue[]; notes: RobotIssue[];
}

/** The settings as read from a document (absent: none; anything malformed dropped, the rest kept). */
export function readRobot(raw: unknown): RobotSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<RobotSettings>, joints: Record<string, JointSettings> = {};
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  for (const [k, s] of Object.entries(r.joints && typeof r.joints === 'object' ? r.joints : {})) {
    if (!s || typeof s !== 'object') continue;
    const j: JointSettings = {};
    for (const f of ['lower', 'upper', 'effort', 'velocity'] as const) if (num((s as JointSettings)[f])) j[f] = (s as JointSettings)[f];
    if (Object.keys(j).length) joints[k] = j;
  }
  return { version: 1, ...(typeof r.base === 'string' && r.base ? { base: r.base } : {}), ...(Object.keys(joints).length ? { joints } : {}) };
}

// ── Free twists of a pair: constraint rows on X = [ω; v/L] (v the velocity at the world origin, L a length scale) ──
type Row = [number, number, number, number, number, number];
const TOL = 1e-9;
const unit = (a: Vec3): Vec3 => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const apply = (m: number[], v: readonly number[]): Vec3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
/** Two unit directions square to `n` and to each other. */
function across(n: Vec3): [Vec3, Vec3] {
  const t1 = unit(cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  return [t1, cross(n, t1)];
}
/** A point's velocity along `d` (d·(v + ω × p)) and a direction's turn along `t` (t·(ω × n)), as rows. */
const pointRow = (p: Vec3, d: Vec3, L: number): Row => { const c = cross(p, d); return [c[0], c[1], c[2], L * d[0], L * d[1], L * d[2]]; };
const dirRow = (n: Vec3, t: Vec3): Row => { const c = cross(n, t); return [c[0], c[1], c[2], 0, 0, 0]; };

type Placed = { R: number[]; t: Vec3 };
function worldFace(f: MateFace, at: Placed): MateFace {
  const point = add(apply(at.R, f.point), at.t);
  return f.kind === 'plane' ? { kind: 'plane', point, normal: unit(apply(at.R, f.normal)) } : { ...f, point, axis: unit(apply(at.R, f.axis)) };
}
/** The rows a mate puts on b's twist relative to a (both faces in the world). */
function mateRows(m: Mate, fa: MateFace, fb: MateFace, L: number): Row[] {
  if (m.kind === 'lock') return [0, 1, 2, 3, 4, 5].map(i => { const r = [0, 0, 0, 0, 0, 0] as Row; r[i] = 1; return r; });
  if (fa.kind === 'plane' && fb.kind === 'plane') {
    const n = fa.normal, [t1, t2] = across(n);
    if (m.kind === 'angle') { const c = cross(fb.normal, n); return len(c) > 1e-9 ? [[c[0], c[1], c[2], 0, 0, 0]] : [dirRow(n, t1), dirRow(n, t2)]; }
    return [dirRow(n, t1), dirRow(n, t2), pointRow(fb.point, n, L)];
  }
  if (fa.kind === 'cylinder' && fb.kind === 'cylinder') {
    const a = fa.axis, [t1, t2] = across(a);
    if (m.kind === 'concentric') return [dirRow(a, t1), dirRow(a, t2), pointRow(fb.point, t1, L), pointRow(fb.point, t2, L)];
    // (Tangent: the axes stay parallel and as far apart.)
    const off = sub(fb.point, fa.point), perp = sub(off, scale(a, dot(off, a)));
    return [dirRow(a, t1), dirRow(a, t2), ...(len(perp) > 1e-9 ? [pointRow(fb.point, unit(perp), L)] : [])];
  }
  // (Tangent, a round face and a flat one: the axis stays parallel to the face, at its distance.)
  const plane = (fa.kind === 'plane' ? fa : fb) as Extract<MateFace, { kind: 'plane' }>, cyl = (fa.kind === 'cylinder' ? fa : fb) as Extract<MateFace, { kind: 'cylinder' }>;
  const c = cross(cyl.axis, plane.normal);
  return [[c[0], c[1], c[2], 0, 0, 0], pointRow(cyl.point, plane.normal, L)];
}
/** An orthonormal basis of the rows' span (modified Gram–Schmidt, rows normalised first). */
function spanOf(rows: readonly Row[]): number[][] {
  const basis: number[][] = [];
  for (const r of rows) {
    const n = Math.hypot(...r); if (n < TOL) continue;
    let v = r.map(x => x / n);
    for (const b of basis) { const d = v.reduce((s, x, i) => s + x * b[i], 0); v = v.map((x, i) => x - d * b[i]); }
    const m = Math.hypot(...v); if (m > 1e-7) basis.push(v.map(x => x / m));
  }
  return basis;
}
/** The free twists: an orthonormal basis of the rows' null space, as {ω, v} (v back in mm). */
function freeTwists(rows: readonly Row[], L: number): { w: Vec3; v: Vec3 }[] {
  const span = spanOf(rows), free: number[][] = [];
  for (let i = 0; i < 6 && span.length + free.length < 6; i++) {
    let v = [0, 0, 0, 0, 0, 0]; v[i] = 1;
    for (const b of [...span, ...free]) { const d = v.reduce((s, x, k) => s + x * b[k], 0); v = v.map((x, k) => x - d * b[k]); }
    const m = Math.hypot(...v); if (m > 1e-6) free.push(v.map(x => x / m));
  }
  return free.map(f => ({ w: [f[0], f[1], f[2]], v: [f[3] * L, f[4] * L, f[5] * L] }));
}
/** A direction made canonical: its first clear component positive. */
function canonical(a: Vec3): Vec3 {
  const k = a.findIndex(x => Math.abs(x) > 1e-9);
  return (k >= 0 && a[k] < 0 ? scale(a, -1) : a).map(x => (Math.abs(x) < 1e-15 ? 0 : x)) as Vec3;
}

/** The 1-DoF steps a pair's free twists make: slides, then turns; or why they are none the tree takes. */
export function motionOf(twists: readonly { w: Vec3; v: Vec3 }[]): { steps: { type: 'revolute' | 'prismatic'; axis: Vec3; point?: Vec3 }[] } | { unsupported: string } {
  // Split into pure slides and turns: Gram–Schmidt on the turn part, carrying the slide part along.
  const turns: { w: Vec3; v: Vec3 }[] = [], slides: Vec3[] = [];
  for (const t0 of twists) {
    let w = t0.w, v = t0.v;
    for (const r of turns) { const d = dot(w, r.w); w = sub(w, scale(r.w, d)); v = sub(v, scale(r.v, d)); }
    const n = len(w);
    if (n > 1e-7) turns.push({ w: scale(w, 1 / n), v: scale(v, 1 / n) });
    else if (len(v) > 1e-9) slides.push(v);
  }
  const T = spanOf(slides.map(s => [0, 0, 0, s[0], s[1], s[2]] as Row)).map(b => [b[3], b[4], b[5]] as Vec3);
  const steps: { type: 'revolute' | 'prismatic'; axis: Vec3; point?: Vec3 }[] = T.map(axis => ({ type: 'prismatic', axis: canonical(axis) }));
  if (!turns.length) return { steps };
  // (A turn's slide part along the free slides is a slide: taken off, what is left is its axis's place.)
  const minimal = turns.map(r => { let v = r.v; for (const s of T) v = sub(v, scale(s, dot(v, s))); return { w: r.w, v }; });
  if (minimal.length === 1) {
    const { w, v } = minimal[0], pitch = dot(w, v);
    if (Math.abs(pitch) > 1e-6) return { unsupported: `a screw motion (${pitch.toFixed(6)} mm a radian)` };
    return { steps: [...steps, { type: 'revolute', axis: canonical(w), point: cross(w, v) }] };
  }
  if (minimal.length === 3 && !T.length) {
    // (A ball: every turn about one point p, v = p × ω — least squares over the three, then the residual.)
    const A: number[][] = [], b: number[] = [];
    for (const { w, v } of minimal) { A.push([0, w[2], -w[1]], [-w[2], 0, w[0]], [w[1], -w[0], 0]); b.push(...v); }
    const p = solve3(A, b);
    if (p && minimal.every(({ w, v }) => len(sub(v, cross(p, w))) < 1e-6)) return { steps: ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[]).map(axis => ({ type: 'revolute' as const, axis, point: p })) };
  }
  return { unsupported: `${minimal.length} turns${T.length ? ` and ${T.length} slide${T.length > 1 ? 's' : ''}` : ''} that are not one joint chain` };
}
/** Least squares A x = b for three unknowns (normal equations), or null when singular. */
function solve3(A: number[][], b: number[]): Vec3 | null {
  const M = [0, 1, 2].map(i => [0, 1, 2].map(j => A.reduce((s, r) => s + r[i] * r[j], 0))), y = [0, 1, 2].map(i => A.reduce((s, r, k) => s + r[i] * b[k], 0));
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(M); if (Math.abs(d) < 1e-12) return null;
  return [0, 1, 2].map(k => det(M.map((r, i) => r.map((x, j) => (j === k ? y[i] : x)))) / d) as Vec3;
}

export interface TreeInput {
  /** The solved instances (where the mates put them). */
  instances: readonly PartInstance[];
  mates: readonly Mate[];
  tables: (part: string) => FaceTable | undefined;
  settings?: RobotSettings;
  /** The spur gears a part holds, as made (its bodies' gear placements, the part's own coordinates). */
  gears?: (part: string) => readonly GearPlacement[];
  /** The mates the solver could not meet (they make no joint). */
  mateProblems?: readonly { mate: string; reason: string }[];
}

/** The joint tree from the base link: links, joints (chains through dummy links), loops, gear couplings, issues. */
export function jointTree(input: TreeInput): JointTree {
  const settings = input.settings ?? { version: 1 }, problems: RobotIssue[] = [], notes: RobotIssue[] = [];
  const parts = [BASE, ...input.instances.map(i => i.id)], byId = new Map(input.instances.map(i => [i.id, i]));
  const nameOf = (p: string) => (p === BASE ? 'Base part' : byId.get(p)?.name ?? p);
  let base = settings.base ?? BASE;
  if (!parts.includes(base)) { problems.push({ code: 'BASE_UNKNOWN', message: `The base link "${base}" is not a part of this assembly; the base part is used.`, parts: [base] }); base = BASE; }
  const placed = new Map<string, Placed>(parts.map(p => { const i = byId.get(p); return [p, i ? { R: rotationMatrix(i.rotation), t: [...i.position] as Vec3 } : { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] as Vec3 }]; }));
  // (A length scale for the constraint rows: the assembly's extent, at least 1 mm.)
  const L = Math.max(1, ...input.instances.map(i => len(i.position as Vec3)));
  // Mates by pair, those the solver met only.
  const failed = new Set((input.mateProblems ?? []).map(p => p.mate)), pairs = new Map<string, Mate[]>();
  const pairKey = (a: string, b: string) => [a, b].sort((x, y) => parts.indexOf(x) - parts.indexOf(y)).join('~');
  for (const m of input.mates) {
    if (failed.has(m.id)) { problems.push({ code: 'MATE_PROBLEM', message: `${m.id} is not met (${(input.mateProblems ?? []).find(p => p.mate === m.id)!.reason}): it makes no joint.`, mates: [m.id] }); continue; }
    if (!placed.has(m.a.part) || !placed.has(m.b.part) || m.a.part === m.b.part) continue;
    const k = pairKey(m.a.part, m.b.part); (pairs.get(k) ?? pairs.set(k, []).get(k)!).push(m);
  }
  // Grounded instances are fixed in the world: joined to the base by a fixed joint.
  const grounded = input.instances.filter(i => i.grounded).map(i => i.id);
  // The tree: grown from the base, each step taking the pair that leaves the least freedom (Prim's, weighted by the
  // pair's degrees of freedom; ties in the document's order), so a loose mate closes a loop rather than replacing a
  // joint. A pair met again is a loop.
  const motions = new Map<string, ReturnType<typeof motionOf>>();
  for (const [k, ms] of pairs) motions.set(k, pairMotion(ms, input.tables, placed, L));
  const weight = (k: string) => { const m = motions.get(k); return m === undefined ? 0 : 'steps' in m ? m.steps.length : 7; };
  const edges = [...pairs.keys()].map(k => k.split('~') as [string, string]);
  for (const g of grounded) if (!pairs.has(pairKey(BASE, g))) edges.push([BASE, g]);
  const parent = new Map<string, string>([[base, '']]), order = [base], used = new Set<string>();
  for (;;) {
    let best: [string, string] | null = null, bw = Infinity;
    for (const [a, b] of edges) {
      const inA = parent.has(a), inB = parent.has(b);
      if (inA === inB) continue;
      const w = weight(pairKey(a, b));
      if (w < bw) { bw = w; best = inA ? [a, b] : [b, a]; }
    }
    if (!best) break;
    parent.set(best[1], best[0]); order.push(best[1]); used.add(pairKey(best[0], best[1]));
  }
  const links: Link[] = order.map(p => ({ id: p, part: p, name: nameOf(p) })), joints: Joint[] = [];
  for (const p of parts) if (!parent.has(p)) problems.push({ code: 'NOT_CONNECTED', message: `${nameOf(p)} is joined to no other part by mates and is not fixed: it is not in the robot.`, parts: [p] });

  const limitOf = (key: string): Joint['limit'] => { const s = settings.joints?.[key]; return s ? { ...s } : undefined; };
  for (const child of order.slice(1)) {
    const par = parent.get(child)!, key = pairKey(par, child), mates = pairs.get(key) ?? [];
    const childAt = placed.get(child)!.t;
    if (!mates.length) { joints.push({ key, type: 'fixed', parent: par, child, origin: childAt, axis: [0, 0, 1], mates: [] }); continue; }
    const motion = motions.get(key) ?? pairMotion(mates, input.tables, placed, L);
    if ('unsupported' in motion) { problems.push({ code: 'MOTION_UNSUPPORTED', message: `${nameOf(child)} moves on ${nameOf(par)} in ${motion.unsupported}: no joint of the tree makes that.`, parts: [par, child], mates: mates.map(m => m.id) }); continue; }
    if (!motion.steps.length) { joints.push({ key, type: 'fixed', parent: par, child, origin: childAt, axis: [0, 0, 1], mates: mates.map(m => m.id) }); continue; }
    // One step: the joint itself; more: a chain through dummy links, the child at its end.
    motion.steps.forEach((s, i) => {
      const last = i === motion.steps.length - 1, k = motion.steps.length === 1 ? key : `${key}#${i}`;
      const from = i === 0 ? par : `${child}__${i}`, to = last ? child : `${child}__${i + 1}`;
      if (!last) links.push({ id: to, part: null, name: `${nameOf(child)} (dummy ${i + 1})` });
      const origin = s.point ? add(s.point, scale(s.axis, dot(sub(childAt, s.point), s.axis))) : childAt, limit = limitOf(k);
      const type: JointType = s.type === 'prismatic' ? 'prismatic' : limit?.lower !== undefined || limit?.upper !== undefined ? 'revolute' : 'continuous';
      joints.push({ key: k, type, parent: from, child: to, origin: origin.map(x => (Math.abs(x) < 1e-12 ? 0 : x)) as Vec3, axis: s.axis, ...(limit ? { limit } : {}), mates: mates.map(m => m.id) });
    });
  }
  // Loops: pairs with mates the tree did not take.
  const loops: Loop[] = [];
  for (const [k, ms] of pairs) {
    if (used.has(k)) continue;
    const [a, b] = k.split('~') as [string, string];
    if (!parent.has(a) || !parent.has(b)) continue;
    const m = motions.get(k)!, freedom = 'steps' in m ? m.steps.length : -1;
    loops.push({ parts: [a, b], mates: ms.map(x => x.id), freedom, message: `${nameOf(a)} and ${nameOf(b)} are joined again (${ms.map(x => x.id).join(', ')}): a closed loop, kept as a closure (not a joint of the tree).` });
  }
  // Limits: a prismatic joint and a revolute one need them for export; set ones must be in order.
  for (const j of joints) {
    const l = j.limit;
    if (l?.lower !== undefined && l.upper !== undefined && l.lower > l.upper) problems.push({ code: 'LIMITS_BAD', message: `${j.key}: its lower limit ${l.lower} is above its upper limit ${l.upper}.`, joint: j.key });
    if (l && ((l.effort !== undefined && !(l.effort > 0)) || (l.velocity !== undefined && !(l.velocity > 0)))) problems.push({ code: 'LIMITS_BAD', message: `${j.key}: effort and velocity are above 0.`, joint: j.key });
    if (j.type === 'prismatic' && (l?.lower === undefined || l.upper === undefined)) notes.push({ code: 'LIMITS_MISSING', message: `${j.key}: a prismatic joint needs lower and upper limits for export.`, joint: j.key });
    if ((j.type === 'prismatic' || j.type === 'revolute' || j.type === 'continuous') && (l?.effort === undefined || l.velocity === undefined)) notes.push({ code: 'LIMITS_MISSING', message: `${j.key}: no effort or velocity rating yet (export needs both).`, joint: j.key });
  }
  const couplings = input.gears ? gearCouplings(joints, placed, input.gears, notes) : [];
  return { version: 1, base, links, joints, loops, couplings, problems, notes };
}

/** A pair's free motion from its mates' rows at the solved pose (b relative to a; the same freedom either way round). */
function pairMotion(mates: readonly Mate[], tables: TreeInput['tables'], placed: Map<string, Placed>, L: number): ReturnType<typeof motionOf> {
  const rows: Row[] = [];
  for (const m of mates) {
    if (m.kind === 'lock') { rows.push(...mateRows(m, null as never, null as never, L)); continue; }
    const fa = tables(m.a.part)?.[m.a.face], fb = tables(m.b.part)?.[m.b.face];
    if (!fa || !fb) continue;
    rows.push(...mateRows(m, worldFace(fa, placed.get(m.a.part)!), worldFace(fb, placed.get(m.b.part)!), L));
  }
  return motionOf(freeTwists(rows, L));
}

/** Meshing spur gears on two turning joints of one carrier: the second follows the first, −z1/z2 (D56's pair check). */
function gearCouplings(joints: Joint[], placed: Map<string, Placed>, gearsOf: (part: string) => readonly GearPlacement[], notes: RobotIssue[]): Coupling[] {
  const turning = joints.filter(j => (j.type === 'revolute' || j.type === 'continuous') && !j.child.includes('__'));
  const onAxis = turning.flatMap(j => {
    const at = placed.get(j.child)!;
    return gearsOf(j.child).flatMap(g => {
      const axis = unit(apply(at.R, [0, 0, 1])), point = add(apply(at.R, [g.center[0], g.center[1], g.from]), at.t);
      const off = sub(point, j.origin), perp = sub(off, scale(j.axis, dot(off, j.axis)));
      return len(cross(axis, j.axis)) < 1e-9 && len(perp) < 1e-6 ? [{ j, g, axis, point, xAxis: unit(apply(at.R, [1, 0, 0])) }] : [];
    });
  });
  const out: Coupling[] = [];
  for (let a = 0; a < onAxis.length; a++) for (let b = a + 1; b < onAxis.length; b++) {
    const A = onAxis[a], B = onAxis[b];
    if (A.j === B.j || B.j.mimic || len(cross(A.axis, B.axis)) > 1e-9) continue;
    const z = A.axis, [x, y] = across(z), o = A.point, frame = (g: typeof A): GearPlacement => {
      const d = sub(g.point, o), turn = Math.atan2(dot(g.xAxis, y), dot(g.xAxis, x));
      return { spec: g.g.spec, center: [dot(d, x), dot(d, y)], from: dot(d, z), rotation: g.g.rotation + turn };
    };
    const g1 = frame(A), g2 = frame(B), dist = Math.hypot(g2.center[0] - g1.center[0], g2.center[1] - g1.center[1]);
    const tips = (spurGearDimensions(g1.spec).tipDiameterMM + spurGearDimensions(g2.spec).tipDiameterMM) / 2;
    if (!(dist < tips)) continue;
    if (dot(A.axis, B.axis) < 0) { notes.push({ code: 'GEAR_NOT_COUPLED', message: `${A.j.key} and ${B.j.key}: their gears face opposite ways (not coupled yet).` }); continue; }
    if (A.j.parent !== B.j.parent) { notes.push({ code: 'GEAR_NOT_COUPLED', message: `${A.j.key} and ${B.j.key}: their gears mesh but turn on different links, so their angles are not tied.` }); continue; }
    try {
      const c = checkPlacedSpurGears(g1, g2, { mode: 'verdict' }), multiplier = -g1.spec.teeth / g2.spec.teeth;
      B.j.mimic = { joint: A.j.key, multiplier, offset: 0 };
      out.push({ leader: A.j.key, follower: B.j.key, multiplier, centerDistanceMM: c.centerDistanceMM, nominalCenterDistanceMM: c.nominalCenterDistanceMM, backlashMM: c.backlashMM, contactRatio: c.usableContactRatio });
    } catch (cause) { notes.push({ code: 'GEAR_NOT_COUPLED', message: `${A.j.key} and ${B.j.key}: ${cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause)}` }); }
  }
  return out;
}

/** The tree of a document as it stands (its instances as solved, its robot settings). */
export function jointTreeOf(doc: StudioDoc, solved: { instances: readonly PartInstance[]; problems: readonly { mate: string; reason: string }[] }, tables: TreeInput['tables'], gears?: TreeInput['gears']): JointTree {
  return jointTree({ instances: solved.instances, mates: doc.mates ?? [], tables, settings: readRobot(doc.robot), mateProblems: solved.problems, ...(gears ? { gears } : {}) });
}
