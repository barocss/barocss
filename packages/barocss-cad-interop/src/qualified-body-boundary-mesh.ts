import { validateQualifiedTranslatedStripBodyMesh } from '@barocss/cad';
import type { Point, QualifiedTranslatedStripBodyMeshResult, QualifiedTranslatedStripBodyMeshReport } from '@barocss/cad';
import { BaroCadQualifiedBodyBoundaryMeshReadError, QUALIFIED_BODY_BOUNDARY_MESH_LIMITS, parseQualifiedBodyBoundaryMeshJson, copyQualifiedBodyBoundaryMeshOwnData } from './qualified-body-boundary-mesh-json.js';
export { BaroCadQualifiedBodyBoundaryMeshReadError, BaroCadQualifiedBodyBoundaryMeshDiagnosticCode } from './qualified-body-boundary-mesh-json.js';

export interface BaroCadQualifiedBodyBoundaryMeshOptions { unitsPerMillimeter: 0.001 }
export type BaroCadQualifiedBodyBoundaryMeshProjectionDiagnosticCode = 'SCALE' | 'FLOAT32' | 'ASSOCIATION' | 'TRIANGLE';
export class BaroCadQualifiedBodyBoundaryMeshProjectionError extends Error {
  readonly code: BaroCadQualifiedBodyBoundaryMeshProjectionDiagnosticCode;
  readonly path: string;
  constructor(code: BaroCadQualifiedBodyBoundaryMeshProjectionDiagnosticCode, path: string, message: string) {
    super((message + ' at ' + path).slice(0, 1024));
    this.name = 'BaroCadQualifiedBodyBoundaryMeshProjectionError'; this.code = code; this.path = path.slice(0, 1024);
  }
}

type NativeFace = QualifiedTranslatedStripBodyMeshResult['body']['faces'][number];
export interface BaroCadQualifiedBodyBoundaryMeshConversionMeasurements {
  extraScaleUploadGapsMM: number[];
  totalDisplayToAuthorityGapsMM: number[];
  normalUploadGaps: number[];
  maximumNativeQuantizationGapMM: number;
  maximumExtraScaleUploadGapMM: number;
  maximumTotalDisplayToAuthorityGapMM: number;
  maximumNormalUploadGap: number;
  triangleMeasurements: { triangleIndex: number; localIndices: number[]; doubledAreaRendererUnitsSquared: number; normalDots: number[]; outwardRoleAgreement: true }[];
  scope: string;
}
export interface BaroCadQualifiedBodyBoundaryMeshChunk {
  faceId: string; role: NativeFace['role']; orientation: NativeFace['orientation']; supportRef: NativeFace['supportRef'];
  positions: Float32Array; normals: Float32Array; nativeUV: Float64Array; indices: Uint32Array;
  authorityIndices: Uint32Array; faceSampleIndices: Uint32Array; triangleIndices: Uint32Array;
  nativeQuantizationGapsMM: Float64Array;
  conversionMeasurements: BaroCadQualifiedBodyBoundaryMeshConversionMeasurements;
  metadata: { lengthUnit: 'renderer-units'; nativeLengthUnit: 'mm'; unitsPerMillimeter: 0.001; sourceFrame: 'authored-xyz-no-axis-conversion'; uvLengthUnit: 'dimensionless'; uvEncoding: 'binary64-number'; normalSource: 'approximate-triangle-geometry'; approximation: 'native-facets-with-additional-scale-upload-measurements'; globalErrorCertified: false };
}
export interface BaroCadQualifiedBodyBoundaryMeshProjection {
  unitsPerMillimeter: 0.001;
  chunks: BaroCadQualifiedBodyBoundaryMeshChunk[];
  measurements: {
    maximumNativeQuantizationGapMM: number; maximumExtraScaleUploadGapMM: number; maximumTotalDisplayToAuthorityGapMM: number; maximumNormalUploadGap: number;
    retainedNativeD1StateCounts: { evaluated: number; refusedC0: number };
    projectedFaceCount: number; projectedVertexCount: number; projectedTriangleCount: number;
    providerCalls: 0; nativeD1Calls: 0; weldingPerformed: false; resamplingPerformed: false;
    globalErrorCertified: false; geometricEmbeddingCertified: false; newSolidCertified: false;
  };
}
const PROFILE = Object.freeze({
  schema: 'barocss-qualified-body-boundary-mesh-ingestion', version: 0,
  nativePacketSchema: 'barocss-qualified-translated-strip-body-mesh', nativeReportSchema: 'barocss-qualified-translated-strip-body-mesh-report', nativeVersion: 0,
  unitsPerMillimeter: 0.001, sourceFrame: 'authored-xyz-no-axis-conversion', lengthUnit: 'mm', uvLengthUnit: 'dimensionless',
  normalSource: 'approximate-triangle-geometry', ownership: 'independent-copied-cpu-data-gc', limits: QUALIFIED_BODY_BOUNDARY_MESH_LIMITS,
  capabilities: Object.freeze({ nativeQualifiedMesh: true, rendererNeutralProjection: true, renderer: false, url: false, byteInput: false, publicSerializer: false, dispose: false, genericSolid: false, boolean: false, globalError: false, meshEmbedding: false, newSolid: false, manufacturing: false, exchange: false, publication: false } as const),
} as const);
export interface BaroCadQualifiedBodyBoundaryMeshRead {
  native: QualifiedTranslatedStripBodyMeshResult;
  validationReport: QualifiedTranslatedStripBodyMeshReport;
  profile: typeof PROFILE;
  sourceText: string | null;
  projection: BaroCadQualifiedBodyBoundaryMeshProjection;
}

