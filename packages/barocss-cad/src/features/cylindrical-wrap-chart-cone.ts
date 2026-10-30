import { chartFailure, isCylindricalWrapChartError, type ChartContext, type ChartCurve, type ChartHomogeneousCubic } from './cylindrical-wrap-chart.js';

type Endpoint = 0 | 1;
type Pair = readonly [bigint, bigint];
type Triple = readonly [bigint, bigint, bigint];
type TextPair = readonly [string, string];
type TextTriple = readonly [string, string, string];
interface ConeSide {
  readonly sourceDenominator: string;
  /** These are exactly 60*D^2 times the original degree-six product coefficients. */
  readonly projected: readonly TextTriple[];
  readonly endpointFactor: 't' | 'one-minus-t';
  /** Integer pairs are exactly 60 times the factored degree-five coefficients. */
  readonly factored: readonly TextPair[];
  readonly functional: readonly string[];
  readonly sign: 1 | -1;
}
export interface ChartConeCertificate {
  readonly method: 'opposite-strict-bernstein-endpoint-cones';
  readonly relation: 'projected-images-share-only-prescribed-endpoint';
  readonly curves: readonly [string, string];
  readonly endpoints: readonly [Endpoint, Endpoint];
  readonly worldEndpoint: readonly [number, number, number];
  readonly projectedVertex: TextTriple;
  readonly normal: {
    readonly integers: TextPair;
    readonly denominator: string;
    readonly candidate: readonly [number, number];
    readonly origin: 'hint' | 'outgoing-tangents';
  };
  readonly projectionDegree: 6;
  readonly factoredDegree: 5;
  readonly wholeOriginalIntervals: true;
  readonly first: ConeSide;
  readonly second: ConeSide;
  readonly requiresIndividualProgress: true;
  readonly diagnosticOnly: true;
  readonly solidQualified: false;
  readonly sourceBindingCertified: false;
  readonly cylinderCertified: false;
  readonly wholeLoopCertified: false;
  readonly volumeCertified: false;
  readonly globalEvaluatorErrorCertified: false;
}

const CUBIC = [1n, 3n, 3n, 1n];
const SEXTIC = [1n, 6n, 15n, 20n, 15n, 6n, 1n];

