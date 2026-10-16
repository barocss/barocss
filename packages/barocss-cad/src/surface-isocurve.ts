import { basis, validateSurface, validateCurve, surfaceDomain, curveDomain, evaluateSurface, evaluateCurve } from './math.js';
import { compileCurveSource, requireCurveValue } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Surface, Curve, Model, Point } from './types.js';
import { same as sameData } from './structural-equality.js';

export interface SurfaceIsoCurveOptions { fixedAxis: 'u' | 'v'; parameter: number; curveId: string }
export interface SurfaceIsoCurveBasis { start: number; poleIndices: number[]; values: number[] }
export interface SurfaceIsoCurveContribution {
  sourceUIndex: number; sourceVIndex: number; basisValue: number; factor: number; weightedPointMM: Point;
}
export interface SurfaceIsoCurvePole {
  curvePoleIndex: number; construction: 'endpoint-direct-copy' | 'homogeneous-contraction';
  endpointSourcePole: { uIndex: number; vIndex: number } | null;
  homogeneous: [number, number, number, number]; pointMM: Point; weight: number;
  contributions: SurfaceIsoCurveContribution[];
}
export interface SurfaceIsoCurveProvenance {
  kind: 'surface-parameter-isocurve'; sourceSurfaceId: string; curveId: string; fixedAxis: 'u' | 'v'; varyingAxis: 'u' | 'v';
  parameter: number; fixedDomain: [number, number]; varyingDomain: [number, number];
  endpoint: 'min' | 'max' | null; basis: SurfaceIsoCurveBasis; poles: SurfaceIsoCurvePole[];
}
export interface SurfaceIsoCurveReport {
  kind: 'surface-isocurve'; surfaceId: string; curveId: string; lengthUnit: 'mm'; fixedAxis: 'u' | 'v'; varyingAxis: 'u' | 'v';
  parameter: number; fixedDomain: [number, number]; varying: { degree: number; knots: number[]; domain: [number, number]; controlPointCount: number };
  endpointDirectCopy: boolean; basis: SurfaceIsoCurveBasis; construction: SurfaceIsoCurvePole[];
  guardedFixedParameter: boolean; guardedVaryingKnots: number[]; derivativeSemantics: 'native-guards-unchanged';
  observations: { varyingParameter: number; u: number; v: number; surfacePointMM: Point; curvePointMM: Point; differenceMM: number }[];
  maximumObservedDifferenceMM: number; authority: 'original-surface-coefficients'; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumGridAxis: 16; maximumPoles: 256; maximumDegree: 3; authoredIdCharacters: 48;
    snapshotValues: 4096; snapshotDepth: 8; arrayElements: 64; recordFields: 8; stringCharacters: 128; maximumObservations: 32; observationComparisonMM: 1e-7 };
}
export interface SurfaceIsoCurveResult {
  original: Surface; curve: Curve; source: string; sourceVersion: 0; model: Model; provenance: SurfaceIsoCurveProvenance; report: SurfaceIsoCurveReport;
}
const LABEL = 'Surface iso-Curve';
function check(condition: boolean, detail: string): asserts condition { requireCurveValue(condition, detail, LABEL); }
function snapshot(input: unknown): unknown {
  let remaining = 4096;
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 8, 'input exceeds4096 own values/depth8');
    if (typeof value === 'number') { check(Number.isFinite(value), 'finite numeric data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', 'plain numeric/string/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'foreign prototype unsupported');
    check(keys.length <= (array ? 65 : 8), 'own field bound exceeded');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable)), 'getters, symbols or hidden fields unsupported');
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 64 && keys.length === length + 1, 'bounded dense arrays required');
      const result: unknown[] = [];
      for (let i = 0; i < length; i++) { check(Object.hasOwn(descriptors, String(i)), 'sparse/extra array field'); result.push(copy(descriptors[String(i)].value, depth + 1)); }
      return result;
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
  };
  return copy(input, 0);
}
function record(input: unknown, fields: string[]): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), 'record required');
  const value = input as Record<string, unknown>; check(Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key)), 'exact fields required: ' + fields.join(',')); return value;
}
function id(input: unknown): string { check(typeof input === 'string' && input.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), 'ASCII ID1..48 required'); return input; }
function admit(input: unknown): Surface {
  const data = record(input, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
  check(data.kind === 'surface', 'original Surface required'); id(data.id);
  check(typeof data.degreeU === 'number' && Number.isInteger(data.degreeU) && data.degreeU >= 1 && data.degreeU <= 3 && typeof data.degreeV === 'number' && Number.isInteger(data.degreeV) && data.degreeV >= 1 && data.degreeV <= 3, 'original U/V degree1..3 required');
  const surface = data as unknown as Surface; validateSurface(surface);
  check(surface.controlPoints.every(row => row.every(p => p.every(n => Math.abs(n) <= 10000))), 'original XYZ coordinates within±10000mm required');
  return surface;
}

function finite(n: number): number { check(Number.isFinite(n), 'homogeneous construction must be finite'); return n; }
function samples(knots: number[], domain: [number, number]): number[] {
  const breaks = [...new Set(knots)].filter(k => k >= domain[0] && k <= domain[1]), values = new Set(breaks);
  for (let i = 0; i + 1 < breaks.length; i++) {
    const a = breaks[i], b = breaks[i + 1], delta = b - a, mid = Number.isFinite(delta) ? a + delta / 2 : a / 2 + b / 2;
    if (mid > a && mid < b) values.add(mid);
  }
  return [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
function guarded(knots: number[], degree: number, domain: [number, number], parameter: number): boolean {
  return parameter > domain[0] && parameter < domain[1] && knots.filter(k => k === parameter).length >= degree;
}
/** Native increasing-parameter Curve from an original rational Surface at fixed U or V. */
export function extractSurfaceIsoCurve(input: Surface, options: SurfaceIsoCurveOptions): SurfaceIsoCurveResult {
  try {
    const originalData = snapshot(input), optionData = snapshot(options), original = admit(originalData);
    const settings = record(optionData, ['fixedAxis', 'parameter', 'curveId']);
    check(settings.fixedAxis === 'u' || settings.fixedAxis === 'v', 'fixed axis must be u or v');
    const fixedAxis = settings.fixedAxis, varyingAxis = fixedAxis === 'u' ? 'v' : 'u', parameter = settings.parameter, curveId = id(settings.curveId);
    check(curveId !== original.id, 'Surface and Curve IDs must differ');
    const domain = surfaceDomain(original), fixedDomain = domain[fixedAxis], varyingDomain = domain[varyingAxis];
    check(typeof parameter === 'number' && Number.isFinite(parameter) && parameter >= fixedDomain[0] && parameter <= fixedDomain[1], 'finite parameter inside inclusive original fixed domain required');
    const fixedKnots = fixedAxis === 'u' ? original.knotsU : original.knotsV, fixedDegree = fixedAxis === 'u' ? original.degreeU : original.degreeV;
    const varyingKnots = varyingAxis === 'u' ? original.knotsU : original.knotsV, varyingDegree = varyingAxis === 'u' ? original.degreeU : original.degreeV;
    const countU = original.controlPoints.length, countV = original.controlPoints[0].length, fixedCount = fixedAxis === 'u' ? countU : countV, varyingCount = varyingAxis === 'u' ? countU : countV;
    const local = basis(fixedKnots, fixedDegree, fixedCount, parameter);
    check(local.values.every(Number.isFinite) && Number.isInteger(local.start) && local.start >= 0 && local.start + local.values.length <= fixedCount, 'native fixed basis indices and values required');
    const usedBasis: SurfaceIsoCurveBasis = { start: local.start, poleIndices: local.values.map((_, i) => local.start + i), values: local.values };
    const endpoint = parameter === fixedDomain[0] ? 'min' : parameter === fixedDomain[1] ? 'max' : null;
    const poles: SurfaceIsoCurvePole[] = Array.from({ length: varyingCount }, (_, curvePoleIndex): SurfaceIsoCurvePole => {
      if (endpoint !== null) {
        const fixed = endpoint === 'min' ? 0 : fixedCount - 1, uIndex = fixedAxis === 'u' ? fixed : curvePoleIndex, vIndex = fixedAxis === 'u' ? curvePoleIndex : fixed;
        const pointMM = copyCadData(original.controlPoints[uIndex][vIndex]), weight = original.weights[uIndex][vIndex], weightedPointMM = pointMM.map(n => finite(n * weight)) as Point;
        return { curvePoleIndex, construction: 'endpoint-direct-copy', endpointSourcePole: { uIndex, vIndex }, homogeneous: [...weightedPointMM, weight], pointMM, weight,
          contributions: [{ sourceUIndex: uIndex, sourceVIndex: vIndex, basisValue: 1, factor: weight, weightedPointMM }] };
      }
      const homogeneous: [number, number, number, number] = [0, 0, 0, 0];
      const contributions = local.values.map((basisValue, i) => {
        const fixed = local.start + i, sourceUIndex = fixedAxis === 'u' ? fixed : curvePoleIndex, sourceVIndex = fixedAxis === 'u' ? curvePoleIndex : fixed;
        const factor = finite(basisValue * original.weights[sourceUIndex][sourceVIndex]), point = original.controlPoints[sourceUIndex][sourceVIndex];
        const weightedPointMM = point.map(n => finite(factor * n)) as Point;
        for (let axis = 0; axis < 3; axis++) homogeneous[axis] = finite(homogeneous[axis] + weightedPointMM[axis]);
        homogeneous[3] = finite(homogeneous[3] + factor);
        return { sourceUIndex, sourceVIndex, basisValue, factor, weightedPointMM };
      });
      const weight = homogeneous[3]; check(weight > 0, 'positive finite contracted denominator required');
      const pointMM = [finite(homogeneous[0] / weight), finite(homogeneous[1] / weight), finite(homogeneous[2] / weight)] as Point;
      return { curvePoleIndex, construction: 'homogeneous-contraction', endpointSourcePole: null, homogeneous, pointMM, weight, contributions };
    });
    const candidate: Curve = { kind: 'curve', id: curveId, degree: varyingDegree, knots: copyCadData(varyingKnots), controlPoints: poles.map(p => p.pointMM), weights: poles.map(p => p.weight) };
    validateCurve(candidate);
    check(candidate.controlPoints.every(p => p.every(n => Math.abs(n) <= 10000)), 'generated Cartesian coefficients exceed native family range');
    check(sameData(curveDomain(candidate), varyingDomain), 'original varying domain bits must remain');
    const compiled = compileCurveSource(candidate.id, candidate.degree, candidate.controlPoints, candidate.knots, candidate.weights, LABEL);
    const expected: Model = { name: 'profile', version: 0, lengthUnit: 'mm', objects: [candidate] };
    check(sameData(compiled.model, expected) && sameData(curveDomain(compiled.curve), varyingDomain), 'actual source0 must preserve complete Curve/Model/degree/knot/domain/coefficient bits');
    const curve = compiled.curve, parameters = samples(curve.knots, varyingDomain);
    check(parameters.length <= 32, 'native observation bound exceeded');
    const observations = parameters.map(varyingParameter => {
      const u = fixedAxis === 'u' ? parameter : varyingParameter, v = fixedAxis === 'u' ? varyingParameter : parameter;
      const surfacePointMM = evaluateSurface(original, u, v), curvePointMM = evaluateCurve(curve, varyingParameter), differenceMM = Math.hypot(...curvePointMM.map((n, i) => n - surfacePointMM[i]));
      check(Number.isFinite(differenceMM) && differenceMM <= 1e-7, 'local Surface/Curve point observation exceeds 1e-7 mm');
      return { varyingParameter, u, v, surfacePointMM, curvePointMM, differenceMM };
    });
    return copyCadData({ original, curve, source: compiled.source, sourceVersion: 0, model: compiled.model,
      provenance: { kind: 'surface-parameter-isocurve', sourceSurfaceId: original.id, curveId, fixedAxis, varyingAxis, parameter, fixedDomain, varyingDomain, endpoint, basis: usedBasis, poles },
      report: { kind: 'surface-isocurve', surfaceId: original.id, curveId, lengthUnit: 'mm', fixedAxis, varyingAxis, parameter, fixedDomain,
        varying: { degree: curve.degree, knots: curve.knots, domain: varyingDomain, controlPointCount: curve.controlPoints.length }, endpointDirectCopy: endpoint !== null, basis: usedBasis, construction: poles,
        guardedFixedParameter: guarded(fixedKnots, fixedDegree, fixedDomain, parameter), guardedVaryingKnots: [...new Set(varyingKnots)].filter(k => guarded(varyingKnots, varyingDegree, varyingDomain, k)),
        derivativeSemantics: 'native-guards-unchanged', observations, maximumObservedDifferenceMM: Math.max(...observations.map(o => o.differenceMM)), authority: 'original-surface-coefficients',
        geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumGridAxis: 16, maximumPoles: 256, maximumDegree: 3, authoredIdCharacters: 48, snapshotValues: 4096, snapshotDepth: 8, arrayElements: 64, recordFields: 8, stringCharacters: 128, maximumObservations: 32, observationComparisonMM: 1e-7 } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid original Surface/iso-Curve options';
    throw new Error((message.startsWith(LABEL) ? message : LABEL + ': ' + message).slice(0, 1024), { cause: error });
  }
}
