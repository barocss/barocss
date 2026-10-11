import { buildTranslationalSweepSurface, validateTranslationalSweepSurface } from '@barocss/cad';
import type { CadDocumentV1, CadGeometryReferenceV0, Curve } from '@barocss/cad';
import type { CadEditorTranslationalSweepCreation } from './types.js';

function unusedId(stem: string, reserved: Set<string>): string {
  for (let index = 0; index <= reserved.size; index++) {
    const id = `${stem}_${index}`;
    if (id.length <= 48 && !reserved.has(id)) { reserved.add(id); return id; }
  }
  throw new RangeError('A new translational Surface construction ID is unavailable.');
}

/** The complete native three-object Source is an independent asset, never a parent replacement. */
export function appendTranslationalSweepSource(document: CadDocumentV1, profile: Curve, rail: Curve,
  profileReference: CadGeometryReferenceV0, railReference: CadGeometryReferenceV0,
  reservedNames: readonly string[]): { document: CadDocumentV1; creation: CadEditorTranslationalSweepCreation; nativeNames: string[] } {
  const reserved = new Set(reservedNames);
  const surfaceId = unusedId('editor_swept_surface', reserved);
  const assetId = unusedId('editor_sweep_asset', reserved);
  const bodyId = unusedId('editor_sweep_body', reserved);
  const result = buildTranslationalSweepSurface(profile, rail, { surfaceId, maximumObservations: 961 });
  validateTranslationalSweepSurface(result);
  return {
    document: {
      ...document,
      assets: [...document.assets, { id: assetId, revision: 0, role: 'authored-native-source', sourceVersion: result.sourceVersion,
        sourceFrame: document.nativeFrame, source: result.source }],
      bodies: [...document.bodies, { id: bodyId, name: 'Swept Surface', kind: 'direct-geometry-object',
        assetId, geometryId: result.surface.id }],
    },
    creation: { profileReference, railReference, assetId, bodyId, result },
    nativeNames: [...new Set([surfaceId, assetId, bodyId, result.model.name, ...result.model.objects.map(geometry => geometry.id)])],
  };
}
