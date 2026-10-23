import { measureCoplanarFaceBooleanExtrusion } from './coplanar-face-boolean-extrusion-properties.js';
import type { CoplanarFaceBooleanExtrusionPropertiesResult, CoplanarFaceBooleanExtrusionPropertiesComponent } from './coplanar-face-boolean-extrusion-properties.js';
import type { CoplanarFaceBooleanExtrusionResult } from './coplanar-face-boolean-extrusion.js';
import { evaluateSurface } from './core/math.js';
import { copyCadData } from './data-copy.js';
import type { Point } from './types.js';
import { same } from './core/structural-equality.js';

export const CoplanarFaceBooleanExtrusionMassDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', BUDGET: 'BUDGET', NATIVE: 'NATIVE', REPRESENTABILITY: 'REPRESENTABILITY', OWNED: 'OWNED',
} as const);
export type CoplanarFaceBooleanExtrusionMassDiagnosticCode = typeof CoplanarFaceBooleanExtrusionMassDiagnosticCode[keyof typeof CoplanarFaceBooleanExtrusionMassDiagnosticCode];
export class CoplanarFaceBooleanExtrusionMassError extends Error {
  readonly code: CoplanarFaceBooleanExtrusionMassDiagnosticCode;
  constructor(code: CoplanarFaceBooleanExtrusionMassDiagnosticCode, detail: string, cause?: unknown) {
    super(('Coplanar Face Boolean Extrusion Mass: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CoplanarFaceBooleanExtrusionMassError'; this.code = code;
  }
}
export interface CoplanarFaceBooleanExtrusionMassOptions {
  densityKgPerM3: number; maximumBoundarySegments: number; maximumSurfaceEvaluations: number; maximumSurfacePointEvaluations: number;
}
type Matrix = [Point, Point, Point];
type PlanarMoment = { xx: number; xy: number; yy: number };
type BoundaryObservation = { vertexId: string; uv: Point; pointMM: Point; canonicalPointMM: Point;
  pointDifferenceMM: number; loopIds: string[]; componentId: string };
type LoopMoment = { loopId: string; role: 'outer' | 'hole'; orientation: 'ccw' | 'cw'; vertexIds: string[];
  coordinatesMM: [number, number][]; signedDoubleAreaMM2: number; absoluteCrossSumMM2: number; areaThresholdMM2: number;
  secondMomentMM4: PlanarMoment; absoluteSecondMomentTermsMM4: PlanarMoment };
type PhysicalBasis = { unitX: Point; unitY: Point; unitNormal: Point };
export interface CoplanarFaceBooleanExtrusionMassComponent {
  componentId: string; shellId: string; outerLoopId: string; holeLoopIds: string[]; supportId: string;
  areaMM2: number; volumeMM3: number; centroidUV: [number, number]; capCentroidMM: Point; centroidMM: Point;
  physicalBasis: PhysicalBasis; loopMoments: LoopMoment[]; planarSecondMomentMM4: PlanarMoment;
  covarianceEvidence: { diagonalThresholdsMM4: [number, number]; determinantMM8: number; determinantThresholdMM8: number;
    absoluteSecondMomentTermsMM4: PlanarMoment };
  worldAreaSecondMomentMM4: Matrix; volumeSecondMomentMM5: Matrix; massKG: number; inertiaCentroidKgM2: Matrix;
  areaEvidence: { areaMM2: number; areaDifferenceMM2: number; areaComparisonToleranceMM2: number;
    signedDoubleAreaMM2: number; absoluteCrossSumMM2: number; cancellationThresholdMM2: number };
  pointBindings: { vertexId: string; deltaMM: Point; calculatedPointMM: Point; observedPointMM: Point;
    pointDifferenceMM: number; coordinatesMM: [number, number] }[];
}
export interface CoplanarFaceBooleanExtrusionMassReport {
  schema: 'barocss-native-coplanar-face-boolean-extrusion-mass'; version: 0; evaluationId: string;
  densityKgPerM3: number; massKG: number; centroidMM: Point | null; inertiaCentroidKgM2: Matrix | null; empty: boolean;
  units: { density: 'kg/m3'; mass: 'kg'; centroid: 'mm'; inertia: 'kg*m2'; planarSecondMoment: 'mm4'; volumeSecondMoment: 'mm5' };
  unitConversions: { cubicMillimetresPerCubicMetre: 1000000000; squareMetresPerSquareMillimetre: 0.000001; densityKgPerMM3: number };
  sourceFrame: 'authored-xyz-no-axis-conversion'; parentPropertiesCallCount: 1; parentSurfaceD1EvaluationCount: number;
  surfacePointEvaluationCount: number; boundarySegmentCount: number; componentCount: number; shellCount: number; holeCount: number;
  volumeMM3: number; expectedMassKG: number; massComparisonToleranceKG: number;
  numericPolicy: { guardFactor: 128; pointBindingMM: 1e-7; moments: 'centered-native-d1-scaled-physical-mm-directed-polygons';
    centroid: 'bitwise-actual-931-geometric-centroid'; aggregation: 'full-world-tensor-parallel-axis-at-actual-parent-centroid';
    offDiagonal: 'negative-central-volume-covariance'; emptyTensor: 'null-no-centroid' };
  inheritedBindingResiduals: { maximumPointDifferenceMM: number; maximumEndpointDifferenceMM: number };
  quality: { constructionEstimateOnly: true; densityCertified: false; materialCertified: false; solidCertified: false; manifoldCertified: false;
    inertiaCertified: false; massCertified: false; manufacturingToleranceCertified: false; globalShapeErrorCertified: false; globalBinary64ErrorCertified: false;
    geometry: 'canonical-trim-normal-prism-not-unsnapped-fragment-solid'; componentAggregation: 'separate-components-not-spatial-overlap-union';
    ownership: 'independent-copied-cpu-data-gc' };
  workScope: 'one-actual-parent-property-call-and-new-unique-canonical-surface-d0-only'; budgetFailure: 'atomic-no-partial-mass-result';
  limits: { maximumBoundarySegments: 64; maximumSurfaceEvaluations: 8; maximumSurfacePointEvaluations: 64;
    ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144; maximumDensityKgPerM3: 1000000 };
}
export interface CoplanarFaceBooleanExtrusionMassResult {
  properties: CoplanarFaceBooleanExtrusionPropertiesResult; options: CoplanarFaceBooleanExtrusionMassOptions;
  components: CoplanarFaceBooleanExtrusionMassComponent[]; boundaryObservations: BoundaryObservation[]; report: CoplanarFaceBooleanExtrusionMassReport;
}

const CODE = CoplanarFaceBooleanExtrusionMassDiagnosticCode, EPS = 128 * Number.EPSILON;
function check(condition: boolean, code: CoplanarFaceBooleanExtrusionMassDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CoplanarFaceBooleanExtrusionMassError(code, detail);
}
function native<T>(action: () => T, detail: string): T {
  try { return action(); } catch (cause) { throw new CoplanarFaceBooleanExtrusionMassError(CODE.NATIVE, detail, cause); }
}
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'Finite physical moment arithmetic range exceeded'); return value; }
function product(a: number, b: number): number {
  const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'Nonzero physical moment product underflowed'); return value;
}
function quotient(a: number, b: number): number {
  check(Number.isFinite(b) && b !== 0, CODE.REPRESENTABILITY, 'A finite nonzero moment denominator is required');
  const value = finite(a / b); check(a === 0 || value !== 0, CODE.REPRESENTABILITY, 'Nonzero physical moment quotient underflowed'); return value;
}
function add(a: number, b: number): number {
  const value = finite(a + b);
  check((b === 0 || value !== a) && (a === 0 || value !== b), CODE.REPRESENTABILITY, 'A nonzero physical moment contribution disappeared'); return value;
}
function sum(values: number[]): number { return values.reduce(add, 0); }
function difference(a: Point, b: Point): Point { return a.map((value, axis) => finite(value - b[axis])) as Point; }
function dot(a: Point, b: Point): number { return sum(a.map((value, axis) => product(value, b[axis]))); }
function cross(a: Point, b: Point): Point { return [add(product(a[1], b[2]), -product(a[2], b[1])),
  add(product(a[2], b[0]), -product(a[0], b[2])), add(product(a[0], b[1]), -product(a[1], b[0]))]; }
