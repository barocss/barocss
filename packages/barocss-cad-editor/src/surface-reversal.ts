import { reverseSurfaceAxis, validateReversedSurfaceAxis } from '@barocss/cad';
import type { CadDocumentV1, CadGeometryReferenceV0, Surface } from '@barocss/cad';
import type { CadEditorSurfaceReversalCreation } from './types.js';

function unusedId(stem: string, reserved: Set<string>): string {
  for (let index = 0; index <= reserved.size; index++) {
    const id = `${stem}_${index}`;
    if (id.length <= 48 && !reserved.has(id)) { reserved.add(id); return id; }
  }
  throw new RangeError('A new reversed Surface construction ID is unavailable.');
}

/** Only the reversed singleton Source enters a new asset; comparison and strip Sources stay proofs. */
export function appendReversedSurfaceSource(document: CadDocumentV1, original: Surface,
  sourceReference: CadGeometryReferenceV0, axis: 'u' | 'v',
  reservedNames: readonly string[]): { document: CadDocumentV1; creation: CadEditorSurfaceReversalCreation; nativeNames: string[] } {
  const reserved = new Set(reservedNames);
  const surfaceId = unusedId('editor_reversed_surface', reserved);
  const assetId = unusedId('editor_surface_reversal_asset', reserved);
  const bodyId = unusedId('editor_surface_reversal_body', reserved);
  let resultIdPrefix: string | undefined;
  let stripRoles: string[] = [];
  // The public native operation requires all 32 strip roles to be distinct,
  // including unused roles. Reserve their whole family while history is retained.
  for (let index = 0; index <= reserved.size; index++) {
    const prefix = `editor_sr_${index}`;
    if (prefix.length > 20) continue;
    const roles = Array.from({ length: 16 }, (_, strip) => [`${prefix}_s${strip}_src`, `${prefix}_s${strip}_rev`]).flat();
    if (![prefix, ...roles].some(id => reserved.has(id))) { resultIdPrefix = prefix; stripRoles = roles; break; }
  }
  if (resultIdPrefix === undefined) throw new RangeError('A native Surface reversal strip prefix is unavailable.');
  const result = reverseSurfaceAxis(original, { surfaceId, axis, resultIdPrefix });
  validateReversedSurfaceAxis(result);
  const nativeNames = [...new Set([resultIdPrefix, ...stripRoles, result.model.name,
    ...result.model.objects.map(geometry => geometry.id), result.originalModel.name,
    ...result.provenance.strips.flatMap(strip => [strip.result.model.name, strip.result.originalModel.name,
      ...strip.result.model.objects.map(geometry => geometry.id), ...strip.result.originalModel.objects.map(geometry => geometry.id)])])];
  return {
    document: {
      ...document,
      assets: [...document.assets, { id: assetId, revision: 0, role: 'authored-native-source', sourceVersion: 0,
        sourceFrame: document.nativeFrame, source: result.source }],
      bodies: [...document.bodies, { id: bodyId, name: `${axis.toUpperCase()} reversed Surface`, kind: 'direct-geometry-object',
        assetId, geometryId: result.surface.id }],
    },
    creation: { sourceReference, axis, assetId, bodyId, result }, nativeNames,
  };
}
