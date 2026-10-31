// Parts inside a sub-assembly, named stably. flattenAssembly folds a sub-assembly's instances into one document and
// moves each one's feature ids on by a serial, so nested part p2's face `n1.top` reads `n7.top` there, and the 7 moves
// when an earlier sibling gains a feature or is hidden. An occurrence path (`sub1/p2`: instance ids, the first a part of
// the assembly) with the face in p2's own naming does not move. This module maps one to the other, through the serials
// flattenPlan reports, so the two cannot disagree.
import type { StudioDoc } from './doc';
import { flattenPlan } from './flatten';
import { renameFeatureIds, featureIdsOf } from './ids';
import type { FaceTable } from '../assembly/mates';
import type { Brep } from '@barocss/cad';

/** A part named in an assembly: the instance it moves with, and the path from it down to the part (empty: the instance itself). */
export function splitPart(part: string): { host: string; path: string[] } {
  const [host, ...path] = part.split('/');
  return { host, path };
}
/** The instance an occurrence path moves with (a plain id, `base`, stays as it is). */
export const hostOf = (part: string): string => part.indexOf('/') < 0 ? part : part.slice(0, part.indexOf('/'));

// (Per document object: a sub-assembly is folded once for as long as it is the same document.)
const plans = new WeakMap<StudioDoc, { doc: StudioDoc; placed: { id: string; serial: number }[] }>();
function planOf(doc: StudioDoc) {
  let plan = plans.get(doc);
  if (!plan) { plan = flattenPlan(doc); plans.set(doc, plan); }
  return plan;
}
/** The sub-assembly's document folded (flattenAssembly), kept per document object. */
export const flatOf = (doc: StudioDoc): StudioDoc => doc.instances?.length ? planOf(doc).doc : doc;

const moveIds = (name: string, by: number): string => renameFeatureIds(name, id => id.replace(/^n(\d+)/, (_, d: string) => `n${Math.max(0, Number(d) + by)}`));

/**
 * A face or edge named in nested part `path`'s own naming, as flattenAssembly(doc) names it; null when the path does not
 * lead to a shown part. `path` empty: the sub-assembly's own features, named as they are.
 */
export function flatFaceOf(doc: StudioDoc, path: readonly string[], face: string): string | null {
  if (!path.length) return face;
  const inst = doc.instances?.find(i => i.id === path[0]);
  if (!inst || inst.hidden) return null;
  const at = planOf(doc).placed.find(p => p.id === inst.id);
  const inner = at ? flatFaceOf(inst.doc, path.slice(1), face) : null;
  return inner === null || !at ? null : moveIds(inner, at.serial);
}

/**
 * The inverse: a name in flattenAssembly(doc), as the nested part it belongs to names it. `path` is empty for the
 * sub-assembly's own features (and for names with no feature, an origin plane). The first feature id in the name decides.
 */
export function faceOriginOf(doc: StudioDoc, flatName: string): { path: string[]; face: string } {
  const first = featureIdsOf(flatName)[0], m = first === undefined ? null : /^n(\d+)/.exec(first);
  if (!m) return { path: [], face: flatName };
  const x = Number(m[1]), placed = planOf(doc).placed;
  let owner: { id: string; serial: number } | undefined;
  for (const p of placed) if (p.serial <= x) owner = p;
  const inst = owner && doc.instances?.find(i => i.id === owner!.id);
  if (!owner || !inst) return { path: [], face: flatName };
  const inner = faceOriginOf(inst.doc, moveIds(flatName, -owner.serial));
  return { path: [owner.id, ...inner.path], face: inner.face };
}

/**
 * Why `path` (from instance `host`, a sub-assembly's id) leads to no part, in plain words (null when it does: each step a
 * part, none hidden). `doc` is the host instance's document.
 */
export function occurrenceProblem(doc: StudioDoc, host: string, path: readonly string[]): string | null {
  let at = doc;
  for (const [k, id] of path.entries()) {
    const inst = at.instances?.find(i => i.id === id), under = [host, ...path.slice(0, k)].join('/');
    if (!inst) return `no part "${id}" in ${under}${at.instances?.length ? ` (its parts: ${at.instances.map(i => i.id).join(', ')})` : ' (it holds no parts)'}`;
    if (inst.hidden) return `"${id}" in ${under} is hidden, so its faces are not there to mate`;
    at = inst.doc;
  }
  return null;
}

