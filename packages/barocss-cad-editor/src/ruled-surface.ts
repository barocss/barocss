import {
  buildAlignedRationalRuledSurface, validateAlignedRationalRuledSurface,
  SectionKnotAlignmentError, SectionKnotAlignmentDiagnosticCode,
} from '@barocss/cad';
import type { CadDocumentV1, CadGeometryReferenceV0, Curve, Model, SectionKnotAlignmentResult } from '@barocss/cad';
import type { CadEditorRuledSurfaceCreation } from './types.js';

function unusedId(stem: string, reserved: Set<string>): string {
  for (let index = 0; index <= reserved.size; index++) {
    const id = `${stem}_${index}`;
    if (id.length <= 48 && !reserved.has(id)) { reserved.add(id); return id; }
  }
  throw new RangeError('A new ruled Surface construction ID is unavailable.');
}

const ID_MODE_MESSAGE = 'Section knot alignment: Changed sections need distinct explicit output IDs; untouched sections must retain their original IDs';

/** Native alone chooses which sections need refinement; only its exact ID-mode preflight can retry. */
export function appendRuledSurfaceSource(document: CadDocumentV1, first: Curve, second: Curve,
  firstReference: CadGeometryReferenceV0, secondReference: CadGeometryReferenceV0,
  reservedNames: readonly string[]): { document: CadDocumentV1; creation: CadEditorRuledSurfaceCreation; nativeNames: string[] } {
  const reserved = new Set(reservedNames);
  const surfaceId = unusedId('editor_ruled_surface', reserved);
  const assetId = unusedId('editor_ruled_asset', reserved);
  const bodyId = unusedId('editor_ruled_body', reserved);
  const firstFreshId = unusedId('editor_ruled_first', reserved);
  const secondFreshId = unusedId('editor_ruled_second', reserved);
  let resultIdPrefix: string | undefined;
  let roles: string[] = [];
  for (let index = 0; index <= reserved.size; index++) {
    const prefix = `er_${index}`;
    if (prefix.length > 8) continue;
    const family = [prefix, `${prefix}_original`, `${prefix}_a`, `${prefix}_b`,
      ...['a', 'b'].flatMap(section => Array.from({ length: 16 }, (_, step) => `${prefix}_${section}_step_${step}`))];
    if (!family.some(id => reserved.has(id))) { resultIdPrefix = prefix; roles = family; break; }
  }
  if (resultIdPrefix === undefined) throw new RangeError('A native ruled Surface refinement prefix is unavailable.');
  let result: SectionKnotAlignmentResult | undefined;
  const modes = [[first.id, second.id], [firstFreshId, second.id],
    [first.id, secondFreshId], [firstFreshId, secondFreshId]] as const;
  for (const [index, [firstAlignedId, secondAlignedId]] of modes.entries()) {
    try {
      result = buildAlignedRationalRuledSurface(first, second, { surfaceId, firstAlignedId, secondAlignedId,
        resultIdPrefix, maximumInsertedKnots: 14, maximumRefinementOperations: 14 });
      break;
    } catch (cause) {
      if (!(cause instanceof SectionKnotAlignmentError)
        || cause.code !== SectionKnotAlignmentDiagnosticCode.IDENTITY || cause.message !== ID_MODE_MESSAGE
        || cause.cause !== undefined || index === modes.length - 1) throw cause;
    }
  }
  if (result === undefined) throw new RangeError('Native ruled Surface construction did not return a result.');
  validateAlignedRationalRuledSurface(result);
  const modelNames = (model: Model) => [model.name, ...model.objects.map(geometry => geometry.id)];
  // Untouched original IDs and the fixed native comparison context can legitimately
  // recur in separately qualified assets/proofs. Never rewrite those native IDs.
  const nativeNames = [...new Set([surfaceId, assetId, bodyId, firstFreshId, secondFreshId, ...roles,
    ...modelNames(result.originalModel), ...modelNames(result.ruled.model),
    ...result.sections.flatMap(section => section.refinement === null ? [] : [
      ...modelNames(section.refinement.originalModel), ...modelNames(section.refinement.model),
      ...section.refinement.provenance.operations.flatMap(operation => modelNames(operation.model)),
    ])])];
  return {
    document: {
      ...document,
      assets: [...document.assets, { id: assetId, revision: 0, role: 'authored-native-source', sourceVersion: 0,
        sourceFrame: document.nativeFrame, source: result.ruled.source }],
      bodies: [...document.bodies, { id: bodyId, name: 'Ruled Surface', kind: 'direct-geometry-object',
        assetId, geometryId: result.ruled.surface.id }],
    },
    creation: { firstReference, secondReference, assetId, bodyId, result }, nativeNames,
  };
}
