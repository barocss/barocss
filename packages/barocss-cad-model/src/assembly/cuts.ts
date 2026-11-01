// Assembly cuts (roadmap row 10 ⑤): a hole or pocket made across placed parts, in the assembly's context. The cut is the
// document's (`assemblyCuts`: a profile, a place, a direction, a depth, the parts it cuts); every cut part is its definition with
// the cut taken in its placed document (engine/assemblyCut.ts), so two occurrences of one definition can differ, and no
// consumer (viewport, drawings, STEP, 3MF, BOM, clearance, explode) is given the uncut part. v1: top-level parts only — not the
// base part, a part inside a sub-assembly, nor a sub-assembly itself — and one cut at a time is one Undo step.
import { placedBase, type AssemblyCut, type PartInstance, type StudioDoc } from '../engine/doc';
import { cutBase, cutsOf, cutTool, partBoxOf } from '../engine/assemblyCut';
import { boughtOf } from '../engine/elements';
import { partBodyCount, partBuildProblem } from '../engine/evaluate';
import { bodyDocOf, savedInstanceOf } from './flexible';
import { refusal } from '../engine/refusal';
import type { Evaluate } from '../chat/toolKit';
import { nextFreeId } from '../util/ids';
import type { Edited } from './edit';

export { cutsOf };

type Tuple3 = [number, number, number];
const finite3 = (v: unknown): v is Tuple3 => Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number' && Number.isFinite(x));
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
/** A cut as it is named in words: its name, else its id. */
const nameOfCut = (c: Pick<AssemblyCut, 'id' | 'name'>) => c.name ? `${c.name} (${c.id})` : c.id;

/** Why a cut's own values are not good (plain words naming the cut), or undefined: what Open refuses a file over. */
export function assemblyCutShapeProblem(cut: AssemblyCut): string | undefined {
  const who = `Cut ${nameOfCut(cut ?? {} as AssemblyCut)}`;
  if (!cut || typeof cut !== 'object' || typeof cut.id !== 'string' || !cut.id) return 'Each assembly cut has an id.';
  const p = cut.profile as { kind?: string; radius?: unknown; w?: unknown; d?: unknown } | undefined;
  if (p?.kind === 'circle') { if (!positive(p.radius)) return `${who}: the circle's radius is a number above 0 (mm), not ${String(p.radius)}.`; }
  else if (p?.kind === 'rectangle') { if (!positive(p.w) || !positive(p.d)) return `${who}: the rectangle's w and d are numbers above 0 (mm), not ${String(p.w)} and ${String(p.d)}.`; }
  else return `${who}: the profile is a circle {kind: "circle", radius} or a rectangle {kind: "rectangle", w, d}.`;
  if (!finite3(cut.at)) return `${who}: at is [x, y, z] in mm, the centre of the profile.`;
  if (!finite3(cut.dir) || !cut.dir.some(v => v !== 0)) return `${who}: dir is [x, y, z], not all zero: the direction it cuts in.`;
  if (cut.depth !== 'through' && !positive(cut.depth)) return `${who}: depth is a number of mm above 0, or "through", not ${String(cut.depth)}.`;
  if (!Array.isArray(cut.targets) || !cut.targets.length || cut.targets.some(t => typeof t !== 'string')) return `${who}: targets lists the placed parts it cuts, by id (at least one).`;
  return undefined;
}
/** Why a part cannot be cut now (plain words naming the cut and the part), or undefined: a file keeps such a cut and reports it. */
export function assemblyCutTargetProblem(doc: Pick<StudioDoc, 'instances'>, cut: AssemblyCut, target: string): string | undefined {
  const who = `Cut ${nameOfCut(cut)}`, instances = doc.instances ?? [], inst = instances.find(i => i.id === target);
  if (target === 'base') return `${who}: the base part is not cut by an assembly cut yet; cut a placed part, or change the base part's own features.`;
  if (target.includes('/')) return `${who}: ${target} is a part inside a sub-assembly: an assembly cut cuts the parts placed in this assembly, not the ones inside a sub-assembly.`;
  if (!inst) return `${who}: no part "${target}" to cut; parts: ${instances.map(i => i.id).join(', ') || 'none'}.`;
  if (inst.doc.instances?.length) return `${who}: ${inst.name} (${target}) is a sub-assembly: an assembly cut cuts parts, not sub-assemblies yet.`;
  return undefined;
}
/** Why a cut cannot be made in this assembly (its values, then each target), or undefined. The editing ops refuse by this. */
export function assemblyCutProblem(doc: Pick<StudioDoc, 'instances'>, cut: AssemblyCut): string | undefined {
  const bad = assemblyCutShapeProblem(cut); if (bad) return bad;
  for (const t of new Set(cut.targets)) { const why = assemblyCutTargetProblem(doc, cut, t); if (why) return why; }
  return undefined;
}
/**
 * The first problem among a document's cuts' own values, those inside sub-assemblies too (a repeated id too), for Open: undefined when sound.
 * A target that is no longer cuttable is not one: the file keeps the cut and `assemblyCutProblems` reports it.
 */
