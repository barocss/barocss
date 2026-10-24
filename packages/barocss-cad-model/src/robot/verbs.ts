// The robot's work as sync core functions (RS3, the API lane's RS5 proposal): verb(view, options) → reply. A robot tool
// is async only to evaluate each placed part; that happens once, in robotViewOf (the facade builds its view at once
// from its own evaluation), and everything after it is these functions — the agent's tools (chat/robot.ts) and the
// facade's robotCore call the same ones, and the replies are the tools' own (the call's shape is checked by its caller).
import { convexHull, type GearPlacement } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import { placeBody, type BodyResult, type EvalResult } from '../engine/evaluate';
import { BASE } from '../assembly/mates';
import { tablesFor } from '../assembly/faces';
import { solveDoc } from '../assembly/edit';
import { eulerOf, rotationMatrix } from '../engine/placement';
import { composeInto, forwardKinematics, gearPairAt } from './fk';
import { framePoses } from './frames';
import { treeInertia, type LinkInertia } from './inertia';
import { exportUrdf, withoutCams, type UrdfResult } from './urdf';
import { exportMjcf, type MjcfClosure, type MjcfResult } from './mjcf';
import { closeLoops, closureOfDoc, loopCloserOf } from './loop';
import { sweepLinks, sweepPath, type SweepLink } from './sweep';
import { gravityTorques, linkBodies, linkMasses, moveTorques, STANDARD_GRAVITY, type MoveLimits } from './dynamics';
import { sizeActuators, sizeCoupled, type Motor, type Reducer } from './actuators';
import type { ProfileKind } from './profile';
import { jointTreeOf, readRobot, type JointSettings, type JointTree, type RobotSettings } from './joints';
import { r6 } from '../util/round';
import { refusal, refused } from '../engine/refusal';
import { checkPath, duration, motionNamed, poseAt, timedPathOf, type Motion, type MotionPath } from './motion';
import { sweepTimed } from './ccd';

type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
/** A robot as its functions read it: the document, the base part's bodies, and each placed part's in its own coordinates. */
export interface RobotView { readonly doc: StudioDoc; readonly bodies: readonly BodyResult[]; readonly parts: ReadonlyMap<string, readonly BodyResult[]> }

/** The view of a document's robot: each placed part evaluated once (a part that does not build: no bodies). */
export async function robotViewOf(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate): Promise<RobotView> {
  const parts = new Map<string, readonly BodyResult[]>();
  for (const inst of solveDoc(doc).doc.instances ?? []) { const r = await evaluate(inst.doc); parts.set(inst.id, r?.ok ? r.bodies : []); }
  return { doc, bodies, parts };
}
/** The same parts with another document's settings (its robot or frames changed, its parts not). */
export const viewWith = (view: RobotView, doc: StudioDoc): RobotView => ({ ...view, doc });

/** The joint tree of the document as it stands: its instances solved, its parts' faces and gears. */
export function treeOf(view: RobotView): JointTree {
  const solved = solveDoc(view.doc), gearsOf = (bs: readonly BodyResult[]) => bs.flatMap(b => (b.gear ? [b.gear] : [])), gears = new Map<string, GearPlacement[]>([[BASE, gearsOf(view.bodies)]]);
  for (const inst of solved.doc.instances ?? []) gears.set(inst.id, gearsOf(view.parts.get(inst.id) ?? []));
  return jointTreeOf(solved.doc, { instances: solved.doc.instances ?? [], problems: solved.problems }, tablesFor(solved.doc), p => gears.get(p) ?? []);
}
/** Each part: its document, its bodies in its own coordinates, and where the mates place it. */
export function partsOf(view: RobotView) {
  const solved = solveDoc(view.doc).doc;
  return (p: string) => { if (p === BASE) return { doc: view.doc, bodies: view.bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = solved.instances?.find(x => x.id === p); return i ? { doc: i.doc, bodies: view.parts.get(p) ?? [], position: i.position, rotation: i.rotation } : null; };
}
/** The robot's links for RM6's sweep: each part's bodies where the mates put them, with their convex hulls. */
export function sweepLinksOf(view: RobotView, t: JointTree): SweepLink[] {
  const solved = solveDoc(view.doc).doc, world = new Map<string, readonly BodyResult[]>([[BASE, view.bodies]]);
  for (const i of solved.instances ?? []) world.set(i.id, (view.parts.get(i.id) ?? []).map(b => placeBody({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } }, rotationMatrix(i.rotation), i.position)));
  return sweepLinks(t, p => world.get(p), pts => convexHull(pts).positions);
}

