import { createCadGeometryReference } from '@barocss/cad';
import type { CadDocumentResult, CadGeometryReferenceV0 } from '@barocss/cad';
import { prepareSelectedUniformCurvePreview } from '@barocss/gpu';
import type { SelectedUniformCurvePreview } from '@barocss/gpu';
import { CadEditorError } from '../types.js';

export interface FocusedCurveBinding {
  reference: CadGeometryReferenceV0;
  bodyName: string;
  sourceModelName: string;
  curveId: string;
  preview: SelectedUniformCurvePreview;
}
function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left), other = Object.keys(right);
  return keys.length === other.length && keys.every(key => Object.hasOwn(right, key)
    && equal((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
}
/** Bind real complete-source observations to an actual qualified canonical Curve. */
export function prepareFocusedCurve(result: CadDocumentResult, bodyId: string, count: number): FocusedCurveBinding {
  const resolved = createCadGeometryReference(result, { bodyId });
  if (resolved.geometry.kind !== 'curve') throw new CadEditorError('UNSUPPORTED', 'Focus requires an original Curve.', { field: 'curve-focus', bodyId });
  const body = result.document.bodies.find(value => value.id === bodyId)!;
  const asset = result.document.assets.find(value => value.id === body.assetId)!;
  const compiled = result.compiledAssets.find(value => value.assetId === body.assetId)!;
  const preview = prepareSelectedUniformCurvePreview({ source: resolved.source, curveId: resolved.geometry.id, count });
  const original = preview.model.objects.find(value => value.id === preview.curveId);
  if (resolved.source !== asset.source || preview.source !== asset.source || compiled.model.name !== preview.model.name
    || !equal(resolved.geometry, original) || !equal(compiled.model, preview.model)) {
    throw new CadEditorError('DISPLAY', 'The focused preview does not match its qualified original source.', { field: 'curve-focus', bodyId });
  }
  return { reference: resolved.reference, bodyName: body.name, sourceModelName: preview.model.name, curveId: preview.curveId, preview };
}
