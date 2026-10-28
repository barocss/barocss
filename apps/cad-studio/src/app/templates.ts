// Part templates: new documents started from a saved one (its features, parameters, look and drawing
// settings), kept in this browser, beside two built in — an empty part and the starter plate.
import { emptyDoc, starterDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { readStudioDoc } from '@barocss/cad-model/engine/migrate';
import { fontRefs, inlineMeshes } from '@barocss/cad-model/engine/blobs';

const KEY = 'studio.templates';
export const BUILT_IN: { name: string; doc: () => StudioDoc }[] = [{ name: 'Empty part', doc: emptyDoc }, { name: 'Plate with a hole', doc: starterDoc }];

/** Local templates have no font-byte container; the saved document must retain its original font files. */
export function fontTemplateProblem(doc: StudioDoc): string | null {
  return fontRefs(doc).size ? 'Local templates cannot preserve font files. Save as .bcad to keep the original font bytes.' : null;
}
/** Keep the stored entries intact, including entries the current template list cannot offer. */
function storedTemplates(): Record<string, unknown> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  } catch { return {}; }
}
/** The usable saved templates by name; omitted entries remain in localStorage. */
export function savedTemplates(): { name: string; doc: StudioDoc }[] {
  const result: { name: string; doc: StudioDoc }[] = [];
  try {
    for (const [name, doc] of Object.entries(storedTemplates())) {
      const read = readStudioDoc(JSON.stringify(doc));
      if ('doc' in read && !fontTemplateProblem(read.doc)) result.push({ name, doc: read.doc });
    }
    return result;
  } catch { return []; }
}
function write(all: Record<string, unknown>): boolean { try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch { return false; } }
/** Saves the document as a template (its direct geometry and placed parts left out); false when the browser refuses. */
export function saveTemplate(name: string, doc: StudioDoc): boolean {
  if (fontTemplateProblem(doc)) return false;
  const all = storedTemplates();
  const rest = Object.fromEntries(Object.entries(doc).filter(([k]) => k !== 'direct' && k !== 'instances' && k !== 'mates')) as unknown as StudioDoc;
  // (A template stands alone in localStorage: a mesh's blobs written back inline; refused if one is missing.)
  const own = inlineMeshes(rest);
  return own ? write({ ...all, [name]: own }) : false;
}
export function removeTemplate(name: string): boolean {
  const all = storedTemplates();
  delete all[name];
  return write(all);
}
