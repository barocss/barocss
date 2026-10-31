import { fillPatternDocumentProblem } from '../engine/fillFeaturePattern';
// Shared part definitions: instances placing the same part (inserted once, then duplicated) share its
// definition, so a new revision accepted for it is every one of theirs; a copy made independent gets a
// definition of its own. A new revision is loaded on purpose and waits beside the assembly until it is
// accepted (each instance keeps its place, its mates re-solve) or dismissed.
import type { PartInstance, StudioDoc } from '../engine/doc';
import { nextRevision } from '../drawing/types';
import { nextFreeId } from '../util/ids';
import { curvePatternDocumentProblem } from '../engine/curveFeaturePattern';
import { drivenRefusal, expandPatterns } from './patterns';
import { heldByRevision, heldLooks, type HeldLook } from './looks';

/** A definition id not yet used by any instance or pending revision. */
export function freshPartId(doc: StudioDoc): string {
  const used = new Set([...(doc.instances ?? []).flatMap(i => i.part ? [i.part.id] : []), ...Object.keys(doc.pendingParts ?? {})]);
  return nextFreeId('part', used);
}
const revisionRank = (r: string): number => /^\d+$/.test(r) ? Number(r) : /^[A-Z]+$/.test(r) ? [...r].reduce((t, c) => t * 26 + c.charCodeAt(0) - 64, 0) : -1;
/** The later of two revisions (of one kind: letters or numbers); the first when they cannot be compared. */
export const newerRevision = (a: string, b: string): string => revisionRank(b) > revisionRank(a) && revisionRank(a) >= 0 ? b : a;
/** A part file's revision: its drawing's, or A. */
export const revisionOf = (part: StudioDoc) => { const r = part.drawing?.revision?.trim(); return r && r !== '-' ? r : 'A'; };

/** The instances sharing a definition. */
export const sharing = (doc: StudioDoc, id: string) => (doc.instances ?? []).filter(i => i.part?.id === id);

/** The instance as a part of its own: a definition of its own at the same revision (a copy of the shared one). */
export function makeIndependent(doc: StudioDoc, instance: string): StudioDoc {
  const driven = drivenRefusal(doc, instance, 'it is its seed\'s part; make the seed independent instead (its occurrences go with it).');
  if (driven) throw driven;
  const id = freshPartId(doc);
  return expandPatterns({ ...doc, instances: (doc.instances ?? []).map(i => i.id === instance ? { ...i, part: { ...(i.part ?? { rev: 'A' }), id } } : i) });
}

/**
 * A newer file of a placed part, waiting: its revision is the file's when it says one newer than the
 * placed one, else the next after it. Refused when the file is the part as placed.
 */
export function offerRevision(doc: StudioDoc, id: string, part: StudioDoc, name: string): { doc: StudioDoc; held: HeldLook[] } | { error: string } {
  const pathProblem = fillPatternDocumentProblem(part) ?? curvePatternDocumentProblem({ instances: [{ doc: part }] });
  if (pathProblem) return { error: pathProblem };
  const placed = sharing(doc, id)[0]; if (!placed?.part) return { error: 'That part is not placed any more.' };
  const strip = (d: StudioDoc) => JSON.stringify({ ...d, render: undefined, direct: undefined, drawing: undefined });
  if (strip(part) === strip(placed.doc)) return { error: `This file is ${placed.name} as it is placed (Rev ${placed.part.rev}): nothing to update.` };
  const own = revisionOf(part), rev = own !== 'A' && own !== placed.part.rev ? own : nextRevision(placed.part.rev);
  const next = { ...doc, pendingParts: { ...doc.pendingParts, [id]: { doc: { ...part, render: undefined, direct: undefined }, rev, name } } };
  // (Roadmap 10 ①: the occurrences' own looks stay through the revision; those whose body it no longer has are listed now, held when it is accepted.)
  return { doc: next, held: heldByRevision(next, id) };
}