function unit(vector: Point): Point {
  const norm = finite(Math.hypot(...vector)); check(norm > 0, CODE.REPRESENTABILITY, 'A positive physical basis norm is required');
  const result = vector.map(value => quotient(value, norm)) as Point;
  check(Math.abs(finite(Math.hypot(...result) - 1)) <= EPS, CODE.REPRESENTABILITY, 'Physical basis normalization residual is uncertain'); return result;
}
function matrix(value: (row: number, column: number) => number): Matrix {
  const result: Matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let row = 0; row < 3; row++) for (let column = row; column < 3; column++) result[row][column] = result[column][row] = finite(value(row, column));
  return result;
}
function physicalTensor(tensor: Matrix): void {
  check(tensor.every((row, axis) => row[axis] > 0), CODE.REPRESENTABILITY, 'Positive physical inertia diagonals are required');
  const scale = Math.max(tensor[0][0], tensor[1][1], tensor[2][2]);
  const t = tensor.map(row => row.map(value => quotient(value, scale))) as Matrix;
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
    const diagonal = product(t[a][a], t[b][b]), squared = product(t[a][b], t[a][b]);
    check(finite(diagonal - squared) > product(EPS, finite(Math.abs(diagonal) + Math.abs(squared))), CODE.REPRESENTABILITY, 'Physical inertia minor is negative or cancellation-uncertain');
  }
  const terms = [product(product(t[0][0], t[1][1]), t[2][2]), product(2, product(product(t[0][1], t[0][2]), t[1][2])),
    -product(t[0][0], product(t[1][2], t[1][2])), -product(t[1][1], product(t[0][2], t[0][2])), -product(t[2][2], product(t[0][1], t[0][1]))];
  check(terms.reduce((total, term) => finite(total + term), 0) > product(EPS, terms.reduce((total, term) => finite(total + Math.abs(term)), 0)), CODE.REPRESENTABILITY, 'Physical inertia determinant is negative or cancellation-uncertain');
}
function snapshot(input: unknown, code: CoplanarFaceBooleanExtrusionMassDiagnosticCode): unknown {
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
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'Sparse or extra own array fields are refused'); return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  try { return copy(input, 0); } catch (cause) {
    if (cause instanceof CoplanarFaceBooleanExtrusionMassError) throw cause;
    throw new CoplanarFaceBooleanExtrusionMassError(code, 'Own-data snapshot failed', cause);
  }
}
function record(value: unknown, fields: string[], code: CoplanarFaceBooleanExtrusionMassDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own record is required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data;
}
function basis(component: CoplanarFaceBooleanExtrusionPropertiesComponent, translation: Point): PhysicalBasis {
  const unitX = unit(component.supportD1.du), unitNormal = unit(cross(component.supportD1.du, component.supportD1.dv));
  const unitY = cross(unitNormal, unitX);
  check(Math.abs(finite(Math.hypot(...unitY) - 1)) <= EPS && Math.abs(dot(unitX, unitY)) <= EPS
    && Math.abs(dot(unitX, unitNormal)) <= EPS && Math.abs(dot(unitY, unitNormal)) <= EPS, CODE.REPRESENTABILITY, 'Physical moment basis is not safely orthonormal');
  const translationNorm = finite(Math.hypot(...translation)); check(translationNorm > 0, CODE.REPRESENTABILITY, 'Positive actual extrusion translation is required');
  const direction = unit(translation);
  check(dot(direction, unitNormal) > 0 && Math.hypot(...difference(direction, unitNormal)) <= 1e-7,
    CODE.REPRESENTABILITY, 'Physical moment normal does not bind actual positive extrusion translation');
  return { unitX, unitY, unitNormal };
}

