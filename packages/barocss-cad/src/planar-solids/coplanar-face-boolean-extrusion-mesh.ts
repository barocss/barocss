import { CadNumericPolicy } from '../numeric-policy.js';
import { validateCoplanarFaceBooleanExtrusion } from './coplanar-face-boolean-extrusion.js';
import type { CoplanarFaceBooleanExtrusionResult } from './coplanar-face-boolean-extrusion.js';
import { tessellateCoplanarFaceBoolean } from './coplanar-face-boolean-mesh.js';
import type { CoplanarFaceBooleanMeshResult } from './coplanar-face-boolean-mesh.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../core/derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import { curveDomain, surfaceDomain } from '../core/math.js';
import type { Point } from '../types.js';
import { same } from '../core/structural-equality.js';

export const CoplanarFaceBooleanExtrusionMeshDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET',
  NATIVE: 'NATIVE', REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', INCIDENCE: 'INCIDENCE', COVERAGE: 'COVERAGE', OWNED: 'OWNED' } as const);
export type CoplanarFaceBooleanExtrusionMeshDiagnosticCode = typeof CoplanarFaceBooleanExtrusionMeshDiagnosticCode[keyof typeof CoplanarFaceBooleanExtrusionMeshDiagnosticCode];
export class CoplanarFaceBooleanExtrusionMeshError extends Error {
  readonly code: CoplanarFaceBooleanExtrusionMeshDiagnosticCode;
  constructor(code: CoplanarFaceBooleanExtrusionMeshDiagnosticCode, detail: string, cause?: unknown) {
    super(('Coplanar Face Boolean Extrusion Mesh: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CoplanarFaceBooleanExtrusionMeshError'; this.code = code;
  }
}
export interface CoplanarFaceBooleanExtrusionMeshOptions { meshId: string; maximumVertices: number; maximumTriangles: number; maximumEdgePaths: number; maximumNativeSamples: number }
type SourcePointer = CoplanarFaceBooleanExtrusionResult['edges'][number]['source'];
type TriangleUse = { triangleId: string; from: number; to: number };
export interface CoplanarFaceBooleanExtrusionMeshVertex {
  index: number; faceId: string; shellId: string; componentId: string; nativeVertexId: string; regionVertexId: string;
  regionMeshVertexIndex: number | null; surfaceId: string; source: SourcePointer; uv: [number, number];
  surfaceD1: SurfaceD1Result; orientedNormal: Point; canonicalPointMM: Point; pointDifferenceMM: number;
}
export interface CoplanarFaceBooleanExtrusionMeshFaceRange {
  faceId: string; shellId: string; componentId: string; kind: 'bottom-cap' | 'top-cap' | 'wall'; orientation: 'forward' | 'reverse'; surfaceId: string; source: SourcePointer;
  vertexStart: number; vertexCount: number; indexStart: number; indexCount: number; triangleStart: number; triangleCount: number;
  triangles: { id: string; vertexIndices: [number, number, number]; regionMeshTriangleId: string | null; indexStart: number; areaMM2: number; minimumNormalDot: number }[];
  loops: { loopId: string; role: 'outer' | 'hole'; nativeLoopId: string | null; effectiveUseIds: string[];
    uses: { useId: string; edgeId: string; curveId: string; pcurveId: string; edgeSense: 'forward' | 'reverse'; effectiveSense: 'forward' | 'reverse';
      localVertexIds: [string, string]; effectiveVertexIds: [string, string]; localVertexIndices: [number, number]; effectiveVertexIndices: [number, number];
      interval: [number, number]; effectiveInterval: [number, number] }[] }[];
  boundaryIncidence: { loopId: string; useId: string; edgeId: string; curveId: string; pcurveId: string; effectiveSense: 'forward' | 'reverse';
    vertexIndices: [number, number]; triangleUses: TriangleUse[] }[];
  internalEdges: { id: string; kind: 'display-cap-bridge' | 'display-cap-diagonal' | 'display-wall-diagonal'; regionMeshEdgeId: string | null;
    vertexIndices: [number, number]; triangleUses: TriangleUse[] }[];
  wallCenterObservation: { u: number; v: number; surfaceD1: SurfaceD1Result; orientedNormal: Point;
    trianglePlaneDistancesMM: [number, number]; minimumTrianglePlaneDistanceMM: number; minimumNormalDot: number } | null;
}
export interface CoplanarFaceBooleanExtrusionMeshEdgePath {
  edgeId: string; shellId: string; componentId: string; kind: 'bottom' | 'top' | 'vertical'; curveId: string; source: SourcePointer;
  interval: [number, number]; nativeVertexIds: [string, string]; nativeFragmentId: string | null; nativeVertexId: string | null;
  samples: { parameter: number; curveD1: CurveD1Result }[];
  adjacentFaces: { faceId: string; loopId: string; useId: string; pcurveId: string; effectiveSense: 'forward' | 'reverse';
    vertexIndices: [number, number]; endpointDifferencesMM: [number, number]; triangleUses: TriangleUse[] }[];
}
export interface CoplanarFaceBooleanExtrusionMeshShellRange {
  shellId: string; componentId: string; nativeFaceIds: string[]; nativeEdgeIds: string[]; nativeVertexIds: string[]; holeLoopIds: string[];
  faceRangeIndices: number[]; edgePathIndices: number[]; vertexCount: number; triangleCount: number; edgePathCount: number; solid: false;
}
export interface CoplanarFaceBooleanExtrusionMeshReport {
  schema: 'barocss-native-coplanar-face-boolean-extrusion-mesh'; version: 0; meshId: string; extrusionEvaluationId: string; booleanEvaluationId: string;
  lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion'; uvUnits: 'dimensionless-per-face-native-parameters'; empty: boolean;
  nativeVertexCount: number; nativeFragmentCount: number; componentCount: number; holeCount: number; vertexCount: number; triangleCount: number;
  edgePathCount: number; faceRangeCount: number; shellRangeCount: number; internalEdgeCount: number;
  expectedVertexCount: number; expectedTriangleCount: number; expectedEdgePathCount: number;
  wrapperWork: { nativeSampleCount: number; surfaceD1EvaluationCount: number; faceVertexSurfaceD1EvaluationCount: number;
    wallCenterSurfaceD1EvaluationCount: number; curveD1EvaluationCount: number; edgePathCurveD1EvaluationCount: number };
  regionMeshWork: { surfaceD1EvaluationCount: number; curveD1EvaluationCount: number; candidatePairCount: number; predicateTestCount: number;
    vertexTripleTestCount: number; trianglePairTestCount: number; triangleTestCount: number };
  maximumVertexDifferenceMM: number; maximumPathEndpointDifferenceMM: number; maximumWallCenterPlaneDifferenceMM: number;
  incidenceValid: true; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { geometryAuthority: 'unchanged-native-extrusion-curves-surfaces-trims-and-source0'; capConnectivity: 'actual-owned-native-region-mesh';
    positions: 'actual-derived-cap-and-wall-surface-d1-no-display-top-translation'; normals: 'per-face-hard-native-outward-normals';
    truePaths: 'actual-global-native-edges-with-both-adjacent-face-endpoints'; internalEdges: 'display-only-cap-diagonals-bridges-and-wall-diagonals';
    boundsAuthority: 'actual-display-positions-not-certified-native-geometry-bounds';
    workScope: 'new-wrapper-native-samples-separate-from-region-mesh-work-and-parent-reconstruction';
    nativeInverseCertified: false; exactSewingCertified: false; globalManifoldCertified: false; globalShapeErrorCertified: false;
    manufacturingToleranceCertified: false; rendererCapacityCertified: false; ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-filled-mesh';
  limits: { maximumVertices: 384; maximumTriangles: 288; maximumEdgePaths: 192; maximumNativeSamples: 1024; maximumFaceRanges: 80; maximumShellRanges: 8;
    ownValues: 1048576; ownDepth: 40; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144; meshIdCharacters: 12; pointComparisonMM: 1e-7 };
}
export interface CoplanarFaceBooleanExtrusionMeshResult {
  extrusion: CoplanarFaceBooleanExtrusionResult; options: CoplanarFaceBooleanExtrusionMeshOptions; regionMesh: CoplanarFaceBooleanMeshResult;
  mesh: { id: string; binding: { extrusionEvaluationId: string; booleanEvaluationId: string; nativeShellIds: string[]; sourceAssetIds: string[]; regionMeshId: string };
    positionsMM: number[]; normals: number[]; parametersUV: number[]; indices: number[]; vertices: CoplanarFaceBooleanExtrusionMeshVertex[]; boundsMM: { min: Point; max: Point } | null };
  faceRanges: CoplanarFaceBooleanExtrusionMeshFaceRange[]; edgePaths: CoplanarFaceBooleanExtrusionMeshEdgePath[];
  shellRanges: CoplanarFaceBooleanExtrusionMeshShellRange[]; report: CoplanarFaceBooleanExtrusionMeshReport;
}

const CODE = CoplanarFaceBooleanExtrusionMeshDiagnosticCode, TOLERANCE = CadNumericPolicy.linearToleranceMM;
function check(condition: boolean, code: CoplanarFaceBooleanExtrusionMeshDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CoplanarFaceBooleanExtrusionMeshError(code, detail);
}
function native<T>(action: () => T, detail: string, code: CoplanarFaceBooleanExtrusionMeshDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CoplanarFaceBooleanExtrusionMeshError) throw cause;
    throw new CoplanarFaceBooleanExtrusionMeshError(code, detail, cause);
  }
}
function snapshot(input: unknown, code: CoplanarFaceBooleanExtrusionMeshDiagnosticCode = CODE.INPUT): unknown {
  let remaining = 1048576;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 40, code, 'own-value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, code, 'source string budget exceeded'); return value; }
    check(value !== null && typeof value === 'object', code, 'plain own data required');
    check(!ancestors.has(value), code, 'ancestor cycles refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused');
    check(keys.length <= (array ? 8193 : 64) && keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden/excess own fields refused');
    ancestors.add(value);
    try {
      if (array) {
        const length = descriptors.length.value as number;
        check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'dense bounded own array required');
        return Array.from({ length }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), code, 'sparse or foreign own array field refused');
          return copy(descriptors[String(i)].value, depth + 1); });
      }
      return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    } finally { ancestors.delete(value); }
  };
  return copy(input, 0);
}
function record(input: unknown, fields: string[], code: CoplanarFaceBooleanExtrusionMeshDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required');
  const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(',')); return data;
}
function id(value: unknown, maximum = 48): string {
  check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..' + maximum + ' required'); return value;
}
function admitOptions(input: unknown): CoplanarFaceBooleanExtrusionMeshOptions {
  const data = record(input, ['meshId', 'maximumVertices', 'maximumTriangles', 'maximumEdgePaths', 'maximumNativeSamples']);
  for (const [field, maximum] of [['maximumVertices', 384], ['maximumTriangles', 288], ['maximumEdgePaths', 192], ['maximumNativeSamples', 1024]] as const)
    check(typeof data[field] === 'number' && Number.isInteger(data[field]) && (data[field] as number) >= 0 && (data[field] as number) <= maximum,
      CODE.BUDGET, 'integer ' + field + ' within frozen native display limits required');
  return { meshId: id(data.meshId, 12), maximumVertices: data.maximumVertices as number, maximumTriangles: data.maximumTriangles as number,
    maximumEdgePaths: data.maximumEdgePaths as number, maximumNativeSamples: data.maximumNativeSamples as number };
}
function collectIds(input: unknown): Set<string> {
  const result = new Set<string>(), collect = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && (key === 'id' || key.endsWith('Id') || key === 'name')) result.add(item);
      else if (key.endsWith('Ids') && Array.isArray(item)) for (const value of item) { if (typeof value === 'string') result.add(value); }
      else collect(item);
    }
  }; collect(input); return result;
}
function reserveRoles(extrusion: CoplanarFaceBooleanExtrusionResult, regionMesh: CoplanarFaceBooleanMeshResult,
  options: CoplanarFaceBooleanExtrusionMeshOptions): (suffix: string) => string {
  const nativeIds = collectIds(extrusion), generated = new Set([regionMesh.mesh.id, ...regionMesh.triangulation.triangles.map(triangle => triangle.id),
    ...regionMesh.triangulation.internalEdges.map(edge => edge.id)]);
  check([...generated].every(value => !nativeIds.has(value)), CODE.IDENTITY, 'reused region mesh display roles collide with native extrusion identities');
  const role = (suffix: string): string => options.meshId + suffix;
  const reserve = (value: string): void => { id(value); check(!nativeIds.has(value) && !generated.has(value), CODE.IDENTITY,
    'new filled display role collides with native or reused region mesh identity'); generated.add(value); };
  reserve(options.meshId);
  for (let i = 0; i < 288; i++) reserve(role('_tri_' + i));
  for (let i = 0; i < 240; i++) reserve(role('_int_' + i)); return role;
}
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'finite native display point/normal/plane arithmetic required'); return value; }
function product(a: number, b: number): number { const value = finite(a * b);
  check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero display arithmetic product underflow'); return value; }
function delta(a: Point, b: Point): Point { return a.map((value, i) => finite(value - b[i])) as Point; }
function cross(a: Point, b: Point): Point { return [finite(product(a[1], b[2]) - product(a[2], b[1])),
  finite(product(a[2], b[0]) - product(a[0], b[2])), finite(product(a[0], b[1]) - product(a[1], b[0]))]; }
function dot(a: Point, b: Point): number { return a.reduce((sum, value, i) => finite(sum + product(value, b[i])), 0); }
function unit(value: Point): Point { const length = finite(Math.hypot(...value)); check(length > 0, CODE.REPRESENTABILITY, 'nonzero actual native/display normal required');
  return value.map(component => { const result = finite(component / length); check(component === 0 || result !== 0, CODE.REPRESENTABILITY, 'nonzero normalized component underflow'); return result; }) as Point; }
function distance(a: Point, b: Point): number { return finite(Math.hypot(...delta(a, b))); }
function key(a: number, b: number): string { return a < b ? a + ':' + b : b + ':' + a; }

/** Filled face-local display vertices retain native hard normals and every true paired edge path. */
export function tessellateCoplanarFaceBooleanExtrusion(extrusionInput: CoplanarFaceBooleanExtrusionResult,
  optionsInput: CoplanarFaceBooleanExtrusionMeshOptions): CoplanarFaceBooleanExtrusionMeshResult {
  const data = record(snapshot({ extrusion: extrusionInput, options: optionsInput }), ['extrusion', 'options']);
  const extrusion = data.extrusion as CoplanarFaceBooleanExtrusionResult, options = admitOptions(data.options);
  native(() => validateCoplanarFaceBooleanExtrusion(extrusion), 'complete actual native extrusion parent reconstruction', CODE.INPUT);
  const n = extrusion.region.vertices.length;
  const expectedVertexCount = 6 * n, expectedEdgePathCount = 3 * n;
  const capTriangleCount = extrusion.region.components.reduce((sum, component) => {
    const componentLoops = extrusion.region.loops.filter(loop => loop.componentId === component.id);
    return sum + componentLoops.reduce((count, loop) => count + loop.vertexIds.length, 0) + 2 * component.holeLoopIds.length - 2;
  }, 0);
  const expectedTriangleCount = 2 * capTriangleCount + 2 * n;
  check(expectedVertexCount <= options.maximumVertices && expectedVertexCount <= 384 && expectedTriangleCount <= options.maximumTriangles && expectedTriangleCount <= 288
    && expectedEdgePathCount <= options.maximumEdgePaths && expectedEdgePathCount <= 192 && 16 * n <= options.maximumNativeSamples,
    CODE.BUDGET, 'complete filled native extrusion vertex/triangle/path/wrapper-sample capacity exceeded');
  const regionMesh = native(() => tessellateCoplanarFaceBoolean(extrusion.region, { meshId: options.meshId + '_region', maximumVertices: 64,
    maximumTriangles: 80, maximumCandidatePairs: 2016, maximumPredicateTests: 2000000, maximumTriangleTests: 50000 }), 'actual bounded original material region mesh');
  const role = reserveRoles(extrusion, regionMesh, options);
  const wrapperWork: CoplanarFaceBooleanExtrusionMeshReport['wrapperWork'] = { nativeSampleCount: 0, surfaceD1EvaluationCount: 0,
    faceVertexSurfaceD1EvaluationCount: 0, wallCenterSurfaceD1EvaluationCount: 0, curveD1EvaluationCount: 0, edgePathCurveD1EvaluationCount: 0 };
  const sample = (): void => { wrapperWork.nativeSampleCount++; check(wrapperWork.nativeSampleCount <= options.maximumNativeSamples,
    CODE.BUDGET, 'actual new wrapper native sample budget exceeded'); };
  const vertices: CoplanarFaceBooleanExtrusionMeshVertex[] = [], indices: number[] = [], faceRanges: CoplanarFaceBooleanExtrusionMeshFaceRange[] = [];
  const vertexById = new Map(extrusion.vertices.map(vertex => [vertex.id, vertex]));
  const sourceObject = (pointer: SourcePointer, expected: unknown): void => {
    const asset = extrusion.sources.find(source => source.id === pointer.assetId), object = asset?.model.objects[pointer.objectIndex];
    check(object !== undefined && object.id === pointer.objectId && object.kind === pointer.kind && same(object, expected), CODE.BINDING,
      'actual original native source asset/object/index/geometry pointer must resolve');
  };
  let triangleCount = 0, internalCount = 0;
  for (const face of extrusion.faces) {
    const shell = extrusion.shells.find(shell => shell.faceIds.includes(face.id));
    check(shell !== undefined && shell.componentId === face.componentId, CODE.INCIDENCE, 'actual native face/Shell/component association required');
    sourceObject(face.source, face.surface);
    const vertexStart = vertices.length, indexStart = indices.length, triangleStart = triangleCount;
    const faceIndexByNativeId = new Map<string, number>(), faceIndexByRegionMesh = new Map<number, number>();
    const addVertex = (nativeVertexId: string, uv: [number, number], regionMeshVertexIndex: number | null): number => {
      check(!faceIndexByNativeId.has(nativeVertexId), CODE.INCIDENCE, 'no duplicate hard-normal vertex within an actual native face');
      const canonical = vertexById.get(nativeVertexId); check(canonical !== undefined && canonical.componentId === face.componentId, CODE.INCIDENCE, 'actual native canonical face vertex required');
      sample(); wrapperWork.surfaceD1EvaluationCount++; wrapperWork.faceVertexSurfaceD1EvaluationCount++;
      const surfaceD1 = native(() => evaluateSurfaceD1(face.surface, uv[0], uv[1]), 'actual derived native face vertex Surface D1');
      const raw = unit(cross(surfaceD1.du, surfaceD1.dv)), orientedNormal = raw.map(value => face.orientation === 'forward' ? value : -value) as Point;
      const pointDifferenceMM = distance(surfaceD1.point, canonical.pointMM);
      check(pointDifferenceMM <= TOLERANCE, CODE.BINDING, 'actual native face/canonical unsnapped vertex residual exceeds1e-7mm');
      const index = vertices.length;
      vertices.push({ index, faceId: face.id, shellId: shell.id, componentId: face.componentId, nativeVertexId,
        regionVertexId: canonical.nativeVertexId, regionMeshVertexIndex, surfaceId: face.surface.id, source: face.source, uv,
        surfaceD1, orientedNormal, canonicalPointMM: canonical.pointMM, pointDifferenceMM });
      faceIndexByNativeId.set(nativeVertexId, index); if (regionMeshVertexIndex !== null) faceIndexByRegionMesh.set(regionMeshVertexIndex, index); return index;
    };
    const triples: { vertexIndices: [number, number, number]; regionMeshTriangleId: string | null }[] = [];
    const expectedInternal = new Map<string, { kind: CoplanarFaceBooleanExtrusionMeshFaceRange['internalEdges'][number]['kind']; regionMeshEdgeId: string | null; pair: [number, number] }>();
    let wallUV: [number, number][] | null = null;
    if (face.kind === 'wall') {
      const domains = native(() => surfaceDomain(face.surface), 'actual native wall domain');
      wallUV = [[domains.u[0], domains.v[0]], [domains.u[1], domains.v[0]], [domains.u[1], domains.v[1]], [domains.u[0], domains.v[1]]];
      check(face.loops.length === 1 && face.loops[0].uses.length === 4, CODE.INCIDENCE, 'actual native four-edge wall parameter loop required');
      const corners = face.loops[0].uses.map((use, i) => addVertex(use.vertexIds[0], wallUV![i], null));
      for (const local of [[0, 1, 2], [0, 2, 3]]) {
        const mapped = local.map(index => corners[index]) as [number, number, number];
        triples.push({ vertexIndices: face.orientation === 'forward' ? mapped : [mapped[0], mapped[2], mapped[1]], regionMeshTriangleId: null });
      }
      const pair: [number, number] = [corners[0], corners[2]];
      expectedInternal.set(key(...pair), { kind: 'display-wall-diagonal', regionMeshEdgeId: null, pair });
    } else {
      const component = regionMesh.triangulation.components.find(component => component.componentId === face.componentId);
      check(component !== undefined, CODE.COVERAGE, 'actual material cap component connectivity required');
      for (const regionIndex of component.vertexIndices) {
        const vertex = regionMesh.mesh.vertices[regionIndex];
        const canonical = extrusion.vertices.find(value => value.nativeVertexId === vertex.nativeVertexId && value.layer === (face.kind === 'bottom-cap' ? 'bottom' : 'top'));
        check(canonical !== undefined, CODE.INCIDENCE, 'actual native bottom/top cap vertex association required');
        addVertex(canonical.id, vertex.uv, regionIndex);
      }
      for (const triangle of regionMesh.triangulation.triangles.filter(triangle => triangle.componentId === face.componentId)) {
        const mapped = triangle.vertexIndices.map(index => faceIndexByRegionMesh.get(index)) as [number, number, number];
        check(mapped.every(index => index !== undefined), CODE.INCIDENCE, 'every actual region cap triangle vertex must map');
        triples.push({ vertexIndices: face.orientation === 'forward' ? mapped : [mapped[0], mapped[2], mapped[1]], regionMeshTriangleId: triangle.id });
      }
      for (const edge of regionMesh.triangulation.internalEdges.filter(edge => edge.componentId === face.componentId)) {
        const pair = edge.vertexIndices.map(index => faceIndexByRegionMesh.get(index)) as [number, number];
        check(pair.every(index => index !== undefined), CODE.INCIDENCE, 'actual reused region internal edge endpoints must map');
        expectedInternal.set(key(...pair), { kind: edge.kind === 'display-internal-bridge' ? 'display-cap-bridge' : 'display-cap-diagonal', regionMeshEdgeId: edge.id, pair });
      }
    }
    const triangles: CoplanarFaceBooleanExtrusionMeshFaceRange['triangles'] = triples.map(triple => {
      const [a, b, c] = triple.vertexIndices, vector = cross(delta(vertices[b].surfaceD1.point, vertices[a].surfaceD1.point), delta(vertices[c].surfaceD1.point, vertices[a].surfaceD1.point));
      const areaMM2 = product(finite(Math.hypot(...vector)), .5), minimumNormalDot = Math.min(...triple.vertexIndices.map(index => dot(vector, vertices[index].orientedNormal)));
      check(areaMM2 > 0 && minimumNormalDot > 0, CODE.REPRESENTABILITY, 'actual native hard-normal face triangle is degenerate or incorrectly wound');
      const indexStart = indices.length; indices.push(...triple.vertexIndices);
      return { id: role('_tri_' + triangleCount++), vertexIndices: triple.vertexIndices, regionMeshTriangleId: triple.regionMeshTriangleId, indexStart, areaMM2, minimumNormalDot };
    });
    const triangleUses = new Map<string, TriangleUse[]>();
    for (const triangle of triangles) for (let i = 0; i < 3; i++) {
      const from = triangle.vertexIndices[i], to = triangle.vertexIndices[(i + 1) % 3], k = key(from, to), uses = triangleUses.get(k) ?? [];
      uses.push({ triangleId: triangle.id, from, to }); triangleUses.set(k, uses);
    }
    const mapPair = (ids: [string, string]): [number, number] => {
      const pair = ids.map(id => faceIndexByNativeId.get(id)); check(pair.every(index => index !== undefined), CODE.INCIDENCE, 'actual face-loop native endpoints must resolve to hard-normal mesh indices');
      return pair as [number, number];
    };
    const loops: CoplanarFaceBooleanExtrusionMeshFaceRange['loops'] = face.loops.map(loop => ({ loopId: loop.id, role: loop.role, nativeLoopId: loop.nativeLoopId,
      effectiveUseIds: loop.effectiveUseIds, uses: loop.uses.map(use => ({ useId: use.id, edgeId: use.edgeId, curveId: use.curveId, pcurveId: use.pcurve.id,
        edgeSense: use.edgeSense, effectiveSense: use.effectiveSense, localVertexIds: use.vertexIds, effectiveVertexIds: use.effectiveVertexIds,
        localVertexIndices: mapPair(use.vertexIds), effectiveVertexIndices: mapPair(use.effectiveVertexIds), interval: use.interval, effectiveInterval: use.effectiveInterval })) }));
    const boundaryKeys = new Set<string>();
    const boundaryIncidence: CoplanarFaceBooleanExtrusionMeshFaceRange['boundaryIncidence'] = loops.flatMap(loop => loop.uses.map(use => {
      const pair = use.effectiveVertexIndices, k = key(...pair), uses = triangleUses.get(k);
      check(!boundaryKeys.has(k) && uses !== undefined && uses.length === 1 && uses[0].from === pair[0] && uses[0].to === pair[1],
        CODE.INCIDENCE, 'each true native face boundary must have exactly one effective directed triangle use'); boundaryKeys.add(k);
      return { loopId: loop.loopId, useId: use.useId, edgeId: use.edgeId, curveId: use.curveId, pcurveId: use.pcurveId,
        effectiveSense: use.effectiveSense, vertexIndices: pair, triangleUses: uses };
    }));
    const internalEdges: CoplanarFaceBooleanExtrusionMeshFaceRange['internalEdges'] = [];
    for (const [k, uses] of triangleUses) if (!boundaryKeys.has(k)) {
      const expected = expectedInternal.get(k);
      check(expected !== undefined && uses.length === 2 && uses[0].from === uses[1].to && uses[0].to === uses[1].from,
        CODE.INCIDENCE, 'every display internal edge must be proved and have two opposite triangle uses');
      internalEdges.push({ id: role('_int_' + internalCount++), kind: expected.kind, regionMeshEdgeId: expected.regionMeshEdgeId, vertexIndices: expected.pair, triangleUses: uses });
    }
    check(internalEdges.length === expectedInternal.size && triangleUses.size === boundaryKeys.size + expectedInternal.size,
      CODE.INCIDENCE, 'actual filled face omitted an internal edge or true boundary');
    let wallCenterObservation: CoplanarFaceBooleanExtrusionMeshFaceRange['wallCenterObservation'] = null;
    if (wallUV !== null) {
      const u = finite(wallUV[0][0] + product(wallUV[1][0] - wallUV[0][0], .5)), v = finite(wallUV[0][1] + product(wallUV[3][1] - wallUV[0][1], .5));
      check(u > wallUV[0][0] && u < wallUV[1][0] && v > wallUV[0][1] && v < wallUV[3][1], CODE.REPRESENTABILITY, 'strict actual native wall center must be represented');
      sample(); wrapperWork.surfaceD1EvaluationCount++; wrapperWork.wallCenterSurfaceD1EvaluationCount++;
      const surfaceD1 = native(() => evaluateSurfaceD1(face.surface, u, v), 'actual native wall-center Surface D1 observation');
      const raw = unit(cross(surfaceD1.du, surfaceD1.dv)), orientedNormal = raw.map(value => face.orientation === 'forward' ? value : -value) as Point;
      const planes = triangles.map(triangle => { const [a, b, c] = triangle.vertexIndices;
        const planeNormal = unit(cross(delta(vertices[b].surfaceD1.point, vertices[a].surfaceD1.point), delta(vertices[c].surfaceD1.point, vertices[a].surfaceD1.point)));
        return { distance: Math.abs(dot(delta(surfaceD1.point, vertices[a].surfaceD1.point), planeNormal)), normalDot: dot(orientedNormal, planeNormal) };
      });
      const trianglePlaneDistancesMM = planes.map(plane => plane.distance) as [number, number], minimumTrianglePlaneDistanceMM = Math.min(...trianglePlaneDistancesMM);
      const minimumNormalDot = Math.min(...planes.map(plane => plane.normalDot));
      check(minimumTrianglePlaneDistanceMM <= TOLERANCE && minimumNormalDot > 0, CODE.BINDING, 'actual wall-center local plane/normal observation exceeds preview policy');
      wallCenterObservation = { u, v, surfaceD1, orientedNormal, trianglePlaneDistancesMM, minimumTrianglePlaneDistanceMM, minimumNormalDot };
    }
    faceRanges.push({ faceId: face.id, shellId: shell.id, componentId: face.componentId, kind: face.kind, orientation: face.orientation,
      surfaceId: face.surface.id, source: face.source, vertexStart, vertexCount: vertices.length - vertexStart, indexStart, indexCount: indices.length - indexStart,
      triangleStart, triangleCount: triangles.length, triangles, loops, boundaryIncidence, internalEdges, wallCenterObservation });
  }
  const edgePaths: CoplanarFaceBooleanExtrusionMeshEdgePath[] = extrusion.edges.map(edge => {
    sourceObject(edge.source, edge.curve);
    const shell = extrusion.shells.find(shell => shell.edgeIds.includes(edge.id)); check(shell !== undefined && shell.componentId === edge.componentId, CODE.INCIDENCE, 'actual true edge/Shell association required');
    const interval = native(() => curveDomain(edge.curve), 'actual original global native edge interval'), middle = finite(interval[0] + product(interval[1] - interval[0], .5));
    check(middle > interval[0] && middle < interval[1], CODE.REPRESENTABILITY, 'strict true native edge path midpoint must be represented');
    const samples = [interval[0], middle, interval[1]].map(parameter => {
      sample(); wrapperWork.curveD1EvaluationCount++; wrapperWork.edgePathCurveD1EvaluationCount++;
      return { parameter, curveD1: native(() => evaluateCurveD1(edge.curve, parameter), 'actual unchanged global native edge path Curve D1') };
    });
    const adjacentFaces: CoplanarFaceBooleanExtrusionMeshEdgePath['adjacentFaces'] = edge.uses.map(nativeUse => {
      const range = faceRanges.find(range => range.faceId === nativeUse.faceId), incidence = range?.boundaryIncidence.find(value => value.useId === nativeUse.useId);
      check(range !== undefined && incidence !== undefined && incidence.edgeId === edge.id && incidence.effectiveSense === nativeUse.effectiveSense,
        CODE.INCIDENCE, 'every actual paired native face use must resolve exactly one filled boundary incidence');
      const vertexIndices: [number, number] = nativeUse.effectiveSense === 'forward' ? incidence.vertexIndices : [incidence.vertexIndices[1], incidence.vertexIndices[0]];
      check(vertices[vertexIndices[0]].nativeVertexId === edge.vertexIds[0] && vertices[vertexIndices[1]].nativeVertexId === edge.vertexIds[1],
        CODE.INCIDENCE, 'both adjacent face endpoint indices must retain global ascending native direction');
      const endpointDifferencesMM: [number, number] = [distance(samples[0].curveD1.point, vertices[vertexIndices[0]].surfaceD1.point),
        distance(samples[2].curveD1.point, vertices[vertexIndices[1]].surfaceD1.point)];
      check(endpointDifferencesMM.every(value => value <= TOLERANCE), CODE.BINDING, 'actual unsnapped edge endpoints differ from adjacent native face display positions');
      return { faceId: nativeUse.faceId, loopId: nativeUse.loopId, useId: nativeUse.useId, pcurveId: incidence.pcurveId,
        effectiveSense: nativeUse.effectiveSense, vertexIndices, endpointDifferencesMM, triangleUses: incidence.triangleUses };
    });
    check(adjacentFaces.length === 2 && adjacentFaces[0].faceId !== adjacentFaces[1].faceId && adjacentFaces[0].effectiveSense !== adjacentFaces[1].effectiveSense,
      CODE.INCIDENCE, 'every true global edge path must retain both opposite native face bindings');
    return { edgeId: edge.id, shellId: shell.id, componentId: edge.componentId, kind: edge.kind, curveId: edge.curve.id, source: edge.source,
      interval, nativeVertexIds: edge.vertexIds, nativeFragmentId: edge.nativeFragmentId, nativeVertexId: edge.nativeVertexId, samples, adjacentFaces };
  });
  const shellRanges: CoplanarFaceBooleanExtrusionMeshShellRange[] = extrusion.shells.map(shell => {
    const faceRangeIndices = shell.faceIds.map(id => faceRanges.findIndex(range => range.faceId === id));
    const edgePathIndices = shell.edgeIds.map(id => edgePaths.findIndex(path => path.edgeId === id));
    check(faceRangeIndices.every(index => index >= 0) && edgePathIndices.every(index => index >= 0), CODE.INCIDENCE, 'every original native Shell face and true edge must have a filled range/path');
    return { shellId: shell.id, componentId: shell.componentId, nativeFaceIds: shell.faceIds, nativeEdgeIds: shell.edgeIds, nativeVertexIds: shell.vertexIds,
      holeLoopIds: shell.holeLoopIds, faceRangeIndices, edgePathIndices, vertexCount: faceRangeIndices.reduce((sum, index) => sum + faceRanges[index].vertexCount, 0),
      triangleCount: faceRangeIndices.reduce((sum, index) => sum + faceRanges[index].triangleCount, 0), edgePathCount: edgePathIndices.length, solid: false };
  });
  check(vertices.length === expectedVertexCount && triangleCount === expectedTriangleCount && edgePaths.length === expectedEdgePathCount
    && faceRanges.length === extrusion.faces.length && shellRanges.length === extrusion.shells.length, CODE.COVERAGE, 'filled native mesh must preserve every component/hole/face/true edge');
  check(wrapperWork.nativeSampleCount === 16 * n && wrapperWork.faceVertexSurfaceD1EvaluationCount === 6 * n
    && wrapperWork.wallCenterSurfaceD1EvaluationCount === n && wrapperWork.surfaceD1EvaluationCount === 7 * n
    && wrapperWork.curveD1EvaluationCount === 9 * n && wrapperWork.edgePathCurveD1EvaluationCount === 9 * n,
    CODE.INCIDENCE, 'actual new wrapper native samples must equal16N=7N Surface+9N Curve');
  const boundsMM = vertices.length === 0 ? null : { min: [0, 1, 2].map(axis => Math.min(...vertices.map(vertex => vertex.surfaceD1.point[axis]))) as Point,
    max: [0, 1, 2].map(axis => Math.max(...vertices.map(vertex => vertex.surfaceD1.point[axis]))) as Point };
  const mesh: CoplanarFaceBooleanExtrusionMeshResult['mesh'] = { id: options.meshId,
    binding: { extrusionEvaluationId: extrusion.options.evaluationId, booleanEvaluationId: extrusion.region.options.evaluationId,
      nativeShellIds: extrusion.shells.map(shell => shell.id), sourceAssetIds: extrusion.sources.map(source => source.id), regionMeshId: regionMesh.mesh.id },
    positionsMM: vertices.flatMap(vertex => vertex.surfaceD1.point), normals: vertices.flatMap(vertex => vertex.orientedNormal), parametersUV: vertices.flatMap(vertex => vertex.uv), indices, vertices, boundsMM };
  const nested = regionMesh.report;
  const report: CoplanarFaceBooleanExtrusionMeshReport = {
    schema: 'barocss-native-coplanar-face-boolean-extrusion-mesh', version: 0, meshId: mesh.id, extrusionEvaluationId: extrusion.options.evaluationId,
    booleanEvaluationId: extrusion.region.options.evaluationId, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion', uvUnits: 'dimensionless-per-face-native-parameters',
    empty: n === 0, nativeVertexCount: n, nativeFragmentCount: extrusion.region.fragments.length, componentCount: extrusion.region.components.length,
    holeCount: extrusion.region.loops.filter(loop => loop.role === 'hole').length, vertexCount: vertices.length, triangleCount, edgePathCount: edgePaths.length,
    faceRangeCount: faceRanges.length, shellRangeCount: shellRanges.length, internalEdgeCount: internalCount, expectedVertexCount, expectedTriangleCount, expectedEdgePathCount,
    wrapperWork, regionMeshWork: { surfaceD1EvaluationCount: nested.surfaceD1EvaluationCount, curveD1EvaluationCount: nested.curveD1EvaluationCount,
      candidatePairCount: nested.candidatePairCount, predicateTestCount: nested.predicateTestCount, vertexTripleTestCount: nested.vertexTripleTestCount,
      trianglePairTestCount: nested.trianglePairTestCount, triangleTestCount: nested.triangleTestCount },
    maximumVertexDifferenceMM: Math.max(0, ...vertices.map(vertex => vertex.pointDifferenceMM)),
    maximumPathEndpointDifferenceMM: Math.max(0, ...edgePaths.flatMap(path => path.adjacentFaces.flatMap(face => face.endpointDifferencesMM))),
    maximumWallCenterPlaneDifferenceMM: Math.max(0, ...faceRanges.map(range => range.wallCenterObservation?.minimumTrianglePlaneDistanceMM ?? 0)),
    incidenceValid: true, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { geometryAuthority: 'unchanged-native-extrusion-curves-surfaces-trims-and-source0', capConnectivity: 'actual-owned-native-region-mesh',
      positions: 'actual-derived-cap-and-wall-surface-d1-no-display-top-translation', normals: 'per-face-hard-native-outward-normals',
      truePaths: 'actual-global-native-edges-with-both-adjacent-face-endpoints', internalEdges: 'display-only-cap-diagonals-bridges-and-wall-diagonals',
      boundsAuthority: 'actual-display-positions-not-certified-native-geometry-bounds', workScope: 'new-wrapper-native-samples-separate-from-region-mesh-work-and-parent-reconstruction',
      nativeInverseCertified: false, exactSewingCertified: false, globalManifoldCertified: false, globalShapeErrorCertified: false,
      manufacturingToleranceCertified: false, rendererCapacityCertified: false, ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    budgetFailure: 'atomic-refusal-no-partial-filled-mesh', limits: { maximumVertices: 384, maximumTriangles: 288, maximumEdgePaths: 192, maximumNativeSamples: 1024,
      maximumFaceRanges: 80, maximumShellRanges: 8, ownValues: 1048576, ownDepth: 40, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144,
      meshIdCharacters: 12, pointComparisonMM: TOLERANCE },
  };
  return snapshot({ extrusion, options, regionMesh, mesh, faceRanges, edgePaths, shellRanges, report }) as CoplanarFaceBooleanExtrusionMeshResult;
}
/** Full reconstruction includes native parent, actual reused cap graph, face-local ranges and both edge bindings. */
export function validateCoplanarFaceBooleanExtrusionMesh(input: CoplanarFaceBooleanExtrusionMeshResult): CoplanarFaceBooleanExtrusionMeshReport {
  const owned = record(snapshot(input, CODE.OWNED), ['extrusion', 'options', 'regionMesh', 'mesh', 'faceRanges', 'edgePaths', 'shellRanges', 'report'], CODE.OWNED) as unknown as CoplanarFaceBooleanExtrusionMeshResult;
  let expected: CoplanarFaceBooleanExtrusionMeshResult;
  try { expected = tessellateCoplanarFaceBooleanExtrusion(owned.extrusion, owned.options); } catch (cause) {
    throw new CoplanarFaceBooleanExtrusionMeshError(CODE.OWNED, 'owned complete native extrusion/cap connectivity/filled mesh rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned native source/region mesh/face vertex/normal/triangle/loop/path/Shell/work/report mismatch');
  return snapshot(expected.report, CODE.OWNED) as CoplanarFaceBooleanExtrusionMeshReport;
}
