import { CadNumericPolicy } from './numeric-policy.js';
import { validateConvexPlanarFace } from './own-convex-planar-face.js';
import type { ConvexPlanarFaceResult } from './own-convex-planar-face.js';
import { buildAffinePlaneAxes, mapAffinePlanePointToUV, admitConvexNativeLineLoop } from './intersect/own-affine-plane-loop-internal.js';
import { evaluateCurve, evaluateSurface, validateCurve, curveDomain } from './math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import { extractCurveInterval } from './nurbs/curves/curve-interval-extraction.js';
import type { ExtractedCurveIntervalResult } from './nurbs/curves/curve-interval-extraction.js';
import { adopt } from './intersect/own-plane-cylinder-intersection-internal.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model, Point } from './types.js';
import { buildCoplanarArrangement } from './coplanar-face-boolean-arrangement.js';
import { same } from './structural-equality.js';

export const CoplanarFaceBooleanDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', SUPPORT: 'SUPPORT', CONTACT: 'CONTACT', UNCERTAINTY: 'UNCERTAINTY',
  REPRESENTABILITY: 'REPRESENTABILITY', BUDGET: 'BUDGET', INCIDENCE: 'INCIDENCE', NESTING: 'NESTING',
  NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type CoplanarFaceBooleanDiagnosticCode = typeof CoplanarFaceBooleanDiagnosticCode[keyof typeof CoplanarFaceBooleanDiagnosticCode];
