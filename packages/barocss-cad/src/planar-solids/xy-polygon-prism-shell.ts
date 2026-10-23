import { validateXYPolygonRegion } from '../sketch/xy-polygon-region.js';
import { buildXYPolygonPlanarFace, validateXYPolygonPlanarFaceBundle } from './xy-polygon-planar-face.js';
import type { XYPolygonPlanarFaceBundle } from './xy-polygon-planar-face.js';
import { buildParametricFace, validateFaceBundle } from '../core/face.js';
import type { FaceBundle, FaceIds } from '../core/face.js';
import { validateModel } from '../core/math.js';
import { evaluateSurfaceD1 } from '../core/derivatives.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Model, Point, Surface } from '../types.js';

type Sense = 'forward' | 'reverse';
type PlacedTopology = Omit<XYPolygonPlanarFaceBundle['topology'], 'kind' | 'face'> & { kind: 'placed-xy-polygon-cap'; face: Omit<XYPolygonPlanarFaceBundle['topology']['face'], 'orientation'> & { orientation: Sense } };
export interface XYPolygonPrismCapFace { id: string; kind: 'placed-polygon-cap'; local: XYPolygonPlanarFaceBundle; placement: { translation: Point; orientation: Sense }; world: { geometry: Model; topology: PlacedTopology } }
export interface XYPolygonPrismLateralFace { id: string; kind: 'lateral-face'; bundle: FaceBundle }
export interface XYPolygonPrismShellOptions { bodyId: string; distanceMM: number }
export interface XYPolygonPrismQualifiedUse { faceId: string; edgeId: string; curveId: string; curveDirection: Sense; edgeSense: Sense; faceOrientation: Sense; sense: Sense }
export interface XYPolygonPrismShell {
  version: 0; kind: 'xy-polygon-prism-shell'; id: string; profile: Curve; distanceMM: number;
  faces: (XYPolygonPrismCapFace | XYPolygonPrismLateralFace)[]; vertices: { id: string; point: Point }[];
  edges: { id: string; vertexIds: [string, string]; canonical: { faceId: string; edgeId: string; curveId: string }; uses: [XYPolygonPrismQualifiedUse, XYPolygonPrismQualifiedUse]; source: { kind: 'bottom' | 'top' | 'vertical'; index: number; parameterRange?: [number, number]; parameter?: number } }[];
}
export interface XYPolygonPrismShellReport { geometryFamily: 'xy-polygon-prism-shell-v0'; sourceCurveId: string; bodyId: string; distanceMM: number; sourceOrientation: 'ccw' | 'cw'; faceCount: number; vertexCount: number; edgeCount: number; edgeUseCount: number; faceNormals: { faceId: string; normal: Point }[]; boundsMM: { min: Point; max: Point }; incidenceValid: true; closed: true; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { bodyIdCharacters: 64; derivedIdCharacters: 128; sourceVertices: [3, 12]; modelObjectMaximum: 16; snapshotValues: 65536; snapshotDepth: 20; arrayElements: 128; recordFields: 16; stringCharacters: 128 } }
export interface XYPolygonPrismShellResult { shell: XYPolygonPrismShell; report: XYPolygonPrismShellReport }
function check(condition: boolean, path: string, detail: string): asserts condition { if (!condition) throw new Error(('XY polygon prism shell: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512)); }
function snapshot(input: unknown, rootPath: string): unknown {
  let remaining = 65536;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 20, path, 'bounded snapshot65536/depth20 exceeded');
    if (typeof value === 'number') { check(Number.isFinite(value), path, 'finite data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, path, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', path, 'plain numeric/string/record data required'); const array = Array.isArray(value), prototype = Object.getPrototypeOf(value); check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, path, 'foreign prototype unsupported');
    const keys = Reflect.ownKeys(value); check(keys.length <= (array ? 129 : 16) && keys.every(key => typeof key === 'string' && key.length <= 128), path, 'bounded own fields required'); const descriptors = Object.getOwnPropertyDescriptors(value); check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), path, 'getters/symbols/hidden fields unsupported');
    if (array) { const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 128 && keys.length === length + 1, path, 'dense bounded array required'); const result: unknown[] = []; for (let i = 0; i < length; i++) { check(Object.hasOwn(descriptors, String(i)), path, 'sparse/extra array field'); result.push(copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']')); } return result; }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
  }; return copy(input, 0, rootPath);
}
function record(value: unknown, fields: string[], path: string): Record<string, unknown> { check(value !== null && typeof value === 'object' && !Array.isArray(value), path, 'record required'); const data = value as Record<string, unknown>; check(Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), path, 'exact fields required'); return data; }
function options(bodyId: unknown, distanceMM: unknown): { bodyId: string; distanceMM: number } { check(typeof bodyId === 'string' && bodyId.length <= 64 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(bodyId), '$bodyId', 'ASCII body ID1..64 required for bounded cap IDs'); check(typeof distanceMM === 'number' && Number.isInteger(distanceMM) && distanceMM >= 1 && distanceMM <= 10000, '$distanceMM', 'integer +Z distance1..10000 required'); return { bodyId, distanceMM }; }
function exact(a: unknown, b: unknown): boolean { if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => exact(value, b[i])); if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>; return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && exact(x[key], y[key])); } return Object.is(a, b); }
const sign = (sense: Sense): number => sense === 'forward' ? 1 : -1;
const sense = (value: number): Sense => value > 0 ? 'forward' : 'reverse';
function worldCap(local: XYPolygonPlanarFaceBundle, z: number, orientation: Sense): XYPolygonPrismCapFace {
  const faceId = local.topology.face.id, sourceId = faceId + '_source', point = (p: Point): Point => [p[0], p[1], p[2] + z];
  const objects = local.geometry.objects.map((object, i) => object.kind === 'curve' ? { ...copyCadData(object), id: i === 0 ? sourceId : object.id, controlPoints: object.controlPoints.map(point) } : { ...copyCadData(object), controlPoints: object.controlPoints.map(row => row.map(point)) });
  const world = { geometry: { ...copyCadData(local.geometry), name: faceId + '_world', objects }, topology: { ...copyCadData(local.topology), kind: 'placed-xy-polygon-cap' as const, sourceCurveId: sourceId, face: { ...copyCadData(local.topology.face), orientation }, vertices: local.topology.vertices.map(vertex => ({ id: vertex.id, point: point(vertex.point) })) } };
  validateModel(world.geometry); return { id: faceId, kind: 'placed-polygon-cap', local: copyCadData(local), placement: { translation: [0, 0, z], orientation }, world };
}
function assemble(profile: Curve, bodyId: string, distance: number): XYPolygonPrismShell {
  const region = validateXYPolygonRegion(profile), n = region.vertexCount; check(n >= 3 && n <= 12, '$profile', '3..12 source vertices required');
  const bottomId = bodyId + '_bottom_cap', topId = bodyId + '_top_cap', sideIds = Array.from({ length: n }, (_, i) => bodyId + '_side_' + i);
  const bottomVertices = Array.from({ length: n }, (_, i) => bodyId + '_v_bottom_' + i), topVertices = Array.from({ length: n }, (_, i) => bodyId + '_v_top_' + i);
  const globalIds = ['bottom', 'top', 'vertical'].flatMap(kind => Array.from({ length: n }, (_, i) => bodyId + '_e_' + kind + '_' + i));
  const localIds = (faceId: string, count: number) => [faceId, faceId + '_surface', faceId + '_loop', ...Array.from({ length: count }, (_, i) => [faceId + '_v' + i, faceId + '_e' + i, faceId + '_c' + i]).flat()];
  const ids = [bodyId, profile.id, ...bottomVertices, ...topVertices, ...globalIds, ...localIds(bottomId, n), bottomId + '_source', ...localIds(topId, n), topId + '_source', ...sideIds.flatMap(id => localIds(id, 4))]; check(ids.every(id => id.length <= 128) && new Set(ids).size === ids.length, '$ids', 'source/body/global/qualified local IDs must be bounded/distinct');
  const bottomLocal = buildXYPolygonPlanarFace(profile, { faceId: bottomId }).bundle, topLocal = buildXYPolygonPlanarFace(profile, { faceId: topId }).bundle;
  const faces: XYPolygonPrismShell['faces'] = [worldCap(bottomLocal, 0, 'reverse'), worldCap(topLocal, distance, 'forward')], alpha = region.orientation === 'ccw' ? 1 : -1;
  const vertices = [...profile.controlPoints.slice(0, n).map((p, i) => ({ id: bottomVertices[i], point: [p[0], p[1], 0] as Point })), ...profile.controlPoints.slice(0, n).map((p, i) => ({ id: topVertices[i], point: [p[0], p[1], distance] as Point }))];
  const edges = globalIds.map((id, i) => { const k = i % n, kind = i < n ? 'bottom' as const : i < 2 * n ? 'top' as const : 'vertical' as const, next = (k + 1) % n; return { id, vertexIds: kind === 'bottom' ? [bottomVertices[k], bottomVertices[next]] : kind === 'top' ? [topVertices[k], topVertices[next]] : [bottomVertices[k], topVertices[k]], canonical: { faceId: '', edgeId: '', curveId: '' }, uses: [] as XYPolygonPrismQualifiedUse[], source: kind === 'vertical' ? { kind, index: k, parameter: k } : { kind, index: k, parameterRange: [k, k + 1] as [number, number] } }; });
  const attach = (global: number, faceId: string, edgeId: string, curveId: string, direction: number, edgeSense: Sense, faceOrientation: Sense) => { const use = { faceId, edgeId, curveId, curveDirection: sense(direction), edgeSense, faceOrientation, sense: sense(direction * sign(edgeSense) * sign(faceOrientation)) }; edges[global].uses.push(use); if (direction > 0 && !edges[global].canonical.faceId) edges[global].canonical = { faceId, edgeId, curveId }; };
  for (const [faceIndex, cap] of faces.entries()) {
    check(cap.kind === 'placed-polygon-cap', '$caps', 'actual cap required');
    for (const use of cap.world.topology.loop.uses) { const edge = cap.world.topology.edges.find(edge => edge.id === use.edgeId)!; attach(faceIndex * n + edge.sourceSegmentIndex, cap.id, edge.id, edge.curveId, 1, use.sense, cap.placement.orientation); }
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = profile.controlPoints[alpha > 0 ? i : j], b = profile.controlPoints[alpha > 0 ? j : i], faceId = sideIds[i];
    const surface: Surface = { kind: 'surface', id: faceId + '_surface', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[a[0], a[1], 0], [a[0], a[1], distance]], [[b[0], b[1], 0], [b[0], b[1], distance]]], weights: [[1, 1], [1, 1]] };
    const names = (kind: string) => [0, 1, 2, 3].map(k => faceId + '_' + kind + k);
    const bundle = buildParametricFace(surface, { faceId, loopId: faceId + '_loop', vertexIds: names('v'), edgeIds: names('e'), curveIds: names('c') } as FaceIds); faces.push({ id: faceId, kind: 'lateral-face', bundle });
    const maps = [[i, alpha], [2 * n + (alpha > 0 ? j : i), 1], [n + i, -alpha], [2 * n + (alpha > 0 ? i : j), -1]];
    bundle.topology.edges.forEach((edge, k) => attach(maps[k][0], faceId, edge.id, edge.curveId, maps[k][1], 'forward', 'forward'));
  }
  for (const edge of edges) check(edge.uses.length === 2 && edge.uses[0].sense !== edge.uses[1].sense && !!edge.canonical.faceId, '$edges #' + edge.id, 'exactly two opposite qualified uses/canonical Curve required');
  return copyCadData({ version: 0, kind: 'xy-polygon-prism-shell', id: bodyId, profile, distanceMM: distance, faces, vertices, edges: edges as XYPolygonPrismShell['edges'] });
}
function report(shell: XYPolygonPrismShell): XYPolygonPrismShellReport {
  const region = validateXYPolygonRegion(shell.profile), global = new Map(shell.vertices.map(vertex => [vertex.id, vertex.point])), faceNormals: XYPolygonPrismShellReport['faceNormals'] = [];
  for (const face of shell.faces) {
    const bundle = face.kind === 'placed-polygon-cap' ? face.world : face.bundle;
    if (face.kind === 'placed-polygon-cap') validateXYPolygonPlanarFaceBundle(face.local); else validateFaceBundle(face.bundle);
    validateModel(bundle.geometry); const surface = bundle.geometry.objects.find(object => object.id === bundle.topology.face.surfaceId) as Surface, d1 = evaluateSurfaceD1(surface, .5, .5), cross: Point = [d1.du[1] * d1.dv[2] - d1.du[2] * d1.dv[1], d1.du[2] * d1.dv[0] - d1.du[0] * d1.dv[2], d1.du[0] * d1.dv[1] - d1.du[1] * d1.dv[0]], magnitude = Math.hypot(...cross), orientation = sign(bundle.topology.face.orientation); check(Number.isFinite(magnitude) && magnitude > 0, '$faces #' + face.id, 'nonzero actual face normal required'); faceNormals.push({ faceId: face.id, normal: cross.map(value => orientation * value / magnitude) as Point });
  }
  for (const edge of shell.edges) {
    check(edge.uses.length === 2 && edge.uses[0].sense !== edge.uses[1].sense, '$edges #' + edge.id, 'missing/opposed-use incidence error');
    for (const use of edge.uses) {
      const face = shell.faces.find(face => face.id === use.faceId); check(!!face, '$edges #' + edge.id, 'unknown qualified face'); const bundle = face.kind === 'placed-polygon-cap' ? face.world : face.bundle;
      const local = bundle.topology.edges.find(local => local.id === use.edgeId); check(!!local && local.curveId === use.curveId, '$edges #' + edge.id, 'qualified face-edge-Curve reference mismatch'); const curve = bundle.geometry.objects.find(object => object.id === use.curveId); check(curve?.kind === 'curve' && curve.controlPoints.length === 2, '$edges #' + edge.id, 'actual qualified edge Curve required');
      const start = global.get(edge.vertexIds[use.curveDirection === 'forward' ? 0 : 1]), end = global.get(edge.vertexIds[use.curveDirection === 'forward' ? 1 : 0]); check(!!start && !!end && curve.controlPoints[0].every((value, axis) => value === start[axis]) && curve.controlPoints[1].every((value, axis) => value === end[axis]), '$edges #' + edge.id, 'qualified native endpoint/global vertex binding mismatch');
      check(use.faceOrientation === bundle.topology.face.orientation && use.sense === sense(sign(use.curveDirection) * sign(use.edgeSense) * sign(use.faceOrientation)), '$edges #' + edge.id, 'composed orientation mismatch');
    }
  }
  return { geometryFamily: 'xy-polygon-prism-shell-v0', sourceCurveId: shell.profile.id, bodyId: shell.id, distanceMM: shell.distanceMM, sourceOrientation: region.orientation, faceCount: shell.faces.length, vertexCount: shell.vertices.length, edgeCount: shell.edges.length, edgeUseCount: shell.edges.reduce((sum, edge) => sum + edge.uses.length, 0), faceNormals, boundsMM: { min: [...region.boundsMM.min], max: [region.boundsMM.max[0], region.boundsMM.max[1], shell.distanceMM] }, incidenceValid: true, closed: true, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    limits: { bodyIdCharacters: 64, derivedIdCharacters: 128, sourceVertices: [3, 12], modelObjectMaximum: 16, snapshotValues: 65536, snapshotDepth: 20, arrayElements: 128, recordFields: 16, stringCharacters: 128 } };
}
export function buildXYPolygonPrismShell(profile: Curve, inputOptions: XYPolygonPrismShellOptions): XYPolygonPrismShellResult { const source = snapshot(profile, '$profile') as Curve, data = record(snapshot(inputOptions, '$options'), ['bodyId', 'distanceMM'], '$options'), admitted = options(data.bodyId, data.distanceMM), shell = assemble(source, admitted.bodyId, admitted.distanceMM); return copyCadData({ shell, report: report(shell) }); }
export function validateXYPolygonPrismShell(input: XYPolygonPrismShell): XYPolygonPrismShellReport { const data = record(snapshot(input, '$shell'), ['version', 'kind', 'id', 'profile', 'distanceMM', 'faces', 'vertices', 'edges'], '$shell'); check(data.version === 0 && data.kind === 'xy-polygon-prism-shell', '$shell', 'polygon prism shell family0 required'); const admitted = options(data.id, data.distanceMM), expected = assemble(data.profile as Curve, admitted.bodyId, admitted.distanceMM); check(exact(data, expected), '$shell', 'canonical placed-cap/lateral/global qualified incidence mismatch'); return copyCadData(report(expected)); }
