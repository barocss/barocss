// Current Drawing data admission only. No document-schema promotion or historical migration.
import { checkSavedDrawingFrames } from '../drawing/controls';
import { refused, refusal } from './refusal';

const own = (x: object, key: string) => Object.hasOwn(x, key);
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(Object.getOwnPropertyDescriptors(value)).some(d => !('value' in d))) throw refusal('DRAWING_OPTIONS', 'Saved drawing document paths must be own data records.');
  return value as Record<string, unknown>;
}
/** Validate raw Drawing fields before a reader can filter them; never change document fields or identity. */
export function assertSavedDrawingDocument(input: unknown): void {
  const seen = new Set<object>();
  const visit = (value: unknown): void => {
    const doc = record(value);
    if (seen.has(doc)) throw refusal('DRAWING_OPTIONS', 'Nested drawing documents must not be cyclic.');
    seen.add(doc);
    const issue = checkSavedDrawingFrames(doc.drawing)[0];
    if (issue) throw refused(issue);
    if (own(doc, 'instances') && doc.instances !== undefined) {
      if (!Array.isArray(doc.instances)) throw refusal('DRAWING_OPTIONS', 'Saved document instances must be an array.');
      for (let i = 0; i < doc.instances.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(doc.instances, String(i));
        if (!descriptor || !('value' in descriptor)) throw refusal('DRAWING_OPTIONS', 'Saved document instances must be dense own data.');
        const instance = record(descriptor.value);
        if (own(instance, 'doc')) visit(instance.doc);
      }
    }
    if (own(doc, 'pendingParts') && doc.pendingParts !== undefined) {
      const pending = record(doc.pendingParts);
      for (const value of Object.values(pending)) { const part = record(value); if (own(part, 'doc')) visit(part.doc); }
    }
    seen.delete(doc);
  };
  visit(input);
}
