// RS5 (cad-model's facade): the one place the robot facade calls the core's robot functions. Each reply is what the
// agent's robot tool returns (chat/robot.ts runRobotTool), built from the same sync core functions — the joint tree
// (jointTreeOf), forward kinematics, frame poses and gear phases, the path's sweep, inertia, gravity, the four exports —
// with the parts' bodies from the facade's own sync evaluation in place of the tool's evaluator, and the same rounding.
// When the outer lane gives each tool's work a sync core function (RS3), this file calls those instead.
import { BarocssError, bracketedCode } from '@barocss/cad/api';
import { convexHull, type GearPlacement } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { placeBody } from '../engine/evaluate';
import { BASE } from '../assembly/mates';
import { tablesFor } from '../assembly/faces';
import { solveDoc } from '../assembly/edit';
import { eulerOf, rotationMatrix } from '../engine/placement';
import { composeInto, forwardKinematics, gearPairAt } from '../robot/fk';
import { framePoses } from '../robot/frames';
import { treeInertia } from '../robot/inertia';
import { exportUrdf } from '../robot/urdf';
import { readUrdf } from '../robot/urdfCheck';
import { exportMjcf, type MjcfClosure } from '../robot/mjcf';
import { readMjcf } from '../robot/mjcfCheck';
import { exportSdf } from '../robot/sdf';
import { exportUsd } from '../robot/usd';
import { closureOfDoc } from '../robot/loop';
import { sweepLinks, sweepPath } from '../robot/sweep';
import { gravityTorques, linkMasses, STANDARD_GRAVITY } from '../robot/dynamics';
import { jointTreeOf, readRobot, type JointSettings, type JointTree, type RobotSettings } from '../robot/joints';
import { inertiaJson } from '../chat/robot';
import { r6 } from '../util/round';
import { bodiesOf } from './core';

/** A tool's refusal in its words: its bracketed code, else ROBOT. */
const refused = (message: string) => new BarocssError(bracketedCode(message) ?? 'ROBOT', message, 'evaluate');
const own = (doc: StudioDoc): readonly BodyResult[] => doc.nodes.length ? bodiesOf(doc) : [];

/** The joint tree of a document as it stands (the tools' treeOfDoc): its instances solved, its parts' faces and gears. */
export function treeOf(doc: StudioDoc): JointTree {
  const solved = solveDoc(doc), gears = new Map<string, GearPlacement[]>([[BASE, own(doc).flatMap(b => (b.gear ? [b.gear] : []))]]);
  for (const inst of solved.doc.instances ?? []) gears.set(inst.id, own(inst.doc).flatMap(b => (b.gear ? [b.gear] : [])));
  return jointTreeOf(solved.doc, { instances: solved.doc.instances ?? [], problems: solved.problems }, tablesFor(solved.doc), p => gears.get(p) ?? []);
}

// (The tools' robotOfDoc: the tree, and each link's part — its document, bodies and placement.)
function robotOf(doc: StudioDoc) {
  const tree = treeOf(doc), solved = solveDoc(doc).doc, bodies = own(doc);
  const partOf = (p: string) => { if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = solved.instances?.find(x => x.id === p); return i ? { doc: i.doc, bodies: own(i.doc), position: i.position, rotation: i.rotation } : null; };
  return { tree, partOf };
}

/** A joint's value given in the facade's units — degrees for a turning joint, mm for a slide — as the core takes it (radians, mm). */
export function coreValues(tree: JointTree, values: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new BarocssError('VALUE', `[VALUE] ${k}: a joint's value is a number (degrees, or mm for a slide), not ${String(v)}`, 'facade');
    const j = tree.joints.find(x => x.key === k);
    out[k] = j && j.type !== 'prismatic' ? v * Math.PI / 180 : v;
  }
  return out;
}

const check = (tree: JointTree, values: Readonly<Record<string, number>>) => {
  const keys = new Set(tree.joints.map(j => j.key)), bad = Object.keys(values).filter(k => !keys.has(k));
  if (bad.length) throw refused(`No joint ${bad.join(', ')}; joints: ${[...keys].join(', ') || 'none'}.`);
};

/** get_joints' reply: the tree. */
export const jointsOf = (doc: StudioDoc): JointTree => treeOf(doc);

