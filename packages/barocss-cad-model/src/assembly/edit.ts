// R7.3c (api-conventions §3): the assembly's edits as core functions, verb(doc, options) → result — what the agent's
// add_part, place_part, add_mate and edit_mate write, and set_frames' write. The tools (chat/assembly.ts,
// chat/robot.ts) and the facade's assembly (api/assemblyCore.ts) call these. After a change the assembly is solved
// again from the placements before it, as the studio does; a refusal is thrown, coded (ASSEMBLY_CODES).
import { emptyDoc, type PartInstance, type StudioDoc } from '../engine/doc';
import { coded, refusal, type CadModelCode } from '../engine/refusal';
import { nextFreeId } from '../util/ids';
import { tablesFor } from './faces';
import { BASE, KIND_LABEL, kindsFor, mateRefusal, solveAssembly, type Mate, type MateKind, type Vec3 } from './mates';
import { readRobot, type JointTree, type RobotSettings } from '../robot/joints';
import type { FrameSettings } from '../robot/frames';

/** What the assembly's edits refuse with. */
export const ASSEMBLY_CODES: readonly CadModelCode[] = ['NO_PART', 'PART_MATED', 'MATE_KIND', 'MATE_SAME_PART', 'MATE_BOTH_FIXED', 'MATE_FACE_UNKNOWN', 'MATE_FACES', 'MATE_UNMET', 'NO_MATE', 'FRAME_NAME'];

/** The document with its mates solved from the placements `before` (its own when left out), and what cannot be met. */
export function solveDoc(doc: StudioDoc, before?: readonly PartInstance[]): { doc: StudioDoc; problems: { mate: string; reason: string }[] } {
  if (!doc.mates?.length || !doc.instances?.length) return { doc, problems: [] };
  const r = solveAssembly(doc.instances, doc.mates, tablesFor(doc), before ?? doc.instances);
  return { doc: { ...doc, instances: r.instances }, problems: r.problems };
}

const partList = (doc: StudioDoc) => [BASE, ...(doc.instances ?? []).map(i => i.id)].join(', ');
/** A part of the document ('base' or an instance id), or undefined. */
const partDocOf = (doc: StudioDoc, part: string) => part === BASE ? doc : doc.instances?.find(i => i.id === part)?.doc;

export interface AddPartOptions {
  name: string;
  /** The part's own document (empty when left out: built later with the part tools). */
  doc?: StudioDoc;
  /** mm, and degrees about X, then Y, then Z (conventions §10.2). */
  position?: Vec3; rotation?: Vec3;
  grounded?: boolean;
}
/** An edit's result: the document, solved again, and the mates it cannot meet (each `{ mate, reason }`). */
export interface Edited { doc: StudioDoc; problems: { mate: string; reason: string }[] }

/** add_part: a part placed by a rotation and a move, the assembly solved again; its id. */
export function addPart(doc: StudioDoc, o: AddPartOptions): Edited & { id: string } {
  const instances = doc.instances ?? [], id = nextFreeId('p', new Set(instances.map(i => i.id)));
  const inst: PartInstance = { id, name: o.name, doc: o.doc ?? emptyDoc(), position: o.position ?? [0, 0, 0], rotation: o.rotation ?? [0, 0, 0], ...(o.grounded ? { grounded: true } : {}) };
  return { ...solveDoc({ ...doc, instances: [...instances, inst] }, instances), id };
}

/** A part's document as a new part starts from it (add_part's copy_of): its own features, none of the assembly's. */
export function partCopy(doc: StudioDoc, part: string): StudioDoc {
  const src = partDocOf(doc, part);
  if (!src) throw refusal('NO_PART', `No part "${part}" to copy; parts: ${partList(doc)}.`);
  return { ...src, instances: undefined, mates: undefined, render: undefined, drawing: undefined, direct: undefined };
}

export interface PlacePartOptions { part: string; position?: Vec3; rotation?: Vec3; grounded?: boolean; name?: string; hidden?: boolean }
/** place_part: a part's placement, name, grounding and visibility (each left out: kept), the assembly solved again. */
export function placePart(doc: StudioDoc, o: PlacePartOptions): Edited {
  const instances = doc.instances ?? [], inst = instances.find(i => i.id === o.part);
  if (!inst) throw refusal('NO_PART', `No part "${o.part}"; parts: ${instances.map(i => i.id).join(', ') || 'none (the base part is fixed at the origin)'}.`);
  const by = (doc.mates ?? []).filter(m => m.b.part === inst.id);
  if (o.grounded === true && by.length) throw refusal('PART_MATED', `${by.length} mate${by.length > 1 ? 's' : ''} move ${inst.name}; delete ${by.length > 1 ? 'them' : 'it'} first, or fix the other part.`);
  const next: PartInstance = { ...inst, position: o.position ?? inst.position, rotation: o.rotation ?? inst.rotation, ...(o.name !== undefined ? { name: o.name } : {}),
    ...(o.grounded === undefined ? {} : { grounded: o.grounded ? true : undefined }), ...(o.hidden === undefined ? {} : { hidden: o.hidden ? true : undefined }) };
  return solveDoc({ ...doc, instances: instances.map(i => i.id === inst.id ? next : i) }, instances);
}

/** A mate placed: the document, the mate as kept, and the freedom its moved part has left. */
export interface Mated extends Edited { mate: Mate; freedom: ReturnType<typeof solveAssembly>['freedom'][string] }

