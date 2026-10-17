// Part templates: new documents started from a saved one (its features, parameters, look and drawing
// settings), kept in this browser, beside two built in — an empty part and the starter plate.
import { emptyDoc, starterDoc, type StudioDoc } from '../engine/doc';
import { readStudioDoc } from '../engine/migrate';
import { inlineMeshes } from '../engine/blobs';

const KEY = 'studio.templates';
export const BUILT_IN: { name: string; doc: () => StudioDoc }[] = [{ name: 'Empty part', doc: emptyDoc }, { name: 'Plate with a hole', doc: starterDoc }];

/** The saved templates by name (unreadable ones left out). */
export function savedTemplates(): { name: string; doc: StudioDoc }[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    return Object.entries(raw).flatMap(([name, d]) => { const r = readStudioDoc(JSON.stringify(d)); return 'doc' in r ? [{ name, doc: r.doc }] : []; });
  } catch { return []; }
}
function write(all: Record<string, StudioDoc>): boolean { try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch { return false; } }
/** Saves the document as a template (its direct geometry and placed parts left out); false when the browser refuses. */
export function saveTemplate(name: string, doc: StudioDoc): boolean {
  const all = Object.fromEntries(savedTemplates().map(t => [t.name, t.doc]));
  const rest = Object.fromEntries(Object.entries(doc).filter(([k]) => k !== 'direct' && k !== 'instances' && k !== 'mates')) as unknown as StudioDoc;
  // (A template stands alone in localStorage: a mesh's blobs written back inline; refused if one is missing.)
  const own = inlineMeshes(rest);
  return own ? write({ ...all, [name]: own }) : false;
}
export function removeTemplate(name: string): boolean {
  return write(Object.fromEntries(savedTemplates().filter(t => t.name !== name).map(t => [t.name, t.doc])));
}
