import { CadAssemblyError, CadAssemblyDiagnosticCode, snapshotCadAssemblyData, sameCadAssemblyData, rebuildCadAssemblyResult, evaluateCadAssembly } from './cad-assembly.js';
import type { CadAssemblyResult, CadAssemblyV0 } from './cad-assembly.js';
import { createCadDocument, CadDocumentError } from './cad-document.js';
import type { CadDocumentV1, CadDocumentResult } from './cad-document.js';
import { createCadGeometryReference, resolveCadGeometryReference, CadReferenceError } from './cad-document-reference.js';
import type { CadGeometryReferenceV0 } from './cad-document-reference.js';

export interface CadAssemblyPartReplacement {
  expectedRevision: number; revision: number; documentId: string; expectedDocumentRevision: number; replacementDocument: CadDocumentV1;
  referenceRepairs: { instanceId: string; previousReference: CadGeometryReferenceV0; reference: CadGeometryReferenceV0 }[];
}
export interface CadAssemblyPartReplacementReport {
  schema: 'barocss-cad-assembly-part-replacement'; version: 0; assemblyId: string; documentId: string;
  previousAssemblyRevision: number; assemblyRevision: number; previousDocumentRevision: number; documentRevision: number; partIndex: number;
  changedAssetIds: string[]; changedAssetCount: number;
  assetProvenance: { assetId: string; sourceChanged: boolean; previousRevision: number; revision: number;
    previousSource: string; source: string; nativeModelChanged: boolean }[];
  repairedInstanceIds: string[]; repairInputInstanceIds: string[]; referenceProvenance: { instanceId: string;
    previousReference: CadGeometryReferenceV0; reference: CadGeometryReferenceV0; nativeGeometryChanged: boolean }[];
  unaffectedInstanceIds: string[]; unchangedPartIds: string[]; instanceCount: number; repairCount: number;
  callCounts: { priorAssemblyRebuild: 1; replacementDocumentCreation: 1; referenceCreation: number;
    previousReferenceResolution: number; replacementReferenceResolution: number; candidateAssemblyEvaluation: 1 };
  preservation: { assemblyIdentityAndFrameBits: true; partsOrder: true; unaffectedPartsBits: true; bodyRecordsAndBindingsBits: true;
    unchangedAssetsBitsAndRevisions: true; instanceIdsAndOrderBits: true; parentAndHierarchyBits: true; localPlacementBits: true;
    localAndWorldMatrixBits: true; unaffectedReferenceBits: true; sharedGroupMembership: true };
  numericPolicy: { revision: 'assembly-and-document-exactly-previous-plus-one'; assetRevision: 'changed-text-plus-one-unchanged-text-entire-bits-retained';
    editMeaning: 'source-text-change-including-whitespace-not-proof-native-geometry-changed';
    references: 'explicit-complete-target-document-repairs-including-unchanged-assets';
    geometryIdentity: 'same-document-body-asset-geometry-kind-source-frame-and-unit-no-retarget';
    order: 'authored-part-instance-and-asset-order-preserved-input-repair-order-separately-retained';
    workCounts: 'direct-orchestration-calls-not-total-internal-recompilation' };
  lengthUnit: 'mm'; rotationUnit: 'deg'; frame: 'assembly-space-xyz'; sourceFrame: 'authored-xyz-no-axis-conversion';
  quality: { sourceAuthority: 'actual-canonical-document-v1-source0'; changedGeometryRebindClaimed: false; sourceHashCertified: false;
    hiddenHistoryOrRefresh: false; topologyCertified: false; solid: false; rendererCertified: false; globalBinary64ErrorCertified: false;
    ownership: 'independent-copied-cpu-data-gc' };
  budgetFailure: 'atomic-prior-assembly-input-results-and-files-retained';
  limits: { maximumParts: 4; maximumInstances: 32; maximumReferenceRepairs: 32; maximumHierarchyDepth: 16; maximumRevision: 2147483647;
    maximumAssetsPerDocument: 4; maximumBodiesPerDocument: 16; ownValues: 1048576; ownDepth: 40; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface CadAssemblyPartReplacementResult {
  previous: CadAssemblyResult; transaction: CadAssemblyPartReplacement; result: CadAssemblyResult; report: CadAssemblyPartReplacementReport;
}

const CODE = CadAssemblyDiagnosticCode, MAX_REVISION = 2147483647;
function check(condition: boolean, code: typeof CODE[keyof typeof CODE], detail: string): asserts condition {
  if (!condition) throw new CadAssemblyError(code, detail);
}
function record(value: unknown, fields: string[], code: typeof CODE[keyof typeof CODE] = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'Part replacement requires an own record');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact part-replacement fields are required'); return data;
}
function id(value: unknown): string {
  check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII replacement ID1..48 required'); return value;
}
function revision(value: unknown): number {
  check(typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_REVISION && !Object.is(value, -0),
    CODE.REVISION, 'Unsigned revision0..2147483647 required; signed zero refused'); return value;
}
function native<T>(action: () => T, detail: string): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CadAssemblyError) throw cause;
    let code: typeof CODE[keyof typeof CODE] = CODE.NATIVE;
    if (cause instanceof CadReferenceError) code = cause.code === 'STALE' ? CODE.STALE : cause.code === 'INPUT' ? CODE.INPUT : CODE.REFERENCE;
    else if (cause instanceof CadDocumentError) {
      if (cause.code === 'JSON' || cause.code === 'BUDGET' || cause.code === 'VERSION' || cause.code === 'IDENTITY'
        || cause.code === 'REFERENCE' || cause.code === 'INPUT' || cause.code === 'OWNED') code = cause.code;
      else code = cause.code === 'SOURCE' ? CODE.NATIVE : CODE.INPUT;
    }
    throw new CadAssemblyError(code, detail, cause);
  }
}
function referenceIdentity(reference: CadGeometryReferenceV0): Omit<CadGeometryReferenceV0, 'documentRevision' | 'assetRevision'> {
  return { ...Object.fromEntries(Object.entries(reference).filter(([key]) => key !== 'documentRevision' && key !== 'assetRevision')) } as Omit<CadGeometryReferenceV0, 'documentRevision' | 'assetRevision'>;
}
function bodyGeometry(document: CadDocumentResult, bodyId: string) {
  const body = document.document.bodies.find(value => value.id === bodyId);
  const asset = document.compiledAssets.find(value => value.assetId === body?.assetId);
  const geometry = asset?.model.objects.find(value => value.id === body?.geometryId);
  check(geometry !== undefined, CODE.REFERENCE, 'Actual compiled body geometry is required for replacement provenance'); return geometry;
}

