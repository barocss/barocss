import { validateXYPolygonPlanarFaceWithHoleBundle } from './xy-polygon-planar-face-hole.js';
import type { XYPolygonPlanarFaceWithHoleBundle, XYPolygonPlanarFaceWithHoleReport } from './xy-polygon-planar-face-hole.js';
import { evaluateCurve, curveDomain, surfaceDomain } from '../core/math.js';
import { evaluateSurfaceD1 } from '../core/derivatives.js';
import { validatePreviewPacket } from '../core/packet.js';
import type { PreviewPacket } from '../core/packet.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Point } from '../types.js';

export interface XYPolygonHoleFacePreviewOptions { meshId: string; revision: number }
export interface XYPolygonHoleRational { numerator: number; denominator: number }
export interface XYPolygonHolePreviewCorner {
  edgeId: string; curveId: string; sourceCurveId: string; loopId: string; loopRole: 'outer' | 'hole';
  nativeParameter: number; sourceParameter: number; parameterFraction: XYPolygonHoleRational;
  planarPoint: { xMM: number; yMM: XYPolygonHoleRational }; uv: [number, number];
}
export interface XYPolygonHolePreviewSlab {
  xRange: [number, number]; midpointX: XYPolygonHoleRational;
  intervals: { lowerEdgeId: string; upperEdgeId: string; vertexRange: [number, number]; indexRange: [number, number];
    omittedCollapsedTriangles: number; corners: XYPolygonHolePreviewCorner[] }[];
}
export interface XYPolygonHolePreviewEdgeProvenance {
  faceId: string; surfaceId: string; edgeId: string; curveId: string; sourceCurveId: string;
  sourceSegmentIndex: number; sourceParameterRange: [number, number]; loopId: string; loopRole: 'outer' | 'hole';
  nativeDomain: [number, number]; loopSense: 'forward' | 'reverse';
}
export interface XYPolygonHoleFacePreviewReport {
  kind: 'xy-polygon-planar-face-with-hole-preview'; sourceVersion: 0; faceId: string; surfaceId: string; meshId: string; revision: number;
  native: XYPolygonPlanarFaceWithHoleReport; vertexCount: number; triangleCount: number; edgePathCount: number;
  slabCount: number; trapezoidCount: number;
  area: { nativeMM2: number; meshMM2: number; differenceMM2: number; comparisonMM2: number };
  decomposition: XYPolygonHolePreviewSlab[];
  limits: { combinedVertices: 12; maximumSlabs: 11; maximumTrapezoids: 66; maximumVertices: 264; maximumTriangles: 132;
    maximumEdgePaths: 12; rationalNumeratorAbsolute: 1200000000; rationalDenominator: 40000;
    snapshotValues: 16384; snapshotDepth: 12; arrayElements: 128; recordFields: 16; stringCharacters: 128;
    evaluationComparisonMM: 1e-9; float32Policy: 'positive-world-coordinate-triangle-area' };
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
}
export interface XYPolygonHoleFacePreviewResult {
  packet: PreviewPacket; edgePaths: { id: string; points: [Point, Point] }[];
  edgeProvenance: XYPolygonHolePreviewEdgeProvenance[]; report: XYPolygonHoleFacePreviewReport;
}
type NativeEdge = XYPolygonPlanarFaceWithHoleBundle['topology']['edges'][number];
type NativeUse = XYPolygonPlanarFaceWithHoleBundle['topology']['loops'][number]['uses'][number];
type Segment = { edge: NativeEdge; use: NativeUse; curve: Curve; domain: [number, number]; a: Point; b: Point };
type Rational = XYPolygonHoleRational;
function check(condition: boolean, path: string, detail: string): asserts condition {
  if (!condition) throw new Error(('XY polygon hole face preview: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512));
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
function integer(value: number, path: string): number { check(Number.isSafeInteger(value), path, 'unsafe exact integer arithmetic'); return value; }
function rational(numerator: number, denominator: number): Rational {
  integer(numerator, '$rational.numerator'); integer(denominator, '$rational.denominator');
  check(denominator !== 0 && Math.abs(numerator) <= 1200000000 && Math.abs(denominator) <= 40000, '$rational', 'original-coordinate rational budget exceeded');
  if (denominator < 0) { numerator = -numerator; denominator = -denominator; }
  if (numerator === 0) return { numerator: 0, denominator: 1 };
  let a = Math.abs(numerator), b = denominator;
  while (b !== 0) { const remainder = a % b; a = b; b = remainder; }
  return { numerator: numerator / a, denominator: denominator / a };
}
function compare(a: Rational, b: Rational): number {
  return Math.sign(integer(integer(a.numerator * b.denominator, '$rational.compare') - integer(b.numerator * a.denominator, '$rational.compare'), '$rational.compare'));
}
function yAt(segment: Segment, x: Rational): Rational {
  const dx = integer(segment.b[0] - segment.a[0], '$segment.dx'), dy = integer(segment.b[1] - segment.a[1], '$segment.dy');
  check(dx !== 0, '$segment #' + segment.edge.id, 'vertical segment cannot support a slab interior');
  const offset = integer(x.numerator - integer(segment.a[0] * x.denominator, '$segment.x'), '$segment.x');
  const denominator = integer(dx * x.denominator, '$segment.denominator');
  return rational(integer(integer(segment.a[1] * denominator, '$segment.y') + integer(dy * offset, '$segment.y'), '$segment.y'), denominator);
}
function admitOptions(input: unknown): XYPolygonHoleFacePreviewOptions {
  const value = snapshot(input, '$options');
  check(value !== null && typeof value === 'object' && !Array.isArray(value), '$options', 'options record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === 2 && Object.hasOwn(data, 'meshId') && Object.hasOwn(data, 'revision'), '$options', 'exact meshId/revision fields required');
  check(typeof data.meshId === 'string' && data.meshId.length <= 128 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.meshId), '$meshId', 'ASCII mesh ID1..128 required');
  check(typeof data.revision === 'number' && Number.isInteger(data.revision) && data.revision >= 0 && data.revision <= 2147483647, '$revision', 'integer revision0..2147483647 required');
  return { meshId: data.meshId, revision: data.revision };
}
function nativeIds(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) nativeIds(item, result);
  else if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    if ((key === 'id' || key === 'name') && typeof item === 'string') result.add(item); nativeIds(item, result);
  }
  return result;
}
function resolveSegments(bundle: XYPolygonPlanarFaceWithHoleBundle): Segment[] {
  const segments: Segment[] = [];
  for (const loop of bundle.topology.loops) for (const use of loop.uses) {
    const edge = bundle.topology.edges.find(edge => edge.id === use.edgeId);
    check(!!edge && edge.loopId === loop.id && edge.loopRole === loop.role && edge.sourceCurveId === loop.sourceCurveId, '$segments', 'qualified native use/source/role required');
    const curve = bundle.geometry.objects.find(object => object.id === edge.curveId);
    check(curve?.kind === 'curve', '$segments', 'actual owning native Curve required');
    const domain = curveDomain(curve), a = evaluateCurve(curve, domain[0]), b = evaluateCurve(curve, domain[1]);
    check([a, b].every(point => point.every(value => Number.isInteger(value) && Math.abs(value) <= 10000) && point[2] === 0), '$segments', 'actual integer XY/Z0 endpoints required');
    segments.push({ edge, use, curve, domain, a, b });
  }
  check(segments.length === bundle.topology.edges.length && segments.length <= 12 && new Set(segments.map(segment => segment.edge.id)).size === segments.length, '$segments', 'one directed use per original native edge required');
  return segments;
}
/** Bounded exact slab connectivity; emitted geometry comes from actual Surface/D1. */
export function tessellateXYPolygonPlanarFaceWithHole(input: XYPolygonPlanarFaceWithHoleBundle, inputOptions: XYPolygonHoleFacePreviewOptions): XYPolygonHoleFacePreviewResult {
  const bundle = snapshot(input, '$bundle') as XYPolygonPlanarFaceWithHoleBundle, options = admitOptions(inputOptions);
  const native = validateXYPolygonPlanarFaceWithHoleBundle(bundle);
  check(!nativeIds(bundle).has(options.meshId), '$meshId', 'derived display ID must differ from all native IDs and Model name');
  const surface = bundle.geometry.objects.find(object => object.id === bundle.topology.face.surfaceId);
  check(surface?.kind === 'surface', '$surface', 'actual shared owning Surface required');
  const domain = surfaceDomain(surface), segments = resolveSegments(bundle);
  const xs = [...new Set(bundle.topology.vertices.map(vertex => vertex.point[0]))].sort((a, b) => a - b);
  check(xs.length >= 2 && xs.length <= 12, '$slabs', 'bounded original distinct X coordinates required');
  const positions: number[] = [], normals: number[] = [], parameters: number[] = [], indices: number[] = [], decomposition: XYPolygonHolePreviewSlab[] = [];
  let trapezoidCount = 0, meshMM2 = 0;
  const pointAt = (index: number, float32 = false): Point => positions.slice(index * 3, index * 3 + 3).map(value => float32 ? Math.fround(value) : value) as Point;
  const triangleArea2 = (a: Point, b: Point, c: Point): number => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const triangle = (a: number, b: number, c: number): void => {
    const area2 = triangleArea2(pointAt(a), pointAt(b), pointAt(c)), floatArea2 = triangleArea2(pointAt(a, true), pointAt(b, true), pointAt(c, true));
    check(Number.isFinite(area2) && area2 > 0, '$triangles', 'exact positive slab piece collapsed or reversed after Surface evaluation');
    check(Number.isFinite(floatArea2) && floatArea2 > 0, '$triangles', 'Float32 world-coordinate triangle collapsed or reversed; this preview sampling is unsupported');
    indices.push(a, b, c); meshMM2 += area2 / 2;
  };
  const emit = (segment: Segment, xMM: number): XYPolygonHolePreviewCorner => {
    const x = rational(xMM, 1), yMM = yAt(segment, x), dx = segment.b[0] - segment.a[0];
    const parameterFraction = rational(xMM - segment.a[0], dx);
    check(compare(parameterFraction, rational(0, 1)) >= 0 && compare(parameterFraction, rational(1, 1)) <= 0, '$cut #' + segment.edge.id, 'exact slab cut outside supporting native segment');
    const fraction = parameterFraction.numerator / parameterFraction.denominator, directedFraction = segment.use.sense === 'forward' ? fraction : 1 - fraction;
    const pcurve = segment.use.pcurve, uv: [number, number] = [pcurve.uv0[0] + directedFraction * (pcurve.uv1[0] - pcurve.uv0[0]), pcurve.uv0[1] + directedFraction * (pcurve.uv1[1] - pcurve.uv0[1])];
    check(uv.every(Number.isFinite) && uv[0] >= domain.u[0] && uv[0] <= domain.u[1] && uv[1] >= domain.v[0] && uv[1] <= domain.v[1], '$cut', 'derived native pcurve UV outside owning Surface domain');
    const nativeParameter = segment.domain[0] + fraction * (segment.domain[1] - segment.domain[0]);
    const curvePoint = evaluateCurve(segment.curve, nativeParameter), d1 = evaluateSurfaceD1(surface, uv[0], uv[1]), rationalPoint: Point = [xMM, yMM.numerator / yMM.denominator, 0];
    check(Math.hypot(...d1.point.map((value, axis) => value - curvePoint[axis])) <= 1e-9 && Math.hypot(...curvePoint.map((value, axis) => value - rationalPoint[axis])) <= 1e-9, '$cut #' + segment.edge.id, 'actual native Curve/Surface/rational cut binding exceeds evaluation comparison1e-9mm');
    const cross: Point = [d1.du[1] * d1.dv[2] - d1.du[2] * d1.dv[1], d1.du[2] * d1.dv[0] - d1.du[0] * d1.dv[2], d1.du[0] * d1.dv[1] - d1.du[1] * d1.dv[0]], magnitude = Math.hypot(...cross);
    check(Number.isFinite(magnitude) && magnitude > 0 && cross[2] > 0, '$normal', 'actual forward SurfaceD1 outward+Z required');
    positions.push(...d1.point); normals.push(...cross.map(value => value / magnitude)); parameters.push(...uv);
    return { edgeId: segment.edge.id, curveId: segment.curve.id, sourceCurveId: segment.edge.sourceCurveId, loopId: segment.edge.loopId, loopRole: segment.edge.loopRole,
      nativeParameter, sourceParameter: segment.edge.sourceParameterRange[0] + fraction * (segment.edge.sourceParameterRange[1] - segment.edge.sourceParameterRange[0]), parameterFraction, planarPoint: { xMM, yMM }, uv };
  };
  for (let slabIndex = 0; slabIndex < xs.length - 1; slabIndex++) {
    const left = xs[slabIndex], right = xs[slabIndex + 1], midpointX = rational(integer(left + right, '$midpoint'), 2);
    check(right > left, '$slabs', 'nonzero increasing original X interval required');
    const active = segments.filter(segment => compare(midpointX, rational(Math.min(segment.a[0], segment.b[0]), 1)) > 0 && compare(midpointX, rational(Math.max(segment.a[0], segment.b[0]), 1)) < 0)
      .map(segment => ({ segment, y: yAt(segment, midpointX) })).sort((a, b) => compare(a.y, b.y));
    check(active.length % 2 === 0 && active.length <= 12, '$slabs', 'unexpected odd or over-budget native crossing parity');
    for (let i = 1; i < active.length; i++) check(compare(active[i - 1].y, active[i].y) < 0, '$slabs', 'unexpected coincident/crossing native supports at rational midpoint');
    const intervals: XYPolygonHolePreviewSlab['intervals'] = [];
    for (let i = 0; i < active.length; i += 2) {
      check(++trapezoidCount <= 66, '$slabs', 'trapezoid budget66 exceeded');
      const lower = active[i].segment, upper = active[i + 1].segment, lowerL = yAt(lower, rational(left, 1)), lowerR = yAt(lower, rational(right, 1)), upperL = yAt(upper, rational(left, 1)), upperR = yAt(upper, rational(right, 1));
      const leftHeight = compare(upperL, lowerL), rightHeight = compare(upperR, lowerR);
      check(leftHeight >= 0 && rightHeight >= 0 && (leftHeight > 0 || rightHeight > 0), '$slab', 'unexpected support reversal or wholly collapsed filled interval');
      const start = positions.length / 3, indexStart = indices.length;
      const corners = [emit(lower, left), emit(lower, right), emit(upper, right), emit(upper, left)];
      if (rightHeight > 0) triangle(start, start + 1, start + 2);
      if (leftHeight > 0) triangle(start, start + 2, start + 3);
      intervals.push({ lowerEdgeId: lower.edge.id, upperEdgeId: upper.edge.id, vertexRange: [start, start + 4], indexRange: [indexStart, indices.length], omittedCollapsedTriangles: (leftHeight === 0 ? 1 : 0) + (rightHeight === 0 ? 1 : 0), corners });
    }
    decomposition.push({ xRange: [left, right], midpointX, intervals });
  }
  check(decomposition.length <= 11 && positions.length / 3 <= 264 && indices.length / 3 <= 132 && indices.length >= 6, '$packet', 'fixed display slab/vertex/triangle bounds violated');
  const bounds: { min: Point; max: Point } = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < positions.length; i += 3) for (let axis = 0; axis < 3; axis++) { bounds.min[axis] = Math.min(bounds.min[axis], positions[i + axis]); bounds.max[axis] = Math.max(bounds.max[axis], positions[i + axis]); }
  const packet: PreviewPacket = { version: 0, surfaceId: options.meshId, revision: options.revision, lengthUnit: 'mm', coordinateSystem: 'right-handed-y-up', winding: 'ccw', positions, normals, indices, parameters, bounds };
  validatePreviewPacket(packet);
  const nativeMM2 = native.areasMM2.net, comparisonMM2 = 1e-8 + 1e-12 * Math.max(1, nativeMM2), differenceMM2 = meshMM2 - nativeMM2;
  check(Number.isFinite(meshMM2) && Math.abs(differenceMM2) <= comparisonMM2, '$area', 'actual mesh/native net area mismatch exceeds reported display comparison');
  // Retain native edge array order; slab splits and diagonals never become edge paths.
  const byId = new Map(segments.map(segment => [segment.edge.id, segment]));
  const edgePaths: XYPolygonHoleFacePreviewResult['edgePaths'] = [], edgeProvenance: XYPolygonHolePreviewEdgeProvenance[] = [];
  for (const edge of bundle.topology.edges) {
    const segment = byId.get(edge.id)!;
    edgePaths.push({ id: edge.id, points: [evaluateCurve(segment.curve, segment.domain[0]), evaluateCurve(segment.curve, segment.domain[1])] });
    edgeProvenance.push({ faceId: native.faceId, surfaceId: native.surfaceId, edgeId: edge.id, curveId: edge.curveId, sourceCurveId: edge.sourceCurveId,
      sourceSegmentIndex: edge.sourceSegmentIndex, sourceParameterRange: [...edge.sourceParameterRange], loopId: edge.loopId, loopRole: edge.loopRole, nativeDomain: [...segment.domain], loopSense: segment.use.sense });
  }
  const report: XYPolygonHoleFacePreviewReport = { kind: 'xy-polygon-planar-face-with-hole-preview', sourceVersion: 0, faceId: native.faceId, surfaceId: native.surfaceId, meshId: options.meshId, revision: options.revision,
    native, vertexCount: positions.length / 3, triangleCount: indices.length / 3, edgePathCount: edgePaths.length, slabCount: decomposition.length, trapezoidCount,
    area: { nativeMM2, meshMM2, differenceMM2, comparisonMM2 }, decomposition,
    limits: { combinedVertices: 12, maximumSlabs: 11, maximumTrapezoids: 66, maximumVertices: 264, maximumTriangles: 132, maximumEdgePaths: 12,
      rationalNumeratorAbsolute: 1200000000, rationalDenominator: 40000, snapshotValues: 16384, snapshotDepth: 12, arrayElements: 128, recordFields: 16, stringCharacters: 128,
      evaluationComparisonMM: 1e-9, float32Policy: 'positive-world-coordinate-triangle-area' },
    geometricValidity: 'not-certified', topologyCertified: false, solid: false };
  return copyCadData({ packet, edgePaths, edgeProvenance, report });
}