/** set_joints' write: the base link and the joints' limits and ratings (null removes a joint's), checked on the tree. */
export function withJoints(doc: StudioDoc, o: { base?: string; joints?: Record<string, Partial<JointSettings> | null> }): StudioDoc {
  const was = readRobot(doc.robot), next: RobotSettings = { version: 1, ...(was.base ? { base: was.base } : {}), joints: { ...(was.joints ?? {}) }, ...(was.frames ? { frames: was.frames } : {}) };
  const parts = [BASE, ...(doc.instances ?? []).map(i => i.id)];
  if (o.base !== undefined) {
    if (typeof o.base !== 'string' || !parts.includes(o.base)) throw refused(`The base link is one of ${parts.join(', ')}.`);
    if (o.base === BASE) delete next.base; else next.base = o.base;
  }
  for (const [key, s] of Object.entries(o.joints ?? {})) {
    if (s === null) { delete next.joints![key]; continue; }
    const bad = Object.keys(s).filter(k => !(LIMIT_FIELDS as readonly string[]).includes(k));
    if (bad.length) throw refused(`${key}: no setting ${bad.join(', ')}; settings are ${LIMIT_FIELDS.join(', ')}.`);
    const j: JointSettings = { ...(next.joints![key] ?? {}) };
    for (const f of LIMIT_FIELDS) { const v = s[f]; if (v === undefined) continue; if (typeof v !== 'number' || !Number.isFinite(v)) throw refused(`${key}.${f} is a number.`); j[f] = v; }
    if (j.lower !== undefined && j.upper !== undefined && j.lower > j.upper) throw refused(`${key}: lower (${j.lower}) is above upper (${j.upper}).`);
    if ((j.effort !== undefined && j.effort <= 0) || (j.velocity !== undefined && j.velocity <= 0)) throw refused(`${key}: effort and velocity are above 0.`);
    next.joints![key] = j;
  }
  const tree = treeOf({ ...doc, robot: next }), keys = new Set(tree.joints.map(j => j.key));
  const unknown = Object.keys(o.joints ?? {}).filter(k => o.joints![k] !== null && !keys.has(k));
  if (unknown.length) throw refused(`No joint ${unknown.join(', ')}; joints: ${[...keys].join(', ') || 'none'}.`);
  if (!Object.keys(next.joints!).length) delete next.joints;
  const robot = next.base || next.joints || next.frames ? next : undefined, out = { ...doc };
  if (robot) out.robot = robot; else delete out.robot;
  return out;
}
const LIMIT_FIELDS = ['lower', 'upper', 'effort', 'velocity'] as const;

/** forward_kinematics' reply at joint values (the core's: radians, mm). */
export function poseOf(doc: StudioDoc, values: Readonly<Record<string, number>>) {
  const t = treeOf(doc), fk = forwardKinematics(t, values);
  if (fk.unknown.length) throw refused(`No joint ${fk.unknown.join(', ')}; joints: ${t.joints.map(j => j.key).join(', ') || 'none'}.`);
  const solved = solveDoc(doc).doc, round = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const links = t.links.filter(l => l.part !== null).flatMap(l => {
    const m = fk.motions.get(l.id); if (!m) return [];
    const inst = solved.instances?.find(i => i.id === l.id), M = { R: Float64Array.from(inst ? rotationMatrix(inst.rotation) : [1, 0, 0, 0, 1, 0, 0, 0, 1]), t: Float64Array.from(inst ? inst.position : [0, 0, 0]) };
    const pose = composeInto({ R: new Float64Array(9), t: new Float64Array(3) }, m, M);
    return [{ link: l.id, name: l.name, position: [...pose.t].map(round), rotation: eulerOf([...pose.R] as never).map(round) }];
  });
  const gears = t.couplings.map(c => { const at = gearPairAt(c, fk.values), home = gearPairAt(c, {}); return { leader: c.leader, follower: c.follower, phase_deg: round(at.phaseDeg), home_phase_deg: round(home.phaseDeg), held: Math.abs(at.phaseDeg - home.phaseDeg) < 1e-6, backlash_mm: round(at.backlashMM) }; });
  const frames = [...framePoses(t, fk.motions)].map(([frame, p]) => ({ frame, link: t.frames!.find(f => f.name === frame)!.link, position: p.o.map(round), rotation: eulerOf(p.R).map(round) }));
  return { values: fk.values, links, ...(frames.length ? { frames } : {}), gears, out_of_limits: fk.outOfLimits };
}

/** sweep_path's reply between two sets of joint values (the core's units). */
export function sweepOf(doc: StudioDoc, from: Readonly<Record<string, number>>, to: Readonly<Record<string, number>>) {
  const t = treeOf(doc);
  check(t, from); check(t, to);
  const solved = solveDoc(doc).doc, world = new Map<string, readonly BodyResult[]>([[BASE, own(doc)]]);
  for (const i of solved.instances ?? []) world.set(i.id, own(i.doc).map(b => placeBody({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } }, rotationMatrix(i.rotation), i.position)));
  const r = sweepPath(t, sweepLinks(t, p => world.get(p), pts => convexHull(pts).positions), from, to);
  return { clear: r.clear, ...(r.contact ? { contact: { s: r6(r.contact.s), values: Object.fromEntries(Object.entries(r.contact.values).map(([k, v]) => [k, r6(v)])), links: r.contact.links } } : {}), min_clearance: r.minClearance ? { mm: r6(r.minClearance.mm), s: r6(r.minClearance.s), links: r.minClearance.links } : null, samples: r.samples, pairs: r.pairs.length, skipped: r.skipped };
}

