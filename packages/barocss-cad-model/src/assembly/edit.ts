import { fillPatternDocumentProblem } from '../engine/fillFeaturePattern';
import { readConnector, validateBallOptions, validateFastenedOptions, validateUniversalOptions, validateCylindricalOptions, withConnector, type Connector } from './connectors';
// R7.3c (api-conventions §3): the assembly's edits as core functions, verb(doc, options) → result — what the agent's
// add_part, place_part, add_mate and edit_mate write, and set_frames' write. The tools (chat/assembly.ts,
// chat/robot.ts) and the facade's assembly (api/assemblyCore.ts) call these. After a change the assembly is solved
// again from the placements before it, as the studio does; a refusal is thrown, coded (ASSEMBLY_CODES).
import { emptyDoc, type PartInstance, type StudioDoc } from '../engine/doc';
import { coded, refusal, type CadModelCode } from '../engine/refusal';
import { nextFreeId } from '../util/ids';
import { curvePatternDocumentProblem } from '../engine/curveFeaturePattern';
import { tableOf, tablesFor } from './faces';
import { faceOriginOf, flatOf, hostOf, occurrenceProblem, splitPart } from '../engine/occurrences';
import { bothFixedRefusal, drivenRefusal, expandPatterns, seedMateRefusal, unsettledProblems, unsettledRefusal } from './patterns';
import { BASE, KIND_LABEL, mateKindsOf, mateFacesOf, lockRel, mateRefusal, solveAssembly, type Mate, type MateRef, type MateKind, type Vec3 } from './mates';
import { readRobot, type JointTree, type RobotSettings } from '../robot/joints';
import type { FrameSettings } from '../robot/frames';

/** What the assembly's edits refuse with. */
export const ASSEMBLY_CODES: readonly CadModelCode[] = ['VALUE', 'CONNECTOR_INVALID', 'CONNECTOR_POINT', 'CONNECTOR_UNAVAILABLE', 'CONNECTOR_KIND', 'NO_PART', 'PART_MATED', 'MATE_KIND', 'MATE_SAME_PART', 'MATE_BOTH_FIXED', 'MATE_FACE_UNKNOWN', 'MATE_FACES', 'MATE_UNMET', 'NO_MATE', 'FRAME_NAME', 'PATTERN_VALUE', 'PATTERN_DRIVEN', 'PATTERN_REFERENCED', 'NO_PATTERN', 'NO_CUT'];

/** A problem the solver or the patterns report: the mate, why, and for a pattern that does not settle its id and the mates on the cycle. */
export interface SolveProblem { mate: string; reason: string; pattern?: string; mates?: string[] }

/** What one solve of the mates gives, as the loop below needs it (the solver's own result has more). */
interface Solving { instances: readonly PartInstance[] }
/** The document settled by `solve` (the mates solved on its instances): `last` is the final result; `unsettled` the patterns still moving after the passes. */
export function settleDoc<R extends Solving>(doc: StudioDoc, solve: (doc: StudioDoc) => R): { doc: StudioDoc; last: R | undefined; unsettled: string[] } {
  let cur = expandPatterns(doc), last: R | undefined, loose: string[] = [];
  if (!cur.mates?.length || !cur.instances?.length) return { doc: cur, last, unsettled: [] };
  for (let pass = 0; pass < 4; pass++) {
    const r = solve(cur);
    const next = expandPatterns({ ...cur, instances: r.instances as PartInstance[] });
    loose = [...new Set(next.instances!.flatMap((i, n) => i.pattern && (i.position.some((v, c) => v !== r.instances[n].position[c]) || i.rotation.some((v, c) => v !== r.instances[n].rotation[c])) ? [i.pattern.id] : []))];
    cur = next; last = r;
    if (!loose.length) return { doc: cur, last, unsettled: [] };
  }
  // (Still moving after the last pass: a mate chain between a seed and its own copies. The placements stay as they were.)
  return { doc: expandPatterns(doc), last, unsettled: loose };
}

