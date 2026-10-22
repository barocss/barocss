import { blobRefs } from '@barocss/cad-model/engine/blobs';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';

/** Only evaluated visible geometry needs worker arrays; drafts and hidden parts are not analysis inputs. */
export function clearanceBlobRefs(doc: StudioDoc, out = new Set<string>()): Set<string> {
  blobRefs({ ...doc, instances: undefined, pendingParts: undefined, proposals: undefined }, out);
  for (const inst of doc.instances ?? []) if (!inst.hidden) clearanceBlobRefs(inst.doc, out);
  return out;
}
