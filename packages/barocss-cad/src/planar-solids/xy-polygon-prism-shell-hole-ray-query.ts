import { CadNumericPolicy } from '../numeric-policy.js';
import { validateXYPolygonPrismShellWithHole } from './xy-polygon-prism-shell-hole.js';
import type { XYPolygonPrismShellWithHole, XYPolygonPrismShellWithHoleReport, XYPolygonPrismHoleCapFace } from './xy-polygon-prism-shell-hole.js';
import { evaluateSurfaceD1 } from '../core/derivatives.js';
import { evaluateCurve, curveDomain, surfaceDomain } from '../core/math.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Point } from '../types.js';
import { dot, sub as subtract } from '../core/vec3.js';

export interface XYPolygonPrismHoleShellRayQueryOptions { originMM: Point; direction: Point; maxDistanceMM: number }
export type XYPolygonPrismHoleShellRayFaceRole = 'bottom-cap' | 'top-cap' | 'outer-wall' | 'hole-wall';
export interface XYPolygonPrismHoleShellRayEdgeReference {
  edgeId: string; faceId: string; nativeEdgeId: string; curveId: string; nativeDomain: [number, number];
  qualifiedUse: XYPolygonPrismShellWithHole['edges'][number]['uses'][number];
  source: XYPolygonPrismShellWithHole['edges'][number]['source'];
}
export interface XYPolygonPrismHoleShellRayHit {
  bodyId: string; faceId: string; surfaceId: string; role: XYPolygonPrismHoleShellRayFaceRole; tMM: number; pointMM: Point;
  uv: [number, number]; outwardNormal: Point; edgeIds: string[]; edgeReferences: XYPolygonPrismHoleShellRayEdgeReference[];
}
export interface XYPolygonPrismHoleShellCoplanarFace { bodyId: string; faceId: string; surfaceId: string; role: XYPolygonPrismHoleShellRayFaceRole; signedOriginDistanceMM: number }
export interface XYPolygonPrismHoleShellRayQueryReport {
  kind: 'xy-polygon-prism-shell-with-hole-ray-query'; nativeIncidence: XYPolygonPrismShellWithHoleReport;
  directionNorm: number; candidateCount: number;
  policy: {
    boundaryToleranceMM: 1e-7; coincidentDistanceToleranceMM: 1e-7;
    parallelCosineThreshold: 1e-12; directionNormTolerance: 1e-9;
    coplanarPolicy: 'supporting-plane-conservative'; surfaceDomain: 'strict-no-clamp';
  };
  limits: { originCoordinateMM: 10000; maximumDistanceMM: 50000; maximumFaces: 14; maximumEdges: 36;
    snapshotValues: 65536; snapshotDepth: 20; arrayElements: 128; recordFields: 16; stringCharacters: 128 };
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
}
export interface XYPolygonPrismHoleShellRayQueryResult {
  status: 'miss' | 'unique-hit' | 'ambiguous-nearest' | 'ambiguous-coplanar';
  bodyId: string; query: XYPolygonPrismHoleShellRayQueryOptions; nearestDistanceMM: number | null;
  hits: XYPolygonPrismHoleShellRayHit[]; candidates: XYPolygonPrismHoleShellRayHit[]; coplanarFaces: XYPolygonPrismHoleShellCoplanarFace[];
  report: XYPolygonPrismHoleShellRayQueryReport;
}
const BOUNDARY_MM = CadNumericPolicy.linearTolerance, PARALLEL_COSINE = 1e-12, UNIT_TOLERANCE = 1e-9;
function check(condition: boolean, path: string, detail: string): asserts condition {
  if (!condition) throw new Error(('XY polygon through-hole shell ray: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512));
}
function snapshot(input: unknown, rootPath: string): unknown {
  let remaining = 65536;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 20, path, 'bounded snapshot65536/depth20 exceeded');
    if (typeof value === 'number') { check(Number.isFinite(value), path, 'finite data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, path, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', path, 'plain numeric/string/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, path, 'foreign prototype unsupported');
    const keys = Reflect.ownKeys(value);
    check(keys.length <= (array ? 129 : 16) && keys.every(key => typeof key === 'string' && key.length <= 128), path, 'bounded own fields required');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), path, 'getters/symbols/hidden fields unsupported');
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 128 && keys.length === length + 1, path, 'dense bounded array required');
      const result: unknown[] = [];
      for (let i = 0; i < length; i++) { check(Object.hasOwn(descriptors, String(i)), path, 'sparse/extra array field'); result.push(copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']')); }
      return result;
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
  };
  return copy(input, 0, rootPath);
}
function admitOptions(input: unknown): XYPolygonPrismHoleShellRayQueryOptions {
  const data = snapshot(input, '$options');
  check(data !== null && typeof data === 'object' && !Array.isArray(data), '$options', 'options record required');
  const fields = data as Record<string, unknown>, keys = ['originMM', 'direction', 'maxDistanceMM'];
  check(Object.keys(fields).length === keys.length && keys.every(key => Object.hasOwn(fields, key)), '$options', 'exact originMM/direction/maxDistanceMM fields required');
  const origin = fields.originMM, direction = fields.direction;
  check(Array.isArray(origin) && origin.length === 3 && origin.every(value => typeof value === 'number' && Math.abs(value) <= 10000), '$options.originMM', 'finite XYZ within +/-10000mm required');
  check(Array.isArray(direction) && direction.length === 3 && direction.every(value => typeof value === 'number'), '$options.direction', 'finite three-component direction required');
  const norm = Math.hypot(...direction);
  check(Number.isFinite(norm) && Math.abs(norm - 1) <= UNIT_TOLERANCE, '$options.direction', 'unit direction within1e-9 required; no normalization');
  check(typeof fields.maxDistanceMM === 'number' && fields.maxDistanceMM > 0 && fields.maxDistanceMM <= 50000, '$options.maxDistanceMM', 'positive finite distance<=50000mm required');
  return { originMM: origin as Point, direction: direction as Point, maxDistanceMM: fields.maxDistanceMM };
}
function outward(du: Point, dv: Point, orientation: number): Point {
  const cross: Point = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]], norm = Math.hypot(...cross);
  check(Number.isFinite(norm) && norm > 0, '$faces', 'nondegenerate actual SurfaceD1 required');
  return cross.map(value => orientation * value / norm) as Point;
}
function segmentDistance(point: Point, a: Point, b: Point): number {
  const ab = subtract(b, a), denominator = dot(ab, ab);
  check(Number.isFinite(denominator) && denominator > 0, '$edges', 'nondegenerate actual native edge required');
  // Projection clips only the closest-point search, never the ray/hit/query input.
  const fraction = Math.max(0, Math.min(1, dot(subtract(point, a), ab) / denominator));
  const distance = Math.hypot(...point.map((value, axis) => value - (a[axis] + fraction * ab[axis])));
  check(Number.isFinite(distance), '$edges', 'finite native edge distance required'); return distance;
}
function endpoints(curve: Curve): [Point, Point] {
  const domain = curveDomain(curve); return [evaluateCurve(curve, domain[0]), evaluateCurve(curve, domain[1])];
}
function capContains(face: XYPolygonPrismHoleCapFace, worldPoint: Point): boolean {
  // The placed world native Curves determine both loop boundaries. This query
  // admits finite ray intersections without widening the integer point API.
  let outerWinding = 0, holeWinding = 0;
  for (const loop of face.world.topology.loops) {
    let winding = 0;
    for (const use of loop.uses) {
      const edge = face.world.topology.edges.find(edge => edge.id === use.edgeId);
      check(!!edge && edge.loopId === loop.id && edge.loopRole === loop.role && edge.sourceCurveId === loop.sourceCurveId, '$trim', 'actual qualified world trim/source/loop role required');
      const curve = face.world.geometry.objects.find(object => object.id === edge.curveId);
      check(curve?.kind === 'curve', '$trim', 'actual world trim Curve required');
      const pair = endpoints(curve); if (use.sense === 'reverse') pair.reverse();
      const [a, b] = pair;
      if (segmentDistance(worldPoint, a, b) <= BOUNDARY_MM) return true;
      const determinant = (b[0] - a[0]) * (worldPoint[1] - a[1]) - (b[1] - a[1]) * (worldPoint[0] - a[0]);
      if (a[1] <= worldPoint[1] && b[1] > worldPoint[1] && determinant > 0) winding++;
      else if (a[1] > worldPoint[1] && b[1] <= worldPoint[1] && determinant < 0) winding--;
    }
    if (loop.role === 'outer') outerWinding = winding; else holeWinding = winding;
  }
  return outerWinding !== 0 && holeWinding === 0;
}
function boundaryReferences(shell: XYPolygonPrismShellWithHole, faceId: string, point: Point): XYPolygonPrismHoleShellRayEdgeReference[] {
  const face = shell.faces.find(face => face.id === faceId);
  check(!!face, '$boundary', 'actual owning face required');
  const bundle = face.kind === 'placed-polygon-cap-with-hole' ? face.world : face.bundle, result: XYPolygonPrismHoleShellRayEdgeReference[] = [];
  for (const edge of shell.edges) {
    const use = edge.uses.find(use => use.faceId === faceId); if (!use) continue;
    const local = bundle.topology.edges.find(local => local.id === use.edgeId);
    check(!!local && local.curveId === use.curveId, '$boundary', 'qualified native edge binding required');
    const curve = bundle.geometry.objects.find(object => object.id === use.curveId);
    check(curve?.kind === 'curve', '$boundary', 'actual qualified native Curve required');
    const [a, b] = endpoints(curve);
    if (segmentDistance(point, a, b) <= BOUNDARY_MM) result.push({ edgeId: edge.id, faceId, nativeEdgeId: local.id, curveId: curve.id,
      nativeDomain: curveDomain(curve), qualifiedUse: copyCadData(use), source: copyCadData(edge.source) });
  }
  return result;
}
/** Bounded original affine-face query; no display triangles or generic solid test. */
export function queryXYPolygonPrismShellWithHoleRay(input: XYPolygonPrismShellWithHole, inputOptions: XYPolygonPrismHoleShellRayQueryOptions): XYPolygonPrismHoleShellRayQueryResult {
  const shell = snapshot(input, '$shell') as XYPolygonPrismShellWithHole, query = admitOptions(inputOptions);
  const nativeIncidence = validateXYPolygonPrismShellWithHole(shell), candidates: { order: number; hit: XYPolygonPrismHoleShellRayHit }[] = [];
  const coplanarFaces: XYPolygonPrismHoleShellCoplanarFace[] = [];
  for (const [order, face] of shell.faces.entries()) {
    const bundle = face.kind === 'placed-polygon-cap-with-hole' ? face.world : face.bundle;
    const role: XYPolygonPrismHoleShellRayFaceRole = face.kind === 'placed-polygon-cap-with-hole' ? face.placement.orientation === 'reverse' ? 'bottom-cap' : 'top-cap' : face.loopRole === 'hole' ? 'hole-wall' : 'outer-wall';
    const surface = bundle.geometry.objects.find(object => object.id === bundle.topology.face.surfaceId);
    check(surface?.kind === 'surface', '$faces #' + face.id, 'owning actual Surface required');
    const domain = surfaceDomain(surface), u0 = domain.u[0], v0 = domain.v[0], base = evaluateSurfaceD1(surface, u0, v0);
    const orientation = bundle.topology.face.orientation === 'forward' ? 1 : -1, normal = outward(base.du, base.dv, orientation);
    const signedOriginDistanceMM = dot(subtract(query.originMM, base.point), normal), cosine = dot(query.direction, normal);
    if (Math.abs(cosine) <= PARALLEL_COSINE) {
      if (Math.abs(signedOriginDistanceMM) <= BOUNDARY_MM) coplanarFaces.push({ bodyId: shell.id, faceId: face.id, surfaceId: surface.id, role, signedOriginDistanceMM });
      continue;
    }
    const tMM = -signedOriginDistanceMM / cosine;
    if (!Number.isFinite(tMM) || tMM < 0 || tMM > query.maxDistanceMM) continue;
    const point = query.originMM.map((value, axis) => value + tMM * query.direction[axis]) as Point;
    const delta = subtract(point, base.point), uu = dot(base.du, base.du), vv = dot(base.dv, base.dv), uvDot = dot(base.du, base.dv), determinant = uu * vv - uvDot * uvDot;
    check(Number.isFinite(determinant) && determinant > 0, '$faces #' + face.id, 'nondegenerate affine Surface basis required');
    const du = dot(delta, base.du), dv = dot(delta, base.dv);
    const uv: [number, number] = [u0 + (du * vv - dv * uvDot) / determinant, v0 + (dv * uu - du * uvDot) / determinant];
    check(uv.every(Number.isFinite) && point.every(Number.isFinite), '$hit', 'finite affine intersection required');
    // Keep the owning Surface's domain. Near-boundary query values are not clamped.
    if (uv[0] < domain.u[0] || uv[0] > domain.u[1] || uv[1] < domain.v[0] || uv[1] > domain.v[1]) continue;
    const actual = evaluateSurfaceD1(surface, uv[0], uv[1]);
    check(Math.hypot(...subtract(actual.point, point)) <= BOUNDARY_MM, '$hit', 'actual Surface/ray intersection exceeds display comparison1e-7mm');
    if (face.kind === 'placed-polygon-cap-with-hole' && !capContains(face, actual.point)) continue;
    const edgeReferences = boundaryReferences(shell, face.id, actual.point);
    candidates.push({ order, hit: { bodyId: shell.id, faceId: face.id, surfaceId: surface.id, role, tMM, pointMM: actual.point, uv,
      outwardNormal: outward(actual.du, actual.dv, orientation), edgeIds: edgeReferences.map(reference => reference.edgeId), edgeReferences } });
  }
  candidates.sort((a, b) => a.hit.tMM - b.hit.tMM || a.order - b.order);
  const nearestDistanceMM = candidates.length ? candidates[0].hit.tMM : null;
  const hits = nearestDistanceMM === null ? [] : candidates.filter(candidate => candidate.hit.tMM - nearestDistanceMM <= BOUNDARY_MM).map(candidate => candidate.hit);
  const status: XYPolygonPrismHoleShellRayQueryResult['status'] = coplanarFaces.length ? 'ambiguous-coplanar' : hits.length > 1 ? 'ambiguous-nearest' : hits.length === 1 ? 'unique-hit' : 'miss';
  const report: XYPolygonPrismHoleShellRayQueryReport = { kind: 'xy-polygon-prism-shell-with-hole-ray-query', nativeIncidence, directionNorm: Math.hypot(...query.direction), candidateCount: candidates.length,
    policy: { boundaryToleranceMM: 1e-7, coincidentDistanceToleranceMM: 1e-7, parallelCosineThreshold: 1e-12,
      directionNormTolerance: 1e-9, coplanarPolicy: 'supporting-plane-conservative', surfaceDomain: 'strict-no-clamp' },
    limits: { originCoordinateMM: 10000, maximumDistanceMM: 50000, maximumFaces: 14, maximumEdges: 36,
      snapshotValues: 65536, snapshotDepth: 20, arrayElements: 128, recordFields: 16, stringCharacters: 128 },
    geometricValidity: 'not-certified', topologyCertified: false, solid: false };
  return copyCadData({ status, bodyId: shell.id, query, nearestDistanceMM, hits, candidates: candidates.map(candidate => candidate.hit), coplanarFaces, report });
}