/** Uniform declared density on the canonical trim normal-prism construction, without Solid authority. */
export function estimateCoplanarFaceBooleanExtrusionMass(extrusionInput: CoplanarFaceBooleanExtrusionResult,
  optionsInput: CoplanarFaceBooleanExtrusionMassOptions): CoplanarFaceBooleanExtrusionMassResult {
  const copied = record(snapshot({ extrusion: extrusionInput, options: optionsInput }, CODE.INPUT), ['extrusion', 'options']);
  const data = record(copied.options, ['densityKgPerM3', 'maximumBoundarySegments', 'maximumSurfaceEvaluations', 'maximumSurfacePointEvaluations']);
  check(typeof data.densityKgPerM3 === 'number' && data.densityKgPerM3 > 0 && data.densityKgPerM3 <= 1e6, CODE.INPUT, 'Explicit positive finite density at most1e6 kg/m3 is required');
  for (const [field, maximum] of [['maximumBoundarySegments', 64], ['maximumSurfaceEvaluations', 8], ['maximumSurfacePointEvaluations', 64]] as const)
    check(typeof data[field] === 'number' && Number.isInteger(data[field]) && data[field] >= 0 && data[field] <= maximum,
      CODE.BUDGET, 'Complete integer construction-work budgets are required');
  const options = data as unknown as CoplanarFaceBooleanExtrusionMassOptions;
  const properties = native(() => measureCoplanarFaceBooleanExtrusion(copied.extrusion as CoplanarFaceBooleanExtrusionResult,
    { maximumBoundarySegments: options.maximumBoundarySegments, maximumSurfaceEvaluations: options.maximumSurfaceEvaluations }), 'Actual native931 construction properties failed');
  const extrusion = properties.extrusion, region = extrusion.region;
  const densityKgPerMM3 = quotient(options.densityKgPerM3, 1e9), inertiaFactor = product(densityKgPerMM3, 1e-6);
  const selectedIds = new Set(region.components.flatMap(component => [component.outerLoopId, ...component.holeLoopIds]));
  const selectedLoops = region.loops.filter(loop => selectedIds.has(loop.id));
  const vertexIds = [...new Set(selectedLoops.flatMap(loop => loop.vertexIds))];
  check(vertexIds.length <= 64 && vertexIds.length <= options.maximumSurfacePointEvaluations, CODE.BUDGET, 'Complete unique canonical Surface D0 budget is required before any new point evaluation');
  const boundaryObservations: BoundaryObservation[] = vertexIds.map(vertexId => {
    const vertex = region.vertices.find(value => value.id === vertexId), loops = selectedLoops.filter(loop => loop.vertexIds.includes(vertexId));
    check(vertex !== undefined && loops.length > 0 && loops.every(loop => loop.componentId === loops[0].componentId), CODE.INPUT, 'Canonical selected vertex and component identity are required');
    const pointMM = native(() => evaluateSurface(region.support, vertex.uv[0], vertex.uv[1]), 'Actual canonical Surface D0 failed at vertex ' + vertexId);
    const pointDifferenceMM = finite(Math.hypot(...difference(pointMM, vertex.pointMM)));
    check(pointDifferenceMM <= 1e-7, CODE.REPRESENTABILITY, 'Actual canonical Surface D0 differs from native vertex beyond inherited binding policy');
    return { vertexId, uv: vertex.uv, pointMM, canonicalPointMM: vertex.pointMM, pointDifferenceMM,
      loopIds: loops.map(loop => loop.id), componentId: loops[0].componentId };
  });
  const observations = new Map(boundaryObservations.map(observation => [observation.vertexId, observation]));
  const components: CoplanarFaceBooleanExtrusionMassComponent[] = properties.components.map((component): CoplanarFaceBooleanExtrusionMassComponent => {
    check(extrusion.translationMM !== null, CODE.INPUT, 'Nonempty parent must retain actual extrusion translation');
    const physicalBasis = basis(component, extrusion.translationMM);
    const loops = selectedLoops.filter(loop => loop.componentId === component.componentId);
    const componentVertexIds = [...new Set(loops.flatMap(loop => loop.vertexIds))];
    const pointBindings = componentVertexIds.map(vertexId => {
      const observation = observations.get(vertexId); check(observation !== undefined, CODE.INPUT, 'Complete original canonical point observations are required');
      const u = finite(observation.uv[0] - component.centroidUV[0]), v = finite(observation.uv[1] - component.centroidUV[1]);
      const deltaMM = component.supportD1.du.map((value, axis) => add(product(value, u), product(component.supportD1.dv[axis], v))) as Point;
      const calculatedPointMM = component.capCentroidMM.map((value, axis) => add(value, deltaMM[axis])) as Point;
      const pointDifferenceMM = finite(Math.hypot(...difference(calculatedPointMM, observation.pointMM)));
      check(pointDifferenceMM <= 1e-7, CODE.REPRESENTABILITY, 'Centered actual D1 physical coordinates do not bind canonical Surface D0');
      const coordinatesMM: [number, number] = [dot(deltaMM, physicalBasis.unitX), dot(deltaMM, physicalBasis.unitY)];
      return { vertexId, deltaMM, calculatedPointMM, observedPointMM: observation.pointMM, pointDifferenceMM, coordinatesMM };
    });
    const coordinates = new Map(pointBindings.map(binding => [binding.vertexId, binding.coordinatesMM]));
    const loopMoments: LoopMoment[] = loops.map(loop => {
      const coordinatesMM = loop.vertexIds.map(vertexId => { const value = coordinates.get(vertexId); check(value !== undefined, CODE.INPUT, 'Complete directed loop coordinates are required'); return value; });
      const crosses: number[] = [], xxTerms: number[] = [], xyTerms: number[] = [], yyTerms: number[] = [];
      for (let index = 0; index < coordinatesMM.length; index++) {
        const [x0, y0] = coordinatesMM[index], [x1, y1] = coordinatesMM[(index + 1) % coordinatesMM.length];
        const c = add(product(x0, y1), -product(x1, y0)); crosses.push(c);
        xxTerms.push(quotient(product(c, sum([product(x0, x0), product(x0, x1), product(x1, x1)])), 12));
        yyTerms.push(quotient(product(c, sum([product(y0, y0), product(y0, y1), product(y1, y1)])), 12));
        xyTerms.push(quotient(product(c, sum([product(2, product(x0, y0)), product(x0, y1), product(x1, y0), product(2, product(x1, y1))])), 24));
      }
      const signedDoubleAreaMM2 = sum(crosses), absoluteCrossSumMM2 = sum(crosses.map(Math.abs)), areaThresholdMM2 = product(EPS, absoluteCrossSumMM2);
      check(loop.role === 'outer' ? loop.orientation === 'ccw' && signedDoubleAreaMM2 > areaThresholdMM2
        : loop.orientation === 'cw' && signedDoubleAreaMM2 < -areaThresholdMM2, CODE.REPRESENTABILITY, 'Directed physical outer/hole area is reversed or cancellation-uncertain');
      return { loopId: loop.id, role: loop.role, orientation: loop.orientation, vertexIds: loop.vertexIds, coordinatesMM,
        signedDoubleAreaMM2, absoluteCrossSumMM2, areaThresholdMM2,
        secondMomentMM4: { xx: sum(xxTerms), xy: sum(xyTerms), yy: sum(yyTerms) },
        absoluteSecondMomentTermsMM4: { xx: sum(xxTerms.map(Math.abs)), xy: sum(xyTerms.map(Math.abs)), yy: sum(yyTerms.map(Math.abs)) } };
    });
    const signedDoubleAreaMM2 = sum(loopMoments.map(loop => loop.signedDoubleAreaMM2));
    const absoluteCrossSumMM2 = sum(loopMoments.map(loop => loop.absoluteCrossSumMM2));
    const cancellationThresholdMM2 = product(.5, product(EPS, absoluteCrossSumMM2)), areaMM2 = product(.5, signedDoubleAreaMM2);
    check(areaMM2 > cancellationThresholdMM2, CODE.REPRESENTABILITY, 'Total physical material area is cancellation-uncertain');
    const jacobianMM2 = finite(Math.hypot(...cross(component.supportD1.du, component.supportD1.dv)));
    const areaComparisonToleranceMM2 = sum([cancellationThresholdMM2, product(component.areaComparisonToleranceUV, jacobianMM2),
      product(EPS, add(Math.abs(areaMM2), Math.abs(component.areaMM2)))]);
    const areaDifferenceMM2 = Math.abs(finite(areaMM2 - component.areaMM2));
    check(areaDifferenceMM2 <= areaComparisonToleranceMM2, CODE.REPRESENTABILITY, 'Physical signed area differs from actual931 beyond its declared local comparison policy');
    const moment = (field: keyof PlanarMoment) => sum(loopMoments.map(loop => loop.secondMomentMM4[field]));
    const absolute = (field: keyof PlanarMoment) => sum(loopMoments.map(loop => loop.absoluteSecondMomentTermsMM4[field]));
    const planarSecondMomentMM4 = { xx: moment('xx'), xy: moment('xy'), yy: moment('yy') };
    const absoluteSecondMomentTermsMM4 = { xx: absolute('xx'), xy: absolute('xy'), yy: absolute('yy') };
    const xxBound = product(EPS, absoluteSecondMomentTermsMM4.xx), xyBound = product(EPS, absoluteSecondMomentTermsMM4.xy), yyBound = product(EPS, absoluteSecondMomentTermsMM4.yy);
    check(planarSecondMomentMM4.xx > xxBound && planarSecondMomentMM4.yy > yyBound, CODE.REPRESENTABILITY, 'Positive planar covariance diagonals are cancellation-uncertain');
    const diagonalProduct = product(planarSecondMomentMM4.xx, planarSecondMomentMM4.yy), squaredCross = product(planarSecondMomentMM4.xy, planarSecondMomentMM4.xy);
    const determinantMM8 = finite(diagonalProduct - squaredCross);
    const determinantThresholdMM8 = [product(EPS, finite(Math.abs(diagonalProduct) + Math.abs(squaredCross))),
      product(xxBound, Math.abs(planarSecondMomentMM4.yy)), product(yyBound, Math.abs(planarSecondMomentMM4.xx)), product(2, product(xyBound, Math.abs(planarSecondMomentMM4.xy)))].reduce((total, term) => finite(total + term), 0);
    check(determinantMM8 > determinantThresholdMM8, CODE.REPRESENTABILITY, 'Positive planar covariance determinant is cancellation-uncertain');
    const { unitX: x, unitY: y } = physicalBasis, m = planarSecondMomentMM4;
    const worldAreaSecondMomentMM4 = matrix((a, b) => sum([product(m.xx, product(x[a], x[b])),
      product(m.xy, add(product(x[a], y[b]), product(y[a], x[b]))), product(m.yy, product(y[a], y[b]))]));
    const translation = extrusion.translationMM;
    const volumeSecondMomentMM5 = matrix((a, b) => add(product(extrusion.options.distanceMM, worldAreaSecondMomentMM4[a][b]),
      quotient(product(component.volumeMM3, product(translation[a], translation[b])), 12)));
    const inertiaCentroidKgM2 = matrix((a, b) => product(inertiaFactor, a === b
      ? sum([0, 1, 2].filter(axis => axis !== a).map(axis => volumeSecondMomentMM5[axis][axis])) : -volumeSecondMomentMM5[a][b]));
    physicalTensor(inertiaCentroidKgM2);
    const massKG = product(component.volumeMM3, densityKgPerMM3); check(massKG > 0, CODE.REPRESENTABILITY, 'Positive component mass is required');
    return { componentId: component.componentId, shellId: component.shellId, outerLoopId: component.outerLoopId, holeLoopIds: component.holeLoopIds,
      supportId: component.supportId, areaMM2: component.areaMM2, volumeMM3: component.volumeMM3, centroidUV: component.centroidUV,
      capCentroidMM: component.capCentroidMM, centroidMM: component.centroidMM, physicalBasis, loopMoments, planarSecondMomentMM4,
      covarianceEvidence: { diagonalThresholdsMM4: [xxBound, yyBound], determinantMM8, determinantThresholdMM8, absoluteSecondMomentTermsMM4 },
      worldAreaSecondMomentMM4, volumeSecondMomentMM5, massKG, inertiaCentroidKgM2,
      areaEvidence: { areaMM2, areaDifferenceMM2, areaComparisonToleranceMM2, signedDoubleAreaMM2, absoluteCrossSumMM2, cancellationThresholdMM2 }, pointBindings };
  });
  const massKG = sum(components.map(component => component.massKG)), expectedMassKG = product(properties.report.volumeMM3, densityKgPerMM3);
  const massComparisonToleranceKG = product(EPS, add(Math.abs(massKG), Math.abs(expectedMassKG)));
  check(Math.abs(finite(massKG - expectedMassKG)) <= massComparisonToleranceKG, CODE.REPRESENTABILITY, 'Component mass sum differs from actual total-volume density product');
  let inertiaCentroidKgM2: Matrix | null = null;
  if (components.length > 0) {
    const centroid = properties.report.centroidMM; check(centroid !== null, CODE.INPUT, 'Actual aggregate construction centroid is required');
    const shiftedTensors = components.map(component => {
      const offset = difference(component.centroidMM, centroid), factor = product(component.massKG, 1e-6);
      return matrix((a, b) => add(component.inertiaCentroidKgM2[a][b], product(factor, a === b
        ? sum([0, 1, 2].filter(axis => axis !== a).map(axis => product(offset[axis], offset[axis]))) : -product(offset[a], offset[b]))));
    });
    inertiaCentroidKgM2 = matrix((a, b) => sum(shiftedTensors.map(tensor => tensor[a][b]))); physicalTensor(inertiaCentroidKgM2);
  }
  const report: CoplanarFaceBooleanExtrusionMassReport = { schema: 'barocss-native-coplanar-face-boolean-extrusion-mass', version: 0,
    evaluationId: extrusion.options.evaluationId, densityKgPerM3: options.densityKgPerM3, massKG, centroidMM: properties.report.centroidMM,
    inertiaCentroidKgM2, empty: components.length === 0,
    units: { density: 'kg/m3', mass: 'kg', centroid: 'mm', inertia: 'kg*m2', planarSecondMoment: 'mm4', volumeSecondMoment: 'mm5' },
    unitConversions: { cubicMillimetresPerCubicMetre: 1e9, squareMetresPerSquareMillimetre: 1e-6, densityKgPerMM3 },
    sourceFrame: 'authored-xyz-no-axis-conversion', parentPropertiesCallCount: 1, parentSurfaceD1EvaluationCount: properties.report.surfaceD1EvaluationCount,
    surfacePointEvaluationCount: boundaryObservations.length, boundarySegmentCount: properties.report.boundarySegmentCount,
    componentCount: components.length, shellCount: properties.report.shellCount, holeCount: properties.report.holeCount,
    volumeMM3: properties.report.volumeMM3, expectedMassKG, massComparisonToleranceKG,
    numericPolicy: { guardFactor: 128, pointBindingMM: 1e-7, moments: 'centered-native-d1-scaled-physical-mm-directed-polygons',
      centroid: 'bitwise-actual-931-geometric-centroid', aggregation: 'full-world-tensor-parallel-axis-at-actual-parent-centroid',
      offDiagonal: 'negative-central-volume-covariance', emptyTensor: 'null-no-centroid' },
    inheritedBindingResiduals: properties.report.inheritedBindingResiduals,
    quality: { constructionEstimateOnly: true, densityCertified: false, materialCertified: false, solidCertified: false, manifoldCertified: false,
      inertiaCertified: false, massCertified: false, manufacturingToleranceCertified: false, globalShapeErrorCertified: false, globalBinary64ErrorCertified: false,
      geometry: 'canonical-trim-normal-prism-not-unsnapped-fragment-solid', componentAggregation: 'separate-components-not-spatial-overlap-union', ownership: 'independent-copied-cpu-data-gc' },
    workScope: 'one-actual-parent-property-call-and-new-unique-canonical-surface-d0-only', budgetFailure: 'atomic-no-partial-mass-result',
    limits: { maximumBoundarySegments: 64, maximumSurfaceEvaluations: 8, maximumSurfacePointEvaluations: 64,
      ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144, maximumDensityKgPerM3: 1e6 } };
  return snapshot({ properties, options, components, boundaryObservations, report }, CODE.BUDGET) as CoplanarFaceBooleanExtrusionMassResult;
}

/** Recompute the whole actual construction query and compare every owned source, moment, tensor and bit. */
export function validateCoplanarFaceBooleanExtrusionMass(input: CoplanarFaceBooleanExtrusionMassResult): CoplanarFaceBooleanExtrusionMassReport {
  const owned = record(snapshot(input, CODE.OWNED), ['properties', 'options', 'components', 'boundaryObservations', 'report'], CODE.OWNED) as unknown as CoplanarFaceBooleanExtrusionMassResult;
  let expected: CoplanarFaceBooleanExtrusionMassResult;
  try { expected = estimateCoplanarFaceBooleanExtrusionMass(owned.properties.extrusion, owned.options); } catch (cause) {
    throw new CoplanarFaceBooleanExtrusionMassError(CODE.OWNED, 'Whole owned construction mass rebuild failed', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'Owned properties, source, center, boundary, loop, moment, tensor, units or counter bits changed');
  return copyCadData(expected.report);
}