/**
 * The values with the robot's loops closed (O24 a): the loop joints given are the drivers, the rest solved on the
 * loops' own mates (robot/loop.ts) — refused, typed, as closeLoops refuses. No loop: the values as they are.
 */
export function closedValues(view: RobotView, values: Readonly<Record<string, number>>, t: JointTree = treeOf(view)): { values: Record<string, number>; closed: { drivers: string[]; solved: string[]; residual_mm: number } | null } {
  const c = loopCloserOf(view.doc, t);
  if (!c) return { values: { ...values }, closed: null };
  const drivers = Object.keys(values).filter(k => c.all.includes(k)), out = closeLoops(t, c, Object.fromEntries(drivers.map(k => [k, values[k]])));
  return { values: { ...values, ...out.q }, closed: { drivers, solved: c.free.filter(k => !drivers.includes(k)), residual_mm: out.residualMM } };
}
/** forward_kinematics' reply: each link and frame where the values put it (the loops closed), the gears' phase; `unknown`: keys no joint has. */
export function poseOf(view: RobotView, given: Readonly<Record<string, number>>, t: JointTree = treeOf(view)) {
  const unknownKeys = Object.keys(given).filter(k => !t.joints.some(j => j.key === k));
  const { values, closed } = unknownKeys.length ? { values: { ...given }, closed: null } : closedValues(view, given, t);
  const fk = forwardKinematics(t, values), solved = solveDoc(view.doc).doc, r = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const links = t.links.filter(l => l.part !== null).flatMap(l => {
    const m = fk.motions.get(l.id); if (!m) return [];
    const inst = solved.instances?.find(i => i.id === l.id), M = { R: Float64Array.from(inst ? rotationMatrix(inst.rotation) : [1, 0, 0, 0, 1, 0, 0, 0, 1]), t: Float64Array.from(inst ? inst.position : [0, 0, 0]) };
    const pose = composeInto({ R: new Float64Array(9), t: new Float64Array(3) }, m, M);
    return [{ link: l.id, name: l.name, position: [...pose.t].map(r), rotation: eulerOf([...pose.R] as never).map(r) }];
  });
  const gears = t.couplings.map(c => { const at = gearPairAt(c, fk.values), home = gearPairAt(c, {}); return { leader: c.leader, follower: c.follower, phase_deg: r(at.phaseDeg), home_phase_deg: r(home.phaseDeg), held: Math.abs(at.phaseDeg - home.phaseDeg) < 1e-6, backlash_mm: r(at.backlashMM) }; });
  // (O12: each tool and sensor frame where its link puts it.)
  const frames = [...framePoses(t, fk.motions)].map(([frame, p]) => ({ frame, link: t.frames!.find(f => f.name === frame)!.link, position: p.o.map(r), rotation: eulerOf(p.R).map(r) }));
  return { unknown: fk.unknown, reply: { values: fk.values, links, ...(frames.length ? { frames } : {}), gears, out_of_limits: fk.outOfLimits, ...(closed ? { loops: { drivers: closed.drivers, solved: closed.solved, residual_mm: closed.residual_mm } } : {}) } };
}
/** sweep_path's reply: a straight joint move checked for contact between the links. */
export function sweepOf(view: RobotView, from: Readonly<Record<string, number>>, to: Readonly<Record<string, number>>, t: JointTree = treeOf(view)) {
  const r = sweepPath(t, sweepLinksOf(view, t), from, to);
  return { reply: { clear: r.clear, ...(r.contact ? { contact: { s: r6(r.contact.s), values: Object.fromEntries(Object.entries(r.contact.values).map(([k, v]) => [k, r6(v)])), links: r.contact.links } } : {}), min_clearance: r.minClearance ? { mm: r6(r.minClearance.mm), s: r6(r.minClearance.s), links: r.minClearance.links } : null, samples: r.samples, pairs: r.pairs.length, skipped: r.skipped, designed: r.designed },
    summary: r.clear ? `clear (${r.samples} steps)` : `contact ${r.contact!.links.join('–')} at s ${r6(r.contact!.s)}` };
}
const sig10 = (v: number) => Number(v.toPrecision(10)) + 0;
/** link_inertia's links: each link's mass, centre and inertia in its frame. */
export function inertiaOf(view: RobotView, t: JointTree = treeOf(view)): LinkInertia[] {
  return treeInertia(t, partsOf(view));
}
/** gravity_torques' reply: the torque each joint holds against g at the values. */
export function gravityOf(view: RobotView, values: Readonly<Record<string, number>>, g: readonly [number, number, number], t: JointTree = treeOf(view)) {
  const masses = linkMasses(t, partsOf(view)), r = gravityTorques(t, masses, values, g as [number, number, number]), sig = (v: number) => Number(v.toPrecision(12)) + 0;
  const units = Object.fromEntries(t.joints.map(j => [j.key, j.type === 'prismatic' ? 'N' : 'N·m']));
  return { torques: Object.fromEntries(Object.entries(r.torques).map(([k, v]) => [k, sig(v)])), generalized: Object.fromEntries(Object.entries(r.generalized).map(([k, v]) => [k, sig(v)])), units, gravity_m_s2: Math.hypot(...g) };
}
/** A move as motion_torques and size_actuators take it: from and to by key, its profile, each moving joint's limits. */
export interface Move { from: Record<string, number>; to: Record<string, number>; profile: ProfileKind; limits: (k: string) => MoveLimits }
/** motion_torques' reply: the torques of a straight move under its profile (RNEA). */
export function movesOf(view: RobotView, mv: Move, t: JointTree = treeOf(view)) {
  const m = moveTorques(t, linkBodies(t, partsOf(view)), mv.from, mv.to, mv.profile, mv.limits);
  const unit = (k: string) => (t.joints.find(j => j.key === k)!.type === 'prismatic' ? 'N' : 'N·m');
  return { profile: m.kind, duration_s: sig10(m.duration), joints: Object.fromEntries(Object.entries(m.joints).map(([k, j]) => [k, { [`peak_${unit(k) === 'N' ? 'N' : 'N_m'}`]: sig10(j.peak), [`rms_${unit(k) === 'N' ? 'N' : 'N_m'}`]: sig10(j.rms), at_s: sig10(j.atPeak), distance: sig10(j.distance), v_peak: sig10(j.vPeak), a_peak: sig10(j.aPeak), j_peak: sig10(j.jPeak) }])), sampling: m.sampling, gravity_m_s2: STANDARD_GRAVITY };
}
/** size_actuators' sizing (and, coupled, its rounds): the motor and reducer each joint needs for the move. */
export function sizeOf(view: RobotView, mv: Move, so: { motors: readonly Motor[]; reducers: readonly Reducer[]; dwell?: number; life?: number; inertiaRatio?: number; estop?: number }, coupled: boolean, t: JointTree = treeOf(view)) {
  const bodies = linkBodies(t, partsOf(view)), cs = coupled ? sizeCoupled(t, bodies, mv.from, mv.to, mv.profile, mv.limits, so) : null;
  return { sizing: cs ? cs.sizing : sizeActuators(t, bodies, mv.from, mv.to, mv.profile, mv.limits, so), coupled: cs };
}
/** The robot as URDF (RM4). */
export function urdfOf(view: RobotView, name: string, t: JointTree = treeOf(view), o: { leaveOut?: readonly 'cam'[] } = {}): UrdfResult {
  const w = o.leaveOut?.includes('cam') ? withoutCams(t) : { tree: t, notes: [] }, out = exportUrdf(w.tree, partsOf(view), name);
  return out.ok && w.notes.length ? { ...out, notes: [...out.notes, ...w.notes] } : out;
}
/** The robot as MJCF (RM5): each loop closed at its pin when it is a planar one; else left out and said why (RM8). */
export function mjcfOf(view: RobotView, name: string, t0: JointTree = treeOf(view), o: { leaveOut?: readonly 'cam'[] } = {}): MjcfResult {
  const w = o.leaveOut?.includes('cam') ? withoutCams(t0) : { tree: t0, notes: [] }, t = w.tree, closures: MjcfClosure[] = [], left: string[] = [];
  for (const l of t.loops) { try { closures.push(closureOfDoc(view.doc, t, l)); } catch (e) { left.push(`${l.parts.join('–')}: ${e instanceof Error ? e.message : String(e)}`); } }
  const out = exportMjcf(t, partsOf(view), name, closures);
  return out.ok && (left.length || w.notes.length) ? { ...out, notes: [...out.notes, ...left.map(x => `loop not written (${x})`), ...w.notes] } : out;
}