/** The waiting revision taken: every instance sharing the definition places it (where it is), at its revision. Each occurrence keeps its own looks (heldLooks lists those whose body is gone). */
export function acceptRevision(doc: StudioDoc, id: string): StudioDoc {
  const p = doc.pendingParts?.[id]; if (!p) return doc;
  const rest = Object.fromEntries(Object.entries(doc.pendingParts ?? {}).filter(([k]) => k !== id));
  const instances = (doc.instances ?? []).map((i): PartInstance => i.part?.id === id ? { ...i, doc: p.doc, part: { ...i.part, rev: p.rev, source: p.name } } : i);
  return expandPatterns({ ...doc, instances, pendingParts: Object.keys(rest).length ? rest : undefined });
}
/**
 * A part edited in place inside its assembly (roadmap 10 ⑧), committed once. `owner` is a placed instance (a pattern's occurrence stands for its seed);
 * `part` is its definition document as edited. Every instance sharing the definition takes it at the next revision (the file's own when it names one
 * newer), each keeping its place, joints and its own looks; a part of its own has its document replaced. The same document changes nothing
 * (`changed: false`). `held` lists the occurrences' looks whose body the edit no longer has (kept, never dropped).
 */
export function editDefinition(doc: StudioDoc, owner: string, part: StudioDoc): { doc: StudioDoc; held: HeldLook[]; changed: boolean } | { error: string } {
  const inst = (doc.instances ?? []).find(i => i.id === owner);
  if (!inst) return { error: `No part "${owner}" is placed.` };
  const seed = inst.pattern ? (doc.instances ?? []).find(i => i.id === doc.instancePatterns?.find(p => p.id === inst.pattern!.id)?.seed) : inst;
  if (!seed) return { error: `${inst.name} has lost its pattern's seed.` };
  const pathProblem = fillPatternDocumentProblem(part) ?? curvePatternDocumentProblem({ instances: [{ doc: part }] });
  if (pathProblem) return { error: pathProblem };
  // (A definition that is the assembly itself, or places the very part it replaces, would contain itself: refused, never taken.)
  const id = seed.part?.id, holds = (d: StudioDoc, depth = 0): boolean => depth < 8 && !!d.instances?.some(i => i.doc === seed.doc || holds(i.doc, depth + 1));
  if (part.instances === doc.instances && part.instances !== undefined || holds(part)) return { error: `That document contains ${seed.name} itself (it is the assembly, or places this part): a part cannot hold the instance it is edited from.` };
  if (JSON.stringify(part) === JSON.stringify(seed.doc)) return { doc, held: [], changed: false };
  // (Never backwards: the next after the newer of the placed revision and the one the part's own document names.)
  const rev = seed.part ? nextRevision(newerRevision(seed.part.rev, revisionOf(part))) : undefined;
  // (A part linked to a project file stops being linked: the file is not the edited part, so it is not offered later as a newer one. The name stays, marked.)
  const source = seed.part?.source?.startsWith('./') ? `${seed.part.source.slice(2)} (edited)` : seed.part?.source;
  const instances = (doc.instances ?? []).map((i): PartInstance => id ? (i.part?.id === id ? { ...i, doc: part, part: { ...i.part, rev: rev!, ...(source !== undefined ? { source } : {}) } } : i) : i.id === seed.id ? { ...i, doc: part } : i);
  // (A revision waiting for this definition is superseded by the edit: Accept could only silently undo it.)
  const pending = id && doc.pendingParts?.[id] ? Object.fromEntries(Object.entries(doc.pendingParts).filter(([k]) => k !== id)) : doc.pendingParts;
  const next = expandPatterns({ ...doc, instances, pendingParts: pending && Object.keys(pending).length ? pending : undefined });
  const taken = new Set((next.instances ?? []).filter(i => i.doc === part).map(i => i.id));
  return { doc: next, held: heldLooks(next).filter(h => taken.has(h.part)), changed: true };
}
/** The waiting revision dismissed: the instances stay as they are. */
export function dismissRevision(doc: StudioDoc, id: string): StudioDoc {
  const rest = Object.fromEntries(Object.entries(doc.pendingParts ?? {}).filter(([k]) => k !== id));
  return { ...doc, pendingParts: Object.keys(rest).length ? rest : undefined };
}
