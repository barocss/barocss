import { validateCurve } from '../core/math.js';
import { ownSnapshot, hasExactOwnFields, type OwnSnapshotSpec } from '../core/own-data.js';
import { isFrom, kernelRefusal, type KernelError } from '../core/barocss-error.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import { SectionRationalContext, type SectionRational } from '../section-rational-internal.js';
import type { Curve } from '../types.js';

export type ChartCode = 'INPUT' | 'SUPPORT' | 'BUDGET' | 'UNRESOLVED';
export type ChartError = KernelError & { readonly code: ChartCode };
export interface ChartOptions { readonly maxOperations?: number; readonly maxDepth?: number }
export type ChartHomogeneousPoint = readonly [bigint, bigint, bigint, bigint];
export type ChartHomogeneousCubic = readonly [ChartHomogeneousPoint, ChartHomogeneousPoint, ChartHomogeneousPoint, ChartHomogeneousPoint];
export interface ChartRatio { readonly n: bigint; readonly d: bigint }
export interface ChartBox { readonly slope: readonly [ChartRatio, ChartRatio]; readonly height: readonly [ChartRatio, ChartRatio] }
/** Exact original t interval is [index/2^depth,(index+1)/2^depth]. Not a native Curve. */
export interface ChartNode { readonly id: number; readonly curve: number; readonly depth: number; readonly index: number; readonly controls: ChartHomogeneousCubic }
export interface ChartProgress {
  readonly coordinate: 'slope' | 'height'; readonly sign: 1 | -1;
  /** Coefficients are 10*D^2 times the original homogeneous derivative numerator. */
  readonly coefficients: readonly bigint[]; readonly minimum: bigint; readonly positiveScale: 10;
}
export interface ChartCounts {
  readonly rational: ReturnType<SectionRationalContext['counts']>; readonly directOperations: number; readonly totalOperations: number; readonly work: number; readonly maximumDirectBits: number; readonly curves: number; readonly nodes: number;
}
export interface ChartCurve {
  readonly source: Curve;
  /** Root controls equal D times the exact original stored [cpX*w,cpY*w,cpZ*w,w]. */
  readonly denominator: bigint;
  readonly root: ChartNode;
  readonly progress: ChartProgress;
}
export const CHART_LIMITS = Object.freeze({ operations: 200000, integerBits: 8192, work: 1048576, curves: 2, nodes: 256, depth: 8 } as const);
const SOURCE = 'cylindrical-wrap-chart';
const CURVE_FIELDS = ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'];
const CUBIC = [1, 3, 3, 1], QUADRATIC = [1, 2, 1], QUINTIC = [1, 5, 10, 10, 5, 1];
export function chartFailure(code: ChartCode, detail: string): never { throw kernelRefusal(SOURCE, code, `Wrap chart: ${detail}`) as ChartError; }
export function isCylindricalWrapChartError(error: unknown): error is ChartError {
  try { return isFrom<ChartCode>(error, SOURCE); } catch { return false; }
}
function wrap(code: ChartCode, detail: string): never { return chartFailure(code, detail); }
function rationalFailure(kind: 'BUDGET' | 'REPRESENTABILITY', detail: string): never { return chartFailure(kind === 'BUDGET' ? 'BUDGET' : 'UNRESOLVED', detail); }
const OWN: OwnSnapshotSpec<ChartCode> = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail: chartFailure, wrap, isRefusal: isCylindricalWrapChartError };
interface State {
  directOperations: number; work: number; maximumDirectBits: number;
  readonly curves: Set<ChartCurve>; readonly nodes: Set<ChartNode>;
  readonly splits: Map<ChartNode, readonly [ChartNode, ChartNode]>; readonly boxes: Map<ChartNode, ChartBox>;
}
const STATES = new WeakMap<ChartContext, State>();
function stateOf(ctx: ChartContext): State {
  const state = STATES.get(ctx);
  if (!state) chartFailure('INPUT', 'an original request-local chart context is required');
  return state;
}
function bigint(value: bigint): void { if (typeof value !== 'bigint') chartFailure('INPUT', 'exact integer operands are required'); }
function direct(ctx: ChartContext): State {
  const state = stateOf(ctx); state.directOperations++; state.work++; ctx.check(); return state;
}
/** One ledger for both admitted curves and every child/pair/cone operation in this request. */
export class ChartContext {
  readonly q = new SectionRationalContext(rationalFailure);
  readonly maxOperations: number;
  readonly maxDepth: number;
  readonly limits = CHART_LIMITS;
  constructor(options: ChartOptions = {}) {
    const copied = ownSnapshot(options, false, OWN);
    if (!copied || typeof copied !== 'object' || Array.isArray(copied)) chartFailure('INPUT', 'plain own chart options are required');
    for (const key of Object.keys(copied)) if (key !== 'maxOperations' && key !== 'maxDepth') chartFailure('INPUT', 'unknown chart option');
    const data = copied as Record<string, unknown>, maximum = data.maxOperations === undefined ? CHART_LIMITS.operations : data.maxOperations, depth = data.maxDepth === undefined ? CHART_LIMITS.depth : data.maxDepth;
    if (typeof maximum !== 'number' || !Number.isSafeInteger(maximum) || maximum < 1 || maximum > CHART_LIMITS.operations) chartFailure('INPUT', 'the exact operation limit may only tighten200000');
    if (typeof depth !== 'number' || !Number.isSafeInteger(depth) || depth < 0 || depth > CHART_LIMITS.depth) chartFailure('INPUT', 'the subdivision depth may only tighten0..8');
    this.maxOperations = maximum; this.maxDepth = depth;
    STATES.set(this, { directOperations: 0, work: 0, maximumDirectBits: 0, curves: new Set(), nodes: new Set(), splits: new Map(), boxes: new Map() });
    Object.freeze(this);
  }
  check(): void {
    const state = stateOf(this);
    if (this.q.counts().operations + state.directOperations > this.maxOperations) chartFailure('BUDGET', 'the shared rational/direct operation budget was exceeded');
    if (state.work > CHART_LIMITS.work) chartFailure('BUDGET', 'the shared chart work budget was exceeded');
  }
  charge(amount = 1): void {
    if (!Number.isSafeInteger(amount) || amount < 0) chartFailure('INPUT', 'bounded nonnegative work is required');
    stateOf(this).work += amount; this.check();
  }
  integer(value: bigint): bigint {
    bigint(value); const state = direct(this), bits = (value < 0n ? -value : value).toString(2).length;
    if (bits > CHART_LIMITS.integerBits) chartFailure('BUDGET', 'the chart integer exceeds8192 bits');
    state.maximumDirectBits = Math.max(state.maximumDirectBits, bits); return value;
  }
  add(a: bigint, b: bigint): bigint { bigint(a); bigint(b); return this.integer(a + b); }
  sub(a: bigint, b: bigint): bigint { bigint(a); bigint(b); return this.integer(a - b); }
  mul(a: bigint, b: bigint): bigint { bigint(a); bigint(b); return this.integer(a * b); }
  neg(a: bigint): bigint { bigint(a); return this.integer(-a); }
  abs(a: bigint): bigint { return this.compare(a, 0n) < 0 ? this.neg(a) : a; }
  compare(a: bigint, b: bigint): number {
    bigint(a); bigint(b); direct(this); if (a < b) return -1;
    direct(this); return a > b ? 1 : 0;
  }
  div(a: bigint, b: bigint): bigint {
    if (this.compare(b, 0n) === 0) chartFailure('UNRESOLVED', 'an exact integer divisor is zero');
    const quotient = this.integer(a / b), remainder = this.integer(a % b);
    if (this.compare(remainder, 0n) !== 0) chartFailure('UNRESOLVED', 'integer division must be exact');
    return quotient;
  }
  /** Negative bits use the exact BigInt right-shift operation, not an exact rational division. */
  shift(value: bigint, bits: number): bigint {
    bigint(value);
    if (!Number.isSafeInteger(bits) || Math.abs(bits) > CHART_LIMITS.integerBits) chartFailure('INPUT', 'a bounded integer shift is required');
    return this.integer(bits >= 0 ? value << BigInt(bits) : value >> BigInt(-bits));
  }
  bitAnd(a: bigint, b: bigint): bigint { bigint(a); bigint(b); return this.integer(a & b); }
  requireCurve(curve: ChartCurve): void { if (!stateOf(this).curves.has(curve)) chartFailure('INPUT', 'the curve must be an immutable chart owned by this context'); this.charge(); }
  requireNode(node: ChartNode): void { if (!stateOf(this).nodes.has(node)) chartFailure('INPUT', 'the node must be an immutable chart owned by this context'); this.charge(); }
  counts(): ChartCounts {
    const state = stateOf(this), rational = this.q.counts();
    return { rational, directOperations: state.directOperations, totalOperations: rational.operations + state.directOperations, work: state.work, maximumDirectBits: state.maximumDirectBits, curves: state.curves.size, nodes: state.nodes.size };
  }
}
function freezeData(value: unknown): void {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.freeze(value); for (const child of Object.values(value)) freezeData(child);
}
function sourceSnapshot(input: unknown): Curve {
  const data = ownSnapshot(input, false, OWN);
  if (!data || typeof data !== 'object' || Array.isArray(data) || !hasExactOwnFields(data as Record<string, unknown>, CURVE_FIELDS)) chartFailure('INPUT', 'exact own cubic Curve fields are required');
  const source = data as Curve;
  if (source.kind !== 'curve' || source.degree !== 3 || !Array.isArray(source.controlPoints) || source.controlPoints.length !== 4) chartFailure('SUPPORT', 'one stored rational cubic with four poles is required');
  try { validateCurve(source); } catch { chartFailure('INPUT', 'invalid native cubic data'); }
  if (source.id.length > 64 || source.knots.length !== 8) chartFailure('INPUT', 'bounded native cubic fields are required');
  for (let i = 0; i < 8; i++) if (source.knots[i] !== (i < 4 ? 0 : 1)) chartFailure('SUPPORT', 'the original cubic domain must remain clamped[0,1]');
  for (let i = 0; i < 4; i++) {
    if (!(source.weights[i] >= 0.5 && source.weights[i] <= 1)) chartFailure('SUPPORT', 'stored weights must lie within[0.5,1]');
    const p = source.controlPoints[i];
    if (!(p[0] > 0 && p[1] > 0)) chartFailure('SUPPORT', 'stored X/Y poles must be strictly positive');
    for (const coordinate of p) if (Math.abs(coordinate) > CadNumericPolicy.coordinateAbs) chartFailure('SUPPORT', 'stored poles must remain within the native CAD range');
  }
  return source;
}
function commonControls(source: Curve, ctx: ChartContext): { controls: ChartHomogeneousCubic; denominator: bigint } {
  const q = ctx.q, rows: SectionRational[][] = []; let denominator = 1n;
  for (let i = 0; i < 4; i++) {
    const w = q.from(source.weights[i]), row = [q.mul(q.from(source.controlPoints[i][0]), w), q.mul(q.from(source.controlPoints[i][1]), w), q.mul(q.from(source.controlPoints[i][2]), w), w];
    for (const value of row) {
      if (ctx.compare(value.d, 0n) <= 0 || ctx.compare(ctx.bitAnd(value.d, ctx.sub(value.d, 1n)), 0n) !== 0) chartFailure('SUPPORT', 'stored homogeneous denominators must be positive powers of two');
      if (ctx.compare(value.d, denominator) > 0) denominator = value.d;
    }
    rows.push(row); ctx.check();
  }
  const controls: ChartHomogeneousPoint[] = [];
  for (const row of rows) {
    const point: bigint[] = [];
    for (const value of row) point.push(ctx.mul(value.n, ctx.div(denominator, value.d)));
    controls.push(Object.freeze(point) as unknown as ChartHomogeneousPoint);
  }
  return { controls: Object.freeze(controls) as unknown as ChartHomogeneousCubic, denominator };
}
function derivativeNumerator(controls: ChartHomogeneousCubic, first: 0 | 3, second: 1 | 2, ctx: ChartContext): bigint[] {
  const da: bigint[] = [], db: bigint[] = [], out: bigint[] = [];
  for (let i = 0; i < 3; i++) { da.push(ctx.mul(3n, ctx.sub(controls[i + 1][first], controls[i][first]))); db.push(ctx.mul(3n, ctx.sub(controls[i + 1][second], controls[i][second]))); }
  for (let k = 0; k < 6; k++) {
    let sum = 0n;
    for (let i = Math.max(0, k - 2); i <= Math.min(3, k); i++) {
      const j = k - i, factor = BigInt(CUBIC[i] * QUADRATIC[j] * (10 / QUINTIC[k]));
      const term = ctx.sub(ctx.mul(controls[i][first], db[j]), ctx.mul(controls[i][second], da[j]));
      sum = ctx.add(sum, ctx.mul(factor, term));
    }
    out.push(sum);
  }
  return out;
}
function strictProgress(coefficients: readonly bigint[], coordinate: ChartProgress['coordinate'], ctx: ChartContext): ChartProgress | null {
  const sign = ctx.compare(coefficients[0], 0n);
  if (sign === 0) return null;
  let minimum = ctx.abs(coefficients[0]);
  for (const coefficient of coefficients) {
    if (ctx.compare(coefficient, 0n) !== sign) return null;
    const value = ctx.abs(coefficient); if (ctx.compare(value, minimum) < 0) minimum = value;
  }
  return Object.freeze({ coordinate, sign: sign as 1 | -1, coefficients: Object.freeze([...coefficients]), minimum, positiveScale: 10 });
}
function makeNode(controls: ChartHomogeneousCubic, curve: number, depth: number, index: number, ctx: ChartContext): ChartNode {
  const state = stateOf(ctx);
  if (state.nodes.size >= CHART_LIMITS.nodes) chartFailure('BUDGET', 'the shared subdivision-node limit was exceeded');
  const node = Object.freeze({ id: state.nodes.size, curve, depth, index, controls }); state.nodes.add(node); ctx.charge(); return node;
}
/** Private projection data and one-coordinate progress only; no cylinder, B-rep, volume or Number-evaluator authority. */
export function prepareChartCurve(input: Curve, ctx: ChartContext): ChartCurve {
  const state = stateOf(ctx); ctx.charge();
  if (state.curves.size >= CHART_LIMITS.curves) chartFailure('BUDGET', 'this shared chart request admits at most two curves');
  const source = sourceSnapshot(input), { controls, denominator } = commonControls(source, ctx);
  const angular = strictProgress(derivativeNumerator(controls, 0, 1, ctx), 'slope', ctx);
  const progress = angular ?? strictProgress(derivativeNumerator(controls, 3, 2, ctx), 'height', ctx);
  if (!progress) chartFailure('UNRESOLVED', 'strict whole-span progress of either projected coordinate could not be certified');
  freezeData(source);
  const root = makeNode(controls, state.curves.size, 0, 0, ctx), curve = Object.freeze({ source, denominator, root, progress });
  state.curves.add(curve); ctx.check(); return curve;
}
/** Ratios are internal exact pairs, not Number coordinates or a serialized proof format. */
export function chartCompareRatios(a: ChartRatio, b: ChartRatio, ctx: ChartContext): number {
  if (ctx.compare(a.d, 0n) <= 0 || ctx.compare(b.d, 0n) <= 0) chartFailure('INPUT', 'ratio denominators must be positive');
  return ctx.compare(ctx.mul(a.n, b.d), ctx.mul(b.n, a.d));
}
function frozenRatio(n: bigint, d: bigint): ChartRatio { return Object.freeze({ n, d }); }
export function chartBox(node: ChartNode, ctx: ChartContext): ChartBox {
  ctx.requireNode(node); const state = stateOf(ctx), hit = state.boxes.get(node); if (hit) return hit;
  let lowSlope = frozenRatio(node.controls[0][1], node.controls[0][0]), highSlope = lowSlope;
  let lowHeight = frozenRatio(node.controls[0][2], node.controls[0][3]), highHeight = lowHeight;
  for (let i = 1; i < 4; i++) {
    const p = node.controls[i], slope = frozenRatio(p[1], p[0]), height = frozenRatio(p[2], p[3]);
    if (chartCompareRatios(slope, lowSlope, ctx) < 0) lowSlope = slope;
    if (chartCompareRatios(slope, highSlope, ctx) > 0) highSlope = slope;
    if (chartCompareRatios(height, lowHeight, ctx) < 0) lowHeight = height;
    if (chartCompareRatios(height, highHeight, ctx) > 0) highHeight = height;
  }
  const box: ChartBox = Object.freeze({ slope: Object.freeze([lowSlope, highSlope]) as readonly [ChartRatio, ChartRatio], height: Object.freeze([lowHeight, highHeight]) as readonly [ChartRatio, ChartRatio] });
  state.boxes.set(node, box); ctx.check(); return box;
}
/** Exact de Casteljau halves. Every child control has one common factor8, not independent row scales. */
export function splitChartNode(node: ChartNode, ctx: ChartContext): readonly [ChartNode, ChartNode] {
  ctx.requireNode(node); const state = stateOf(ctx), hit = state.splits.get(node); if (hit) return hit;
  if (node.depth >= ctx.maxDepth) chartFailure('UNRESOLVED', 'the tightened chart subdivision depth was reached');
  if (state.nodes.size + 2 > CHART_LIMITS.nodes) chartFailure('BUDGET', 'the shared subdivision-node limit was exceeded');
  const triangle: bigint[][][] = [];
  const first: bigint[][] = []; for (const point of node.controls) first.push([...point]); triangle.push(first);
  for (let level = 1; level <= 3; level++) {
    const previous = triangle[level - 1], row: bigint[][] = [];
    for (let i = 0; i < previous.length - 1; i++) { const point: bigint[] = []; for (let axis = 0; axis < 4; axis++) point.push(ctx.add(previous[i][axis], previous[i + 1][axis])); row.push(point); }
    triangle.push(row);
  }
  const left: ChartHomogeneousPoint[] = [], right: ChartHomogeneousPoint[] = [];
  for (let i = 0; i < 4; i++) {
    const a: bigint[] = [], b: bigint[] = [];
    for (let axis = 0; axis < 4; axis++) { a.push(ctx.shift(triangle[i][0][axis], 3 - i)); b.push(ctx.shift(triangle[3 - i][i][axis], i)); }
    left.push(Object.freeze(a) as unknown as ChartHomogeneousPoint); right.push(Object.freeze(b) as unknown as ChartHomogeneousPoint);
  }
  const lower = makeNode(Object.freeze(left) as unknown as ChartHomogeneousCubic, node.curve, node.depth + 1, 2 * node.index, ctx);
  const upper = makeNode(Object.freeze(right) as unknown as ChartHomogeneousCubic, node.curve, node.depth + 1, 2 * node.index + 1, ctx);
  const children = Object.freeze([lower, upper]) as readonly [ChartNode, ChartNode]; state.splits.set(node, children); ctx.check(); return children;
}
