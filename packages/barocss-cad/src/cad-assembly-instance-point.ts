import {
  CadAssemblyError, CadAssemblyDiagnosticCode, snapshotCadAssemblyData,
  sameCadAssemblyData, rebuildCadAssemblyResult, applyCadAssemblyMatrixPoint,
} from './cad-assembly.js';
import type { CadAssemblyResult, CadAssemblyMatrix, CadAssemblyPlacement } from './cad-assembly.js';
import { queryCadDocumentPoint, CadReferenceError } from './cad-document-reference.js';
import type { CadGeometryReferenceV0, CadDocumentPointQuery, CadDocumentPointResult } from './cad-document-reference.js';
import type { Point } from './types.js';

export interface CadAssemblyInstancePointQuery {
  assemblyId: string; assemblyRevision: number; instanceId: string;
  reference: CadGeometryReferenceV0; query: CadDocumentPointQuery;
}
export interface CadAssemblyInstancePointReport {
  schema: 'barocss-cad-assembly-instance-point'; version: 0;
  assemblyId: string; assemblyRevision: number; instanceId: string;
  reference: CadGeometryReferenceV0; lengthUnit: 'mm';
  originalLocalFrame: 'authored-xyz-no-axis-conversion';
  outputFrame: { kind: 'assembly-space-xyz'; assemblyId: string; lengthUnit: 'mm' };
  nativePoint: CadDocumentPointResult;
  lineage: {
    instanceId: string; parentId: string | null; reference: CadGeometryReferenceV0;
    placement: CadAssemblyPlacement; localMatrix: CadAssemblyMatrix; worldMatrix: CadAssemblyMatrix;
  }[];
  geometryAuthority: 'embedded-current-cad-document-source0';
  placementAuthority: 'authored-assembly-instance-graph';
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: {
    querySemantics: 'original-native-parameter-then-explicit-assembly-world-matrix';
    composition: 'parent-world-times-local-no-euler-addition';
    matrixConvention: 'row-major-column-vector';
    bindingSemantics: 'exact-assembly-revision-instance-and-qualified-part-reference';
    lineageOrder: 'root-through-selected-instance';
    originalGeometryAndSourcePreserved: true; originalLocalQueriesRemainUnposed: true;
    nativeFrameUpCertified: false; globalBinary64ErrorCertified: false;
    manufacturingToleranceCertified: false; topologyNamingCertified: false;
    ownership: 'copied-cpu-data-gc-no-renderer-resources';
  };
  limits: { maximumInstances: 32; maximumDepth: 16; maximumNativePointQueries: 1;
    pointCoordinateAbsMM: 10000000; ownedValues: 1048576; ownedDepth: 40;
    arrayElements: 8192; recordFields: 64; stringCharacters: 262144 };
}
export interface CadAssemblyInstancePointResult {
  assemblyId: string; assemblyRevision: number; instanceId: string;
  reference: CadGeometryReferenceV0; query: CadDocumentPointQuery;
  originalLocalPointMM: Point; assemblyPointMM: Point; ancestors: string[];
  localMatrix: CadAssemblyMatrix; worldMatrix: CadAssemblyMatrix;
  report: CadAssemblyInstancePointReport;
}

const CODE = CadAssemblyDiagnosticCode;
function check(condition: boolean, code: typeof CODE[keyof typeof CODE], detail: string): asserts condition {
  if (!condition) throw new CadAssemblyError(code, detail);
}
function record(value: unknown, fields: string[], code: typeof CODE[keyof typeof CODE]): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'own point-query record required');
  const result = value as Record<string, unknown>;
  check(Object.keys(result).length === fields.length && fields.every(field => Object.hasOwn(result, field)),
    code, 'exact point-query fields required: ' + fields.join(','));
  return result;
}

