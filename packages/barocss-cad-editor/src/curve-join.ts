import { joinCurves, validateJoinedCurveResult } from '@barocss/cad';
import type { CadDocumentV1, CadGeometryReferenceV0, Curve } from '@barocss/cad';
import type { CadEditorCurveJoinCreation } from './types.js';

function unusedId(stem: string, reserved: Set<string>): string {
  for (let index = 0; index <= reserved.size; index++) {
    const suffix = index === 0 ? '_join' : `_join_${index}`;
    const id = stem.slice(0, 48 - suffix.length) + suffix;
    if (!reserved.has(id)) { reserved.add(id); return id; }
  }
  throw new RangeError('A new Curve join construction ID is unavailable.');
}

/** Native parentSources are single-object proofs. Only the joined Source enters a new asset. */
export function appendJoinedCurveSource(document: CadDocumentV1, left: Curve, right: Curve,
  leftReference: CadGeometryReferenceV0, rightReference: CadGeometryReferenceV0,
  reservedNames: readonly string[]): { document: CadDocumentV1; creation: CadEditorCurveJoinCreation } {
  const reserved = new Set(reservedNames);
  const curveId = unusedId(left.id, reserved);
  const assetId = unusedId(leftReference.assetId, reserved);
  const bodyId = unusedId(leftReference.bodyId, reserved);
  const result = joinCurves(left, right, { curveId });
  validateJoinedCurveResult(result);
  return {
    document: {
      ...document,
      assets: [...document.assets, { id: assetId, revision: 0, role: 'authored-native-source', sourceVersion: 0,
        sourceFrame: document.nativeFrame, source: result.source }],
      bodies: [...document.bodies, { id: bodyId, name: 'Joined Curve', kind: 'direct-geometry-object',
        assetId, geometryId: result.curve.id }],
    },
    creation: { leftReference, rightReference, assetId, bodyId, result },
  };
}
