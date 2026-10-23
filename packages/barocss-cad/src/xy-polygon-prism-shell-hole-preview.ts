import { validateXYPolygonPrismShellWithHole } from './xy-polygon-prism-shell-hole.js';
import type { XYPolygonPrismShellWithHole, XYPolygonPrismShellWithHoleReport, XYPolygonPrismHoleCapFace } from './xy-polygon-prism-shell-hole.js';
import { tessellateXYPolygonPlanarFaceWithHole } from './xy-polygon-planar-face-hole-preview.js';
import type { XYPolygonHolePreviewSlab, XYPolygonHolePreviewCorner } from './xy-polygon-planar-face-hole-preview.js';
import { tessellateSurface } from './preview.js';
import { evaluateSurfaceD1 } from './core/derivatives.js';
import { evaluateCurve, curveDomain, surfaceDomain } from './core/math.js';
import { validatePreviewPacket } from './core/packet.js';
import type { PreviewPacket } from './core/packet.js';
import { copyCadData } from './data-copy.js';
import type { Point } from './types.js';

export interface XYPolygonPrismHoleShellPreviewOptions { meshId: string; revision: number }
export interface XYPolygonPrismHoleShellFaceRange {
  faceId: string; surfaceId: string; role: 'bottom-cap' | 'top-cap' | 'outer-wall' | 'hole-wall';
  /** Half-open offsets into packet vertices and scalar indices. */
  vertexRange: [number, number]; indexRange: [number, number];
  domain: { u: [number, number]; v: [number, number] };
  geometryModelName: string; sourceFaceId: string;
  capProvenance?: {
    localSourceCurveIds: { outer: string; hole: string }; worldSourceCurveIds: { outer: string; hole: string };
    placement: XYPolygonPrismHoleCapFace['placement']; decomposition: XYPolygonHolePreviewSlab[];
    worldVertexSources: XYPolygonHolePreviewCorner[];
    area: { nativeMM2: number; meshMM2: number; differenceMM2: number; comparisonMM2: number };
  };
  wallProvenance?: { sourceCurveId: string; loopRole: 'outer' | 'hole'; sourceSegmentIndex: number };
}
export interface XYPolygonPrismHoleShellEdgePath { id: string; points: [Point, Point] }
export interface XYPolygonPrismHoleShellEdgeProvenance {
  bodyId: string; edgeId: string; canonical: XYPolygonPrismShellWithHole['edges'][number]['canonical'];
  adjacentFaceIds: [string, string]; adjacentUses: XYPolygonPrismShellWithHole['edges'][number]['uses'];
  source: XYPolygonPrismShellWithHole['edges'][number]['source']; nativeDomain: [number, number]; curveDirection: 'forward' | 'reverse';
}
export interface XYPolygonPrismHoleShellPreviewReport {
  kind: 'xy-polygon-prism-shell-with-hole-preview'; bodyId: string; sourceFaceId: string;
  sourceCurveIds: { outer: string; hole: string }; meshId: string; revision: number;
  vertexCount: number; triangleCount: number; edgePathCount: number; boundsMM: { min: Point; max: Point };
  nativeIncidence: XYPolygonPrismShellWithHoleReport; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: {
    combinedVertices: 12; maximumFaces: 14; meshIdCharacters: 128; snapshotValues: 65536; snapshotDepth: 20;
    arrayElements: 128; recordFields: 16; stringCharacters: 128; maximumVertices: 576;
    maximumTriangles: 288; maximumEdgePaths: 36; pointsPerEdge: 2; evaluationComparisonMM: 1e-9;
    float32Policy: 'positive-outward-world-coordinate-triangles';
  };
}
export interface XYPolygonPrismHoleShellPreviewResult {
  packet: PreviewPacket; faceRanges: XYPolygonPrismHoleShellFaceRange[];
  edgePaths: XYPolygonPrismHoleShellEdgePath[]; edgeProvenance: XYPolygonPrismHoleShellEdgeProvenance[];
  report: XYPolygonPrismHoleShellPreviewReport;
}
function check(condition: boolean, path: string, detail: string): asserts condition {
  if (!condition) throw new Error(('XY polygon through-hole shell preview: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512));
}
// Copy before validation/consumption so caller accessors cannot replace validated geometry.
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
function admitOptions(input: unknown): XYPolygonPrismHoleShellPreviewOptions {
  const data = snapshot(input, '$options');
  check(data !== null && typeof data === 'object' && !Array.isArray(data), '$options', 'options record required');
  const fields = data as Record<string, unknown>;
  check(Object.keys(fields).length === 2 && Object.hasOwn(fields, 'meshId') && Object.hasOwn(fields, 'revision'), '$options', 'exact meshId/revision fields required');
  check(typeof fields.meshId === 'string' && fields.meshId.length <= 128 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(fields.meshId), '$options.meshId', 'ASCII mesh ID1..128 required');
  check(typeof fields.revision === 'number' && Number.isInteger(fields.revision) && fields.revision >= 0 && fields.revision <= 2147483647, '$options.revision', 'integer revision0..2147483647 required');
  return { meshId: fields.meshId, revision: fields.revision };
}
function nativeIds(data: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(data)) for (const value of data) nativeIds(value, result);
  else if (data !== null && typeof data === 'object') for (const [key, value] of Object.entries(data)) {
    if ((key === 'id' || key === 'name') && typeof value === 'string') result.add(value);
    nativeIds(value, result);
  }
  return result;
}
function normal(du: Point, dv: Point, orientation: number): Point {
  const cross: Point = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]];
  const magnitude = Math.hypot(...cross);
  check(Number.isFinite(magnitude) && magnitude > 0, '$faces', 'nonzero actual derivative normal required');
  return cross.map(value => orientation * value / magnitude) as Point;
}