/** Query original native geometry, then apply the explicitly authored instance hierarchy. */
export function queryCadAssemblyInstancePoint(input: CadAssemblyResult,
  inputQuery: CadAssemblyInstancePointQuery): CadAssemblyInstancePointResult {
  const accepted = rebuildCadAssemblyResult(input);
  const q = record(snapshotCadAssemblyData(inputQuery, 'input'),
    ['assemblyId', 'assemblyRevision', 'instanceId', 'reference', 'query'], CODE.QUERY);
  check(typeof q.assemblyId === 'string' && typeof q.instanceId === 'string'
    && typeof q.assemblyRevision === 'number' && Number.isInteger(q.assemblyRevision)
    && q.assemblyRevision >= 0 && q.assemblyRevision <= 2147483647, CODE.QUERY, 'finite authored assembly/instance query identity required');
  check(q.assemblyId === accepted.assembly.assemblyId && Object.is(q.assemblyRevision, accepted.assembly.revision),
    CODE.STALE, 'point query must pin the exact current assembly identity/revision');
  const selected = accepted.instances.find(instance => instance.instanceId === q.instanceId);
  check(selected !== undefined, CODE.QUERY, 'selected authored assembly instance does not exist');
  check(sameCadAssemblyData(q.reference, selected.reference), CODE.STALE,
    'point query must pin the selected instance complete qualified native part reference');
  const document = accepted.documents.find(part => part.document.documentId === selected.reference.documentId);
  check(document !== undefined, CODE.REFERENCE, 'selected original native document is absent');
  let nativePoint: CadDocumentPointResult;
  try {
    nativePoint = queryCadDocumentPoint(document, selected.reference, q.query as CadDocumentPointQuery);
  } catch (cause) {
    const code = cause instanceof CadReferenceError
      ? cause.code === 'STALE' ? CODE.STALE : cause.code === 'QUERY' ? CODE.QUERY
        : cause.code === 'INPUT' ? CODE.INPUT : CODE.NATIVE : CODE.NATIVE;
    throw new CadAssemblyError(code, 'actual original-local native point query refused: '
      + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
  const assemblyPointMM = applyCadAssemblyMatrixPoint(selected.worldMatrix, nativePoint.pointMM);
  const lineage = [...selected.ancestors, selected.instanceId].map(instanceId => {
    const instance = accepted.instances.find(entry => entry.instanceId === instanceId);
    check(instance !== undefined, CODE.HIERARCHY, 'complete authored ancestor lineage required');
    return { instanceId: instance.instanceId, parentId: instance.parentId, reference: instance.reference,
      placement: instance.placement, localMatrix: instance.localMatrix, worldMatrix: instance.worldMatrix };
  });
  check(lineage.length <= 16 && lineage.length === selected.depth, CODE.HIERARCHY, 'query lineage must match bounded instance depth');
  const report: CadAssemblyInstancePointReport = {
    schema: 'barocss-cad-assembly-instance-point', version: 0,
    assemblyId: accepted.assembly.assemblyId, assemblyRevision: accepted.assembly.revision,
    instanceId: selected.instanceId, reference: selected.reference, lengthUnit: 'mm',
    originalLocalFrame: 'authored-xyz-no-axis-conversion',
    outputFrame: { kind: 'assembly-space-xyz', assemblyId: accepted.assembly.assemblyId, lengthUnit: 'mm' },
    nativePoint, lineage, geometryAuthority: 'embedded-current-cad-document-source0',
    placementAuthority: 'authored-assembly-instance-graph', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { querySemantics: 'original-native-parameter-then-explicit-assembly-world-matrix',
      composition: 'parent-world-times-local-no-euler-addition', matrixConvention: 'row-major-column-vector',
      bindingSemantics: 'exact-assembly-revision-instance-and-qualified-part-reference', lineageOrder: 'root-through-selected-instance',
      originalGeometryAndSourcePreserved: true, originalLocalQueriesRemainUnposed: true,
      nativeFrameUpCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false,
      topologyNamingCertified: false, ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    limits: { maximumInstances: 32, maximumDepth: 16, maximumNativePointQueries: 1, pointCoordinateAbsMM: 10000000,
      ownedValues: 1048576, ownedDepth: 40, arrayElements: 8192, recordFields: 64, stringCharacters: 262144 },
  };
  return snapshotCadAssemblyData({ assemblyId: accepted.assembly.assemblyId, assemblyRevision: accepted.assembly.revision,
    instanceId: selected.instanceId, reference: selected.reference, query: nativePoint.query,
    originalLocalPointMM: nativePoint.pointMM, assemblyPointMM, ancestors: selected.ancestors,
    localMatrix: selected.localMatrix, worldMatrix: selected.worldMatrix, report }, 'owned') as CadAssemblyInstancePointResult;
}

/** Rebuild the actual current graph, original point and complete posed lineage. */
export function validateCadAssemblyInstancePoint(assembly: CadAssemblyResult,
  input: CadAssemblyInstancePointResult): CadAssemblyInstancePointReport {
  const owned = record(snapshotCadAssemblyData(input, 'owned'),
    ['assemblyId', 'assemblyRevision', 'instanceId', 'reference', 'query', 'originalLocalPointMM', 'assemblyPointMM',
      'ancestors', 'localMatrix', 'worldMatrix', 'report'], CODE.OWNED) as unknown as CadAssemblyInstancePointResult;
  let expected: CadAssemblyInstancePointResult;
  try {
    expected = queryCadAssemblyInstancePoint(assembly, { assemblyId: owned.assemblyId, assemblyRevision: owned.assemblyRevision,
      instanceId: owned.instanceId, reference: owned.reference, query: owned.query });
  } catch (cause) {
    if (cause instanceof CadAssemblyError && cause.code === 'STALE') throw cause;
    throw new CadAssemblyError(CODE.OWNED, 'owned instance point complete current graph/native point rebuild refused', cause);
  }
  check(sameCadAssemblyData(owned, expected), CODE.OWNED, 'owned original point/posed point/frame/matrices/ancestor lineage/report mismatch');
  return snapshotCadAssemblyData(expected.report, 'owned') as CadAssemblyInstancePointReport;
}