export function assemblyCutsProblem(doc: Pick<StudioDoc, 'instances' | 'assemblyCuts'>, depth = 0): string | undefined {
  const cuts = doc.assemblyCuts;
  if (cuts !== undefined) {
    if (!Array.isArray(cuts)) return 'The model\'s assemblyCuts is a list of cuts.';
    const ids = new Set<string>();
    for (const c of cuts) {
      const why = assemblyCutShapeProblem(c); if (why) return why;
      if (ids.has(c.id)) return `Cut ${c.id} is listed twice.`;
      ids.add(c.id);
    }
  }
  if (depth < 8 && Array.isArray(doc.instances)) for (const i of doc.instances) { const why = i && typeof i === 'object' && i.doc ? assemblyCutsProblem(i.doc, depth + 1) : undefined; if (why) return why; }
  return undefined;
}
/** The cut that would make a definition's new document (one that places parts) uncuttable for the occurrences it is placed as, or undefined. */
export function cutBlockedBy(doc: Pick<StudioDoc, 'assemblyCuts' | 'instances'>, ids: readonly string[], part: StudioDoc): AssemblyCut | undefined {
  return part.instances?.length ? (doc.assemblyCuts ?? []).find(c => c.targets.some(t => ids.includes(t))) : undefined;
}
/** The refusal words for `cutBlockedBy`: the cut is named, the way out is too. */
export const cutBlockedWords = (cut: AssemblyCut, what: string) => `${what} would make a sub-assembly of a part that cut ${nameOfCut(cut)} cuts: delete that cut, or take the part off its targets, first.`;

/** The part as it stands uncut, unplaced: what a cut is taken from. */
const uncutOf = (inst: PartInstance, doc: StudioDoc): StudioDoc => placedBase(inst, { ...doc, assemblyCuts: undefined });
/**
 * Why a cut (made in `doc`) cannot be taken: some part it cuts would not build with it, would lose a body, or is longer along a through cut's axis
 * than the kernel's 10,000 mm length lets one tool reach (use a depth, or cut it in two). Built synchronously, so the editing operations refuse
 * before a document holds a cut that removes a part.
 */
export function assemblyCutTrialProblem(doc: StudioDoc, cut: AssemblyCut): string | undefined {
  const who = `Cut ${nameOfCut(cut)}`;
  for (const id of new Set(cut.targets)) {
    const inst = doc.instances?.find(i => i.id === id); if (!inst) continue;
    const bare = uncutOf(inst, doc), bodies = partBodyCount(bare), part = `${inst.name} (${inst.id})`;
    if (bodies === null) continue;   // (a part that does not build on its own is its own problem)
    if (cut.depth === 'through') { const t = cutTool(cut, inst, partBoxOf(bare, bodyDocOf(inst))); if (t.partial) return `${who}: ${part} is longer along the cut than a through cut can reach (the kernel's limit is 10,000 mm): use a depth, or cut it in two.`; }
    const next: StudioDoc = { ...doc, assemblyCuts: [...(doc.assemblyCuts ?? []).filter(c => c.id !== cut.id), cut] };
    const why = partBuildProblem(placedBase(inst, next), bodies);
    if (why) return `${who}: ${part} would not stand with it (${why}): a smaller or shorter cut, or one that stays inside the part, keeps it.`;
  }
  return undefined;
}

