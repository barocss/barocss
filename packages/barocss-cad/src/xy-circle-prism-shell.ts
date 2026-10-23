import { buildXYCirclePlanarFace } from './xy-circle-planar-face.js';
import type { XYCircleFaceProfile, XYCirclePlanarFaceResult, XYCirclePlanarFaceReport } from './xy-circle-planar-face.js';
import type { XYArcResult } from './xy-arc.js';
import { extrudeCurve } from './core/extrusion.js';
import { validateModel, validateCurve, validateSurface, evaluateCurve, evaluateSurface, curveDomain, surfaceDomain } from './core/math.js';
import { evaluateSurfaceD1 } from './core/derivatives.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model, Point } from './types.js';
import type { XYPoint } from './xy-profile.js';

type Sense = 'forward' | 'reverse';
export interface XYCirclePrismShellOptions { shellId: string; heightMM: number }
export interface XYCirclePrismShellUse { id: string; edgeId: string; sense: Sense; pcurve: { coordinateSystem: 'uv'; domain: [number, number]; curve: Curve } }
export interface XYCirclePrismShellBundle {
  construction: { profile: XYCircleFaceProfile; shellId: string; heightMM: number }; geometry: Model;
  topology: { version: 0; kind: 'xy-circle-prism-shell'; id: string; sourceCurveId: string;
    vertices: { id: string; point: Point }[];
    edges: { id: string; curveId: string; vertexIds: [string, string]; sourceParameterRange: [number, number] }[];
    faces: { id: string; surfaceId: string; outerLoopId: string; orientation: Sense; role: 'bottom-cap' | 'top-cap' | 'wall' }[];
    loops: { id: string; faceId: string; uses: XYCirclePrismShellUse[] }[] };
}
export interface XYCirclePrismShellReport {
  trimFamily: 'xy-circle-prism-shell-v0'; sourceCurveId: string; shellId: string; heightMM: number; centerMM: XYPoint; radiusMM: number;
  baseFaceReport: XYCirclePlanarFaceReport;
  geometryIds: { bottomCurveId: string; topCurveId: string; seamCurveId: string; bottomSurfaceId: string; topSurfaceId: string; wallSurfaceId: string };
  domains: { bottomCurve: [number, number]; topCurve: [number, number]; seamCurve: [number, number];
    bottomSurface: { u: [number, number]; v: [number, number] }; topSurface: { u: [number, number]; v: [number, number] }; wallSurface: { u: [number, number]; v: [number, number] } };
  vertexCount: 2; edgeCount: 3; edgeUseCount: 6; faceCount: 3; loopCount: 3; nativeObjectCount: 6; boundsMM: { min: Point; max: Point };
  edgeIncidence: { edgeId: string; uses: { faceId: string; loopId: string; useId: string; sense: Sense }[] }[];
  loopObservations: { loopId: string; faceId: string; useCount: number; closed: true }[];
  normalObservations: { faceId: string; surfaceId: string; uv: [number, number]; pointMM: Point; normal: Point }[];
  referenceVolumeMM3: number; referenceLateralAreaMM2: number; referenceBoundaryAreaMM2: number;
  incidenceValid: true; candidateClosedShell: true; periodic: false; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { authoredIdCharacters: 48; derivedIdCharacters: 80; snapshotValues: 32768; snapshotDepth: 14; arrayElements: 128; recordFields: 24; stringCharacters: 128; evaluationComparisonMM: 1e-7 };
}
export interface XYCirclePrismShellResult { profile: XYArcResult; baseFace: XYCirclePlanarFaceResult; bundle: XYCirclePrismShellBundle; report: XYCirclePrismShellReport }
function check(condition: boolean, path: string, detail: string): asserts condition { if (!condition) throw new Error(('XY circle prism shell: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512)); }
function snapshot(input: unknown, rootPath: string): unknown {
  let remaining = 32768;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 14, path, 'input exceeds32768 values/depth14');
    if (typeof value === 'number') { check(Number.isFinite(value), path, 'finite data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, path, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', path, 'plain numeric/string/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value); check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, path, 'foreign prototype unsupported');
    const keys = Reflect.ownKeys(value); check(keys.length <= (array ? 129 : 24) && keys.every(key => typeof key === 'string' && key.length <= 128), path, 'bounded own fields required');
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
function request(input: unknown): XYCircleFaceProfile {
  const data = record(input, ['kind', 'id', 'center', 'radius'], '$profile');
  check(data.kind === 'circle', '$profile.kind', 'exact original circle request required');
  const id = identifier(data.id, 48, '$profile.id');
  check(Array.isArray(data.center) && data.center.length === 2 && data.center.every(value => typeof value === 'number' && Math.abs(value) <= 10000), '$profile.center', 'finite original XY centre required');
  check(typeof data.radius === 'number' && data.radius >= .001 && data.radius <= 10000, '$profile.radius', 'original radius0.001..10000mm required');
  return { kind: 'circle', id, center: [data.center[0], data.center[1]], radius: data.radius };
}
function options(input: unknown): XYCirclePrismShellOptions {
  const data = record(input, ['shellId', 'heightMM'], '$options'), shellId = identifier(data.shellId, 48, '$options.shellId');
  check(typeof data.heightMM === 'number' && data.heightMM >= .001 && data.heightMM <= 10000, '$options.heightMM', 'finite positive height0.001..10000mm required');
  return { shellId, heightMM: data.heightMM };
}
function assemble(profileRequest: XYCircleFaceProfile, opt: XYCirclePrismShellOptions): { profile: XYArcResult; baseFace: XYCirclePlanarFaceResult; bundle: XYCirclePrismShellBundle } {
  const { shellId, heightMM } = opt, bottomId = shellId + '_z_min', topId = shellId + '_z_max', wallId = shellId + '_wall';
  const baseFace = buildXYCirclePlanarFace(profileRequest, { faceId: bottomId }), bottom = baseFace.bundle, source = bottom.geometry.objects[0] as Curve;
  const bottomPlane = bottom.geometry.objects[1] as Surface, bottomVertex = bottom.topology.vertices[0], bottomEdge = bottom.topology.edges[0];
  const translated = (point: Point): Point => [point[0], point[1], point[2] + heightMM];
  const top: Curve = { ...copyCadData(source), id: topId + '_curve', controlPoints: source.controlPoints.map(translated) };
  const topVertex = { id: topId + '_seam', point: translated(bottomVertex.point) };
  const seam: Curve = { kind: 'curve', id: shellId + '_seam_curve', degree: 1, knots: [0, 0, 1, 1], controlPoints: [copyCadData(bottomVertex.point), copyCadData(topVertex.point)], weights: [1, 1] };
  const topPlane: Surface = { ...copyCadData(bottomPlane), id: topId + '_surface', controlPoints: bottomPlane.controlPoints.map(row => row.map(translated)) };
  const wall = extrudeCurve(source, { id: wallId + '_surface', vector: [0, 0, heightMM] });
  const topEdge = { id: topId + '_edge', curveId: top.id, vertexIds: [topVertex.id, topVertex.id] as [string, string], sourceParameterRange: [0, 4] as [number, number] };
  const seamEdge = { id: wallId + '_seam_edge', curveId: seam.id, vertexIds: [bottomVertex.id, topVertex.id] as [string, string], sourceParameterRange: [0, 1] as [number, number] };
  const bottomUse: XYCirclePrismShellUse = { ...copyCadData(bottom.topology.loop.uses[0]), id: bottomId + '_use', sense: 'reverse' };
  const topUV = { ...copyCadData(bottomUse.pcurve.curve), id: topId + '_uv' };
  const topUse: XYCirclePrismShellUse = { id: topId + '_use', edgeId: topEdge.id, sense: 'forward', pcurve: { coordinateSystem: 'uv', domain: [0, 4], curve: topUV } };
  const wallUse = (name: string, edgeId: string, sense: Sense, end: number, a: Point, b: Point): XYCirclePrismShellUse => ({
    id: wallId + '_' + name + '_use', edgeId, sense,
    pcurve: { coordinateSystem: 'uv', domain: [0, end], curve: { kind: 'curve', id: wallId + '_' + name + '_uv', degree: 1, knots: [0, 0, end, end], controlPoints: [a, b], weights: [1, 1] } }
  });
  const loops: XYCirclePrismShellBundle['topology']['loops'] = [
    { id: bottom.topology.loop.id, faceId: bottomId, uses: [bottomUse] },
    { id: topId + '_loop', faceId: topId, uses: [topUse] },
    { id: wallId + '_loop', faceId: wallId, uses: [
      wallUse('bottom', bottomEdge.id, 'forward', 4, [0, 0, 0], [4, 0, 0]),
      wallUse('right', seamEdge.id, 'forward', 1, [4, 0, 0], [4, 1, 0]),
      wallUse('top', topEdge.id, 'reverse', 4, [0, 1, 0], [4, 1, 0]),
      wallUse('left', seamEdge.id, 'reverse', 1, [0, 0, 0], [0, 1, 0])
    ] }
  ];
  const faces: XYCirclePrismShellBundle['topology']['faces'] = [
    { id: bottomId, surfaceId: bottomPlane.id, outerLoopId: loops[0].id, orientation: 'reverse', role: 'bottom-cap' },
    { id: topId, surfaceId: topPlane.id, outerLoopId: loops[1].id, orientation: 'forward', role: 'top-cap' },
    { id: wallId, surfaceId: wall.id, outerLoopId: loops[2].id, orientation: 'forward', role: 'wall' }
  ];
  const vertices = [copyCadData(bottomVertex), topVertex], edges = [copyCadData(bottomEdge), topEdge, seamEdge];
  const objects = [copyCadData(source), top, seam, copyCadData(bottomPlane), topPlane, wall];
  const ids = [shellId, ...objects.map(object => object.id), ...vertices.map(vertex => vertex.id), ...edges.map(edge => edge.id), ...faces.map(face => face.id), ...loops.map(loop => loop.id), ...loops.flatMap(loop => loop.uses.flatMap(use => [use.id, use.pcurve.curve.id]))];
  check(ids.every(id => id.length <= 80) && new Set(ids).size === ids.length, '$ids', 'all original/derived shell native identities must be distinct and<=80');
  const bundle: XYCirclePrismShellBundle = { construction: { profile: copyCadData(profileRequest), shellId, heightMM },
    geometry: { name: shellId, version: 0, lengthUnit: 'mm', objects },
    topology: { version: 0, kind: 'xy-circle-prism-shell', id: shellId, sourceCurveId: source.id, vertices, edges, faces, loops } };
  validateModel(bundle.geometry); return { profile: copyCadData(baseFace.profile), baseFace, bundle };
}
function near(a: Point, b: Point): boolean { return Math.hypot(...a.map((value, axis) => value - b[axis])) <= 1e-7; }
function observe(bundle: XYCirclePrismShellBundle, baseFaceReport: XYCirclePlanarFaceReport): XYCirclePrismShellReport {
  validateModel(bundle.geometry);
  const [bottom, top, seam, bottomPlane, topPlane, wall] = bundle.geometry.objects as [Curve, Curve, Curve, Surface, Surface, Surface];
  const topology = bundle.topology, vertexMap = new Map(topology.vertices.map(vertex => [vertex.id, vertex.point]));
  const edgeMap = new Map(topology.edges.map(edge => [edge.id, edge]));
  const edgeIncidence: XYCirclePrismShellReport['edgeIncidence'] = topology.edges.map(edge => ({ edgeId: edge.id, uses: [] }));
  const loopObservations: XYCirclePrismShellReport['loopObservations'] = [], normalObservations: XYCirclePrismShellReport['normalObservations'] = [];
  for (const loop of topology.loops) {
    const face = topology.faces.find(face => face.id === loop.faceId)!;
    const surface = bundle.geometry.objects.find(object => object.id === face.surfaceId) as Surface;
    validateSurface(surface);
    for (const [index, use] of loop.uses.entries()) {
      const edge = edgeMap.get(use.edgeId)!, curve = bundle.geometry.objects.find(object => object.id === edge.curveId) as Curve, uvCurve = use.pcurve.curve;
      validateCurve(curve); validateCurve(uvCurve);
      const domain = curveDomain(curve); check(exact(domain, use.pcurve.domain), '$pcurves #' + use.id, 'native edge/pcurve parameter domains must match');
      const samples = domain[1] === 4 ? [0, .5, 1, 1.5, 2, 2.5, 3, 3.5, 4] : [0, .5, 1];
      for (const t of samples) {
        const uv = evaluateCurve(uvCurve, t), point = evaluateCurve(curve, t), actual = evaluateSurface(surface, uv[0], uv[1]);
        check(uv[2] === 0 && near(actual, point), '$pcurves #' + use.id, 'actual Curve/Surface(pcurve) point comparison exceeds1e-7mm');
      }
      for (let end = 0; end < 2; end++) check(near(evaluateCurve(curve, domain[end]), vertexMap.get(edge.vertexIds[end])!), '$edges #' + edge.id, 'actual native endpoint/seam vertex mismatch');
      const nextUse = loop.uses[(index + 1) % loop.uses.length], nextEdge = edgeMap.get(nextUse.edgeId)!;
      const endVertex = edge.vertexIds[use.sense === 'forward' ? 1 : 0], startVertex = nextEdge.vertexIds[nextUse.sense === 'forward' ? 0 : 1];
      check(endVertex === startVertex, '$loops #' + loop.id, 'directed native vertex IDs must close without coordinate welding');
      const nextCurve = bundle.geometry.objects.find(object => object.id === nextEdge.curveId) as Curve, nextDomain = curveDomain(nextCurve);
      const endPoint = evaluateCurve(curve, domain[use.sense === 'forward' ? 1 : 0]), startPoint = evaluateCurve(nextCurve, nextDomain[nextUse.sense === 'forward' ? 0 : 1]);
      check(near(endPoint, startPoint), '$loops #' + loop.id, 'actual directed native loop corner mismatch');
      edgeIncidence.find(entry => entry.edgeId === edge.id)!.uses.push({ faceId: face.id, loopId: loop.id, useId: use.id, sense: use.sense });
    }
    loopObservations.push({ loopId: loop.id, faceId: face.id, useCount: loop.uses.length, closed: true });
    const uValues = face.role === 'wall' ? [.5, 1.5, 2.5, 3.5] : [.5];
    for (const u of uValues) {
      const uv: [number, number] = [u, .5], d1 = evaluateSurfaceD1(surface, ...uv);
      const cross: Point = [d1.du[1] * d1.dv[2] - d1.du[2] * d1.dv[1], d1.du[2] * d1.dv[0] - d1.du[0] * d1.dv[2], d1.du[0] * d1.dv[1] - d1.du[1] * d1.dv[0]], magnitude = Math.hypot(...cross);
      check(Number.isFinite(magnitude) && magnitude > 0, '$normals #' + face.id, 'finite actual native interior normal required');
      const sign = face.orientation === 'forward' ? 1 : -1, normal = cross.map(value => sign * value / magnitude) as Point;
      if (face.role === 'wall') {
        const radial: Point = [d1.point[0] - bundle.construction.profile.center[0], d1.point[1] - bundle.construction.profile.center[1], 0];
        check(normal[0] * radial[0] + normal[1] * radial[1] > 0, '$normals #' + face.id, 'actual half-span wall normal must face outward');
      } else check(normal[2] === sign, '$normals #' + face.id, 'actual oriented cap normal must be-Z/+Z');
      normalObservations.push({ faceId: face.id, surfaceId: surface.id, uv, pointMM: d1.point, normal });
    }
  }
  for (const entry of edgeIncidence) check(entry.uses.length === 2 && entry.uses[0].sense !== entry.uses[1].sense, '$incidence #' + entry.edgeId, 'exactly two opposite native loop uses required; seam may repeat on same wall');
  const { profile, shellId, heightMM } = bundle.construction, r = profile.radius;
  return { trimFamily: 'xy-circle-prism-shell-v0', sourceCurveId: bottom.id, shellId, heightMM, centerMM: copyCadData(profile.center), radiusMM: r, baseFaceReport,
    geometryIds: { bottomCurveId: bottom.id, topCurveId: top.id, seamCurveId: seam.id, bottomSurfaceId: bottomPlane.id, topSurfaceId: topPlane.id, wallSurfaceId: wall.id },
    domains: { bottomCurve: curveDomain(bottom), topCurve: curveDomain(top), seamCurve: curveDomain(seam), bottomSurface: surfaceDomain(bottomPlane), topSurface: surfaceDomain(topPlane), wallSurface: surfaceDomain(wall) },
    vertexCount: 2, edgeCount: 3, edgeUseCount: 6, faceCount: 3, loopCount: 3, nativeObjectCount: 6,
    boundsMM: { min: copyCadData(bottomPlane.controlPoints[0][0]), max: copyCadData(topPlane.controlPoints[1][1]) }, edgeIncidence, loopObservations, normalObservations,
    referenceVolumeMM3: Math.PI * r * r * heightMM, referenceLateralAreaMM2: 2 * Math.PI * r * heightMM,
    referenceBoundaryAreaMM2: 2 * Math.PI * r * r + 2 * Math.PI * r * heightMM,
    incidenceValid: true, candidateClosedShell: true, periodic: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    limits: { authoredIdCharacters: 48, derivedIdCharacters: 80, snapshotValues: 32768, snapshotDepth: 14, arrayElements: 128, recordFields: 24, stringCharacters: 128, evaluationComparisonMM: 1e-7 } };
}
function validateOwned(input: unknown): { bundle: XYCirclePrismShellBundle; report: XYCirclePrismShellReport } {
  const data = record(input, ['construction', 'geometry', 'topology'], '$bundle');
  const construction = record(data.construction, ['profile', 'shellId', 'heightMM'], '$bundle.construction');
  const assembled = assemble(request(construction.profile), options({ shellId: construction.shellId, heightMM: construction.heightMM }));
  check(exact(input, assembled.bundle), '$bundle', 'canonical circle caps/ruled wall/seam/Curve/Surface/pcurve/native use binding mismatch');
  return { bundle: assembled.bundle, report: observe(assembled.bundle, assembled.baseFace.report) };
}
export function buildXYCirclePrismShell(profile: XYCircleFaceProfile, inputOptions: XYCirclePrismShellOptions): XYCirclePrismShellResult {
  const assembled = assemble(request(snapshot(profile, '$profile')), options(snapshot(inputOptions, '$options')));
  return copyCadData({ ...assembled, report: observe(assembled.bundle, assembled.baseFace.report) });
}
export function validateXYCirclePrismShellBundle(bundle: XYCirclePrismShellBundle): XYCirclePrismShellReport {
  return copyCadData(validateOwned(snapshot(bundle, '$bundle')).report);
}