function product(controls: ChartHomogeneousCubic, a: number, b: number, ctx: ChartContext): bigint[] {
  const out: bigint[] = [];
  for (let k = 0; k <= 6; k++) {
    let sum = 0n;
    for (let i = Math.max(0, k - 3); i <= Math.min(3, k); i++) {
      const j = k - i, weight = ctx.mul(CUBIC[i], CUBIC[j]);
      sum = ctx.add(sum, ctx.mul(weight, ctx.mul(controls[i][a], controls[j][b])));
    }
    out.push(ctx.mul(ctx.div(60n, SEXTIC[k]), sum));
  }
  return out;
}
function projection(curve: ChartCurve, ctx: ChartContext): Triple[] {
  const controls = curve.root.controls, a = product(controls, 1, 3, ctx), b = product(controls, 2, 0, ctx), c = product(controls, 0, 3, ctx), out: Triple[] = [];
  for (let i = 0; i <= 6; i++) {
    if (ctx.compare(c[i], 0n) <= 0) chartFailure('UNRESOLVED', 'The entire projected denominator must be positive');
    out.push([a[i], b[i], c[i]]);
  }
  return out;
}
function equalProjected(a: Triple, b: Triple, ctx: ChartContext): boolean {
  return ctx.compare(ctx.mul(a[0], b[2]), ctx.mul(b[0], a[2])) === 0 && ctx.compare(ctx.mul(a[1], b[2]), ctx.mul(b[1], a[2])) === 0;
}
function factor(projected: readonly Triple[], vertex: Triple, endpoint: Endpoint, ctx: ChartContext): Pair[] {
  const offset: Pair[] = [];
  for (const p of projected) offset.push([ctx.sub(ctx.mul(vertex[2], p[0]), ctx.mul(vertex[0], p[2])), ctx.sub(ctx.mul(vertex[2], p[1]), ctx.mul(vertex[1], p[2]))]);
  const at = endpoint === 0 ? 0 : 6;
  if (ctx.compare(offset[at][0], 0n) !== 0 || ctx.compare(offset[at][1], 0n) !== 0) chartFailure('UNRESOLVED', 'An endpoint factor requires exact zero coefficients');
  const out: Pair[] = [];
  for (let i = 0; i < 6; i++) {
    const source = endpoint === 0 ? i + 1 : i, divisor = endpoint === 0 ? i + 1 : 6 - i;
    // G_i=6*F_(i+1)/(i+1), or G_i=6*F_i/(6-i). All divisors divide 60.
    const scale = ctx.div(360n, BigInt(divisor));
    out.push([ctx.mul(scale, offset[source][0]), ctx.mul(scale, offset[source][1])]);
  }
  return out;
}
function normalSnapshot(input: readonly [number, number]): [number, number] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) chartFailure('INPUT', 'A normal hint must be one plain own pair');
  const keys = Reflect.ownKeys(input), descriptors = Object.getOwnPropertyDescriptors(input);
  const length = Object.getOwnPropertyDescriptor(input, 'length');
  if (keys.length !== 3 || length?.value !== 2) chartFailure('INPUT', 'A normal hint must have exactly two entries');
  const out: number[] = [];
  for (let i = 0; i < 2; i++) {
    const descriptor = descriptors[String(i)];
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable || typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value)) chartFailure('INPUT', 'Finite own normal coordinates without getters are required');
    out.push(descriptor.value);
  }
  return [out[0], out[1]];
}
function approximateDirection(value: Pair, ctx: ChartContext): [number, number] {
  const x = ctx.abs(value[0]), z = ctx.abs(value[1]);
  ctx.charge(2);
  const bits = Math.max(x.toString(2).length, z.toString(2).length), shift = Math.max(0, bits - 450);
  // This lossy shared right shift is a hint only. It never enters the exact sign proof.
  const a = Number(ctx.shift(value[0], -shift)), b = Number(ctx.shift(value[1], -shift)), length = Math.hypot(a, b);
  if (!(length > 0 && Number.isFinite(length))) chartFailure('UNRESOLVED', 'No finite outgoing tangent candidate was resolved');
  return [a / length, b / length];
}
function candidate(first: readonly Pair[], second: readonly Pair[], endpoints: readonly [Endpoint, Endpoint], ctx: ChartContext): [number, number] {
  const a = approximateDirection(first[endpoints[0] === 0 ? 0 : 5], ctx), b = approximateDirection(second[endpoints[1] === 0 ? 0 : 5], ctx);
  const out: [number, number] = [a[0] - b[0], a[1] - b[1]];
  if (!Number.isFinite(out[0]) || !Number.isFinite(out[1]) || out[0] === 0 && out[1] === 0) chartFailure('UNRESOLVED', 'The outgoing tangent candidate does not separate the edges');
  return out;
}
function integerNormal(value: readonly [number, number], ctx: ChartContext): { pair: Pair; denominator: bigint } {
  const x = ctx.q.from(value[0]), z = ctx.q.from(value[1]), denominator = ctx.compare(x.d, z.d) >= 0 ? x.d : z.d;
  const pair: Pair = [ctx.mul(x.n, ctx.div(denominator, x.d)), ctx.mul(z.n, ctx.div(denominator, z.d))];
  if (ctx.compare(pair[0], 0n) === 0 && ctx.compare(pair[1], 0n) === 0) chartFailure('UNRESOLVED', 'The candidate normal is zero');
  ctx.check(); return { pair, denominator };
}
function signs(values: readonly Pair[], normal: Pair, ctx: ChartContext): { coefficients: bigint[]; sign: 1 | -1 } {
  const coefficients: bigint[] = [];
  let sign: 1 | -1 | null = null;
  for (const value of values) {
    const coefficient = ctx.add(ctx.mul(normal[0], value[0]), ctx.mul(normal[1], value[1])), current = ctx.compare(coefficient, 0n);
    if (current === 0 || sign !== null && current !== sign) chartFailure('UNRESOLVED', 'Strict whole-interval Bernstein cone signs were not resolved');
    sign = current < 0 ? -1 : 1; coefficients.push(coefficient);
  }
  return { coefficients, sign: sign! };
}
function text(value: bigint, ctx: ChartContext): string { ctx.charge(); return value.toString(); }
function pairText(value: Pair, ctx: ChartContext): TextPair { return Object.freeze([text(value[0], ctx), text(value[1], ctx)] as const); }
function tripleText(value: Triple, ctx: ChartContext): TextTriple { return Object.freeze([text(value[0], ctx), text(value[1], ctx), text(value[2], ctx)] as const); }
function side(curve: ChartCurve, projected: readonly Triple[], factored: readonly Pair[], functional: readonly bigint[], sign: 1 | -1, endpoint: Endpoint, ctx: ChartContext): ConeSide {
  const projectionText: TextTriple[] = [], factoredText: TextPair[] = [], functionalText: string[] = [];
  for (const value of projected) projectionText.push(tripleText(value, ctx));
  for (const value of factored) factoredText.push(pairText(value, ctx));
  for (const value of functional) functionalText.push(text(value, ctx));
  return Object.freeze({ sourceDenominator: text(curve.denominator, ctx), projected: Object.freeze(projectionText), endpointFactor: endpoint === 0 ? 't' : 'one-minus-t', factored: Object.freeze(factoredText), functional: Object.freeze(functionalText), sign });
}

