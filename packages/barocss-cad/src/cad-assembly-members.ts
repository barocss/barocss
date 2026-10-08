import { CadAssemblyError, CadAssemblyDiagnosticCode, snapshotCadAssemblyData, sameCadAssemblyData,
  rebuildCadAssemblyResult, evaluateCadAssembly } from './cad-assembly.js';
import type { CadAssemblyInstance, CadAssemblyResult, CadAssemblyV0 } from './cad-assembly.js';

export interface CadAssemblyMemberTransaction {
  expectedRevision: number; revision: number; addInstances: CadAssemblyInstance[]; removeInstanceIds: string[];
  reparentInstances: { instanceId: string; parentId: string | null }[];
}
export interface CadAssemblyMemberReport {
  schema: 'barocss-cad-assembly-member-transaction'; version: 0; assemblyId: string; previousRevision: number; revision: number;
  priorInstanceCount: number; finalInstanceCount: number; addedInstanceCount: number; removedInstanceCount: number;
  reparentRequestedCount: number; changedParentCount: number; survivorCount: number; operationCount: number;
  addedInstanceIds: string[]; removedInstanceIds: string[]; reparentRequestedInstanceIds: string[];
  changedParentInstanceIds: string[]; survivingInstanceIds: string[]; finalInstanceIds: string[]; noOp: boolean;
  conventions: { operationLists: 'declared-input-order'; survivorOrder: 'previous-authored-order-minus-explicit-removals';
    finalOrder: 'survivors-then-additions-in-input-order'; reparent: 'explicit-existing-survivors-only-local-placement-retained';
    removals: 'explicit-listed-members-only-no-subtree-cascade'; candidateEvaluation: 'one-complete-native-assembly-evaluation' };
  quality: { partsSourceBitsPreserved: true; survivingReferenceBitsPreserved: true; survivingPlacementBitsPreserved: true;
    survivingIdsPreserved: true; unrequestedParentBitsPreserved: true; survivorOrderPreserved: true; additionOrderPreserved: true;
    priorIdsNeverRecycled: true; completeGraphReevaluated: true; explicitNoOpAdvancesRevision: true; emptyGraphSupported: true;
    geometryAuthority: 'unchanged-embedded-canonical-document-v1-source0';
    referenceBinding: 'exact-declared-native-revisions-no-hidden-source-hash-or-history';
    derivedWorldMatricesMayChange: true; rendererCapacityCertified: false; globalBinary64ErrorCertified: false;
    manufacturingToleranceCertified: false; ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  budgetFailure: 'atomic-refusal-prior-assembly-and-files-retained';
  limits: { maximumAdditions: 32; maximumRemovals: 32; maximumReparents: 32; maximumOperationEntries: 96;
    maximumFinalInstances: 32; maximumHierarchyDepth: 16; maximumRevision: 2147483647; authoredIdCharacters: 48;
    ownValues: 1048576; ownDepth: 40; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface CadAssemblyMemberResult {
  assemblyId: string; previousRevision: number; transaction: CadAssemblyMemberTransaction; result: CadAssemblyResult; report: CadAssemblyMemberReport;
}

const CODE = CadAssemblyDiagnosticCode;
function check(condition: boolean, code: typeof CODE[keyof typeof CODE], detail: string): asserts condition {
  if (!condition) throw new CadAssemblyError(code, detail);
}
function record(value: unknown, fields: string[], code: typeof CODE[keyof typeof CODE] = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'member transaction record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code,
    'exact member transaction fields required: ' + fields.join(',')); return data;
}
function id(value: unknown): string {
  check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII member ID1..48 required'); return value;
}
function revision(value: unknown): number {
  check(typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483647 && !Object.is(value, -0),
    CODE.REVISION, 'unsigned revision0..2147483647 required; signed zero refused'); return value;
}

/** One complete revision-checked add/remove/reparent candidate, with no implicit cascade or ID reuse. */
export function transactCadAssemblyMembers(previousInput: CadAssemblyResult, input: CadAssemblyMemberTransaction): CadAssemblyMemberResult {
  const previous = rebuildCadAssemblyResult(previousInput);
  const t = record(snapshotCadAssemblyData(input), ['expectedRevision', 'revision', 'addInstances', 'removeInstanceIds', 'reparentInstances']);
  const expectedRevision = revision(t.expectedRevision), nextRevision = revision(t.revision);
  check(expectedRevision === previous.assembly.revision, CODE.STALE, 'expected member-transaction assembly revision is stale');
  check(previous.assembly.revision < 2147483647 && nextRevision === previous.assembly.revision + 1, CODE.REVISION,
    'member transaction revision must be exactly previous+1');
  check(Array.isArray(t.addInstances) && t.addInstances.length <= 32 && Array.isArray(t.removeInstanceIds) && t.removeInstanceIds.length <= 32
    && Array.isArray(t.reparentInstances) && t.reparentInstances.length <= 32, CODE.BUDGET, 'each member operation array must contain0..32 entries');
  const operationCount = t.addInstances.length + t.removeInstanceIds.length + t.reparentInstances.length;
  check(operationCount >= 1, CODE.INPUT, 'all-empty member transaction refused');
  const priorById = new Map(previous.assembly.instances.map(instance => [instance.id, instance]));
  const addIds = new Set<string>();
  const addInstances: CadAssemblyInstance[] = t.addInstances.map(value => {
    const instance = record(value, ['id', 'parentId', 'reference', 'placement']);
    const instanceId = id(instance.id);
    check(!priorById.has(instanceId) && !addIds.has(instanceId), CODE.IDENTITY, 'added member ID must be new to the entire prior graph and unique');
    addIds.add(instanceId); return instance as unknown as CadAssemblyInstance;
  });
  const removeIds = new Set<string>();
  const removeInstanceIds: string[] = t.removeInstanceIds.map(value => {
    const instanceId = id(value);
    check(priorById.has(instanceId), CODE.REFERENCE, 'removal references unknown prior member');
    check(!removeIds.has(instanceId), CODE.IDENTITY, 'duplicate member removal'); removeIds.add(instanceId); return instanceId;
  });
  const reparentIds = new Set<string>(), changedParentInstanceIds: string[] = [];
  const reparentInstances: CadAssemblyMemberTransaction['reparentInstances'] = t.reparentInstances.map(value => {
    const entry = record(value, ['instanceId', 'parentId']), instanceId = id(entry.instanceId);
    check(!reparentIds.has(instanceId), CODE.IDENTITY, 'duplicate member reparent'); reparentIds.add(instanceId);
    check(!removeIds.has(instanceId), CODE.INPUT, 'removed member cannot also be reparented');
    const original = priorById.get(instanceId);
    check(original !== undefined && !addIds.has(instanceId), CODE.REFERENCE, 'reparent requires an existing surviving member; added parent intent belongs in added instance');
    const parentId = entry.parentId === null ? null : id(entry.parentId);
    if (!Object.is(original.parentId, parentId)) changedParentInstanceIds.push(instanceId);
    return { instanceId, parentId };
  });
  const survivorCount = previous.assembly.instances.length - removeIds.size;
  check(survivorCount + addInstances.length <= 32, CODE.BUDGET, 'final native member capacity exceeds32');
  const transaction: CadAssemblyMemberTransaction = { expectedRevision, revision: nextRevision, addInstances, removeInstanceIds, reparentInstances };
  const candidate = snapshotCadAssemblyData(previous.assembly) as CadAssemblyV0;
  candidate.instances = candidate.instances.filter(instance => !removeIds.has(instance.id));
  const survivingInstanceIds = candidate.instances.map(instance => instance.id), reparentById = new Map(reparentInstances.map(entry => [entry.instanceId, entry.parentId]));
  for (const instance of candidate.instances) if (reparentById.has(instance.id)) instance.parentId = reparentById.get(instance.id)!;
  candidate.instances.push(...addInstances); candidate.revision = nextRevision;
  // Existing evaluator alone validates all added poses/refs and the final complete graph.
  const result = evaluateCadAssembly(candidate);
  check(sameCadAssemblyData(result.assembly.parts, previous.assembly.parts), CODE.OWNED, 'member transaction must not change embedded source parts');
  for (const instanceId of survivingInstanceIds) {
    const before = priorById.get(instanceId)!, after = result.assembly.instances.find(instance => instance.id === instanceId)!;
    check(after !== undefined && Object.is(after.id, before.id) && sameCadAssemblyData(after.reference, before.reference)
      && sameCadAssemblyData(after.placement, before.placement), CODE.OWNED, 'surviving source references/IDs/local pose bits must remain');
    if (!reparentById.has(instanceId)) check(Object.is(after.parentId, before.parentId), CODE.OWNED, 'unrequested parent bits must remain');
  }
  const addedInstanceIds = addInstances.map(instance => instance.id), finalInstanceIds = result.assembly.instances.map(instance => instance.id);
  check(sameCadAssemblyData(finalInstanceIds, [...survivingInstanceIds, ...addedInstanceIds]), CODE.OWNED, 'survivor order and appended add order must remain');
  const report: CadAssemblyMemberReport = {
    schema: 'barocss-cad-assembly-member-transaction', version: 0, assemblyId: previous.assembly.assemblyId,
    previousRevision: previous.assembly.revision, revision: nextRevision,
    priorInstanceCount: previous.assembly.instances.length, finalInstanceCount: result.assembly.instances.length,
    addedInstanceCount: addInstances.length, removedInstanceCount: removeInstanceIds.length,
    reparentRequestedCount: reparentInstances.length, changedParentCount: changedParentInstanceIds.length, survivorCount, operationCount,
    addedInstanceIds, removedInstanceIds, reparentRequestedInstanceIds: reparentInstances.map(entry => entry.instanceId),
    changedParentInstanceIds, survivingInstanceIds, finalInstanceIds,
    noOp: addInstances.length === 0 && removeInstanceIds.length === 0 && changedParentInstanceIds.length === 0,
    conventions: { operationLists: 'declared-input-order', survivorOrder: 'previous-authored-order-minus-explicit-removals',
      finalOrder: 'survivors-then-additions-in-input-order', reparent: 'explicit-existing-survivors-only-local-placement-retained',
      removals: 'explicit-listed-members-only-no-subtree-cascade', candidateEvaluation: 'one-complete-native-assembly-evaluation' },
    quality: { partsSourceBitsPreserved: true, survivingReferenceBitsPreserved: true, survivingPlacementBitsPreserved: true,
      survivingIdsPreserved: true, unrequestedParentBitsPreserved: true, survivorOrderPreserved: true, additionOrderPreserved: true,
      priorIdsNeverRecycled: true, completeGraphReevaluated: true, explicitNoOpAdvancesRevision: true, emptyGraphSupported: true,
      geometryAuthority: 'unchanged-embedded-canonical-document-v1-source0', referenceBinding: 'exact-declared-native-revisions-no-hidden-source-hash-or-history',
      derivedWorldMatricesMayChange: true, rendererCapacityCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false,
      ownership: 'copied-cpu-data-gc-no-renderer-resources' }, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    budgetFailure: 'atomic-refusal-prior-assembly-and-files-retained',
    limits: { maximumAdditions: 32, maximumRemovals: 32, maximumReparents: 32, maximumOperationEntries: 96,
      maximumFinalInstances: 32, maximumHierarchyDepth: 16, maximumRevision: 2147483647, authoredIdCharacters: 48,
      ownValues: 1048576, ownDepth: 40, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 },
  };
  return snapshotCadAssemblyData({ assemblyId: previous.assembly.assemblyId, previousRevision: previous.assembly.revision,
    transaction, result, report }, 'owned') as CadAssemblyMemberResult;
}
/** Reproduce the entire operation from the caller's supplied accepted prior graph. */
export function validateCadAssemblyMemberTransaction(previous: CadAssemblyResult, input: CadAssemblyMemberResult): CadAssemblyMemberReport {
  const owned = record(snapshotCadAssemblyData(input, 'owned'), ['assemblyId', 'previousRevision', 'transaction', 'result', 'report'], CODE.OWNED) as unknown as CadAssemblyMemberResult;
  const copiedPrior = snapshotCadAssemblyData(previous, 'owned') as CadAssemblyResult;
  let expected: CadAssemblyMemberResult;
  try { expected = transactCadAssemblyMembers(copiedPrior, owned.transaction); } catch (cause) {
    // Only the supplied prior-revision mismatch retains STALE. A stale added ref in altered owned data is tampering.
    if (cause instanceof CadAssemblyError && cause.code === 'STALE'
      && owned.transaction !== null && typeof owned.transaction === 'object'
      && !Object.is(owned.transaction.expectedRevision, copiedPrior.assembly.revision)) throw cause;
    throw new CadAssemblyError(CODE.OWNED, 'owned member operation complete prior/candidate rebuild refused', cause);
  }
  check(sameCadAssemblyData(owned, expected), CODE.OWNED, 'owned prior identity/transaction/source/reference/order/graph/matrix/report mismatch');
  return snapshotCadAssemblyData(expected.report, 'owned') as CadAssemblyMemberReport;
}