/**
 * The document with its mates solved from the placements `before` (its own when left out), and what cannot be met. The
 * patterns' occurrences are regenerated from their seeds first and again after each solve (a seed a mate moved carries its
 * occurrences; a part mated to an occurrence follows it), until they stand still. A pattern that does not settle is a
 * problem naming the mates on its cycle, and the placements stay as they were.
 */
export function solveDoc(doc: StudioDoc, before?: readonly PartInstance[]): { doc: StudioDoc; problems: SolveProblem[] } {
  const was = before ?? doc.instances ?? [];
  const s = settleDoc(doc, d => solveAssembly(d.instances!, d.mates!, tablesFor(d), was));
  return { doc: s.doc, problems: [...(s.last?.problems ?? []), ...unsettledProblems(s.doc, s.unsettled)] };
}

/**
 * One automatic re-solve (the studio's, with its own face tables): `instances` is what to write back (null: nothing to
 * write — already settled, still pending, or a pattern that does not settle), `problems` what to show, `last` the solver's result.
 */
export function resolved<R extends Solving & { problems: SolveProblem[]; pending?: boolean }>(doc: StudioDoc, solve: (doc: StudioDoc) => R): { instances: PartInstance[] | null; problems: SolveProblem[]; last: R | undefined } {
  const s = settleDoc(doc, solve), problems = [...(s.last?.problems ?? []), ...unsettledProblems(doc, s.unsettled)];
  if (s.last?.pending || s.unsettled.length) return { instances: null, problems, last: s.last };
  const was = doc.instances ?? [], now = s.doc.instances ?? [];
  const same = was.length === now.length && now.every((i, k) => i.id === was[k].id && i.doc === was[k].doc && i.hidden === was[k].hidden && i.position.every((v, c) => Math.abs(v - was[k].position[c]) <= 1e-9) && i.rotation.every((v, c) => Math.abs(v - was[k].rotation[c]) <= 1e-9));
  return { instances: same ? null : [...now], problems, last: s.last };
}

const partList = (doc: StudioDoc) => [BASE, ...(doc.instances ?? []).map(i => i.id)].join(', ');
/** A part of the document ('base' or an instance id), or undefined. */
const partDocOf = (doc: StudioDoc, part: string) => part === BASE ? doc : doc.instances?.find(i => i.id === hostOf(part))?.doc;
/**
 * A mate end as it is stored: a face of a part inside a sub-assembly named through the sub-assembly itself (`p1` and a folded
 * name, which moves with its siblings) becomes the path form (`p1/p2` and the part's own name); anything else is as given.
 */
function canonicalRef<R extends { part: string; face: string }>(doc: StudioDoc, ref: R): R {
  const inst = ref.part === BASE || ref.part.includes('/') ? undefined : doc.instances?.find(i => i.id === ref.part);
  if (!inst?.doc.instances?.length) return ref;
  let flat: StudioDoc;
  try { flat = flatOf(inst.doc); } catch { return ref; }
  if (!tableOf(flat)[ref.face]) return ref;
  const o = faceOriginOf(inst.doc, ref.face);
  return o.path.length ? { ...ref, part: `${ref.part}/${o.path.join('/')}`, face: o.face } : ref;
}
/** A mate end's part, refused in words when it is not there: no such part, or a path into a sub-assembly that leads nowhere (or to a hidden part). */
function checkPart(doc: StudioDoc, part: string): void {
  const host = partDocOf(doc, part);
  if (!host) throw refusal('NO_PART', `No part "${part}"; parts: ${partList(doc)}.`);
  const why = part === BASE ? null : occurrenceProblem(host, hostOf(part), splitPart(part).path);
  if (why) throw refusal('NO_PART', `Part "${part}": ${why}.`);
}

export interface AddPartOptions {
  name: string;
  /** The part's own document (empty when left out: built later with the part tools). */
  doc?: StudioDoc;
  /** mm, and degrees about X, then Y, then Z (conventions §10.2). */
  position?: Vec3; rotation?: Vec3;
  grounded?: boolean;
}
/** An edit's result: the document, solved again, and the mates it cannot meet (each `{ mate, reason }`). */
export interface Edited { doc: StudioDoc; problems: SolveProblem[] }