export class CoplanarFaceBooleanError extends Error {
  readonly code: CoplanarFaceBooleanDiagnosticCode;
  constructor(code: CoplanarFaceBooleanDiagnosticCode, detail: string, cause?: unknown) {
    super(('Coplanar Face Boolean: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CoplanarFaceBooleanError'; this.code = code;
  }
}
export interface CoplanarFaceBooleanOptions {
  operation: 'union' | 'intersection' | 'difference'; evaluationId: string; resultIdPrefix: string;
  maximumPairTests: number; maximumFragments: number;
}
export interface CoplanarFaceBooleanContributor {
  operand: 'a' | 'b'; faceId: string; evaluationId: string; supportId: string; loopId: string;
  useId: string; edgeId: string; curveId: string; pcurveId: string; authoredEdgeIndex: number;
  originalUseSense: 'forward' | 'reverse'; authoredLoopOrientation: 'ccw' | 'cw'; originalFaceSense: 'forward' | 'reverse';
}
export interface CoplanarFaceBooleanEvent {
  id: string; vertexId: string; uv: Point; pointMM: Point;
  a: { contributor: CoplanarFaceBooleanContributor; fraction: number; parameter: number; uv: Point; nativeUV: Point; pointMM: Point };
  b: { contributor: CoplanarFaceBooleanContributor; fraction: number; parameter: number; uv: Point; nativeUV: Point; pointMM: Point };
  worldDifferenceMM: number; uvDifference: number;
  determinant: { denominator: number; numeratorA: number; numeratorB: number; denominatorThreshold: number;
    numeratorAThreshold: number; numeratorBThreshold: number; fractionMarginA: number; fractionMarginB: number };
}
interface BooleanVertex {
  id: string; uv: Point; pointMM: Point;
  contributors: { source: CoplanarFaceBooleanContributor; kind: 'original-vertex' | 'cross-event' | 'coincident-counterpart';
    originalVertexId: string | null; parameter: number; eventId: string | null }[];
}
export interface CoplanarFaceBooleanFragment {
  id: string; edgeId: string; useId: string; vertexIds: [string, string]; contributor: CoplanarFaceBooleanContributor;
  interval: [number, number]; traversalInterval: [number, number]; sense: 'forward' | 'reverse'; curve: Curve;
  extraction: ExtractedCurveIntervalResult;
  pcurve: { id: string; coordinateSystem: 'uv'; lengthUnit: 'dimensionless'; domain: [number, number]; curve: Curve };
  source: { assetId: string; curveId: string; objectIndex: number };
  endpointBindings: { vertexId: string; parameter: number; pointMM: Point; uv: Point; vertexDifferenceMM: number; uvDifference: number }[];
  observations: { parameter: number; originalPointMM: Point; pointMM: Point; uv: Point; planePointMM: Point;
    pointDifferenceMM: number; surfaceDifferenceMM: number; originalD1: CurveD1Result; curveD1: CurveD1Result;
    pcurveD1: CurveD1Result; surfaceD1: SurfaceD1Result; relativeD1Difference: number; relativeSurfaceD1Difference: number }[];
}
export interface CoplanarFaceBooleanLoop {
  id: string; role: 'outer' | 'hole'; orientation: 'ccw' | 'cw'; faceSense: 'forward'; componentId: string;
  vertexIds: string[]; fragmentIds: string[];
  uses: { id: string; edgeId: string; curveId: string; pcurveId: string; vertexIds: [string, string];
    interval: [number, number]; sense: 'forward' | 'reverse' }[];
  signedAreaUV: number; areaUncertaintyUV: number;
}
export interface CoplanarFaceBooleanComponent { id: string; supportId: string; outerLoopId: string; holeLoopIds: string[]; areaUV: number }
export interface CoplanarFaceBooleanReport {
  schema: 'barocss-native-coplanar-face-boolean'; version: 0; operation: 'union' | 'intersection' | 'difference'; evaluationId: string;
  lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion'; uvUnits: 'dimensionless'; representation: 'nonconvex-and-holed-planar-region-not-convex-face-or-solid';
  branch: 'proper-arrangement' | 'exact-full-coincidence'; pairTestCount: number; eventCount: number; arrangementVertexCount: number;
  arrangementFragmentCount: number; selectedFragmentCount: number; discardedFragmentCount: number;
  vertexCount: number; loopCount: number; componentCount: number; holeCount: number; sourceCount: number; areaUV: number;
  pairTests: { edgeA: number; edgeB: number; classification: 'crossing' | 'disjoint' | 'parallel-separated';
    denominator: number; numeratorA: number | null; numeratorB: number | null; fractionA: number | null; fractionB: number | null }[];
  selections: { arrangementIndex: number; contributor: CoplanarFaceBooleanContributor; interval: [number, number]; midpoint: number;
    midpointUV: Point; classification: 'inside' | 'outside' | 'coincident'; selected: boolean; sense: 'forward' | 'reverse'; fragmentId: string | null }[];
  coincidentCounterparts: { vertexA: number; vertexB: number; edgeA: number; edgeB: number }[];
  maximumEndpointDifferenceMM: number; maximumPointDifferenceMM: number; maximumRelativeD1Difference: number;
  incidenceValid: true; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { authority: 'qualified-original-native-plane-and-line-coefficients'; supportBitsCopiedExceptDerivedId: true;
    worldFragments: 'actual-native-original-parameter-interval-extraction-not-snapped';
    uvPcurves: 'dimensionless-native-curves-excluded-from-mm-source0'; vertices: 'qualified-original-or-edge-pair-events-no-close-coordinate-merging';
    loops: 'all-selected-cycles-outer-ccw-hole-cw-canonical-forward-face-sense'; sourceObjectLimitUnchanged: 16;
    uvAreaIsManufacturingArea: false; globalBinary64ErrorCertified: false; globalShapeErrorCertified: false;
    manufacturingToleranceCertified: false; brepNamingCertified: false; ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-region';
  limits: { maximumEdgesPerOperand: 8; maximumPairTests: 64; maximumFragments: 64; maximumEvents: 64; maximumLoops: 16;
    maximumComponents: 8; maximumHoles: 8; maximumSources: 5; maximumCurvesPerSource: 15; resultIdPrefixCharacters: 12;
    ownValues: 1048576; ownDepth: 40; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144;
    pointComparisonMM: 1e-7; relativeD1Comparison: 1e-7 };
}
export interface CoplanarFaceBooleanResult {
  faceA: ConvexPlanarFaceResult; faceB: ConvexPlanarFaceResult; options: CoplanarFaceBooleanOptions; support: Surface;
  vertices: BooleanVertex[]; events: CoplanarFaceBooleanEvent[]; fragments: CoplanarFaceBooleanFragment[];
  loops: CoplanarFaceBooleanLoop[]; components: CoplanarFaceBooleanComponent[];
  sources: { id: string; source: string; sourceVersion: 0; model: Model; supportId: string; fragmentIds: string[] }[];
  report: CoplanarFaceBooleanReport;
}

const CODE = CoplanarFaceBooleanDiagnosticCode;
const POINT_TOLERANCE = CadNumericPolicy.linearToleranceMM, D1_TOLERANCE = CadNumericPolicy.relativeComparison;
function check(condition: boolean, code: CoplanarFaceBooleanDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CoplanarFaceBooleanError(code, detail);
}
function native<T>(action: () => T, detail: string, code: CoplanarFaceBooleanDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CoplanarFaceBooleanError) throw cause;
    throw new CoplanarFaceBooleanError(code, detail, cause);
  }
}
/** Copy every occurrence; only ancestor cycles are refused, so caller aliases are never retained. */
function snapshot(input: unknown, code: CoplanarFaceBooleanDiagnosticCode = CODE.INPUT): unknown {
  let remaining = 1048576;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 40, code, 'own-value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, code, 'source string budget exceeded'); return value; }
    check(typeof value === 'object' && value !== null, code, 'plain own data required');
    check(!ancestors.has(value), code, 'ancestor cycles refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.length <= (array ? 8193 : 64) && keys.every(key => typeof key === 'string' && key.length <= 128
      && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)),
    code, 'getter/symbol/hidden/excess own fields refused');
    ancestors.add(value);
    try {
      if (array) {
        const length = descriptors.length.value as number;
        check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'dense bounded own array required');
        return Array.from({ length }, (_, i) => {
          check(Object.hasOwn(descriptors, String(i)), code, 'sparse or foreign own array field refused');
          return copy(descriptors[String(i)].value, depth + 1);
        });
      }
      return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    } finally { ancestors.delete(value); }
  };
  return copy(input, 0);
}
function record(input: unknown, fields: string[], code: CoplanarFaceBooleanDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required');
  const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(','));
  return data;
}
function id(value: unknown, maximum = 48): string {
  check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..' + maximum + ' required');
  return value;
}
function options(input: unknown): CoplanarFaceBooleanOptions {
  const data = record(input, ['operation', 'evaluationId', 'resultIdPrefix', 'maximumPairTests', 'maximumFragments']);
  check(data.operation === 'union' || data.operation === 'intersection' || data.operation === 'difference', CODE.INPUT, 'explicit native region operation required');
  for (const field of ['maximumPairTests', 'maximumFragments']) check(typeof data[field] === 'number' && Number.isInteger(data[field])
    && (data[field] as number) >= 1 && (data[field] as number) <= 64, CODE.BUDGET, 'integer ' + field + '1..64 required');
  return { operation: data.operation, evaluationId: id(data.evaluationId), resultIdPrefix: id(data.resultIdPrefix, 12),
    maximumPairTests: data.maximumPairTests as number, maximumFragments: data.maximumFragments as number };
}
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'finite native binding arithmetic required'); return value; }
function product(a: number, b: number): number {
  const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero native binding product underflow'); return value;
}
function distance(a: Point, b: Point): number { return finite(Math.hypot(...a.map((value, i) => finite(value - b[i])))); }
function relative(a: Point, b: Point): number { return finite(distance(a, b) / Math.max(1, finite(Math.hypot(...a)))); }
function boundedPoints(points: Point[], dimensionless: boolean): void {
  check(points.every(point => point.length === 3 && point.every(value => Number.isFinite(value) && Math.abs(value) <= 10000)
    && (!dimensionless || point[2] === 0)), CODE.INPUT, dimensionless ? 'original UV coordinates within10000 dimensionless required' : 'world coordinates within10000mm required');
}
function originalIds(face: ConvexPlanarFaceResult): string[] {
  return [face.plane.id, face.loop.id, face.options.faceId, face.options.evaluationId, face.model.name,
    ...face.model.objects.map(object => object.id), ...face.topology.vertices.map(vertex => vertex.id),
    ...face.topology.edges.flatMap(edge => [edge.id, edge.curveId, ...edge.vertexIds]),
    ...face.topology.loop.uses.flatMap(use => [use.id, use.edgeId, use.curveId, use.pcurveId, ...use.vertexIds]),
    ...face.pcurves.flatMap(pcurve => [pcurve.id, pcurve.edgeId, pcurve.curveId, pcurve.curve.id])];
}
function reserveRoles(faceA: ConvexPlanarFaceResult, faceB: ConvexPlanarFaceResult, admitted: CoplanarFaceBooleanOptions): (suffix: string) => string {
  const original = new Set([...originalIds(faceA), ...originalIds(faceB)]), generated = new Set<string>();
  const reserve = (value: string): void => { id(value); check(!original.has(value) && !generated.has(value), CODE.IDENTITY, 'derived role collides with an original or another derived role'); generated.add(value); };
  const role = (suffix: string): string => admitted.resultIdPrefix + suffix;
  reserve(admitted.evaluationId); reserve(role('_support'));
  for (let i = 0; i < 8; i++) { reserve(role('_v_a_' + i)); reserve(role('_v_b_' + i)); reserve(role('_comp_' + i)); }
  for (let i = 0; i < 64; i++) {
    for (const stem of ['_ev_', '_v_x_', '_f_', '_e_', '_use_', '_c_', '_uv_']) reserve(role(stem + i));
    const prefix = id(role('_xf_' + i), 20);
    for (const cut of ['_cut_0_lo', '_cut_0_hi', '_cut_1_lo', '_cut_1_hi']) reserve(prefix + cut);
  }
  for (let i = 0; i < 16; i++) reserve(role('_loop_' + i));
  for (let i = 0; i < 5; i++) reserve(role('_src_' + i));
  return role;
}

