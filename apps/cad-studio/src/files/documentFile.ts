// Serialized document transport and reference reads. The App owns adoption, history and operation scopes.
// Callers must recheck their owner after awaiting these helpers, immediately before any adoption or UI write.
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { EvalResult } from '@barocss/cad-model/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { verifyReferences } from '@barocss/cad-model/engine/references';
import { downloadBytes } from '../ui/files';

export function writeDocumentFile(doc: StudioDoc, name: string): void {
  const bytes = encodeStudioFile(doc);
  downloadBytes(bytes, name, bytes[0] === 0x7b ? 'application/json' : 'application/octet-stream');
}

/** Preserve the two admission checkpoints: a superseded read must not proceed to container decoding. */
export async function readDocumentFile(file: File, current: () => boolean) {
  const bytes = await file.arrayBuffer();
  if (!current()) return null;
  const read = await readStudioFile(new Uint8Array(bytes));
  return current() ? read : null;
}

/** No UI or document writes occur here. The App checks its same owner before applying the returned data. */
export async function verifyDocumentFile(opened: StudioDoc, readPart: (doc: StudioDoc) => Promise<EvalResult>, current: () => boolean) {
  const result = await readPart(opened);
  if (!current() || !result || (!result.ok && result.error.code !== 'REFERENCE_MOVED')) return null;
  const verified = await verifyReferences(opened, result.ok ? result.bodies : [], readPart);
  return current() ? verified : null;
}
