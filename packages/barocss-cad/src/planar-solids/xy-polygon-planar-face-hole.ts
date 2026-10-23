import { validateXYPolygonRegion } from '../sketch/xy-polygon-region.js';
import { validateModel, evaluateCurve, evaluateSurface } from '../core/math.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Model, Point, Surface } from '../types.js';

type UV = [number, number];
type LoopRole = 'outer' | 'hole';
export interface XYPolygonPlanarFaceWithHoleOptions { faceId: string }
export interface XYPolygonPlanarFaceWithHoleBundle {
  geometry: Model;
  topology: {
    version: 0; kind: 'xy-polygon-planar-face-with-hole'; sourceCurveIds: { outer: string; hole: string };
    face: { id: string; surfaceId: string; outerLoopId: string; innerLoopIds: [string]; orientation: 'forward' };
    vertices: { id: string; point: Point }[];
    edges: { id: string; curveId: string; vertexIds: [string, string]; sourceCurveId: string;
      sourceSegmentIndex: number; sourceParameterRange: UV; loopId: string; loopRole: LoopRole }[];
    loops: { id: string; role: LoopRole; sourceCurveId: string;
      uses: { edgeId: string; sense: 'forward' | 'reverse'; pcurve: { domain: UV; uv0: UV; uv1: UV } }[] }[];
  };
}
export interface XYPolygonPlanarFaceWithHoleReport {
  incidenceValid: true; trimFamily: 'integer-xy-polygon-planar-face-with-hole-v0'; faceId: string; surfaceId: string;
  sourceCurveIds: { outer: string; hole: string }; sourceOrientations: { outer: 'ccw' | 'cw'; hole: 'ccw' | 'cw' };
  areasMM2: { outer: number; hole: number; net: number }; vertexCount: number; edgeCount: number; loopCount: 2;
  nativeObjectCount: number; crossLoopSegmentPairs: number;
  limits: { faceIdCharacters: 80; derivedIdCharacters: 128; sourceVerticesMinimum: 3; combinedVertexMaximum: 12;
    holes: 1; modelObjectMaximum: 16; maximumNativeObjects: 15; crossLoopSegmentPairMaximum: 36;
    snapshotValues: 16384; snapshotDepth: 12; arrayElements: 128; recordFields: 16; stringCharacters: 128;
    pcurveEvaluationToleranceMM: 1e-9 };
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
}
export interface XYPolygonPlanarFaceWithHoleResult { bundle: XYPolygonPlanarFaceWithHoleBundle; report: XYPolygonPlanarFaceWithHoleReport }
export interface XYPolygonPlanarFaceWithHolePointResult {
  classification: 'inside' | 'outside' | 'boundary'; faceId: string; surfaceId: string; pointMM: Point; uv: UV;
  boundaryHits: { edgeId: string; sourceCurveId: string; loopId: string; loopRole: LoopRole;
    sourceSegmentIndex: number; sourceParameterRange: UV }[];
}
function check(condition: boolean, path: string, detail: string): asserts condition {
  if (!condition) throw new Error(('XY polygon planar face with hole: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512));
}
function snapshot(input: unknown, rootPath: string): unknown {
  let remaining = 16384;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 12, path, 'input exceeds16384 values/depth12');
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
function orientation(a: Point, b: Point, c: Point): number {
  const differences = [b[0] - a[0], b[1] - a[1], c[0] - a[0], c[1] - a[1]];
  check(differences.every(value => Number.isSafeInteger(value) && Math.abs(value) <= 20000), '$predicates', 'bounded integer coordinate differences required');
  const [dx, dy, ex, ey] = differences, left = dx * ey, right = dy * ex, result = left - right;
  check(Number.isSafeInteger(left) && Number.isSafeInteger(right) && Math.abs(left) <= 4e8 && Math.abs(right) <= 4e8 && Number.isSafeInteger(result) && Math.abs(result) <= 8e8, '$predicates', 'unsafe exact orientation arithmetic');
  return result;
}
function onSegment(a: Point, b: Point, point: Point): boolean {
  return orientation(a, b, point) === 0 && point[0] >= Math.min(a[0], b[0]) && point[0] <= Math.max(a[0], b[0]) && point[1] >= Math.min(a[1], b[1]) && point[1] <= Math.max(a[1], b[1]);
}
const opposite = (a: number, b: number): boolean => a < 0 && b > 0 || a > 0 && b < 0;
function segmentsMeet(a: Point, b: Point, c: Point, d: Point): boolean {
  return opposite(orientation(a, b, c), orientation(a, b, d)) && opposite(orientation(c, d, a), orientation(c, d, b))
    || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
function location(profile: Curve, point: Point): 'inside' | 'outside' | 'boundary' {
  let winding = 0;
  for (let i = 0; i < profile.controlPoints.length - 1; i++) {
    const a = profile.controlPoints[i], b = profile.controlPoints[i + 1];
    if (onSegment(a, b, point)) return 'boundary';
    const determinant = orientation(a, b, point);
    if (a[1] <= point[1] && b[1] > point[1] && determinant > 0) winding++;
    else if (a[1] > point[1] && b[1] <= point[1] && determinant < 0) winding--;
  }
  return winding ? 'inside' : 'outside';
}
function containment(outer: Curve, hole: Curve): number {
  let pairs = 0;
  for (let i = 0; i < outer.controlPoints.length - 1; i++) for (let j = 0; j < hole.controlPoints.length - 1; j++) {
    check(++pairs <= 36, '$loops', 'cross-loop segment pair budget36 exceeded');
    check(!segmentsMeet(outer.controlPoints[i], outer.controlPoints[i + 1], hole.controlPoints[j], hole.controlPoints[j + 1]), '$loops', 'outer/hole crossing, touch or overlap at segments ' + i + '/' + j);
  }
  for (const [i, point] of hole.controlPoints.slice(0, -1).entries()) check(location(outer, point) === 'inside', '$hole[' + i + ']', 'every hole vertex must be strictly inside the actual outer polygon');
  return pairs;
}
function assemble(outer: Curve, hole: Curve, faceId: string): XYPolygonPlanarFaceWithHoleResult {
  const outerRegion = validateXYPolygonRegion(outer), holeRegion = validateXYPolygonRegion(hole), count = outerRegion.vertexCount + holeRegion.vertexCount;
  check(count <= 12, '$profiles', 'combined outer+hole vertices<=12 required; existing Model0 limit unchanged');
  const pairs = containment(outer, hole), net = outerRegion.areaMM2 - holeRegion.areaMM2;
  check(net > 0 && [outerRegion.areaMM2, holeRegion.areaMM2, net].every(value => Number.isSafeInteger(2 * value)), '$areas', 'positive exact safe-integer half-area required');
  const surfaceId = faceId + '_surface', sourceCurveIds = { outer: outer.id, hole: hole.id };
  const definitions = [
    { role: 'outer' as const, profile: outer, region: outerRegion, loopId: faceId + '_outer_loop', forward: outerRegion.orientation === 'ccw' },
    { role: 'hole' as const, profile: hole, region: holeRegion, loopId: faceId + '_hole_loop', forward: holeRegion.orientation === 'cw' },
  ];
  const ids = [faceId, outer.id, hole.id, surfaceId, ...definitions.flatMap(({ role, region, loopId }) => [loopId, ...Array.from({ length: region.vertexCount }, (_, i) => [faceId + '_' + role + '_v' + i, faceId + '_' + role + '_e' + i, faceId + '_' + role + '_c' + i]).flat()])];
  check(ids.every(id => id.length <= 128) && new Set(ids).size === ids.length, '$ids', 'original face/source/derived IDs must be distinct and bounded');
  const [x, y] = outerRegion.boundsMM.min, [xMax, yMax] = outerRegion.boundsMM.max;
  const surface: Surface = { kind: 'surface', id: surfaceId, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
    controlPoints: [[[x, y, 0], [x, yMax, 0]], [[xMax, y, 0], [xMax, yMax, 0]]], weights: [[1, 1], [1, 1]] };
  const uv = (point: Point): UV => [(point[0] - x) / (xMax - x), (point[1] - y) / (yMax - y)];
  const vertices: XYPolygonPlanarFaceWithHoleBundle['topology']['vertices'] = [], edges: XYPolygonPlanarFaceWithHoleBundle['topology']['edges'] = [], loops: XYPolygonPlanarFaceWithHoleBundle['topology']['loops'] = [], curves: Curve[] = [];
  for (const { role, profile, region, loopId, forward } of definitions) {
    const n = region.vertexCount, prefix = faceId + '_' + role;
    const vertexIds = Array.from({ length: n }, (_, i) => prefix + '_v' + i), edgeIds = Array.from({ length: n }, (_, i) => prefix + '_e' + i);
    const localCurves: Curve[] = Array.from({ length: n }, (_, i) => ({ kind: 'curve', id: prefix + '_c' + i, degree: 1, knots: [0, 0, 1, 1], controlPoints: [[...profile.controlPoints[i]], [...profile.controlPoints[i + 1]]], weights: [1, 1] }));
    vertices.push(...vertexIds.map((id, i) => ({ id, point: [...profile.controlPoints[i]] as Point })));
    edges.push(...edgeIds.map((id, i) => ({ id, curveId: localCurves[i].id, vertexIds: [vertexIds[i], vertexIds[(i + 1) % n]] as [string, string], sourceCurveId: profile.id, sourceSegmentIndex: i, sourceParameterRange: [i, i + 1] as UV, loopId, loopRole: role })));
    const order = Array.from({ length: n }, (_, i) => i); if (!forward) order.reverse();
    loops.push({ id: loopId, role, sourceCurveId: profile.id, uses: order.map(i => ({ edgeId: edgeIds[i], sense: forward ? 'forward' : 'reverse',
      pcurve: { domain: [0, 1], uv0: uv(localCurves[i].controlPoints[forward ? 0 : 1]), uv1: uv(localCurves[i].controlPoints[forward ? 1 : 0]) } })) });
    curves.push(...localCurves);
  }
  const bundle: XYPolygonPlanarFaceWithHoleBundle = { geometry: { name: faceId, version: 0, lengthUnit: 'mm', objects: [copyCadData(outer), copyCadData(hole), surface, ...curves] },
    topology: { version: 0, kind: 'xy-polygon-planar-face-with-hole', sourceCurveIds,
      face: { id: faceId, surfaceId, outerLoopId: definitions[0].loopId, innerLoopIds: [definitions[1].loopId], orientation: 'forward' }, vertices, edges, loops } };
  validateModel(bundle.geometry);
  const report: XYPolygonPlanarFaceWithHoleReport = { incidenceValid: true, trimFamily: 'integer-xy-polygon-planar-face-with-hole-v0', faceId, surfaceId, sourceCurveIds,
    sourceOrientations: { outer: outerRegion.orientation, hole: holeRegion.orientation }, areasMM2: { outer: outerRegion.areaMM2, hole: holeRegion.areaMM2, net },
    vertexCount: count, edgeCount: count, loopCount: 2, nativeObjectCount: count + 3, crossLoopSegmentPairs: pairs,
    limits: { faceIdCharacters: 80, derivedIdCharacters: 128, sourceVerticesMinimum: 3, combinedVertexMaximum: 12, holes: 1,
      modelObjectMaximum: 16, maximumNativeObjects: 15, crossLoopSegmentPairMaximum: 36, snapshotValues: 16384, snapshotDepth: 12,
      arrayElements: 128, recordFields: 16, stringCharacters: 128, pcurveEvaluationToleranceMM: 1e-9 },
    geometricValidity: 'not-certified', topologyCertified: false, solid: false };
  return { bundle, report };
}
function validateOwned(input: unknown): XYPolygonPlanarFaceWithHoleResult {
  const data = record(input, ['geometry', 'topology'], '$bundle'), geometry = record(data.geometry, ['name', 'version', 'lengthUnit', 'objects'], '$bundle.geometry');
  const topology = record(data.topology, ['version', 'kind', 'sourceCurveIds', 'face', 'vertices', 'edges', 'loops'], '$bundle.topology');
  check(topology.version === 0 && topology.kind === 'xy-polygon-planar-face-with-hole', '$bundle.topology', 'distinct one-hole planar face family0 required');
  const references = record(topology.sourceCurveIds, ['outer', 'hole'], '$bundle.topology.sourceCurveIds');
  const face = record(topology.face, ['id', 'surfaceId', 'outerLoopId', 'innerLoopIds', 'orientation'], '$bundle.topology.face');
  const faceId = identifier(face.id, 80, '$face.id'), outerId = identifier(references.outer, 128, '$sources.outer'), holeId = identifier(references.hole, 128, '$sources.hole');
  check(Array.isArray(geometry.objects) && geometry.objects.length <= 16, '$geometry', 'unchanged Model0 object limit16 required'); validateModel(geometry as unknown as Model);
  const objects = geometry.objects as Model['objects'], outer = objects.find(object => object.id === outerId), hole = objects.find(object => object.id === holeId);
  check(outer?.kind === 'curve' && hole?.kind === 'curve', '$sources', 'both actual original source Curves required');
  const expected = assemble(outer, hole, faceId);
  check(exact(input, expected.bundle), '$bundle', 'canonical original sources/Surface/vertices/edges/two loops/pcurve binding mismatch');
  const { bundle } = expected, surface = bundle.geometry.objects[2] as Surface;
  for (const loop of bundle.topology.loops) for (let i = 0; i < loop.uses.length; i++) {
    const use = loop.uses[i], edge = bundle.topology.edges.find(edge => edge.id === use.edgeId)!, next = loop.uses[(i + 1) % loop.uses.length], nextEdge = bundle.topology.edges.find(edge => edge.id === next.edgeId)!;
    const endId = edge.vertexIds[use.sense === 'forward' ? 1 : 0], startId = nextEdge.vertexIds[next.sense === 'forward' ? 0 : 1];
    check(endId === startId && edge.loopId === loop.id && edge.sourceCurveId === loop.sourceCurveId && edge.loopRole === loop.role, '$loops #' + loop.id, 'directed endpoint/source/loop incidence mismatch');
    const curve = bundle.geometry.objects.find(object => object.id === edge.curveId) as Curve;
    for (const t of [0, .5, 1]) {
      const uv: UV = [use.pcurve.uv0[0] + t * (use.pcurve.uv1[0] - use.pcurve.uv0[0]), use.pcurve.uv0[1] + t * (use.pcurve.uv1[1] - use.pcurve.uv0[1])];
      const actual = evaluateSurface(surface, uv[0], uv[1]), point = evaluateCurve(curve, use.sense === 'forward' ? t : 1 - t);
      check(uv.every(Number.isFinite) && Math.hypot(...actual.map((value, axis) => value - point[axis])) <= 1e-9, '$pcurves #' + edge.id, 'actual affine Surface/edge binding exceeds evaluation comparison1e-9mm');
    }
  }
  return expected;
}
export function buildXYPolygonPlanarFaceWithHole(outerProfile: Curve, holeProfile: Curve, options: XYPolygonPlanarFaceWithHoleOptions): XYPolygonPlanarFaceWithHoleResult {
  const outer = snapshot(outerProfile, '$outer') as Curve, hole = snapshot(holeProfile, '$hole') as Curve, data = record(snapshot(options, '$options'), ['faceId'], '$options');
  const built = assemble(outer, hole, identifier(data.faceId, 80, '$options.faceId'));
  return copyCadData(validateOwned(built.bundle));
}
export function validateXYPolygonPlanarFaceWithHoleBundle(bundle: XYPolygonPlanarFaceWithHoleBundle): XYPolygonPlanarFaceWithHoleReport {
  return copyCadData(validateOwned(snapshot(bundle, '$bundle')).report);
}
export function classifyXYPolygonPlanarFaceWithHolePoint(input: XYPolygonPlanarFaceWithHoleBundle, pointMM: Point): XYPolygonPlanarFaceWithHolePointResult {
  const { bundle } = validateOwned(snapshot(input, '$bundle')), value = snapshot(pointMM, '$point');
  check(Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= 10000) && value[2] === 0, '$point', 'integer XYZ within+/-10000mm at Z0 required');
  const point = value as Point, topology = bundle.topology, outer = bundle.geometry.objects[0] as Curve, hole = bundle.geometry.objects[1] as Curve, surface = bundle.geometry.objects[2] as Surface;
  const boundaryHits: XYPolygonPlanarFaceWithHolePointResult['boundaryHits'] = [];
  for (const edge of topology.edges) {
    const curve = bundle.geometry.objects.find(object => object.id === edge.curveId) as Curve;
    if (onSegment(curve.controlPoints[0], curve.controlPoints[1], point)) boundaryHits.push({ edgeId: edge.id, sourceCurveId: edge.sourceCurveId,
      loopId: edge.loopId, loopRole: edge.loopRole, sourceSegmentIndex: edge.sourceSegmentIndex, sourceParameterRange: [...edge.sourceParameterRange] });
  }
  const classification = boundaryHits.length ? 'boundary' : location(outer, point) === 'inside' && location(hole, point) === 'outside' ? 'inside' : 'outside';
  const origin = surface.controlPoints[0][0], uv: UV = [(point[0] - origin[0]) / (surface.controlPoints[1][0][0] - origin[0]), (point[1] - origin[1]) / (surface.controlPoints[0][1][1] - origin[1])];
  check(uv.every(Number.isFinite), '$point', 'finite shared Surface affine UV required');
  return copyCadData({ classification, faceId: topology.face.id, surfaceId: surface.id, pointMM: point, uv, boundaryHits });
}