/** link_inertia's reply. */
export function inertiaOf(doc: StudioDoc) {
  const { tree, partOf } = robotOf(doc);
  return { links: treeInertia(tree, partOf).map(inertiaJson) };
}

/** gravity_torques' reply at joint values (the core's units), gravity `g` in m/s² (standard, down −Z, unless given). */
export function gravityOf(doc: StudioDoc, values: Readonly<Record<string, number>>, g?: readonly [number, number, number]) {
  const { tree, partOf } = robotOf(doc);
  check(tree, values);
  const G = g ?? [0, 0, -STANDARD_GRAVITY];
  if (!Array.isArray(G) || G.length !== 3 || G.some(x => typeof x !== 'number' || !Number.isFinite(x))) throw refused('"g" is [x, y, z] in m/s².');
  const t = gravityTorques(tree, linkMasses(tree, partOf), values as Record<string, number>, G as [number, number, number]), sig = (v: number) => Number(v.toPrecision(12)) + 0;
  const units = Object.fromEntries(tree.joints.map(j => [j.key, j.type === 'prismatic' ? 'N' : 'N·m']));
  return { torques: Object.fromEntries(Object.entries(t.torques).map(([k, v]) => [k, sig(v)])), generalized: Object.fromEntries(Object.entries(t.generalized).map(([k, v]) => [k, sig(v)])), units, gravity_m_s2: Math.hypot(...G) };
}

// (Each loop closed at its pin where it is a planar one, else left out and said why — as mjcfOfDoc and the studio's
// Export menu close them.)
function closuresOf(doc: StudioDoc, tree: JointTree): { closures: MjcfClosure[]; left: string[] } {
  const closures: MjcfClosure[] = [], left: string[] = [];
  for (const l of tree.loops) { try { closures.push(closureOfDoc(doc, tree, l)); } catch (e) { left.push(`${l.parts.join('–')}: ${e instanceof Error ? e.message : String(e)}`); } }
  return { closures, left };
}
const fileList = (files: readonly { path: string; data: Uint8Array | string }[]) => files.map(f => ({ path: f.path, bytes: f.data.length, data: f.data }));

/** export_urdf's reply, each file's data beside its path and size. */
export function urdfOf(doc: StudioDoc, name: string) {
  const { tree, partOf } = robotOf(doc), r = exportUrdf(tree, partOf, name);
  if (!r.ok) throw refused(`URDF refused: ${r.refusals.map(x => `[${x.code}] ${x.message}`).join(' ')}`);
  const check = readUrdf(r.urdf, new Set(r.files.map(f => f.path)));
  return { urdf: r.urdf, files: fileList(r.files), notes: r.notes, check: check.issues };
}

/** export_mjcf's reply, each file's data beside its path and size. */
export function mjcfOf(doc: StudioDoc, name: string) {
  const { tree, partOf } = robotOf(doc), { closures, left } = closuresOf(doc, tree);
  let r = exportMjcf(tree, partOf, name, closures);
  if (r.ok && left.length) r = { ...r, notes: [...r.notes, ...left.map(x => `loop not written (${x})`)] };
  if (!r.ok) throw refused(`MJCF refused: ${r.refusals.map(x => `[${x.code}] ${x.message}`).join(' ')}`);
  const check = readMjcf(r.xml, new Set(r.files.map(f => f.path)));
  return { mjcf: r.xml, files: fileList(r.files), notes: r.notes, check: check.issues };
}

/** The robot as SDF and as USD, as the studio's Export menu writes them (the core's result), or the refusal. */
export function sdfOf(doc: StudioDoc, name: string) {
  const { tree, partOf } = robotOf(doc), r = exportSdf(tree, partOf, name, closuresOf(doc, tree).closures);
  if (!r.ok) throw refused(`SDF refused: ${r.refusals.map(x => `[${x.code}] ${x.message}`).join(' ')}`);
  return r;
}
export function usdOf(doc: StudioDoc, name: string) {
  const { tree, partOf } = robotOf(doc), r = exportUsd(tree, partOf, name, closuresOf(doc, tree).closures);
  if (!r.ok) throw refused(`USD refused: ${r.refusals.map(x => `[${x.code}] ${x.message}`).join(' ')}`);
  return r;
}
