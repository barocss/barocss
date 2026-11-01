// Flexible sub-assemblies (roadmap 10 ④, RS7.4): a sub-assembly placed as an occurrence keeps its own joint state. The
// sub-assembly's mates make a joint tree (robot/joints.ts, keys `base~lid`, `lid~pin`); `PartInstance.joints` holds this
// occurrence's values for them, in the tree's units (radians, mm), as OFFSETS from the pose the sub-assembly was saved in
// (the pose its mates solve to, where every joint reads 0): `{}` is the rigid fold, unset keys are 0. The posed
// sub-assembly is the same document with each nested part's placement moved by its link's motion (robot/fk.ts), so the
// fold, the face tables, the occurrence paths (names do not change with pose), the exports and the mates to a nested
// path (`sub1/lid`) all read the one posed document (`bodyDocOf`). A sub-assembly whose tree cannot pose it — its
// mates unmet, a part joined to nothing, a loop — or a key the tree lacks folds rigid, and the problem is reported by
// `instanceJointsOf`, never dropped. v1: the joints of the immediate sub-assembly only; a deeper sub-assembly's own
// occurrences keep their own `joints`. Cam couplings inside are read (a follower takes its leader's value); gear pairs are not built here, so a gear's follower holds its pose.
import type { PartInstance, StudioDoc } from '../engine/doc';
import { refusal } from '../engine/refusal';
import { clean, eulerOf, placementOf, type Mat3 } from '../engine/placement';
import { BASE } from './mates';
import { solveDoc, type Edited } from './edit';
import { tablesFor } from './faces';
import { jointTreeOf, type JointTree } from '../robot/joints';
import { forwardKinematics, type Motion } from '../robot/fk';
import { jointValuesIn, jointValuesOut } from '../robot/units';
import { drivenRefusal } from './patterns';
import { valuesProblem } from '../engine/jointValues';

const DEG = Math.PI / 180;

/** The joint tree of a sub-assembly as its saved placements stand, or why it has none that can pose it. */
function treeOfSub(sub: StudioDoc, host: string): { tree: JointTree } | { problem: string } {
  if (!sub.instances?.length) return { problem: `${host} is not a sub-assembly: it holds no parts, so it has no joints` };
  if (!sub.mates?.length) return { problem: `${host} has no mates between its parts, so it has no joints` };
  const solved = solveDoc(sub), tree = jointTreeOf(solved.doc, { instances: solved.doc.instances ?? [], problems: solved.problems }, tablesFor(solved.doc));
  const bad = tree.problems[0];
  if (bad) return { problem: `${host}: ${bad.message}` };
  if (tree.loops.length) return { problem: `${host}: ${tree.loops[0].message}` };
  return { tree };
}

/** A joint of a sub-assembly as the studio and the tools list it (degrees for a turn, mm for a slide). */
export interface InstanceJoint { key: string; type: 'revolute' | 'continuous' | 'prismatic'; parent: string; child: string; value: number; lower?: number; upper?: number }
/** A sub-assembly occurrence's joints, or `problem` (plain words) when it has none that can be set. */
export interface InstanceJoints { part: string; joints: InstanceJoint[]; problem?: string }

/**
 * The joints of a sub-assembly occurrence with this occurrence's values and the limits (degrees / mm). A sub-assembly
 * whose tree cannot pose it lists none and says why; stale values (a key the tree no longer has, a value past a limit)
 * are the `problem`, the occurrence then folding rigid.
 */
export function instanceJointsOf(doc: StudioDoc, part: string): InstanceJoints {
  const inst = doc.instances?.find(i => i.id === part);
  if (!inst) throw refusal('NO_PART', `No part "${String(part)}"; parts: ${[BASE, ...(doc.instances ?? []).map(i => i.id)].join(', ')}.`);
  return jointsOfInstance(inst);
}
/** The same for an occurrence itself (the studio's panel reads it from the selected instance). */
export function jointsOfInstance(inst: PartInstance): InstanceJoints {
  const part = inst.id, t = treeOfSub(inst.doc, `${inst.name} (${inst.id})`);
  if ('problem' in t) return { part, joints: [], problem: t.problem };
  const own = jointValuesOut(t.tree, inst.joints ?? {}), joints = t.tree.joints.filter(j => j.type !== 'fixed' && !j.mimic).map((j): InstanceJoint => {
    const turn = j.type !== 'prismatic', k = turn ? DEG : 1, l = j.limit;
    return { key: j.key, type: j.type as InstanceJoint['type'], parent: j.parent, child: j.child, value: own[j.key] ?? 0, ...(l?.lower !== undefined ? { lower: clean(l.lower / k, 1e-9) } : {}), ...(l?.upper !== undefined ? { upper: clean(l.upper / k, 1e-9) } : {}) };
  });
  const why = jointsProblem(inst, t.tree);
  return { part, joints, ...(why ? { problem: why } : {}) };
}

