import { createCadDocument, CadDocumentError, CadDocumentDiagnosticCode, parseCadDocumentOwnJson, cadDocumentOwnUtf8Bytes } from './cad-document.js';
import type { CadDocumentV1, CadDocumentResult } from './cad-document.js';
import { resolveCadGeometryReference, CadReferenceError } from './cad-document-reference.js';
import type { CadGeometryReferenceV0 } from './cad-document-reference.js';
import type { Point } from './types.js';

export const CadAssemblyDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', REFERENCE: 'REFERENCE', STALE: 'STALE', HIERARCHY: 'HIERARCHY',
  REVISION: 'REVISION', PLACEMENT: 'PLACEMENT', REPRESENTABILITY: 'REPRESENTABILITY', BUDGET: 'BUDGET', JSON: 'JSON', OWNED: 'OWNED', QUERY: 'QUERY', NATIVE: 'NATIVE',
} as const);
export type CadAssemblyDiagnosticCode = typeof CadAssemblyDiagnosticCode[keyof typeof CadAssemblyDiagnosticCode];
export class CadAssemblyError extends Error {
  readonly code: CadAssemblyDiagnosticCode;
  constructor(code: CadAssemblyDiagnosticCode, detail: string, cause?: unknown) {
    super(('CAD assembly: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CadAssemblyError'; this.code = code;
  }
}
export type CadAssemblyMatrix = [number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number];
export interface CadAssemblyPlacement { translationMM: Point; rotationDegreesXYZ: Point }
export interface CadAssemblyInstance { id: string; parentId: string | null; reference: CadGeometryReferenceV0; placement: CadAssemblyPlacement }
export interface CadAssemblyV0 {
  schema: 'barocss-cad-assembly'; version: 0; assemblyId: string; revision: number; lengthUnit: 'mm'; rotationUnit: 'deg';
  frame: 'assembly-space-xyz'; parts: CadDocumentV1[]; instances: CadAssemblyInstance[];
}
export interface CadAssemblyEvaluatedInstance {
  instanceId: string; parentId: string | null; reference: CadGeometryReferenceV0; placement: CadAssemblyPlacement;
  ancestors: string[]; depth: number; localMatrix: CadAssemblyMatrix; worldMatrix: CadAssemblyMatrix;
}
export interface CadAssemblyEdits {
  expectedRevision: number; revision: number;
  instanceEdits: { instanceId: string; parentId?: string | null; translationMM?: Point; rotationDegreesXYZ?: Point }[];
}
export interface CadAssemblyReport {
  schema: 'barocss-cad-assembly-report'; version: 0; assemblyId: string; revision: number;
  documentCount: number; instanceCount: number; rootInstanceCount: number; maximumDepth: number;
  uniquePartReferenceCount: number; sharedReferenceCount: number;
  sharedPartGroups: { reference: CadGeometryReferenceV0; instanceIds: string[]; instanceCount: number }[];
  lengthUnit: 'mm'; rotationUnit: 'deg'; frame: 'assembly-space-xyz';
  geometryAuthority: 'embedded-canonical-document-v1-original-source0'; placementAuthority: 'authored-assembly-instance-hierarchy-and-placements';
  conventions: { matrixLayout: 'row-major'; pointConvention: 'column-vector'; rotationOrder: 'Rz*Ry*Rx';
    composition: 'parent-world-times-local'; ancestorOrder: 'root-to-parent'; rootDepth: 1;
    partSourceFrame: 'authored-xyz-no-axis-conversion'; worldFrame: 'assembly-space-xyz' };
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { partSourceUnchanged: true; geometryNotBakedRenamedOrResampled: true; poseFieldsBitsPreserved: true;
    sharedReferencesAllowed: true; geometryIdAloneNeverMergesParts: true; logicalInstanceIdsNotTopologyIds: true;
    nativeReferenceBinding: 'exact-declared-document-and-asset-revisions-current-embedded-snapshot-only';
    sourceEditRevisionResponsibility: 'caller-must-advance-part-document-and-asset-revisions'; contentHashCertified: false;
    hiddenHistoryOrExternalRefresh: 'none'; numericRigidityCertified: false; globalBinary64ErrorCertified: false;
    manufacturingToleranceCertified: false; ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-original-assembly-and-prior-results-retained';
  limits: { maximumParts: 4; maximumInstances: 32; maximumHierarchyDepth: 16; maximumRevision: 2147483647;
    authoredIdCharacters: 48; localTranslationAbsMM: 10000; rotationAbsDegrees: 360; worldTranslationAbsMM: 1000000;
    pointComponentAbsMM: 10000000; rotationBlockAllowance: 1e-9;
    ownValues: 1048576; ownDepth: 40; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144;
    maximumFileBytes: 16777216; maximumFileCodeUnits: 16777216;
    jsonValues: 65536; jsonDepth: 12; jsonArrayElements: 64; jsonRecordFields: 16; jsonStringCharacters: 262144 };
}
export interface CadAssemblyResult { assembly: CadAssemblyV0; documents: CadDocumentResult[]; instances: CadAssemblyEvaluatedInstance[]; report: CadAssemblyReport }

const CODE = CadAssemblyDiagnosticCode, FILE_LIMIT = 16777216;
function check(condition: boolean, code: CadAssemblyDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CadAssemblyError(code, detail);
}
function finite(value: number, detail: string): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, detail); return value; }
function product(a: number, b: number): number {
  const value = finite(a * b, 'derived matrix/radian product overflow');
  check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero derived matrix/radian product underflow'); return value;
}
function native<T>(action: () => T, detail: string, code: CadAssemblyDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CadAssemblyError) throw cause;
    let actualCode = code;
    if (cause instanceof CadReferenceError) actualCode = cause.code === 'STALE' ? CODE.STALE : cause.code === 'INPUT' ? CODE.INPUT : CODE.REFERENCE;
    else if (cause instanceof CadDocumentError) {
      if (cause.code === 'JSON' || cause.code === 'BUDGET' || cause.code === 'VERSION' || cause.code === 'IDENTITY' || cause.code === 'REFERENCE' || cause.code === 'INPUT' || cause.code === 'OWNED') actualCode = cause.code;
      else actualCode = cause.code === 'SOURCE' ? CODE.NATIVE : CODE.INPUT;
    }
    throw new CadAssemblyError(actualCode, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}
/** Internal shared plain-data snapshot. Repeated aliases are copied; ancestor cycles refuse. */
export function snapshotCadAssemblyData(input: unknown, mode: 'input' | 'owned' = 'input'): unknown {
  const code = mode === 'owned' ? CODE.OWNED : CODE.INPUT;
  let remaining = 1048576;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 40, code, 'own-value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, code, 'own string budget exceeded'); return value; }
    check(typeof value === 'object', code, 'plain own data required');
    check(!ancestors.has(value), code, 'cyclic own data refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.length <= (array ? 8193 : 64), code, 'own field budget exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden own data refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'dense bounded own arrays required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'sparse/extra own array field refused'); return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  return native(() => copy(input, 0), 'own assembly snapshot', code);
}
/** Internal bit-aware complete data comparison, including qualified references. */
export function sameCadAssemblyData(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((value, index) => sameCadAssemblyData(value, b[index]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    return Object.keys(left).length === Object.keys(right).length
      && Object.keys(left).every(key => Object.hasOwn(right, key) && sameCadAssemblyData(left[key], right[key]));
  }
  return Object.is(a, b);
}
function record(value: unknown, fields: string[], code: CadAssemblyDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'own record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(',')); return data;
}
function id(value: unknown): string {
  check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII assembly/instance ID1..48 required'); return value;
}
function revision(value: unknown): number {
  check(typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483647 && !Object.is(value, -0),
    CODE.REVISION, 'unsigned revision0..2147483647 required; signed zero refused'); return value;
}
function vector(value: unknown, bound: number): Point {
  check(Array.isArray(value) && value.length === 3 && value.every(component => typeof component === 'number' && Number.isFinite(component) && Math.abs(component) <= bound),
    CODE.PLACEMENT, 'finite three-component placement vector within explicit bound required'); return [value[0], value[1], value[2]];
}
function placement(value: unknown): CadAssemblyPlacement {
  const p = record(value, ['translationMM', 'rotationDegreesXYZ']);
  return { translationMM: vector(p.translationMM, 10000), rotationDegreesXYZ: vector(p.rotationDegreesXYZ, 360) };
}
function checkedMatrix(matrix: unknown): CadAssemblyMatrix {
  check(Array.isArray(matrix) && matrix.length === 16 && matrix.every(value => typeof value === 'number' && Number.isFinite(value)),
    CODE.PLACEMENT, 'finite row-major16 matrix required');
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) check(Math.abs(matrix[row * 4 + column]) <= 1 + 1e-9,
    CODE.REPRESENTABILITY, 'derived rotation block exceeds bounded allowance');
  for (const index of [3, 7, 11]) check(Math.abs(matrix[index]) <= 1000000, CODE.REPRESENTABILITY, 'derived world translation exceeds1000000mm');
  check([0, 0, 0, 1].every((value, index) => Object.is(matrix[12 + index], value)), CODE.PLACEMENT, 'homogeneous last row must be[0,0,0,1]');
  return matrix as CadAssemblyMatrix;
}
function multiply(a: CadAssemblyMatrix, b: CadAssemblyMatrix): CadAssemblyMatrix {
  const values: number[] = [];
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
    let value = 0;
    for (let index = 0; index < 4; index++) value = finite(value + product(a[row * 4 + index], b[index * 4 + column]), 'derived matrix sum overflow');
    values.push(value);
  }
  return checkedMatrix(values);
}
function localMatrix(p: CadAssemblyPlacement): CadAssemblyMatrix {
  const radians = p.rotationDegreesXYZ.map(degrees => {
    const value = finite(product(degrees, Math.PI) / 180, 'derived radian division overflow');
    check(degrees === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero degree-to-radian value underflow'); return value;
  });
  const [x, y, z] = radians, sx = finite(Math.sin(x), 'sinX nonfinite'), cx = finite(Math.cos(x), 'cosX nonfinite');
  const sy = finite(Math.sin(y), 'sinY nonfinite'), cy = finite(Math.cos(y), 'cosY nonfinite');
  const sz = finite(Math.sin(z), 'sinZ nonfinite'), cz = finite(Math.cos(z), 'cosZ nonfinite');
  const Rx: CadAssemblyMatrix = [1, 0, 0, 0, 0, cx, -sx, 0, 0, sx, cx, 0, 0, 0, 0, 1];
  const Ry: CadAssemblyMatrix = [cy, 0, sy, 0, 0, 1, 0, 0, -sy, 0, cy, 0, 0, 0, 0, 1];
  const Rz: CadAssemblyMatrix = [cz, -sz, 0, 0, sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const matrix = multiply(multiply(Rz, Ry), Rx);
  matrix[3] = p.translationMM[0]; matrix[7] = p.translationMM[1]; matrix[11] = p.translationMM[2]; return checkedMatrix(matrix);
}
/** Internal derived point application; original native geometry and source are never transformed. */
export function applyCadAssemblyMatrixPoint(matrixInput: CadAssemblyMatrix, pointInput: Point): Point {
  const matrix = checkedMatrix(snapshotCadAssemblyData(matrixInput)), copied = snapshotCadAssemblyData(pointInput);
  check(Array.isArray(copied) && copied.length === 3 && copied.every(value => typeof value === 'number' && Number.isFinite(value)), CODE.QUERY, 'finite native point tuple required');
  const point = [0, 1, 2].map(row => {
    let value = 0;
    for (let column = 0; column < 3; column++) value = finite(value + product(matrix[row * 4 + column], copied[column]), 'derived point matrix sum overflow');
    value = finite(value + matrix[row * 4 + 3], 'derived point translation overflow');
    check(Math.abs(value) <= 10000000, CODE.REPRESENTABILITY, 'derived assembly point exceeds10000000mm'); return value;
  }) as Point;
  return point;
}

/** Resolve unchanged embedded canonical parts and evaluate authored hierarchy placements atomically. */
export function evaluateCadAssembly(input: CadAssemblyV0): CadAssemblyResult {
  const a = record(snapshotCadAssemblyData(input), ['schema', 'version', 'assemblyId', 'revision', 'lengthUnit', 'rotationUnit', 'frame', 'parts', 'instances']);
  check(a.schema === 'barocss-cad-assembly' && a.version === 0, CODE.VERSION, 'barocss-cad-assembly/version0 required');
  const assemblyId = id(a.assemblyId), assemblyRevision = revision(a.revision);
  check(a.lengthUnit === 'mm' && a.rotationUnit === 'deg' && a.frame === 'assembly-space-xyz', CODE.INPUT, 'explicit assembly mm/deg/assembly-space-xyz required');
  check(Array.isArray(a.parts) && a.parts.length >= 1 && a.parts.length <= 4, CODE.BUDGET, '1..4 unchanged canonical parts required');
  check(Array.isArray(a.instances) && a.instances.length <= 32, CODE.BUDGET, '0..32 authored instances required');
  const documentIds = new Set<string>(), documents = a.parts.map(part => {
    const document = native(() => createCadDocument(part as CadDocumentV1), 'actual embedded canonical document creation');
    check(sameCadAssemblyData(part, document.document), CODE.REFERENCE, 'embedded part must match complete actual canonical authored document');
    check(!documentIds.has(document.document.documentId), CODE.IDENTITY, 'duplicate embedded documentId'); documentIds.add(document.document.documentId); return document;
  });
  const documentsById = new Map(documents.map(document => [document.document.documentId, document]));
  const instanceIds = new Set<string>();
  const instances: CadAssemblyInstance[] = a.instances.map(value => {
    const i = record(value, ['id', 'parentId', 'reference', 'placement']), instanceId = id(i.id);
    check(!instanceIds.has(instanceId), CODE.IDENTITY, 'duplicate authored instance ID'); instanceIds.add(instanceId);
    const parentId = i.parentId === null ? null : id(i.parentId);
    check(parentId !== instanceId, CODE.HIERARCHY, 'self-parent instance refused');
    const ref = record(i.reference, ['schema', 'version', 'documentId', 'documentRevision', 'bodyId', 'assetId', 'assetRevision', 'geometryId', 'geometryKind', 'sourceVersion', 'sourceFrame', 'lengthUnit'], CODE.REFERENCE);
    check(typeof ref.documentId === 'string', CODE.REFERENCE, 'qualified part documentId required');
    const document = documentsById.get(ref.documentId);
    check(document !== undefined, CODE.REFERENCE, 'foreign or missing embedded part reference');
    const resolved = native(() => resolveCadGeometryReference(document, ref as unknown as CadGeometryReferenceV0), 'exact embedded part geometry reference');
    check(sameCadAssemblyData(ref, resolved.reference), CODE.REFERENCE, 'complete exact part reference must remain unchanged');
    return { id: instanceId, parentId, reference: resolved.reference, placement: placement(i.placement) };
  });
  const byId = new Map(instances.map((instance, index) => [instance.id, index]));
  for (const instance of instances) check(instance.parentId === null || byId.has(instance.parentId), CODE.HIERARCHY, 'missing or foreign instance parent');
  const states = instances.map(() => 0), evaluated: (CadAssemblyEvaluatedInstance | undefined)[] = instances.map(() => undefined);
  const visit = (index: number): CadAssemblyEvaluatedInstance => {
    if (states[index] === 2) return evaluated[index]!;
    check(states[index] !== 1, CODE.HIERARCHY, 'instance parent cycle refused'); states[index] = 1;
    const instance = instances[index], parent = instance.parentId === null ? null : visit(byId.get(instance.parentId)!);
    const ancestors = parent === null ? [] : [...parent.ancestors, parent.instanceId], depth = ancestors.length + 1;
    check(depth <= 16, CODE.HIERARCHY, 'instance hierarchy depth exceeds16');
    const local = localMatrix(instance.placement), world = parent === null ? [...local] as CadAssemblyMatrix : multiply(parent.worldMatrix, local);
    const result: CadAssemblyEvaluatedInstance = { instanceId: instance.id, parentId: instance.parentId, reference: instance.reference,
      placement: instance.placement, ancestors, depth, localMatrix: local, worldMatrix: world };
    evaluated[index] = result; states[index] = 2; return result;
  };
  const evaluatedInstances = instances.map((_, index) => visit(index));
  const sharedPartGroups: CadAssemblyReport['sharedPartGroups'] = [];
  for (const instance of instances) {
    const group = sharedPartGroups.find(group => sameCadAssemblyData(group.reference, instance.reference));
    if (group) { group.instanceIds.push(instance.id); group.instanceCount++; }
    else sharedPartGroups.push({ reference: instance.reference, instanceIds: [instance.id], instanceCount: 1 });
  }
  const assembly: CadAssemblyV0 = { schema: 'barocss-cad-assembly', version: 0, assemblyId, revision: assemblyRevision,
    lengthUnit: 'mm', rotationUnit: 'deg', frame: 'assembly-space-xyz', parts: documents.map(document => document.document), instances };
  const report: CadAssemblyReport = {
    schema: 'barocss-cad-assembly-report', version: 0, assemblyId, revision: assemblyRevision,
    documentCount: documents.length, instanceCount: instances.length, rootInstanceCount: instances.filter(instance => instance.parentId === null).length,
    maximumDepth: Math.max(0, ...evaluatedInstances.map(instance => instance.depth)), uniquePartReferenceCount: sharedPartGroups.length,
    sharedReferenceCount: sharedPartGroups.filter(group => group.instanceCount > 1).length, sharedPartGroups,
    lengthUnit: 'mm', rotationUnit: 'deg', frame: 'assembly-space-xyz', geometryAuthority: 'embedded-canonical-document-v1-original-source0',
    placementAuthority: 'authored-assembly-instance-hierarchy-and-placements',
    conventions: { matrixLayout: 'row-major', pointConvention: 'column-vector', rotationOrder: 'Rz*Ry*Rx', composition: 'parent-world-times-local',
      ancestorOrder: 'root-to-parent', rootDepth: 1, partSourceFrame: 'authored-xyz-no-axis-conversion', worldFrame: 'assembly-space-xyz' },
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { partSourceUnchanged: true, geometryNotBakedRenamedOrResampled: true, poseFieldsBitsPreserved: true, sharedReferencesAllowed: true,
      geometryIdAloneNeverMergesParts: true, logicalInstanceIdsNotTopologyIds: true,
      nativeReferenceBinding: 'exact-declared-document-and-asset-revisions-current-embedded-snapshot-only',
      sourceEditRevisionResponsibility: 'caller-must-advance-part-document-and-asset-revisions', contentHashCertified: false,
      hiddenHistoryOrExternalRefresh: 'none', numericRigidityCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false,
      ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-original-assembly-and-prior-results-retained',
    limits: { maximumParts: 4, maximumInstances: 32, maximumHierarchyDepth: 16, maximumRevision: 2147483647,
      authoredIdCharacters: 48, localTranslationAbsMM: 10000, rotationAbsDegrees: 360, worldTranslationAbsMM: 1000000,
      pointComponentAbsMM: 10000000, rotationBlockAllowance: 1e-9, ownValues: 1048576, ownDepth: 40, arrayElements: 8192,
      recordFields: 64, sourceStringCharacters: 262144, maximumFileBytes: 16777216, maximumFileCodeUnits: 16777216,
      jsonValues: 65536, jsonDepth: 12, jsonArrayElements: 64, jsonRecordFields: 16, jsonStringCharacters: 262144 },
  };
  return snapshotCadAssemblyData({ assembly, documents, instances: evaluatedInstances, report }, 'owned') as CadAssemblyResult;
}
/** Internal complete owned reconstruction for validators and the instance-point module. */
export function rebuildCadAssemblyResult(input: CadAssemblyResult): CadAssemblyResult {
  const owned = snapshotCadAssemblyData(input, 'owned') as CadAssemblyResult;
  record(owned, ['assembly', 'documents', 'instances', 'report'], CODE.OWNED);
  let expected: CadAssemblyResult;
  try { expected = evaluateCadAssembly(owned.assembly); } catch (cause) {
    throw new CadAssemblyError(CODE.OWNED, 'owned authored assembly complete rebuild refused', cause);
  }
  check(sameCadAssemblyData(owned, expected), CODE.OWNED, 'owned parts/source/references/placements/hierarchy/matrices/report mismatch'); return expected;
}
/** Rebuild all native embedded parts and derived hierarchy data. */
export function validateCadAssemblyResult(input: CadAssemblyResult): CadAssemblyReport {
  return snapshotCadAssemblyData(rebuildCadAssemblyResult(input).report, 'owned') as CadAssemblyReport;
}
/** Revision-checked placement/reparent patches only; untouched source/reference/order bits remain. */
export function updateCadAssembly(previousInput: CadAssemblyResult, editInput: CadAssemblyEdits): CadAssemblyResult {
  const previous = rebuildCadAssemblyResult(previousInput), e = record(snapshotCadAssemblyData(editInput), ['expectedRevision', 'revision', 'instanceEdits']);
  const expectedRevision = revision(e.expectedRevision), nextRevision = revision(e.revision);
  check(expectedRevision === previous.assembly.revision, CODE.STALE, 'expected assembly revision is stale');
  check(previous.assembly.revision < 2147483647 && nextRevision === previous.assembly.revision + 1, CODE.REVISION, 'new assembly revision must be exactly previous+1');
  check(Array.isArray(e.instanceEdits) && e.instanceEdits.length >= 1 && e.instanceEdits.length <= 32, CODE.BUDGET, '1..32 unique existing instance edits required');
  const candidate = snapshotCadAssemblyData(previous.assembly) as CadAssemblyV0, edited = new Set<string>();
  const patches = e.instanceEdits.map(value => {
    check(value !== null && typeof value === 'object' && !Array.isArray(value), CODE.INPUT, 'instance edit record required');
    const patch = value as Record<string, unknown>, keys = Object.keys(patch);
    check(Object.hasOwn(patch, 'instanceId') && keys.length >= 2 && keys.length <= 4
      && keys.every(key => ['instanceId', 'parentId', 'translationMM', 'rotationDegreesXYZ'].includes(key)), CODE.INPUT, 'placement/reparent fields only; at least one explicit field required');
    const instanceId = id(patch.instanceId);
    check(!edited.has(instanceId), CODE.IDENTITY, 'duplicate instance edit'); edited.add(instanceId);
    const instance = candidate.instances.find(instance => instance.id === instanceId);
    check(instance !== undefined, CODE.REFERENCE, 'instance edit references missing existing instance');
    const parentId = Object.hasOwn(patch, 'parentId') ? patch.parentId === null ? null : id(patch.parentId) : instance.parentId;
    const translationMM = Object.hasOwn(patch, 'translationMM') ? vector(patch.translationMM, 10000) : instance.placement.translationMM;
    const rotationDegreesXYZ = Object.hasOwn(patch, 'rotationDegreesXYZ') ? vector(patch.rotationDegreesXYZ, 360) : instance.placement.rotationDegreesXYZ;
    return { instance, parentId, translationMM, rotationDegreesXYZ };
  });
  for (const patch of patches) { patch.instance.parentId = patch.parentId; patch.instance.placement = { translationMM: patch.translationMM, rotationDegreesXYZ: patch.rotationDegreesXYZ }; }
  candidate.revision = nextRevision; return evaluateCadAssembly(candidate);
}
function rawJson(value: unknown): string {
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value);
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(rawJson).join(',') + ']';
  const data = value as Record<string, unknown>;
  return '{' + Object.keys(data).map(key => JSON.stringify(key) + ':' + rawJson(data[key])).join(',') + '}';
}
/** Serialize authored fields only, preserving negative-zero tokens and every embedded source string. */
export function serializeCadAssembly(input: CadAssemblyV0): string {
  const assembly = evaluateCadAssembly(input).assembly, text = rawJson(assembly) + '\n';
  check(text.length <= FILE_LIMIT, CODE.BUDGET, 'assembly file code-unit limit exceeded');
  const bytes = native(() => cadDocumentOwnUtf8Bytes(text, CadDocumentDiagnosticCode.JSON), 'actual shared UTF-8 counter');
  check(bytes <= FILE_LIMIT, CODE.BUDGET, 'assembly file UTF-8 byte limit exceeded'); return text;
}
/** Parse a new authored candidate with the unchanged strict duplicate-key JSON decoder. */
export function parseCadAssembly(text: string): CadAssemblyResult {
  check(typeof text === 'string', CODE.JSON, 'authored assembly JSON text required');
  check(text.length <= FILE_LIMIT, CODE.BUDGET, 'assembly input file code-unit limit exceeded');
  const bytes = native(() => cadDocumentOwnUtf8Bytes(text, CadDocumentDiagnosticCode.JSON), 'actual shared UTF-8 counter');
  check(bytes <= FILE_LIMIT, CODE.BUDGET, 'assembly input file UTF-8 byte limit exceeded');
  const decoded = native(() => parseCadDocumentOwnJson(text), 'actual unchanged strict JSON decoder'); return evaluateCadAssembly(decoded as CadAssemblyV0);
}
