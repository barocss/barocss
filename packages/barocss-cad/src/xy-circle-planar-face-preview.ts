import { validateXYCirclePlanarFaceBundle } from './xy-circle-planar-face.js';
import type { XYCirclePlanarFaceBundle, XYCirclePlanarFaceReport } from './xy-circle-planar-face.js';
import { evaluateCurve, surfaceDomain } from './math.js';
import { evaluateSurfaceD1 } from './derivatives.js';
import { validatePreviewPacket } from './packet.js';
import type { PreviewPacket } from './packet.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Point, Surface } from './types.js';

export interface XYCirclePlanarFacePreviewOptions { meshId: string; revision: number; segmentsPerQuarter: number }
export interface XYCirclePlanarFaceEdgePath { id: string; points: Point[] }
export interface XYCirclePlanarFaceEdgeProvenance {
  faceId: string; surfaceId: string; sourceCurveId: string; edgeId: string; loopId: string; seamVertexId: string;
  loopSense: 'forward'; sourceParameterRange: [number, number]; sampledParameters: number[]; pcurveId: string;
}
export interface XYCirclePlanarFacePreviewReport {
  kind: 'xy-circle-planar-face-preview'; native: XYCirclePlanarFaceReport;
  faceId: string; surfaceId: string; sourceCurveId: string; meshId: string; revision: number; segmentsPerQuarter: number;
  vertexCount: number; triangleCount: number; edgePathCount: 1; edgePathPointCount: number; approximationSegmentCount: number;
  boundsMM: { min: Point; max: Point }; meshAreaMM2: number; referenceDiskAreaMM2: number; areaDifferenceMM2: number;
  observedChordDeviationMM: number; observedSurfaceBindingDifferenceMM: number;
  sampling: { kind: 'uniform-native-parameter'; segmentsPerQuarter: number; boundaryParameters: number[]; centerUV: [number, number] };
  limits: { segmentsPerQuarter: [2, 32]; maximumVertices: 129; maximumTriangles: 128; maximumEdgePaths: 1; maximumPathPoints: 129;
    snapshotValues: 8192; snapshotDepth: 10; arrayElements: 64; recordFields: 12; stringCharacters: 128; meshIdCharacters: 64;
    evaluationComparisonMM: 1e-7; float32Policy: 'positive-outward-world-coordinate-triangles' };
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
}
export interface XYCirclePlanarFacePreviewResult {
  packet: PreviewPacket; edgePaths: XYCirclePlanarFaceEdgePath[]; edgeProvenance: XYCirclePlanarFaceEdgeProvenance[];
  report: XYCirclePlanarFacePreviewReport;
}
function check(condition: boolean, path: string, detail: string): asserts condition { if (!condition) throw new Error(('XY circle face preview: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512)); }
function snapshot(input: unknown, rootPath: string): unknown {
  let remaining = 8192;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 10, path, 'input exceeds8192 values/depth10');
    if (typeof value === 'number') { check(Number.isFinite(value), path, 'finite data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, path, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', path, 'plain numeric/string/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value); check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, path, 'foreign prototype unsupported');
    const keys = Reflect.ownKeys(value); check(keys.length <= (array ? 65 : 12) && keys.every(key => typeof key === 'string' && key.length <= 128), path, 'bounded own fields required');
    const descriptors = Object.getOwnPropertyDescriptors(value); check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), path, 'getters, symbols or hidden fields unsupported');
    if (array) { const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 64 && keys.length === length + 1, path, 'dense bounded array required'); const output: unknown[] = []; for (let i = 0; i < length; i++) { check(Object.hasOwn(descriptors, String(i)), path, 'sparse/extra array fields'); output.push(copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']')); } return output; }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
  }; return copy(input, 0, rootPath);
}
function record(value: unknown, fields: string[], path: string): Record<string, unknown> { check(value !== null && typeof value === 'object' && !Array.isArray(value), path, 'record required'); const data = value as Record<string, unknown>; check(Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), path, 'exact fields required: ' + fields.join(',')); return data; }
function identifier(value: unknown, bound: number, path: string): string { check(typeof value === 'string' && value.length <= bound && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), path, 'bounded ASCII ID required'); return value; }
function nativeIds(data: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(data)) for (const value of data) nativeIds(value, result);
  else if (data !== null && typeof data === 'object') for (const [key, value] of Object.entries(data)) {
    if ((key === 'id' || key === 'name') && typeof value === 'string') result.add(value); nativeIds(value, result);
  }
  return result;
}
function cross(a: Point, b: Point, c: Point): Point {
  const u = b.map((value, axis) => value - a[axis]), v = c.map((value, axis) => value - a[axis]);
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}
/** One actual original edge; only display connectivity and sampling are derived. */
export function tessellateXYCirclePlanarFace(input: XYCirclePlanarFaceBundle, inputOptions: XYCirclePlanarFacePreviewOptions): XYCirclePlanarFacePreviewResult {
  const bundle = snapshot(input, '$bundle') as XYCirclePlanarFaceBundle;
  const options = record(snapshot(inputOptions, '$options'), ['meshId', 'revision', 'segmentsPerQuarter'], '$options');
  const meshId = identifier(options.meshId, 64, '$options.meshId'), revision = options.revision, k = options.segmentsPerQuarter;
  check(typeof revision === 'number' && Number.isInteger(revision) && revision >= 0 && revision <= 2147483647, '$options.revision', 'integer revision0..2147483647 required');
  check(typeof k === 'number' && Number.isInteger(k) && k >= 2 && k <= 32, '$options.segmentsPerQuarter', 'integer segmentsPerQuarter2..32 required');
  const native = validateXYCirclePlanarFaceBundle(bundle);
  check(!nativeIds(bundle).has(meshId), '$options.meshId', 'display ID must differ from all native IDs and Model names');
  const curve = bundle.geometry.objects[0] as Curve, surface = bundle.geometry.objects[1] as Surface, topology = bundle.topology;
  const edge = topology.edges[0], use = topology.loop.uses[0], pcurve = use.pcurve.curve, domain = surfaceDomain(surface), n = 4 * k;
  const positions: number[] = [], normals: number[] = [], parameters: number[] = [], indices: number[] = [];
  const origin = surface.controlPoints[0][0], center = bundle.construction.center;
  const centerUV: [number, number] = [(center[0] - origin[0]) / (surface.controlPoints[1][0][0] - origin[0]), (center[1] - origin[1]) / (surface.controlPoints[0][1][1] - origin[1])];
  const emit = (uv: [number, number]): Point => {
    check(uv.every(Number.isFinite) && uv[0] >= domain.u[0] && uv[0] <= domain.u[1] && uv[1] >= domain.v[0] && uv[1] <= domain.v[1], '$parameters', 'actual UV outside strict native Surface domain');
    const d1 = evaluateSurfaceD1(surface, uv[0], uv[1]);
    const vector: Point = [d1.du[1] * d1.dv[2] - d1.du[2] * d1.dv[1], d1.du[2] * d1.dv[0] - d1.du[0] * d1.dv[2], d1.du[0] * d1.dv[1] - d1.du[1] * d1.dv[0]], magnitude = Math.hypot(...vector);
    check(Number.isFinite(magnitude) && magnitude > 0 && vector[2] > 0, '$normals', 'actual finite forward SurfaceD1 normal required');
    positions.push(...d1.point); normals.push(...vector.map(value => value / magnitude)); parameters.push(...uv); return d1.point;
  };
  emit(centerUV);
  const sampledParameters = Array.from({ length: n + 1 }, (_, j) => j / k), boundaryParameters = sampledParameters.slice(0, -1);
  const pathPoints = sampledParameters.map(t => evaluateCurve(curve, t));
  let observedSurfaceBindingDifferenceMM = 0;
  for (let j = 0; j < n; j++) {
    const uv = evaluateCurve(pcurve, boundaryParameters[j]), point = emit([uv[0], uv[1]]);
    const difference = Math.hypot(...point.map((value, axis) => value - pathPoints[j][axis]));
    check(Number.isFinite(difference) && difference <= 1e-7, '$boundary #' + edge.id, 'actual world Curve/Surface(pcurve) binding comparison exceeds1e-7mm');
    observedSurfaceBindingDifferenceMM = Math.max(observedSurfaceBindingDifferenceMM, difference);
  }
  const pointAt = (vertex: number, float32 = false): Point => positions.slice(vertex * 3, vertex * 3 + 3).map(value => float32 ? Math.fround(value) : value) as Point;
  let meshAreaMM2 = 0, observedChordDeviationMM = 0;
  for (let j = 0; j < n; j++) {
    const triangle = [0, 1 + j, 1 + (j + 1) % n];
    for (const float32 of [false, true]) {
      const vector = cross(pointAt(triangle[0], float32), pointAt(triangle[1], float32), pointAt(triangle[2], float32)), area2 = Math.hypot(...vector);
      check(Number.isFinite(area2) && area2 > 0, '$triangles', float32 ? 'Float32 world-coordinate triangle collapsed; native circle is valid but this display sampling is unsupported' : 'actual Surface triangle collapsed');
      for (const vertex of triangle) check(vector.reduce((dot, value, axis) => dot + value * normals[vertex * 3 + axis], 0) > 0, '$triangles', 'actual/Float32 triangle winding disagrees with Surface normal');
      if (!float32) meshAreaMM2 += area2 / 2;
    }
    indices.push(...triangle);
    const midpoint = evaluateCurve(curve, (sampledParameters[j] + sampledParameters[j + 1]) / 2);
    const chordMidpoint = pathPoints[j].map((value, axis) => (value + pathPoints[j + 1][axis]) / 2) as Point;
    const deviation = Math.hypot(...midpoint.map((value, axis) => value - chordMidpoint[axis]));
    check(Number.isFinite(deviation), '$approximation', 'finite observed native-parameter midpoint/chord deviation required');
    observedChordDeviationMM = Math.max(observedChordDeviationMM, deviation);
  }
  const bounds: { min: Point; max: Point } = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let j = 0; j < positions.length; j += 3) for (let axis = 0; axis < 3; axis++) {
    bounds.min[axis] = Math.min(bounds.min[axis], positions[j + axis]); bounds.max[axis] = Math.max(bounds.max[axis], positions[j + axis]);
  }
  const packet: PreviewPacket = { version: 0, surfaceId: meshId, revision, lengthUnit: 'mm', coordinateSystem: 'right-handed-y-up', winding: 'ccw', positions, normals, indices, parameters, bounds };
  validatePreviewPacket(packet);
  check(pathPoints[0].every((value, axis) => value === pathPoints[n][axis]), '$edgePath', 'actual original seam sample must close once');
  const edgePaths: XYCirclePlanarFaceEdgePath[] = [{ id: edge.id, points: pathPoints }];
  const edgeProvenance: XYCirclePlanarFaceEdgeProvenance[] = [{ faceId: topology.face.id, surfaceId: surface.id, sourceCurveId: curve.id, edgeId: edge.id,
    loopId: topology.loop.id, seamVertexId: topology.vertices[0].id, loopSense: use.sense, sourceParameterRange: copyCadData(edge.sourceParameterRange), sampledParameters, pcurveId: pcurve.id }];
  const report: XYCirclePlanarFacePreviewReport = { kind: 'xy-circle-planar-face-preview', native, faceId: topology.face.id, surfaceId: surface.id, sourceCurveId: curve.id,
    meshId, revision, segmentsPerQuarter: k, vertexCount: n + 1, triangleCount: n, edgePathCount: 1, edgePathPointCount: n + 1, approximationSegmentCount: n,
    boundsMM: bounds, meshAreaMM2, referenceDiskAreaMM2: native.referenceDiskAreaMM2, areaDifferenceMM2: meshAreaMM2 - native.referenceDiskAreaMM2,
    observedChordDeviationMM, observedSurfaceBindingDifferenceMM,
    sampling: { kind: 'uniform-native-parameter', segmentsPerQuarter: k, boundaryParameters, centerUV },
    limits: { segmentsPerQuarter: [2, 32], maximumVertices: 129, maximumTriangles: 128, maximumEdgePaths: 1, maximumPathPoints: 129,
      snapshotValues: 8192, snapshotDepth: 10, arrayElements: 64, recordFields: 12, stringCharacters: 128, meshIdCharacters: 64, evaluationComparisonMM: 1e-7,
      float32Policy: 'positive-outward-world-coordinate-triangles' }, geometricValidity: 'not-certified', topologyCertified: false, solid: false };
  return copyCadData({ packet, edgePaths, edgeProvenance, report });
}
