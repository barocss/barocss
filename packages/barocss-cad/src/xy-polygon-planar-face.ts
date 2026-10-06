import { validateXYPolygonRegion } from './xy-polygon-region.js';
import { validateModel, evaluateCurve, evaluateSurface } from './math.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model, Point, Surface } from './types.js';

type UV = [number, number];
export interface XYPolygonPlanarFaceOptions { faceId: string }
export interface XYPolygonPlanarFaceBundle {
  geometry: Model;
  topology: { version: 0; kind: 'xy-polygon-planar-face'; sourceCurveId: string;
    face: { id: string; surfaceId: string; outerLoopId: string; orientation: 'forward' };
    vertices: { id: string; point: Point }[];
    edges: { id: string; curveId: string; vertexIds: [string, string]; sourceSegmentIndex: number; sourceParameterRange: UV }[];
    loop: { id: string; uses: { edgeId: string; sense: 'forward' | 'reverse'; pcurve: { domain: UV; uv0: UV; uv1: UV } }[] } };
}
export interface XYPolygonPlanarFaceReport { incidenceValid: true; trimFamily: 'integer-xy-polygon-planar-face-v0'; sourceCurveId: string; faceId: string; surfaceId: string; outerLoopId: string; sourceOrientation: 'ccw' | 'cw'; vertexCount: number; edgeCount: number; loopUseCount: number; nativeObjectCount: number; geometricValidity: 'not-certified'; topologyCertified: false; solid: false }
export interface XYPolygonPlanarFaceResult { bundle: XYPolygonPlanarFaceBundle; report: XYPolygonPlanarFaceReport }
export interface XYPolygonPlanarFacePointResult { classification: 'inside' | 'outside' | 'boundary'; faceId: string; surfaceId: string; pointMM: Point; uv: UV; boundaryHits: { edgeId: string; sourceSegmentIndex: number; sourceParameterRange: UV }[] }
function check(condition: boolean, path: string, detail: string): asserts condition { if (!condition) throw new Error(('XY polygon planar face: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512)); }
function snapshot(input: unknown, rootPath: string): unknown {
  let remaining = 8192;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 10, path, 'input exceeds8192 values/depth10');
    if (typeof value === 'number') { check(Number.isFinite(value), path, 'finite data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, path, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', path, 'plain numeric/string/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value); check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, path, 'foreign prototype unsupported');
    const keys = Reflect.ownKeys(value); check(keys.length <= (array ? 129 : 16) && keys.every(key => typeof key === 'string' && key.length <= 128), path, 'bounded own fields required');
    const descriptors = Object.getOwnPropertyDescriptors(value); check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), path, 'getters, symbols or hidden fields unsupported');
    if (array) { const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 128 && keys.length === length + 1, path, 'dense bounded array required'); const output: unknown[] = []; for (let i = 0; i < length; i++) { check(Object.hasOwn(descriptors, String(i)), path, 'sparse/extra array fields'); output.push(copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']')); } return output; }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
  }; return copy(input, 0, rootPath);
}
function record(value: unknown, fields: string[], path: string): Record<string, unknown> { check(value !== null && typeof value === 'object' && !Array.isArray(value), path, 'record required'); const data = value as Record<string, unknown>; check(Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), path, 'exact fields required: ' + fields.join(',')); return data; }
function identifier(value: unknown, bound: number, path: string): string { check(typeof value === 'string' && value.length <= bound && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), path, 'bounded ASCII ID required'); return value; }
function exact(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => exact(value, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>; return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && exact(x[key], y[key])); } return Object.is(a, b);
}
function assemble(profile: Curve, faceId: string): XYPolygonPlanarFaceBundle {
  const region = validateXYPolygonRegion(profile), n = region.vertexCount; check(n >= 3 && n <= 12, '$profile', 'polygon planar face supports3..12 vertices without widening Model0');
  const surfaceId = faceId + '_surface', loopId = faceId + '_loop', vertexIds = Array.from({ length: n }, (_, i) => faceId + '_v' + i), edgeIds = Array.from({ length: n }, (_, i) => faceId + '_e' + i), curveIds = Array.from({ length: n }, (_, i) => faceId + '_c' + i), ids = [faceId, profile.id, surfaceId, loopId, ...vertexIds, ...edgeIds, ...curveIds];
  check(ids.every(id => id.length <= 128) && new Set(ids).size === ids.length, '$ids', 'face/source/derived IDs must be distinct');
  const [x, y] = region.boundsMM.min, [xMax, yMax] = region.boundsMM.max;
  const surface: Surface = { kind: 'surface', id: surfaceId, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[x, y, 0], [x, yMax, 0]], [[xMax, y, 0], [xMax, yMax, 0]]], weights: [[1, 1], [1, 1]] };
  const curves: Curve[] = Array.from({ length: n }, (_, i) => ({ kind: 'curve', id: curveIds[i], degree: 1, knots: [0, 0, 1, 1], controlPoints: [[...profile.controlPoints[i]], [...profile.controlPoints[i + 1]]], weights: [1, 1] }));
  const uv = (point: Point): UV => [(point[0] - x) / (xMax - x), (point[1] - y) / (yMax - y)];
  const order = Array.from({ length: n }, (_, i) => i); if (region.orientation === 'cw') order.reverse();
  const uses = order.map(i => { const forward = region.orientation === 'ccw'; return { edgeId: edgeIds[i], sense: forward ? 'forward' as const : 'reverse' as const, pcurve: { domain: [0, 1] as UV, uv0: uv(curves[i].controlPoints[forward ? 0 : 1]), uv1: uv(curves[i].controlPoints[forward ? 1 : 0]) } }; });
  const bundle: XYPolygonPlanarFaceBundle = { geometry: { name: faceId, version: 0, lengthUnit: 'mm', objects: [copyCadData(profile), surface, ...curves] }, topology: { version: 0, kind: 'xy-polygon-planar-face', sourceCurveId: profile.id,
    face: { id: faceId, surfaceId, outerLoopId: loopId, orientation: 'forward' }, vertices: vertexIds.map((id, i) => ({ id, point: [...profile.controlPoints[i]] })),
    edges: edgeIds.map((id, i) => ({ id, curveId: curveIds[i], vertexIds: [vertexIds[i], vertexIds[(i + 1) % n]], sourceSegmentIndex: i, sourceParameterRange: [i, i + 1] })), loop: { id: loopId, uses } } };
  validateModel(bundle.geometry); return bundle;
}
function validateOwned(input: unknown): { bundle: XYPolygonPlanarFaceBundle; report: XYPolygonPlanarFaceReport } {
  const data = record(input, ['geometry', 'topology'], '$bundle'), geometry = record(data.geometry, ['name', 'version', 'lengthUnit', 'objects'], '$bundle.geometry'), topology = record(data.topology, ['version', 'kind', 'sourceCurveId', 'face', 'vertices', 'edges', 'loop'], '$bundle.topology');
  check(topology.version === 0 && topology.kind === 'xy-polygon-planar-face', '$bundle.topology', 'polygon planar face family0 required');
  const face = record(topology.face, ['id', 'surfaceId', 'outerLoopId', 'orientation'], '$bundle.topology.face'), faceId = identifier(face.id, 80, '$bundle.topology.face.id'), sourceId = identifier(topology.sourceCurveId, 128, '$bundle.topology.sourceCurveId');
  check(Array.isArray(geometry.objects) && geometry.objects.length <= 16, '$bundle.geometry.objects', 'existing Model0 object bound required'); validateModel(geometry as unknown as Model);
  const source = (geometry.objects as Model['objects']).find(object => object.id === sourceId); check(source?.kind === 'curve', '$bundle.topology.sourceCurveId', 'actual source Curve reference required');
  const expected = assemble(source, faceId); check(exact(input, expected), '$bundle', 'canonical Surface/Curve/vertex/edge/loop/pcurve binding mismatch');
  const surface = expected.geometry.objects[1] as Surface;
  for (let i = 0; i < expected.topology.loop.uses.length; i++) {
    const use = expected.topology.loop.uses[i], edge = expected.topology.edges.find(edge => edge.id === use.edgeId)!, curve = expected.geometry.objects.find(object => object.id === edge.curveId) as Curve;
    const next = expected.topology.loop.uses[(i + 1) % expected.topology.loop.uses.length], nextEdge = expected.topology.edges.find(edge => edge.id === next.edgeId)!;
    const endId = edge.vertexIds[use.sense === 'forward' ? 1 : 0], startId = nextEdge.vertexIds[next.sense === 'forward' ? 0 : 1]; check(endId === startId, '$bundle.topology.loop', 'directed endpoint incidence mismatch');
    for (const t of [0, .5, 1]) { const uv: UV = [use.pcurve.uv0[0] + t * (use.pcurve.uv1[0] - use.pcurve.uv0[0]), use.pcurve.uv0[1] + t * (use.pcurve.uv1[1] - use.pcurve.uv0[1])], actual = evaluateSurface(surface, uv[0], uv[1]), point = evaluateCurve(curve, use.sense === 'forward' ? t : 1 - t); check(uv.every(Number.isFinite) && Math.hypot(...actual.map((value, axis) => value - point[axis])) <= 1e-9, '$bundle.topology.loop.uses[' + i + ']', 'finite affine pcurve/edge mapping mismatch'); }
  }
  const region = validateXYPolygonRegion(source), report: XYPolygonPlanarFaceReport = { incidenceValid: true, trimFamily: 'integer-xy-polygon-planar-face-v0', sourceCurveId: sourceId, faceId, surfaceId: surface.id, outerLoopId: expected.topology.loop.id, sourceOrientation: region.orientation, vertexCount: region.vertexCount, edgeCount: region.segmentCount, loopUseCount: region.segmentCount, nativeObjectCount: expected.geometry.objects.length, geometricValidity: 'not-certified', topologyCertified: false, solid: false };
  return { bundle: expected, report };
}
export function buildXYPolygonPlanarFace(profile: Curve, options: XYPolygonPlanarFaceOptions): XYPolygonPlanarFaceResult { const source = snapshot(profile, '$profile') as Curve, data = record(snapshot(options, '$options'), ['faceId'], '$options'), faceId = identifier(data.faceId, 80, '$options.faceId'), bundle = assemble(source, faceId); const validated = validateOwned(bundle); return copyCadData({ bundle: validated.bundle, report: validated.report }); }
export function validateXYPolygonPlanarFaceBundle(bundle: XYPolygonPlanarFaceBundle): XYPolygonPlanarFaceReport { return copyCadData(validateOwned(snapshot(bundle, '$bundle')).report); }
export function classifyXYPolygonPlanarFacePoint(bundle: XYPolygonPlanarFaceBundle, pointMM: Point): XYPolygonPlanarFacePointResult {
  const validated = validateOwned(snapshot(bundle, '$bundle')), point = snapshot(pointMM, '$point');
  check(Array.isArray(point) && point.length === 3 && point.every(value => typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= 10000) && point[2] === 0, '$point', 'exact integer XY within±10000 at Z0 required');
  const q = point as Point, source = validated.bundle.geometry.objects[0] as Curve, topology = validated.bundle.topology, surface = validated.bundle.geometry.objects[1] as Surface, hits: XYPolygonPlanarFacePointResult['boundaryHits'] = []; let winding = 0;
  for (let i = 0; i < topology.edges.length; i++) {
    const a = source.controlPoints[i], b = source.controlPoints[i + 1], determinant = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]); check(Number.isSafeInteger(determinant) && Math.abs(determinant) <= 8e8, '$point', 'unsafe exact point orientation');
    if (determinant === 0 && q[0] >= Math.min(a[0], b[0]) && q[0] <= Math.max(a[0], b[0]) && q[1] >= Math.min(a[1], b[1]) && q[1] <= Math.max(a[1], b[1])) { const edge = topology.edges[i]; hits.push({ edgeId: edge.id, sourceSegmentIndex: i, sourceParameterRange: [...edge.sourceParameterRange] }); }
    if (a[1] <= q[1] && b[1] > q[1] && determinant > 0) winding++; else if (a[1] > q[1] && b[1] <= q[1] && determinant < 0) winding--;
  }
  const origin = surface.controlPoints[0][0], uv: UV = [(q[0] - origin[0]) / (surface.controlPoints[1][0][0] - origin[0]), (q[1] - origin[1]) / (surface.controlPoints[0][1][1] - origin[1])]; check(uv.every(Number.isFinite), '$point', 'nonfinite affine UV');
  return copyCadData({ classification: hits.length ? 'boundary' : winding === 0 ? 'outside' : 'inside', faceId: topology.face.id, surfaceId: topology.face.surfaceId, pointMM: [...q] as Point, uv, boundaryHits: hits });
}
