import { evaluateSurface, surfaceDomain } from '@barocss/cad';
import type { Surface } from '@barocss/cad';
import { prepareRenderMixedDocument } from './mixed-frame.js';
import type { PreparedRenderMixedDocument } from './mixed-frame.js';
import { RenderMixedDocumentError } from './mixed-document.js';

export interface RenderMixedSurfacePointResult {
  readonly documentId: string;
  readonly documentRevision: number;
  readonly assetId: string;
  /** Declared source association, not a historical content certificate. */
  readonly assetRevision: number;
  readonly sourceVersion: 0;
  readonly modelId: string;
  readonly surfaceId: string;
  readonly domain: { readonly u: readonly [number, number]; readonly v: readonly [number, number] };
  readonly parameters: { readonly u: number; readonly v: number };
  readonly pointMM: readonly [number, number, number];
}

/** Original native Source0 D0 evaluation in mm, independent of sampled pixels. */
export function queryRenderMixedSurfacePoint(document: unknown, u: number, v: number): RenderMixedSurfacePointResult {
  if (typeof u !== 'number' || typeof v !== 'number' || !Number.isFinite(u) || !Number.isFinite(v)) {
    throw new RenderMixedDocumentError('INPUT', 'U and V must be finite native parameters.');
  }
  let prepared: PreparedRenderMixedDocument;
  try { prepared = prepareRenderMixedDocument(document); }
  catch (cause) { throw new RenderMixedDocumentError('QUALIFICATION', 'The mixed document could not be qualified for a native Surface point.', cause); }
  const authored = prepared.document;
  const surface = prepared.model.objects.find((object): object is Surface => object.kind === 'surface' && object.id === authored.asset.surfaceId);
  if (!surface || prepared.model.name !== authored.asset.modelId) {
    throw new RenderMixedDocumentError('QUALIFICATION', 'The original selected Surface is not qualified in the prepared model.');
  }
  let domain: ReturnType<typeof surfaceDomain>, point: ReturnType<typeof evaluateSurface>;
  try { domain = surfaceDomain(surface); point = evaluateSurface(surface, u, v); }
  catch (cause) { throw new RenderMixedDocumentError('NATIVE', 'The native Surface point could not be evaluated at U and V.', cause); }
  return Object.freeze({ documentId: authored.documentId, documentRevision: authored.revision,
    assetId: authored.asset.assetId, assetRevision: authored.asset.revision, sourceVersion: 0,
    modelId: prepared.model.name, surfaceId: surface.id,
    domain: Object.freeze({ u: Object.freeze([...domain.u]) as readonly [number, number],
      v: Object.freeze([...domain.v]) as readonly [number, number] }),
    parameters: Object.freeze({ u, v }), pointMM: Object.freeze([...point]) as readonly [number, number, number] });
}