export type AddAssemblyCutOptions = Omit<AssemblyCut, 'id'>;
export interface EditAssemblyCutOptions { id: string; name?: string | null; profile?: AssemblyCut['profile']; at?: Tuple3; dir?: Tuple3; depth?: number | 'through'; targets?: string[] }
const copy = (c: AssemblyCut): AssemblyCut => ({ ...c, profile: { ...c.profile }, at: [...c.at], dir: [...c.dir], targets: [...c.targets] });
function withCuts(doc: StudioDoc, cuts: AssemblyCut[]): Edited {
  const next: StudioDoc = { ...doc, assemblyCuts: cuts.length ? cuts : undefined };
  if (!cuts.length) delete next.assemblyCuts;
  return { doc: next, problems: [] };
}
function find(doc: StudioDoc, id: string): AssemblyCut {
  const c = doc.assemblyCuts?.find(x => x.id === id);
  if (!c) throw refusal('NO_CUT', `No cut "${String(id)}"; cuts: ${(doc.assemblyCuts ?? []).map(x => x.id).join(', ') || 'none'}.`);
  return c;
}
/** add_cut: a cut across the named placed parts; its id. */
export function addAssemblyCut(doc: StudioDoc, o: AddAssemblyCutOptions): Edited & { id: string } {
  const cuts = doc.assemblyCuts ?? [], id = nextFreeId('cut', new Set(cuts.map(c => c.id)));
  const cut = copy({ id, ...(o.name ? { name: o.name } : {}), profile: o.profile, at: o.at, dir: o.dir, depth: o.depth, targets: Array.isArray(o.targets) ? [...new Set(o.targets)] : o.targets });
  const why = assemblyCutProblem(doc, cut) ?? assemblyCutTrialProblem(doc, cut); if (why) throw refusal('VALUE', why);
  return { ...withCuts(doc, [...cuts, cut]), id };
}
/** edit_cut: a cut's name, profile, place, direction, depth or targets changed (each left out: kept). */
export function editAssemblyCut(doc: StudioDoc, o: EditAssemblyCutOptions): Edited {
  const old = find(doc, o.id);
  const next = copy({ ...old, ...(o.profile !== undefined ? { profile: o.profile } : {}), ...(o.at !== undefined ? { at: o.at } : {}), ...(o.dir !== undefined ? { dir: o.dir } : {}), ...(o.depth !== undefined ? { depth: o.depth } : {}), ...(o.targets !== undefined ? { targets: [...new Set(o.targets)] } : {}) });
  if (o.name === null || o.name === '') delete next.name; else if (o.name !== undefined) next.name = o.name;
  const why = assemblyCutProblem(doc, next) ?? assemblyCutTrialProblem(doc, next); if (why) throw refusal('VALUE', why);
  return withCuts(doc, doc.assemblyCuts!.map(c => c === old ? next : c));
}
/** delete_cut: the cut removed; the parts are whole again. */
export function deleteAssemblyCut(doc: StudioDoc, id: string): Edited {
  const old = find(doc, id);
  return withCuts(doc, doc.assemblyCuts!.filter(c => c !== old));
}

/**
 * The part's own document as the assembly makes it for what reads it unplaced (the BOM): the definition itself when no cut
 * reaches this occurrence, else the placed part unplaced with the cuts taken from its bodies (the nodes grow; the bodies keep their keys).
 */
export function cutDocOf(inst: PartInstance, parent: StudioDoc): StudioDoc {
  if (!cutsOf(inst, parent).length) return inst.doc;
  // (Once per document and part: the BOM's evaluations are looked up by the document itself.)
  let made = cutDocs.get(parent); if (!made) cutDocs.set(parent, made = new Map());
  let doc = made.get(inst.id); if (!doc) made.set(inst.id, doc = placedBase(inst, parent));
  return doc;
}
const cutDocs = new WeakMap<StudioDoc, Map<string, StudioDoc>>();
/** `doc` with the nodes the cut occurrence's bodies were evaluated from (its looks and bodies map kept): `doc` itself when no cut reaches it. */
export function withCutNodes(doc: StudioDoc, inst: PartInstance, parent: StudioDoc): StudioDoc {
  return cutsOf(inst, parent).length ? { ...doc, nodes: placedBase(inst, parent).nodes } : doc;
}

/** A cut that does not do what it says, in words (the assembly check reports each). */
export interface AssemblyCutProblem { cut: string; part: string; kind: 'removes-nothing' | 'consumes-body' | 'not-made' | 'partial-through' | 'leaves-bought'; message: string }
const volumeOf = (r: Awaited<ReturnType<Evaluate>>): number | null => r?.ok ? r.bodies.reduce((t, b) => t + (b.volume ?? 0), 0) : null;
/**
 * What each cut does to each part it cuts, found by building the part with and without it: a cut that removes nothing (its tool
 * misses the part), one that leaves nothing of a body, one the kernel cannot make — each named with the cut and the part.
 */