/** Qualified native Lines produce a separate, possibly nonconvex/holed planar region. */
export function booleanCoplanarFaces(faceAInput: ConvexPlanarFaceResult, faceBInput: ConvexPlanarFaceResult,
  inputOptions: CoplanarFaceBooleanOptions): CoplanarFaceBooleanResult {
  const copied = record(snapshot({ faceA: faceAInput, faceB: faceBInput, options: inputOptions }), ['faceA', 'faceB', 'options']);
  const faceA = copied.faceA as ConvexPlanarFaceResult, faceB = copied.faceB as ConvexPlanarFaceResult, admitted = options(copied.options);
  native(() => validateConvexPlanarFace(faceA), 'complete original operand a native face admission', CODE.INPUT);
  native(() => validateConvexPlanarFace(faceB), 'complete original operand b native face admission', CODE.INPUT);
  const { id: ignoredA, ...geometryA } = faceA.plane, { id: ignoredB, ...geometryB } = faceB.plane;
  void ignoredA; void ignoredB;
  check(same(geometryA, geometryB), CODE.SUPPORT, 'both original native Plane charts/coefficients/domains/weights must match except IDs');
  const role = reserveRoles(faceA, faceB, admitted), support: Surface = { ...copyCadData(faceA.plane), id: role('_support') };
  boundedPoints(support.controlPoints.flat(), false);
  const axes = native(() => buildAffinePlaneAxes(support), 'actual shared original affine support admission', CODE.SUPPORT);
  for (const face of [faceA, faceB]) {
    for (const edge of face.loop.edges) {
      boundedPoints(edge.controlPoints, false);
      const domain = native(() => curveDomain(edge), 'original native Line domain');
      check(domain[1] > domain[0] && Number.isFinite(domain[1] - domain[0]), CODE.REPRESENTABILITY, 'finite positive original native Line domain required');
      for (const point of edge.controlPoints) boundedPoints([native(() => mapAffinePlanePointToUV(point, axes), 'actual original native affine chart mapping')], true);
    }
    for (const pcurve of face.pcurves) boundedPoints(pcurve.curve.controlPoints, true);
  }
  const admissions = [native(() => admitConvexNativeLineLoop(faceA.loop.edges, axes, 'Coplanar face Boolean', support), 'original a native convex Line loop', CODE.INPUT),
    native(() => admitConvexNativeLineLoop(faceB.loop.edges, axes, 'Coplanar face Boolean', support), 'original b native convex Line loop', CODE.INPUT)] as const;
  const arrangement = buildCoplanarArrangement(faceA, faceB, support, [admissions[0], admissions[1]], admitted, role, check, native);
  let maximumEndpointDifferenceMM = 0, maximumPointDifferenceMM = 0, maximumRelativeD1Difference = 0;
  const fragments: CoplanarFaceBooleanFragment[] = arrangement.fragments.map(plan => {
    const i = plan.selectedIndex, curveId = role('_c_' + i), pcurveId = role('_uv_' + i);
    const extraction = native(() => extractCurveInterval(plan.source, { curveId, interval: copyCadData(plan.interval), resultIdPrefix: role('_xf_' + i) }),
      'actual original Line interval extraction');
    const curve = extraction.curve, interval = native(() => curveDomain(curve), 'actual extracted native interval');
    check(same(interval, plan.interval) && curve.degree === 1 && curve.controlPoints.length === 2, CODE.BINDING,
      'actual extracted original native Line interval and two-pole profile must bind');
    const uvEndpoints = interval.map(parameter => native(() => evaluateCurve(plan.originalPcurve, parameter), 'actual original dimensionless pcurve endpoint')) as [Point, Point];
    const pcurve: Curve = { kind: 'curve', id: pcurveId, degree: 1, knots: [interval[0], interval[0], interval[1], interval[1]],
      controlPoints: uvEndpoints, weights: copyCadData(plan.originalPcurve.weights) };
    boundedPoints(pcurve.controlPoints, true);
    native(() => validateCurve(pcurve), 'actual derived dimensionless native pcurve validation');
    const middle = finite(interval[0] + product(finite(interval[1] - interval[0]), .5));
    check(middle > interval[0] && middle < interval[1], CODE.REPRESENTABILITY, 'strict native observation midpoint required');
    const observations: CoplanarFaceBooleanFragment['observations'] = [interval[0], middle, interval[1]].map(parameter => {
      const originalPointMM = native(() => evaluateCurve(plan.source, parameter), 'actual original native Line point');
      const pointMM = native(() => evaluateCurve(curve, parameter), 'actual extracted native Line point');
      const uv = native(() => evaluateCurve(pcurve, parameter), 'actual derived dimensionless pcurve point');
      const planePointMM = native(() => evaluateSurface(support, uv[0], uv[1]), 'actual native support point binding');
      const originalD1 = native(() => evaluateCurveD1(plan.source, parameter), 'actual original native Line D1');
      const curveD1 = native(() => evaluateCurveD1(curve, parameter), 'actual extracted native Line D1');
      const pcurveD1 = native(() => evaluateCurveD1(pcurve, parameter), 'actual dimensionless native pcurve D1');
      const surfaceD1 = native(() => evaluateSurfaceD1(support, uv[0], uv[1]), 'actual native affine support D1');
      const chain = surfaceD1.du.map((value, axis) => finite(product(value, pcurveD1.derivative[0]) + product(surfaceD1.dv[axis], pcurveD1.derivative[1]))) as Point;
      const pointDifferenceMM = distance(originalPointMM, pointMM), surfaceDifferenceMM = distance(pointMM, planePointMM);
      const relativeD1Difference = relative(originalD1.derivative, curveD1.derivative), relativeSurfaceD1Difference = relative(curveD1.derivative, chain);
      check(pointDifferenceMM <= POINT_TOLERANCE && surfaceDifferenceMM <= POINT_TOLERANCE, CODE.BINDING, 'actual original/extracted/UV-support point binding exceeds1e-7mm');
      check(relativeD1Difference <= D1_TOLERANCE && relativeSurfaceD1Difference <= D1_TOLERANCE, CODE.BINDING, 'actual native original/extracted/Surface-pcurve D1 binding exceeds1e-7 relative');
      maximumPointDifferenceMM = Math.max(maximumPointDifferenceMM, pointDifferenceMM, surfaceDifferenceMM);
      maximumRelativeD1Difference = Math.max(maximumRelativeD1Difference, relativeD1Difference, relativeSurfaceD1Difference);
      return { parameter, originalPointMM, pointMM, uv, planePointMM, pointDifferenceMM, surfaceDifferenceMM,
        originalD1, curveD1, pcurveD1, surfaceD1, relativeD1Difference, relativeSurfaceD1Difference };
    });
    const traversalInterval: [number, number] = plan.sense === 'forward' ? [interval[0], interval[1]] : [interval[1], interval[0]];
    const endpointBindings = plan.vertexIds.map((vertexId, endpoint) => {
      const vertex = arrangement.vertices.find(vertex => vertex.id === vertexId);
      check(vertex !== undefined, CODE.INCIDENCE, 'selected native endpoint vertex required');
      const parameter = traversalInterval[endpoint], sample = observations[parameter === interval[0] ? 0 : 2];
      const vertexDifferenceMM = distance(sample.pointMM, vertex.pointMM), uvDifference = distance(sample.uv, vertex.uv);
      const vertexSurface = native(() => evaluateSurface(support, vertex.uv[0], vertex.uv[1]), 'actual shared vertex UV/support endpoint binding');
      check(vertexDifferenceMM <= POINT_TOLERANCE && distance(sample.planePointMM, vertexSurface) <= POINT_TOLERANCE,
        CODE.BINDING, 'unsnapped directed native endpoint/shared vertex binding exceeds1e-7mm');
      maximumEndpointDifferenceMM = Math.max(maximumEndpointDifferenceMM, vertexDifferenceMM, distance(sample.planePointMM, vertexSurface));
      return { vertexId, parameter, pointMM: sample.pointMM, uv: sample.uv, vertexDifferenceMM, uvDifference };
    });
    return { id: role('_f_' + i), edgeId: role('_e_' + i), useId: role('_use_' + i), vertexIds: copyCadData(plan.vertexIds),
      contributor: plan.contributor, interval, traversalInterval, sense: plan.sense, curve, extraction,
      pcurve: { id: pcurveId, coordinateSystem: 'uv', lengthUnit: 'dimensionless', domain: interval, curve: pcurve },
      source: { assetId: role('_src_' + Math.floor(i / 15)), curveId, objectIndex: i % 15 + 1 }, endpointBindings, observations };
  });
  // Only WORLD geometry is compiled. Each independent Source0 chunk repeats the exact derived support.
  const sources: CoplanarFaceBooleanResult['sources'] = [];
  const sourceCount = Math.max(1, Math.ceil(fragments.length / 15));
  check(sourceCount <= 5, CODE.BUDGET, 'world Source0 asset capacity exceeded');
  for (let i = 0; i < sourceCount; i++) {
    const id = role('_src_' + i), chunk = fragments.slice(i * 15, (i + 1) * 15);
    const expected: Model = { name: id, version: 0, lengthUnit: 'mm', objects: [support, ...chunk.map(fragment => fragment.curve)] };
    const file = native(() => adopt(expected), 'actual complete world support/fragment Source0 compilation and bit binding');
    check(file.source.length <= 262144, CODE.BUDGET, 'world source string budget exceeded');
    check(same(file.model, expected), CODE.BINDING, 'complete world source/model/order/domain/sign-bit adoption required');
    sources.push({ id, source: file.source, sourceVersion: 0, model: file.model, supportId: support.id, fragmentIds: chunk.map(fragment => fragment.id) });
    for (const [index, fragment] of chunk.entries()) check(fragment.source.assetId === id && fragment.source.objectIndex === index + 1
      && same(file.model.objects[index + 1], fragment.curve), CODE.BINDING, 'actual fragment asset/curve/object mapping required');
  }
  const loops: CoplanarFaceBooleanLoop[] = arrangement.loops.map((plan, i) => ({ id: role('_loop_' + i), role: plan.role,
    orientation: plan.role === 'outer' ? 'ccw' : 'cw', faceSense: 'forward', componentId: role('_comp_' + plan.componentIndex),
    vertexIds: plan.vertexIds, fragmentIds: plan.fragmentIndices.map(index => fragments[index].id),
    uses: plan.fragmentIndices.map(index => {
      const fragment = fragments[index];
      return { id: fragment.useId, edgeId: fragment.edgeId, curveId: fragment.curve.id, pcurveId: fragment.pcurve.id,
        vertexIds: fragment.vertexIds, interval: fragment.traversalInterval, sense: fragment.sense };
    }), signedAreaUV: plan.signedAreaUV, areaUncertaintyUV: plan.areaUncertaintyUV }));
  const components: CoplanarFaceBooleanComponent[] = arrangement.components.map((plan, i) => ({ id: role('_comp_' + i), supportId: support.id,
    outerLoopId: loops[plan.outerLoopIndex].id, holeLoopIds: plan.holeLoopIndices.map(index => loops[index].id), areaUV: plan.areaUV }));
  const areaUV = components.reduce((sum, component) => finite(sum + component.areaUV), 0);
  const report: CoplanarFaceBooleanReport = {
    schema: 'barocss-native-coplanar-face-boolean', version: 0, operation: admitted.operation, evaluationId: admitted.evaluationId,
    lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion', uvUnits: 'dimensionless', representation: 'nonconvex-and-holed-planar-region-not-convex-face-or-solid',
    branch: arrangement.branch, pairTestCount: arrangement.pairTests.length, eventCount: arrangement.events.length,
    arrangementVertexCount: arrangement.arrangementVertexCount, arrangementFragmentCount: arrangement.arrangementFragmentCount,
    selectedFragmentCount: fragments.length, discardedFragmentCount: arrangement.arrangementFragmentCount - fragments.length,
    vertexCount: arrangement.vertices.length, loopCount: loops.length, componentCount: components.length,
    holeCount: loops.filter(loop => loop.role === 'hole').length, sourceCount: sources.length, areaUV,
    pairTests: arrangement.pairTests, selections: arrangement.selections, coincidentCounterparts: arrangement.coincidentCounterparts,
    maximumEndpointDifferenceMM, maximumPointDifferenceMM, maximumRelativeD1Difference,
    incidenceValid: true, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { authority: 'qualified-original-native-plane-and-line-coefficients', supportBitsCopiedExceptDerivedId: true,
      worldFragments: 'actual-native-original-parameter-interval-extraction-not-snapped', uvPcurves: 'dimensionless-native-curves-excluded-from-mm-source0',
      vertices: 'qualified-original-or-edge-pair-events-no-close-coordinate-merging', loops: 'all-selected-cycles-outer-ccw-hole-cw-canonical-forward-face-sense',
      sourceObjectLimitUnchanged: 16, uvAreaIsManufacturingArea: false, globalBinary64ErrorCertified: false, globalShapeErrorCertified: false,
      manufacturingToleranceCertified: false, brepNamingCertified: false, ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    budgetFailure: 'atomic-refusal-no-partial-region', limits: { maximumEdgesPerOperand: 8, maximumPairTests: 64, maximumFragments: 64,
      maximumEvents: 64, maximumLoops: 16, maximumComponents: 8, maximumHoles: 8, maximumSources: 5, maximumCurvesPerSource: 15,
      resultIdPrefixCharacters: 12, ownValues: 1048576, ownDepth: 40, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144,
      pointComparisonMM: 1e-7, relativeD1Comparison: 1e-7 },
  };
  return snapshot({ faceA, faceB, options: admitted, support, vertices: arrangement.vertices, events: arrangement.events,
    fragments, loops, components, sources, report }) as CoplanarFaceBooleanResult;
}
/** Full reconstruction includes discarded arrangement evidence and every native extraction/Source0 asset. */
export function validateCoplanarFaceBoolean(input: CoplanarFaceBooleanResult): CoplanarFaceBooleanReport {
  const owned = record(snapshot(input, CODE.OWNED), ['faceA', 'faceB', 'options', 'support', 'vertices', 'events', 'fragments', 'loops', 'components', 'sources', 'report'],
    CODE.OWNED) as unknown as CoplanarFaceBooleanResult;
  let expected: CoplanarFaceBooleanResult;
  try { expected = booleanCoplanarFaces(owned.faceA, owned.faceB, owned.options); } catch (cause) {
    throw new CoplanarFaceBooleanError(CODE.OWNED, 'owned complete original/arrangement/native source rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned original/support/selection/vertices/fragment/extraction/pcurve/source/loops/components/binding/report mismatch');
  return snapshot(expected.report, CODE.OWNED) as CoplanarFaceBooleanReport;
}
