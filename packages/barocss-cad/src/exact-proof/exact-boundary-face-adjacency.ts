import { compileCadModel } from '../model-compiler.js';
import { validateFaceBundle } from '../core/face.js';
import type { FaceBundle, FaceUse, UV } from '../core/face.js';
import { extractSurfaceBoundary } from '../core/boundary.js';
import type { SurfaceBoundary } from '../core/boundary.js';
import { reverseCurve } from '../nurbs/curves/curve-reversal.js';
import type { ReversedCurveResult, CurveReversalProvenance } from '../nurbs/curves/curve-reversal.js';
import { evaluateCurve, curveDomain } from '../core/math.js';
import { evaluateCurveD1 } from '../core/derivatives.js';
import type { CurveD1Result } from '../core/derivatives.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Surface, Point } from '../types.js';
import { same } from '../core/structural-equality.js';

export const ExactBoundaryFaceAdjacencyDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', BUDGET: 'BUDGET', IDENTITY: 'IDENTITY', BASIS: 'BASIS', ORIENTATION: 'ORIENTATION', BINDING: 'BINDING', NATIVE: 'NATIVE', OWNED: 'OWNED',
} as const);
export type ExactBoundaryFaceAdjacencyDiagnosticCode = typeof ExactBoundaryFaceAdjacencyDiagnosticCode[keyof typeof ExactBoundaryFaceAdjacencyDiagnosticCode];
export class ExactBoundaryFaceAdjacencyError extends Error {
  readonly code: ExactBoundaryFaceAdjacencyDiagnosticCode;
  constructor(code: ExactBoundaryFaceAdjacencyDiagnosticCode, detail: string, cause?: unknown) {
    super(('Exact boundary Face adjacency: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'ExactBoundaryFaceAdjacencyError'; this.code = code;
  }
}
export interface ExactBoundaryFaceAdjacencyAsset { sourceId: string; source: string; face: FaceBundle }
type Selector = { sourceId: string; boundary: SurfaceBoundary };
export interface ExactBoundaryFaceAdjacencyPair { first: Selector; second: Selector }
export interface ExactBoundaryFaceAdjacencyOptions {
  evaluationId: string; resultIdPrefix: string; maximumCurveReversals: number; maximumObservationPairs: number;
}
type QualifiedUse = { sourceId: string; faceId: string; surfaceId: string; loopId: string; boundary: SurfaceBoundary; useIndex: number;
  edgeId: string; curveId: string; vertexIds: [string, string]; pcurve: FaceUse['pcurve']; originalSense: 'forward' };
type CurveReference = { sourceId: string; faceId: string; edgeId: string; curveId: string };
type VertexReference = { sourceId: string; faceId: string; vertexId: string; pointMM: Point };
type VertexClass = { id: string; representative: VertexReference; members: VertexReference[] };
type DerivedUse = QualifiedUse & { effectiveSense: 'forward' | 'reverse'; parameterMap:
  { kind: 'identity'; domain: [number, number]; formula: 'u=t'; orientation: 1; d1Factor: 1 }
  | { kind: 'reversed'; domain: [number, number]; native: CurveReversalProvenance['decreasingParameterMap'] } };
type Observation = { index: number; canonicalParameter: number; secondParameter: number;
  first: { reference: QualifiedUse; curveD0: Point; curveD1: CurveD1Result; nativeUV: UV };
  second: { reference: QualifiedUse; curveD0: Point; curveD1: CurveD1Result; nativeUV: UV };
  expectedSecondDerivativeMM: Point; pointDifferenceMM: number; derivativeDifferenceMM: number; relativeDerivativeDifference: number;
  endpointVertices: [VertexReference, VertexReference] | null; endpointPointDifferenceMM: [number, number] | null };
export interface ExactBoundaryFaceAdjacencyEdge {
  id: string; canonical: CurveReference; uses: [DerivedUse, DerivedUse]; reversal: ReversedCurveResult;
  endpointClassIds: [string, string]; observations: [Observation, Observation, Observation];
}
export interface ExactBoundaryFaceAdjacencyReport {
  schema: 'barocss-exact-boundary-face-adjacency'; version: 0; evaluationId: string; lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion';
  parameterFrame: 'unchanged-native-face-pcurves-and-actual-reversal-map'; pairs: ExactBoundaryFaceAdjacencyPair[];
  assetCount: number; pairCount: number; sharedEdgeCount: number; freeBoundaryCount: number; vertexClassCount: number;
  curveReversalCount: number; observationPairCount: number; curvePointEvaluationCount: number; curveDerivativeEvaluationCount: number;
  sourceCompilationCount: number; faceValidationCount: number; boundaryExtractionCount: number;
  qualifications: { sourceId: string; modelName: string; faceId: string; surfaceId: string; loopId: string;
    edgeIds: string[]; curveIds: string[]; vertexIds: string[] }[];
  numericPolicy: { coefficients: 'whole-kind-degree-domain-knot-pole-weight-object-is-excluding-only-curve-id';
    orientation: 'native-first-forward-second-reverse-no-parent-face-flip'; endpoints: 'explicit-opposite-qualified-vertex-pairs-with-object-is-point-bits';
    pointComparisonMM: 1e-7; relativeD1Comparison: 1e-7; sameDirection: 'refused';
    reversal: 'actual672-on-second-boundary-once-no-double-reversal-assumption';
    sourceBinding: 'actual-source0-whole-model-object-is-before-native511-validation' };
  sourceOwnership: 'separate-source-model5-per-asset-and-actual-reversal-model1-no-original-rewriting';
  quality: { localIncidenceOnly: true; geometricValidity: 'not-certified'; closed: false; solid: false; weldingPerformed: false;
    manifoldCertified: false; supportRegularityCertified: false; continuityCertified: false; globalBinary64ErrorCertified: false;
    ownership: 'independent-copied-cpu-data-gc' };
  workScope: 'direct-new-compile-face-boundary-reversal-and-observation-calls-parent-internal-work-excluded'; budgetFailure: 'atomic-no-partial-incidence';
  limits: { maximumAssets: 4; maximumPairs: 8; maximumCurveReversals: 8; maximumObservationPairs: 24; maximumSurfaceDegree: 3;
    maximumGridAxis: 16; maximumSurfacePoles: 256; maximumBoundaryPoles: 16; coordinateAbsMM: 10000;
    ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface ExactBoundaryFaceAdjacencyResult {
  assets: ExactBoundaryFaceAdjacencyAsset[]; options: ExactBoundaryFaceAdjacencyOptions; sharedEdges: ExactBoundaryFaceAdjacencyEdge[];
  vertexClasses: VertexClass[]; freeBoundaries: QualifiedUse[]; report: ExactBoundaryFaceAdjacencyReport;
}

const CODE = ExactBoundaryFaceAdjacencyDiagnosticCode, ORDER: SurfaceBoundary[] = ['v-min', 'u-max', 'v-max', 'u-min'];
function check(condition: boolean, code: ExactBoundaryFaceAdjacencyDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new ExactBoundaryFaceAdjacencyError(code, detail);
}
function native<T>(action: () => T, detail: string): T {
  try { return action(); } catch (cause) { throw new ExactBoundaryFaceAdjacencyError(CODE.NATIVE, detail, cause); }
}
function finite(value: number): number { check(Number.isFinite(value), CODE.BINDING, 'Finite native correspondence arithmetic is required'); return value; }
function snapshot(input: unknown, code: ExactBoundaryFaceAdjacencyDiagnosticCode): unknown {
  let remaining = 1048576; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, code, 'Own value or depth limit exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numbers are required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, code, 'Own source string limit exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic plain own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required');
    check(keys.length <= (array ? 8193 : 64), code, 'Own field limit exceeded');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Getter, symbol, or hidden fields are refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded own arrays are required');
      result = Array.from({ length }, (_, index) => { check(Object.hasOwn(descriptors, String(index)), code, 'Sparse or extra own array fields are refused'); return copy(descriptors[String(index)].value, depth + 1); });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  try { return copy(input, 0); } catch (cause) {
    if (cause instanceof ExactBoundaryFaceAdjacencyError) throw cause;
    throw new ExactBoundaryFaceAdjacencyError(code, 'Own-data snapshot failed', cause);
  }
}
function record(value: unknown, fields: string[], code: ExactBoundaryFaceAdjacencyDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own record is required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data;
}
function id(value: unknown, maximum = 48): string {
  check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'A bounded ASCII identifier is required'); return value;
}
function coefficients(curve: Curve): Omit<Curve, 'id'> {
  return { kind: curve.kind, degree: curve.degree, knots: curve.knots, controlPoints: curve.controlPoints, weights: curve.weights };
}
function selector(value: unknown): Selector {
  const data = record(value, ['sourceId', 'boundary']); id(data.sourceId);
  check(ORDER.includes(data.boundary as SurfaceBoundary), CODE.INPUT, 'An actual native boundary selector is required'); return data as unknown as Selector;
}
function qualified(asset: ExactBoundaryFaceAdjacencyAsset, useIndex: number): QualifiedUse {
  const { topology, geometry } = asset.face, edge = topology.edges[useIndex], use = topology.loop.uses[useIndex];
  return { sourceId: asset.sourceId, faceId: topology.face.id, surfaceId: (geometry.objects[0] as Surface).id,
    loopId: topology.loop.id, boundary: use.boundary, useIndex, edgeId: edge.id, curveId: edge.curveId,
    vertexIds: edge.vertexIds, pcurve: use.pcurve, originalSense: use.sense };
}
function key(reference: { sourceId: string; vertexId: string }): string { return reference.sourceId + ':' + reference.vertexId; }
function boundaryKey(reference: Selector): string { return reference.sourceId + ':' + reference.boundary; }
function distance(a: Point, b: Point): number { return finite(Math.hypot(...a.map((value, axis) => finite(value - b[axis])))); }
function mappedParameter(reversal: ReversedCurveResult, parameter: number): number {
  const [a, b] = reversal.provenance.domain, map = reversal.provenance.decreasingParameterMap;
  if (Object.is(parameter, map.endpointAssignments.reversedStart.reversed)) return map.endpointAssignments.reversedStart.original;
  if (Object.is(parameter, map.endpointAssignments.reversedEnd.reversed)) return map.endpointAssignments.reversedEnd.original;
  const offset = finite(b - parameter), result = finite(a + offset);
  check(offset > 0 && offset < finite(b - a) && result > a && result < b, CODE.BINDING, 'Actual reversal map has no represented original interior parameter'); return result;
}
function uvAt(use: QualifiedUse, parameter: number): UV {
  const [a, b] = use.pcurve.domain;
  if (Object.is(parameter, a)) return copyCadData(use.pcurve.uv0);
  if (Object.is(parameter, b)) return copyCadData(use.pcurve.uv1);
  const fraction = finite(finite(parameter - a) / finite(b - a));
  check(fraction > 0 && fraction < 1, CODE.BINDING, 'Original pcurve interpolation has no represented interior fraction');
  return use.pcurve.uv0.map((value, axis) => finite(finite((1 - fraction) * value) + finite(fraction * use.pcurve.uv1[axis]))) as UV;
}

/** Add only explicitly paired, exact opposite whole-boundary incidence to qualified original Faces. */
export function buildExactBoundaryFaceAdjacency(assetsInput: ExactBoundaryFaceAdjacencyAsset[], pairsInput: ExactBoundaryFaceAdjacencyPair[],
  optionsInput: ExactBoundaryFaceAdjacencyOptions): ExactBoundaryFaceAdjacencyResult {
  const assetData = snapshot(assetsInput, CODE.INPUT), pairData = snapshot(pairsInput, CODE.INPUT);
  const data = record(snapshot(optionsInput, CODE.INPUT), ['evaluationId', 'resultIdPrefix', 'maximumCurveReversals', 'maximumObservationPairs']);
  check(Array.isArray(assetData) && assetData.length >= 2 && assetData.length <= 4, CODE.INPUT, 'Exactly2..4 explicit source-qualified Face assets are required');
  check(Array.isArray(pairData) && pairData.length <= 8, CODE.INPUT, 'At most8 explicit boundary pairs are allowed');
  const options: ExactBoundaryFaceAdjacencyOptions = { evaluationId: id(data.evaluationId), resultIdPrefix: id(data.resultIdPrefix, 8),
    maximumCurveReversals: data.maximumCurveReversals as number, maximumObservationPairs: data.maximumObservationPairs as number };
  for (const [field, maximum] of [['maximumCurveReversals', 8], ['maximumObservationPairs', 24]] as const)
    check(typeof data[field] === 'number' && Number.isInteger(data[field]) && data[field] >= 0 && data[field] <= maximum, CODE.BUDGET, 'Integer complete reversal and observation budgets are required');
  const sourceIds = new Set<string>();
  let sourceCompilationCount = 0, faceValidationCount = 0, boundaryExtractionCount = 0;
  const assets: ExactBoundaryFaceAdjacencyAsset[] = assetData.map(value => {
    const asset = record(value, ['sourceId', 'source', 'face']) as unknown as ExactBoundaryFaceAdjacencyAsset;
    id(asset.sourceId); check(!sourceIds.has(asset.sourceId), CODE.IDENTITY, 'Asset source IDs must be unique'); sourceIds.add(asset.sourceId);
    check(typeof asset.source === 'string' && asset.source.length <= 262144, CODE.INPUT, 'An actual bounded original Source0 string is required');
    record(asset.face, ['geometry', 'topology']);
    const compiled = native(() => compileCadModel(asset.source, { sourceVersion: 0 }), 'Actual Source0 compilation failed for asset ' + asset.sourceId); sourceCompilationCount++;
    if (!compiled.ok) throw new ExactBoundaryFaceAdjacencyError(CODE.NATIVE, 'Actual Source0 must compile for asset ' + asset.sourceId, compiled);
    check(same(compiled.model, asset.face.geometry), CODE.BINDING, 'Actual Source0 whole model bits differ from Face geometry for asset ' + asset.sourceId);
    native(() => validateFaceBundle(asset.face), 'Actual511 Face validation failed for asset ' + asset.sourceId); faceValidationCount++;
    const surface = asset.face.geometry.objects[0] as Surface;
    check(surface.degreeU <= 3 && surface.degreeV <= 3 && surface.controlPoints.every(row => row.every(point => point.every(coordinate => Math.abs(coordinate) <= 10000))),
      CODE.INPUT, 'New adjacency supports only native degree1..3/XYZ10000 Face patches');
    for (const value of [surface.id, asset.face.topology.face.id, asset.face.topology.loop.id,
      ...asset.face.topology.vertices.map(vertex => vertex.id), ...asset.face.topology.edges.flatMap(edge => [edge.id, edge.curveId])]) id(value);
    return asset;
  });
  const bySource = new Map(assets.map(asset => [asset.sourceId, asset]));
  const selected = new Set<string>();
  const pairs: ExactBoundaryFaceAdjacencyPair[] = pairData.map(value => {
    const pair = record(value, ['first', 'second']), first = selector(pair.first), second = selector(pair.second);
    check(first.sourceId !== second.sourceId && bySource.has(first.sourceId) && bySource.has(second.sourceId), CODE.IDENTITY, 'Each pair must select two different current assets');
    for (const reference of [first, second]) { const value = boundaryKey(reference); check(!selected.has(value), CODE.IDENTITY, 'A qualified boundary may appear in only one pair; repeated or third uses are refused'); selected.add(value); }
    return { first, second };
  });
  check(pairs.length <= options.maximumCurveReversals && 3 * pairs.length <= options.maximumObservationPairs, CODE.BUDGET,
    'Complete one-reversal/three-observation-pairs work per pair must be admitted before any new child');
  const contexts = new Set(assets.flatMap(asset => [asset.sourceId, asset.face.geometry.name,
    ...asset.face.geometry.objects.map(object => object.id), asset.face.topology.face.id, asset.face.topology.loop.id,
    ...asset.face.topology.vertices.map(vertex => vertex.id), ...asset.face.topology.edges.map(edge => edge.id)]));
  contexts.add('curve_reverse_original');
  check(!contexts.has(options.evaluationId), CODE.IDENTITY, 'Graph evaluation ID must differ from current original contexts'); contexts.add(options.evaluationId);
  const edgeIds = pairs.map((_, index) => id(options.resultIdPrefix + '_e' + index)), reversalIds = pairs.map((_, index) => id(options.resultIdPrefix + '_r' + index));
  const classIds = Array.from({ length: 4 * assets.length }, (_, index) => id(options.resultIdPrefix + '_v' + index));
  for (const value of [...edgeIds, ...reversalIds, ...classIds]) { check(!contexts.has(value), CODE.IDENTITY, 'All graph and comparison output IDs must be reserved before child work'); contexts.add(value); }
  const vertices: VertexReference[] = assets.flatMap(asset => asset.face.topology.vertices.map(vertex => ({ sourceId: asset.sourceId,
    faceId: asset.face.topology.face.id, vertexId: vertex.id, pointMM: vertex.point })));
  const vertexIndex = new Map(vertices.map((vertex, index) => [key(vertex), index]));
  const parents = vertices.map((_, index) => index);
  const root = (index: number): number => { while (parents[index] !== index) index = parents[index]; return index; };
  const join = (first: VertexReference, second: VertexReference) => {
    check(same(first.pointMM, second.pointMM), CODE.BINDING, 'Explicit opposite endpoint Face vertex XYZ bits do not agree');
    const firstIndex = vertexIndex.get(key(first)), secondIndex = vertexIndex.get(key(second));
    check(firstIndex !== undefined && secondIndex !== undefined, CODE.BINDING, 'Actual qualified endpoint vertex IDs are required');
    const a = root(firstIndex), b = root(secondIndex);
    if (a === b) return;
    const members = vertices.filter((_, index) => root(index) === a || root(index) === b), memberSources = members.map(member => member.sourceId);
    check(new Set(memberSources).size === memberSources.length, CODE.BINDING, 'An endpoint class cannot identify two distinct vertices within one original source Face');
    parents[Math.max(a, b)] = Math.min(a, b);
  };
  const plans = pairs.map(pair => {
    const resolve = (selection: Selector) => {
      const asset = bySource.get(selection.sourceId)!; const useIndex = ORDER.indexOf(selection.boundary), reference = qualified(asset, useIndex);
      const curve = asset.face.geometry.objects[useIndex + 1] as Curve, surface = asset.face.geometry.objects[0] as Surface;
      const expected = native(() => extractSurfaceBoundary(surface, { boundary: selection.boundary, id: curve.id }), 'Actual509 selected boundary extraction failed'); boundaryExtractionCount++;
      check(same(curve, expected) && reference.edgeId === asset.face.topology.loop.uses[useIndex].edgeId && reference.curveId === curve.id,
        CODE.BINDING, 'Selected actual boundary must retain exact coefficients, IDs and original edge/use relation');
      const endpointVertices = reference.vertexIds.map(vertexId => { const index = vertexIndex.get(key({ sourceId: asset.sourceId, vertexId }));
        check(index !== undefined, CODE.BINDING, 'Selected original Face endpoint is not qualified'); return vertices[index]; }) as [VertexReference, VertexReference];
      return { curve, reference, endpointVertices };
    };
    const first = resolve(pair.first), second = resolve(pair.second);
    check(!same(coefficients(first.curve), coefficients(second.curve)), CODE.ORIENTATION, 'Identical same-direction native boundaries cannot pretend opposite Face traversal');
    check(first.curve.degree === second.curve.degree && same(curveDomain(first.curve), curveDomain(second.curve)), CODE.BASIS, 'Whole boundary degrees and original domain endpoint bits must match');
    join(first.endpointVertices[0], second.endpointVertices[1]); join(first.endpointVertices[1], second.endpointVertices[0]);
    return { first, second };
  });
  const vertexClasses: VertexClass[] = [];
  const classByRoot = new Map<number, string>();
  for (const [index] of vertices.entries()) {
    const representativeIndex = root(index);
    if (classByRoot.has(representativeIndex)) continue;
    const id = classIds[vertexClasses.length]; classByRoot.set(representativeIndex, id);
    vertexClasses.push({ id, representative: vertices[representativeIndex], members: vertices.filter((_, index) => root(index) === representativeIndex) });
  }
  let curveReversalCount = 0, observationPairCount = 0, curvePointEvaluationCount = 0, curveDerivativeEvaluationCount = 0;
  const sharedEdges: ExactBoundaryFaceAdjacencyEdge[] = plans.map((plan, pairIndex): ExactBoundaryFaceAdjacencyEdge => {
    const context = 'Pair ' + pairIndex, reversal = native(() => reverseCurve(plan.second.curve, { curveId: reversalIds[pairIndex] }), context + ': actual672 second boundary reversal failed'); curveReversalCount++;
    check(same(reversal.original, plan.second.curve) && same(coefficients(reversal.curve), coefficients(plan.first.curve))
      && same(curveDomain(reversal.curve), curveDomain(plan.first.curve)), CODE.BASIS, context + ': whole reversed second degree, domain, knots, control or weight bits differ from canonical first');
    const domain = curveDomain(plan.first.curve), midpoint = finite(domain[0] + finite(domain[1] - domain[0]) / 2);
    check(midpoint > domain[0] && midpoint < domain[1], CODE.BINDING, context + ': canonical midpoint is not represented');
    const observations = [domain[0], midpoint, domain[1]].map((canonicalParameter, index): Observation => {
      const secondParameter = mappedParameter(reversal, canonicalParameter);
      const firstD0 = native(() => evaluateCurve(plan.first.curve, canonicalParameter), context + ': original first Curve D0 failed'); curvePointEvaluationCount++;
      const secondD0 = native(() => evaluateCurve(plan.second.curve, secondParameter), context + ': original second Curve D0 failed'); curvePointEvaluationCount++;
      const firstD1 = native(() => evaluateCurveD1(plan.first.curve, canonicalParameter), context + ': original first Curve D1 failed'); curveDerivativeEvaluationCount++;
      const secondD1 = native(() => evaluateCurveD1(plan.second.curve, secondParameter), context + ': original second Curve D1 failed'); curveDerivativeEvaluationCount++;
      const expectedSecondDerivativeMM = firstD1.derivative.map(value => -value) as Point;
      const pointDifferenceMM = distance(firstD0, secondD0), derivativeDifferenceMM = distance(expectedSecondDerivativeMM, secondD1.derivative);
      const relativeDerivativeDifference = finite(derivativeDifferenceMM / Math.max(1, finite(Math.hypot(...firstD1.derivative))));
      check(pointDifferenceMM <= 1e-7 && relativeDerivativeDifference <= 1e-7 && distance(firstD0, firstD1.point) <= 1e-7 && distance(secondD0, secondD1.point) <= 1e-7,
        CODE.BINDING, context + ': actual original point/D1 opposite correspondence exceeds declared local diagnostic policy');
      const endpointVertices: [VertexReference, VertexReference] | null = index === 1 ? null
        : [plan.first.endpointVertices[index === 0 ? 0 : 1], plan.second.endpointVertices[index === 0 ? 1 : 0]];
      const endpointPointDifferenceMM: [number, number] | null = endpointVertices === null ? null
        : [distance(firstD0, endpointVertices[0].pointMM), distance(secondD0, endpointVertices[1].pointMM)];
      check(endpointPointDifferenceMM === null || endpointPointDifferenceMM.every(value => value <= 1e-7), CODE.BINDING, context + ': original endpoint vertex binding exceeds local policy');
      observationPairCount++;
      return { index, canonicalParameter, secondParameter,
        first: { reference: plan.first.reference, curveD0: firstD0, curveD1: firstD1, nativeUV: uvAt(plan.first.reference, canonicalParameter) },
        second: { reference: plan.second.reference, curveD0: secondD0, curveD1: secondD1, nativeUV: uvAt(plan.second.reference, secondParameter) },
        expectedSecondDerivativeMM, pointDifferenceMM, derivativeDifferenceMM, relativeDerivativeDifference, endpointVertices, endpointPointDifferenceMM };
    }) as [Observation, Observation, Observation];
    const endpointClassIds = plan.first.endpointVertices.map(vertex => classByRoot.get(root(vertexIndex.get(key(vertex))!))!) as [string, string];
    return { id: edgeIds[pairIndex], canonical: { sourceId: plan.first.reference.sourceId, faceId: plan.first.reference.faceId,
      edgeId: plan.first.reference.edgeId, curveId: plan.first.curve.id },
      uses: [{ ...plan.first.reference, effectiveSense: 'forward', parameterMap: { kind: 'identity', domain, formula: 'u=t', orientation: 1, d1Factor: 1 } },
        { ...plan.second.reference, effectiveSense: 'reverse', parameterMap: { kind: 'reversed', domain: reversal.provenance.domain, native: reversal.provenance.decreasingParameterMap } }],
      reversal, endpointClassIds, observations };
  });
  const freeBoundaries = assets.flatMap(asset => ORDER.map((_, index) => qualified(asset, index)).filter(reference => !selected.has(boundaryKey(reference))));
  const report: ExactBoundaryFaceAdjacencyReport = { schema: 'barocss-exact-boundary-face-adjacency', version: 0, evaluationId: options.evaluationId,
    lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion', parameterFrame: 'unchanged-native-face-pcurves-and-actual-reversal-map', pairs,
    assetCount: assets.length, pairCount: pairs.length, sharedEdgeCount: sharedEdges.length, freeBoundaryCount: freeBoundaries.length, vertexClassCount: vertexClasses.length,
    curveReversalCount, observationPairCount, curvePointEvaluationCount, curveDerivativeEvaluationCount, sourceCompilationCount, faceValidationCount, boundaryExtractionCount,
    qualifications: assets.map(asset => ({ sourceId: asset.sourceId, modelName: asset.face.geometry.name, faceId: asset.face.topology.face.id,
      surfaceId: (asset.face.geometry.objects[0] as Surface).id, loopId: asset.face.topology.loop.id,
      edgeIds: asset.face.topology.edges.map(edge => edge.id), curveIds: asset.face.topology.edges.map(edge => edge.curveId), vertexIds: asset.face.topology.vertices.map(vertex => vertex.id) })),
    numericPolicy: { coefficients: 'whole-kind-degree-domain-knot-pole-weight-object-is-excluding-only-curve-id', orientation: 'native-first-forward-second-reverse-no-parent-face-flip',
      endpoints: 'explicit-opposite-qualified-vertex-pairs-with-object-is-point-bits', pointComparisonMM: 1e-7, relativeD1Comparison: 1e-7, sameDirection: 'refused',
      reversal: 'actual672-on-second-boundary-once-no-double-reversal-assumption', sourceBinding: 'actual-source0-whole-model-object-is-before-native511-validation' },
    sourceOwnership: 'separate-source-model5-per-asset-and-actual-reversal-model1-no-original-rewriting',
    quality: { localIncidenceOnly: true, geometricValidity: 'not-certified', closed: false, solid: false, weldingPerformed: false,
      manifoldCertified: false, supportRegularityCertified: false, continuityCertified: false, globalBinary64ErrorCertified: false, ownership: 'independent-copied-cpu-data-gc' },
    workScope: 'direct-new-compile-face-boundary-reversal-and-observation-calls-parent-internal-work-excluded', budgetFailure: 'atomic-no-partial-incidence',
    limits: { maximumAssets: 4, maximumPairs: 8, maximumCurveReversals: 8, maximumObservationPairs: 24, maximumSurfaceDegree: 3,
      maximumGridAxis: 16, maximumSurfacePoles: 256, maximumBoundaryPoles: 16, coordinateAbsMM: 10000,
      ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 } };
  return snapshot({ assets, options, sharedEdges, vertexClasses, freeBoundaries, report }, CODE.BUDGET) as ExactBoundaryFaceAdjacencyResult;
}

/** Rebuild the public graph once from its complete original sources and explicit retained pairs. */
export function validateExactBoundaryFaceAdjacency(input: ExactBoundaryFaceAdjacencyResult): ExactBoundaryFaceAdjacencyReport {
  const owned = record(snapshot(input, CODE.OWNED), ['assets', 'options', 'sharedEdges', 'vertexClasses', 'freeBoundaries', 'report'], CODE.OWNED) as unknown as ExactBoundaryFaceAdjacencyResult;
  let expected: ExactBoundaryFaceAdjacencyResult;
  try { expected = buildExactBoundaryFaceAdjacency(owned.assets, owned.report.pairs, owned.options); } catch (cause) {
    throw new ExactBoundaryFaceAdjacencyError(CODE.OWNED, 'Whole owned exact boundary incidence rebuild failed', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'Owned sources, Faces, pairs, boundaries, reversals, parameters, classes, graph or work counters changed');
  return copyCadData(expected.report);
}
