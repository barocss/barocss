import { buildXYArc } from './xy-arc.js';
import type { XYArcRequest, XYArcResult } from './xy-arc.js';
import { validateModel, validateCurve, validateSurface, evaluateCurve, curveDomain, surfaceDomain } from './math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model, Point, Surface } from './types.js';
import type { XYPoint } from './xy-profile.js';

export type XYCircleFaceProfile = Extract<XYArcRequest, { kind: 'circle' }>;
export interface XYCirclePlanarFaceOptions { faceId: string }
export interface XYCirclePlanarFaceBundle {
  construction: XYCircleFaceProfile; geometry: Model;
  topology: { version: 0; kind: 'xy-circle-planar-face'; sourceCurveId: string;
    face: { id: string; surfaceId: string; outerLoopId: string; orientation: 'forward' };
    vertices: { id: string; point: Point }[];
    edges: { id: string; curveId: string; vertexIds: [string, string]; sourceParameterRange: [number, number] }[];
    loop: { id: string; uses: { edgeId: string; sense: 'forward'; pcurve: { coordinateSystem: 'uv'; domain: [number, number]; curve: Curve } }[] } };
}
export interface XYCirclePlanarFaceReport {
  trimFamily: 'xy-circle-planar-face-v0'; sourceCurveId: string; faceId: string; surfaceId: string; outerLoopId: string;
  edgeId: string; pcurveId: string; seamVertexId: string; nativeDomain: [number, number]; uvDomain: [number, number];
  surfaceDomain: { u: [number, number]; v: [number, number] }; centerMM: XYPoint; radiusMM: number; boundsMM: { min: Point; max: Point };
  vertexCount: 1; edgeCount: 1; loopUseCount: 1; nativeObjectCount: 2; referenceDiskAreaMM2: number; incidenceValid: true;
  periodic: false; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { authoredIdCharacters: 64; derivedIdCharacters: 80; snapshotValues: 8192; snapshotDepth: 10; arrayElements: 64;
    recordFields: 12; stringCharacters: 128; evaluationComparisonMM: 1e-7; derivativeComparisonRelative: 1e-9;
    planeToleranceMM: 1e-7; boundaryToleranceMM: 1e-7 };
}
export interface XYCirclePlanarFaceResult { profile: XYArcResult; bundle: XYCirclePlanarFaceBundle; report: XYCirclePlanarFaceReport }
export interface XYCirclePlanarFacePointResult {
  classification: 'inside' | 'outside' | 'boundary' | 'off-plane'; pointMM: Point; faceId: string; surfaceId: string; sourceCurveId: string;
  edgeId: string | null; surfaceUV: [number, number] | null; policy: { planeToleranceMM: 1e-7; boundaryToleranceMM: 1e-7 };
}
function check(condition: boolean, path: string, detail: string): asserts condition { if (!condition) throw new Error(('XY circle planar face: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512)); }
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
function exact(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => exact(value, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>; return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && exact(x[key], y[key])); } return Object.is(a, b);
}
function circleRequest(input: unknown): XYCircleFaceProfile {
  const data = record(input, ['kind', 'id', 'center', 'radius'], '$construction');
  check(data.kind === 'circle', '$construction.kind', 'exact original circle request required');
  const id = identifier(data.id, 64, '$construction.id');
  check(Array.isArray(data.center) && data.center.length === 2 && data.center.every(value => typeof value === 'number' && Math.abs(value) <= 10000), '$construction.center', 'finite XY centre within±10000mm required');
  check(typeof data.radius === 'number' && data.radius >= .001 && data.radius <= 10000, '$construction.radius', 'radius0.001..10000mm required');
  return { kind: 'circle', id, center: [data.center[0], data.center[1]], radius: data.radius };
}
function assemble(construction: XYCircleFaceProfile, faceId: string): { profile: XYArcResult; bundle: XYCirclePlanarFaceBundle } {
  const profile = buildXYArc(construction), source = profile.curve;
  const surfaceId = faceId + '_surface', loopId = faceId + '_loop', seamId = faceId + '_seam', edgeId = faceId + '_edge', pcurveId = faceId + '_uv';
  const ids = [construction.id, faceId, surfaceId, loopId, seamId, edgeId, pcurveId];
  check(ids.every(id => id.length <= 80) && new Set(ids).size === ids.length, '$ids', 'source/face/Surface/loop/seam/edge/pcurve IDs must be distinct and<=80');
  const [cx, cy] = construction.center, r = construction.radius, x0 = cx - r, x1 = cx + r, y0 = cy - r, y1 = cy + r;
  const surface: Surface = { kind: 'surface', id: surfaceId, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
    controlPoints: [[[x0, y0, 0], [x0, y1, 0]], [[x1, y0, 0], [x1, y1, 0]]], weights: [[1, 1], [1, 1]] };
  const uvCurve: Curve = { ...copyCadData(source), id: pcurveId,
    controlPoints: source.controlPoints.map(point => [(point[0] - x0) / (2 * r), (point[1] - y0) / (2 * r), 0]) };
  validateCurve(uvCurve); validateSurface(surface);
  const bundle: XYCirclePlanarFaceBundle = { construction: copyCadData(construction),
    geometry: { name: faceId, version: 0, lengthUnit: 'mm', objects: [copyCadData(source), surface] },
    topology: { version: 0, kind: 'xy-circle-planar-face', sourceCurveId: source.id,
      face: { id: faceId, surfaceId, outerLoopId: loopId, orientation: 'forward' },
      vertices: [{ id: seamId, point: copyCadData(source.controlPoints[0]) }],
      edges: [{ id: edgeId, curveId: source.id, vertexIds: [seamId, seamId], sourceParameterRange: [0, 4] }],
      loop: { id: loopId, uses: [{ edgeId, sense: 'forward', pcurve: { coordinateSystem: 'uv', domain: [0, 4], curve: uvCurve } }] } } };
  validateModel(bundle.geometry); return { profile, bundle };
}
function near(a: Point, b: Point, bound: number): boolean { return Math.hypot(...a.map((value, axis) => value - b[axis])) <= bound; }
function report(bundle: XYCirclePlanarFaceBundle): XYCirclePlanarFaceReport {
  const source = bundle.geometry.objects[0] as Curve, surface = bundle.geometry.objects[1] as Surface;
  const topology = bundle.topology, use = topology.loop.uses[0], pcurve = use.pcurve.curve;
  validateModel(bundle.geometry); validateCurve(source); validateCurve(pcurve); validateSurface(surface);
  check(exact(source.controlPoints[0], source.controlPoints[8]) && exact(topology.vertices[0].point, source.controlPoints[0]), '$seam', 'actual original endpoint equality/seam binding required');
  for (const t of [0, .5, 1, 1.5, 2, 2.5, 3, 3.5, 4]) {
    const uv = evaluateCurve(pcurve, t), point = evaluateCurve(source, t);
    const d1 = evaluateSurfaceD1(surface, uv[0], uv[1]);
    check(uv[2] === 0 && near(d1.point, point, 1e-7), '$pcurve #' + pcurve.id, 'actual world Curve/Surface(pcurve) finite comparison exceeds1e-7mm');
    const cross: Point = [d1.du[1] * d1.dv[2] - d1.du[2] * d1.dv[1], d1.du[2] * d1.dv[0] - d1.du[0] * d1.dv[2], d1.du[0] * d1.dv[1] - d1.du[1] * d1.dv[0]];
    check(cross.every(Number.isFinite) && cross[0] === 0 && cross[1] === 0 && cross[2] > 0, '$surface', 'actual SurfaceD1 forward normal+Z required');
    if (!Number.isInteger(t)) {
      const nativeD1 = evaluateCurveD1(source, t), uvD1 = evaluateCurveD1(pcurve, t);
      const chain = d1.du.map((value, axis) => value * uvD1.derivative[0] + d1.dv[axis] * uvD1.derivative[1]) as Point;
      check(uvD1.derivative[2] === 0 && near(chain, nativeD1.derivative, 1e-9 * Math.max(1, Math.hypot(...nativeD1.derivative))), '$pcurve.derivative', 'actual interior derivative chain mismatch');
    }
  }
  const { center, radius } = bundle.construction;
  return { trimFamily: 'xy-circle-planar-face-v0', sourceCurveId: source.id, faceId: topology.face.id, surfaceId: surface.id, outerLoopId: topology.loop.id,
    edgeId: topology.edges[0].id, pcurveId: pcurve.id, seamVertexId: topology.vertices[0].id,
    nativeDomain: curveDomain(source), uvDomain: curveDomain(pcurve), surfaceDomain: surfaceDomain(surface), centerMM: copyCadData(center), radiusMM: radius,
    boundsMM: { min: copyCadData(surface.controlPoints[0][0]), max: copyCadData(surface.controlPoints[1][1]) },
    vertexCount: 1, edgeCount: 1, loopUseCount: 1, nativeObjectCount: 2, referenceDiskAreaMM2: Math.PI * radius * radius, incidenceValid: true,
    periodic: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    limits: { authoredIdCharacters: 64, derivedIdCharacters: 80, snapshotValues: 8192, snapshotDepth: 10, arrayElements: 64, recordFields: 12, stringCharacters: 128,
      evaluationComparisonMM: 1e-7, derivativeComparisonRelative: 1e-9, planeToleranceMM: 1e-7, boundaryToleranceMM: 1e-7 } };
}
function validateOwned(input: unknown): { bundle: XYCirclePlanarFaceBundle; report: XYCirclePlanarFaceReport } {
  const data = record(input, ['construction', 'geometry', 'topology'], '$bundle');
  const topology = record(data.topology, ['version', 'kind', 'sourceCurveId', 'face', 'vertices', 'edges', 'loop'], '$bundle.topology');
  check(topology.version === 0 && topology.kind === 'xy-circle-planar-face', '$bundle.topology', 'original circle planar face family0 required');
  const face = record(topology.face, ['id', 'surfaceId', 'outerLoopId', 'orientation'], '$bundle.topology.face');
  const faceId = identifier(face.id, 64, '$bundle.topology.face.id'), construction = circleRequest(data.construction);
  const expected = assemble(construction, faceId).bundle;
  check(exact(input, expected), '$bundle', 'canonical original world Curve/Surface/seam/closed-edge/use/UV pcurve binding mismatch');
  return { bundle: expected, report: report(expected) };
}
export function buildXYCirclePlanarFace(profile: XYCircleFaceProfile, options: XYCirclePlanarFaceOptions): XYCirclePlanarFaceResult {
  const construction = circleRequest(snapshot(profile, '$profile')), data = record(snapshot(options, '$options'), ['faceId'], '$options');
  const { profile: original, bundle } = assemble(construction, identifier(data.faceId, 64, '$options.faceId'));
  return copyCadData({ profile: original, bundle, report: report(bundle) });
}
export function validateXYCirclePlanarFaceBundle(bundle: XYCirclePlanarFaceBundle): XYCirclePlanarFaceReport {
  return copyCadData(validateOwned(snapshot(bundle, '$bundle')).report);
}
export function classifyXYCirclePlanarFacePoint(bundle: XYCirclePlanarFaceBundle, pointMM: Point): XYCirclePlanarFacePointResult {
  const validated = validateOwned(snapshot(bundle, '$bundle')), point = snapshot(pointMM, '$point');
  check(Array.isArray(point) && point.length === 3 && point.every(value => typeof value === 'number' && Math.abs(value) <= 10000), '$point', 'finite XYZ tuple within±10000mm required');
  const q = point as Point, { center, radius } = validated.bundle.construction, surface = validated.bundle.geometry.objects[1] as Surface;
  const distance = Math.hypot(q[0] - center[0], q[1] - center[1]), epsilon = 1e-7;
  const classification: XYCirclePlanarFacePointResult['classification'] = Math.abs(q[2]) > epsilon ? 'off-plane'
    : distance < radius - epsilon ? 'inside' : Math.abs(distance - radius) <= epsilon ? 'boundary' : 'outside';
  const origin = surface.controlPoints[0][0];
  const uv: [number, number] = [(q[0] - origin[0]) / (surface.controlPoints[1][0][0] - origin[0]), (q[1] - origin[1]) / (surface.controlPoints[0][1][1] - origin[1])];
  const surfaceUV = classification !== 'off-plane' && uv.every(value => Number.isFinite(value) && value >= 0 && value <= 1) ? uv : null;
  return copyCadData({ classification, pointMM: q, faceId: validated.report.faceId, surfaceId: validated.report.surfaceId, sourceCurveId: validated.report.sourceCurveId,
    edgeId: classification === 'boundary' ? validated.report.edgeId : null, surfaceUV, policy: { planeToleranceMM: 1e-7, boundaryToleranceMM: 1e-7 } });
}