/** add_part: a part placed by a rotation and a move, the assembly solved again; its id. */
export function addPart(doc: StudioDoc, o: AddPartOptions): Edited & { id: string } {
  const pathProblem = o.doc && (fillPatternDocumentProblem(o.doc) ?? curvePatternDocumentProblem({ instances: [{ doc: o.doc }] }));
  if (pathProblem) throw refusal('VALUE', pathProblem);
  const instances = doc.instances ?? [], id = nextFreeId('p', new Set(instances.map(i => i.id)));
  const inst: PartInstance = { id, name: o.name, doc: o.doc ?? emptyDoc(), position: o.position ?? [0, 0, 0], rotation: o.rotation ?? [0, 0, 0], ...(o.grounded ? { grounded: true } : {}) };
  return { ...solveDoc({ ...doc, instances: [...instances, inst] }, instances), id };
}

/** A part's document as a new part starts from it (add_part's copy_of): its own features, none of the assembly's. */
export function partCopy(doc: StudioDoc, part: string): StudioDoc {
  const src = partDocOf(doc, part);
  if (!src) throw refusal('NO_PART', `No part "${part}" to copy; parts: ${partList(doc)}.`);
  const pathProblem = fillPatternDocumentProblem(src) ?? curvePatternDocumentProblem({ instances: [{ doc: src }] });
  if (pathProblem) throw refusal('VALUE', pathProblem);
  return { ...src, instances: undefined, mates: undefined, render: undefined, drawing: undefined, direct: undefined };
}

export interface PlacePartOptions { part: string; position?: Vec3; rotation?: Vec3; grounded?: boolean; name?: string; hidden?: boolean }
/** place_part: a part's placement, name, grounding and visibility (each left out: kept), the assembly solved again. */
export function placePart(doc: StudioDoc, o: PlacePartOptions): Edited {
  const instances = doc.instances ?? [], inst = instances.find(i => i.id === o.part);
  if (!inst) throw refusal('NO_PART', `No part "${o.part}"; parts: ${instances.map(i => i.id).join(', ') || 'none (the base part is fixed at the origin)'}.`);
  const driven = drivenRefusal(doc, inst.id, 'move its seed, or edit the pattern.');
  if (driven) throw driven;
  const by = (doc.mates ?? []).filter(m => hostOf(m.b.part) === inst.id);
  if (o.grounded === true && by.length) throw refusal('PART_MATED', `${by.length} mate${by.length > 1 ? 's' : ''} move ${inst.name}; delete ${by.length > 1 ? 'them' : 'it'} first, or fix the other part.`);
  const next: PartInstance = { ...inst, position: o.position ?? inst.position, rotation: o.rotation ?? inst.rotation, ...(o.name !== undefined ? { name: o.name } : {}),
    ...(o.grounded === undefined ? {} : { grounded: o.grounded ? true : undefined }), ...(o.hidden === undefined ? {} : { hidden: o.hidden ? true : undefined }) };
  return solveDoc({ ...doc, instances: instances.map(i => i.id === inst.id ? next : i) }, instances);
}

/** A mate placed: the document, the mate as kept, and the freedom its moved part has left. */
export interface Mated extends Edited { mate: Mate; freedom: ReturnType<typeof solveAssembly>['freedom'][string] }