/** Why an occurrence's stored values cannot pose its sub-assembly (plain words), or null. */
function jointsProblem(inst: PartInstance, tree: JointTree, who = `${inst.name} (${inst.id})`): string | null {
  if (!inst.joints) return null;
  const bad = valuesProblem(inst.joints, who);
  if (bad) return bad;
  const fk = forwardKinematics(tree, inst.joints), movable = tree.joints.filter(j => j.type !== 'fixed' && !j.mimic).map(j => j.key);
  if (fk.unknown.length) return `${who} has no joint "${fk.unknown[0]}"; its joints: ${movable.join(', ') || 'none'}`;
  const follower = Object.keys(inst.joints).find(k => tree.joints.find(j => j.key === k)?.mimic);
  if (follower) return `${who}: joint "${follower}" follows another joint and takes no value of its own`;
  if (fk.outOfLimits.length) { const k = fk.outOfLimits[0], j = tree.joints.find(x => x.key === k)!, l = j.limit!, u = j.type === 'prismatic' ? 'mm' : 'degrees', s = j.type === 'prismatic' ? 1 : DEG; return `${who}: joint "${k}" is ${Number((fk.values[k] / s).toFixed(6))} ${u}, outside its limits ${l.lower !== undefined ? Number((l.lower / s).toFixed(6)) : 'no lower limit'} to ${l.upper !== undefined ? Number((l.upper / s).toFixed(6)) : 'no upper limit'}`; }
  return null;
}

/** A placement moved: x' = D (M x + T), as the instance's own position and rotation. */
function moved(i: PartInstance, d: Motion): PartInstance {
  const { m, t } = placementOf(i), R = d.R;
  const M: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) M[r * 3 + c] = R[r * 3] * m[c] + R[r * 3 + 1] * m[3 + c] + R[r * 3 + 2] * m[6 + c];
  const position = [0, 1, 2].map(r => clean(R[r * 3] * t[0] + R[r * 3 + 1] * t[1] + R[r * 3 + 2] * t[2] + d.t[r])) as [number, number, number];
  return { ...i, position, rotation: eulerOf(M) as [number, number, number], savedPlacement: i.savedPlacement ?? { position: i.position, rotation: i.rotation } };
}
const still = (d: Motion) => d.t[0] === 0 && d.t[1] === 0 && d.t[2] === 0 && d.R[0] === 1 && d.R[1] === 0 && d.R[2] === 0 && d.R[3] === 0 && d.R[4] === 1 && d.R[5] === 0 && d.R[6] === 0 && d.R[7] === 0 && d.R[8] === 1;

interface Posed { doc: StudioDoc; problem?: string }
// (Per sub-assembly document object and values: posed once for as long as both stand, as the folds are.)
const posed = new WeakMap<StudioDoc, Map<string, Posed>>();

/** Stands in cached problem text for the occurrence's name and id (the same sub-assembly document can be several occurrences). */
const WHO = '\u0001who\u0001';
/** The sub-assembly of an occurrence with its joint values applied, and the problem when they cannot be (then the document as saved). */
export function poseOf(inst: PartInstance): Posed {
  const values = inst.joints, who = `${inst.name} (${inst.id})`;
  if (values === undefined) return { doc: inst.doc };
  const bad = valuesProblem(values, who);
  if (bad) return { doc: inst.doc, problem: bad };
  const keys = Object.keys(values).sort();
  if (!keys.length) return { doc: inst.doc };
  const key = keys.map(k => `${k}=${values[k]}`).join(';');
  let byValues = posed.get(inst.doc); if (!byValues) posed.set(inst.doc, byValues = new Map());
  let out = byValues.get(key);
  if (!out) { out = pose(inst); byValues.set(key, out); }
  return out.problem === undefined ? out : { doc: out.doc, problem: out.problem.split(WHO).join(who) };
}

function pose(inst: PartInstance): Posed {
  const t = treeOfSub(inst.doc, WHO);
  if ('problem' in t) return { doc: inst.doc, problem: t.problem };
  const why = jointsProblem(inst, t.tree, WHO);
  if (why) return { doc: inst.doc, problem: why };
  // (Checked first, then: all values zero is the saved pose, the very document.)
  if (Object.values(inst.joints!).every(v => v === 0)) return { doc: inst.doc };
  const fk = forwardKinematics(t.tree, inst.joints!);
  return { doc: { ...inst.doc, instances: inst.doc.instances!.map(n => { const d = fk.motions.get(n.id); return d && !still(d) ? moved(n, d) : n; }) } };
}
/**
 * A part of a posed sub-assembly as the sub-assembly saved it. Its assembly cuts are in the part's own frame at its saved placement
 * (roadmap 10 ⑤), so they travel with the part as the joints move it: the tool is made from this, then posed with the part.
 */
