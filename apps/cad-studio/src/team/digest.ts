// Content digests (A8.4b, O32's addendum): SHA-256 of the canonical JSON, 64 hex digits — for integrity, where A7's
// 64-bit revision is for staleness only. Synchronous and our own (the decisions that pin digests are synchronous;
// WebCrypto's digest is not); the tests check it against node:crypto.
import type { StudioDoc } from '../engine/doc';
import { canonical, revisionContent } from './team';
import { sha256Hex, sha256Text } from '@barocss/cad-model/team/sha256';
export { sha256Hex, sha256Text };
/** A value's content digest: the SHA-256 of its canonical JSON. */
export const digestOf = (v: unknown) => sha256Text(canonical(v));
/** A part's revision digest: what it is (its document's revision fields) and where it is placed. */
export const partDigest = (inst: NonNullable<StudioDoc['instances']>[number]) => digestOf({ doc: revisionContent(inst.doc), position: inst.position, rotation: inst.rotation, hidden: !!inst.hidden });
/** Every part's revision digest, the base part's (its own features, when it has any) as `base`. */
export function partDigests(doc: StudioDoc): Record<string, string> {
  const out: Record<string, string> = {};
  if (doc.nodes.length) out.base = digestOf({ nodes: doc.nodes, parameters: doc.parameters, bodies: doc.bodies });
  for (const inst of doc.instances ?? []) out[inst.id] = partDigest(inst);
  return out;
}
