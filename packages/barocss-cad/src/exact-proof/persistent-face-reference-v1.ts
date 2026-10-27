import type { SplitEvolutionReceipt, SplitFaceIdentity } from '../features/split-face-evolution.js';

/** Authored reference, never a volatile Face array index or nearest-face heuristic. */
export interface AuthoredFaceReferenceV1 {
  readonly version: 1;
  readonly featureId: string;
  readonly outputRole: string;
  readonly target: SplitFaceIdentity;
}
export type FaceResolutionV1 =
  | { readonly status: 'resolved'; readonly target: SplitFaceIdentity; readonly side: 'negative' | 'positive' }
  | { readonly status: 'missing'; readonly reason: 'deleted' | 'no-lineage' }
  | { readonly status: 'ambiguous'; readonly candidates: readonly SplitFaceIdentity[] }
  | { readonly status: 'unsupported'; readonly reason: 'unqualified-receipt' | 'invalid-reference' };

const validId = (x: unknown) => typeof x === 'string' && x.length > 0 && x.length <= 128;
const identity = (x: unknown): x is SplitFaceIdentity => x !== null && typeof x === 'object'
  && ['sourceId','faceId','surfaceId','loopId'].every(k => validId((x as Record<string,unknown>)[k]));
const key = (x: SplitFaceIdentity) => JSON.stringify([x.sourceId,x.faceId,x.surfaceId,x.loopId]);
const copy = (x: SplitFaceIdentity): SplitFaceIdentity =>
  ({sourceId:x.sourceId,faceId:x.faceId,surfaceId:x.surfaceId,loopId:x.loopId});

/**
 * Read-only v1 reference resolution for a previously validated native Split.
 * This does not certify lineage authenticity or edit a CAD document.
 * For one parent face, zero surviving outputs -> missing; more than one ->
 * ambiguous. No silent retargeting even when candidates look geometrically
 * identical. A caller may commit only a resolved result against its revision.
 */
export function resolveAuthoredFaceAfterSplitV1(
  authored: AuthoredFaceReferenceV1,
  receipt: SplitEvolutionReceipt,
): FaceResolutionV1 {
  if (!authored || authored.version !== 1 || !validId(authored.featureId) ||
      !validId(authored.outputRole) || !identity(authored.target))
    return {status:'unsupported',reason:'invalid-reference'};
  if (!receipt || receipt.schema !== 'barocss-cad-split-face-evolution' ||
      receipt.version !== 0 || receipt.namingCertified !== false ||
      !Array.isArray(receipt.faces))
    return {status:'unsupported',reason:'unqualified-receipt'};
  const matching = receipt.faces.filter(entry => identity(entry.parent) &&
    key(entry.parent) === key(authored.target));
  if (matching.length !== 1) return matching.length === 0
    ? {status:'missing',reason:'no-lineage'} : {status:'unsupported',reason:'unqualified-receipt'};
  const entry = matching[0];
  if (!Array.isArray(entry.outcomes)) return {status:'unsupported',reason:'unqualified-receipt'};
  const survivors = entry.outcomes.filter((o: SplitEvolutionReceipt['faces'][number]['outcomes'][number]) => o.output !== null);
  if (survivors.some((o: SplitEvolutionReceipt['faces'][number]['outcomes'][number]) => !identity(o.output) || !['negative','positive'].includes(o.side)))
    return {status:'unsupported',reason:'unqualified-receipt'};
  if (survivors.length === 0) return {status:'missing',reason:'deleted'};
  if (survivors.length > 1) return {status:'ambiguous',candidates:survivors.map((o: SplitEvolutionReceipt['faces'][number]['outcomes'][number]) => copy(o.output!))};
  return {status:'resolved',target:copy(survivors[0].output!),side:survivors[0].side};
}