/**
 * A placed sub-assembly's B-rep with its face and edge names in the nested part's own ids, led by the part's path
 * (`p2/n1.top`; an edge `p2/n1.side0|n1.top`): the drawing puts the instance's id before, `sub1/p2/n1.top`, which a
 * sibling's edit does not change. A name of the sub-assembly's own features is left as it is.
 */
export function stableNames(brep: Brep, doc: StudioDoc): Brep {
  const rename = (name: string | undefined): string | undefined => {
    if (name === undefined) return name;
    const o = faceOriginOf(doc, name);
    return o.path.length ? `${o.path.join('/')}/${o.face}` : name;
  };
  return { ...brep, faces: brep.faces.map(f => f.name === undefined ? f : { ...f, name: rename(f.name) }), edges: brep.edges.map(e => e.name === undefined ? e : { ...e, name: rename(e.name) }) };
}

/** The nested parts of a sub-assembly with their paths, depth first (hidden ones marked), for listing. */
export function nestedParts(doc: StudioDoc, under: readonly string[] = []): { path: string; name: string; hidden?: true }[] {
  return (doc.instances ?? []).flatMap(i => [{ path: [...under, i.id].join('/'), name: i.name, ...(i.hidden ? { hidden: true as const } : {}) }, ...(i.hidden ? [] : nestedParts(i.doc, [...under, i.id]))]);
}

/**
 * The nested part a body of the folded sub-assembly comes from, as its path relative to `doc` (`['p2']`, `['p2','q1']`
 * deeper), `[]` for the sub-assembly's own features, null when no face name carries a feature. `faceNames` are the body's
 * mesh face names as flattenAssembly(doc) names them (merged `a+b` names allowed). Not by body key: a placed body's key
 * is the id of its last move (translate / rotate), a node after the part's own, so it can fall in the next part's ids.
 * Faces of different parts share the path they have in common.
 */
export function bodyOriginOf(doc: StudioDoc, faceNames: readonly string[]): string[] | null {
  let common: string[] | null = null;
  for (const name of faceNames) {
    if (!featureIdsOf(name).length) continue;
    const path = faceOriginOf(doc, name).path;
    if (!common) { common = path; continue; }
    let k = 0; while (k < common.length && k < path.length && common[k] === path[k]) k++;
    common = common.slice(0, k);
  }
  return common;
}

/** Whether an origin path is `path` itself or inside it (a sub-assembly's path covers every part within). */
export const pathWithin = (origin: readonly string[], path: readonly string[]): boolean => path.length <= origin.length && path.every((id, k) => origin[k] === id);

/** Which of a host's bodies (each by its mesh face names) come from nested part `path` or from inside it. */
export function bodiesWithin(doc: StudioDoc, bodies: readonly (readonly string[])[], path: readonly string[]): number[] {
  const out: number[] = [];
  bodies.forEach((names, k) => { const o = bodyOriginOf(doc, names); if (o && pathWithin(o, path)) out.push(k); });
  return out;
}

// (Read again for every mate of every solve: kept per table and document object.)
const tables = new WeakMap<FaceTable, WeakMap<StudioDoc, Map<string, FaceTable>>>();
/**
 * The faces of nested part `path` from the sub-assembly's folded face table (flatOf(doc) read as faces), each by the
 * part's own name and in the sub-assembly's coordinates, where the part sits in it. A part's origin planes are not there.
 */
export function pathTable(flat: FaceTable, doc: StudioDoc, path: readonly string[]): FaceTable {
  const key = path.join('/');
  let byDoc = tables.get(flat); if (!byDoc) tables.set(flat, byDoc = new WeakMap());
  let byPath = byDoc.get(doc); if (!byPath) byDoc.set(doc, byPath = new Map());
  const had = byPath.get(key); if (had) return had;
  const out: FaceTable = {};
  byPath.set(key, out);
  for (const [name, face] of Object.entries(flat)) {
    const o = faceOriginOf(doc, name);
    if (o.path.length === path.length && o.path.every((id, k) => id === path[k]) && !(path.length && name.startsWith('origin:'))) out[o.face] = face;
  }
  return out;
}

/** Whether `flatten` agrees: every name of the folded document's table (a test's check) comes back to the same name through the path. */
export const roundTrips = (doc: StudioDoc, name: string): boolean => { const o = faceOriginOf(doc, name); return flatFaceOf(doc, o.path, o.face) === name; };