/** Replace one source-edited canonical part and every explicit pinned reference without changing assembly poses. */
export function replaceCadAssemblyPart(previousInput: CadAssemblyResult, transactionInput: CadAssemblyPartReplacement): CadAssemblyPartReplacementResult {
  const previous = rebuildCadAssemblyResult(previousInput);
  const data = record(snapshotCadAssemblyData(transactionInput), ['expectedRevision', 'revision', 'documentId', 'expectedDocumentRevision', 'replacementDocument', 'referenceRepairs']);
  const expectedRevision = revision(data.expectedRevision), nextRevision = revision(data.revision), documentId = id(data.documentId), expectedDocumentRevision = revision(data.expectedDocumentRevision);
  check(expectedRevision === previous.assembly.revision, CODE.STALE, 'Expected assembly revision is stale');
  check(previous.assembly.revision < MAX_REVISION && nextRevision === previous.assembly.revision + 1, CODE.REVISION, 'Replacement assembly revision must be exactly previous+1');
  const partIndex = previous.assembly.parts.findIndex(part => part.documentId === documentId);
  check(partIndex >= 0, CODE.REFERENCE, 'Replacement document must identify one current embedded part');
  const oldDocument = previous.documents.find(document => document.document.documentId === documentId);
  check(oldDocument !== undefined, CODE.REFERENCE, 'Actual prior embedded source document is required');
  check(expectedDocumentRevision === oldDocument.document.revision, CODE.STALE, 'Expected embedded document revision is stale');
  check(oldDocument.document.revision < MAX_REVISION, CODE.REVISION, 'Embedded document revision cannot advance beyond its limit');
  const replacement = native(() => createCadDocument(data.replacementDocument as CadDocumentV1), 'Actual source-edited replacement document creation failed');
  check(sameCadAssemblyData(data.replacementDocument, replacement.document), CODE.REFERENCE, 'Replacement must retain the complete actual canonical document fields');
  check(replacement.document.documentId === documentId, CODE.REFERENCE, 'Part replacement must preserve document identity');
  check(replacement.document.revision === oldDocument.document.revision + 1, CODE.REVISION, 'Replacement document revision must be exactly previous+1');
  for (const field of ['schema', 'version', 'profile', 'documentId', 'units', 'nativeFrame', 'bodies', 'features', 'parameters', 'constraints', 'placements', 'derivedCaches'] as const)
    check(sameCadAssemblyData(replacement.document[field], oldDocument.document[field]), CODE.REFERENCE, 'Replacement must preserve document structure, body records, frame and units');
  check(replacement.document.assets.length === oldDocument.document.assets.length, CODE.REFERENCE, 'Replacement cannot add or remove native source assets');
  check(sameCadAssemblyData(replacement.bodyBindings, oldDocument.bodyBindings), CODE.REFERENCE, 'Replacement cannot retarget qualified body IDs or geometry kinds');
  const changedAssetIds: string[] = [];
  const assetProvenance: CadAssemblyPartReplacementReport['assetProvenance'] = replacement.document.assets.map((asset, index) => {
    const old = oldDocument.document.assets[index];
    for (const field of ['id', 'role', 'sourceVersion', 'sourceFrame'] as const)
      check(sameCadAssemblyData(asset[field], old[field]), CODE.REFERENCE, 'Asset IDs, order, role, version and frame must remain unchanged');
    const sourceChanged = asset.source !== old.source;
    if (sourceChanged) {
      check(old.revision < MAX_REVISION && asset.revision === old.revision + 1, CODE.REVISION, 'Every text-changed asset revision must be exactly previous+1'); changedAssetIds.push(asset.id);
    } else check(sameCadAssemblyData(asset, old), CODE.REVISION, 'Every unchanged source asset must retain its entire bits and revision');
    const oldModel = oldDocument.compiledAssets.find(value => value.assetId === old.id)?.model, model = replacement.compiledAssets.find(value => value.assetId === asset.id)?.model;
    return { assetId: asset.id, sourceChanged, previousRevision: old.revision, revision: asset.revision,
      previousSource: old.source, source: asset.source, nativeModelChanged: !sameCadAssemblyData(oldModel, model) };
  });
  check(changedAssetIds.length > 0, CODE.INPUT, 'At least one actual source-text edit is required; revision-only no-op replacement is refused');
  check(Array.isArray(data.referenceRepairs) && data.referenceRepairs.length <= 32, CODE.BUDGET, 'Explicit reference repairs must contain0..32 entries');
  const affected = previous.assembly.instances.filter(instance => instance.reference.documentId === documentId);
  const affectedById = new Map(affected.map(instance => [instance.id, instance])), repaired = new Set<string>();
  const referenceRepairs: CadAssemblyPartReplacement['referenceRepairs'] = data.referenceRepairs.map(value => {
    const repair = record(value, ['instanceId', 'previousReference', 'reference']), instanceId = id(repair.instanceId);
    check(affectedById.has(instanceId), CODE.REFERENCE, 'A repair cannot target an unknown or unaffected instance');
    check(!repaired.has(instanceId), CODE.IDENTITY, 'Every affected instance must have exactly one explicit repair'); repaired.add(instanceId);
    return { instanceId, previousReference: repair.previousReference as CadGeometryReferenceV0, reference: repair.reference as CadGeometryReferenceV0 };
  });
  check(repaired.size === affected.length && affected.every(instance => repaired.has(instance.id)), CODE.REFERENCE, 'Complete repairs are required for all target-document instances, including unchanged assets');
  const transaction: CadAssemblyPartReplacement = { expectedRevision, revision: nextRevision, documentId, expectedDocumentRevision,
    replacementDocument: replacement.document, referenceRepairs };
  let referenceCreation = 0, previousReferenceResolution = 0, replacementReferenceResolution = 0;
  const expectedReferences = new Map<string, CadGeometryReferenceV0>();
  for (const instance of affected) if (!expectedReferences.has(instance.reference.bodyId)) {
    const captured = native(() => createCadGeometryReference(replacement, { bodyId: instance.reference.bodyId }), 'Actual replacement reference creation failed'); referenceCreation++;
    expectedReferences.set(instance.reference.bodyId, captured.reference);
  }
  const referenceByInstance = new Map<string, CadGeometryReferenceV0>();
  for (const repair of referenceRepairs) {
    const instance = affectedById.get(repair.instanceId)!;
    const oldResolved = native(() => resolveCadGeometryReference(oldDocument, repair.previousReference), 'Actual prior reference resolution failed for instance ' + repair.instanceId); previousReferenceResolution++;
    check(sameCadAssemblyData(repair.previousReference, instance.reference) && sameCadAssemblyData(oldResolved.reference, instance.reference), CODE.REFERENCE, 'Explicit previous reference differs from accepted original instance');
    const resolved = native(() => resolveCadGeometryReference(replacement, repair.reference), 'Actual replacement reference resolution failed for instance ' + repair.instanceId); replacementReferenceResolution++;
    check(sameCadAssemblyData(referenceIdentity(instance.reference), referenceIdentity(resolved.reference))
      && sameCadAssemblyData(resolved.reference, expectedReferences.get(instance.reference.bodyId)), CODE.REFERENCE, 'Replacement reference must preserve the complete qualified geometry identity; only revisions may change');
    check(sameCadAssemblyData(repair.reference, resolved.reference), CODE.REFERENCE, 'Explicit fresh reference must equal the complete actual current binding');
    referenceByInstance.set(repair.instanceId, resolved.reference);
  }
  const candidate = snapshotCadAssemblyData(previous.assembly) as CadAssemblyV0;
  candidate.parts[partIndex] = replacement.document; candidate.revision = nextRevision;
  for (const instance of candidate.instances) if (referenceByInstance.has(instance.id)) instance.reference = referenceByInstance.get(instance.id)!;
  const result = evaluateCadAssembly(candidate);
  check(result.assembly.assemblyId === previous.assembly.assemblyId
    && sameCadAssemblyData([result.assembly.schema, result.assembly.version, result.assembly.lengthUnit, result.assembly.rotationUnit, result.assembly.frame],
      [previous.assembly.schema, previous.assembly.version, previous.assembly.lengthUnit, previous.assembly.rotationUnit, previous.assembly.frame]), CODE.OWNED, 'Assembly identity and frame bits changed during replacement');
  check(sameCadAssemblyData(result.assembly.parts.map(part => part.documentId), previous.assembly.parts.map(part => part.documentId)), CODE.OWNED, 'Part identity and authored order changed');
  for (const [index, part] of result.assembly.parts.entries()) if (index !== partIndex)
    check(sameCadAssemblyData(part, previous.assembly.parts[index]), CODE.OWNED, 'An unaffected embedded part changed');
  check(sameCadAssemblyData(result.assembly.parts[partIndex], replacement.document), CODE.OWNED, 'Actual final embedded part differs from admitted replacement');
  check(sameCadAssemblyData(result.assembly.instances.map(instance => instance.id), previous.assembly.instances.map(instance => instance.id)), CODE.OWNED, 'Instance identities or authored order changed');
  for (const [index, instance] of result.assembly.instances.entries()) {
    const before = previous.assembly.instances[index], derived = result.instances[index], oldDerived = previous.instances[index];
    check(sameCadAssemblyData(instance.parentId, before.parentId) && sameCadAssemblyData(instance.placement, before.placement)
      && sameCadAssemblyData([derived.ancestors, derived.depth, derived.localMatrix, derived.worldMatrix], [oldDerived.ancestors, oldDerived.depth, oldDerived.localMatrix, oldDerived.worldMatrix]),
    CODE.OWNED, 'Replacement changed hierarchy, local placement, or evaluated matrix bits');
    check(sameCadAssemblyData(instance.reference, referenceByInstance.get(instance.id) ?? before.reference), CODE.OWNED, 'Final fresh or unaffected reference bits changed');
  }
  check(sameCadAssemblyData(result.report.sharedPartGroups.map(group => group.instanceIds), previous.report.sharedPartGroups.map(group => group.instanceIds)),
    CODE.OWNED, 'Replacement changed shared qualified-reference group membership or order');
  const repairedInstanceIds = affected.map(instance => instance.id);
  const referenceProvenance = affected.map(instance => ({ instanceId: instance.id, previousReference: instance.reference,
    reference: referenceByInstance.get(instance.id)!, nativeGeometryChanged: !sameCadAssemblyData(bodyGeometry(oldDocument, instance.reference.bodyId), bodyGeometry(replacement, instance.reference.bodyId)) }));
  const report: CadAssemblyPartReplacementReport = { schema: 'barocss-cad-assembly-part-replacement', version: 0,
    assemblyId: previous.assembly.assemblyId, documentId, previousAssemblyRevision: previous.assembly.revision, assemblyRevision: result.assembly.revision,
    previousDocumentRevision: oldDocument.document.revision, documentRevision: replacement.document.revision, partIndex,
    changedAssetIds, changedAssetCount: changedAssetIds.length, assetProvenance, repairedInstanceIds, repairInputInstanceIds: referenceRepairs.map(repair => repair.instanceId),
    referenceProvenance, unaffectedInstanceIds: previous.assembly.instances.filter(instance => !repaired.has(instance.id)).map(instance => instance.id),
    unchangedPartIds: previous.assembly.parts.filter((_, index) => index !== partIndex).map(part => part.documentId), instanceCount: result.assembly.instances.length, repairCount: repairedInstanceIds.length,
    callCounts: { priorAssemblyRebuild: 1, replacementDocumentCreation: 1, referenceCreation, previousReferenceResolution, replacementReferenceResolution, candidateAssemblyEvaluation: 1 },
    preservation: { assemblyIdentityAndFrameBits: true, partsOrder: true, unaffectedPartsBits: true, bodyRecordsAndBindingsBits: true,
      unchangedAssetsBitsAndRevisions: true, instanceIdsAndOrderBits: true, parentAndHierarchyBits: true, localPlacementBits: true,
      localAndWorldMatrixBits: true, unaffectedReferenceBits: true, sharedGroupMembership: true },
    numericPolicy: { revision: 'assembly-and-document-exactly-previous-plus-one', assetRevision: 'changed-text-plus-one-unchanged-text-entire-bits-retained',
      editMeaning: 'source-text-change-including-whitespace-not-proof-native-geometry-changed', references: 'explicit-complete-target-document-repairs-including-unchanged-assets',
      geometryIdentity: 'same-document-body-asset-geometry-kind-source-frame-and-unit-no-retarget',
      order: 'authored-part-instance-and-asset-order-preserved-input-repair-order-separately-retained', workCounts: 'direct-orchestration-calls-not-total-internal-recompilation' },
    lengthUnit: 'mm', rotationUnit: 'deg', frame: 'assembly-space-xyz', sourceFrame: 'authored-xyz-no-axis-conversion',
    quality: { sourceAuthority: 'actual-canonical-document-v1-source0', changedGeometryRebindClaimed: false, sourceHashCertified: false,
      hiddenHistoryOrRefresh: false, topologyCertified: false, solid: false, rendererCertified: false, globalBinary64ErrorCertified: false, ownership: 'independent-copied-cpu-data-gc' },
    budgetFailure: 'atomic-prior-assembly-input-results-and-files-retained',
    limits: { maximumParts: 4, maximumInstances: 32, maximumReferenceRepairs: 32, maximumHierarchyDepth: 16, maximumRevision: MAX_REVISION,
      maximumAssetsPerDocument: 4, maximumBodiesPerDocument: 16, ownValues: 1048576, ownDepth: 40, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 } };
  return snapshotCadAssemblyData({ previous, transaction, result, report }, 'owned') as CadAssemblyPartReplacementResult;
}

/** Rebuild from the retained complete accepted prior assembly and explicit source/reference transaction. */
export function validateCadAssemblyPartReplacement(input: CadAssemblyPartReplacementResult): CadAssemblyPartReplacementReport {
  const owned = record(snapshotCadAssemblyData(input, 'owned'), ['previous', 'transaction', 'result', 'report'], CODE.OWNED) as unknown as CadAssemblyPartReplacementResult;
  let expected: CadAssemblyPartReplacementResult;
  try { expected = replaceCadAssemblyPart(owned.previous, owned.transaction); } catch (cause) {
    throw new CadAssemblyError(CODE.OWNED, 'Owned complete part replacement rebuild refused', cause);
  }
  check(sameCadAssemblyData(owned, expected), CODE.OWNED, 'Owned prior/source/revision/reference/order/matrix/provenance/counter bits changed');
  return snapshotCadAssemblyData(expected.report, 'owned') as CadAssemblyPartReplacementReport;
}