/** Private projection of an already whole-validated native mesh. No provider calls. */
function check(condition: unknown, code: BaroCadQualifiedBodyBoundaryMeshProjectionDiagnosticCode, path: string, message: string): asserts condition {
  if (condition) return;
  throw new BaroCadQualifiedBodyBoundaryMeshProjectionError(code, path, message);
}
function same(a: unknown, b: unknown): boolean {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return Object.is(a, b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const first = a as Record<string, unknown>, second = b as Record<string, unknown>;
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every(key => Object.hasOwn(second, key) && same(first[key], second[key]));
}
function finite(value: number, path: string): number {
  check(typeof value === 'number' && Number.isFinite(value), 'FLOAT32', path, 'Finite represented component required');
  return value;
}
function index(value: number, count: number, path: string): number {
  check(Number.isInteger(value) && value >= 0 && value < count && value <= 0xffffffff, 'ASSOCIATION', path, 'Valid original index required');
  return value;
}
function point(array: ArrayLike<number>, offset: number, path: string): Point { return [0, 1, 2].map(axis => finite(array[offset + axis], path + '[' + axis + ']')) as Point; }
function difference(a: Point, b: Point, path: string): Point { return a.map((value, axis) => finite(value - b[axis], path + '[' + axis + ']')) as Point; }
function norm(vector: Point, path: string): number { return finite(Math.hypot(...vector), path); }
function gap(a: Point, b: Point, path: string): number { return norm(difference(a, b, path), path); }
function cross(a: Point, b: Point, c: Point, path: string): Point {
  const ab = difference(b, a, path + '.ab'), ac = difference(c, a, path + '.ac');
  return [finite(ab[1] * ac[2] - ab[2] * ac[1], path + '.x'), finite(ab[2] * ac[0] - ab[0] * ac[2], path + '.y'), finite(ab[0] * ac[1] - ab[1] * ac[0], path + '.z')];
}
function dot(a: Point, b: Point, path: string): number { return finite(a.reduce((sum, value, axis) => sum + value * b[axis], 0), path); }
function maximum(values: ArrayLike<number>): number { return Array.from(values).reduce((result, value) => Math.max(result, value), 0); }

/**
 * Retain the full native certificate beside six independently owned upload chunks.
 * Input must already be descriptor-safe data admitted by Lane A's whole validator.
 * No resampling, swizzle, winding reversal, welding or native metadata mutation.
 */
function projectMesh(native: QualifiedTranslatedStripBodyMeshResult, unitsPerMillimeter: 0.001): BaroCadQualifiedBodyBoundaryMeshProjection {
  check(typeof unitsPerMillimeter === 'number' && Number.isFinite(unitsPerMillimeter) && unitsPerMillimeter > 0,
    'SCALE', '$.unitsPerMillimeter', 'Finite positive renderer units per millimeter required');
  const fields = ['body', 'options', 'packet', 'edgePaths', 'faceSamples', 'renderChunks', 'proof', 'report'];
  check(native && typeof native === 'object' && Object.keys(native).length === fields.length && fields.every(key => Object.hasOwn(native, key)),
    'ASSOCIATION', '$', 'Complete eight-field native mesh required');
  check(native.packet.schema === 'barocss-qualified-translated-strip-body-mesh' && native.packet.version === 0 &&
    native.report.schema === 'barocss-qualified-translated-strip-body-mesh-report' && native.report.version === 0,
    'ASSOCIATION', '$.packet/report', 'Actual native mesh packet and report schema/version required');
  const { packet, body, faceSamples, renderChunks, proof, report } = native;
  check(body.faces.length === 6 && renderChunks.length === 6 && proof.faceRanges.length === 6,
    'ASSOCIATION', '$.renderChunks', 'All six native Face chunks required');
  check(packet.positionsMM.length === packet.vertices.length * 3 && packet.indices.length === packet.triangles.length * 3,
    'ASSOCIATION', '$.packet', 'Complete shared authority ranks required');
  check(new Set(body.faces.map(face => face.id)).size === 6 && new Set(renderChunks.map(chunk => chunk.faceId)).size === 6,
    'ASSOCIATION', '$.renderChunks', 'Six distinct actual Face IDs required');
  for (const [i, vertex] of packet.vertices.entries()) {
    check(vertex.index === i && same(vertex.point, point(packet.positionsMM, i * 3, '$.packet.positionsMM')),
      'ASSOCIATION', '$.packet.vertices[' + i + ']', 'Shared binary64 authority vertex correspondence required');
  }
  const d1StateCounts = { evaluated: 0, refusedC0: 0 };
  for (const [i, sample] of faceSamples.entries()) {
    check(sample.index === i && body.faces.some(face => face.id === sample.faceId && face.role === sample.role && same(face.supportRef, sample.supportRef)),
      'ASSOCIATION', '$.faceSamples[' + i + ']', 'Original Face sample qualification required');
    const vertex = packet.vertices[index(sample.vertexIndex, packet.vertices.length, '$.faceSamples[' + i + '].vertexIndex')];
    check(same(sample.anchorPoint, vertex.point), 'ASSOCIATION', '$.faceSamples[' + i + '].anchorPoint', 'Actual sample must retain shared authority anchor');
    if (sample.d1.status === 'evaluated') d1StateCounts.evaluated++;
    else {
      check(sample.d1.status === 'refused-c0' && (['point', 'du', 'dv', 'orientedNormal', 'pointGapMM'] as const).every(key => sample.d1[key] === null),
        'ASSOCIATION', '$.faceSamples[' + i + '].d1', 'Native C0 refusal union/nulls must remain unchanged');
      d1StateCounts.refusedC0++;
    }
  }
  check(d1StateCounts.evaluated === report.nativeNormalEvaluatedCount && d1StateCounts.refusedC0 === report.nativeNormalRefusedCount,
    'ASSOCIATION', '$.report', 'Retained native D1 state counts must agree with whole report');

  const chunks: BaroCadQualifiedBodyBoundaryMeshChunk[] = renderChunks.map((chunk, chunkIndex): BaroCadQualifiedBodyBoundaryMeshChunk => {
    const path = '$.renderChunks[' + chunkIndex + ']';
    const face = body.faces[chunkIndex], faceRange = proof.faceRanges[chunkIndex];
    check(chunk.faceId === face.id && chunk.role === face.role && chunk.orientation === face.orientation &&
      faceRange.faceId === face.id && faceRange.role === face.role && faceRange.orientation === face.orientation && same(faceRange.supportRef, face.supportRef),
      'ASSOCIATION', path, 'Original Face order, orientation and support qualification required');
    check(chunk.normalSource === 'approximate-triangle-geometry' && chunk.positionEncoding === 'float32-number' &&
      chunk.normalEncoding === 'float32-number' && chunk.uvEncoding === 'binary64-number' && chunk.indexEncoding === 'uint32-number',
      'ASSOCIATION', path, 'Actual native chunk encodings required');
    const count = chunk.authorityIndices.length;
    check(count > 0 && count % 3 === 0 && chunk.positionsMM.length === count * 3 && chunk.normals.length === count * 3 &&
      chunk.parametersUV.length === count * 2 && chunk.indices.length === count && chunk.faceSampleIndices.length === count &&
      chunk.quantizationGapsMM.length === count && chunk.triangleIndices.length === count / 3,
      'ASSOCIATION', path, 'Faithful corner and triangle ranks required');
    const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
    const nativeUV = new Float64Array(count * 2), indices = new Uint32Array(count);
    const extraScaleUploadGapsMM: number[] = [], totalDisplayToAuthorityGapsMM: number[] = [], normalUploadGaps: number[] = [];
    for (let corner = 0; corner < count; corner++) {
      const cornerPath = path + '.corner[' + corner + ']';
      const authorityIndex = index(chunk.authorityIndices[corner], packet.vertices.length, cornerPath + '.authorityIndex');
      const sampleIndex = index(chunk.faceSampleIndices[corner], faceSamples.length, cornerPath + '.faceSampleIndex');
      const sample = faceSamples[sampleIndex], sourcePoint = point(chunk.positionsMM, corner * 3, cornerPath + '.positionsMM');
      const sourceNormal = point(chunk.normals, corner * 3, cornerPath + '.normal');
      const authorityPoint = point(packet.positionsMM, authorityIndex * 3, cornerPath + '.authority');
      check(sample.faceId === face.id && sample.role === face.role && sample.vertexIndex === authorityIndex && same(sample.supportRef, face.supportRef),
        'ASSOCIATION', cornerPath, 'Actual original Face/sample/authority association required');
      check(same(sample.uv, chunk.parametersUV.slice(corner * 2, corner * 2 + 2)),
        'ASSOCIATION', cornerPath + '.nativeUV', 'Both original binary64 native UV bits required');
      for (let axis = 0; axis < 3; axis++) {
        check(Object.is(sourcePoint[axis], Math.fround(sourcePoint[axis])) && Object.is(sourceNormal[axis], Math.fround(sourceNormal[axis])),
          'ASSOCIATION', cornerPath, 'Native positions/normals must retain their original Float32-number bits');
        const scaled = finite(sourcePoint[axis] * unitsPerMillimeter, cornerPath + '.scaled[' + axis + ']');
        const uploaded = finite(Math.fround(scaled), cornerPath + '.uploaded[' + axis + ']');
        check(!(sourcePoint[axis] !== 0 && scaled === 0) && !(scaled !== 0 && uploaded === 0),
          'FLOAT32', cornerPath + '.uploaded[' + axis + ']', 'Nonzero position must not underflow during scale/upload');
        positions[corner * 3 + axis] = uploaded;
        normals[corner * 3 + axis] = sourceNormal[axis];
        check(Object.is(normals[corner * 3 + axis], sourceNormal[axis]), 'FLOAT32', cornerPath + '.normal', 'Facet normal upload must preserve bits');
      }
      for (let axis = 0; axis < 2; axis++) {
        nativeUV[corner * 2 + axis] = finite(sample.uv[axis], cornerPath + '.nativeUV[' + axis + ']');
        check(Object.is(nativeUV[corner * 2 + axis], sample.uv[axis]), 'ASSOCIATION', cornerPath + '.nativeUV', 'Float64 native UV must preserve bits');
      }
      const localIndex = index(chunk.indices[corner], count, cornerPath + '.localIndex');
      indices[corner] = localIndex;
      check(Object.is(indices[corner], chunk.indices[corner]), 'ASSOCIATION', cornerPath + '.localIndex', 'UInt32 index must equal its original local value');
      const nativeGap = gap(authorityPoint, sourcePoint, cornerPath + '.nativeQuantizationGapMM');
      check(Object.is(nativeGap, chunk.quantizationGapsMM[corner]), 'ASSOCIATION', cornerPath, 'Native quantization gap must match its actual authority association');
      const roundTripMM = point(positions, corner * 3, cornerPath + '.uploaded').map((value, axis) => finite(value / unitsPerMillimeter, cornerPath + '.roundTripMM[' + axis + ']')) as Point;
      extraScaleUploadGapsMM.push(gap(roundTripMM, sourcePoint, cornerPath + '.extraScaleUploadGapMM'));
      totalDisplayToAuthorityGapsMM.push(gap(roundTripMM, authorityPoint, cornerPath + '.totalDisplayToAuthorityGapMM'));
      normalUploadGaps.push(gap(point(normals, corner * 3, cornerPath + '.uploadedNormal'), sourceNormal, cornerPath + '.normalUploadGap'));
    }
    const triangleMeasurements: BaroCadQualifiedBodyBoundaryMeshConversionMeasurements['triangleMeasurements'] = [];
    for (let t = 0; t < chunk.triangleIndices.length; t++) {
      const triangleIndex = index(chunk.triangleIndices[t], packet.triangles.length, path + '.triangleIndices[' + t + ']');
      const triangle = packet.triangles[triangleIndex], locals = Array.from(indices.subarray(t * 3, t * 3 + 3));
      check(triangle.index === triangleIndex && triangle.faceId === face.id && triangle.role === face.role && new Set(locals).size === 3,
        'ASSOCIATION', path + '.triangle[' + t + ']', 'Actual original triangle and three local corners required');
      for (let k = 0; k < 3; k++) {
        check(chunk.authorityIndices[locals[k]] === triangle.vertexIndices[k] && chunk.faceSampleIndices[locals[k]] === triangle.faceSampleIndices[k] &&
          packet.indices[triangleIndex * 3 + k] === triangle.vertexIndices[k],
          'ASSOCIATION', path + '.triangle[' + t + ']', 'Local index must resolve unchanged triangle authority/Face sample order');
      }
      const uploadedPoints = locals.map(i => point(positions, i * 3, path + '.triangle[' + t + '].position'));
      const uploadCross = cross(uploadedPoints[0], uploadedPoints[1], uploadedPoints[2], path + '.triangle[' + t + '].cross');
      const doubledArea = norm(uploadCross, path + '.triangle[' + t + '].doubledArea');
      check(doubledArea > 0, 'TRIANGLE', path + '.triangle[' + t + ']', 'Uploaded triangle must remain noncollapsed');
      const normalDots = locals.map(i => dot(uploadCross, point(normals, i * 3, path + '.normal'), path + '.triangle[' + t + '].normalDot'));
      check(normalDots.every(value => value > 0), 'TRIANGLE', path + '.triangle[' + t + ']', 'Uploaded winding must agree with all unchanged facet normals');
      const principal = face.role === 'lower' ? -uploadCross[1] : face.role === 'upper' ? uploadCross[1] : face.role === 'base' ? -uploadCross[2] : face.role === 'uMin' ? -uploadCross[0] : face.role === 'uMax' ? uploadCross[0] : null;
      if (principal !== null) check(principal > 0, 'TRIANGLE', path + '.triangle[' + t + ']', 'Actual native outward Face role must retain winding');
      else {
        check(face.role === 'cap', 'ASSOCIATION', path + '.role', 'Known native cap Face role required');
        const evaluated = triangle.faceSampleIndices.map(i => faceSamples[i].d1).find(d1 => d1.status === 'evaluated');
        check(evaluated !== undefined && evaluated.status === 'evaluated', 'TRIANGLE', path + '.triangle[' + t + ']', 'Actual cap evaluated native normal required');
        check(dot(uploadCross, evaluated.orientedNormal, path + '.triangle[' + t + '].nativeNormalDot') > 0,
          'TRIANGLE', path + '.triangle[' + t + ']', 'Actual cap winding must agree with retained native oriented normal');
      }
      triangleMeasurements.push({ triangleIndex, localIndices: locals, doubledAreaRendererUnitsSquared: doubledArea, normalDots, outwardRoleAgreement: true });
    }
    const conversionMeasurements: BaroCadQualifiedBodyBoundaryMeshConversionMeasurements = {
      extraScaleUploadGapsMM, totalDisplayToAuthorityGapsMM, normalUploadGaps,
      maximumNativeQuantizationGapMM: maximum(chunk.quantizationGapsMM),
      maximumExtraScaleUploadGapMM: maximum(extraScaleUploadGapsMM),
      maximumTotalDisplayToAuthorityGapMM: maximum(totalDisplayToAuthorityGapsMM),
      maximumNormalUploadGap: maximum(normalUploadGaps),
      triangleMeasurements,
      scope: 'Observed stored corners and uploaded triangles only; separate gaps, no summed or global error bound',
    };
    return {
      faceId: face.id, role: face.role, orientation: face.orientation, supportRef: structuredClone(face.supportRef),
      positions, normals, nativeUV, indices,
      authorityIndices: new Uint32Array(chunk.authorityIndices), faceSampleIndices: new Uint32Array(chunk.faceSampleIndices), triangleIndices: new Uint32Array(chunk.triangleIndices),
      nativeQuantizationGapsMM: new Float64Array(chunk.quantizationGapsMM),
      conversionMeasurements,
      metadata: { lengthUnit: 'renderer-units', nativeLengthUnit: 'mm', unitsPerMillimeter, sourceFrame: 'authored-xyz-no-axis-conversion', uvLengthUnit: 'dimensionless', uvEncoding: 'binary64-number', normalSource: chunk.normalSource, approximation: 'native-facets-with-additional-scale-upload-measurements', globalErrorCertified: false },
    };
  });
  check(chunks.reduce((sum, chunk) => sum + chunk.indices.length, 0) === packet.indices.length &&
    chunks.reduce((sum, chunk) => sum + chunk.triangleIndices.length, 0) === packet.triangles.length,
    'ASSOCIATION', '$.chunks', 'All native triangles must occur in six unchanged Face chunks');
  return {
    unitsPerMillimeter, chunks,
    measurements: {
      maximumNativeQuantizationGapMM: maximum(chunks.map(chunk => chunk.conversionMeasurements.maximumNativeQuantizationGapMM)),
      maximumExtraScaleUploadGapMM: maximum(chunks.map(chunk => chunk.conversionMeasurements.maximumExtraScaleUploadGapMM)),
      maximumTotalDisplayToAuthorityGapMM: maximum(chunks.map(chunk => chunk.conversionMeasurements.maximumTotalDisplayToAuthorityGapMM)),
      maximumNormalUploadGap: maximum(chunks.map(chunk => chunk.conversionMeasurements.maximumNormalUploadGap)),
      retainedNativeD1StateCounts: d1StateCounts,
      projectedFaceCount: chunks.length, projectedVertexCount: chunks.reduce((sum, chunk) => sum + chunk.positions.length / 3, 0),
      projectedTriangleCount: chunks.reduce((sum, chunk) => sum + chunk.indices.length / 3, 0),
      providerCalls: 0, nativeD1Calls: 0, weldingPerformed: false, resamplingPerformed: false,
      globalErrorCertified: false, geometricEmbeddingCertified: false, newSolidCertified: false,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function optionsSnapshot(input: BaroCadQualifiedBodyBoundaryMeshOptions): BaroCadQualifiedBodyBoundaryMeshOptions {
  if (!isRecord(input)) throw new BaroCadQualifiedBodyBoundaryMeshReadError('INPUT', 'Explicit boundary mesh options must be a record');
  const copied = copyQualifiedBodyBoundaryMeshOwnData(input).value;
  if (!isRecord(copied) || Object.keys(copied).length !== 1 || !Object.hasOwn(copied, 'unitsPerMillimeter') || copied.unitsPerMillimeter !== 0.001) {
    throw new BaroCadQualifiedBodyBoundaryMeshReadError('INPUT', 'Boundary mesh options require only unitsPerMillimeter 0.001');
  }
  return { unitsPerMillimeter: 0.001 };
}
function requireNativeSchema(value: unknown): asserts value is QualifiedTranslatedStripBodyMeshResult {
  const fields = ['body', 'options', 'packet', 'edgePaths', 'faceSamples', 'renderChunks', 'proof', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length || !fields.every(field => Object.hasOwn(value, field)) ||
      !isRecord(value.packet) || !isRecord(value.report) || value.packet.schema !== PROFILE.nativePacketSchema || value.report.schema !== PROFILE.nativeReportSchema ||
      value.packet.version !== PROFILE.nativeVersion || value.report.version !== PROFILE.nativeVersion) {
    throw new BaroCadQualifiedBodyBoundaryMeshReadError('SCHEMA', 'A complete eight-field boundary mesh with its native packet/report schema and version 0 is required');
  }
}
function admit(value: unknown, sourceText: string | null, options: BaroCadQualifiedBodyBoundaryMeshOptions): BaroCadQualifiedBodyBoundaryMeshRead {
  const native = copyQualifiedBodyBoundaryMeshOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: QualifiedTranslatedStripBodyMeshReport;
  try { actualReport = validateQualifiedTranslatedStripBodyMesh(native); }
  catch (cause) { throw new BaroCadQualifiedBodyBoundaryMeshReadError('NATIVE', 'Whole native qualified Body mesh validation refused the copied data', cause); }
  const validationReport = copyQualifiedBodyBoundaryMeshOwnData(actualReport).value as QualifiedTranslatedStripBodyMeshReport;
  const projection = projectMesh(native, options.unitsPerMillimeter);
  return { native, validationReport, profile: PROFILE, sourceText, projection };
}
/** Admit strict whole native mesh JSON and its independent .001 neutral projection. */
export function parseBaroCadQualifiedBodyBoundaryMesh(text: string, options: BaroCadQualifiedBodyBoundaryMeshOptions): BaroCadQualifiedBodyBoundaryMeshRead {
  if (typeof text !== 'string') throw new BaroCadQualifiedBodyBoundaryMeshReadError('INPUT', 'Boundary mesh text must be a string');
  const snapshot = optionsSnapshot(options);
  return admit(parseQualifiedBodyBoundaryMeshJson(text).value, text, snapshot);
}
/** Independently copy and whole-validate the complete native mesh before projection. */
export function readBaroCadQualifiedBodyBoundaryMesh(input: unknown, options: BaroCadQualifiedBodyBoundaryMeshOptions): BaroCadQualifiedBodyBoundaryMeshRead {
  if (!isRecord(input)) throw new BaroCadQualifiedBodyBoundaryMeshReadError('INPUT', 'Boundary mesh owned input must be a record');
  const snapshot = optionsSnapshot(options);
  return admit(input, null, snapshot);
}
