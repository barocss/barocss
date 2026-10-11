import { splitCurveAtParameter } from '@barocss/cad';
import type { CadDocumentV1, CadGeometryReferenceV0, Curve } from '@barocss/cad';
import type { CadEditorCurveSplitCreation } from './types.js';

function unusedId(stem: string, reserved: Set<string>): string {
  for (let index = 0; index <= reserved.size; index++) {
    const id = `${stem}_${index}`;
    if (id.length <= 48 && !reserved.has(id)) { reserved.add(id); return id; }
  }
  throw new RangeError('A new Curve split construction ID is unavailable.');
}

/** Both generated Curves share one new complete Source asset. Original assets stay unchanged. */
export function appendSplitCurveSource(document: CadDocumentV1, original: Curve,
  sourceReference: CadGeometryReferenceV0, parameter: number,
  reservedNames: readonly string[]): { document: CadDocumentV1; creation: CadEditorCurveSplitCreation; nativeNames: string[] } {
  const reserved = new Set(reservedNames);
  const lowerCurveId = unusedId('editor_split_lower_curve', reserved);
  const upperCurveId = unusedId('editor_split_upper_curve', reserved);
  const assetId = unusedId('editor_split_asset', reserved);
  const lowerBodyId = unusedId('editor_split_lower_body', reserved);
  const upperBodyId = unusedId('editor_split_upper_body', reserved);
  // The public constructor owns split/source validation. There is no exported
  // whole split-result validator. Its model name is the original Curve ID, and
  // legitimately shares that asset-qualified native name with the original.
  const result = splitCurveAtParameter(original, { parameter, lowerCurveId, upperCurveId });
  const nativeNames = [...new Set([result.model.name, result.original.id, result.refined.id,
    result.lower.id, result.upper.id, ...result.model.objects.map(geometry => geometry.id)])];
  return {
    document: {
      ...document,
      assets: [...document.assets, { id: assetId, revision: 0, role: 'authored-native-source', sourceVersion: 0,
        sourceFrame: document.nativeFrame, source: result.source }],
      bodies: [...document.bodies,
        { id: lowerBodyId, name: 'Lower Curve', kind: 'direct-geometry-object', assetId, geometryId: result.lower.id },
        { id: upperBodyId, name: 'Upper Curve', kind: 'direct-geometry-object', assetId, geometryId: result.upper.id }],
    },
    creation: { sourceReference, assetId, lowerBodyId, upperBodyId, result }, nativeNames,
  };
}
