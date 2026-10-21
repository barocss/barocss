// Shared part definitions: instances placing the same part (inserted once, then duplicated) share its
// definition, so a new revision accepted for it is every one of theirs; a copy made independent gets a
// definition of its own. A new revision is loaded on purpose and waits beside the assembly until it is
// accepted (each instance keeps its place, its mates re-solve) or dismissed.
import type { PartInstance, StudioDoc } from '@barocss/cad-model/engine/doc';
import { nextRevision } from '@barocss/cad-model/drawing/types';

/** A definition id not yet used by any instance or pending revision. */
export function freshPartId(doc: StudioDoc): string {
  const used = new Set([...(doc.instances ?? []).flatMap(i => i.part ? [i.part.id] : []), ...Object.keys(doc.pendingParts ?? {})]);
  let n = 1; while (used.has(`part${n}`)) n++;
  return `part${n}`;
}
/** A part file's revision: its drawing's, or A. */
export const revisionOf = (part: StudioDoc) => { const r = part.drawing?.revision?.trim(); return r && r !== '-' ? r : 'A'; };

/** The instances sharing a definition. */
export const sharing = (doc: StudioDoc, id: string) => (doc.instances ?? []).filter(i => i.part?.id === id);

/** The instance as a part of its own: a definition of its own at the same revision (a copy of the shared one). */
export function makeIndependent(doc: StudioDoc, instance: string): StudioDoc {
  const id = freshPartId(doc);
  return { ...doc, instances: (doc.instances ?? []).map(i => i.id === instance ? { ...i, part: { ...(i.part ?? { rev: 'A' }), id } } : i) };
}

/**
 * A newer file of a placed part, waiting: its revision is the file's when it says one newer than the
 * placed one, else the next after it. Refused when the file is the part as placed.
 */
export function offerRevision(doc: StudioDoc, id: string, part: StudioDoc, name: string): { doc: StudioDoc } | { error: string } {
  const placed = sharing(doc, id)[0]; if (!placed?.part) return { error: 'That part is not placed any more.' };
  const strip = (d: StudioDoc) => JSON.stringify({ ...d, render: undefined, direct: undefined, drawing: undefined });
  if (strip(part) === strip(placed.doc)) return { error: `This file is ${placed.name} as it is placed (Rev ${placed.part.rev}): nothing to update.` };
  const own = revisionOf(part), rev = own !== 'A' && own !== placed.part.rev ? own : nextRevision(placed.part.rev);
  return { doc: { ...doc, pendingParts: { ...doc.pendingParts, [id]: { doc: { ...part, render: undefined, direct: undefined }, rev, name } } } };
}

/** The waiting revision taken: every instance sharing the definition places it (where it is), at its revision. */
export function acceptRevision(doc: StudioDoc, id: string): StudioDoc {
  const p = doc.pendingParts?.[id]; if (!p) return doc;
  const rest = Object.fromEntries(Object.entries(doc.pendingParts ?? {}).filter(([k]) => k !== id));
  const instances = (doc.instances ?? []).map((i): PartInstance => i.part?.id === id ? { ...i, doc: p.doc, part: { ...i.part, rev: p.rev, source: p.name } } : i);
  return { ...doc, instances, pendingParts: Object.keys(rest).length ? rest : undefined };
}
/** The waiting revision dismissed: the instances stay as they are. */
export function dismissRevision(doc: StudioDoc, id: string): StudioDoc {
  const rest = Object.fromEntries(Object.entries(doc.pendingParts ?? {}).filter(([k]) => k !== id));
  return { ...doc, pendingParts: Object.keys(rest).length ? rest : undefined };
}
