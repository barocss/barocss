import { extractSurfaceIsoCurve } from '@barocss/cad';
import type { CadDocumentV1, CadGeometryReferenceV0, Surface } from '@barocss/cad';
import type { CadEditorSurfaceIsoCurveAxis, CadEditorSurfaceIsoCurveCreation } from './types.js';

function unusedId(stem: string, reserved: Set<string>): string {
  for (let index = 0; index <= reserved.size; index++) {
    const suffix = index === 0 ? '_iso' : `_iso_${index}`;
    const id = stem.slice(0, 48 - suffix.length) + suffix;
    if (!reserved.has(id)) { reserved.add(id); return id; }
  }
  throw new RangeError('A new iso-Curve construction ID is unavailable.');
}

/** Generated Source0 belongs only to a new asset. The original complete assets stay unchanged. */
export function appendSurfaceIsoCurveSource(document: CadDocumentV1, original: Surface,
  sourceReference: CadGeometryReferenceV0, axis: CadEditorSurfaceIsoCurveAxis, parameter: number,
  reservedNames: readonly string[]): { document: CadDocumentV1; creation: CadEditorSurfaceIsoCurveCreation } {
  const reserved = new Set(reservedNames);
  const curveId = unusedId(original.id, reserved);
  const assetId = unusedId(sourceReference.assetId, reserved);
  const bodyId = unusedId(sourceReference.bodyId, reserved);
  const result = extractSurfaceIsoCurve(original, { fixedAxis: axis, parameter, curveId });
  return {
    document: {
      ...document,
      assets: [...document.assets, { id: assetId, revision: 0, role: 'authored-native-source', sourceVersion: 0,
        sourceFrame: document.nativeFrame, source: result.source }],
      bodies: [...document.bodies, { id: bodyId, name: `${axis.toUpperCase()} iso-Curve`, kind: 'direct-geometry-object',
        assetId, geometryId: result.curve.id }],
    },
    creation: { sourceReference, assetId, bodyId, result },
  };
}
