// R7.5 (cad-model's facade): the one place the assembly facade calls the core's assembly functions — since R7.3c the
// assembly's edits are core functions (assembly/edit.ts: addPart, placePart, addMate, withFrames, the very writes the
// agent's add_part, place_part, add_mate and set_frames make), and the variability (O11), the robot's joint tree and
// frames (O12), the placed parts' meshes. A core refusal is the core's BarocssError, passed through as it is (§7).
import { BarocssError, bracketedCode, type Vec3 } from '@barocss/cad/api';
import { emptyDoc, placedDoc, type StudioDoc } from '../engine/doc';
import { BASE, lockRel, solveAssembly, type Mate, type MateKind } from '../assembly/mates';
import { tablesFor } from '../assembly/faces';
import { variantOf } from '../assembly/variability';
import { runVariabilityTool } from '../chat/variability';
import { treeOf } from './robotCore';
import type { FrameSettings } from '../robot/frames';
import { eulerOf } from '../engine/placement';
import { addMate, addPart, checkFramesOn, placePart, solveDoc, withFrames } from '../assembly/edit';
import { bodiesOf, meshesOf, type MeshData } from './core';
import { explodeOffsets } from '../assembly/explode';

// (Document fields are mutable tuples; what the facade hands back is §10.2's readonly Vec3.)
type XYZ = [number, number, number];

/** A core refusal in a tool's words (`[CODE] …`, or a sentence): its code the bracketed one, else ASSEMBLY. */
const fromTool = (message: string) => new BarocssError(bracketedCode(message) ?? 'ASSEMBLY', message, 'evaluate');

/** add_part (assembly/edit.ts addPart): a part placed by a rotation and a move, its document the given one. */
export function addPartDoc(doc: StudioDoc, name: string, partDoc: StudioDoc, position: XYZ, rotation: XYZ, grounded: boolean): { doc: StudioDoc; id: string } {
  const r = addPart(doc, { name, doc: partDoc, position, rotation, grounded });
  return { doc: r.doc, id: r.id };
}

/** place_part (placePart): a part's placement and grounding (`undefined` keeps each). */
export function placePartDoc(doc: StudioDoc, id: string, o: { position?: XYZ; rotation?: XYZ; grounded?: boolean }): StudioDoc {
  return placePart(doc, { part: id, ...o }).doc;
}

/** add_mate (addMate): a mate between faces of two parts (b moves; a fixed b and a free a swap), checked, solved, or refused. */
export function addMateDoc(doc: StudioDoc, kind: MateKind, a: { part: string; face: string }, b: { part: string; face: string }, o: { distance?: number; angle?: number; flip?: boolean }): { doc: StudioDoc; id: string } {
  const r = addMate(doc, { kind, a, b, ...o });
  return { doc: r.doc, id: r.mate.id };
}

/**
 * A part locked where it stands to another (or the base part): the studio's Lock (app/assembly/useAssembly.ts) — its
 * placement in the other's own coordinates kept as the mate's `rel`, the mate numbered as the studio numbers it — solved,
 * or the solver's reason refused. (The agent's add_mate writes no `rel` for a lock; the outer lane may take this into
 * assembly/edit.ts.)
 */
export function lockDoc(doc: StudioDoc, part: string, to: string): { doc: StudioDoc; id: string } {
  const instances = doc.instances ?? [], mates = doc.mates ?? [], b = instances.find(i => i.id === part)!, a = to === BASE ? null : instances.find(i => i.id === to)!;
  const used = new Set(mates.map(m => m.id));
  let n = mates.length + 1; while (used.has(`m${n}`)) n++;
  const mate: Mate = { id: `m${n}`, kind: 'lock', a: { part: to, face: '' }, b: { part, face: '' }, rel: lockRel(a ?? null, b) };
  const r = solveAssembly(instances, [...mates, mate], tablesFor(doc), instances), problem = r.problems.find(p => p.mate === mate.id);
  if (problem) throw fromTool(problem.reason);
  return { doc: { ...doc, instances: r.instances, mates: [...mates, mate] }, id: mate.id };
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

/** set_frames (O12, withFrames): tool and sensor frames on links, added, replaced or (null) removed, each checked on the tree. */
export function framesDoc(doc: StudioDoc, frames: Record<string, FrameSettings | null>): StudioDoc {
  const next = withFrames(doc, frames);
  checkFramesOn(treeOf(next), Object.keys(frames));
  return next;
}

/** Each frame's world pose at the solved pose (mm, degrees about X, then Y, then Z). */
export function framePosesOf(doc: StudioDoc) {
  return (treeOf(doc).frames ?? []).map(f => ({ name: f.name, link: f.link, ...(f.kind ? { kind: f.kind } : {}), position: [...f.o] as Vec3, rotation: eulerOf(f.R) as Vec3 }));
}

/** The mates the solver cannot meet, with its reasons. */
export const problemsOf = (doc: StudioDoc) => solveDoc(doc).problems;

/**
 * Every part's display triangles where it stands: the base part's bodies, then each placed part's (`<part>/<body>`) —
 * `explode` above 0 pushing each placed part out from the middle of everything as the studio's Explode does
 * (assembly/explode.ts: display only, the placements and mates unchanged).
 */
export function assemblyMeshes(doc: StudioDoc, explode = 0): MeshData[] {
  const base = doc.nodes.length ? meshesOf(doc).map(m => ({ ...m, key: `${BASE}/${m.key}` })) : [];
  const placed = (doc.instances ?? []).filter(i => !i.hidden && i.doc.nodes.length).map(i => ({ id: i.id, doc: placedDoc(i, doc) }));
  const offsets = explode > 0 ? explodeOffsets(doc.nodes.length ? bodiesOf(doc) : [], placed.map(p => ({ id: p.id, bodies: bodiesOf(p.doc) })), explode) : null;
  return [...base, ...placed.flatMap(p => meshesOf(p.doc).map(m => moved({ ...m, key: `${p.id}/${m.key}` }, offsets?.get(p.id))))];
}

// (A mesh's positions and lines moved by d — copies; none when there is no offset.)
function moved(m: MeshData, d: readonly number[] | undefined): MeshData {
  if (!d) return m;
  const positions = new Float32Array(m.positions), lines = m.lines ? new Float32Array(m.lines) : undefined;
  for (let i = 0; i < positions.length; i++) positions[i] += d[i % 3];
  if (lines) for (let i = 0; i < lines.length; i++) lines[i] += d[i % 3];
  return { ...m, positions, ...(lines ? { lines } : {}) };
}

export { BASE, emptyDoc };
