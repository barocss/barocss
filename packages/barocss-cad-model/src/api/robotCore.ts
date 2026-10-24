// RS5 (cad-model's facade): the one place the robot facade calls the core's robot functions — since RS3 the robot's
// work is sync core verbs over a view (robot/verbs.ts: treeOf, poseOf, sweepOf, inertiaOf, gravityRawOf, urdfOf, mjcfOf,
// withJoints), the very functions the agent's robot tools call, so the replies are theirs. The facade builds the view
// at once from its own sync evaluation; it checks a call's shape as the tool does (the verbs leave that to the caller).
import { BarocssError, bracketedCode } from '@barocss/cad/api';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { BASE } from '../assembly/mates';
import { solveDoc } from '../assembly/edit';
import { gravityRawOf as gravityRawVerb, inertiaOf as inertiaVerb, mjcfOf as mjcfVerb, partsOf, poseOf as poseVerb, sweepOf as sweepVerb, treeOf as treeVerb, urdfOf as urdfVerb, withJoints as jointsVerb, type RobotView } from '../robot/verbs';
import { jointTreeOut, jointValuesIn, jointValuesOut } from '../robot/units';
import { gravityIn, gravityJson, inertiaJson } from '../robot/reports';
import { readUrdf } from '../robot/urdfCheck';
import { readMjcf } from '../robot/mjcfCheck';
import { exportSdf } from '../robot/sdf';
import { exportUsd } from '../robot/usd';
import { closureOfDoc } from '../robot/loop';
import type { MjcfClosure } from '../robot/mjcf';
import { readRobot, type JointSettings, type JointTree, type RobotSettings } from '../robot/joints';
import { checkPath, duration, motionNamed, poseAt, timedPathOf, type Motion, type MotionPath } from '../robot/motion';
import { problem, type Problem } from '../engine/refusal';
import { bodiesOf } from './core';

/** A tool's refusal in its words: its bracketed code, else ROBOT. */
const refused = (message: string) => new BarocssError(bracketedCode(message) ?? 'ROBOT', message, 'evaluate');
const own = (doc: StudioDoc): readonly BodyResult[] => doc.nodes.length ? bodiesOf(doc) : [];

/** The robot's view (robot/verbs.ts robotViewOf), built at once: the base part's bodies and each placed part's. */
export function viewOf(doc: StudioDoc): RobotView {
  const parts = new Map<string, readonly BodyResult[]>();
  for (const inst of solveDoc(doc).doc.instances ?? []) parts.set(inst.id, own(inst.doc));
  return { doc, bodies: own(doc), parts };
}

/** The joint tree of a document as it stands: its instances solved, its parts' faces and gears. */
export const treeOf = (doc: StudioDoc): JointTree => treeVerb(viewOf(doc));

/** A joint's value given in the facade's units — degrees for a turning joint, mm for a slide — as the core takes it (radians, mm). */
export function coreValues(tree: JointTree, values: Readonly<Record<string, number>>): Record<string, number> {
  for (const [k, v] of Object.entries(values)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new BarocssError('VALUE', `[VALUE] ${k}: a joint's value is a number (degrees, or mm for a slide), not ${String(v)}`, 'facade');
  }
  return jointValuesIn(tree, values);
}

const check = (tree: JointTree, values: Readonly<Record<string, number>>) => {
  const keys = new Set(tree.joints.map(j => j.key)), bad = Object.keys(values).filter(k => !keys.has(k));
  if (bad.length) throw refused(`No joint ${bad.join(', ')}; joints: ${[...keys].join(', ') || 'none'}.`);
};

/** get_joints' public tree: degrees/mm, degree/s or mm/s, and N·mm or N. */
export const jointsOf = (doc: StudioDoc) => jointTreeOut(treeOf(doc));

