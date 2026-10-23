import { validateXYCirclePrismShellBundle } from './xy-circle-prism-shell.js';
import type { XYCirclePrismShellBundle, XYCirclePrismShellReport, XYCirclePrismShellUse } from './xy-circle-prism-shell.js';
import { evaluateCurve, evaluateSurface, surfaceDomain } from './core/math.js';
import { evaluateSurfaceD1 } from './core/derivatives.js';
import { validatePreviewPacket } from './core/packet.js';
import type { PreviewPacket } from './core/packet.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Point } from './types.js';

export interface XYCirclePrismShellPreviewOptions { meshId: string; revision: number; segmentsPerQuarter: number }
export interface XYCirclePrismWallPanel {
  parameterRange: [number, number]; normalSampleUV: [number, number]; normal: Point;
  vertexRange: [number, number]; indexRange: [number, number];
}
export interface XYCirclePrismShellFaceRange {
  faceId: string; surfaceId: string; role: 'bottom-cap' | 'top-cap' | 'wall'; orientation: 'forward' | 'reverse';
  vertexRange: [number, number]; indexRange: [number, number]; domain: { u: [number, number]; v: [number, number] };
  capSampling?: { kind: 'native-parameter-fan'; edgeId: string; curveId: string; loopId: string; useId: string; pcurveId: string;
    loopSense: 'forward' | 'reverse'; centerUV: [number, number]; boundaryParameters: number[] };
  wallPanels?: XYCirclePrismWallPanel[];
}
export interface XYCirclePrismShellEdgePath { id: string; points: Point[] }
export interface XYCirclePrismShellEdgeProvenance {
  shellId: string; edgeId: string; curveId: string; vertexIds: [string, string]; sourceParameterRange: [number, number]; sampledParameters: number[];
  uses: { useId: string; faceId: string; surfaceId: string; loopId: string; pcurveId: string; sense: 'forward' | 'reverse';
    pcurve: XYCirclePrismShellUse['pcurve']; sampledUVs: [number, number][]; observedBindingDifferenceMM: number }[];
}
export interface XYCirclePrismShellPreviewReport {
  kind: 'xy-circle-prism-shell-preview'; native: XYCirclePrismShellReport; shellId: string; sourceCurveId: string;
  meshId: string; revision: number; segmentsPerQuarter: number; faceCount: 3; vertexCount: number; triangleCount: number;
  edgePathCount: 3; edgePathPointCounts: number[]; boundsMM: { min: Point; max: Point };
  areasMM2: { bottomCap: number; topCap: number; wall: number; total: number };
  referenceBoundaryAreaMM2: number; areaDifferenceMM2: number; observedChordDeviationMM: number;
  chordDeviationByEdge: { edgeId: string; observedChordDeviationMM: number }[]; observedSurfaceBindingDifferenceMM: number;
  sampling: { kind: 'uniform-native-parameter'; segmentsPerQuarter: number; boundaryParameters: number[]; wallNormalMethod: 'native-midpoint-faceted' };
  existingGPUOverlayPathBudget: { maximumPathPoints: 64; segmentsPerQuarterMaximum: 15; withinPathBudget: boolean };
  limits: { segmentsPerQuarter: [2, 32]; maximumVertices: 770; maximumTriangles: 512; maximumEdgePaths: 3; maximumCirclePathPoints: 129;
    snapshotValues: 32768; snapshotDepth: 14; arrayElements: 128; recordFields: 24; stringCharacters: 128; meshIdCharacters: 64;
    evaluationComparisonMM: 1e-7; float32Policy: 'positive-outward-world-coordinate-triangles' };
  periodic: false; candidateClosedShell: true; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
}
export interface XYCirclePrismShellPreviewResult {
  packet: PreviewPacket; faceRanges: XYCirclePrismShellFaceRange[]; edgePaths: XYCirclePrismShellEdgePath[];
  edgeProvenance: XYCirclePrismShellEdgeProvenance[]; report: XYCirclePrismShellPreviewReport;
}
function check(condition: boolean, path: string, detail: string): asserts condition { if (!condition) throw new Error(('XY circle prism preview: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512)); }
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
function nativeIds(data: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(data)) for (const value of data) nativeIds(value, result);
  else if (data !== null && typeof data === 'object') for (const [key, value] of Object.entries(data)) {
    if ((key === 'id' || key === 'name') && typeof value === 'string') result.add(value); nativeIds(value, result);
  }
  return result;
}
function normal(surface: Surface, uv: [number, number], orientation = 1): Point {
  const d1 = evaluateSurfaceD1(surface, ...uv), a = d1.du, b = d1.dv;
  const vector: Point = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], magnitude = Math.hypot(...vector);
  check(Number.isFinite(magnitude) && magnitude > 0, '$normals', 'finite actual native derivative normal required');
  return vector.map(value => orientation * value / magnitude) as Point;
}
function cross(a: Point, b: Point, c: Point): Point {
  const u = b.map((value, axis) => value - a[axis]), v = c.map((value, axis) => value - a[axis]);
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}
export function tessellateXYCirclePrismShell(input: XYCirclePrismShellBundle, inputOptions: XYCirclePrismShellPreviewOptions): XYCirclePrismShellPreviewResult {
  const bundle = snapshot(input, '$bundle') as XYCirclePrismShellBundle;
  const options = record(snapshot(inputOptions, '$options'), ['meshId', 'revision', 'segmentsPerQuarter'], '$options');
  const meshId = identifier(options.meshId, 64, '$options.meshId'), revision = options.revision, k = options.segmentsPerQuarter;
  check(typeof revision === 'number' && Number.isInteger(revision) && revision >= 0 && revision <= 2147483647, '$options.revision', 'integer revision0..2147483647 required');
  check(typeof k === 'number' && Number.isInteger(k) && k >= 2 && k <= 32, '$options.segmentsPerQuarter', 'integer segmentsPerQuarter2..32 required');
  const native = validateXYCirclePrismShellBundle(bundle);
  check(!nativeIds(bundle).has(meshId), '$options.meshId', 'display ID must differ from native IDs and Model names');
  const n = 4 * k, sampledParameters = Array.from({ length: n + 1 }, (_, j) => j / k), boundaryParameters = sampledParameters.slice(0, -1);
  const positions: number[] = [], normals: number[] = [], parameters: number[] = [], indices: number[] = [], faceRanges: XYCirclePrismShellFaceRange[] = [];
  const areasMM2 = { bottomCap: 0, topCap: 0, wall: 0, total: 0 }; let observedSurfaceBindingDifferenceMM = 0;
  const pointAt = (vertex: number, float32 = false): Point => positions.slice(vertex * 3, vertex * 3 + 3).map(value => float32 ? Math.fround(value) : value) as Point;
  const emit = (surface: Surface, uv: [number, number], nrm: Point, cap = false): Point => {
    const domain = surfaceDomain(surface);
    check(uv.every(Number.isFinite) && uv[0] >= domain.u[0] && uv[0] <= domain.u[1] && uv[1] >= domain.v[0] && uv[1] <= domain.v[1], '$parameters', 'actual native UV outside owning Surface domain');
    // Point queries at wall C0 knots are valid. Only cap planes use D1 here.
    const point = cap ? evaluateSurfaceD1(surface, ...uv).point : evaluateSurface(surface, ...uv);
    positions.push(...point); normals.push(...nrm); parameters.push(...uv); return point;
  };
  const triangle = (a: number, b: number, c: number): number => {
    const vertices = [a, b, c]; let area = 0;
    for (const float32 of [false, true]) {
      const vector = cross(pointAt(a, float32), pointAt(b, float32), pointAt(c, float32)), magnitude = Math.hypot(...vector);
      check(Number.isFinite(magnitude) && magnitude > 0, '$triangles', float32 ? 'Float32 world-coordinate triangle collapsed; valid native shell cannot use this display sampling' : 'actual native face display triangle collapsed');
      for (const vertex of vertices) check(vector.reduce((dot, value, axis) => dot + value * normals[vertex * 3 + axis], 0) > 0, '$triangles', 'actual/Float32 winding disagrees with assigned native-derived normal');
      if (!float32) area = magnitude / 2;
    }
    indices.push(...vertices); return area;
  };
  for (const face of bundle.topology.faces) {
    const surface = bundle.geometry.objects.find(object => object.id === face.surfaceId) as Surface;
    const loop = bundle.topology.loops.find(loop => loop.id === face.outerLoopId)!;
    const start = positions.length / 3, indexStart = indices.length, domain = surfaceDomain(surface);
    const range: XYCirclePrismShellFaceRange = { faceId: face.id, surfaceId: surface.id, role: face.role, orientation: face.orientation,
      vertexRange: [start, start], indexRange: [indexStart, indexStart], domain };
    let area = 0;
    if (face.role !== 'wall') {
      const use = loop.uses[0], edge = bundle.topology.edges.find(edge => edge.id === use.edgeId)!;
      const curve = bundle.geometry.objects.find(object => object.id === edge.curveId) as Curve, pcurve = use.pcurve.curve, center = bundle.construction.profile.center, origin = surface.controlPoints[0][0];
      const centerUV: [number, number] = [(center[0] - origin[0]) / (surface.controlPoints[1][0][0] - origin[0]), (center[1] - origin[1]) / (surface.controlPoints[0][1][1] - origin[1])];
      const orientation = face.orientation === 'forward' ? 1 : -1;
      emit(surface, centerUV, normal(surface, centerUV, orientation), true);
      for (const t of boundaryParameters) {
        const uvPoint = evaluateCurve(pcurve, t), uv: [number, number] = [uvPoint[0], uvPoint[1]], point = emit(surface, uv, normal(surface, uv, orientation), true);
        const nativePoint = evaluateCurve(curve, t), difference = Math.hypot(...point.map((value, axis) => value - nativePoint[axis]));
        check(Number.isFinite(difference) && difference <= 1e-7, '$caps #' + face.id, 'actual cap Curve/Surface(pcurve) comparison exceeds1e-7mm');
        observedSurfaceBindingDifferenceMM = Math.max(observedSurfaceBindingDifferenceMM, difference);
      }
      for (let j = 0; j < n; j++) {
        const a = start + 1 + j, b = start + 1 + (j + 1) % n;
        // Face orientation reverses the bottom exactly once, not coedge sense again.
        area += triangle(start, orientation > 0 ? a : b, orientation > 0 ? b : a);
      }
      range.capSampling = { kind: 'native-parameter-fan', edgeId: edge.id, curveId: curve.id, loopId: loop.id, useId: use.id, pcurveId: pcurve.id,
        loopSense: use.sense, centerUV, boundaryParameters: copyCadData(boundaryParameters) };
    } else {
      const panels: XYCirclePrismWallPanel[] = [];
      for (let j = 0; j < n; j++) {
        const u0 = sampledParameters[j], u1 = sampledParameters[j + 1], midpoint = (u0 + u1) / 2, normalSampleUV: [number, number] = [midpoint, .5];
        check(midpoint > u0 && midpoint < u1 && ![1, 2, 3].includes(midpoint), '$wall', 'normal midpoint must be inside an original C1 knot span');
        const nrm = normal(surface, normalSampleUV), vertexStart = positions.length / 3, scalarStart = indices.length;
        for (const uv of [[u0, 0], [u1, 0], [u0, 1], [u1, 1]] as [number, number][]) emit(surface, uv, nrm);
        area += triangle(vertexStart, vertexStart + 1, vertexStart + 2) + triangle(vertexStart + 1, vertexStart + 3, vertexStart + 2);
        panels.push({ parameterRange: [u0, u1], normalSampleUV, normal: copyCadData(nrm), vertexRange: [vertexStart, vertexStart + 4], indexRange: [scalarStart, indices.length] });
      }
      range.wallPanels = panels;
    }
    range.vertexRange[1] = positions.length / 3; range.indexRange[1] = indices.length; faceRanges.push(range);
    if (face.role === 'bottom-cap') areasMM2.bottomCap = area; else if (face.role === 'top-cap') areasMM2.topCap = area; else areasMM2.wall = area;
    areasMM2.total += area;
  }
  check(positions.length / 3 === 6 * n + 2 && indices.length / 3 === 4 * n, '$packet', 'bounded actual cap/wall mesh count mismatch');
  const bounds: { min: Point; max: Point } = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < positions.length; i += 3) for (let axis = 0; axis < 3; axis++) {
    bounds.min[axis] = Math.min(bounds.min[axis], positions[i + axis]); bounds.max[axis] = Math.max(bounds.max[axis], positions[i + axis]);
  }
  const packet: PreviewPacket = { version: 0, surfaceId: meshId, revision, lengthUnit: 'mm', coordinateSystem: 'right-handed-y-up', winding: 'ccw', positions, normals, indices, parameters, bounds };
  validatePreviewPacket(packet);
  const edgePaths: XYCirclePrismShellEdgePath[] = [], edgeProvenance: XYCirclePrismShellEdgeProvenance[] = [], chordDeviationByEdge: XYCirclePrismShellPreviewReport['chordDeviationByEdge'] = [];
  for (const edge of bundle.topology.edges) {
    const curve = bundle.geometry.objects.find(object => object.id === edge.curveId) as Curve;
    const ts = edge.sourceParameterRange[1] === 4 ? copyCadData(sampledParameters) : [0, 1], points = ts.map(t => evaluateCurve(curve, t));
    edgePaths.push({ id: edge.id, points });
    const uses: XYCirclePrismShellEdgeProvenance['uses'] = [];
    for (const loop of bundle.topology.loops) for (const use of loop.uses) if (use.edgeId === edge.id) {
      const face = bundle.topology.faces.find(face => face.id === loop.faceId)!, surface = bundle.geometry.objects.find(object => object.id === face.surfaceId) as Surface;
      let observedBindingDifferenceMM = 0; const sampledUVs: [number, number][] = [];
      for (let i = 0; i < ts.length; i++) {
        const uvPoint = evaluateCurve(use.pcurve.curve, ts[i]), uv: [number, number] = [uvPoint[0], uvPoint[1]], actual = evaluateSurface(surface, ...uv);
        const difference = Math.hypot(...actual.map((value, axis) => value - points[i][axis]));
        check(Number.isFinite(difference) && difference <= 1e-7, '$edgeUses #' + use.id, 'actual Curve/Surface(pcurve) comparison exceeds1e-7mm');
        observedBindingDifferenceMM = Math.max(observedBindingDifferenceMM, difference); sampledUVs.push(uv);
      }
      observedSurfaceBindingDifferenceMM = Math.max(observedSurfaceBindingDifferenceMM, observedBindingDifferenceMM);
      uses.push({ useId: use.id, faceId: face.id, surfaceId: surface.id, loopId: loop.id, pcurveId: use.pcurve.curve.id, sense: use.sense,
        pcurve: copyCadData(use.pcurve), sampledUVs, observedBindingDifferenceMM });
    }
    check(uses.length === 2 && uses[0].sense !== uses[1].sense, '$edgeProvenance', 'both original opposite uses required, even when they own the same wall');
    edgeProvenance.push({ shellId: bundle.topology.id, edgeId: edge.id, curveId: curve.id, vertexIds: copyCadData(edge.vertexIds), sourceParameterRange: copyCadData(edge.sourceParameterRange), sampledParameters: ts, uses });
    if (edge.sourceParameterRange[1] === 4) {
      let deviation = 0;
      for (let j = 0; j < n; j++) {
        const midpoint = evaluateCurve(curve, (ts[j] + ts[j + 1]) / 2), chord = points[j].map((value, axis) => (value + points[j + 1][axis]) / 2) as Point;
        deviation = Math.max(deviation, Math.hypot(...midpoint.map((value, axis) => value - chord[axis])));
      }
      check(Number.isFinite(deviation), '$approximation', 'finite observed Curve/chord midpoint deviation required');
      chordDeviationByEdge.push({ edgeId: edge.id, observedChordDeviationMM: deviation });
    }
  }
  const report: XYCirclePrismShellPreviewReport = { kind: 'xy-circle-prism-shell-preview', native, shellId: bundle.topology.id, sourceCurveId: bundle.topology.sourceCurveId,
    meshId, revision, segmentsPerQuarter: k, faceCount: 3, vertexCount: positions.length / 3, triangleCount: indices.length / 3, edgePathCount: 3,
    edgePathPointCounts: edgePaths.map(path => path.points.length), boundsMM: bounds, areasMM2, referenceBoundaryAreaMM2: native.referenceBoundaryAreaMM2,
    areaDifferenceMM2: areasMM2.total - native.referenceBoundaryAreaMM2, observedChordDeviationMM: Math.max(...chordDeviationByEdge.map(item => item.observedChordDeviationMM)),
    chordDeviationByEdge, observedSurfaceBindingDifferenceMM,
    sampling: { kind: 'uniform-native-parameter', segmentsPerQuarter: k, boundaryParameters, wallNormalMethod: 'native-midpoint-faceted' },
    existingGPUOverlayPathBudget: { maximumPathPoints: 64, segmentsPerQuarterMaximum: 15, withinPathBudget: k <= 15 },
    limits: { segmentsPerQuarter: [2, 32], maximumVertices: 770, maximumTriangles: 512, maximumEdgePaths: 3, maximumCirclePathPoints: 129,
      snapshotValues: 32768, snapshotDepth: 14, arrayElements: 128, recordFields: 24, stringCharacters: 128, meshIdCharacters: 64, evaluationComparisonMM: 1e-7,
      float32Policy: 'positive-outward-world-coordinate-triangles' }, periodic: false, candidateClosedShell: true, geometricValidity: 'not-certified', topologyCertified: false, solid: false };
  return copyCadData({ packet, faceRanges, edgePaths, edgeProvenance, report });
}
