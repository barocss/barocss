import { KernelError } from '../../core/barocss-error.js';
import { evaluateSurface } from '../../core/math.js';
import { exactPoint2FromXY, exactOrient2 } from '../../brep/planar-arrangement.js';
import type { ExactPoint2 } from '../../brep/planar-arrangement.js';
import { ExactAffinePlane } from '../../exact-proof/exact-affine-plane-internal.js';
import { CadNumericPolicy } from '../../numeric-policy.js';
import { SectionRationalContext } from '../../section-rational-internal.js';
import type { SectionRational } from '../../section-rational-internal.js';
import type { Surface } from '../../types.js';
import { reverseSurfaceAxis } from './surface-axis-reversal.js';
import type { ReversedSurfaceAxisResult, SurfaceAxisReversalOptions } from './surface-axis-reversal.js';

export const TrimmedSurfaceAxisReversalDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', SUPPORT: 'SUPPORT', DOMAIN: 'DOMAIN', TOPOLOGY: 'TOPOLOGY',
  REPRESENTABILITY: 'REPRESENTABILITY', BUDGET: 'BUDGET', BINDING: 'BINDING',
} as const);
export type TrimmedSurfaceAxisReversalDiagnosticCode = typeof TrimmedSurfaceAxisReversalDiagnosticCode[keyof typeof TrimmedSurfaceAxisReversalDiagnosticCode];
export class TrimmedSurfaceAxisReversalError extends KernelError {
  readonly code: TrimmedSurfaceAxisReversalDiagnosticCode;
  constructor(code: TrimmedSurfaceAxisReversalDiagnosticCode, detail: string, cause?: unknown) {
    super(('Trimmed Surface axis reversal: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'TrimmedSurfaceAxisReversalError'; this.code = code;
  }
}
export interface SurfaceAxisTrimLoop {
  readonly keep: 'inside' | 'outside'; readonly uv: readonly (readonly [number, number])[];
}
export interface OwnedSurfaceAxisTrimLoop { keep: 'inside' | 'outside'; uv: [number, number][] }
type RationalWork = ReturnType<SectionRationalContext['counts']>;
export interface TrimmedSurfaceAxisTransportReport {
  family: 'affine-plane-single-stored-trim-loop-axis-reversal';
  chartPolicy: typeof CadNumericPolicy.chartParameters; axis: 'u' | 'v';
  pointCount: number; bindingCount: number; roundedPointCount: number;
  originalWinding: 'cw' | 'ccw'; reversedWinding: 'cw' | 'ccw';
  maximumChartRounding: number; maximumWorldRoundingBound: number; maximumPointDifference: number;
  quality: { linearComparison: 1e-7; uvComparison: 1e-7; segmentBound: 'affine-endpoint-displacement';
    keepPreserved: true; pointOrderPreserved: true; nonselectedCoordinateBitsPreserved: true;
    doubleReversalBitsCertified: false; solidMass: 'not-applicable' };
  work: { orientationTests: number; edgePairTests: number; vertexPairTests: number;
    inputTopology: RationalWork; outputTopology: RationalWork; transport: RationalWork };
  limits: { maximumLoops: 1; maximumPoints: 160; maximumBindings: 160;
    maximumOrientationTests: 102400; maximumEdgePairTests: 25120; maximumVertexPairTests: 25440;
    rationalOperationsPerContext: 200000; rationalIntegerBits: 8192 };
}
export interface ReversedTrimmedSurfaceAxisResult extends ReversedSurfaceAxisResult {
  trimLoops: OwnedSurfaceAxisTrimLoop[]; trimTransport: TrimmedSurfaceAxisTransportReport;
}

type UV = [number, number];
type TopologyWork = { orientationTests: number; edgePairTests: number; vertexPairTests: number };
const CODE = TrimmedSurfaceAxisReversalDiagnosticCode;
function requireValue(condition: boolean, code: TrimmedSurfaceAxisReversalDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new TrimmedSurfaceAxisReversalError(code, detail);
}
function rationalFailure(kind: 'BUDGET' | 'REPRESENTABILITY', detail: string): never {
  throw new TrimmedSurfaceAxisReversalError(kind, detail);
}
/** Inspect descriptors before reading values: no getters, foreign arrays, sparse data, or extra fields. */
function ownData(value: unknown, fields: readonly string[] | number): PropertyDescriptorMap {
  requireValue(value !== null && typeof value === 'object', CODE.INPUT, 'plain own trim data required');
  const array = typeof fields === 'number', prototype = Object.getPrototypeOf(value);
  requireValue(array ? Array.isArray(value) && prototype === Array.prototype
    : !Array.isArray(value) && (prototype === Object.prototype || prototype === null), CODE.INPUT, 'plain own trim data required');
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
  requireValue(keys.length === (array ? fields + 1 : fields.length), CODE.INPUT, 'exact dense trim fields required');
  for (const key of keys) requireValue(typeof key === 'string' && 'value' in descriptors[key]
    && (array && key === 'length' || descriptors[key].enumerable === true), CODE.INPUT, 'trim accessors, symbols, and hidden fields refused');
  if (array) {
    requireValue(descriptors.length.value === fields, CODE.INPUT, 'trim array length differs');
    for (let i = 0; i < fields; i++) requireValue(Object.hasOwn(descriptors, String(i)), CODE.INPUT, 'dense trim array required');
  } else for (const field of fields) requireValue(Object.hasOwn(descriptors, field), CODE.INPUT, 'exact trim fields required');
  return descriptors;
}
function copyLoop(input: unknown, domain: ReversedSurfaceAxisResult['provenance']['domain']): OwnedSurfaceAxisTrimLoop {
  const loops = ownData(input, 1), data = ownData(loops['0'].value, ['keep', 'uv']);
  const keep: unknown = data.keep.value, points: unknown = data.uv.value;
  requireValue(keep === 'inside' || keep === 'outside', CODE.INPUT, 'trim keep must be inside or outside');
  requireValue(Array.isArray(points), CODE.INPUT, 'trim UV array required');
  const length = Object.getOwnPropertyDescriptor(points, 'length')?.value as number;
  requireValue(Number.isInteger(length) && length >= 3 && length <= 160, CODE.BUDGET, 'one stored trim loop with3..160 points required');
  const entries = ownData(points, length), uv: UV[] = [];
  for (let i = 0; i < length; i++) {
    const point = ownData(entries[String(i)].value, 2), u: unknown = point['0'].value, v: unknown = point['1'].value;
    requireValue(typeof u === 'number' && Number.isFinite(u) && typeof v === 'number' && Number.isFinite(v), CODE.INPUT, 'finite trim UV coordinates required');
    requireValue(u >= domain.u[0] && u <= domain.u[1] && v >= domain.v[0] && v <= domain.v[1], CODE.DOMAIN, 'stored trim point lies outside original domain');
    uv.push([u, v]);
  }
  return { keep, uv };
}
function between(a: UV, b: UV, p: UV): boolean {
  return p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0])
    && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
}
function orientation(a: ExactPoint2, b: ExactPoint2, c: ExactPoint2, work: TopologyWork): number {
  requireValue(++work.orientationTests <= 102400, CODE.BUDGET, 'exact orientation test budget exceeded');
  return exactOrient2(a, b, c);
}
function disjointBoxes(a: UV, b: UV, c: UV, d: UV): boolean {
  return Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0])
    || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1]);
}
/** Exact predicates on represented UV; forward collinear producer samples remain vertices. */
function topology(uv: UV[], work: TopologyWork): { winding: 'cw' | 'ccw'; rational: RationalWork } {
  const exact: ExactPoint2[] = [];
  for (const point of uv) exact.push(exactPoint2FromXY(point));
  for (let i = 0; i < uv.length; i++) {
    for (let j = i + 1; j < uv.length; j++) {
      requireValue(++work.vertexPairTests <= 25440, CODE.BUDGET, 'trim duplicate test budget exceeded');
      requireValue(uv[i][0] !== uv[j][0] || uv[i][1] !== uv[j][1], CODE.TOPOLOGY, 'repeated or collapsed trim vertex refused');
    }
    const next = (i + 1) % uv.length, following = (i + 2) % uv.length;
    if (orientation(exact[i], exact[next], exact[following], work) === 0)
      requireValue(between(uv[i], uv[following], uv[next]), CODE.TOPOLOGY, 'adjacent trim backtracking refused');
    for (let j = i + 2; j < uv.length; j++) {
      if (i === 0 && j === uv.length - 1) continue;
      requireValue(++work.edgePairTests <= 25120, CODE.BUDGET, 'trim edge pair budget exceeded');
      const end = (j + 1) % uv.length;
      if (disjointBoxes(uv[i], uv[next], uv[j], uv[end])) continue;
      const a = orientation(exact[i], exact[next], exact[j], work), b = orientation(exact[i], exact[next], exact[end], work);
      const c = orientation(exact[j], exact[end], exact[i], work), d = orientation(exact[j], exact[end], exact[next], work);
      const touch = a === 0 && between(uv[i], uv[next], uv[j]) || b === 0 && between(uv[i], uv[next], uv[end])
        || c === 0 && between(uv[j], uv[end], uv[i]) || d === 0 && between(uv[j], uv[end], uv[next]);
      requireValue(!touch && !(a * b < 0 && c * d < 0), CODE.TOPOLOGY, 'nonadjacent trim crossing, touch, or overlap refused');
    }
  }
  const q = new SectionRationalContext(rationalFailure);
  let area = q.rat(0n);
  for (let i = 0; i < uv.length; i++) {
    const a = uv[i], b = uv[(i + 1) % uv.length];
    area = q.add(area, q.sub(q.mul(q.from(a[0]), q.from(b[1])), q.mul(q.from(b[0]), q.from(a[1]))));
  }
  requireValue(area.n !== 0n, CODE.TOPOLOGY, 'zero area stored trim loop refused');
  return { winding: area.n > 0n ? 'ccw' : 'cw', rational: q.counts() };
}
function support(surface: Surface): ExactAffinePlane {
  requireValue(surface.degreeU === 1 && surface.degreeV === 1 && surface.controlPoints.length === 2
    && surface.controlPoints[0].length === 2 && surface.controlPoints[1].length === 2, CODE.SUPPORT, 'degree1x1 four-pole affine support required');
  const weight = surface.weights[0][0];
  for (const row of surface.weights) for (const value of row)
    requireValue(value === weight && value > 0, CODE.SUPPORT, 'equal positive support weights required');
  try { return new ExactAffinePlane(surface, 'Trim transport support'); }
  catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'exact affine support refused';
    throw new TrimmedSurfaceAxisReversalError(detail.includes('BUDGET:') ? CODE.BUDGET : CODE.SUPPORT, detail, cause);
  }
}
function selectedWorldScale(surface: Surface, axis: 'u' | 'v', q: SectionRationalContext, span: SectionRational): SectionRational {
  const origin = surface.controlPoints[0][0], end = axis === 'u' ? surface.controlPoints[1][0] : surface.controlPoints[0][1];
  let reach = q.rat(0n);
  for (let i = 0; i < 3; i++) reach = q.add(reach, q.abs(q.sub(q.from(end[i]), q.from(origin[i]))));
  return q.div(reach, span);
}
function nativeDifference(result: ReversedSurfaceAxisResult, original: UV, reversed: UV): number {
  const a = evaluateSurface(result.original, original[0], original[1]), b = evaluateSurface(result.surface, reversed[0], reversed[1]);
  const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  requireValue(Number.isFinite(distance) && distance <= CadNumericPolicy.linearTolerance, CODE.BINDING, 'original/mapped native trim binding exceeds linear policy');
  return distance;
}