const LIMIT_FIELDS = ['lower', 'upper', 'effort', 'velocity'] as const;
/** set_joints' write: store public units unchanged; the producer converts to core units when it builds the tree. */
export function withJoints(doc: StudioDoc, o: { base?: string; joints?: Record<string, Partial<JointSettings> | null> }): StudioDoc {
  const parts = [BASE, ...(doc.instances ?? []).map(i => i.id)];
  if (o.base !== undefined && (typeof o.base !== 'string' || !parts.includes(o.base))) throw refused(`The base link is one of ${parts.join(', ')}.`);
  const merged: Record<string, JointSettings> = { ...(readRobot(doc.robot).joints ?? {}) }, joints: Record<string, JointSettings | null> = {};
  for (const [key, s] of Object.entries(o.joints ?? {})) {
    if (s === null) { joints[key] = null; delete merged[key]; continue; }
    const bad = Object.keys(s).filter(k => !(LIMIT_FIELDS as readonly string[]).includes(k));
    if (bad.length) throw refused(`${key}: no setting ${bad.join(', ')}; settings are ${LIMIT_FIELDS.join(', ')}.`);
    const j: JointSettings = { ...(merged[key] ?? {}) };
    for (const f of LIMIT_FIELDS) { const v = s[f]; if (v === undefined) continue; if (typeof v !== 'number' || !Number.isFinite(v)) throw refused(`${key}.${f} is a number.`); j[f] = v; }
    if (j.lower !== undefined && j.upper !== undefined && j.lower > j.upper) throw refused(`${key}: lower (${j.lower}) is above upper (${j.upper}).`);
    if ((j.effort !== undefined && j.effort <= 0) || (j.velocity !== undefined && j.velocity <= 0)) throw refused(`${key}: effort and velocity are above 0.`);
    merged[key] = j; joints[key] = j;
  }
  const out = jointsVerb(doc, { ...(o.base !== undefined ? { base: o.base } : {}), joints });
  const keys = new Set(treeOf(out).joints.map(j => j.key)), unknown = Object.keys(o.joints ?? {}).filter(k => o.joints![k] !== null && !keys.has(k));
  if (unknown.length) throw refused(`No joint ${unknown.join(', ')}; joints: ${[...keys].join(', ') || 'none'}.`);
  return out;
}

/** forward_kinematics' reply: core input in radians/mm; public reply values in degrees/mm. */
export function poseOf(doc: StudioDoc, values: Readonly<Record<string, number>>) {
  const view = viewOf(doc), t = treeVerb(view), p = poseVerb(view, values, t);
  if (p.unknown.length) throw refused(`No joint ${p.unknown.join(', ')}; joints: ${t.joints.map(j => j.key).join(', ') || 'none'}.`);
  return { ...p.reply, values: jointValuesOut(t, p.reply.values) };
}

/** sweep_path's reply between two sets of joint values (the core's units). */
export function sweepOf(doc: StudioDoc, from: Readonly<Record<string, number>>, to: Readonly<Record<string, number>>) {
  const view = viewOf(doc), t = treeVerb(view);
  check(t, from); check(t, to);
  const r = sweepVerb(view, from, to, t);
  return { ...r.reply, ...(r.reply.contact ? { contact: { ...r.reply.contact, values: jointValuesOut(t, r.rawContactValues!) } } : {}) };
}

/** link_inertia's public MMGS reply, projected once from the internal SI inertia. */
export const inertiaOf = (doc: StudioDoc) => ({ links: inertiaVerb(viewOf(doc)).map(inertiaJson) });

/** Public gravity reply at core joint values; g is mm/s², converted once to SI before dynamics. */
export function gravityOf(doc: StudioDoc, values: Readonly<Record<string, number>>, g?: readonly [number, number, number]) {
  const view = viewOf(doc), t = treeVerb(view);
  check(t, values);
  if (g !== undefined && (!Array.isArray(g) || g.length !== 3 || g.some(x => typeof x !== 'number' || !Number.isFinite(x)))) throw refused('"g" is [x, y, z] in mm/s².');
  const G = gravityIn(g);
  return gravityJson(t, gravityRawVerb(view, values, G, t), G);
}

const fileList = (files: readonly { path: string; data: Uint8Array | string }[]) => files.map(f => ({ path: f.path, bytes: f.data.length, data: f.data }));

/** export_urdf's reply, each file's data beside its path and size. */
export function urdfOf(doc: StudioDoc, name: string) {
  const r = urdfVerb(viewOf(doc), name);
  if (!r.ok) throw refused(`URDF refused: ${r.refusals.map(x => `[${x.code}] ${x.message}`).join(' ')}`);
  const check = readUrdf(r.urdf, new Set(r.files.map(f => f.path)));
  return { urdf: r.urdf, files: fileList(r.files), notes: r.notes, check: check.issues };
}

/** export_mjcf's reply, each file's data beside its path and size. */
export function mjcfOf(doc: StudioDoc, name: string) {
  const r = mjcfVerb(viewOf(doc), name);
  if (!r.ok) throw refused(`MJCF refused: ${r.refusals.map(x => `[${x.code}] ${x.message}`).join(' ')}`);
  const check = readMjcf(r.xml, new Set(r.files.map(f => f.path)));
  return { mjcf: r.xml, files: fileList(r.files), notes: r.notes, check: check.issues };
}

