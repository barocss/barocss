// R7.5 (cad-model's facade): the one place the assembly facade calls the core's assembly functions — the mate solver
// (assembly/mates.ts), the face tables, the variability (O11), the robot's joint tree and frames (O12). Each change is
// written the way the agent's tool writes it (chat/assembly.ts add_part, place_part, add_mate; chat/variability.ts
// set_inputs, set_variants; chat/robot.ts set_frames), then the assembly is solved again as the tools solve it. The
// tools are async (they take an evaluator); these are their writes, done in sync over the core's sync functions. When
// the core gains them as `verb(doc, options) → doc` functions (api-conventions §3), this file calls those instead.
import { BarocssError, bracketedCode, refuse } from '@barocss/cad/api';
import { emptyDoc, placedDoc, type PartInstance, type StudioDoc } from '../engine/doc';
import { BASE, KIND_LABEL, kindsFor, mateRefusal, solveAssembly, type Mate, type MateKind } from '../assembly/mates';
import { tablesFor } from '../assembly/faces';
import { variantOf } from '../assembly/variability';
import { runVariabilityTool } from '../chat/variability';
import { jointTreeOf, readRobot, type RobotSettings } from '../robot/joints';
import type { FrameSettings } from '../robot/frames';
import { eulerOf } from '../engine/placement';
import { nextFreeId } from '../util/ids';
import { solveDoc } from '../chat/assembly';
import { bodiesOf, meshesOf, type MeshData } from './core';

type Vec3 = [number, number, number];

/** A core refusal in a tool's words (`[CODE] …`, or a sentence): its code the bracketed one, else ASSEMBLY. */
const fromTool = (message: string) => new BarocssError(bracketedCode(message) ?? 'ASSEMBLY', message, 'evaluate');

/** The document after a change, solved again from the placements before it (the tools' `changed`). */
const solved = (before: StudioDoc, next: StudioDoc) => solveDoc(next, before.instances).doc;

/** add_part: a part placed by a rotation and a move, its document the given one (the tool's is empty or a copy). */
export function addPartDoc(doc: StudioDoc, name: string, partDoc: StudioDoc, position: Vec3, rotation: Vec3, grounded: boolean): { doc: StudioDoc; id: string } {
  const instances = doc.instances ?? [], id = nextFreeId('p', new Set(instances.map(i => i.id)));
  const inst: PartInstance = { id, name, doc: partDoc, position, rotation, ...(grounded ? { grounded: true } : {}) };
  return { doc: solved(doc, { ...doc, instances: [...instances, inst] }), id };
}

/** place_part: a part's placement and grounding (`undefined` keeps each). */
export function placePartDoc(doc: StudioDoc, id: string, o: { position?: Vec3; rotation?: Vec3; grounded?: boolean }): StudioDoc {
  const instances = doc.instances ?? [], inst = instances.find(i => i.id === id)!, mates = doc.mates ?? [];
  const by = mates.filter(m => m.b.part === inst.id);
  if (o.grounded === true && by.length) throw fromTool(`${by.length} mate${by.length > 1 ? 's' : ''} move ${inst.name}; delete ${by.length > 1 ? 'them' : 'it'} first, or fix the other part.`);
  const next: PartInstance = { ...inst, position: o.position ?? inst.position, rotation: o.rotation ?? inst.rotation, ...(o.grounded === undefined ? {} : { grounded: o.grounded ? true : undefined }) };
  return solved(doc, { ...doc, instances: instances.map(i => i.id === inst.id ? next : i) });
}

/** add_mate: a mate between faces of two parts (b moves; a fixed b and a free a swap), checked, solved, or refused. */
export function addMateDoc(doc: StudioDoc, kind: MateKind, a: { part: string; face: string }, b: { part: string; face: string }, o: { distance?: number; angle?: number; flip?: boolean }): { doc: StudioDoc; id: string } {
  const instances = doc.instances ?? [], mates = doc.mates ?? [];
  if (!KIND_LABEL[kind]) throw refuse('VALUE', `a mate's kind is one of ${Object.keys(KIND_LABEL).join(', ')}, not ${String(kind)}`);
  if (a.part === b.part) throw fromTool('Both faces are on the same part; mate faces of two different parts.');
  const fixed = (p: string) => p === BASE || !!instances.find(i => i.id === p)?.grounded;
  if (fixed(b.part)) { if (fixed(a.part)) throw fromTool('Both parts are fixed (the base part and grounded parts never move): one of them must be free.'); [a, b] = [b, a]; }
  const mate: Mate = { id: nextFreeId('m', new Set(mates.map(m => m.id))), kind, a, b,
    ...(kind === 'distance' ? { distance: Number(o.distance) } : {}), ...(kind === 'angle' ? { angle: Number(o.angle) } : {}), ...(kind !== 'concentric' && o.flip ? { flip: true } : {}), ...(kind === 'concentric' && typeof o.flip === 'boolean' ? { flip: o.flip } : {}) };
  const list = [...mates, mate], tables = tablesFor(doc), fa = tables(mate.a.part)?.[mate.a.face], fb = tables(mate.b.part)?.[mate.b.face];
  const missing = [!fa && mate.a, !fb && mate.b].filter(Boolean) as { part: string; face: string }[];
  if (missing.length) throw refuse('SELECTION_UNKNOWN', `${missing.map(r => `"${r.face}" is not a flat or round face of ${r.part}`).join('; ')}`);
  const why = mateRefusal(mate, fa, fb);
  if (why) throw fromTool(`${why}${fa && fb ? ` (these faces admit: ${kindsFor(fa, fb).join(', ')})` : ''}`);
  const r = solveAssembly(instances, list, tables, instances), problem = r.problems.find(p => p.mate === mate.id);
  if (problem) throw fromTool(problem.reason);
  return { doc: solved(doc, { ...doc, instances: r.instances, mates: list }), id: mate.id };
}