/** set_joints' write: the base link (BASE: none) and each joint's settings (null clears them); the settings kept or dropped whole. */
export function withJoints(doc: StudioDoc, o: { base?: string; joints?: Readonly<Record<string, JointSettings | null>> }): StudioDoc {
  const was = readRobot(doc.robot), next: RobotSettings = { version: 1, ...(was.base ? { base: was.base } : {}), joints: { ...(was.joints ?? {}) }, ...(was.frames ? { frames: was.frames } : {}), ...(was.motions ? { motions: was.motions } : {}) };
  if (o.base !== undefined) { if (o.base === BASE) delete next.base; else next.base = o.base; }
  for (const [key, s] of Object.entries(o.joints ?? {})) { if (s === null) delete next.joints![key]; else next.joints![key] = { ...s }; }
  if (!Object.keys(next.joints!).length) delete next.joints;
  const robot = next.base || next.joints || next.frames || next.motions ? next : undefined, out = { ...doc };
  if (robot) out.robot = robot; else delete out.robot;
  return out;
}

// ── RS3: the agent moves the robot — degrees for a turning joint and mm for a slide, in and out (conventions §2) ──
const DEG = Math.PI / 180;
const turning = (t: JointTree, key: string) => { const j = t.joints.find(x => x.key === key); return j?.type === 'revolute' || j?.type === 'continuous'; };
/** Values in the document's units (degrees, mm) as FK's (radians, mm). */
export const jointValuesIn = (t: JointTree, v: Readonly<Record<string, number>>) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, turning(t, k) ? x * DEG : x]));
/** FK's values (radians, mm) in the document's units (degrees, mm), to 1e-9. */
export const jointValuesOut = (t: JointTree, v: Readonly<Record<string, number>>) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.round((turning(t, k) ? x / DEG : x) * 1e9) / 1e9 + 0]));