/** Reverse the native support once and transport one simple stored polyline. This does not construct a B-rep face or a solid. */
export function reverseTrimmedSurfaceAxis(surfaceInput: Surface, trimLoopsInput: readonly SurfaceAxisTrimLoop[],
  inputOptions: SurfaceAxisReversalOptions): ReversedTrimmedSurfaceAxisResult {
  // Native admission and refusal precedence, coefficients, sources and the128-observation report remain unchanged.
  const result = reverseSurfaceAxis(surfaceInput, inputOptions), affine = support(result.original);
  const loop = copyLoop(trimLoopsInput, result.provenance.domain), work: TopologyWork = { orientationTests: 0, edgePairTests: 0, vertexPairTests: 0 };
  const inputTopology = topology(loop.uv, work), axis = result.provenance.axis, selected = axis === 'u' ? 0 : 1;
  const map = result.provenance.parameterMaps[axis], domain = map.domain, q = affine.rational;
  requireValue(map.orientation === -1, CODE.BINDING, 'selected parent parameter map must reverse orientation');
  const a = q.from(domain[0]), b = q.from(domain[1]), scale = selectedWorldScale(result.original, axis, q, q.sub(b, a));
  const uv: UV[] = [];
  let maximumChartRounding = 0, maximumWorldRoundingBound = 0, maximumPointDifference = 0, roundedPointCount = 0;
  for (const point of loop.uv) {
    const t = point[selected], exact = q.add(a, q.sub(b, q.from(t)));
    const mapped = t === domain[0] ? domain[1] : t === domain[1] ? domain[0] : q.nearest(exact);
    requireValue(Number.isFinite(mapped) && mapped >= domain[0] && mapped <= domain[1], CODE.REPRESENTABILITY, 'rounded trim parameter lies outside finite native domain');
    const delta = q.abs(q.sub(q.from(mapped), exact)), chartBound = q.upward(delta), worldBound = q.upward(q.mul(delta, scale));
    requireValue(chartBound <= CadNumericPolicy.uvBindingTolerance && worldBound <= CadNumericPolicy.linearTolerance,
      CODE.BINDING, 'one-rounding trim displacement exceeds original UV or linear policy');
    if (delta.n !== 0n) roundedPointCount++;
    const reversed: UV = selected === 0 ? [mapped, point[1]] : [point[0], mapped];
    uv.push(reversed);
    maximumChartRounding = Math.max(maximumChartRounding, chartBound);
    maximumWorldRoundingBound = Math.max(maximumWorldRoundingBound, worldBound);
    maximumPointDifference = Math.max(maximumPointDifference, nativeDifference(result, point, reversed));
  }
  const outputTopology = topology(uv, work);
  requireValue(outputTopology.winding !== inputTopology.winding, CODE.TOPOLOGY, 'rounded trim loop must reverse UV winding');
  const trimTransport: TrimmedSurfaceAxisTransportReport = {
    family: 'affine-plane-single-stored-trim-loop-axis-reversal', chartPolicy: CadNumericPolicy.chartParameters, axis,
    pointCount: uv.length, bindingCount: uv.length, roundedPointCount,
    originalWinding: inputTopology.winding, reversedWinding: outputTopology.winding,
    maximumChartRounding, maximumWorldRoundingBound, maximumPointDifference,
    quality: { linearComparison: 1e-7, uvComparison: 1e-7, segmentBound: 'affine-endpoint-displacement',
      keepPreserved: true, pointOrderPreserved: true, nonselectedCoordinateBitsPreserved: true,
      doubleReversalBitsCertified: false, solidMass: 'not-applicable' },
    work: { ...work, inputTopology: inputTopology.rational, outputTopology: outputTopology.rational, transport: q.counts() },
    limits: { maximumLoops: 1, maximumPoints: 160, maximumBindings: 160, maximumOrientationTests: 102400,
      maximumEdgePairTests: 25120, maximumVertexPairTests: 25440, rationalOperationsPerContext: 200000, rationalIntegerBits: 8192 },
  };
  return { ...result, trimLoops: [{ keep: loop.keep, uv }], trimTransport };
}