export interface AddMateOptions { kind: MateKind; a: { part: string; face: string }; b: { part: string; face: string }; distance?: number; angle?: number; flip?: boolean }
/** add_mate: a mate between faces of two parts (b moves; a fixed b and a free a swap), checked and solved. */
export function addMate(doc: StudioDoc, o: AddMateOptions): Mated {
  const instances = doc.instances ?? [], mates = doc.mates ?? [], kind = o.kind;
  if (!KIND_LABEL[kind]) throw refusal('MATE_KIND', `"kind" is one of ${Object.keys(KIND_LABEL).join(', ')}.`);
  let { a, b } = o;
  for (const r of [a, b]) if (!partDocOf(doc, r.part)) throw refusal('NO_PART', `No part "${r.part}"; parts: ${partList(doc)}.`);
  if (a.part === b.part) throw refusal('MATE_SAME_PART', 'Both faces are on the same part; mate faces of two different parts.');
  const fixed = (p: string) => p === BASE || !!instances.find(i => i.id === p)?.grounded;
  if (fixed(b.part)) { if (fixed(a.part)) throw refusal('MATE_BOTH_FIXED', 'Both parts are fixed (the base part and grounded parts never move): one of them must be free.'); [a, b] = [b, a]; }
  const mate: Mate = { id: nextFreeId('m', new Set(mates.map(m => m.id))), kind, a: { part: a.part, face: a.face }, b: { part: b.part, face: b.face },
    ...(kind === 'distance' ? { distance: Number(o.distance) } : {}), ...(kind === 'angle' ? { angle: Number(o.angle) } : {}), ...(kind !== 'concentric' && o.flip ? { flip: true } : {}), ...(kind === 'concentric' && typeof o.flip === 'boolean' ? { flip: o.flip } : {}) };
  return mated(doc, mate, [...mates, mate]);
}

export interface EditMateOptions { id: string; distance?: number; angle?: number; flip?: boolean }
/** edit_mate: a mate's distance, angle or flip changed (each left out: kept), checked and solved. */
export function editMate(doc: StudioDoc, o: EditMateOptions): Mated {
  const mates = doc.mates ?? [], old = mates.find(m => m.id === o.id);
  if (!old) throw refusal('NO_MATE', `No mate "${o.id}"; mates: ${mates.map(m => m.id).join(', ') || 'none'}.`);
  const mate: Mate = { ...old, ...(o.distance !== undefined ? { distance: Number(o.distance) } : {}), ...(o.angle !== undefined ? { angle: Number(o.angle) } : {}), ...(typeof o.flip === 'boolean' ? { flip: o.flip } : {}) };
  return mated(doc, mate, mates.map(m => m.id === mate.id ? mate : m));
}

/** A mate checked on its faces, then the assembly solved with `list`; its own problem refused. */
function mated(doc: StudioDoc, mate: Mate, list: Mate[]): Mated {
  const instances = doc.instances ?? [], tables = tablesFor(doc), fa = tables(mate.a.part)?.[mate.a.face], fb = tables(mate.b.part)?.[mate.b.face];
  const missing = [!fa && mate.a, !fb && mate.b].filter(Boolean) as { part: string; face: string }[];
  if (missing.length) throw refusal('MATE_FACE_UNKNOWN', missing.map(r => `"${r.face}" is not a flat or round face of ${r.part}`).join('; '), { missing });
  const why = mateRefusal(mate, fa, fb);
  if (why) throw refusal('MATE_FACES', `${why}${fa && fb ? ` (these faces admit: ${kindsFor(fa, fb).join(', ')})` : ''}`);
  const r = solveAssembly(instances, list, tables, instances), problem = r.problems.find(p => p.mate === mate.id);
  if (problem) throw refusal('MATE_UNMET', problem.reason, { mate: mate.id });
  return { ...solveDoc({ ...doc, instances: r.instances, mates: list }, instances), mate, freedom: r.freedom[mate.b.part] };
}

/**
 * set_frames' write (O12): tool and sensor frames on links, added or replaced by name, null removes one. The frames
 * are checked on the robot's joint tree, which needs the parts evaluated: the caller builds it from the result and
 * refuses with checkFramesOn (the tool asynchronously, the facade at once).
 */
export function withFrames(doc: StudioDoc, frames: Readonly<Record<string, FrameSettings | null>>): StudioDoc {
  const was = readRobot(doc.robot), all: Record<string, FrameSettings> = { ...(was.frames ?? {}) };
  for (const [name, f] of Object.entries(frames)) {
    if (f === null) { if (!all[name]) throw refusal('FRAME_NAME', `no frame ${name} to remove (frames: ${Object.keys(all).join(', ') || 'none'})`); delete all[name]; continue; }
    all[name] = { link: f.link, ...(f.position !== undefined ? { position: [...f.position] } : {}), ...(f.rotation !== undefined ? { rotation: [...f.rotation] } : {}), ...(f.kind ? { kind: f.kind } : {}) };
  }
  const { frames: _f, ...rest } = was; void _f;
  const next: RobotSettings = { ...rest, ...(Object.keys(all).length ? { frames: all } : {}) }, robot = next.base || next.joints || next.frames || next.motions ? next : undefined, out = { ...doc };
  if (robot) out.robot = robot; else delete out.robot;
  return out;
}
/** The first refusal of the frames `named` on the tree withFrames' document makes (its code and words, thrown). */
export function checkFramesOn(tree: Pick<JointTree, 'problems'>, named: Iterable<string>): void {
  const names = new Set(named), bad = tree.problems.find(p => p.frame !== undefined && names.has(p.frame));
  if (bad) throw coded(bad.code as CadModelCode, bad.message);
}