const round9 = (x: number) => Math.round(x * 1e9) / 1e9 + 0;
/** Joint values (degrees, mm) past their joint's limits, refused in the same units (JOINT_LIMIT); `at` names where they are. */
function checkLimits(t: JointTree, v: Readonly<Record<string, number>>, at: string) {
  for (const [key, x] of Object.entries(v)) {
    const j = t.joints.find(y => y.key === key), l = j?.limit; if (!l) continue;
    const k = turning(t, key) ? 1 / DEG : 1, u = k === 1 ? ' mm' : '°', lo = l.lower !== undefined ? l.lower * k : -Infinity, up = l.upper !== undefined ? l.upper * k : Infinity;
    if (x < lo - 1e-9 || x > up + 1e-9) throw refusal('JOINT_LIMIT', `${at}${key} = ${round9(x)}${u} is outside its limits ${Number.isFinite(lo) ? `${round9(lo)}${u}` : '−∞'} to ${Number.isFinite(up) ? `${round9(up)}${u}` : '∞'}`);
  }
}
/**
 * set_pose: the robot at joint values (degrees, mm) — each link and frame where they put it, the gear followers' values
 * — refused past a joint's limits (JOINT_LIMIT) or for a key no moving joint has (JOINT_UNKNOWN). A preview: nothing is
 * stored (the studio shows it from the reply).
 */
export function setPose(view: RobotView, values: Readonly<Record<string, number>>, t: JointTree = treeOf(view)) {
  checkLimits(t, values, '');
  const rad = jointValuesIn(t, values), bad = checkPath(t, { waypoints: [{}, rad], profile: 'trapezoid', limits: { default: { v: 1, a: 1 } } }).filter(p => p.code !== 'LIMITS_MISSING');
  if (bad.length) throw refused(bad[0]);
  const p = poseOf(view, rad, t);
  return { ...p.reply, values: jointValuesOut(t, p.reply.values) };
}
/**
 * A waypoint written into a motion (created when absent): appended, or at its index `at`; `remove` takes one out; `limits`
 * ({velocity, acceleration, jerk?} in deg/s… or mm/s…, by joint key or `default`) set the motion's own. Checked on the tree as it will play.
 */