/** Private adjacent-edge projection proof. Per-edge progress and every other graph/pair condition remain required. */
export function certifyChartCone(first: ChartCurve, second: ChartCurve, firstEndpoint: Endpoint, secondEndpoint: Endpoint, ctx: ChartContext, normalHint?: readonly [number, number]): ChartConeCertificate {
  try {
    ctx.requireCurve(first); ctx.requireCurve(second);
    if (firstEndpoint !== 0 && firstEndpoint !== 1 || secondEndpoint !== 0 && secondEndpoint !== 1) chartFailure('INPUT', 'Shared endpoint indices must be exactly zero or one');
    const a = first.source.controlPoints[firstEndpoint === 0 ? 0 : 3], b = second.source.controlPoints[secondEndpoint === 0 ? 0 : 3];
    for (let axis = 0; axis < 3; axis++) if (!Object.is(a[axis], b[axis])) chartFailure('UNRESOLVED', 'The prescribed world endpoints must have identical stored binary64 coordinates');
    const firstProjection = projection(first, ctx), secondProjection = projection(second, ctx), vertex = firstProjection[firstEndpoint === 0 ? 0 : 6];
    if (!equalProjected(vertex, secondProjection[secondEndpoint === 0 ? 0 : 6], ctx)) chartFailure('UNRESOLVED', 'The prescribed projected endpoints differ exactly');
    const endpoints: readonly [Endpoint, Endpoint] = Object.freeze([firstEndpoint, secondEndpoint] as const), factoredFirst = factor(firstProjection, vertex, firstEndpoint, ctx), factoredSecond = factor(secondProjection, vertex, secondEndpoint, ctx);
    const normalCandidate = normalHint === undefined ? candidate(factoredFirst, factoredSecond, endpoints, ctx) : normalSnapshot(normalHint), normal = integerNormal(normalCandidate, ctx);
    const firstSigns = signs(factoredFirst, normal.pair, ctx), secondSigns = signs(factoredSecond, normal.pair, ctx);
    if (firstSigns.sign === secondSigns.sign) chartFailure('UNRESOLVED', 'The two whole-edge cones are not in opposite open half-planes');
    const result: ChartConeCertificate = Object.freeze({ method: 'opposite-strict-bernstein-endpoint-cones', relation: 'projected-images-share-only-prescribed-endpoint', curves: Object.freeze([first.source.id, second.source.id] as const), endpoints,
      worldEndpoint: Object.freeze([a[0], a[1], a[2]] as const), projectedVertex: tripleText(vertex, ctx),
      normal: Object.freeze({ integers: pairText(normal.pair, ctx), denominator: text(normal.denominator, ctx), candidate: Object.freeze([normalCandidate[0], normalCandidate[1]] as const), origin: normalHint === undefined ? 'outgoing-tangents' : 'hint' }),
      projectionDegree: 6, factoredDegree: 5, wholeOriginalIntervals: true,
      first: side(first, firstProjection, factoredFirst, firstSigns.coefficients, firstSigns.sign, firstEndpoint, ctx), second: side(second, secondProjection, factoredSecond, secondSigns.coefficients, secondSigns.sign, secondEndpoint, ctx),
      requiresIndividualProgress: true, diagnosticOnly: true, solidQualified: false, sourceBindingCertified: false, cylinderCertified: false, wholeLoopCertified: false, volumeCertified: false, globalEvaluatorErrorCertified: false });
    ctx.check(); return result;
  } catch (error) {
    if (isCylindricalWrapChartError(error)) throw error;
    chartFailure('INPUT', 'The stored curve pair and candidate normal could not be admitted');
  }
}