export const savedInstanceOf = (inst: PartInstance): PartInstance => inst.savedPlacement ? { ...inst, ...inst.savedPlacement } : inst;

/** The document of an occurrence as it stands: its sub-assembly posed by its joint values (the very `inst.doc` when it has none). */
export const bodyDocOf = (inst: PartInstance): StudioDoc => inst.joints ? poseOf(inst).doc : inst.doc;

export interface SetInstanceJointsOptions {
  part: string;
  /** Values by joint key (instanceJointsOf lists them): degrees for a turn, mm for a slide, offsets from the saved pose; a key at its saved pose may be left out. `null` for a key removes it. */
  joints: Record<string, number | null>;
  /** True: replace every value with these (the others return to the saved pose); else the given keys change and the rest stay. */
  replace?: boolean;
}

/** set_part_joints: this occurrence's values for its sub-assembly's joints, each checked (unknown key, limits, a sub-assembly that cannot be posed), the assembly solved again as place_part's is. */
export function setInstanceJoints(doc: StudioDoc, o: SetInstanceJointsOptions): Edited {
  const instances = doc.instances ?? [], inst = instances.find(i => i.id === o.part);
  if (!inst) throw refusal('NO_PART', `No part "${String(o.part)}"; parts: ${instances.map(i => i.id).join(', ') || 'none (the base part is fixed at the origin)'}.`);
  const driven = drivenRefusal(doc, inst.id, 'set the seed\'s joints, or edit the pattern.');
  if (driven) throw driven;
  if (!o.joints || typeof o.joints !== 'object' || Array.isArray(o.joints)) throw refusal('VALUE', `${inst.name} (${inst.id}): "joints" is an object of joint key to value, e.g. {"base~lid": 45}.`);
  const who = `${inst.name} (${inst.id})`;
  // (Back to the saved pose needs no tree: it clears values a sub-assembly edited since can no longer read.)
  if (o.replace && !Object.keys(o.joints).length) { const rigid: PartInstance = { ...inst }; delete rigid.joints; return solveDoc({ ...doc, instances: instances.map(i => i.id === inst.id ? rigid : i) }, instances); }
  const t = treeOfSub(inst.doc, who);
  if ('problem' in t) throw refusal('VALUE', `${t.problem}.`);
  const movable = t.tree.joints.filter(j => j.type !== 'fixed' && !j.mimic).map(j => j.key);
  const given: Record<string, number> = {};
  for (const [k, v] of Object.entries(o.joints)) {
    const j = t.tree.joints.find(x => x.key === k);
    if (!j) throw refusal('VALUE', `${who} has no joint "${k}"${k.includes('/') ? ' (only the joints of its own parts, not of a sub-assembly inside it)' : ''}; its joints: ${movable.join(', ') || 'none'}.`);
    if (j.type === 'fixed' || j.mimic) throw refusal('VALUE', `${who}: joint "${k}" ${j.mimic ? `follows ${j.mimic.joint}` : 'is fixed'} and takes no value.`);
    if (v === null) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) throw refusal('VALUE', `${who}: joint "${k}" needs a number (${j.type === 'prismatic' ? 'mm' : 'degrees'}), not ${JSON.stringify(v)}.`);
    given[k] = v;
  }
  const radians: Record<string, number> = o.replace ? {} : { ...inst.joints };
  for (const k of Object.keys(o.joints)) if (o.joints[k] === null) delete radians[k];
  Object.assign(radians, jointValuesIn(t.tree, given));
  for (const k of Object.keys(radians)) radians[k] = Math.round(radians[k] * 1e12) / 1e12;
  const next: PartInstance = { ...inst, joints: radians };
  const why = jointsProblem(next, t.tree);
  if (why) throw refusal('VALUE', `${why}.`);
  if (!Object.keys(radians).length) delete next.joints;
  return solveDoc({ ...doc, instances: instances.map(i => i.id === inst.id ? next : i) }, instances);
}

/** The occurrences of a document whose joints are set, with the problem each has (none: the document poses them all). */
export function jointProblemsOf(doc: StudioDoc): { part: string; problem: string }[] {
  const out: { part: string; problem: string }[] = [];
  for (const i of doc.instances ?? []) if (i.joints) { const p = poseOf(i).problem; if (p) out.push({ part: i.id, problem: p }); }
  return out;
}
