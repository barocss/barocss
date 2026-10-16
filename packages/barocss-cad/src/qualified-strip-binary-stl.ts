import type {QualifiedTranslatedStripBodyMeshResult as Mesh} from './qualified-translated-strip-body-mesh.js';
import { SectionRationalContext as Q } from './section-rational-internal.js';
import type { SectionFraction as F } from './section-rational-internal.js';
import { validateQualifiedTranslatedStripBodyMesh } from './qualified-translated-strip-body-mesh.js';
import { encodeQualifiedStripBinaryStlTrusted } from './qualified-strip-binary-stl-encoding-internal.js';
import type {Point} from './types.js';
import { same } from './structural-equality.js';
export interface QualifiedTranslatedStripBodyBinaryStlOptions {
 evaluationId:string;maximumVertices:290;maximumTriangles:576;maximumBytes:28884;
}
type Request={mesh:Mesh;options:QualifiedTranslatedStripBodyBinaryStlOptions};
export interface QualifiedTranslatedStripBodyBinaryStlVertexLoss {
 vertexIndex:number;sourcePointMM:Point;float32PointMM:Point;componentLossMM:Point;
 exactSquaredDisplacementMM2:F;measuredDisplacementMM:number;
}
type VertexLoss=QualifiedTranslatedStripBodyBinaryStlVertexLoss;
type Facet={triangleIndex:number;faceId:string;vertexIndices:[number,number,number];byteOffset:number;
 normal:Point;unitResidual:number;exactCross:[F,F,F];exactNormalDotCross:F;attributeByteCount:0};
type Counts={meshValidationCount:number;vertexCount:number;coordinateFloat32RoundCount:number;
 triangleCount:number;normalFloat32RoundCount:number;exactCrossCount:number;normalAlignmentCount:number;
 encodedFloat32Count:number;encodedAttributeCount:number;encodedByteCount:number;
 curveD0Count:0;curveD1Count:0;surfaceD0Count:0;surfaceD1Count:0;sourceCompilationCount:0;
 rootSolveCount:0;rationalFloatConversionCount:0;fileWriteCount:0;fileReadCount:0};
type Size={utf16:number;utf8:number};
type Limits={maximumVertices:290;maximumTriangles:576;maximumBinaryBytes:28884;
 requestBytes:4194304;resultBytes:8388608;ownValues:4194304;ownDepth:64;arrayElements:8192;
 byteArrayElements:28884;recordFields:64;keyCharacters:128;stringCharacters:262144;identifierCharacters:48;
 rationalOperations:200000;gcdSteps:200000;rationalIntegerBits:8192;fractionIntegerCharacters:5000;
 maximumRationalFloatConversions:0;normalUnitResidual:1e-5;maximumSettlePasses:8};
