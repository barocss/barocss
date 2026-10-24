// CG6 S4 (DA-7): placed parts referenced by their path in the project. A part inserted from the project keeps the
// document's own copy (a .bcad stays whole on its own) and names its file in the instance's `part.source` as a
// project-relative path, `./<path>` — a part inserted from disk names a bare file name, so the two never mix. When the
// assembly is opened (or checked), each such file is read again: one that differs from the part as placed is offered
// through the existing shared-definition path — "Revision waiting", then Accept or Keep (assembly/definitions.ts) — so
// nothing changes until the person accepts it. Accepting keeps the source, so the link stays.
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { offerRevision } from '@barocss/cad-model/assembly/definitions';
import { partsOf, readPart } from './project';
import type { ProjectStore } from './store';

/** A project path as a placed part's source. */
export const linkSource = (path: string) => `./${path}`;
/** The project path a placed part's source names, or null for a file from elsewhere. */
export const linkedPath = (source: string | undefined) => source?.startsWith('./') ? source.slice(2) : null;

export interface Linked {
  /** The document with the newer files waiting (pendingParts), or as it was. */
  doc: StudioDoc;
  /** The project paths offered as a newer revision. */
  offered: string[];
  /** The project paths placed parts name that the project no longer has. */
  missing: string[];
}
const strip = (d: StudioDoc) => JSON.stringify({ ...d, render: undefined, direct: undefined, drawing: undefined });

/** Each shared definition whose project file differs from the part as placed, offered as a waiting revision. */
export async function linkedRevisions(doc: StudioDoc, store: ProjectStore): Promise<Linked> {
  const paths = new Set((await partsOf(store)).map(e => e.path)), out: Linked = { doc, offered: [], missing: [] }, seen = new Set<string>();
  for (const inst of doc.instances ?? []) {
    const part = inst.part, path = linkedPath(part?.source);
    if (!part || path === null || seen.has(part.id)) continue;
    seen.add(part.id);
    if (!paths.has(path)) { out.missing.push(path); continue; }
    const r = await readPart(store, path);
    if ('error' in r) { out.missing.push(path); continue; }
    // (Already waiting as this file: not offered again.)
    const waiting = out.doc.pendingParts?.[part.id];
    if (waiting && strip(waiting.doc) === strip({ ...r.doc, render: undefined, direct: undefined })) continue;
    const offered = offerRevision(out.doc, part.id, r.doc, linkSource(path));
    if ('doc' in offered) { out.doc = offered.doc; out.offered.push(path); }
  }
  return out;
}