export interface AddMateOptions { kind: MateKind; a: MateRef; b: MateRef; distance?: number; angle?: number; flip?: boolean }
/** add_mate: a mate between faces of two parts (b moves; a fixed b and a free a swap), checked and solved. */
export function addMate(doc: StudioDoc, o: AddMateOptions): Mated {
  const instances = doc.instances ?? [], mates = doc.mates ?? [], kind = o.kind;
  if (!KIND_LABEL[kind]) throw refusal('MATE_KIND', `"kind" is one of ${Object.keys(KIND_LABEL).join(', ')}.`);
  validateFastenedOptions(kind, o);
  validateBallOptions(kind, o);
  validateUniversalOptions(kind, o);
  validateCylindricalOptions(kind, o);
  let { a, b } = o;
  a = canonicalRef(doc, a); b = canonicalRef(doc, b);
  for (const r of [a, b]) checkPart(doc, r.part);
  if (hostOf(a.part) === hostOf(b.part)) throw refusal('MATE_SAME_PART', 'Both faces are on the same part; mate faces of two different parts.');
  const own = seedMateRefusal(doc, a.part, b.part);
  if (own) throw own;
  const fixed = (p: string) => p === BASE || !!instances.find(i => i.id === hostOf(p))?.grounded;
  if (fixed(b.part)) { if (fixed(a.part)) throw bothFixedRefusal(doc, hostOf(a.part), hostOf(b.part), 'MATE_BOTH_FIXED', 'Both parts are fixed (the base part and grounded parts never move): one of them must be free.'); [a, b] = [b, a]; }
  const mate: Mate = { id: nextFreeId('m', new Set(mates.map(m => m.id))), kind, a: { ...(kind === 'fastened' || kind === 'ball' || kind === 'universal' || kind === 'cylindrical' ? a : {}), part: a.part, face: a.face, ...(a.at !== undefined ? { at: readConnector(a.at) } : {}) }, b: { ...(kind === 'fastened' || kind === 'ball' || kind === 'universal' || kind === 'cylindrical' ? b : {}), part: b.part, face: b.face, ...(b.at !== undefined ? { at: readConnector(b.at) } : {}) },
    ...(kind === 'distance' ? { distance: Number(o.distance) } : {}), ...(kind === 'angle' ? { angle: Number(o.angle) } : {}), ...(kind !== 'concentric' && o.flip ? { flip: true } : {}), ...(kind === 'concentric' && typeof o.flip === 'boolean' ? { flip: o.flip } : {}) };
  return mated(doc, mate, [...mates, mate]);
}

/**
 * PG-8, lock_part: `part` locked to `to` where they stand (the studio's Lock): a `lock` mate keeping part's placement in
 * to's own coordinates (its faces unused). Refused: an unknown part, a part locked to itself, both fixed (MATE_BOTH_FIXED),
 * a lock the solver cannot keep (MATE_UNMET); a fixed `part` and a free `to` swap, as add_mate swaps them.
 */
export function lockPart(doc: StudioDoc, o: { part: string; to: string }): Mated {
  const instances = doc.instances ?? [], mates = doc.mates ?? [];
  for (const p of [o.part, o.to]) if (!partDocOf(doc, p)) throw refusal('NO_PART', `No part "${p}"; parts: ${partList(doc)}.`);
  if (o.part === o.to) throw refusal('MATE_SAME_PART', 'A part is locked to another part, not to itself.');
  const driven = drivenRefusal(doc, o.part, 'it never moves for a lock; lock another part to it.') ?? seedMateRefusal(doc, o.part, o.to);
  if (driven) throw driven;
  const fixed = (p: string) => p === BASE || !!instances.find(i => i.id === p)?.grounded;
  let [a, b] = [o.to, o.part];
  if (fixed(b)) { if (fixed(a)) throw bothFixedRefusal(doc, a, b, 'MATE_BOTH_FIXED', 'Both parts are fixed (the base part and grounded parts never move): one of them must be free.'); [a, b] = [b, a]; }
  const at = (p: string) => instances.find(i => i.id === p) ?? null;
  const mate: Mate = { id: nextFreeId('m', new Set(mates.map(m => m.id))), kind: 'lock', a: { part: a, face: '' }, b: { part: b, face: '' }, rel: lockRel(a === BASE ? null : at(a), at(b)!) };
  const list = [...mates, mate], r = solveAssembly(instances, list, tablesFor(doc), instances), problem = r.problems.find(p => p.mate === mate.id) ?? (list.some(m => m.kind === 'fastened' || m.kind === 'ball' || m.kind === 'universal' || m.kind === 'cylindrical') ? r.problems[0] : undefined);
  if (problem) throw refusal('MATE_UNMET', problem.reason, { mate: mate.id });
  const solved = solveDoc({ ...doc, instances: r.instances, mates: list }, instances), loose = unsettledRefusal(solved.problems, mate.id, doc, a, b);
  if (loose) throw loose;
  return { ...solved, mate, freedom: r.freedom[b] };
}

