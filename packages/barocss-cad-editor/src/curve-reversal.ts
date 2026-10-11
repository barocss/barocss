import { reverseCurveWide, validateWideReversedCurveResult } from '@barocss/cad';
import type { CadDocumentV1, CadGeometryReferenceV0, Curve } from '@barocss/cad';
import type { CadEditorCurveReversalCreation } from './types.js';

function unusedId(stem: string, reserved: Set<string>): string {
  for (let index = 0; index <= reserved.size; index++) {
    const id = `${stem}_${index}`;
    if (id.length <= 48 && !reserved.has(id)) { reserved.add(id); return id; }
  }
  throw new RangeError('A new reversed Curve construction ID is unavailable.');
}

/** The generated reversed Source belongs only to a new asset; originalSource is a comparison proof. */
export function appendReversedCurveSource(document: CadDocumentV1, original: Curve,
  sourceReference: CadGeometryReferenceV0,
  reservedNames: readonly string[]): { document: CadDocumentV1; creation: CadEditorCurveReversalCreation; nativeNames: string[] } {
  const reserved = new Set(reservedNames);
  const curveId = unusedId('editor_reversed_curve', reserved);
  const assetId = unusedId('editor_reversed_asset', reserved);
  const bodyId = unusedId('editor_reversed_body', reserved);
  const result = reverseCurveWide(original, { curveId });
  validateWideReversedCurveResult(result);
  // Native model naming is qualified by the new asset; do not rename a genuine
  // native Model or impose separate uniqueness on its existing geometry name.
  const nativeNames = [...new Set([result.model.name, ...result.model.objects.map(geometry => geometry.id)])];
  return {
    document: {
      ...document,
      assets: [...document.assets, { id: assetId, revision: 0, role: 'authored-native-source', sourceVersion: 0,
        sourceFrame: document.nativeFrame, source: result.source }],
      bodies: [...document.bodies, { id: bodyId, name: 'Reversed Curve', kind: 'direct-geometry-object',
        assetId, geometryId: result.curve.id }],
    },
    creation: { sourceReference, assetId, bodyId, result }, nativeNames,
  };
}
