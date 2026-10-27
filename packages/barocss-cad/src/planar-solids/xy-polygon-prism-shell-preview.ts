import { validateXYPolygonPrismShell } from './xy-polygon-prism-shell.js';
import type { XYPolygonPrismShell, XYPolygonPrismShellReport, XYPolygonPrismCapFace } from './xy-polygon-prism-shell.js';
import { tessellateXYPolygonRegion } from './xy-polygon-preview.js';
import type { XYPolygonPreviewVertexSource } from './xy-polygon-preview.js';
import { tessellateSurface } from '../core/preview.js';
import { evaluateSurfaceD1 } from '../core/derivatives.js';
import { evaluateCurve, surfaceDomain } from '../core/math.js';
import { validatePreviewPacket } from '../core/packet.js';
import type { PreviewPacket } from '../core/packet.js';
import { copyCadData } from '../data-copy.js';
import type { Point } from '../types.js';

export interface XYPolygonPrismShellPreviewOptions { meshId: string; revision: number }
export interface XYPolygonPrismShellFaceRange {
  faceId: string; surfaceId: string; role: 'bottom-cap' | 'top-cap' | 'lateral';
  /** Half-open offsets into packet vertices and scalar indices. */
  vertexRange: [number, number]; indexRange: [number, number];
  domain: { u: [number, number]; v: [number, number] };
  capProvenance?: {
    localSourceCurveId: string; worldSourceCurveId: string;
    placement: XYPolygonPrismCapFace['placement']; vertexSources: XYPolygonPreviewVertexSource[];
  };
}
export interface XYPolygonPrismShellEdgePath { id: string; points: [Point, Point] }
export interface XYPolygonPrismShellEdgeProvenance {
  bodyId: string; edgeId: string; canonical: XYPolygonPrismShell['edges'][number]['canonical'];
  adjacentFaceIds: [string, string]; source: XYPolygonPrismShell['edges'][number]['source'];
  nativeDomain: [number, number]; curveDirection: 'forward' | 'reverse';
}
export interface XYPolygonPrismShellPreviewReport {
  kind: 'xy-polygon-prism-shell-preview'; bodyId: string; sourceCurveId: string; meshId: string; revision: number;
  vertexCount: number; triangleCount: number; edgePathCount: number; boundsMM: { min: Point; max: Point };
  nativeIncidence: XYPolygonPrismShellReport; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: {
    sourceVertices: [3, 12]; meshIdCharacters: 128; snapshotValues: 65536; snapshotDepth: 20;
    arrayElements: 128; recordFields: 16; stringCharacters: 128; maximumVertices: 72;
    maximumTriangles: 44; maximumEdgePaths: 36; pointsPerEdge: 2;
  };
}
export interface XYPolygonPrismShellPreviewResult {
  packet: PreviewPacket; faceRanges: XYPolygonPrismShellFaceRange[];
  edgePaths: XYPolygonPrismShellEdgePath[]; edgeProvenance: XYPolygonPrismShellEdgeProvenance[];
  report: XYPolygonPrismShellPreviewReport;
}
function check(condition: boolean, path: string, detail: string): asserts condition {
  if (!condition) throw new Error(('XY polygon prism shell preview: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512));
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
function admitOptions(input: unknown): XYPolygonPrismShellPreviewOptions {
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
/** Display mesh and unique original edge paths from validated native face Models. */
export function tessellateXYPolygonPrismShell(input: XYPolygonPrismShell, inputOptions: XYPolygonPrismShellPreviewOptions): XYPolygonPrismShellPreviewResult {
  const shell = snapshot(input, '$shell') as XYPolygonPrismShell, options = admitOptions(inputOptions);
  const nativeIncidence = validateXYPolygonPrismShell(shell);
  check(!nativeIds(shell).has(options.meshId), '$options.meshId', 'derived display ID must differ from all native IDs and Model names');
  const positions: number[] = [], normals: number[] = [], parameters: number[] = [], indices: number[] = [];
  const faceRanges: XYPolygonPrismShellFaceRange[] = [];
  for (const face of shell.faces) {
    const bundle = face.kind === 'placed-polygon-cap' ? face.world : face.bundle;
    const surface = bundle.geometry.objects.find(object => object.id === bundle.topology.face.surfaceId);
    check(surface?.kind === 'surface', '$faces #' + face.id, 'owning actual Surface required');
    const domain = surfaceDomain(surface), orientation = bundle.topology.face.orientation === 'forward' ? 1 : -1;
    const start = positions.length / 3, indexStart = indices.length;
    let connectivity: number[], uvs: number[], capProvenance: XYPolygonPrismShellFaceRange['capProvenance'];
    let role: XYPolygonPrismShellFaceRange['role'];
    if (face.kind === 'placed-polygon-cap') {
      const source = face.local.geometry.objects.find(object => object.id === face.local.topology.sourceCurveId);
      check(source?.kind === 'curve', '$faces #' + face.id, 'validated local trim source required');
      // Only connectivity/UV/provenance comes from the local trim triangulation.
      // Every emitted point and normal is evaluated on the placed world Surface.
      const trim = tessellateXYPolygonRegion(source, options);
      connectivity = trim.packet.indices; uvs = trim.packet.parameters;
      role = orientation < 0 ? 'bottom-cap' : 'top-cap';
      capProvenance = { localSourceCurveId: source.id, worldSourceCurveId: face.world.topology.sourceCurveId,
        placement: copyCadData(face.placement), vertexSources: copyCadData(trim.report.vertexSources) };
    } else {
      const grid = tessellateSurface(surface, { countU: 2, countV: 2, revision: options.revision });
      connectivity = grid.packet.indices; uvs = grid.packet.parameters; role = 'lateral';
    }
    for (let i = 0; i < uvs.length; i += 2) {
      const u = uvs[i], v = uvs[i + 1], d1 = evaluateSurfaceD1(surface, u, v);
      positions.push(...d1.point); normals.push(...normal(d1.du, d1.dv, orientation)); parameters.push(u, v);
    }
    for (let i = 0; i < connectivity.length; i += 3) {
      const [a, b, c] = connectivity.slice(i, i + 3);
      indices.push(start + a, start + (orientation > 0 ? b : c), start + (orientation > 0 ? c : b));
    }
    const range: XYPolygonPrismShellFaceRange = { faceId: face.id, surfaceId: surface.id, role,
      vertexRange: [start, positions.length / 3], indexRange: [indexStart, indices.length], domain: copyCadData(domain) };
    if (capProvenance) range.capProvenance = capProvenance;
    faceRanges.push(range);
  }
  const bounds: { min: Point; max: Point } = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < positions.length; i += 3) for (let axis = 0; axis < 3; axis++) {
    bounds.min[axis] = Math.min(bounds.min[axis], positions[i + axis]); bounds.max[axis] = Math.max(bounds.max[axis], positions[i + axis]);
  }
  check(positions.length / 3 <= 72 && indices.length / 3 <= 44, '$packet', 'bounded native face mesh counts exceeded');
  const packet: PreviewPacket = { version: 0, surfaceId: options.meshId, revision: options.revision, lengthUnit: 'mm',
    coordinateSystem: 'right-handed-z-up', winding: 'ccw', positions, normals, indices, parameters, bounds };
  validatePreviewPacket(packet);
  const globalVertices = new Map(shell.vertices.map(vertex => [vertex.id, vertex.point]));
  const edgePaths: XYPolygonPrismShellEdgePath[] = [], edgeProvenance: XYPolygonPrismShellEdgeProvenance[] = [];
  for (const edge of shell.edges) {
    const face = shell.faces.find(face => face.id === edge.canonical.faceId);
    check(!!face, '$edges #' + edge.id, 'canonical owning face required');
    const bundle = face.kind === 'placed-polygon-cap' ? face.world : face.bundle;
    const local = bundle.topology.edges.find(local => local.id === edge.canonical.edgeId);
    check(!!local && local.curveId === edge.canonical.curveId, '$edges #' + edge.id, 'canonical actual edge/Curve binding required');
    const curve = bundle.geometry.objects.find(object => object.id === local.curveId);
    check(curve?.kind === 'curve', '$edges #' + edge.id, 'canonical native Curve required');
    const use = edge.uses.find(use => use.faceId === face.id && use.edgeId === local.id && use.curveId === curve.id);
    check(!!use, '$edges #' + edge.id, 'canonical native use required');
    const nativeDomain: [number, number] = [curve.knots[curve.degree], curve.knots[curve.controlPoints.length]];
    const points: [Point, Point] = [evaluateCurve(curve, nativeDomain[0]), evaluateCurve(curve, nativeDomain[1])];
    if (use.curveDirection === 'reverse') points.reverse();
    for (let end = 0; end < 2; end++) {
      const expected = globalVertices.get(edge.vertexIds[end]);
      check(!!expected && points[end].every((value, axis) => value === expected[axis]), '$edges #' + edge.id, 'evaluated native Curve/global endpoint mismatch');
    }
    edgePaths.push({ id: edge.id, points });
    edgeProvenance.push({ bodyId: shell.id, edgeId: edge.id, canonical: copyCadData(edge.canonical),
      adjacentFaceIds: [edge.uses[0].faceId, edge.uses[1].faceId], source: copyCadData(edge.source), nativeDomain, curveDirection: use.curveDirection });
  }
  check(edgePaths.length === nativeIncidence.edgeCount && edgePaths.length <= 36 && new Set(edgePaths.map(path => path.id)).size === edgePaths.length, '$edgePaths', 'one unique path per original global edge required');
  const report: XYPolygonPrismShellPreviewReport = { kind: 'xy-polygon-prism-shell-preview', bodyId: shell.id,
    sourceCurveId: shell.profile.id, meshId: options.meshId, revision: options.revision, vertexCount: positions.length / 3,
    triangleCount: indices.length / 3, edgePathCount: edgePaths.length, boundsMM: bounds, nativeIncidence,
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    limits: { sourceVertices: [3, 12], meshIdCharacters: 128, snapshotValues: 65536, snapshotDepth: 20, arrayElements: 128,
      recordFields: 16, stringCharacters: 128, maximumVertices: 72, maximumTriangles: 44, maximumEdgePaths: 36, pointsPerEdge: 2 } };
  return copyCadData({ packet, faceRanges, edgePaths, edgeProvenance, report });
}