export interface QualifiedTranslatedStripBodyBinaryStlReport {
 schema:'barocss-qualified-translated-strip-body-binary-stl';version:0;evaluationId:string;
 meshId:string;bodyId:string;shellId:string;materialCertificateId:string;vertexCount:number;
 triangleCount:number;byteLength:number;headerASCII:'BaroCSS binary STL | mm convention | approximate facets';
 format:'binary-stl';byteOrder:'little-endian';lengthUnit:'mm';
 unitSource:'caller-convention-not-stl-metadata';sourceFrame:'authored-xyz-no-axis-conversion';
 positionEncoding:'float32';byteEncoding:'dense-uint8-number-array';attributePolicy:'zero-no-colors';
 normalSource:'approximate-quantized-triangle-geometry';vertexLosses:VertexLoss[];facets:Facet[];
 maximumSquaredDisplacementMM2:F;maximumMeasuredDisplacementMM:number;
 directCounts:Counts;inheritedMeshReport:Mesh['report'];rationalCounts:ReturnType<Q['counts']>;
 numericPolicy:{source:'whole-validated-binary64-packet-positions';coordinates:'Math.fround-no-transform';
 loss:'exact-rational-components-and-squared-distance-plus-measured-hypot';
 collapse:'exact-zero-cross-after-float32-quantization';normal:'approximate-unit-float32-with-exact-positive-cross-dot';
 originalTriangleOrderPreserved:true;originalIndexedVertexMappingRetained:true;nativeKernelQueries:false;
 resampling:false;rescaling:false;welding:false;snapPerformed:false;rootRationalFloatConversion:false};
 quality:{wholeNativeMeshValidated:true;originalMeshRetained:true;parentFlagsUnchanged:true;
 allOriginalVerticesCompared:true;float32LossMeasured:true;exactQuantizedCollapseChecked:true;
 serializationCertified:true;approximateFacets:true;approximateNormals:true;
 nativeIdentityEmbedded:false;nativeUnitsMetadataEmbedded:false;nativeUVTrimsEmbedded:false;
 editableTopologyEmbedded:false;stlWatertightnessCertified:false;stlManifoldCertified:false;
 stlEmbeddedSolidCertified:false;globalApproximationErrorCertified:false;manufacturingToleranceCertified:false;
 rendererAcceptance:false;loaderAcceptance:false;fileWrittenByAPI:false;fileReadByAPI:false;
 publication:false;ownership:'independent-copied-cpu-data-gc'};
 fileSizes:{request:Size;result:Size};ownValues:number;limits:Limits;
 workScope:'one-full-mesh-validation-and-new-binary-encoding-with-inherited-work-separated';
 budgetFailure:'atomic-no-partial-binary-stl';
}
export interface QualifiedTranslatedStripBodyBinaryStlResult {request:Request;bytes:number[];report:QualifiedTranslatedStripBodyBinaryStlReport}
type Code='INPUT'|'IDENTITY'|'MESH'|'BINDING'|'REPRESENTABILITY'|'COLLAPSE'|'NORMAL'|'BUDGET'|'FILE'|'OWNED';
type Context={phase:'input'|'mesh'|'loss'|'facet'|'encoding'|'file'|'owned';vertexIndex:number|null;triangleIndex:number|null;directCounts:Counts};