/** set_inputs and set_variants (O11): the variability written, every variant regenerated to check it. */
export function variabilityDoc(doc: StudioDoc, tool: 'set_inputs' | 'set_variants', args: Record<string, unknown>): StudioDoc {
  const out = runVariabilityTool(doc, tool, args);
  if (out.isError) throw fromTool((JSON.parse(out.content) as { error: string }).error);
  return out.doc;
}

/** A variant (O11): the master regenerated with these input values (the master itself unchanged); the core's refusal, a BarocssError, passed through as it is. */
export function variantDoc(doc: StudioDoc, values: Record<string, number | boolean | string>): StudioDoc {
  return variantOf(doc, values).doc;
}

// (The joint tree as chat/robot.ts treeOfDoc builds it, each part's gears from its own evaluation.)
function treeOf(doc: StudioDoc) {
  const s = solveDoc(doc), gears = new Map([[BASE, (doc.nodes.length ? bodiesOf(doc) : []).flatMap(b => (b.gear ? [b.gear] : []))]]);
  for (const inst of s.doc.instances ?? []) gears.set(inst.id, (inst.doc.nodes.length ? bodiesOf(inst.doc) : []).flatMap(b => (b.gear ? [b.gear] : [])));
  return jointTreeOf(s.doc, { instances: s.doc.instances ?? [], problems: s.problems }, tablesFor(s.doc), p => gears.get(p) ?? []);
}

/** set_frames (O12): tool and sensor frames on links, added, replaced or (null) removed, each checked on the tree. */
export function framesDoc(doc: StudioDoc, frames: Record<string, FrameSettings | null>): StudioDoc {
  const was = readRobot(doc.robot), all: Record<string, FrameSettings> = { ...(was.frames ?? {}) };
  for (const [name, f] of Object.entries(frames)) {
    if (f === null) { if (!all[name]) throw fromTool(`[FRAME_NAME] no frame ${name} to remove (frames: ${Object.keys(all).join(', ') || 'none'})`); delete all[name]; continue; }
    all[name] = { link: f.link, ...(f.position !== undefined ? { position: [...f.position] } : {}), ...(f.rotation !== undefined ? { rotation: [...f.rotation] } : {}), ...(f.kind ? { kind: f.kind } : {}) };
  }
  const { frames: _f, ...rest } = was; void _f;
  const next: RobotSettings = { ...rest, ...(Object.keys(all).length ? { frames: all } : {}) };
  const named = new Set(Object.keys(frames)), bad = treeOf({ ...doc, robot: next }).problems.find(p => p.frame !== undefined && named.has(p.frame));
  if (bad) throw fromTool(bad.message);
  const robot = next.base || next.joints || next.frames ? next : undefined, out = { ...doc };
  if (robot) out.robot = robot; else delete out.robot;
  return out;
}

/** Each frame's world pose at the solved pose (mm, degrees about X, then Y, then Z). */
export function framePosesOf(doc: StudioDoc) {
  return (treeOf(doc).frames ?? []).map(f => ({ name: f.name, link: f.link, ...(f.kind ? { kind: f.kind } : {}), positionMM: [...f.o] as Vec3, rotationDeg: eulerOf(f.R) as Vec3 }));
}

/** The mates the solver cannot meet, with its reasons. */
export const problemsOf = (doc: StudioDoc) => solveDoc(doc).problems;

/** Every part's display triangles where it stands: the base part's bodies, then each placed part's (`<part>/<body>`). */
export function assemblyMeshes(doc: StudioDoc): MeshData[] {
  const base = doc.nodes.length ? meshesOf(doc).map(m => ({ ...m, key: `${BASE}/${m.key}` })) : [];
  return [...base, ...(doc.instances ?? []).filter(i => !i.hidden && i.doc.nodes.length).flatMap(i => meshesOf(placedDoc(i, doc)).map(m => ({ ...m, key: `${i.id}/${m.key}` })))];
}

export { BASE, emptyDoc };
