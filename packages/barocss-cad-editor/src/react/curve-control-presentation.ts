import { resolveCadGeometryReference, type CadGeometryReferenceV0, type Curve } from '@barocss/cad';
import type { ViewerDocumentBody } from '@barocss/viewer';
import type { CadEditorSnapshot, CadEditorView } from '../types.js';
import type { CadEditorCurvePresentationReceipt, CadEditorDisplayReceipt } from './types.js';

interface OriginalCurveControl {
  reference: CadGeometryReferenceV0;
  curve: Curve;
  source: string;
  generation: number;
  displayGeneration: number;
  view: CadEditorView;
}
/** Actual receipt families stay distinct. Document controls never manufacture a focus preview. */
export type CurveControlPresentation = OriginalCurveControl & (
  | { kind: 'document'; receipt: CadEditorDisplayReceipt; displayBody: ViewerDocumentBody }
  | { kind: 'focus'; receipt: CadEditorCurvePresentationReceipt }
);

export function sameCurveControlData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Reflect.ownKeys(a), other = Reflect.ownKeys(b);
  return Object.getPrototypeOf(a) === Object.getPrototypeOf(b) && keys.length === other.length
    && keys.every(key => other.includes(key) && sameCurveControlData(Reflect.get(a, key), Reflect.get(b, key)));
}

/** Resolve original coefficients, then qualify the actual displayed Curve in its real namespace. */
export function resolveCurveControlPresentation(snapshot: CadEditorSnapshot,
  documentReceipt: CadEditorDisplayReceipt | null, focusReceipt: CadEditorCurvePresentationReceipt | null): CurveControlPresentation | null {
  const selection = snapshot.curveSelection;
  if (snapshot.disposed || !selection || snapshot.selectedBodyId !== selection.bodyId) return null;
  try {
    const resolved = resolveCadGeometryReference(snapshot.accepted, selection.reference);
    if (resolved.geometry.kind !== 'curve' || selection.index < 0 || selection.index >= resolved.geometry.controlPoints.length) return null;
    const asset = snapshot.accepted.document.assets.find(value => value.id === resolved.reference.assetId);
    const compiled = snapshot.accepted.compiledAssets.find(value => value.assetId === resolved.reference.assetId);
    if (!asset || !compiled || asset.source !== resolved.source || compiled.source !== resolved.source
      || !sameCurveControlData(compiled.model.objects.find(value => value.id === resolved.geometry.id), resolved.geometry)) return null;
    const original = { reference: resolved.reference, curve: resolved.geometry, source: resolved.source,
      generation: snapshot.generation, displayGeneration: snapshot.displayGeneration, view: snapshot.view };
    if (snapshot.view.kind === 'document') {
      const receipt = documentReceipt, state = receipt?.state;
      if (!receipt || !state || state.status !== 'ready' || state.selectedUniformCurve !== null
        || !sameCurveControlData(state.document, snapshot.accepted) || !snapshot.displayBodyIds.includes(selection.bodyId)
        || state.documentBodies.length !== snapshot.displayBodyIds.length
        || !sameCurveControlData(state.documentBodies.map(value => value.binding.bodyId), snapshot.displayBodyIds)) return null;
      const displayBody = state.documentBodies.find(value => value.binding.bodyId === selection.bodyId);
      if (!displayBody || displayBody.ref.kind !== 'curve' || displayBody.ref.curveId !== resolved.geometry.id
        || !sameCurveControlData(displayBody.binding, { documentId: resolved.reference.documentId,
          documentRevision: resolved.reference.documentRevision, nativeFrame: snapshot.accepted.document.nativeFrame,
          bodyId: resolved.reference.bodyId, assetId: resolved.reference.assetId, assetRevision: resolved.reference.assetRevision,
          sourceFrame: resolved.reference.sourceFrame, modelId: compiled.model.name, geometryKind: 'curve', geometryId: resolved.geometry.id })
        || !state.visibleGeometry.some(value => sameCurveControlData(value, displayBody.ref))
        || !sameCurveControlData(state.selectedGeometry, displayBody.ref)) return null;
      return { ...original, kind: 'document', receipt, displayBody };
    }
    const receipt = focusReceipt, state = receipt?.state;
    if (!receipt || !state || snapshot.view.bodyId !== selection.bodyId || receipt.generation !== snapshot.generation
      || receipt.displayGeneration !== snapshot.displayGeneration || !sameCurveControlData(receipt.reference, resolved.reference)
      || receipt.preview.source !== resolved.source || receipt.preview.curveId !== resolved.geometry.id
      || receipt.preview.count !== snapshot.view.count || !sameCurveControlData(receipt.preview.model, compiled.model)
      || receipt.curveId !== resolved.geometry.id || receipt.sourceModelName !== compiled.model.name || state.status !== 'ready'
      || state.document !== null || state.native !== null || state.documentBodies.length !== 0 || state.curveSampleVersion !== 3
      || !sameCurveControlData(state.selectedUniformCurve, receipt.preview) || state.visibleGeometry.length !== 1
      || !sameCurveControlData(state.visibleGeometry[0], { kind: 'curve', modelId: compiled.model.name, curveId: resolved.geometry.id })
      || !sameCurveControlData(state.selectedGeometry, state.visibleGeometry[0])) return null;
    return { ...original, kind: 'focus', receipt };
  } catch { return null; }
}
