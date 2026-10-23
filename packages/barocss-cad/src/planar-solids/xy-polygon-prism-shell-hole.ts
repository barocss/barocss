import { buildXYPolygonPlanarFaceWithHole, validateXYPolygonPlanarFaceWithHoleBundle } from './xy-polygon-planar-face-hole.js';
import type { XYPolygonPlanarFaceWithHoleBundle } from './xy-polygon-planar-face-hole.js';
import { buildParametricFace, validateFaceBundle } from '../core/face.js';
import type { FaceBundle, FaceIds } from '../core/face.js';
import type { XYPolygonPrismQualifiedUse } from './xy-polygon-prism-shell.js';
import { validateModel, evaluateCurve, evaluateSurface, curveDomain } from '../core/math.js';
import { evaluateSurfaceD1 } from '../core/derivatives.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Model, Point, Surface } from '../types.js';

type Sense = 'forward' | 'reverse';
type LoopRole = 'outer' | 'hole';
type PlacedHoleTopology = Omit<XYPolygonPlanarFaceWithHoleBundle['topology'], 'kind' | 'face'> & {
  kind: 'placed-xy-polygon-cap-with-hole';
  face: Omit<XYPolygonPlanarFaceWithHoleBundle['topology']['face'], 'orientation'> & { orientation: Sense };
};
export interface XYPolygonPrismHoleCapFace {
  id: string; kind: 'placed-polygon-cap-with-hole'; sourceFaceId: string;
  local: XYPolygonPlanarFaceWithHoleBundle; placement: { translation: Point; orientation: Sense };
  world: { geometry: Model; topology: PlacedHoleTopology };
}
export interface XYPolygonPrismHoleWallFace {
  id: string; kind: 'lateral-face'; loopRole: LoopRole; sourceCurveId: string; sourceSegmentIndex: number; bundle: FaceBundle;
}
export interface XYPolygonPrismShellWithHoleOptions { bodyId: string; distanceMM: number }
export interface XYPolygonPrismShellWithHole {
  version: 0; kind: 'xy-polygon-prism-shell-with-hole'; id: string; sourceFace: XYPolygonPlanarFaceWithHoleBundle; distanceMM: number;
  construction: { operation: 'xy-polygon-prism-shell-with-hole'; inputFaceId: string; sourceCurveIds: { outer: string; hole: string }; outputBodyId: string; distanceMM: number; direction: Point };
  faces: (XYPolygonPrismHoleCapFace | XYPolygonPrismHoleWallFace)[];
  vertices: { id: string; point: Point; placement: 'bottom' | 'top'; source: { sourceFaceId: string; sourceCurveId: string; loopId: string; loopRole: LoopRole; index: number; sourceVertexId: string; parameter: number } }[];
  edges: { id: string; vertexIds: [string, string]; canonical: { faceId: string; edgeId: string; curveId: string }; uses: [XYPolygonPrismQualifiedUse, XYPolygonPrismQualifiedUse];
    source: { kind: 'bottom' | 'top' | 'vertical'; sourceFaceId: string; sourceCurveId: string; loopId: string; loopRole: LoopRole; index: number; parameterRange?: [number, number]; parameter?: number; sourceEdgeId?: string; sourceVertexId?: string } }[];
}
export interface XYPolygonPrismShellWithHoleReport {
  geometryFamily: 'xy-polygon-prism-shell-with-hole-v0'; sourceFaceId: string; sourceCurveIds: { outer: string; hole: string };
  bodyId: string; distanceMM: number; sourceOrientations: { outer: 'ccw' | 'cw'; hole: 'ccw' | 'cw' };
  faceCount: number; vertexCount: number; edgeCount: number; edgeUseCount: number;
  faceNormals: { faceId: string; normal: Point }[]; faceEulerContributions: { faceId: string; innerLoopCount: number; contribution: number }[];
  weightedEuler: 0; referenceSweptVolumeMM3: number; boundsMM: { min: Point; max: Point };
  incidenceValid: true; closed: true; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { bodyIdCharacters: 64; derivedIdCharacters: 128; combinedVertices: 12; maximumFaces: 14; maximumCapObjects: 15; lateralObjects: 5;
    snapshotValues: 65536; snapshotDepth: 20; arrayElements: 128; recordFields: 16; stringCharacters: 128; evaluationComparisonMM: 1e-9 };
}
export interface XYPolygonPrismShellWithHoleResult { shell: XYPolygonPrismShellWithHole; report: XYPolygonPrismShellWithHoleReport }
function check(condition: boolean, path: string, detail: string): asserts condition {
  if (!condition) throw new Error(('XY polygon prism shell with hole: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512));
}
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
function originalIds(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) originalIds(item, result);
  else if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    if ((key === 'id' || key === 'name') && typeof item === 'string') result.add(item); originalIds(item, result);
  }
  return result;
}
function placedCap(local: XYPolygonPlanarFaceWithHoleBundle, sourceFaceId: string, z: number, orientation: Sense): XYPolygonPrismHoleCapFace {
  const faceId = local.topology.face.id, sourceCurveIds = { outer: faceId + '_outer_source', hole: faceId + '_hole_source' };
  const translate = (p: Point): Point => [p[0], p[1], p[2] + z];
  const sourceId = (id: string): string => id === local.topology.sourceCurveIds.outer ? sourceCurveIds.outer : id === local.topology.sourceCurveIds.hole ? sourceCurveIds.hole : id;
  const objects = local.geometry.objects.map(object => object.kind === 'curve'
    ? { ...copyCadData(object), id: sourceId(object.id), controlPoints: object.controlPoints.map(translate) }
    : { ...copyCadData(object), controlPoints: object.controlPoints.map(row => row.map(translate)) });
  const topology: PlacedHoleTopology = { ...copyCadData(local.topology), kind: 'placed-xy-polygon-cap-with-hole', sourceCurveIds,
    face: { ...copyCadData(local.topology.face), orientation }, vertices: local.topology.vertices.map(vertex => ({ id: vertex.id, point: translate(vertex.point) })),
    edges: local.topology.edges.map(edge => ({ ...copyCadData(edge), sourceCurveId: sourceId(edge.sourceCurveId) })),
    loops: local.topology.loops.map(loop => ({ ...copyCadData(loop), sourceCurveId: sourceId(loop.sourceCurveId) })) };
  const geometry: Model = { ...copyCadData(local.geometry), name: faceId + '_world', objects }; validateModel(geometry);
  return { id: faceId, kind: 'placed-polygon-cap-with-hole', sourceFaceId, local: copyCadData(local), placement: { translation: [0, 0, z], orientation }, world: { geometry, topology } };
}
function assemble(sourceFace: XYPolygonPlanarFaceWithHoleBundle, bodyId: string, distanceMM: number): XYPolygonPrismShellWithHole {
  const sourceReport = validateXYPolygonPlanarFaceWithHoleBundle(sourceFace), sourceFaceId = sourceFace.topology.face.id;
  const definitions = sourceFace.topology.loops.map(loop => {
    const profile = sourceFace.geometry.objects.find(object => object.id === loop.sourceCurveId) as Curve;
    const alpha = sourceReport.sourceOrientations[loop.role] === (loop.role === 'outer' ? 'ccw' : 'cw') ? 1 : -1;
    return { role: loop.role, loopId: loop.id, profile, alpha, n: profile.controlPoints.length - 1 };
  });
  const descriptors = definitions.flatMap(definition => Array.from({ length: definition.n }, (_, index) => {
    const originalEdge = sourceFace.topology.edges.find(edge => edge.loopId === definition.loopId && edge.sourceSegmentIndex === index)!;
    return { ...definition, index, originalEdge, sourceVertexId: originalEdge.vertexIds[0] };
  }));
  const n = descriptors.length, bottomId = bodyId + '_bottom_cap', topId = bodyId + '_top_cap';
  const bottomVertices = descriptors.map(d => bodyId + '_v_bottom_' + d.role + '_' + d.index), topVertices = descriptors.map(d => bodyId + '_v_top_' + d.role + '_' + d.index);
  const globalIds = ['bottom', 'top', 'vertical'].flatMap(kind => descriptors.map(d => bodyId + '_e_' + kind + '_' + d.role + '_' + d.index));
  const wallIds = descriptors.map(d => bodyId + '_' + d.role + '_wall_' + d.index);
  const capIds = (id: string) => [id, id + '_surface', id + '_world', id + '_outer_source', id + '_hole_source', ...definitions.flatMap(d => [id + '_' + d.role + '_loop', ...Array.from({ length: d.n }, (_, i) => [id + '_' + d.role + '_v' + i, id + '_' + d.role + '_e' + i, id + '_' + d.role + '_c' + i]).flat()])];
  const wallNames = (id: string) => [id, id + '_surface', id + '_loop', ...Array.from({ length: 4 }, (_, i) => [id + '_v' + i, id + '_e' + i, id + '_c' + i]).flat()];
  const generated = [bodyId, ...bottomVertices, ...topVertices, ...globalIds, ...capIds(bottomId), ...capIds(topId), ...wallIds.flatMap(wallNames)], original = originalIds(sourceFace);
  check(generated.every(id => id.length <= 128 && !original.has(id)) && new Set(generated).size === generated.length, '$ids', 'body/global/qualified generated IDs must be distinct, bounded and differ from original face IDs');
  const outer = definitions.find(d => d.role === 'outer')!.profile, hole = definitions.find(d => d.role === 'hole')!.profile;
  const faces: XYPolygonPrismShellWithHole['faces'] = [
    placedCap(buildXYPolygonPlanarFaceWithHole(outer, hole, { faceId: bottomId }).bundle, sourceFaceId, 0, 'reverse'),
    placedCap(buildXYPolygonPlanarFaceWithHole(outer, hole, { faceId: topId }).bundle, sourceFaceId, distanceMM, 'forward'),
  ];
  const provenance = (d: typeof descriptors[number]) => ({ sourceFaceId, sourceCurveId: d.profile.id, loopId: d.loopId, loopRole: d.role, index: d.index, sourceVertexId: d.sourceVertexId, parameter: d.index });
  const vertices: XYPolygonPrismShellWithHole['vertices'] = descriptors.map((d, i) => ({ id: bottomVertices[i], point: [...d.profile.controlPoints[d.index]], placement: 'bottom', source: provenance(d) }));
  vertices.push(...descriptors.map((d, i) => ({ id: topVertices[i], point: [d.profile.controlPoints[d.index][0], d.profile.controlPoints[d.index][1], distanceMM] as Point, placement: 'top' as const, source: provenance(d) })));
  const byRoleIndex = new Map(descriptors.map((d, i) => [d.role + ':' + d.index, i]));
  const edges = globalIds.map((id, i) => {
    const flat = i % n, d = descriptors[flat], next = byRoleIndex.get(d.role + ':' + (d.index + 1) % d.n)!;
    const kind = i < n ? 'bottom' as const : i < 2 * n ? 'top' as const : 'vertical' as const;
    const source = { kind, sourceFaceId, sourceCurveId: d.profile.id, loopId: d.loopId, loopRole: d.role, index: d.index,
      ...(kind === 'vertical' ? { parameter: d.index, sourceVertexId: d.sourceVertexId } : { parameterRange: [...d.originalEdge.sourceParameterRange] as [number, number], sourceEdgeId: d.originalEdge.id }) };
    return { id, vertexIds: kind === 'bottom' ? [bottomVertices[flat], bottomVertices[next]] : kind === 'top' ? [topVertices[flat], topVertices[next]] : [bottomVertices[flat], topVertices[flat]],
      canonical: { faceId: '', edgeId: '', curveId: '' }, uses: [] as XYPolygonPrismQualifiedUse[], source };
  });
  const attach = (global: number, faceId: string, edgeId: string, curveId: string, direction: number, edgeSense: Sense, faceOrientation: Sense) => {
    edges[global].uses.push({ faceId, edgeId, curveId, curveDirection: sense(direction), edgeSense, faceOrientation, sense: sense(direction * sign(edgeSense) * sign(faceOrientation)) });
    if (direction > 0 && !edges[global].canonical.faceId) edges[global].canonical = { faceId, edgeId, curveId };
  };
  for (const [capIndex, face] of faces.entries()) {
    check(face.kind === 'placed-polygon-cap-with-hole', '$caps', 'actual two-loop cap required');
    for (const loop of face.world.topology.loops) for (const use of loop.uses) {
      const edge = face.world.topology.edges.find(edge => edge.id === use.edgeId)!, flat = byRoleIndex.get(edge.loopRole + ':' + edge.sourceSegmentIndex)!;
      attach(capIndex * n + flat, face.id, edge.id, edge.curveId, 1, use.sense, face.placement.orientation);
    }
  }
  for (const [flat, d] of descriptors.entries()) {
    const next = byRoleIndex.get(d.role + ':' + (d.index + 1) % d.n)!, j = (d.index + 1) % d.n;
    const a = d.profile.controlPoints[d.alpha > 0 ? d.index : j], b = d.profile.controlPoints[d.alpha > 0 ? j : d.index], faceId = wallIds[flat];
    const surface: Surface = { kind: 'surface', id: faceId + '_surface', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
      controlPoints: [[[a[0], a[1], 0], [a[0], a[1], distanceMM]], [[b[0], b[1], 0], [b[0], b[1], distanceMM]]], weights: [[1, 1], [1, 1]] };
    const names = (kind: string) => [0, 1, 2, 3].map(i => faceId + '_' + kind + i);
    const bundle = buildParametricFace(surface, { faceId, loopId: faceId + '_loop', vertexIds: names('v'), edgeIds: names('e'), curveIds: names('c') } as FaceIds);
    faces.push({ id: faceId, kind: 'lateral-face', loopRole: d.role, sourceCurveId: d.profile.id, sourceSegmentIndex: d.index, bundle });
    const maps = [[flat, d.alpha], [2 * n + (d.alpha > 0 ? next : flat), 1], [n + flat, -d.alpha], [2 * n + (d.alpha > 0 ? flat : next), -1]];
    bundle.topology.edges.forEach((edge, i) => attach(maps[i][0], faceId, edge.id, edge.curveId, maps[i][1], 'forward', 'forward'));
  }
  for (const edge of edges) check(edge.uses.length === 2 && edge.uses[0].sense !== edge.uses[1].sense && !!edge.canonical.faceId, '$edges #' + edge.id, 'exactly two opposite qualified uses/canonical Curve required');
  return copyCadData({ version: 0, kind: 'xy-polygon-prism-shell-with-hole', id: bodyId, sourceFace, distanceMM,
    construction: { operation: 'xy-polygon-prism-shell-with-hole', inputFaceId: sourceFaceId, sourceCurveIds: sourceFace.topology.sourceCurveIds, outputBodyId: bodyId, distanceMM, direction: [0, 0, 1] },
    faces, vertices, edges: edges as XYPolygonPrismShellWithHole['edges'] });
}
function report(shell: XYPolygonPrismShellWithHole): XYPolygonPrismShellWithHoleReport {
  const source = validateXYPolygonPlanarFaceWithHoleBundle(shell.sourceFace), global = new Map(shell.vertices.map(vertex => [vertex.id, vertex.point]));
  const faceNormals: XYPolygonPrismShellWithHoleReport['faceNormals'] = [], faceEulerContributions: XYPolygonPrismShellWithHoleReport['faceEulerContributions'] = [];
  for (const face of shell.faces) {
    const bundle = face.kind === 'placed-polygon-cap-with-hole' ? face.world : face.bundle;
    if (face.kind === 'placed-polygon-cap-with-hole') {
      validateXYPolygonPlanarFaceWithHoleBundle(face.local);
      for (const loop of face.world.topology.loops) for (const use of loop.uses) {
        const edge = face.world.topology.edges.find(edge => edge.id === use.edgeId)!, curve = face.world.geometry.objects.find(object => object.id === edge.curveId) as Curve;
        const original = face.world.geometry.objects.find(object => object.id === edge.sourceCurveId) as Curve;
        const surface = face.world.geometry.objects.find(object => object.id === face.world.topology.face.surfaceId) as Surface;
        check(original?.kind === 'curve' && edge.loopId === loop.id && edge.sourceCurveId === loop.sourceCurveId && edge.loopRole === loop.role, '$caps', 'actual translated original source/loop role binding required');
        for (const t of [0, .5, 1]) {
          const directed = use.sense === 'forward' ? t : 1 - t;
          const uv: [number, number] = [use.pcurve.uv0[0] + t * (use.pcurve.uv1[0] - use.pcurve.uv0[0]), use.pcurve.uv0[1] + t * (use.pcurve.uv1[1] - use.pcurve.uv0[1])];
          const actual = evaluateSurface(surface, uv[0], uv[1]), point = evaluateCurve(curve, directed);
          const sourcePoint = evaluateCurve(original, edge.sourceParameterRange[0] + directed * (edge.sourceParameterRange[1] - edge.sourceParameterRange[0]));
          check(Math.hypot(...actual.map((value, axis) => value - point[axis])) <= 1e-9 && Math.hypot(...point.map((value, axis) => value - sourcePoint[axis])) <= 1e-9, '$caps #' + face.id, 'placed world pcurve/native edge/original parameter evaluation mismatch');
        }
      }
    } else validateFaceBundle(face.bundle);
    validateModel(bundle.geometry);
    const surface = bundle.geometry.objects.find(object => object.id === bundle.topology.face.surfaceId) as Surface, d1 = evaluateSurfaceD1(surface, .5, .5);
    const cross: Point = [d1.du[1] * d1.dv[2] - d1.du[2] * d1.dv[1], d1.du[2] * d1.dv[0] - d1.du[0] * d1.dv[2], d1.du[0] * d1.dv[1] - d1.du[1] * d1.dv[0]], magnitude = Math.hypot(...cross);
    check(Number.isFinite(magnitude) && magnitude > 0, '$faces #' + face.id, 'nonzero actual SurfaceD1 normal required');
    faceNormals.push({ faceId: face.id, normal: cross.map(value => sign(bundle.topology.face.orientation) * value / magnitude) as Point });
    const innerLoopCount = face.kind === 'placed-polygon-cap-with-hole' ? face.world.topology.face.innerLoopIds.length : 0;
    faceEulerContributions.push({ faceId: face.id, innerLoopCount, contribution: 1 - innerLoopCount });
  }
  for (const edge of shell.edges) {
    check(edge.uses.length === 2 && edge.uses[0].sense !== edge.uses[1].sense, '$edges #' + edge.id, 'exact two opposite composed uses required');
    const original = shell.sourceFace.geometry.objects.find(object => object.id === edge.source.sourceCurveId) as Curve;
    check(original?.kind === 'curve', '$edges', 'actual original source Curve required');
    const sourceParameters = edge.source.kind === 'vertical' ? [edge.source.parameter!, edge.source.parameter!] : edge.source.parameterRange!;
    for (let end = 0; end < 2; end++) {
      const point = global.get(edge.vertexIds[end])!, sourcePoint = evaluateCurve(original, sourceParameters[end]);
      const expectedZ = edge.source.kind === 'top' || edge.source.kind === 'vertical' && end === 1 ? shell.distanceMM : 0;
      check(point[0] === sourcePoint[0] && point[1] === sourcePoint[1] && point[2] === expectedZ, '$edges #' + edge.id, 'original parameter/global endpoint placement mismatch');
    }
    for (const use of edge.uses) {
      const face = shell.faces.find(face => face.id === use.faceId); check(!!face, '$edges', 'actual qualified face required');
      const bundle = face.kind === 'placed-polygon-cap-with-hole' ? face.world : face.bundle;
      const local = bundle.topology.edges.find(local => local.id === use.edgeId);
      check(!!local && local.curveId === use.curveId, '$edges #' + edge.id, 'qualified native face-edge-Curve mismatch');
      const curve = bundle.geometry.objects.find(object => object.id === use.curveId);
      check(curve?.kind === 'curve', '$edges', 'actual qualified native Curve required');
      const domain = curveDomain(curve), points = [evaluateCurve(curve, domain[0]), evaluateCurve(curve, domain[1])];
      if (use.curveDirection === 'reverse') points.reverse();
      for (let end = 0; end < 2; end++) check(points[end].every((value, axis) => value === global.get(edge.vertexIds[end])![axis]), '$edges #' + edge.id, 'actual native Curve/global vertex endpoint binding mismatch');
      const nativeUse = face.kind === 'placed-polygon-cap-with-hole' ? face.world.topology.loops.flatMap(loop => loop.uses).find(native => native.edgeId === use.edgeId)! : face.bundle.topology.loop.uses.find(native => native.edgeId === use.edgeId)!;
      check(use.edgeSense === nativeUse.sense && use.faceOrientation === bundle.topology.face.orientation && use.sense === sense(sign(use.curveDirection) * sign(use.edgeSense) * sign(use.faceOrientation)), '$edges', 'actual native use/composed orientation mismatch');
    }
  }
  const weightedEuler = shell.vertices.length - shell.edges.length + faceEulerContributions.reduce((sum, face) => sum + face.contribution, 0);
  check(weightedEuler === 0, '$incidence', 'through-hole shell weighted Euler0 required; annular caps contribute0');
  const referenceSweptVolumeMM3 = source.areasMM2.net * shell.distanceMM;
  check(referenceSweptVolumeMM3 > 0 && Number.isSafeInteger(2 * referenceSweptVolumeMM3), '$reference', 'safe mathematical half-integer swept-volume reference required');
  const boundsMM = { min: [0, 1, 2].map(axis => Math.min(...shell.vertices.map(vertex => vertex.point[axis]))) as Point, max: [0, 1, 2].map(axis => Math.max(...shell.vertices.map(vertex => vertex.point[axis]))) as Point };
  return { geometryFamily: 'xy-polygon-prism-shell-with-hole-v0', sourceFaceId: source.faceId, sourceCurveIds: copyCadData(source.sourceCurveIds), bodyId: shell.id, distanceMM: shell.distanceMM,
    sourceOrientations: copyCadData(source.sourceOrientations), faceCount: shell.faces.length, vertexCount: shell.vertices.length, edgeCount: shell.edges.length, edgeUseCount: shell.edges.reduce((sum, edge) => sum + edge.uses.length, 0),
    faceNormals, faceEulerContributions, weightedEuler: 0, referenceSweptVolumeMM3, boundsMM, incidenceValid: true, closed: true, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    limits: { bodyIdCharacters: 64, derivedIdCharacters: 128, combinedVertices: 12, maximumFaces: 14, maximumCapObjects: 15, lateralObjects: 5,
      snapshotValues: 65536, snapshotDepth: 20, arrayElements: 128, recordFields: 16, stringCharacters: 128, evaluationComparisonMM: 1e-9 } };
}
export function buildXYPolygonPrismShellWithHole(faceBundle: XYPolygonPlanarFaceWithHoleBundle, inputOptions: XYPolygonPrismShellWithHoleOptions): XYPolygonPrismShellWithHoleResult {
  const sourceFace = snapshot(faceBundle, '$sourceFace') as XYPolygonPlanarFaceWithHoleBundle;
  const data = record(snapshot(inputOptions, '$options'), ['bodyId', 'distanceMM'], '$options'), admitted = options(data.bodyId, data.distanceMM);
  const shell = assemble(sourceFace, admitted.bodyId, admitted.distanceMM); return copyCadData({ shell, report: report(shell) });
}
export function validateXYPolygonPrismShellWithHole(input: XYPolygonPrismShellWithHole): XYPolygonPrismShellWithHoleReport {
  const data = record(snapshot(input, '$shell'), ['version', 'kind', 'id', 'sourceFace', 'distanceMM', 'construction', 'faces', 'vertices', 'edges'], '$shell');
  check(data.version === 0 && data.kind === 'xy-polygon-prism-shell-with-hole', '$shell', 'distinct through-hole prism shell family0 required');
  const admitted = options(data.id, data.distanceMM), expected = assemble(data.sourceFace as XYPolygonPlanarFaceWithHoleBundle, admitted.bodyId, admitted.distanceMM);
  check(exact(data, expected), '$shell', 'canonical original face/placed two-loop caps/walls/qualified shared incidence mismatch'); return copyCadData(report(expected));
}