export const QualifiedTranslatedStripBodyBinaryStlDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', MESH: 'MESH', BINDING: 'BINDING',
  REPRESENTABILITY: 'REPRESENTABILITY', COLLAPSE: 'COLLAPSE', NORMAL: 'NORMAL',
  BUDGET: 'BUDGET', FILE: 'FILE', OWNED: 'OWNED',
} as const);
export type QualifiedTranslatedStripBodyBinaryStlDiagnosticCode = Code;
export class QualifiedTranslatedStripBodyBinaryStlError extends Error {
  readonly code: Code;
  readonly context: Context;
  constructor(code: Code, detail: string, context: Context, cause?: unknown) {
    super(('Qualified translated-strip Body binary STL: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'QualifiedTranslatedStripBodyBinaryStlError';
    this.code = code;
    this.context = { ...context, directCounts: { ...context.directCounts } };
  }
}
const limits: Limits = {
  maximumVertices: 290, maximumTriangles: 576, maximumBinaryBytes: 28884,
  requestBytes: 4194304, resultBytes: 8388608, ownValues: 4194304, ownDepth: 64,
  arrayElements: 8192, byteArrayElements: 28884, recordFields: 64,
  keyCharacters: 128, stringCharacters: 262144, identifierCharacters: 48,
  rationalOperations: 200000, gcdSteps: 200000, rationalIntegerBits: 8192,
  fractionIntegerCharacters: 5000, maximumRationalFloatConversions: 0,
  normalUnitResidual: 1e-5, maximumSettlePasses: 8,
};
function counts(): Counts {
  return { meshValidationCount: 0, vertexCount: 0, coordinateFloat32RoundCount: 0,
    triangleCount: 0, normalFloat32RoundCount: 0, exactCrossCount: 0,
    normalAlignmentCount: 0, encodedFloat32Count: 0, encodedAttributeCount: 0,
    encodedByteCount: 0, curveD0Count: 0, curveD1Count: 0, surfaceD0Count: 0,
    surfaceD1Count: 0, sourceCompilationCount: 0, rootSolveCount: 0,
    rationalFloatConversionCount: 0, fileWriteCount: 0, fileReadCount: 0 };
}
type Fail = (code: Code, detail: string, cause?: unknown) => never;
function requireCondition(condition: boolean, fail: Fail, code: Code, detail: string): asserts condition {
  if (!condition) fail(code, detail);
}
/** Copy bounded plain data without invoking user getters. Only root.bytes has the larger cap. */
function snapshot(input: unknown, fail: Fail, owned = false): { value: unknown; ownValues: number } {
  let ownValues = 0;
  const ancestors = new Set<object>();
  const code = owned ? 'OWNED' : 'INPUT';
  const budget = owned ? 'OWNED' : 'BUDGET';
  const copy = (value: unknown, depth: number, binaryBytes = false): unknown => {
    requireCondition(++ownValues <= limits.ownValues && depth <= limits.ownDepth, fail, budget,
      'Complete own value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      requireCondition(Number.isFinite(value), fail, code, 'Finite represented own numbers required');
      return value;
    }
    if (typeof value === 'string') {
      requireCondition(value.length <= limits.stringCharacters, fail, budget, 'Own string budget exceeded');
      return value;
    }
    requireCondition(typeof value === 'object' && value !== null && !ancestors.has(value), fail, code,
      'Acyclic plain own data required');
    const object = value as object;
    const array = Array.isArray(object), prototype = Object.getPrototypeOf(object);
    requireCondition(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      fail, code, 'Plain own-data prototypes required');
    const keys = Reflect.ownKeys(object), descriptors = Object.getOwnPropertyDescriptors(object);
    const arrayCap = binaryBytes ? limits.byteArrayElements : limits.arrayElements;
    requireCondition(keys.length <= (array ? arrayCap + 1 : limits.recordFields) &&
      keys.every(key => typeof key === 'string' && key.length <= limits.keyCharacters &&
        'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)),
    fail, code, 'Bounded own data fields without getters, symbols or hidden values required');
    ancestors.add(object);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      requireCondition(Number.isInteger(length) && length >= 0 && length <= arrayCap && keys.length === length + 1,
        fail, code, 'Dense bounded arrays required');
      result = Array.from({ length }, (_, index) => {
        const descriptor = descriptors[String(index)];
        requireCondition(descriptor !== undefined, fail, code, 'Sparse or extra array fields refused');
        const item = descriptor.value;
        if (binaryBytes) requireCondition(typeof item === 'number' && Number.isInteger(item) &&
          item >= 0 && item <= 255 && !Object.is(item, -0), fail, code, 'Exact uint8 bytes without negative zero required');
        return copy(item, depth + 1);
      });
    } else {
      result = Object.fromEntries((keys as string[]).map(key =>
        [key, copy(descriptors[key].value, depth + 1, depth === 0 && key === 'bytes')]));
    }
    ancestors.delete(object);
    return result;
  };
  try { return { value: copy(input, 0), ownValues }; }
  catch (cause) {
    if (cause instanceof QualifiedTranslatedStripBodyBinaryStlError) throw cause;
    return fail(code, 'Own binary STL snapshot refused', cause);
  }
}
function record(value: unknown, fields: string[], fail: Fail, code: Code): Record<string, unknown> {
  requireCondition(value !== null && typeof value === 'object' && !Array.isArray(value), fail, code,
    'Exact own record required');
  const result = value as Record<string, unknown>;
  requireCondition(Object.keys(result).length === fields.length && fields.every(field => Object.hasOwn(result, field)),
    fail, code, 'Exact frozen own fields required');
  return result;
}
/** Complete canonical JSON accounting, including -0 and the final newline. */
function fileSize(input: unknown, cap: number, fail: Fail): Size {
  let utf16 = 0, utf8 = 0;
  const encoder = new TextEncoder();
  const append = (text: string): void => {
    utf16 += text.length; utf8 += encoder.encode(text).length;
    requireCondition(utf16 <= cap && utf8 <= cap, fail, 'FILE', 'Complete canonical JSON size budget exceeded');
  };
  const visit = (value: unknown): void => {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') { append(JSON.stringify(value)); return; }
    if (typeof value === 'number') { append(Object.is(value, -0) ? '-0' : JSON.stringify(value)); return; }
    if (Array.isArray(value)) {
      append('['); value.forEach((item, index) => { if (index) append(','); visit(item); }); append(']'); return;
    }
    append('{'); Object.entries(value as Record<string, unknown>).forEach(([key, item], index) => {
      if (index) append(','); append(JSON.stringify(key)); append(':'); visit(item);
    }); append('}');
  };
  visit(input); append('\n'); return { utf16, utf8 };
}

/** Validate the whole qualified native mesh once, then encode its original indexed triangles. */
export function exportQualifiedTranslatedStripBodyBinaryStl(
  mesh: Mesh, options: QualifiedTranslatedStripBodyBinaryStlOptions,
): QualifiedTranslatedStripBodyBinaryStlResult {
  const directCounts = counts();
  const context: Context = { phase: 'input', vertexIndex: null, triangleIndex: null, directCounts };
  const fail: Fail = (code, detail, cause) => { throw new QualifiedTranslatedStripBodyBinaryStlError(code, detail, context, cause); };
  const request = snapshot({ mesh, options }, fail).value as Request;
  const parsed = record(request.options, ['evaluationId', 'maximumVertices', 'maximumTriangles', 'maximumBytes'], fail, 'INPUT');
  requireCondition(typeof parsed.evaluationId === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(parsed.evaluationId) &&
    parsed.evaluationId.length <= limits.identifierCharacters, fail, 'IDENTITY', 'ASCII evaluation identifier1..48 required');
  requireCondition(parsed.maximumVertices === 290 && parsed.maximumTriangles === 576 && parsed.maximumBytes === 28884,
    fail, 'INPUT', 'Frozen vertex, triangle and binary byte caps required');
  const requestSize = fileSize(request, limits.requestBytes, fail);
  context.phase = 'mesh';
  let inheritedMeshReport: Mesh['report'];
  try {
    directCounts.meshValidationCount++;
    inheritedMeshReport = validateQualifiedTranslatedStripBodyMesh(request.mesh);
  } catch (cause) { return fail('MESH', 'Whole qualified mesh validation refused', cause); }
  snapshot(request, fail);
  fileSize(request, limits.requestBytes, fail);
  const packet = request.mesh.packet;
  requireCondition(packet.schema === 'barocss-qualified-translated-strip-body-mesh' && packet.version === 0 &&
    packet.positionEncoding === 'binary64-number' && packet.indexEncoding === 'uint32-number' &&
    packet.lengthUnit === 'mm' && packet.sourceFrame === 'authored-xyz-no-axis-conversion',
  fail, 'BINDING', 'Only the frozen validated version0 whole mesh is supported');
  const q = new Q((code, detail) => fail(code, detail));
  const encoding = encodeQualifiedStripBinaryStlTrusted(packet, q, directCounts, {
    beginVertex(index) { context.phase = 'loss'; context.vertexIndex = index; context.triangleIndex = null; },
    beginTriangle(index) { context.phase = 'facet'; context.vertexIndex = null; context.triangleIndex = index; },
    beginEncoding() { context.phase = 'encoding'; context.vertexIndex = null; context.triangleIndex = null; },
    retainPhase(data) {
      const prefix = { request, vertexLosses: data.vertexLosses, facets: data.facets, bytes: data.bytes };
      snapshot(prefix, fail);
      fileSize(prefix, limits.resultBytes, fail);
    },
    fail,
  });
  const report: QualifiedTranslatedStripBodyBinaryStlReport = {
    schema: 'barocss-qualified-translated-strip-body-binary-stl', version: 0,
    evaluationId: request.options.evaluationId, meshId: packet.meshId, bodyId: packet.bodyId,
    shellId: packet.shellId, materialCertificateId: packet.materialCertificateId,
    vertexCount: packet.vertices.length, triangleCount: packet.triangles.length,
    byteLength: encoding.bytes.length, headerASCII: 'BaroCSS binary STL | mm convention | approximate facets',
    format: 'binary-stl', byteOrder: 'little-endian', lengthUnit: 'mm',
    unitSource: 'caller-convention-not-stl-metadata', sourceFrame: 'authored-xyz-no-axis-conversion',
    positionEncoding: 'float32', byteEncoding: 'dense-uint8-number-array', attributePolicy: 'zero-no-colors',
    normalSource: 'approximate-quantized-triangle-geometry', vertexLosses: encoding.vertexLosses,
    facets: encoding.facets, maximumSquaredDisplacementMM2: encoding.maximumSquaredDisplacementMM2,
    maximumMeasuredDisplacementMM: encoding.maximumMeasuredDisplacementMM, directCounts: { ...directCounts },
    inheritedMeshReport, rationalCounts: q.counts(),
    numericPolicy: { source: 'whole-validated-binary64-packet-positions', coordinates: 'Math.fround-no-transform',
      loss: 'exact-rational-components-and-squared-distance-plus-measured-hypot',
      collapse: 'exact-zero-cross-after-float32-quantization', normal: 'approximate-unit-float32-with-exact-positive-cross-dot',
      originalTriangleOrderPreserved: true, originalIndexedVertexMappingRetained: true, nativeKernelQueries: false,
      resampling: false, rescaling: false, welding: false, snapPerformed: false, rootRationalFloatConversion: false },
    quality: { wholeNativeMeshValidated: true, originalMeshRetained: true, parentFlagsUnchanged: true,
      allOriginalVerticesCompared: true, float32LossMeasured: true, exactQuantizedCollapseChecked: true,
      serializationCertified: true, approximateFacets: true, approximateNormals: true,
      nativeIdentityEmbedded: false, nativeUnitsMetadataEmbedded: false, nativeUVTrimsEmbedded: false,
      editableTopologyEmbedded: false, stlWatertightnessCertified: false, stlManifoldCertified: false,
      stlEmbeddedSolidCertified: false, globalApproximationErrorCertified: false, manufacturingToleranceCertified: false,
      rendererAcceptance: false, loaderAcceptance: false, fileWrittenByAPI: false, fileReadByAPI: false,
      publication: false, ownership: 'independent-copied-cpu-data-gc' },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, ownValues: 0, limits: { ...limits },
    workScope: 'one-full-mesh-validation-and-new-binary-encoding-with-inherited-work-separated',
    budgetFailure: 'atomic-no-partial-binary-stl',
  };
  const result: QualifiedTranslatedStripBodyBinaryStlResult = { request, bytes: encoding.bytes, report };
  context.phase = 'file';
  report.ownValues = snapshot(result, fail).ownValues;
  for (let pass = 0; pass < limits.maximumSettlePasses; pass++) {
    const measured = fileSize(result, limits.resultBytes, fail);
    if (same(measured, report.fileSizes.result)) return snapshot(result, fail).value as QualifiedTranslatedStripBodyBinaryStlResult;
    report.fileSizes.result = measured;
  }
  return fail('FILE', 'Complete result file sizes did not settle within eight passes');
}

/** Rebuild once and bit-compare the complete owned result, returning an independent copied report. */
export function validateQualifiedTranslatedStripBodyBinaryStl(input: unknown): QualifiedTranslatedStripBodyBinaryStlReport {
  const context: Context = { phase: 'owned', vertexIndex: null, triangleIndex: null, directCounts: counts() };
  const fail: Fail = (code, detail, cause) => { throw new QualifiedTranslatedStripBodyBinaryStlError(code, detail, context, cause); };
  const value = snapshot(input, fail, true).value;
  const result = record(value, ['request', 'bytes', 'report'], fail, 'OWNED');
  const request = record(result.request, ['mesh', 'options'], fail, 'OWNED');
  fileSize(value, limits.resultBytes, fail);
  let rebuilt: QualifiedTranslatedStripBodyBinaryStlResult;
  try { rebuilt = exportQualifiedTranslatedStripBodyBinaryStl(request.mesh as Mesh, request.options as QualifiedTranslatedStripBodyBinaryStlOptions); }
  catch (cause) { return fail('OWNED', 'Owned whole mesh and binary STL reconstruction refused', cause); }
  context.directCounts = { ...rebuilt.report.directCounts };
  requireCondition(same(value, rebuilt), fail, 'OWNED', 'Every owned byte, field, source and receipt must match reconstruction');
  return snapshot(rebuilt.report, fail, true).value as QualifiedTranslatedStripBodyBinaryStlReport;
}