// (Each loop closed at its pin where it is a planar one, as the studio's Export menu closes them for SDF and USD.)
function closuresOf(doc: StudioDoc, tree: JointTree): MjcfClosure[] {
  const out: MjcfClosure[] = [];
  for (const l of tree.loops) { try { out.push(closureOfDoc(doc, tree, l)); } catch { /* left out, as MJCF's are */ } }
  return out;
}

/** The robot as SDF and as USD, as the studio's Export menu writes them (the core's result), or the refusal. */
export function sdfOf(doc: StudioDoc, name: string) {
  const view = viewOf(doc), t = treeVerb(view), r = exportSdf(t, partsOf(view), name, closuresOf(doc, t));
  if (!r.ok) throw refused(`SDF refused: ${r.refusals.map(x => `[${x.code}] ${x.message}`).join(' ')}`);
  return r;
}
export function usdOf(doc: StudioDoc, name: string) {
  const view = viewOf(doc), t = treeVerb(view), r = exportUsd(t, partsOf(view), name, closuresOf(doc, t));
  if (!r.ok) throw refused(`USD refused: ${r.refusals.map(x => `[${x.code}] ${x.message}`).join(' ')}`);
  return r;
}

/**
 * O22's LOOP_OPEN, as check_path and play_motion refuse it (robot/verbs.ts playable): a motion names joint values and
 * nothing closes a loop along it yet, so a looped robot's motion is refused, not checked clear or posed open.
 */
function loopOpen(tree: JointTree): Problem<'LOOP_OPEN'> | null {
  return tree.loops.length ? problem('LOOP_OPEN', `the robot has a closed loop (${tree.loops.map(l => l.parts.join('–')).join(', ')}); a motion's poses do not close it yet, so it is not played or checked`) : null;
}
/** A path's refusal on a looped robot (LOOP_OPEN). */
export function refuseLoop(tree: JointTree): void {
  const p = loopOpen(tree);
  if (p) throw new BarocssError(p.code, p.message, 'evaluate', { loops: tree.loops.map(l => l.parts) });
}

/** A saved motion's joint values at time t (s), in the facade's units — degrees for a turning joint, mm for a slide (RS2's poseAt). */
export function poseAtOf(doc: StudioDoc, path: MotionPath, t: number): Record<string, number> {
  if (typeof t !== 'number' || !Number.isFinite(t)) throw new BarocssError('VALUE', `[VALUE] a time is a number of seconds, not ${String(t)}`, 'facade');
  const tree = treeOf(doc);
  refuseLoop(tree);
  const timed = timedPathOf(tree, path), turning = new Set(tree.joints.filter(j => j.type === 'revolute' || j.type === 'continuous').map(j => j.key));
  const problems = checkPath(tree, timed);
  if (problems.length) throw new BarocssError(problems[0].code, problems[0].message, 'evaluate', { problems });
  return Object.fromEntries(Object.entries(poseAt(tree, timed, t)).map(([k, v]) => [k, turning.has(k) ? v * 180 / Math.PI : v]));
}
/** How long a motion takes (s), as poseAt times it. */
export function durationOf(doc: StudioDoc, path: MotionPath): number {
  const tree = treeOf(doc);
  refuseLoop(tree);
  return duration(timedPathOf(tree, path));
}
/** What is wrong with a motion on this robot (RS2's checkPath): unknown or following joints, limits passed or missing; a closed loop (LOOP_OPEN) first. */
export function problemsOf(doc: StudioDoc, path: MotionPath): Problem[] {
  const tree = treeOf(doc), open = loopOpen(tree);
  return [...(open ? [open] : []), ...checkPath(tree, timedPathOf(tree, path))];
}
/** A saved motion by name (MOTION_UNKNOWN names the ones there). */
export const motionOf = (doc: StudioDoc, name: string): Motion => motionNamed(readRobot(doc.robot).motions, name);

/**
 * A motion saved under a name in the robot settings (`robot.motions`, RS2; degrees and mm): replaced where the name is
 * there, else after the others. (RS3's agent action will write the same; until then this is the settings' own shape.)
 */
export function withMotion(doc: StudioDoc, name: string, path: MotionPath): StudioDoc {
  if (typeof name !== 'string' || !name.trim()) throw new BarocssError('VALUE', '[VALUE] a motion has a name', 'facade');
  const was = readRobot(doc.robot), motions = [...(was.motions ?? [])], at = motions.findIndex(m => m.name === name), motion: Motion = { name, path: structuredClone(path) };
  if (at >= 0) motions[at] = motion; else motions.push(motion);
  const robot: RobotSettings = { ...was, motions };
  return { ...doc, robot };
}