export async function assemblyCutProblems(doc: StudioDoc, evaluate: Evaluate, path = '', depth = 0): Promise<AssemblyCutProblem[]> {
  const out: AssemblyCutProblem[] = [];
  for (const cut of doc.assemblyCuts ?? []) {
    // (A file keeps a cut whose values are wrong in no way Open refuses — its target gone or no longer a part — and says so here; its geometry is skipped.)
    if (assemblyCutShapeProblem(cut)) continue;
    for (const id of new Set(cut.targets)) {
      const inst = doc.instances?.find(i => i.id === id), gone = assemblyCutTargetProblem(doc, cut, id);
      if (gone || !inst) { out.push({ cut: cut.id, part: `${path}${id}`, kind: 'not-made', message: `${gone ?? `${nameOfCut(cut)} cannot be made.`} It is kept, not made.` }); continue; }
      const part = `${inst.name} (${path}${inst.id})`, without: StudioDoc = { ...doc, assemblyCuts: doc.assemblyCuts!.filter(c => c !== cut) };
      const before = volumeOf(await evaluate(placedBase(inst, without))), r = await evaluate(placedBase(inst, doc)), after = volumeOf(r);
      if (after === null) { out.push({ cut: cut.id, part: `${path}${inst.id}`, kind: 'not-made', message: `${nameOfCut(cut)} cannot be made in ${part}: ${r && !r.ok ? r.error.title : 'the part did not evaluate'}.` }); continue; }
      if (cut.depth === 'through' && cutTool(cut, inst, partBoxOf(placedBase(inst, without), bodyDocOf(inst))).partial) out.push({ cut: cut.id, part: `${path}${inst.id}`, kind: 'partial-through', message: `${nameOfCut(cut)} cannot cut through the whole of ${part}: it is longer along the cut than the kernel's 10,000 mm tool length; only the middle of it is cut.` });
      if (after <= 1e-9) out.push({ cut: cut.id, part: `${path}${inst.id}`, kind: 'consumes-body', message: `${nameOfCut(cut)} consumes the whole of ${part}: nothing is left of it.` });
      else if (before !== null && before - after <= 1e-6 * Math.max(1, before)) out.push({ cut: cut.id, part: `${path}${inst.id}`, kind: 'removes-nothing', message: `${nameOfCut(cut)} removes nothing from ${part}: its tool does not reach the part.` });
      // (A note, not a failure: the bought elements — a key, a bearing — are left whole, so a cut that would cross one says so.)
      const bare = placedBase(inst, without), crossed = await boughtCrossed(bare, inst, cut, evaluate);
      if (crossed.length) out.push({ cut: cut.id, part: `${path}${inst.id}`, kind: 'leaves-bought', message: `${nameOfCut(cut)} crosses ${crossed.join(', ')} of ${part}, a bought element: it is left whole, not cut.` });
    }
  }
  // (A sub-assembly's own cuts, on its own parts, the same way.)
  if (depth < 8) for (const inst of doc.instances ?? []) if (inst.doc.instances?.length) out.push(...await assemblyCutProblems(inst.doc, evaluate, `${path}${inst.id}/`, depth + 1));
  return out;
}

/** The bought elements of the part (by body key) the cut would reach if it were taken from them too: found by cutting them in a copy and comparing volumes. */
async function boughtCrossed(bare: StudioDoc, inst: PartInstance, cut: AssemblyCut, evaluate: Evaluate): Promise<string[]> {
  const bought = Object.entries(bare.outputs).filter(([, ref]) => bare.nodes[ref.node] && boughtOf(bare.nodes[ref.node]).bought);
  if (!bought.length) return [];
  const all = cutBase(bare, savedInstanceOf(inst), [cut], cut.depth === 'through' ? partBoxOf(bare, bodyDocOf(inst)) : null, true);
  const [r0, r1] = [await evaluate(bare), await evaluate(all)];
  if (!r0?.ok || !r1?.ok) return [];
  return bought.map(([key]) => key).filter(key => { const a = r0.bodies.find(b => b.key === key)?.volume, b = r1.bodies.find(x => x.key === key)?.volume; return a != null && b != null && a - b > 1e-6 * Math.max(1, a); });
}
