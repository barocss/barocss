import { validateCoplanarFaceBoolean } from './coplanar-face-boolean.js';
import type { CoplanarFaceBooleanResult, CoplanarFaceBooleanContributor } from './coplanar-face-boolean.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import type { Point } from './types.js';
import { triangulateCoplanarMaterial } from './coplanar-face-boolean-mesh-triangulation.js';

export const CoplanarFaceBooleanMeshDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', NATIVE: 'NATIVE', REPRESENTABILITY: 'REPRESENTABILITY',
  UNCERTAINTY: 'UNCERTAINTY', TRIANGULATION: 'TRIANGULATION', INCIDENCE: 'INCIDENCE', COVERAGE: 'COVERAGE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type CoplanarFaceBooleanMeshDiagnosticCode = typeof CoplanarFaceBooleanMeshDiagnosticCode[keyof typeof CoplanarFaceBooleanMeshDiagnosticCode];
export class CoplanarFaceBooleanMeshError extends Error {
  readonly code: CoplanarFaceBooleanMeshDiagnosticCode;
  constructor(code: CoplanarFaceBooleanMeshDiagnosticCode, detail: string, cause?: unknown) {
    super(('Coplanar Face Boolean Mesh: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CoplanarFaceBooleanMeshError'; this.code = code;
  }
}
export interface CoplanarFaceBooleanMeshOptions {
  meshId: string; maximumVertices: number; maximumTriangles: number; maximumCandidatePairs: number;
  maximumPredicateTests: number; maximumTriangleTests: number;
}
export interface CoplanarFaceBooleanMeshVertex {
  index: number; nativeVertexId: string; componentId: string; loopId: string; loopRole: 'outer' | 'hole'; uv: [number, number];
  surfaceD1: SurfaceD1Result; orientedNormal: Point; originalPointMM: Point; originalSurfaceDifferenceMM: number;
}
export interface CoplanarFaceBooleanMeshBoundaryPath {
  componentId: string; loopId: string; loopRole: 'outer' | 'hole'; fragmentId: string; edgeId: string; useId: string;
  curveId: string; pcurveId: string; contributor: CoplanarFaceBooleanContributor;
  source: { assetId: string; curveId: string; objectIndex: number }; sense: 'forward' | 'reverse';
  interval: [number, number]; nativeInterval: [number, number]; vertexIndices: [number, number]; nativeVertexIds: [string, string];
  samples: { parameter: number; originalLineD1: CurveD1Result; lineD1: CurveD1Result; pcurveD1: CurveD1Result; surfaceD1: SurfaceD1Result;
    pointDifferenceMM: number; originalPointDifferenceMM: number; relativeD1Difference: number;
    relativeSurfaceD1Difference: number; meshEndpointDifferenceMM: number | null }[];
}
export interface CoplanarFaceBooleanMeshEdgeUse { triangleId: string; from: number; to: number }
export interface CoplanarFaceBooleanMeshTriangulation {
  method: 'maximal-visible-native-vertex-planar-graph';
  bridges: { id: string; componentId: string; kind: 'display-internal-bridge'; vertexIndices: [number, number]; nativeVertexIds: [string, string] }[];
  internalEdges: { id: string; componentId: string; kind: 'display-internal-bridge' | 'display-internal-diagonal';
    vertexIndices: [number, number]; uses: CoplanarFaceBooleanMeshEdgeUse[] }[];
  triangles: { id: string; componentId: string; vertexIndices: [number, number, number]; signedAreaUV: number;
    centroidUV: [number, number]; centroidInMaterial: true; areaMM2: number }[];
  boundaryIncidence: { componentId: string; loopId: string; fragmentId: string; edgeId: string; useId: string; curveId: string;
    vertexIndices: [number, number]; uses: CoplanarFaceBooleanMeshEdgeUse[] }[];
  components: { componentId: string; outerLoopId: string; holeLoopIds: string[]; vertexIndices: number[]; triangleIds: string[];
    expectedTriangleCount: number; expectedInternalEdgeCount: number; expectedBridgeCount: number;
    triangleCount: number; internalEdgeCount: number; bridgeCount: number; materialAreaUV: number; triangleAreaUV: number;
    areaDifferenceUV: number; areaToleranceUV: number; surfaceJacobianMM2: number; materialAreaMM2: number;
    triangleAreaMM2: number; areaDifferenceMM2: number }[];
}
export interface CoplanarFaceBooleanMeshReport {
  schema: 'barocss-native-coplanar-face-boolean-mesh'; version: 0; meshId: string; evaluationId: string; supportId: string;
  lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion'; uvUnits: 'dimensionless';
  vertexCount: number; triangleCount: number; boundaryCount: number; loopCount: number; componentCount: number; holeCount: number;
  internalEdgeCount: number; bridgeCount: number; expectedTriangleCount: number; expectedInternalEdgeCount: number;
  candidatePairCount: number; predicateTestCount: number; triangleTestCount: number; vertexTripleTestCount: number; trianglePairTestCount: number;
  surfaceD1EvaluationCount: number; curveD1EvaluationCount: number;
  materialAreaUV: number; triangleAreaUV: number; areaDifferenceUV: number; areaToleranceUV: number;
  surfaceJacobianMM2: number | null; materialAreaMM2: number; triangleAreaMM2: number; areaDifferenceMM2: number;
  incidenceValid: true; materialCoverageObserved: true; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  proof: { boundaryOneDirectedUse: true; internalOppositeUses: true; triangleNonoverlap: true; holeExclusion: true;
    exactComponentTriangleCounts: true; guardedUVArea: true; noSteinerVertices: true; allComponentsPreserved: true };
  nativeBindingResiduals: { maximumVertexSurfaceMM: number; maximumBoundaryLineSurfaceMM: number;
    maximumBoundaryMeshEndpointMM: number; maximumBoundaryRelativeD1: number };
  numericPolicy: { predicate: 'exact-zero-or-64-epsilon-uncertainty-refusal'; uvArea: '128-epsilon-scaled-area-sum-or-parent-area-uncertainty';
    relativePhysicalArea: 1e-7; materialProof: 'strict-general-native-loop-winding-visible-graph-all-vertex-triangles-and-separating-axes';
    positions: 'actual-original-support-d1-binary64'; empty: 'zero-arrays-null-bounds-no-native-d1-calls' };
  quality: { representation: 'derived-raw-xyz-planar-material-preview-not-native-surface-or-preview-packet0'; nativeRegionBitsPreserved: true;
    workScope: 'new-material-graph-and-mesh-bindings-excludes-native-parent-reconstruction';
    worldBoundary: 'actual-unsnapped-extracted-native-fragments-only'; internalEdges: 'derived-display-diagonals-and-bridges-not-cad-boundaries';
    uvAreaIsManufacturingArea: false; globalTriangulationCertified: false; globalBinary64ErrorCertified: false;
    manufacturingToleranceCertified: false; rendererCapacityCertified: false; ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-mesh';
  limits: { maximumVertices: 64; maximumTriangles: 80; maximumCandidatePairs: 2016; maximumPredicateTests: 2000000;
    maximumTriangleTests: 50000; maximumInternalEdges: 88; maximumBridges: 8; maximumComponents: 8; maximumLoops: 16; maximumHoles: 8;
    ownValues: 1048576; ownDepth: 40; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144; meshIdCharacters: 20;
    pointComparisonMM: 1e-7; relativeD1Comparison: 1e-7 };
}
export interface CoplanarFaceBooleanMeshResult {
  region: CoplanarFaceBooleanResult; options: CoplanarFaceBooleanMeshOptions;
  mesh: { id: string; binding: { evaluationId: string; supportId: string;
      a: { faceId: string; evaluationId: string; supportId: string }; b: { faceId: string; evaluationId: string; supportId: string }; sourceAssetIds: string[] };
    positionsMM: number[]; normals: number[]; parametersUV: number[]; indices: number[];
    boundsMM: { min: Point; max: Point } | null; vertices: CoplanarFaceBooleanMeshVertex[] };
  boundaryPaths: CoplanarFaceBooleanMeshBoundaryPath[]; triangulation: CoplanarFaceBooleanMeshTriangulation; report: CoplanarFaceBooleanMeshReport;
}

const CODE = CoplanarFaceBooleanMeshDiagnosticCode, TOLERANCE = 1e-7;
function check(condition: boolean, code: CoplanarFaceBooleanMeshDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CoplanarFaceBooleanMeshError(code, detail);
}
function native<T>(action: () => T, detail: string, code: CoplanarFaceBooleanMeshDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CoplanarFaceBooleanMeshError) throw cause;
    throw new CoplanarFaceBooleanMeshError(code, detail, cause);
  }
}
/** Each occurrence is copied. Reused caller aliases are allowed; ancestor cycles are refused. */
function snapshot(input: unknown, code: CoplanarFaceBooleanMeshDiagnosticCode = CODE.INPUT): unknown {
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
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getters/symbols/hidden/excess own fields refused');
    ancestors.add(value);
    try {
      if (array) {
        const length = descriptors.length.value as number;
        check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'dense bounded own array required');
        return Array.from({ length }, (_, i) => {
          check(Object.hasOwn(descriptors, String(i)), code, 'sparse or foreign own array field refused'); return copy(descriptors[String(i)].value, depth + 1);
        });
      }
      return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    } finally { ancestors.delete(value); }
  };
  return copy(input, 0);
}
function record(input: unknown, fields: string[], code: CoplanarFaceBooleanMeshDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required');
  const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(',')); return data;
}
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => same(value, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key]));
  }
  return Object.is(a, b);
}
function id(value: unknown, maximum = 48): string {
  check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..' + maximum + ' required'); return value;
}
function admitOptions(input: unknown): CoplanarFaceBooleanMeshOptions {
  const data = record(input, ['meshId', 'maximumVertices', 'maximumTriangles', 'maximumCandidatePairs', 'maximumPredicateTests', 'maximumTriangleTests']);
  for (const [field, minimum, maximum] of [['maximumVertices', 0, 64], ['maximumTriangles', 0, 80], ['maximumCandidatePairs', 0, 2016],
    ['maximumPredicateTests', 1, 2000000], ['maximumTriangleTests', 0, 50000]] as const) {
    check(typeof data[field] === 'number' && Number.isInteger(data[field]) && (data[field] as number) >= minimum && (data[field] as number) <= maximum,
      CODE.BUDGET, 'integer ' + field + ' within frozen native work/output limits required');
  }
  return { meshId: id(data.meshId, 20), maximumVertices: data.maximumVertices as number, maximumTriangles: data.maximumTriangles as number,
    maximumCandidatePairs: data.maximumCandidatePairs as number, maximumPredicateTests: data.maximumPredicateTests as number, maximumTriangleTests: data.maximumTriangleTests as number };
}
function reserveRoles(region: CoplanarFaceBooleanResult, options: CoplanarFaceBooleanMeshOptions): (suffix: string) => string {
  const originals = new Set<string>();
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && (key === 'id' || key.endsWith('Id') || key === 'name')) originals.add(item);
      else if (key.endsWith('Ids') && Array.isArray(item)) for (const id of item) { if (typeof id === 'string') originals.add(id); }
      else collect(item);
    }
  };
  collect(region);
  const generated = new Set<string>(), reserve = (value: string): void => {
    id(value); check(!originals.has(value) && !generated.has(value), CODE.IDENTITY, 'derived display identity collides with a native or another display role'); generated.add(value);
  };
  const role = (suffix: string): string => options.meshId + suffix;
  reserve(options.meshId);
  for (let i = 0; i < 8; i++) reserve(role('_bridge_' + i));
  for (let i = 0; i < 88; i++) reserve(role('_diag_' + i));
  for (let i = 0; i < 80; i++) reserve(role('_tri_' + i));
  return role;
}
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'finite native point/normal/area binding arithmetic required'); return value; }
function product(a: number, b: number): number {
  const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero native display product underflow'); return value;
}
function delta(a: Point, b: Point): Point { return a.map((value, i) => finite(value - b[i])) as Point; }
function cross(a: Point, b: Point): Point {
  return [finite(product(a[1], b[2]) - product(a[2], b[1])), finite(product(a[2], b[0]) - product(a[0], b[2])), finite(product(a[0], b[1]) - product(a[1], b[0]))];
}
function dot(a: Point, b: Point): number { return a.reduce((sum, value, i) => finite(sum + product(value, b[i])), 0); }
function distance(a: Point, b: Point): number { return finite(Math.hypot(...delta(a, b))); }
function relative(a: Point, b: Point): number {
  const difference = distance(a, b), value = finite(difference / Math.max(1, finite(Math.hypot(...a))));
  check(difference === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero native D1 relative residual underflow'); return value;
}
function normal(surfaceD1: SurfaceD1Result): Point {
  const value = cross(surfaceD1.du, surfaceD1.dv), length = finite(Math.hypot(...value));
  check(length > 0, CODE.REPRESENTABILITY, 'actual native support D1 normal is degenerate');
  return value.map(component => { const normalized = finite(component / length);
    check(component === 0 || normalized !== 0, CODE.REPRESENTABILITY, 'nonzero native normal component underflow'); return normalized; }) as Point;
}

/** Filled derived material mesh; original Boolean coefficients and unsnapped boundary Curves remain native authority. */
export function tessellateCoplanarFaceBoolean(regionInput: CoplanarFaceBooleanResult,
  optionsInput: CoplanarFaceBooleanMeshOptions): CoplanarFaceBooleanMeshResult {
  const data = record(snapshot({ region: regionInput, options: optionsInput }), ['region', 'options']);
  const region = data.region as CoplanarFaceBooleanResult, options = admitOptions(data.options);
  native(() => validateCoplanarFaceBoolean(region), 'complete original Boolean region reconstruction required', CODE.INPUT);
  check(region.vertices.length <= options.maximumVertices && region.vertices.length <= 64, CODE.BUDGET, 'native selected mesh vertex capacity exceeded');
  check(region.loops.length <= 16 && region.components.length <= 8 && region.loops.filter(loop => loop.role === 'hole').length <= 8,
    CODE.BUDGET, 'native region loop/component/hole capacity exceeded');
  const role = reserveRoles(region, options);
  let expectedTriangleCount = 0, expectedInternalEdgeCount = 0;
  for (const component of region.components) {
    const loopIds = [component.outerLoopId, ...component.holeLoopIds], count = region.loops.filter(loop => loopIds.includes(loop.id)).reduce((sum, loop) => sum + loop.vertexIds.length, 0);
    expectedTriangleCount += count + 2 * component.holeLoopIds.length - 2;
    expectedInternalEdgeCount += count + 3 * component.holeLoopIds.length - 3;
  }
  check(expectedTriangleCount <= options.maximumTriangles && expectedTriangleCount <= 80 && expectedInternalEdgeCount <= 88,
    CODE.BUDGET, 'complete native component triangle/internal-edge capacity exceeded');
  let surfaceD1EvaluationCount = 0, curveD1EvaluationCount = 0;
  const surface = (u: number, v: number): SurfaceD1Result => { surfaceD1EvaluationCount++;
    return native(() => evaluateSurfaceD1(region.support, u, v), 'actual original native support D1'); };
  const vertices: CoplanarFaceBooleanMeshVertex[] = region.vertices.map((vertex, index) => {
    const loops = region.loops.filter(loop => loop.vertexIds.includes(vertex.id));
    check(loops.length === 1, CODE.INCIDENCE, 'every selected native vertex must belong to exactly one directed boundary loop');
    const loop = loops[0], surfaceD1 = surface(vertex.uv[0], vertex.uv[1]), orientedNormal = normal(surfaceD1);
    const originalSurfaceDifferenceMM = distance(vertex.pointMM, surfaceD1.point);
    check(originalSurfaceDifferenceMM <= TOLERANCE, CODE.BINDING, 'native unsnapped vertex/support display binding exceeds1e-7mm');
    return { index, nativeVertexId: vertex.id, componentId: loop.componentId, loopId: loop.id, loopRole: loop.role,
      uv: [vertex.uv[0], vertex.uv[1]] as [number, number], surfaceD1, orientedNormal, originalPointMM: vertex.pointMM, originalSurfaceDifferenceMM };
  });
  const { triangulation, work } = triangulateCoplanarMaterial(region, vertices, options, role, check, native);
  for (const triangle of triangulation.triangles) {
    const [a, b, c] = triangle.vertexIndices, areaVector = cross(delta(vertices[b].surfaceD1.point, vertices[a].surfaceD1.point),
      delta(vertices[c].surfaceD1.point, vertices[a].surfaceD1.point));
    triangle.areaMM2 = product(finite(Math.hypot(...areaVector)), .5);
    check(triangle.areaMM2 > 0 && triangle.vertexIndices.every(index => dot(areaVector, vertices[index].orientedNormal) > 0),
      CODE.REPRESENTABILITY, 'actual native support triangle positions are degenerate or have wrong normal winding');
  }
  for (const component of triangulation.components) {
    const first = vertices[component.vertexIndices[0]].surfaceD1;
    component.surfaceJacobianMM2 = finite(Math.hypot(...cross(first.du, first.dv)));
    check(component.surfaceJacobianMM2 > 0, CODE.REPRESENTABILITY, 'positive actual affine support Jacobian required');
    component.materialAreaMM2 = product(component.materialAreaUV, component.surfaceJacobianMM2);
    component.triangleAreaMM2 = triangulation.triangles.filter(triangle => triangle.componentId === component.componentId)
      .reduce((sum, triangle) => finite(sum + triangle.areaMM2), 0);
    component.areaDifferenceMM2 = Math.abs(finite(component.materialAreaMM2 - component.triangleAreaMM2));
    check(component.areaDifferenceMM2 <= TOLERANCE * Math.max(1, component.materialAreaMM2), CODE.BINDING,
      'native affine UV Jacobian/actual world triangle area binding exceeds1e-7 relative');
  }
  const nativeIndex = new Map(vertices.map(vertex => [vertex.nativeVertexId, vertex.index]));
  const boundaryPaths: CoplanarFaceBooleanMeshBoundaryPath[] = region.loops.flatMap(loop => loop.uses.map(use => {
    const fragment = region.fragments.find(fragment => fragment.useId === use.id);
    const from = nativeIndex.get(use.vertexIds[0]), to = nativeIndex.get(use.vertexIds[1]);
    check(fragment !== undefined && from !== undefined && to !== undefined, CODE.INCIDENCE, 'actual directed native boundary fragment/mesh endpoints required');
    const originalFace = fragment.contributor.operand === 'a' ? region.faceA : region.faceB;
    const original = originalFace.loop.edges[fragment.contributor.authoredEdgeIndex];
    check(original !== undefined && original.id === fragment.contributor.curveId, CODE.BINDING, 'actual qualified original native boundary Line required');
    const middle = finite(fragment.interval[0] + product(fragment.interval[1] - fragment.interval[0], .5));
    check(middle > fragment.interval[0] && middle < fragment.interval[1], CODE.REPRESENTABILITY, 'strict actual native boundary sample midpoint required');
    const samples: CoplanarFaceBooleanMeshBoundaryPath['samples'] = [use.interval[0], middle, use.interval[1]].map((parameter, sampleIndex) => {
      const curve = (action: () => CurveD1Result, detail: string): CurveD1Result => { curveD1EvaluationCount++; return native(action, detail); };
      const originalLineD1 = curve(() => evaluateCurveD1(original, parameter), 'actual qualified original boundary Line D1');
      const lineD1 = curve(() => evaluateCurveD1(fragment.curve, parameter), 'actual unsnapped extracted boundary Curve D1');
      const pcurveD1 = curve(() => evaluateCurveD1(fragment.pcurve.curve, parameter), 'actual dimensionless native boundary pcurve D1');
      const surfaceD1 = surface(pcurveD1.point[0], pcurveD1.point[1]);
      const chain = surfaceD1.du.map((value, axis) => finite(product(value, pcurveD1.derivative[0]) + product(surfaceD1.dv[axis], pcurveD1.derivative[1]))) as Point;
      const pointDifferenceMM = distance(lineD1.point, surfaceD1.point), originalPointDifferenceMM = distance(originalLineD1.point, lineD1.point);
      const relativeD1Difference = relative(originalLineD1.derivative, lineD1.derivative), relativeSurfaceD1Difference = relative(lineD1.derivative, chain);
      const meshEndpointDifferenceMM = sampleIndex === 1 ? null : distance(lineD1.point, vertices[sampleIndex === 0 ? from : to].surfaceD1.point);
      check(pointDifferenceMM <= TOLERANCE && originalPointDifferenceMM <= TOLERANCE && (meshEndpointDifferenceMM === null || meshEndpointDifferenceMM <= TOLERANCE),
        CODE.BINDING, 'actual original/extracted/UV-support/mesh true-boundary point binding exceeds1e-7mm');
      check(relativeD1Difference <= TOLERANCE && relativeSurfaceD1Difference <= TOLERANCE, CODE.BINDING, 'actual original/extracted/Surface-chain boundary D1 binding exceeds1e-7 relative');
      return { parameter, originalLineD1, lineD1, pcurveD1, surfaceD1, pointDifferenceMM, originalPointDifferenceMM,
        relativeD1Difference, relativeSurfaceD1Difference, meshEndpointDifferenceMM };
    });
    const incidence = triangulation.boundaryIncidence.find(edge => edge.useId === use.id);
    check(incidence !== undefined && incidence.uses.length === 1 && incidence.uses[0].from === from && incidence.uses[0].to === to,
      CODE.INCIDENCE, 'actual indexed mesh boundary must follow original canonical Boolean use traversal');
    return { componentId: loop.componentId, loopId: loop.id, loopRole: loop.role, fragmentId: fragment.id, edgeId: use.edgeId, useId: use.id,
      curveId: use.curveId, pcurveId: use.pcurveId, contributor: fragment.contributor, source: fragment.source, sense: use.sense,
      interval: use.interval, nativeInterval: fragment.interval, vertexIndices: [from, to] as [number, number], nativeVertexIds: use.vertexIds, samples };
  }));
  const materialAreaUV = region.report.areaUV, triangleAreaUV = triangulation.triangles.reduce((sum, triangle) => finite(sum + triangle.signedAreaUV), 0);
  const areaDifferenceUV = Math.abs(finite(materialAreaUV - triangleAreaUV));
  const areaToleranceUV = Math.max(product(product(128, Number.EPSILON), finite(Math.abs(materialAreaUV) + Math.abs(triangleAreaUV))),
    triangulation.components.reduce((sum, component) => finite(sum + component.areaToleranceUV), 0));
  check(areaDifferenceUV <= areaToleranceUV, CODE.COVERAGE, 'complete native region area differs from all indexed material triangles');
  const materialAreaMM2 = triangulation.components.reduce((sum, component) => finite(sum + component.materialAreaMM2), 0);
  const triangleAreaMM2 = triangulation.triangles.reduce((sum, triangle) => finite(sum + triangle.areaMM2), 0);
  const areaDifferenceMM2 = Math.abs(finite(materialAreaMM2 - triangleAreaMM2));
  check(areaDifferenceMM2 <= TOLERANCE * Math.max(1, materialAreaMM2), CODE.BINDING, 'total actual native affine world area diagnostic differs from the material triangles');
  const positionsMM = vertices.flatMap(vertex => vertex.surfaceD1.point), normals = vertices.flatMap(vertex => vertex.orientedNormal), parametersUV = vertices.flatMap(vertex => vertex.uv);
  const boundsMM = vertices.length === 0 ? null : {
    min: [0, 1, 2].map(axis => Math.min(...vertices.map(vertex => vertex.surfaceD1.point[axis]))) as Point,
    max: [0, 1, 2].map(axis => Math.max(...vertices.map(vertex => vertex.surfaceD1.point[axis]))) as Point,
  };
  const mesh: CoplanarFaceBooleanMeshResult['mesh'] = { id: options.meshId,
    binding: { evaluationId: region.options.evaluationId, supportId: region.support.id,
      a: { faceId: region.faceA.options.faceId, evaluationId: region.faceA.options.evaluationId, supportId: region.faceA.plane.id },
      b: { faceId: region.faceB.options.faceId, evaluationId: region.faceB.options.evaluationId, supportId: region.faceB.plane.id }, sourceAssetIds: region.sources.map(source => source.id) },
    positionsMM, normals, parametersUV, indices: triangulation.triangles.flatMap(triangle => triangle.vertexIndices), boundsMM, vertices };
  const report: CoplanarFaceBooleanMeshReport = {
    schema: 'barocss-native-coplanar-face-boolean-mesh', version: 0, meshId: mesh.id, evaluationId: region.options.evaluationId, supportId: region.support.id,
    lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion', uvUnits: 'dimensionless', vertexCount: vertices.length,
    triangleCount: triangulation.triangles.length, boundaryCount: boundaryPaths.length, loopCount: region.loops.length, componentCount: region.components.length,
    holeCount: region.loops.filter(loop => loop.role === 'hole').length, internalEdgeCount: triangulation.internalEdges.length,
    bridgeCount: triangulation.bridges.length, expectedTriangleCount, expectedInternalEdgeCount, ...work, surfaceD1EvaluationCount, curveD1EvaluationCount,
    materialAreaUV, triangleAreaUV, areaDifferenceUV, areaToleranceUV, surfaceJacobianMM2: triangulation.components[0]?.surfaceJacobianMM2 ?? null,
    materialAreaMM2, triangleAreaMM2, areaDifferenceMM2, incidenceValid: true, materialCoverageObserved: true, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    proof: { boundaryOneDirectedUse: true, internalOppositeUses: true, triangleNonoverlap: true, holeExclusion: true, exactComponentTriangleCounts: true,
      guardedUVArea: true, noSteinerVertices: true, allComponentsPreserved: true },
    nativeBindingResiduals: { maximumVertexSurfaceMM: Math.max(0, ...vertices.map(vertex => vertex.originalSurfaceDifferenceMM)),
      maximumBoundaryLineSurfaceMM: Math.max(0, ...boundaryPaths.flatMap(path => path.samples.map(sample => Math.max(sample.pointDifferenceMM, sample.originalPointDifferenceMM)))),
      maximumBoundaryMeshEndpointMM: Math.max(0, ...boundaryPaths.flatMap(path => path.samples.map(sample => sample.meshEndpointDifferenceMM ?? 0))),
      maximumBoundaryRelativeD1: Math.max(0, ...boundaryPaths.flatMap(path => path.samples.map(sample => Math.max(sample.relativeD1Difference, sample.relativeSurfaceD1Difference)))) },
    numericPolicy: { predicate: 'exact-zero-or-64-epsilon-uncertainty-refusal', uvArea: '128-epsilon-scaled-area-sum-or-parent-area-uncertainty', relativePhysicalArea: TOLERANCE,
      materialProof: 'strict-general-native-loop-winding-visible-graph-all-vertex-triangles-and-separating-axes', positions: 'actual-original-support-d1-binary64',
      empty: 'zero-arrays-null-bounds-no-native-d1-calls' },
    quality: { representation: 'derived-raw-xyz-planar-material-preview-not-native-surface-or-preview-packet0', nativeRegionBitsPreserved: true,
      workScope: 'new-material-graph-and-mesh-bindings-excludes-native-parent-reconstruction',
      worldBoundary: 'actual-unsnapped-extracted-native-fragments-only', internalEdges: 'derived-display-diagonals-and-bridges-not-cad-boundaries', uvAreaIsManufacturingArea: false,
      globalTriangulationCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, rendererCapacityCertified: false,
      ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-no-partial-mesh',
    limits: { maximumVertices: 64, maximumTriangles: 80, maximumCandidatePairs: 2016, maximumPredicateTests: 2000000, maximumTriangleTests: 50000,
      maximumInternalEdges: 88, maximumBridges: 8, maximumComponents: 8, maximumLoops: 16, maximumHoles: 8, ownValues: 1048576, ownDepth: 40,
      arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144, meshIdCharacters: 20, pointComparisonMM: TOLERANCE, relativeD1Comparison: TOLERANCE },
  };
  return snapshot({ region, options, mesh, boundaryPaths, triangulation, report }) as CoplanarFaceBooleanMeshResult;
}
/** Reconstruct the native parent and the entire derived graph, mesh, boundary observations and work report. */
export function validateCoplanarFaceBooleanMesh(input: CoplanarFaceBooleanMeshResult): CoplanarFaceBooleanMeshReport {
  const owned = record(snapshot(input, CODE.OWNED), ['region', 'options', 'mesh', 'boundaryPaths', 'triangulation', 'report'], CODE.OWNED) as unknown as CoplanarFaceBooleanMeshResult;
  let expected: CoplanarFaceBooleanMeshResult;
  try { expected = tessellateCoplanarFaceBoolean(owned.region, owned.options); } catch (cause) {
    throw new CoplanarFaceBooleanMeshError(CODE.OWNED, 'owned complete native region/material graph/display mesh rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned original region/source/mesh/normal/boundary/internal-role/work/coverage/report mismatch');
  return snapshot(expected.report, CODE.OWNED) as CoplanarFaceBooleanMeshReport;
}
