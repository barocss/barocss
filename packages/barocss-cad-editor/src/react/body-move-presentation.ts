import { createCadGeometryReference, queryCadDocumentBounds, type CadDocumentBoundsResult } from '@barocss/cad';
import type { ViewerDocumentBody } from '@barocss/viewer';
import type { CadEditorSnapshot } from '../types.js';
import type { CadEditorDisplayReceipt, CadEditorCurvePresentationReceipt } from './types.js';
import { sameCurveControlData as same } from './curve-control-presentation.js';

type OriginalBody = {
  reference: CadDocumentBoundsResult['reference']; geometry: CadDocumentBoundsResult['geometry']; source: string;
  bounds: CadDocumentBoundsResult; anchorMM: [number, number, number];
  generation: number; displayGeneration: number; view: CadEditorSnapshot['view'];
};
/** A box centre is a translation display anchor, never an authored pole or a rotation/scale pivot. */
export type BodyMovePresentation = OriginalBody & (
  | { kind: 'document'; receipt: CadEditorDisplayReceipt; displayBody: ViewerDocumentBody }
  | { kind: 'focus'; receipt: CadEditorCurvePresentationReceipt }
);
export function resolveBodyMovePresentation(snapshot: CadEditorSnapshot, documentReceipt: CadEditorDisplayReceipt | null,
  focusReceipt: CadEditorCurvePresentationReceipt | null): BodyMovePresentation | null {
  if (snapshot.disposed || !snapshot.selectedBodyId || snapshot.selection || snapshot.curveSelection
    || !snapshot.bodyCapabilities.find(body => body.bodyId === snapshot.selectedBodyId)?.canTranslateBody) return null;
  try {
    const resolved = createCadGeometryReference(snapshot.accepted, { bodyId: snapshot.selectedBodyId });
    const asset = snapshot.accepted.document.assets.find(asset => asset.id === resolved.reference.assetId);
    const compiled = snapshot.accepted.compiledAssets.find(asset => asset.assetId === resolved.reference.assetId);
    if (!asset || !compiled || asset.source !== resolved.source || compiled.source !== resolved.source
      || !same(compiled.model.objects.find(object => object.id === resolved.geometry.id), resolved.geometry)) return null;
    if (snapshot.view.kind === 'document') {
      const receipt = documentReceipt, state = receipt?.state;
      if (!receipt || !state || state.status !== 'ready' || !same(state.document, snapshot.accepted)
        || state.selectedUniformCurve !== null || !snapshot.displayBodyIds.includes(snapshot.selectedBodyId)
        || !same(state.documentBodies.map(body => body.binding.bodyId), snapshot.displayBodyIds)) return null;
      const body = state.documentBodies.find(body => body.binding.bodyId === snapshot.selectedBodyId);
      if (!body || body.ref.kind !== resolved.geometry.kind
        || body.ref.modelId !== asset.id.replaceAll('-', '.')
        || (body.ref.kind === 'curve' ? body.ref.curveId : body.ref.surfaceId) !== resolved.geometry.id || !same(body.binding, {
        documentId: resolved.reference.documentId, documentRevision: resolved.reference.documentRevision,
        nativeFrame: snapshot.accepted.document.nativeFrame, bodyId: resolved.reference.bodyId,
        assetId: resolved.reference.assetId, assetRevision: resolved.reference.assetRevision,
        sourceFrame: resolved.reference.sourceFrame, modelId: compiled.model.name,
        geometryKind: resolved.geometry.kind, geometryId: resolved.geometry.id,
      }) || !same(state.selectedGeometry, body.ref) || !state.visibleGeometry.some(ref => same(ref, body.ref))) return null;
      const bounds = queryCadDocumentBounds(snapshot.accepted, resolved.reference);
      return { kind: 'document', receipt, displayBody: body, bounds, anchorMM: [...bounds.boxCenterMM],
        reference: resolved.reference, geometry: resolved.geometry, source: resolved.source,
        generation: snapshot.generation, displayGeneration: snapshot.displayGeneration, view: snapshot.view };
    }
    const receipt = focusReceipt, state = receipt?.state;
    if (resolved.geometry.kind !== 'curve' || snapshot.view.bodyId !== resolved.reference.bodyId || !receipt || !state
      || receipt.generation !== snapshot.generation || receipt.displayGeneration !== snapshot.displayGeneration
      || !same(receipt.reference, resolved.reference) || receipt.preview.source !== resolved.source
      || receipt.curveId !== resolved.geometry.id || receipt.sourceModelName !== compiled.model.name
      || !same(receipt.preview.model, compiled.model) || receipt.preview.curveId !== resolved.geometry.id
      || receipt.preview.count !== snapshot.view.count || state.status !== 'ready' || state.native !== null
      || state.document !== null || state.documentBodies.length !== 0 || state.curveSampleVersion !== 3
      || !same(state.selectedUniformCurve, receipt.preview) || state.visibleGeometry.length !== 1
      || !same(state.visibleGeometry[0], { kind: 'curve', modelId: compiled.model.name, curveId: resolved.geometry.id })
      || !same(state.selectedGeometry, state.visibleGeometry[0])) return null;
    const bounds = queryCadDocumentBounds(snapshot.accepted, resolved.reference);
    return { kind: 'focus', receipt, bounds, anchorMM: [...bounds.boxCenterMM], reference: resolved.reference,
      geometry: resolved.geometry, source: resolved.source, generation: snapshot.generation,
      displayGeneration: snapshot.displayGeneration, view: snapshot.view };
  } catch { return null; }
}