export interface EditMateOptions { connectors?: { a?: Connector | null; b?: Connector | null }; id: string; distance?: number; angle?: number; flip?: boolean }
/** edit_mate: a mate's distance, angle or flip changed (each left out: kept), checked and solved. */
export function editMate(doc: StudioDoc, o: EditMateOptions): Mated {
  const mates = doc.mates ?? [], old = mates.find(m => m.id === o.id);
  if (!old) throw refusal('NO_MATE', `No mate "${o.id}"; mates: ${mates.map(m => m.id).join(', ') || 'none'}.`);
  validateFastenedOptions(old.kind, o);
  validateBallOptions(old.kind, o);
  validateUniversalOptions(old.kind, o);
  validateCylindricalOptions(old.kind, o);
  if (o.connectors !== undefined && (!o.connectors || typeof o.connectors !== 'object' || Array.isArray(o.connectors) || Object.keys(o.connectors).some(k => k !== 'a' && k !== 'b'))) throw refusal('CONNECTOR_INVALID', 'connectors contains a and/or b; null removes a connector.');
  const mate: Mate = { ...old,
    ...(o.connectors?.a !== undefined ? { a: withConnector(old.a, o.connectors.a) } : {}),
    ...(o.connectors?.b !== undefined ? { b: withConnector(old.b, o.connectors.b) } : {}), ...(o.distance !== undefined ? { distance: Number(o.distance) } : {}), ...(o.angle !== undefined ? { angle: Number(o.angle) } : {}), ...(typeof o.flip === 'boolean' ? { flip: o.flip } : {}) };
  return mated(doc, mate, mates.map(m => m.id === mate.id ? mate : m));
}

/** A mate checked on its faces, then the assembly solved with `list`; its own problem refused. */
function mated(doc: StudioDoc, mate: Mate, list: Mate[]): Mated {
  // (Ends are as given or stored here: addMate converted its new ones; a stored end is never re-aimed.)
  checkPart(doc, mate.a.part); checkPart(doc, mate.b.part);
  const own = seedMateRefusal(doc, mate.a.part, mate.b.part);
  if (own) throw own;
  const instances = doc.instances ?? [], tables = tablesFor(doc), fa = tables(mate.a.part)?.[mate.a.face], fb = tables(mate.b.part)?.[mate.b.face];
  const missing = [!fa && mate.a, !fb && mate.b].filter(Boolean) as { part: string; face: string }[];
  if (missing.length) throw refusal('MATE_FACE_UNKNOWN', missing.map(r => `"${r.face}" is not a flat or round face of ${r.part}${!r.part.includes('/') && doc.instances?.find(i => i.id === r.part)?.doc.instances?.length ? `: ${r.part} is a sub-assembly, a face of a part inside it is named by that part's path ("${r.part}/<part id>"); pick the face again` : ''}`).join('; '), { missing });
  mateFacesOf(mate, { a: fa!, b: fb! }); // Preserve the connector refusal code at the editing boundary.
  const why = mateRefusal(mate, fa, fb);
  if (why) throw refusal('MATE_FACES', `${why}${fa && fb ? ` (these faces admit: ${mateKindsOf({ a: mate.a, b: mate.b }, { a: fa, b: fb }).join(', ')})` : ''}`);
  const r = solveAssembly(instances, list, tables, instances), problem = r.problems.find(p => p.mate === mate.id) ?? (list.some(m => m.kind === 'fastened' || m.kind === 'ball' || m.kind === 'universal' || m.kind === 'cylindrical') ? r.problems[0] : undefined);
  if (problem) throw refusal('MATE_UNMET', problem.reason, { mate: mate.id });
  const solved = solveDoc({ ...doc, instances: r.instances, mates: list }, instances), loose = unsettledRefusal(solved.problems, mate.id, doc, hostOf(mate.a.part), hostOf(mate.b.part));
  if (loose) throw loose;
  return { ...solved, mate, freedom: r.freedom[hostOf(mate.b.part)] };
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