function cross(a: Point, b: Point, c: Point): Point {
  const u = b.map((value, axis) => value - a[axis]), v = c.map((value, axis) => value - a[axis]);
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}
function near(a: Point, b: Point): boolean { return Math.hypot(...a.map((value, axis) => value - b[axis])) <= 1e-9; }
/** Local accepted connectivity; all emitted geometry comes from owning world Models. */
export function tessellateXYPolygonPrismShellWithHole(input: XYPolygonPrismShellWithHole, inputOptions: XYPolygonPrismHoleShellPreviewOptions): XYPolygonPrismHoleShellPreviewResult {
  const shell = snapshot(input, '$shell') as XYPolygonPrismShellWithHole, options = admitOptions(inputOptions);
  const nativeIncidence = validateXYPolygonPrismShellWithHole(shell);
  check(!nativeIds(shell).has(options.meshId), '$options.meshId', 'display ID must differ from all native IDs and Model names');
  const positions: number[] = [], normals: number[] = [], parameters: number[] = [], indices: number[] = [];
  const faceRanges: XYPolygonPrismHoleShellFaceRange[] = [];
  const pointAt = (index: number, float32 = false): Point => positions.slice(index * 3, index * 3 + 3).map(value => float32 ? Math.fround(value) : value) as Point;
  for (const face of shell.faces) {
    const bundle = face.kind === 'placed-polygon-cap-with-hole' ? face.world : face.bundle;
    const surface = bundle.geometry.objects.find(object => object.id === bundle.topology.face.surfaceId);
    check(surface?.kind === 'surface', '$faces #' + face.id, 'actual owning Surface required');
    const domain = surfaceDomain(surface), orientation = bundle.topology.face.orientation === 'forward' ? 1 : -1;
    const start = positions.length / 3, indexStart = indices.length;
    let connectivity: number[], uvs: number[], capProvenance: XYPolygonPrismHoleShellFaceRange['capProvenance'];
    let role: XYPolygonPrismHoleShellFaceRange['role'];
    if (face.kind === 'placed-polygon-cap-with-hole') {
      const trim = tessellateXYPolygonPlanarFaceWithHole(face.local, options);
      connectivity = trim.packet.indices; uvs = trim.packet.parameters;
      role = orientation < 0 ? 'bottom-cap' : 'top-cap';
      const worldVertexSources = trim.report.decomposition.flatMap(slab => slab.intervals.flatMap(interval => interval.corners)).map(corner => {
        const edge = face.world.topology.edges.find(edge => edge.id === corner.edgeId);
        const loop = face.world.topology.loops.find(loop => loop.id === corner.loopId);
        const use = loop?.uses.find(use => use.edgeId === corner.edgeId);
        check(!!edge && !!loop && !!use && edge.curveId === corner.curveId && edge.loopRole === corner.loopRole && edge.sourceCurveId === loop.sourceCurveId, '$caps #' + face.id, 'qualified world edge/loop/Curve binding required');
        const curve = face.world.geometry.objects.find(object => object.id === edge.curveId);
        const source = face.world.geometry.objects.find(object => object.id === edge.sourceCurveId);
        check(curve?.kind === 'curve' && source?.kind === 'curve', '$caps #' + face.id, 'actual world native and source Curves required');
        const fraction = corner.parameterFraction.numerator / corner.parameterFraction.denominator;
        const directed = use.sense === 'forward' ? fraction : 1 - fraction;
        const uv: [number, number] = [use.pcurve.uv0[0] + directed * (use.pcurve.uv1[0] - use.pcurve.uv0[0]), use.pcurve.uv0[1] + directed * (use.pcurve.uv1[1] - use.pcurve.uv0[1])];
        check(uv.every((value, axis) => value === corner.uv[axis]), '$caps #' + face.id, 'local/world pcurve UV association differs');
        const point = evaluateSurfaceD1(surface, uv[0], uv[1]).point;
        check(near(point, evaluateCurve(curve, corner.nativeParameter)) && near(point, evaluateCurve(source, corner.sourceParameter)), '$caps #' + face.id, 'world Surface/pcurve/native/source binding exceeds1e-9mm');
        return { ...copyCadData(corner), sourceCurveId: edge.sourceCurveId, uv };
      });
      check(worldVertexSources.length === uvs.length / 2, '$caps', 'one world native binding per emitted cap vertex required');
      capProvenance = { localSourceCurveIds: copyCadData(face.local.topology.sourceCurveIds), worldSourceCurveIds: copyCadData(face.world.topology.sourceCurveIds),
        placement: copyCadData(face.placement), decomposition: copyCadData(trim.report.decomposition), worldVertexSources, area: copyCadData(trim.report.area) };
    } else {
      const grid = tessellateSurface(surface, { countU: 2, countV: 2, revision: options.revision });
      connectivity = grid.packet.indices; uvs = grid.packet.parameters; role = face.loopRole === 'hole' ? 'hole-wall' : 'outer-wall';
    }
    for (let i = 0; i < uvs.length; i += 2) {
      const u = uvs[i], v = uvs[i + 1];
      check(u >= domain.u[0] && u <= domain.u[1] && v >= domain.v[0] && v <= domain.v[1], '$faces #' + face.id, 'actual UV outside owning Surface domain');
      const d1 = evaluateSurfaceD1(surface, u, v);
      positions.push(...d1.point); normals.push(...normal(d1.du, d1.dv, orientation)); parameters.push(u, v);
    }
    let areaMM2 = 0;
    for (let i = 0; i < connectivity.length; i += 3) {
      const [a, b, c] = connectivity.slice(i, i + 3), triangle = [start + a, start + (orientation > 0 ? b : c), start + (orientation > 0 ? c : b)];
      const actual = cross(pointAt(triangle[0]), pointAt(triangle[1]), pointAt(triangle[2]));
      areaMM2 += Math.hypot(...actual) / 2;
      for (const float32 of [false, true]) {
        const vector = cross(pointAt(triangle[0], float32), pointAt(triangle[1], float32), pointAt(triangle[2], float32));
        check(Number.isFinite(Math.hypot(...vector)) && Math.hypot(...vector) > 0, '$triangles #' + face.id, 'world/Float32 triangle collapsed; unsupported display sampling');
        for (const vertex of triangle) check(vector.reduce((dot, value, axis) => dot + value * normals[vertex * 3 + axis], 0) > 0, '$triangles #' + face.id, 'world/Float32 triangle winding disagrees with actual outward normal');
      }
      indices.push(...triangle);
    }
    if (capProvenance) {
      const nativeMM2 = capProvenance.area.nativeMM2, comparisonMM2 = 1e-8 + 1e-12 * Math.max(1, nativeMM2);
      check(Math.abs(areaMM2 - nativeMM2) <= comparisonMM2, '$caps #' + face.id, 'actual world triangle area differs from native annulus');
      capProvenance.area = { nativeMM2, meshMM2: areaMM2, differenceMM2: areaMM2 - nativeMM2, comparisonMM2 };
    }
    const range: XYPolygonPrismHoleShellFaceRange = { faceId: face.id, surfaceId: surface.id, role,
      vertexRange: [start, positions.length / 3], indexRange: [indexStart, indices.length], domain: copyCadData(domain),
      geometryModelName: bundle.geometry.name, sourceFaceId: shell.sourceFace.topology.face.id };
    if (capProvenance) range.capProvenance = capProvenance;
    if (face.kind === 'lateral-face') range.wallProvenance = { sourceCurveId: face.sourceCurveId, loopRole: face.loopRole, sourceSegmentIndex: face.sourceSegmentIndex };
    faceRanges.push(range);
  }
  const bounds: { min: Point; max: Point } = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < positions.length; i += 3) for (let axis = 0; axis < 3; axis++) {
    bounds.min[axis] = Math.min(bounds.min[axis], positions[i + axis]); bounds.max[axis] = Math.max(bounds.max[axis], positions[i + axis]);
  }
  check(faceRanges.length <= 14 && positions.length / 3 <= 576 && indices.length / 3 <= 288, '$packet', 'bounded native face mesh counts exceeded');
  const packet: PreviewPacket = { version: 0, surfaceId: options.meshId, revision: options.revision, lengthUnit: 'mm',
    coordinateSystem: 'right-handed-y-up', winding: 'ccw', positions, normals, indices, parameters, bounds };
  validatePreviewPacket(packet);
  const globalVertices = new Map(shell.vertices.map(vertex => [vertex.id, vertex.point]));
  const edgePaths: XYPolygonPrismHoleShellEdgePath[] = [], edgeProvenance: XYPolygonPrismHoleShellEdgeProvenance[] = [];
  for (const edge of shell.edges) {
    const face = shell.faces.find(face => face.id === edge.canonical.faceId);
    check(!!face, '$edges #' + edge.id, 'canonical owning face required');
    const bundle = face.kind === 'placed-polygon-cap-with-hole' ? face.world : face.bundle;
    const local = bundle.topology.edges.find(local => local.id === edge.canonical.edgeId);
    check(!!local && local.curveId === edge.canonical.curveId, '$edges #' + edge.id, 'canonical actual edge/Curve binding required');
    const curve = bundle.geometry.objects.find(object => object.id === local.curveId);
    check(curve?.kind === 'curve', '$edges #' + edge.id, 'canonical actual native Curve required');
    const use = edge.uses.find(use => use.faceId === face.id && use.edgeId === local.id && use.curveId === curve.id);
    check(!!use, '$edges #' + edge.id, 'canonical qualified native use required');
    const nativeDomain = curveDomain(curve), points: [Point, Point] = [evaluateCurve(curve, nativeDomain[0]), evaluateCurve(curve, nativeDomain[1])];
    if (use.curveDirection === 'reverse') points.reverse();
    for (let end = 0; end < 2; end++) {
      const expected = globalVertices.get(edge.vertexIds[end]);
      check(!!expected && near(points[end], expected), '$edges #' + edge.id, 'actual Curve/global endpoint association exceeds1e-9mm');
    }
    edgePaths.push({ id: edge.id, points });
    edgeProvenance.push({ bodyId: shell.id, edgeId: edge.id, canonical: copyCadData(edge.canonical),
      adjacentFaceIds: [edge.uses[0].faceId, edge.uses[1].faceId], adjacentUses: copyCadData(edge.uses), source: copyCadData(edge.source), nativeDomain, curveDirection: use.curveDirection });
  }
  check(edgePaths.length === nativeIncidence.edgeCount && edgePaths.length <= 36 && new Set(edgePaths.map(path => path.id)).size === edgePaths.length, '$edgePaths', 'one unique path per original global edge required');
  const report: XYPolygonPrismHoleShellPreviewReport = { kind: 'xy-polygon-prism-shell-with-hole-preview', bodyId: shell.id,
    sourceFaceId: nativeIncidence.sourceFaceId, sourceCurveIds: copyCadData(nativeIncidence.sourceCurveIds), meshId: options.meshId, revision: options.revision,
    vertexCount: positions.length / 3, triangleCount: indices.length / 3, edgePathCount: edgePaths.length, boundsMM: bounds, nativeIncidence,
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    limits: { combinedVertices: 12, maximumFaces: 14, meshIdCharacters: 128, snapshotValues: 65536, snapshotDepth: 20,
      arrayElements: 128, recordFields: 16, stringCharacters: 128, maximumVertices: 576, maximumTriangles: 288, maximumEdgePaths: 36,
      pointsPerEdge: 2, evaluationComparisonMM: 1e-9, float32Policy: 'positive-outward-world-coordinate-triangles' } };
  return copyCadData({ packet, faceRanges, edgePaths, edgeProvenance, report });
}