export function withWaypoint(view: RobotView, o: { motion: string; values?: Readonly<Record<string, number>>; at?: number; remove?: number; limits?: MotionPath['limits'] }, t: JointTree = treeOf(view)): StudioDoc {
  const robot = readRobot(view.doc.robot), motions = [...(robot.motions ?? [])], i = motions.findIndex(m => m.name === o.motion);
  const was: Motion = i >= 0 ? motions[i] : { name: o.motion, path: { waypoints: [{}], profile: 'trapezoid' } }, waypoints = [...was.path.waypoints];
  if (o.remove !== undefined) {
    if (i < 0) throw refusal('MOTION_UNKNOWN', `no motion ${o.motion} (motions: ${motions.map(m => m.name).join(', ') || 'none'})`);
    if (!Number.isInteger(o.remove) || o.remove < 0 || o.remove >= waypoints.length) throw refusal('VALUE', `waypoint ${o.remove} is not one of ${o.motion}'s 0–${waypoints.length - 1}`);
    waypoints.splice(o.remove, 1);
  } else if (o.values || !o.limits) {
    if (!o.values) throw refusal('VALUE', 'a waypoint needs its joint values (degrees, mm)');
    const at = o.at ?? waypoints.length;
    if (!Number.isInteger(at) || at < 0 || at > waypoints.length) throw refusal('VALUE', `at is 0–${waypoints.length} (where the waypoint goes)`);
    waypoints.splice(at, 0, { ...o.values });
  }
  const next: Motion = { name: o.motion, path: { ...was.path, waypoints, ...(o.limits ? { limits: { ...was.path.limits, ...o.limits } } : {}) } };
  // (Checked as it will play: unknown keys, gear followers and limits refused; a single waypoint is a motion still being recorded.)
  waypoints.forEach((w, k) => checkLimits(t, w, `waypoint ${k}: `));
  if (waypoints.length >= 2) { const bad = checkPath(t, timedPathOf(t, next.path)).filter(p => p.code !== 'LIMITS_MISSING'); if (bad.length) throw refused(bad[0]); }
  if (i >= 0) motions[i] = next; else motions.push(next);
  return { ...view.doc, robot: { ...robot, motions } };
}
/** The motion's timed path, checked as it will play (its limits the motion's own: LIMITS_MISSING without them). */
function playable(t: JointTree, m: Motion) {
  // (O22: a motion names joint values; nothing closes a loop along it yet, so its poses would leave the loop open — refused, not shown wrong.)
  if (t.loops.length) throw refusal('LOOP_OPEN', `the robot has a closed loop (${t.loops.map(l => l.parts.join('–')).join(', ')}); a motion's poses do not close it yet, so it is not played or checked`);
  m.path.waypoints.forEach((w, k) => checkLimits(t, w, `${m.name}, waypoint ${k}: `));
  const path = timedPathOf(t, m.path), bad = checkPath(t, path);
  if (bad.length) throw refused(bad[0]);
  return path;
}
/** check_path: a motion checked for contact between the links along its timing (sweepTimed), degrees and mm out. */
export function checkMotion(view: RobotView, name: string, t: JointTree = treeOf(view)) {
  const m = motionNamed(readRobot(view.doc.robot).motions, name), path = playable(t, m), r = sweepTimed(t, sweepLinksOf(view, t), path);
  const contact = r.clear ? undefined : { t_s: r6(r.toi!), segment: r.segment!, links: r.links!, values: jointValuesOut(t, r.values ?? {}) };
  return { motion: name, duration_s: r6(duration(path)), clear: r.clear, ...(contact ? { contact } : {}),
    min_clearance: r.minClearance ? { mm: r6(r.minClearance.mm), t_s: r6(r.minClearance.t), links: r.minClearance.links } : null, samples: r.samples, skipped: r.skipped, designed: r.designed };
}
/** play: a motion's poses at `samples` even times (poseAt, as the studio plays it): each time, the values (degrees, mm) and the links' placements. */
export function playMotion(view: RobotView, name: string, samples = 30, t: JointTree = treeOf(view)) {
  const m = motionNamed(readRobot(view.doc.robot).motions, name), path = playable(t, m), T = duration(path), n = Math.max(2, Math.min(200, Math.round(samples)));
  const frames = Array.from({ length: n }, (_, k) => { const at = (T * k) / (n - 1), p = poseOf(view, poseAt(t, path, at), t).reply; return { t_s: r6(at), values: jointValuesOut(t, p.values), links: p.links }; });
  return { motion: name, duration_s: r6(T), samples: frames };
}
