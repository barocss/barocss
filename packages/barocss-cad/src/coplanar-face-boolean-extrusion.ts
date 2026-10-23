import { CadNumericPolicy } from './numeric-policy.js';
import { validateCoplanarFaceBoolean } from './coplanar-face-boolean.js';
import type { CoplanarFaceBooleanResult, CoplanarFaceBooleanContributor } from './coplanar-face-boolean.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import { validateCurve } from './math.js';
import type { Curve, Surface, Model, Point } from './types.js';
import type { CompatibleRuledSurfaceResult } from './nurbs/surfaces/compatible-ruled-surface.js';
import { buildCoplanarExtrusionGeometry } from './coplanar-face-boolean-extrusion-geometry.js';
import { same } from './structural-equality.js';

export const CoplanarFaceBooleanExtrusionDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET',
  NATIVE: 'NATIVE', REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', INCIDENCE: 'INCIDENCE', OWNED: 'OWNED' } as const);
export type CoplanarFaceBooleanExtrusionDiagnosticCode = typeof CoplanarFaceBooleanExtrusionDiagnosticCode[keyof typeof CoplanarFaceBooleanExtrusionDiagnosticCode];
export class CoplanarFaceBooleanExtrusionError extends Error {
  readonly code: CoplanarFaceBooleanExtrusionDiagnosticCode;
  constructor(code: CoplanarFaceBooleanExtrusionDiagnosticCode, detail: string, cause?: unknown) {
    super(('Coplanar Face Boolean Extrusion: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CoplanarFaceBooleanExtrusionError'; this.code = code;
  }
}
export interface CoplanarFaceBooleanExtrusionOptions {
  evaluationId: string; resultIdPrefix: string; distanceMM: number; maximumVertices: number; maximumFaces: number;
  maximumSourceChunks: number; maximumBindingSamples: number;
}
export interface CoplanarFaceBooleanExtrusionVertex {
  id: string; layer: 'bottom' | 'top'; nativeVertexId: string; componentId: string; pointMM: Point; originalPointMM: Point;
}
type SourcePointer = { assetId: string; objectId: string; objectIndex: number; kind: 'curve' | 'surface' };
export interface CoplanarFaceBooleanExtrusionEdgeUse {
  id: string; faceId: string; loopId: string; edgeId: string; curveId: string; source: SourcePointer;
  edgeSense: 'forward' | 'reverse'; faceOrientation: 'forward' | 'reverse'; effectiveSense: 'forward' | 'reverse';
  vertexIds: [string, string]; effectiveVertexIds: [string, string]; interval: [number, number]; effectiveInterval: [number, number];
  nativeFragmentId: string | null; nativeUseId: string | null; contributor: CoplanarFaceBooleanContributor | null;
  pcurve: { id: string; coordinateSystem: 'uv'; lengthUnit: 'dimensionless'; domain: [number, number];
    parameterRoles: { u: 'original-support-u' | 'original-fragment-parameter'; v: 'original-support-v' | 'extrusion-interpolation' }; curve: Curve };
  observations: { parameter: number; curveD1: CurveD1Result; pcurveD1: CurveD1Result; surfaceD1: SurfaceD1Result;
    pointDifferenceMM: number; relativeTangentDifference: number; endpointVertexId: string | null; endpointDifferenceMM: number | null }[];
}
export interface CoplanarFaceBooleanExtrusionFace {
  id: string; componentId: string; kind: 'bottom-cap' | 'top-cap' | 'wall'; orientation: 'forward' | 'reverse';
  surface: Surface; source: SourcePointer; nativeFragmentId: string | null; ruledConstruction: CompatibleRuledSurfaceResult | null;
  loops: { id: string; role: 'outer' | 'hole'; nativeLoopId: string | null; nativeLoopRole: 'outer' | 'hole' | null;
    uses: CoplanarFaceBooleanExtrusionEdgeUse[]; effectiveUseIds: string[] }[];
  normalObservation: { u: number; v: number; witness: 'native-selected-boundary-uv' | 'native-wall-parameter-center'; materialInteriorClaim: false;
    surfaceD1: SurfaceD1Result; orientedNormal: Point; intendedNormal: Point; normalDifference: number; normalDot: number };
}
export interface CoplanarFaceBooleanExtrusionShell {
  id: string; componentId: string; faceIds: string[]; edgeIds: string[]; vertexIds: string[]; holeLoopIds: string[];
  vertexCount: number; edgeCount: number; faceCount: number; capWeightedContribution: number;
  weightedEuler: number; expectedWeightedEuler: number; pairedEdgeIncidence: true; solid: false;
}
export interface CoplanarFaceBooleanExtrusionReport {
  schema: 'barocss-native-coplanar-face-boolean-extrusion'; version: 0; evaluationId: string; lengthUnit: 'mm';
  sourceFrame: 'authored-xyz-no-axis-conversion'; capUVUnits: 'dimensionless'; wallVRole: 'extrusion-interpolation'; distanceMM: number;
  empty: boolean; nativeVertexCount: number; nativeFragmentCount: number; componentCount: number; holeCount: number;
  vertexCount: number; edgeCount: number; faceCount: number; shellCount: number; edgeUseCount: number; geometryObjectCount: number; sourceChunkCount: number;
  ruledConstructionCount: number; bindingSampleCount: number; bindingCurveD1EvaluationCount: number; bindingSurfaceD1EvaluationCount: number;
  normalCurveD1EvaluationCount: number; normalSurfaceD1EvaluationCount: number; curveD1EvaluationCount: number; surfaceD1EvaluationCount: number;
  boundsMM: { min: Point; max: Point } | null;
  translationEvidence: { origin: string; originalPointMM: Point; translatedPointMM: Point; actualOffsetMM: Point;
    dominantAxis: number; dominantSeparationMM: number; separationThresholdMM: number; normalProjectionMM: number; offsetDifferenceMM: number }[];
  edgeIncidence: { edgeId: string; useIds: [string, string]; faceIds: [string, string]; effectiveSenses: ['forward', 'reverse'] | ['reverse', 'forward']; opposite: true }[];
  maximumPointDifferenceMM: number; maximumEndpointDifferenceMM: number; maximumRelativeTangentDifference: number; maximumNormalDifference: number;
  incidenceValid: true; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { geometryAuthority: 'actual-native-fragments-support-and-compatible-ruled-surfaces'; originalRegionBitsPreserved: true;
    boundsAuthority: 'canonical-selected-bottom-top-vertices-not-certified-native-geometry-bounds';
    topPoles: 'one-native-normal-translation'; capTrim: 'unchanged-component-outer-and-hole-cycles-not-support-rectangle';
    capNormalWitness: 'selected-native-boundary-uv-no-material-interior-claim'; wallUV: 'native-fragment-u-and-dimensionless-v-identity-equal-weight-sidecars';
    endpoints: 'unsnapped-native-curves-and-canonical-incidence-local-residuals-no-welding'; pairedUses: 'local-edge-sense-times-face-orientation';
    workScope: 'new-extrusion-bindings-and-normal-observations-excludes-native-parent-and-ruled-constructor-observations';
    uvSource: 'dimensionless-sidecars-excluded-from-world-mm-source0'; sourceObjectLimitUnchanged: 16;
    geometricSolidCertified: false; exactSewingCertified: false; globalManifoldCertified: false; manufacturingToleranceCertified: false;
    volumeCertified: false; ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-extrusion';
  limits: { maximumNativeVertices: 64; maximumVertices: 128; maximumEdges: 192; maximumFaces: 80; maximumShells: 8; maximumEdgeUses: 384;
    maximumGeometryObjects: 258; maximumSourceChunks: 17; maximumBindingSamples: 1152; sourceObjects: 16;
    ownValues: 1048576; ownDepth: 40; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144;
    resultIdPrefixCharacters: 20; minimumDistanceMM: 0.0001; maximumDistanceMM: 10000; worldCoordinateMM: 10000;
    pointComparisonMM: 1e-7; relativeD1Comparison: 1e-7 };
}
export interface CoplanarFaceBooleanExtrusionResult {
  region: CoplanarFaceBooleanResult; options: CoplanarFaceBooleanExtrusionOptions; normal: Point | null; translationMM: Point | null;
  vertices: CoplanarFaceBooleanExtrusionVertex[];
  edges: { id: string; componentId: string; kind: 'bottom' | 'top' | 'vertical'; curve: Curve; source: SourcePointer;
    vertexIds: [string, string]; nativeFragmentId: string | null; nativeVertexId: string | null;
    uses: { useId: string; faceId: string; loopId: string; effectiveSense: 'forward' | 'reverse' }[] }[];
  faces: CoplanarFaceBooleanExtrusionFace[]; shells: CoplanarFaceBooleanExtrusionShell[];
  sources: { id: string; source: string; sourceVersion: 0; model: Model; objectIds: string[] }[]; report: CoplanarFaceBooleanExtrusionReport;
}

const CODE = CoplanarFaceBooleanExtrusionDiagnosticCode, TOLERANCE = CadNumericPolicy.linearToleranceMM;
function check(condition: boolean, code: CoplanarFaceBooleanExtrusionDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CoplanarFaceBooleanExtrusionError(code, detail);
}
function native<T>(action: () => T, detail: string, code: CoplanarFaceBooleanExtrusionDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CoplanarFaceBooleanExtrusionError) throw cause;
    throw new CoplanarFaceBooleanExtrusionError(code, detail, cause);
  }
}
function snapshot(input: unknown, code: CoplanarFaceBooleanExtrusionDiagnosticCode = CODE.INPUT): unknown {
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
function record(input: unknown, fields: string[], code: CoplanarFaceBooleanExtrusionDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required');
  const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(',')); return data;
}
function id(value: unknown, maximum = 48): string {
  check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..' + maximum + ' required'); return value;
}
function admitOptions(input: unknown): CoplanarFaceBooleanExtrusionOptions {
  const data = record(input, ['evaluationId', 'resultIdPrefix', 'distanceMM', 'maximumVertices', 'maximumFaces', 'maximumSourceChunks', 'maximumBindingSamples']);
  check(typeof data.distanceMM === 'number' && data.distanceMM >= 0.0001 && data.distanceMM <= 10000, CODE.INPUT, 'positive distance0.0001..10000mm required');
  for (const [field, maximum] of [['maximumVertices', 128], ['maximumFaces', 80], ['maximumSourceChunks', 17], ['maximumBindingSamples', 1152]] as const)
    check(typeof data[field] === 'number' && Number.isInteger(data[field]) && (data[field] as number) >= 0 && (data[field] as number) <= maximum,
      CODE.BUDGET, 'integer ' + field + ' within frozen native limits required');
  return { evaluationId: id(data.evaluationId), resultIdPrefix: id(data.resultIdPrefix, 20), distanceMM: data.distanceMM,
    maximumVertices: data.maximumVertices as number, maximumFaces: data.maximumFaces as number,
    maximumSourceChunks: data.maximumSourceChunks as number, maximumBindingSamples: data.maximumBindingSamples as number };
}
function reserveRoles(region: CoplanarFaceBooleanResult, options: CoplanarFaceBooleanExtrusionOptions): (suffix: string) => string {
  const originals = new Set<string>();
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && (key === 'id' || key.endsWith('Id') || key === 'name')) originals.add(item);
      else if (key.endsWith('Ids') && Array.isArray(item)) for (const value of item) { if (typeof value === 'string') originals.add(value); }
      else collect(item);
    }
  };
  collect(region);
  const generated = new Set<string>(), reserve = (value: string): void => { id(value);
    check(!originals.has(value) && !generated.has(value), CODE.IDENTITY, 'derived identity collides with original or another extrusion role'); generated.add(value); };
  const role = (suffix: string): string => options.resultIdPrefix + suffix;
  reserve(options.evaluationId); reserve(role('_s_b')); reserve(role('_s_t'));
  for (let i = 0; i < 64; i++) {
    for (const stem of ['_v_b_', '_v_t_', '_c_b_', '_c_t_', '_c_v_', '_e_b_', '_e_t_', '_e_v_', '_s_w_', '_f_w_', '_loop_w_', '_use_b_', '_use_t_', '_uv_b_', '_uv_t_']) reserve(role(stem + i));
    for (let side = 0; side < 4; side++) { reserve(role('_use_w_' + i + '_' + side)); reserve(role('_uv_w_' + i + '_' + side)); }
  }
  for (let i = 0; i < 8; i++) { reserve(role('_f_b_' + i)); reserve(role('_f_t_' + i)); reserve(role('_shell_' + i)); }
  for (let i = 0; i < 16; i++) { reserve(role('_loop_b_' + i)); reserve(role('_loop_t_' + i)); }
  for (let i = 0; i < 17; i++) reserve(role('_src_' + i)); return role;
}
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'finite extrusion binding/normal arithmetic required'); return value; }
function product(a: number, b: number): number { const value = finite(a * b);
  check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero extrusion product underflow'); return value; }
function delta(a: Point, b: Point): Point { return a.map((value, i) => finite(value - b[i])) as Point; }
function cross(a: Point, b: Point): Point { return [finite(product(a[1], b[2]) - product(a[2], b[1])),
  finite(product(a[2], b[0]) - product(a[0], b[2])), finite(product(a[0], b[1]) - product(a[1], b[0]))]; }
function dot(a: Point, b: Point): number { return a.reduce((sum, value, i) => finite(sum + product(value, b[i])), 0); }
function distance(a: Point, b: Point): number { return finite(Math.hypot(...delta(a, b))); }
function unit(value: Point): Point { const length = finite(Math.hypot(...value)); check(length > 0, CODE.REPRESENTABILITY, 'represented nonzero native normal required');
  return value.map(component => { const result = finite(component / length);
    check(component === 0 || result !== 0, CODE.REPRESENTABILITY, 'nonzero native normal component underflow'); return result; }) as Point; }
function relative(a: Point, b: Point): number { const difference = distance(a, b), value = finite(difference / Math.max(1, finite(Math.hypot(...a))));
  check(difference === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero tangent residual underflow'); return value; }
function reverse<T>(pair: [T, T]): [T, T] { return [pair[1], pair[0]]; }

/** Native trimmed caps and actual ruled walls; canonical incidence is observed, never welded. */
export function extrudeCoplanarFaceBoolean(regionInput: CoplanarFaceBooleanResult,
  optionsInput: CoplanarFaceBooleanExtrusionOptions): CoplanarFaceBooleanExtrusionResult {
  const data = record(snapshot({ region: regionInput, options: optionsInput }), ['region', 'options']);
  const region = data.region as CoplanarFaceBooleanResult, options = admitOptions(data.options);
  native(() => validateCoplanarFaceBoolean(region), 'complete actual native Boolean parent reconstruction', CODE.INPUT);
  const role = reserveRoles(region, options), n = region.vertices.length, f = region.fragments.length, c = region.components.length;
  check(n === f && n <= 64 && c <= 8, CODE.INCIDENCE, 'bounded canonical closed native region incidence required');
  const empty = n === 0, geometryObjectCount = empty ? 0 : 2 + 4 * n, faceCount = n + 2 * c, bindingSamplesExpected = 18 * n;
  check(2 * n <= options.maximumVertices && faceCount <= options.maximumFaces && Math.ceil(geometryObjectCount / 16) <= options.maximumSourceChunks
    && bindingSamplesExpected <= options.maximumBindingSamples, CODE.BUDGET, 'complete native extrusion vertex/face/source/binding capacity exceeded');
  let normal: Point | null = null, translationMM: Point | null = null;
  let bindingSampleCount = 0, bindingCurveD1EvaluationCount = 0, bindingSurfaceD1EvaluationCount = 0;
  let normalCurveD1EvaluationCount = 0, normalSurfaceD1EvaluationCount = 0;
  const vertices: CoplanarFaceBooleanExtrusionVertex[] = [], edges: CoplanarFaceBooleanExtrusionResult['edges'] = [], faces: CoplanarFaceBooleanExtrusionFace[] = [];
  const shells: CoplanarFaceBooleanExtrusionShell[] = [], sources: CoplanarFaceBooleanExtrusionResult['sources'] = [];
  const translationEvidence: CoplanarFaceBooleanExtrusionReport['translationEvidence'] = [];
  const edgeIncidence: CoplanarFaceBooleanExtrusionReport['edgeIncidence'] = [];
  if (!empty) {
    const first = region.vertices[0]; normalSurfaceD1EvaluationCount++;
    const firstD1 = native(() => evaluateSurfaceD1(region.support, first.uv[0], first.uv[1]), 'actual first selected native support D1 normal');
    const direction = unit(cross(firstD1.du, firstD1.dv)); normal = direction;
    const translation = direction.map(value => product(value, options.distanceMM)) as Point; translationMM = translation;
    const geometry = buildCoplanarExtrusionGeometry(region, options, direction, translation, role, check, native);
    sources.push(...geometry.sources); translationEvidence.push(...geometry.translationEvidence);
    const vertexIndex = new Map(region.vertices.map((vertex, i) => [vertex.id, i]));
    const vertexComponent = new Map(region.loops.flatMap(loop => loop.vertexIds.map(id => [id, loop.componentId] as const)));
    const fragmentComponent = new Map(region.loops.flatMap(loop => loop.uses.map(use => [use.id, loop.componentId] as const)));
    for (const layer of ['bottom', 'top'] as const) region.vertices.forEach((vertex, i) => {
      const componentId = vertexComponent.get(vertex.id); check(componentId !== undefined, CODE.INCIDENCE, 'canonical native vertex component required');
      vertices.push({ id: role((layer === 'bottom' ? '_v_b_' : '_v_t_') + i), layer, nativeVertexId: vertex.id, componentId,
        pointMM: layer === 'bottom' ? vertex.pointMM : geometry.topVertexPoints[i], originalPointMM: vertex.pointMM });
    });
    const pointer = (objectId: string): SourcePointer => { const value = geometry.pointers.get(objectId);
      check(value !== undefined, CODE.BINDING, 'actual compiled native geometry source pointer required'); return value; };
    for (const layer of ['bottom', 'top'] as const) region.fragments.forEach((fragment, i) => {
      const componentId = fragmentComponent.get(fragment.useId); check(componentId !== undefined, CODE.INCIDENCE, 'actual fragment component required');
      const ascendingIds = fragment.sense === 'forward' ? fragment.vertexIds : reverse(fragment.vertexIds);
      const indices = ascendingIds.map(id => vertexIndex.get(id)); check(indices.every(index => index !== undefined), CODE.INCIDENCE, 'actual ascending fragment canonical endpoints required');
      const curve = layer === 'bottom' ? geometry.bottomCurves[i] : geometry.topCurves[i];
      edges.push({ id: role((layer === 'bottom' ? '_e_b_' : '_e_t_') + i), componentId, kind: layer, curve, source: pointer(curve.id),
        vertexIds: indices.map(index => role((layer === 'bottom' ? '_v_b_' : '_v_t_') + index)) as [string, string],
        nativeFragmentId: fragment.id, nativeVertexId: null, uses: [] });
    });
    region.vertices.forEach((vertex, i) => edges.push({ id: role('_e_v_' + i), componentId: vertexComponent.get(vertex.id)!, kind: 'vertical',
      curve: geometry.verticalCurves[i], source: pointer(geometry.verticalCurves[i].id), vertexIds: [role('_v_b_' + i), role('_v_t_' + i)],
      nativeFragmentId: null, nativeVertexId: vertex.id, uses: [] }));
    const edgeById = new Map(edges.map(edge => [edge.id, edge]));
    const vertexById = new Map(vertices.map(vertex => [vertex.id, vertex]));
    const use = (faceId: string, loopId: string, orientation: 'forward' | 'reverse', edgeId: string, sense: 'forward' | 'reverse',
      pcurve: Curve, fragmentIndex: number | null, nativeUseId: string | null, useId: string,
      wall: boolean): CoplanarFaceBooleanExtrusionEdgeUse => {
      const edge = edgeById.get(edgeId); check(edge !== undefined, CODE.INCIDENCE, 'actual native global edge required');
      native(() => validateCurve(pcurve), 'actual dimensionless native per-use pcurve validation');
      const domain: [number, number] = [edge.curve.knots[edge.curve.degree], edge.curve.knots[edge.curve.controlPoints.length]];
      const interval = sense === 'forward' ? domain : reverse(domain), vertexIds = sense === 'forward' ? edge.vertexIds : reverse(edge.vertexIds);
      const effectiveSense = sense === orientation ? 'forward' : 'reverse';
      const effectiveInterval = orientation === 'forward' ? interval : reverse(interval), effectiveVertexIds = orientation === 'forward' ? vertexIds : reverse(vertexIds);
      const middle = finite(domain[0] + product(domain[1] - domain[0], .5));
      check(middle > domain[0] && middle < domain[1], CODE.REPRESENTABILITY, 'strict native edge-use midpoint required');
      const surface = wall ? geometry.walls[fragmentIndex!].surface : orientation === 'reverse' ? geometry.bottomSupport : geometry.topSupport;
      const observations: CoplanarFaceBooleanExtrusionEdgeUse['observations'] = [interval[0], middle, interval[1]].map((parameter, sampleIndex) => {
        bindingSampleCount++; check(bindingSampleCount <= options.maximumBindingSamples, CODE.BUDGET, 'actual native edge-use binding sample budget exceeded');
        bindingCurveD1EvaluationCount += 2; bindingSurfaceD1EvaluationCount++;
        const curveD1 = native(() => evaluateCurveD1(edge.curve, parameter), 'actual output native world edge D1');
        const pcurveD1 = native(() => evaluateCurveD1(pcurve, parameter), 'actual dimensionless per-use pcurve D1');
        const surfaceD1 = native(() => evaluateSurfaceD1(surface, pcurveD1.point[0], pcurveD1.point[1]), 'actual native cap/wall Surface D1 binding');
        const chain = surfaceD1.du.map((value, axis) => finite(product(value, pcurveD1.derivative[0]) + product(surfaceD1.dv[axis], pcurveD1.derivative[1]))) as Point;
        const pointDifferenceMM = distance(curveD1.point, surfaceD1.point), relativeTangentDifference = relative(curveD1.derivative, chain);
        const endpointVertexId = sampleIndex === 1 ? null : vertexIds[sampleIndex === 0 ? 0 : 1];
        const endpointDifferenceMM = endpointVertexId === null ? null : distance(curveD1.point, vertexById.get(endpointVertexId)!.pointMM);
        check(pointDifferenceMM <= TOLERANCE && relativeTangentDifference <= TOLERANCE && (endpointDifferenceMM === null || endpointDifferenceMM <= TOLERANCE),
          CODE.BINDING, 'unsnapped native world/UV/Surface/canonical incidence point or tangent residual exceeds local policy');
        return { parameter, curveD1, pcurveD1, surfaceD1, pointDifferenceMM, relativeTangentDifference, endpointVertexId, endpointDifferenceMM };
      });
      edge.uses.push({ useId, faceId, loopId, effectiveSense });
      const fragment = fragmentIndex === null ? null : region.fragments[fragmentIndex];
      return { id: useId, faceId, loopId, edgeId, curveId: edge.curve.id, source: edge.source, edgeSense: sense, faceOrientation: orientation, effectiveSense,
        vertexIds, effectiveVertexIds, interval, effectiveInterval, nativeFragmentId: fragment?.id ?? null, nativeUseId, contributor: fragment?.contributor ?? null,
        pcurve: { id: pcurve.id, coordinateSystem: 'uv', lengthUnit: 'dimensionless', domain,
          parameterRoles: { u: wall ? 'original-fragment-parameter' : 'original-support-u', v: wall ? 'extrusion-interpolation' : 'original-support-v' }, curve: pcurve }, observations };
    };
    const observeNormal = (surface: Surface, orientation: 'forward' | 'reverse', u: number, v: number, intendedNormal: Point,
      witness: CoplanarFaceBooleanExtrusionFace['normalObservation']['witness']): CoplanarFaceBooleanExtrusionFace['normalObservation'] => {
      normalSurfaceD1EvaluationCount++;
      const surfaceD1 = native(() => evaluateSurfaceD1(surface, u, v), 'actual native cap/wall normal D1 observation');
      const raw = unit(cross(surfaceD1.du, surfaceD1.dv)), orientedNormal = raw.map(value => orientation === 'forward' ? value : -value) as Point;
      const normalDifference = distance(orientedNormal, intendedNormal), normalDot = dot(orientedNormal, intendedNormal);
      check(normalDot > 0 && normalDifference <= TOLERANCE, CODE.BINDING, 'actual native oriented cap/wall normal differs from intended outward direction');
      return { u, v, witness, materialInteriorClaim: false, surfaceD1, orientedNormal, intendedNormal, normalDifference, normalDot };
    };
    for (const [componentIndex, component] of region.components.entries()) for (const layer of ['bottom', 'top'] as const) {
      const orientation = layer === 'bottom' ? 'reverse' : 'forward', faceId = role((layer === 'bottom' ? '_f_b_' : '_f_t_') + componentIndex);
      const surface = layer === 'bottom' ? geometry.bottomSupport : geometry.topSupport;
      const loops: CoplanarFaceBooleanExtrusionFace['loops'] = region.loops.filter(loop => loop.componentId === component.id).map(loop => {
        const loopIndex = region.loops.findIndex(value => value.id === loop.id), loopId = role((layer === 'bottom' ? '_loop_b_' : '_loop_t_') + loopIndex);
        const uses = loop.uses.map(originalUse => {
          const i = region.fragments.findIndex(fragment => fragment.useId === originalUse.id); check(i >= 0, CODE.INCIDENCE, 'actual native cap fragment use required');
          const originalPcurve = region.fragments[i].pcurve.curve;
          const pcurve: Curve = { ...originalPcurve, id: role((layer === 'bottom' ? '_uv_b_' : '_uv_t_') + i) };
          return use(faceId, loopId, orientation, role((layer === 'bottom' ? '_e_b_' : '_e_t_') + i), region.fragments[i].sense,
            pcurve, i, originalUse.id, role((layer === 'bottom' ? '_use_b_' : '_use_t_') + i), false);
        });
        return { id: loopId, role: loop.role, nativeLoopId: loop.id, nativeLoopRole: loop.role, uses,
          effectiveUseIds: (orientation === 'forward' ? uses : [...uses].reverse()).map(value => value.id) };
      });
      const outer = region.loops.find(loop => loop.id === component.outerLoopId)!;
      const witness = region.vertices.find(vertex => vertex.id === outer.vertexIds[0])!;
      const intended = direction.map(value => layer === 'bottom' ? -value : value) as Point;
      faces.push({ id: faceId, componentId: component.id, kind: layer === 'bottom' ? 'bottom-cap' : 'top-cap', orientation,
        surface, source: pointer(surface.id), nativeFragmentId: null, ruledConstruction: null, loops,
        normalObservation: observeNormal(surface, orientation, witness.uv[0], witness.uv[1], intended, 'native-selected-boundary-uv') });
    }
    region.fragments.forEach((fragment, i) => {
      const faceId = role('_f_w_' + i), loopId = role('_loop_w_' + i), orientation = fragment.sense;
      const [a, b] = fragment.interval, bottom = edgeById.get(role('_e_b_' + i))!, top = edgeById.get(role('_e_t_' + i))!;
      const minIndex = vertices.findIndex(vertex => vertex.id === bottom.vertexIds[0]), maxIndex = vertices.findIndex(vertex => vertex.id === bottom.vertexIds[1]);
      check(minIndex >= 0 && minIndex < n && maxIndex >= 0 && maxIndex < n, CODE.INCIDENCE, 'actual ascending wall min/max canonical vertex association required');
      const pcurve = (side: number): Curve => {
        const vertical = side === 1 || side === 3, domain: [number, number] = vertical ? [0, 1] : [a, b];
        const controlPoints: Point[] = side === 0 ? [[a, 0, 0], [b, 0, 0]] : side === 1 ? [[b, 0, 0], [b, 1, 0]]
          : side === 2 ? [[a, 1, 0], [b, 1, 0]] : [[a, 0, 0], [a, 1, 0]];
        return { kind: 'curve', id: role('_uv_w_' + i + '_' + side), degree: 1, knots: [domain[0], domain[0], domain[1], domain[1]], controlPoints, weights: [1, 1] };
      };
      const uses = [use(faceId, loopId, orientation, bottom.id, 'forward', pcurve(0), i, fragment.useId, role('_use_w_' + i + '_0'), true),
        use(faceId, loopId, orientation, role('_e_v_' + maxIndex), 'forward', pcurve(1), i, null, role('_use_w_' + i + '_1'), true),
        use(faceId, loopId, orientation, top.id, 'reverse', pcurve(2), i, fragment.useId, role('_use_w_' + i + '_2'), true),
        use(faceId, loopId, orientation, role('_e_v_' + minIndex), 'reverse', pcurve(3), i, null, role('_use_w_' + i + '_3'), true)];
      const middle = finite(a + product(b - a, .5)); normalCurveD1EvaluationCount++;
      const tangent = native(() => evaluateCurveD1(geometry.bottomCurves[i], middle), 'actual native wall traversal tangent normal witness').derivative
        .map(value => orientation === 'forward' ? value : -value) as Point;
      const intended = unit(cross(tangent, direction)), wall = geometry.walls[i];
      faces.push({ id: faceId, componentId: fragmentComponent.get(fragment.useId)!, kind: 'wall', orientation,
        surface: wall.surface, source: pointer(wall.surface.id), nativeFragmentId: fragment.id, ruledConstruction: wall,
        loops: [{ id: loopId, role: 'outer', nativeLoopId: null, nativeLoopRole: null, uses,
          effectiveUseIds: (orientation === 'forward' ? uses : [...uses].reverse()).map(value => value.id) }],
        normalObservation: observeNormal(wall.surface, orientation, middle, .5, intended, 'native-wall-parameter-center') });
    });
    for (const face of faces) for (const loop of face.loops) {
      check(loop.uses.length >= 3 && loop.uses.every((value, i) => value.vertexIds[1] === loop.uses[(i + 1) % loop.uses.length].vertexIds[0]),
        CODE.INCIDENCE, 'every native face parameter loop must close with local directed vertices');
      const effective = loop.effectiveUseIds.map(id => loop.uses.find(value => value.id === id)!);
      check(effective.every((value, i) => value.effectiveVertexIds[1] === effective[(i + 1) % effective.length].effectiveVertexIds[0]),
        CODE.INCIDENCE, 'every oriented face loop must close with effective directed vertices');
    }
    for (const edge of edges) {
      check(edge.uses.length === 2 && edge.uses[0].faceId !== edge.uses[1].faceId && edge.uses[0].effectiveSense !== edge.uses[1].effectiveSense,
        CODE.INCIDENCE, 'every global native edge must have exactly two effective opposite face uses');
      edgeIncidence.push({ edgeId: edge.id, useIds: [edge.uses[0].useId, edge.uses[1].useId], faceIds: [edge.uses[0].faceId, edge.uses[1].faceId],
        effectiveSenses: [edge.uses[0].effectiveSense, edge.uses[1].effectiveSense] as ['forward', 'reverse'] | ['reverse', 'forward'], opposite: true });
    }
    region.components.forEach((component, i) => {
      const componentVertices = vertices.filter(vertex => vertex.componentId === component.id), componentEdges = edges.filter(edge => edge.componentId === component.id), componentFaces = faces.filter(face => face.componentId === component.id);
      const capWeightedContribution = 2 * (1 - component.holeLoopIds.length);
      const weightedEuler = componentVertices.length - componentEdges.length + componentFaces.filter(face => face.kind === 'wall').length + capWeightedContribution;
      const expectedWeightedEuler = 2 - 2 * component.holeLoopIds.length;
      check(weightedEuler === expectedWeightedEuler, CODE.INCIDENCE, 'component cap-weighted Euler incidence differs from2-2H');
      shells.push({ id: role('_shell_' + i), componentId: component.id, faceIds: componentFaces.map(face => face.id), edgeIds: componentEdges.map(edge => edge.id),
        vertexIds: componentVertices.map(vertex => vertex.id), holeLoopIds: component.holeLoopIds, vertexCount: componentVertices.length,
        edgeCount: componentEdges.length, faceCount: componentFaces.length, capWeightedContribution, weightedEuler, expectedWeightedEuler, pairedEdgeIncidence: true, solid: false });
    });
  }
  check(bindingSampleCount === bindingSamplesExpected && faces.length === faceCount && vertices.length === 2 * n && edges.length === 3 * n
    && shells.length === c, CODE.INCIDENCE, 'complete native extrusion counts must preserve every component and hole boundary');
  const allUses = faces.flatMap(face => face.loops.flatMap(loop => loop.uses));
  check(allUses.length === 6 * n && bindingCurveD1EvaluationCount === 2 * bindingSampleCount && bindingSurfaceD1EvaluationCount === bindingSampleCount,
    CODE.INCIDENCE, 'actual full edge-use/binding call counts required');
  const observations = allUses.flatMap(use => use.observations);
  const boundsMM = vertices.length === 0 ? null : { min: [0, 1, 2].map(axis => Math.min(...vertices.map(vertex => vertex.pointMM[axis]))) as Point,
    max: [0, 1, 2].map(axis => Math.max(...vertices.map(vertex => vertex.pointMM[axis]))) as Point };
  const report: CoplanarFaceBooleanExtrusionReport = {
    schema: 'barocss-native-coplanar-face-boolean-extrusion', version: 0, evaluationId: options.evaluationId, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
    capUVUnits: 'dimensionless', wallVRole: 'extrusion-interpolation', distanceMM: options.distanceMM, empty, nativeVertexCount: n, nativeFragmentCount: f,
    componentCount: c, holeCount: region.loops.filter(loop => loop.role === 'hole').length, vertexCount: vertices.length, edgeCount: edges.length,
    faceCount: faces.length, shellCount: shells.length, edgeUseCount: allUses.length, geometryObjectCount, sourceChunkCount: sources.length,
    ruledConstructionCount: n, bindingSampleCount, bindingCurveD1EvaluationCount, bindingSurfaceD1EvaluationCount,
    normalCurveD1EvaluationCount, normalSurfaceD1EvaluationCount, curveD1EvaluationCount: bindingCurveD1EvaluationCount + normalCurveD1EvaluationCount,
    surfaceD1EvaluationCount: bindingSurfaceD1EvaluationCount + normalSurfaceD1EvaluationCount, boundsMM, translationEvidence, edgeIncidence,
    maximumPointDifferenceMM: Math.max(0, ...observations.map(value => value.pointDifferenceMM)),
    maximumEndpointDifferenceMM: Math.max(0, ...observations.map(value => value.endpointDifferenceMM ?? 0)),
    maximumRelativeTangentDifference: Math.max(0, ...observations.map(value => value.relativeTangentDifference)),
    maximumNormalDifference: Math.max(0, ...faces.map(face => face.normalObservation.normalDifference)), incidenceValid: true,
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { geometryAuthority: 'actual-native-fragments-support-and-compatible-ruled-surfaces', originalRegionBitsPreserved: true,
      boundsAuthority: 'canonical-selected-bottom-top-vertices-not-certified-native-geometry-bounds',
      topPoles: 'one-native-normal-translation', capTrim: 'unchanged-component-outer-and-hole-cycles-not-support-rectangle',
      capNormalWitness: 'selected-native-boundary-uv-no-material-interior-claim', wallUV: 'native-fragment-u-and-dimensionless-v-identity-equal-weight-sidecars',
      endpoints: 'unsnapped-native-curves-and-canonical-incidence-local-residuals-no-welding', pairedUses: 'local-edge-sense-times-face-orientation',
      workScope: 'new-extrusion-bindings-and-normal-observations-excludes-native-parent-and-ruled-constructor-observations',
      uvSource: 'dimensionless-sidecars-excluded-from-world-mm-source0', sourceObjectLimitUnchanged: 16,
      geometricSolidCertified: false, exactSewingCertified: false, globalManifoldCertified: false, manufacturingToleranceCertified: false, volumeCertified: false,
      ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-no-partial-extrusion',
    limits: { maximumNativeVertices: 64, maximumVertices: 128, maximumEdges: 192, maximumFaces: 80, maximumShells: 8, maximumEdgeUses: 384,
      maximumGeometryObjects: 258, maximumSourceChunks: 17, maximumBindingSamples: 1152, sourceObjects: 16, ownValues: 1048576, ownDepth: 40,
      arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144, resultIdPrefixCharacters: 20, minimumDistanceMM: 0.0001,
      maximumDistanceMM: 10000, worldCoordinateMM: 10000, pointComparisonMM: TOLERANCE, relativeD1Comparison: TOLERANCE },
  };
  return snapshot({ region, options, normal, translationMM, vertices, edges, faces, shells, sources, report }) as CoplanarFaceBooleanExtrusionResult;
}
/** Rebuild native parent, actual primitive geometry/source chunks and the entire oriented incidence result. */
export function validateCoplanarFaceBooleanExtrusion(input: CoplanarFaceBooleanExtrusionResult): CoplanarFaceBooleanExtrusionReport {
  const owned = record(snapshot(input, CODE.OWNED), ['region', 'options', 'normal', 'translationMM', 'vertices', 'edges', 'faces', 'shells', 'sources', 'report'], CODE.OWNED) as unknown as CoplanarFaceBooleanExtrusionResult;
  let expected: CoplanarFaceBooleanExtrusionResult;
  try { expected = extrudeCoplanarFaceBoolean(owned.region, owned.options); } catch (cause) {
    throw new CoplanarFaceBooleanExtrusionError(CODE.OWNED, 'owned complete native parent/geometry/source/incidence/binding reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned native region/source/translation/geometry/UV/face/shell/orientation/incidence/work/report mismatch');
  return snapshot(expected.report, CODE.OWNED) as CoplanarFaceBooleanExtrusionReport;
}
