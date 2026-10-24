import { validateCoplanarFaceBooleanExtrusion } from './coplanar-face-boolean-extrusion.js';
import type { CoplanarFaceBooleanExtrusionResult } from './coplanar-face-boolean-extrusion.js';
import { evaluateSurfaceD1 } from '../core/derivatives.js';
import type { SurfaceD1Result } from '../core/derivatives.js';
import type { Point } from '../types.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';

export const CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode = Object.freeze({ INPUT: 'INPUT', BUDGET: 'BUDGET', NATIVE: 'NATIVE',
  REPRESENTABILITY: 'REPRESENTABILITY', OWNED: 'OWNED' } as const);
export type CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode = typeof CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode[keyof typeof CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode];
export class CoplanarFaceBooleanExtrusionPropertiesError extends KernelError {
  readonly code: CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode;
  constructor(code: CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode, detail: string, cause?: unknown) {
    super(('Coplanar Face Boolean Extrusion Properties: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CoplanarFaceBooleanExtrusionPropertiesError'; this.code = code;
  }
}
export interface CoplanarFaceBooleanExtrusionPropertiesOptions { maximumBoundarySegments: number; maximumSurfaceEvaluations: number }
export interface CoplanarFaceBooleanExtrusionPropertiesComponent {
  componentId: string; shellId: string; outerLoopId: string; holeLoopIds: string[]; supportId: string;
  areaUV: number; areaMM2: number; volumeMM3: number; centroidUV: [number, number]; capCentroidMM: Point; centroidMM: Point; supportD1: SurfaceD1Result;
  originUV: [number, number]; signedDoubleAreaUV: number; absoluteCrossSumUV: number; shiftedFirstMomentNumeratorsUV: [number, number];
  areaCancellationThresholdUV: number; originalAreaUV: number; areaDifferenceUV: number; areaComparisonToleranceUV: number;
  loopMoments: { loopId: string; role: 'outer' | 'hole'; signedDoubleAreaUV: number; absoluteCrossSumUV: number; shiftedFirstMomentNumeratorsUV: [number, number] }[];
}
export interface CoplanarFaceBooleanExtrusionPropertiesReport {
  schema: 'barocss-native-coplanar-face-boolean-extrusion-properties'; version: 0; evaluationId: string;
  lengthUnit: 'mm'; areaUnit: 'mm2'; volumeUnit: 'mm3'; sourceFrame: 'authored-xyz-no-axis-conversion'; empty: boolean;
  componentCount: number; shellCount: number; holeCount: number; boundarySegmentCount: number; surfaceD1EvaluationCount: number;
  areaMM2: number; volumeMM3: number; centroidMM: Point | null; distanceMM: number;
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  numericPolicy: { moments: 'signed-directed-loops-shifted-by-outer-first-uv'; areaCancellation: '128-epsilon-absolute-shifted-cross-sum';
    areaComparison: 'own-area-cancellation-threshold-plus-parent-declared-uncertainty-and-128-epsilon-area-scale';
    centroid: 'actual-native-support-point-plus-actual-half-translation'; aggregate: 'shifted-volume-weighted-component-centroids'; zeroFirstMomentsAllowed: true };
  quality: { authority: 'actual-native-affine-support-canonical-trim-and-positive-normal-extrusion-distance'; constructionEstimateOnly: true;
    centroidMeaning: 'homogeneous-geometric-construction-centroid-not-density-or-mass'; centroidIsInteriorWitness: false;
    componentAggregation: 'separate-native-component-shells-not-spatial-overlap-union';
    endpointPolicy: 'canonical-trim-incidence-and-unsnapped-native-edges-remain-distinct';
    workScope: 'new-component-support-d1-only-excludes-native-parent-reconstruction'; globalBinary64ErrorCertified: false;
    globalShapeErrorCertified: false; manifoldCertified: false; exactSewingCertified: false; solidCertified: false;
    manufacturingToleranceCertified: false; densityCertified: false; massCertified: false; inertiaCertified: false;
    ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  inheritedBindingResiduals: { maximumPointDifferenceMM: number; maximumEndpointDifferenceMM: number };
  budgetFailure: 'atomic-refusal-no-partial-construction-properties';
  limits: { maximumBoundarySegments: 64; maximumSurfaceEvaluations: 8; ownValues: 1048576; ownDepth: 40; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface CoplanarFaceBooleanExtrusionPropertiesResult { extrusion: CoplanarFaceBooleanExtrusionResult; options: CoplanarFaceBooleanExtrusionPropertiesOptions;
  components: CoplanarFaceBooleanExtrusionPropertiesComponent[]; report: CoplanarFaceBooleanExtrusionPropertiesReport }

const CODE = CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode, AREA_EPSILON = 128 * Number.EPSILON;
function check(condition: boolean, code: CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CoplanarFaceBooleanExtrusionPropertiesError(code, detail);
}
function native<T>(action: () => T, detail: string, code: CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CoplanarFaceBooleanExtrusionPropertiesError) throw cause;
    throw new CoplanarFaceBooleanExtrusionPropertiesError(code, detail, cause);
  }
}
/** Copy each occurrence, allow reused caller aliases and refuse ancestor cycles. */
function snapshot(input: unknown, code: CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode = CODE.INPUT): unknown {
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
        const n = descriptors.length.value as number;
        check(Number.isInteger(n) && n >= 0 && n <= 8192 && keys.length === n + 1, code, 'dense bounded own array required');
        return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), code, 'sparse/foreign own array field refused'); return copy(descriptors[String(i)].value, depth + 1); });
      }
      return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    } finally { ancestors.delete(value); }
  }; return copy(input, 0);
}
function record(input: unknown, fields: string[], code: CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required');
  const data = input as Record<string, unknown>; check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(',')); return data;
}
function admitOptions(input: unknown): CoplanarFaceBooleanExtrusionPropertiesOptions {
  const data = record(input, ['maximumBoundarySegments', 'maximumSurfaceEvaluations']);
  for (const [field, maximum] of [['maximumBoundarySegments', 64], ['maximumSurfaceEvaluations', 8]] as const)
    check(typeof data[field] === 'number' && Number.isInteger(data[field]) && (data[field] as number) >= 0 && (data[field] as number) <= maximum,
      CODE.BUDGET, 'integer ' + field + ' within frozen construction-property limits required');
  return { maximumBoundarySegments: data.maximumBoundarySegments as number, maximumSurfaceEvaluations: data.maximumSurfaceEvaluations as number };
}
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'finite signed-moment/metric/centroid arithmetic required'); return value; }
function product(a: number, b: number): number { const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero moment/metric product underflow'); return value; }
function quotient(a: number, b: number): number { const value = finite(a / b); check(a === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero moment/centroid quotient underflow'); return value; }
function shifted(origin: number, offset: number): number { const value = finite(origin + offset);
  check(offset === 0 || value !== origin, CODE.REPRESENTABILITY, 'nonzero centroid shift disappeared into unchanged coordinate'); return value; }
function cross(a: Point, b: Point): Point { return [finite(product(a[1], b[2]) - product(a[2], b[1])),
  finite(product(a[2], b[0]) - product(a[0], b[2])), finite(product(a[0], b[1]) - product(a[1], b[0]))]; }
function sumMetric(values: number[]): number {
  return values.reduce((sum, value) => { const next = finite(sum + value);
    check(value > 0 && next > sum && (sum === 0 || next > value), CODE.REPRESENTABILITY, 'positive component metric contribution is not represented in aggregate'); return next; }, 0);
}

/** Native canonical trim sweep construction metrics, without density, mass or general Solid authority. */
export function measureCoplanarFaceBooleanExtrusion(extrusionInput: CoplanarFaceBooleanExtrusionResult,
  optionsInput: CoplanarFaceBooleanExtrusionPropertiesOptions): CoplanarFaceBooleanExtrusionPropertiesResult {
  const copied = record(snapshot({ extrusion: extrusionInput, options: optionsInput }), ['extrusion', 'options']);
  const extrusion = copied.extrusion as CoplanarFaceBooleanExtrusionResult, options = admitOptions(copied.options);
  native(() => validateCoplanarFaceBooleanExtrusion(extrusion), 'actual complete native extrusion parent reconstruction required', CODE.INPUT);
  const region = extrusion.region, boundarySegmentCount = region.loops.reduce((sum, loop) => sum + loop.uses.length, 0);
  check(boundarySegmentCount <= options.maximumBoundarySegments && boundarySegmentCount <= 64 && region.components.length <= options.maximumSurfaceEvaluations
    && region.components.length <= 8, CODE.BUDGET, 'complete selected boundary/component budgets required before new support D1 evaluation');
  let surfaceD1EvaluationCount = 0;
  const vertexById = new Map(region.vertices.map(vertex => [vertex.id, vertex]));
  const components: CoplanarFaceBooleanExtrusionPropertiesComponent[] = region.components.map(component => {
    const outer = region.loops.find(loop => loop.id === component.outerLoopId), shell = extrusion.shells.find(shell => shell.componentId === component.id);
    check(outer !== undefined && outer.role === 'outer' && shell !== undefined, CODE.INPUT, 'actual native component outer loop and separate Shell required');
    const first = vertexById.get(outer.vertexIds[0]); check(first !== undefined, CODE.INPUT, 'actual outer first UV vertex required');
    const originUV: [number, number] = [first.uv[0], first.uv[1]], loops = [outer, ...component.holeLoopIds.map(id => {
      const hole = region.loops.find(loop => loop.id === id); check(hole !== undefined && hole.role === 'hole', CODE.INPUT, 'actual signed native hole loop required'); return hole;
    })];
    const loopMoments: CoplanarFaceBooleanExtrusionPropertiesComponent['loopMoments'] = loops.map(loop => {
      let signedDoubleAreaUV = 0, absoluteCrossSumUV = 0, momentU = 0, momentV = 0;
      for (let i = 0; i < loop.vertexIds.length; i++) {
        const a = vertexById.get(loop.vertexIds[i]), b = vertexById.get(loop.vertexIds[(i + 1) % loop.vertexIds.length]);
        check(a !== undefined && b !== undefined, CODE.INPUT, 'complete native directed trim edge vertices required');
        const x0 = finite(a.uv[0] - originUV[0]), y0 = finite(a.uv[1] - originUV[1]), x1 = finite(b.uv[0] - originUV[0]), y1 = finite(b.uv[1] - originUV[1]);
        const determinant = finite(product(x0, y1) - product(x1, y0));
        signedDoubleAreaUV = finite(signedDoubleAreaUV + determinant); absoluteCrossSumUV = finite(absoluteCrossSumUV + Math.abs(determinant));
        momentU = finite(momentU + product(finite(x0 + x1), determinant)); momentV = finite(momentV + product(finite(y0 + y1), determinant));
      }
      const threshold = product(AREA_EPSILON, absoluteCrossSumUV);
      check(loop.role === 'outer' ? signedDoubleAreaUV > threshold : signedDoubleAreaUV < -threshold,
        CODE.REPRESENTABILITY, 'signed native loop area is cancellation-uncertain or has incorrect outer/hole orientation');
      return { loopId: loop.id, role: loop.role, signedDoubleAreaUV, absoluteCrossSumUV, shiftedFirstMomentNumeratorsUV: [momentU, momentV] };
    });
    const signedDoubleAreaUV = loopMoments.reduce((sum, loop) => finite(sum + loop.signedDoubleAreaUV), 0);
    const absoluteCrossSumUV = loopMoments.reduce((sum, loop) => finite(sum + loop.absoluteCrossSumUV), 0);
    const shiftedFirstMomentNumeratorsUV: [number, number] = [0, 1].map(axis => loopMoments.reduce((sum, loop) => finite(sum + loop.shiftedFirstMomentNumeratorsUV[axis]), 0)) as [number, number];
    const doubleAreaThreshold = product(AREA_EPSILON, absoluteCrossSumUV);
    check(signedDoubleAreaUV > doubleAreaThreshold, CODE.REPRESENTABILITY, 'positive outer-minus-holes material area is cancellation-uncertain');
    const areaUV = product(.5, signedDoubleAreaUV), areaCancellationThresholdUV = product(.5, doubleAreaThreshold);
    const parentUncertainty = loops.reduce((sum, loop) => finite(sum + loop.areaUncertaintyUV), 0);
    const areaComparisonToleranceUV = finite(finite(areaCancellationThresholdUV + parentUncertainty)
      + product(AREA_EPSILON, finite(Math.abs(areaUV) + Math.abs(component.areaUV))));
    const areaDifferenceUV = Math.abs(finite(areaUV - component.areaUV));
    check(areaDifferenceUV <= areaComparisonToleranceUV, CODE.REPRESENTABILITY, 'computed signed component area differs from actual native region area beyond declared local guard');
    const denominator = product(3, signedDoubleAreaUV);
    const centroidUV = shiftedFirstMomentNumeratorsUV.map((value, axis) => shifted(originUV[axis], quotient(value, denominator))) as [number, number];
    surfaceD1EvaluationCount++;
    const supportD1 = native(() => evaluateSurfaceD1(region.support, centroidUV[0], centroidUV[1]), 'actual native affine support D1 at geometric component centroid');
    const jacobianMM2 = finite(Math.hypot(...cross(supportD1.du, supportD1.dv)));
    check(jacobianMM2 > 0, CODE.REPRESENTABILITY, 'positive represented native affine area Jacobian required');
    const areaMM2 = product(areaUV, jacobianMM2), volumeMM3 = product(areaMM2, extrusion.options.distanceMM);
    check(areaMM2 > 0 && volumeMM3 > 0 && extrusion.translationMM !== null, CODE.REPRESENTABILITY, 'positive native construction area/volume and actual translation required');
    const centroidMM = supportD1.point.map((value, axis) => shifted(value, product(extrusion.translationMM![axis], .5))) as Point;
    return { componentId: component.id, shellId: shell.id, outerLoopId: component.outerLoopId, holeLoopIds: component.holeLoopIds,
      supportId: region.support.id, areaUV, areaMM2, volumeMM3, centroidUV, capCentroidMM: supportD1.point, centroidMM, supportD1,
      originUV, signedDoubleAreaUV, absoluteCrossSumUV, shiftedFirstMomentNumeratorsUV, areaCancellationThresholdUV,
      originalAreaUV: component.areaUV, areaDifferenceUV, areaComparisonToleranceUV, loopMoments };
  });
  const areaMM2 = sumMetric(components.map(component => component.areaMM2)), volumeMM3 = sumMetric(components.map(component => component.volumeMM3));
  let centroidMM: Point | null = null;
  if (components.length > 0) {
    const origin = components[0].centroidMM, numerators: Point = [0, 0, 0];
    for (const component of components) for (let axis = 0; axis < 3; axis++) numerators[axis] = finite(numerators[axis]
      + product(component.volumeMM3, finite(component.centroidMM[axis] - origin[axis])));
    centroidMM = numerators.map((value, axis) => shifted(origin[axis], quotient(value, volumeMM3))) as Point;
  }
  check(surfaceD1EvaluationCount === components.length, CODE.INPUT, 'exactly one new native support D1 sample per measured component required');
  const report: CoplanarFaceBooleanExtrusionPropertiesReport = {
    schema: 'barocss-native-coplanar-face-boolean-extrusion-properties', version: 0, evaluationId: extrusion.options.evaluationId,
    lengthUnit: 'mm', areaUnit: 'mm2', volumeUnit: 'mm3', sourceFrame: 'authored-xyz-no-axis-conversion', empty: components.length === 0,
    componentCount: components.length, shellCount: extrusion.shells.length, holeCount: region.loops.filter(loop => loop.role === 'hole').length,
    boundarySegmentCount, surfaceD1EvaluationCount, areaMM2, volumeMM3, centroidMM, distanceMM: extrusion.options.distanceMM,
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    numericPolicy: { moments: 'signed-directed-loops-shifted-by-outer-first-uv', areaCancellation: '128-epsilon-absolute-shifted-cross-sum',
      areaComparison: 'own-area-cancellation-threshold-plus-parent-declared-uncertainty-and-128-epsilon-area-scale',
      centroid: 'actual-native-support-point-plus-actual-half-translation', aggregate: 'shifted-volume-weighted-component-centroids', zeroFirstMomentsAllowed: true },
    quality: { authority: 'actual-native-affine-support-canonical-trim-and-positive-normal-extrusion-distance', constructionEstimateOnly: true,
      centroidMeaning: 'homogeneous-geometric-construction-centroid-not-density-or-mass', centroidIsInteriorWitness: false,
      componentAggregation: 'separate-native-component-shells-not-spatial-overlap-union', endpointPolicy: 'canonical-trim-incidence-and-unsnapped-native-edges-remain-distinct',
      workScope: 'new-component-support-d1-only-excludes-native-parent-reconstruction', globalBinary64ErrorCertified: false,
      globalShapeErrorCertified: false, manifoldCertified: false, exactSewingCertified: false, solidCertified: false,
      manufacturingToleranceCertified: false, densityCertified: false, massCertified: false, inertiaCertified: false, ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    inheritedBindingResiduals: { maximumPointDifferenceMM: extrusion.report.maximumPointDifferenceMM, maximumEndpointDifferenceMM: extrusion.report.maximumEndpointDifferenceMM },
    budgetFailure: 'atomic-refusal-no-partial-construction-properties', limits: { maximumBoundarySegments: 64, maximumSurfaceEvaluations: 8,
      ownValues: 1048576, ownDepth: 40, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 },
  };
  return snapshot({ extrusion, options, components, report }) as CoplanarFaceBooleanExtrusionPropertiesResult;
}
/** Bit-sensitive complete reconstruction from the current native parent, not acceptance of caller metrics. */
export function validateCoplanarFaceBooleanExtrusionProperties(input: CoplanarFaceBooleanExtrusionPropertiesResult): CoplanarFaceBooleanExtrusionPropertiesReport {
  const owned = record(snapshot(input, CODE.OWNED), ['extrusion', 'options', 'components', 'report'], CODE.OWNED) as unknown as CoplanarFaceBooleanExtrusionPropertiesResult;
  let expected: CoplanarFaceBooleanExtrusionPropertiesResult;
  try { expected = measureCoplanarFaceBooleanExtrusion(owned.extrusion, owned.options); } catch (cause) {
    throw new CoplanarFaceBooleanExtrusionPropertiesError(CODE.OWNED, 'owned complete native construction-property reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned native source/component/moment/metric/centroid/work/quality report mismatch');
  return snapshot(expected.report, CODE.OWNED) as CoplanarFaceBooleanExtrusionPropertiesReport;
}
