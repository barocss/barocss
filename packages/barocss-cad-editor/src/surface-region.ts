import { extractSurfaceRegion, validateExtractedSurfaceRegion } from '@barocss/cad';
import type { CadDocumentV1, CadGeometryReferenceV0, Surface, SurfaceRegionDomain } from '@barocss/cad';
import type { CadEditorSurfaceRegionCreation } from './types.js';

function unusedId(stem: string, reserved: Set<string>, maximum: number): string {
  for (let index = 0; index <= reserved.size; index++) {
    const id = `${stem}_${index}`;
    if (id.length <= maximum && !reserved.has(id)) { reserved.add(id); return id; }
  }
  throw new RangeError('A new Surface region construction ID is unavailable.');
}

/** Only the generated region Source enters a new asset; originalSource is a single-Surface proof. */
export function appendSurfaceRegionSource(document: CadDocumentV1, original: Surface,
  sourceReference: CadGeometryReferenceV0, intervals: SurfaceRegionDomain,
  reservedNames: readonly string[]): { document: CadDocumentV1; creation: CadEditorSurfaceRegionCreation; nativeNames: string[] } {
  const reserved = new Set(reservedNames);
  const surfaceId = unusedId('editor_region_surface', reserved, 48);
  const assetId = unusedId('editor_region_asset', reserved, 48);
  const bodyId = unusedId('editor_region_body', reserved, 48);
  let prefix: string | undefined;
  let helperIds: string[] = [];
  // These eight names are the public native options' fixed cut-ID family. Reserve
  // even unused cuts, so another construction cannot reuse this history prefix.
  for (let index = 0; index <= reserved.size; index++) {
    const candidate = `editor_region_${index}`;
    if (candidate.length > 20) continue;
    const helpers = [0, 1, 2, 3].flatMap(cut => [`${candidate}_cut_${cut}_lo`, `${candidate}_cut_${cut}_hi`]);
    if (![candidate, ...helpers].some(id => reserved.has(id))) {
      prefix = candidate; helperIds = helpers; break;
    }
  }
  if (prefix === undefined) throw new RangeError('A native Surface region cut prefix is unavailable.');
  const result = extractSurfaceRegion(original, {
    surfaceId, uInterval: intervals.u, vInterval: intervals.v, resultIdPrefix: prefix,
  });
  validateExtractedSurfaceRegion(result);
  const nativeNames = [...new Set([prefix, ...helperIds, result.model.name,
    ...result.model.objects.map(geometry => geometry.id), result.originalModel.name,
    ...result.provenance.operations.flatMap(operation => [operation.result.model.name,
      ...operation.result.model.objects.map(geometry => geometry.id), operation.result.refined.id])])];
  return {
    document: {
      ...document,
      assets: [...document.assets, { id: assetId, revision: 0, role: 'authored-native-source', sourceVersion: 0,
        sourceFrame: document.nativeFrame, source: result.source }],
      bodies: [...document.bodies, { id: bodyId, name: 'Surface region', kind: 'direct-geometry-object',
        assetId, geometryId: result.surface.id }],
    },
    creation: { sourceReference, assetId, bodyId, result }, nativeNames,
  };
}
