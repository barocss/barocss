import { copyRenderMixedDocument, RenderMixedDocumentError } from './mixed-document.js';
import type { RenderMixedDocumentV1 } from './mixed-document.js';
import { prepareRenderMixedDocument } from './mixed-frame.js';

/** Duplicate host authoring identity. Preserve every original source/native identity. */
export function duplicateRenderMixedDocument(input: unknown, documentId: string, title: string): RenderMixedDocumentV1 {
  const original = copyRenderMixedDocument(input);
  if (typeof title !== 'string' || title.length > 256 || [...title].length > 128 || title.trim() === '') {
    throw new RenderMixedDocumentError('INPUT', 'Title must contain text and have at most 128 code points.');
  }
  if (documentId === original.documentId) {
    throw new RenderMixedDocumentError('INPUT', 'The duplicate needs a different host document ID.');
  }
  // The existing codec validates the caller's new ID and copies owned values.
  // Actual source/native/profile qualification must succeed for the whole copy.
  const duplicate = copyRenderMixedDocument({ ...original, documentId, title, revision: 0 });
  return prepareRenderMixedDocument(duplicate).document;
}
