import { ownSnapshot, type OwnSnapshotSpec } from '../core/own-data.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import {
  ChartContext, chartBox, chartCompareRatios, chartFailure, isCylindricalWrapChartError, splitChartNode,
  type ChartCode, type ChartCurve, type ChartNode, type ChartRatio,
} from './cylindrical-wrap-chart.js';

type Sense = 'forward' | 'reversed';
type Endpoint = 0 | 1;
type Classification = 'slope' | 'constant-slope-height';
type TextRatio = { readonly numerator: string; readonly denominator: string };
export interface ChartWindingUse { readonly chart: ChartCurve; readonly sense: Sense; readonly classification: Classification }
export interface ChartWindingPoint { readonly slope: ChartRatio; readonly height: ChartRatio; readonly origin: 'world' | 'vertex' }
export interface ChartWindingInterval { readonly depth: number; readonly index: number; readonly range: readonly [number, number] }
export interface ChartWindingEdgeReceipt {
  readonly curve: string;
  readonly sense: Sense;
  readonly classification: Classification;
  readonly contribution: -1 | 0 | 1;
  readonly method: 'constant-slope-outside' | 'outside-slope-range' | 'upper-endpoint-excluded' | 'endpoint-above' | 'endpoint-below' | 'midpoint-above' | 'midpoint-below' | 'root-box-above' | 'root-box-below';
  readonly interval: ChartWindingInterval;
  readonly root?: { readonly endpoint: Endpoint } | { readonly numerator: number; readonly depth: number };
  readonly height?: { readonly kind: 'point'; readonly value: TextRatio } | { readonly kind: 'box'; readonly lower: TextRatio; readonly upper: TextRatio };
}
export interface ChartWindingCertificate {
  readonly method: 'exact-upward-ray-monotone-slope';
  readonly winding: number;
  readonly point: { readonly slope: TextRatio; readonly height: TextRatio; readonly origin: 'world' | 'vertex' };
  readonly edges: readonly ChartWindingEdgeReceipt[];
  readonly axisUnits: { readonly slope: 'dimensionless-y-over-x'; readonly height: 'mm' };
  readonly halfOpen: 'minimum-inclusive-maximum-exclusive';
  readonly boundaryExcluded: true;
  readonly counts: ReturnType<ChartContext['counts']>;
  readonly limits: { readonly uses: 32; readonly depth: number };
  readonly meaning: {
    readonly exactStoredProjectedChainWinding: true;
    readonly individualProgressFromOwnedCharts: true;
    readonly loopClosureCertified: false;
    readonly loopSimplicityCertified: false;
    readonly componentContainmentCertified: false;
    readonly sourceCertified: false;
    readonly carrierCertified: false;
    readonly solidQualified: false;
    readonly volumeCertified: false;
    readonly globalEvaluatorErrorCertified: false;
  };
}

interface ProjectedEndpoint { slope: ChartRatio; height: ChartRatio }
interface Profile { endpoints: readonly [ProjectedEndpoint, ProjectedEndpoint]; classification: Classification; sign: 1 | -1 }
interface UseData { use: ChartWindingUse; profile: Profile }
interface UsePair { forward?: UseData; reversed?: UseData }
interface VertexPair { first?: ChartWindingPoint; last?: ChartWindingPoint }
interface State {
  readonly uses: WeakMap<ChartWindingUse, UseData>;
  readonly points: WeakSet<ChartWindingPoint>;
  readonly profiles: Map<ChartCurve, Profile>;
  readonly prepared: Map<ChartCurve, UsePair>;
  readonly vertices: Map<ChartCurve, VertexPair>;
}
interface RootRelation { above: boolean; method: ChartWindingEdgeReceipt['method']; interval: ChartWindingInterval; root?: ChartWindingEdgeReceipt['root']; height: NonNullable<ChartWindingEdgeReceipt['height']> }
const STATES = new WeakMap<ChartContext, State>(), MAX_USES = 32;
function wrap(code: ChartCode, detail: string): never { return chartFailure(code, detail); }
const OWN: OwnSnapshotSpec<ChartCode> = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail: chartFailure, wrap, isRefusal: isCylindricalWrapChartError };
function stateFor(ctx: ChartContext): State {
  let state = STATES.get(ctx);
  if (!state) {
    // The original method checks the core's context identity, even if a foreign object spoofs methods.
    ChartContext.prototype.check.call(ctx); state = { uses: new WeakMap(), points: new WeakSet(), profiles: new Map(), prepared: new Map(), vertices: new Map() }; STATES.set(ctx, state);
  }
  return state;
}
function ratio(n: bigint, d: bigint): ChartRatio { return Object.freeze({ n, d }); }
function endpoint(node: ChartNode, at: Endpoint): ProjectedEndpoint {
  const p = node.controls[at === 0 ? 0 : 3]; return Object.freeze({ slope: ratio(p[1], p[0]), height: ratio(p[2], p[3]) });
}
function classify(chart: ChartCurve, ctx: ChartContext): Profile {
  const first = endpoint(chart.root, 0), last = endpoint(chart.root, 1), controls = chart.root.controls;
  let classification: Classification;
  if (chart.progress.coordinate === 'slope') {
    if (chartCompareRatios(last.slope, first.slope, ctx) !== chart.progress.sign) chartFailure('UNRESOLVED', 'the owned slope progress and endpoint order disagree');
    classification = 'slope';
  } else {
    for (let i = 1; i < 4; i++) if (ctx.compare(ctx.mul(controls[i][1], controls[0][0]), ctx.mul(controls[0][1], controls[i][0])) !== 0) chartFailure('SUPPORT', 'winding height progress requires exactly constant projected slope');
    if (chartCompareRatios(last.height, first.height, ctx) !== chart.progress.sign) chartFailure('UNRESOLVED', 'the owned height progress and endpoint order disagree');
    classification = 'constant-slope-height';
  }
  return Object.freeze({ endpoints: Object.freeze([first, last] as const), classification, sign: chart.progress.sign });
}
/** Prepare one canonical-curve use. Sense changes traversal only, never the stored Curve. */
export function prepareChartWindingUse(chart: ChartCurve, sense: Sense, ctx: ChartContext): ChartWindingUse {
  ChartContext.prototype.requireCurve.call(ctx, chart);
  if (sense !== 'forward' && sense !== 'reversed') chartFailure('INPUT', 'a winding use sense must be forward or reversed');
  const state = stateFor(ctx); let pair = state.prepared.get(chart);
  if (!pair) { pair = {}; state.prepared.set(chart, pair); }
  const cached = sense === 'forward' ? pair.forward : pair.reversed; if (cached) return cached.use;
  let profile = state.profiles.get(chart);
  if (!profile) { profile = classify(chart, ctx); state.profiles.set(chart, profile); }
  const use = Object.freeze({ chart, sense, classification: profile.classification }), data = { use, profile };
  state.uses.set(use, data); if (sense === 'forward') pair.forward = data; else pair.reversed = data;
  ctx.check(); return use;
}
function admittedPoint(slope: ChartRatio, height: ChartRatio, origin: ChartWindingPoint['origin'], state: State): ChartWindingPoint {
  const point = Object.freeze({ slope, height, origin }); state.points.add(point); return point;
}
/** An exact projected query from finite world data. The candidate need not be on a carrier. */
export function chartWindingPointFromWorld(input: readonly [number, number, number], ctx: ChartContext): ChartWindingPoint {
  const copied = ownSnapshot(input, false, OWN);
  if (!Array.isArray(copied) || copied.length !== 3) chartFailure('INPUT', 'a winding query requires one own world triple');
  for (const value of copied) if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > CadNumericPolicy.coordinateAbs) chartFailure('INPUT', 'query world coordinates must be finite inside the native range');
  if (!(copied[0] > 0)) chartFailure('INPUT', 'query projection requires strictly positive world X');
  const state = stateFor(ctx), q = ctx.q, slope = q.div(q.from(copied[1]), q.from(copied[0])), height = q.from(copied[2]);
  ctx.check(); return admittedPoint(ratio(slope.n, slope.d), ratio(height.n, height.d), 'world', state);
}
/** Endpoint is canonical0/1 even for a reversed use. No Number quotient is formed. */
export function chartWindingPointFromVertex(use: ChartWindingUse, at: Endpoint, ctx: ChartContext): ChartWindingPoint {
  const state = STATES.get(ctx), data = state?.uses.get(use);
  if (!state || !data) chartFailure('INPUT', 'the vertex query requires a winding use owned by this context');
  if (at !== 0 && at !== 1) chartFailure('INPUT', 'a canonical endpoint index must be zero or one');
  ctx.charge(); let cached = state.vertices.get(data.use.chart);
  if (!cached) { cached = {}; state.vertices.set(data.use.chart, cached); }
  const found = at === 0 ? cached.first : cached.last; if (found) return found;
  const p = data.profile.endpoints[at], point = admittedPoint(p.slope, p.height, 'vertex', state);
  if (at === 0) cached.first = point; else cached.last = point;
  return point;
}
function ownUses(input: readonly ChartWindingUse[], state: State): UseData[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) chartFailure('INPUT', 'winding uses must be a plain own array');
  const descriptors = Object.getOwnPropertyDescriptors(input), length = Object.getOwnPropertyDescriptor(input, 'length');
  if (!length || !('value' in length) || !Number.isInteger(length.value) || length.value < 1 || length.value > MAX_USES || Reflect.ownKeys(input).length !== length.value + 1) chartFailure('INPUT', 'one winding query requires1..32 dense owned uses');
  const out: UseData[] = [];
  for (let i = 0; i < length.value; i++) {
    const descriptor = descriptors[String(i)];
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) chartFailure('INPUT', 'winding use arrays must have no getters or missing entries');
    const data = state.uses.get(descriptor.value as ChartWindingUse);
    if (!data) chartFailure('INPUT', 'every winding use must be immutable and owned by this context');
    out.push(data);
  }
  return out;
}
function samePoint(a: ProjectedEndpoint, point: ChartWindingPoint, ctx: ChartContext): boolean { return chartCompareRatios(a.slope, point.slope, ctx) === 0 && chartCompareRatios(a.height, point.height, ctx) === 0; }
function boundaries(uses: readonly UseData[], point: ChartWindingPoint, ctx: ChartContext): void {
  // Boundary tests precede the half-open crossing rule, including excluded maximum-slope endpoints.
  for (const data of uses) {
    const [first, last] = data.profile.endpoints;
    if (samePoint(first, point, ctx) || samePoint(last, point, ctx)) chartFailure('UNRESOLVED', 'the winding query lies on a projected vertex');
    if (data.profile.classification === 'constant-slope-height' && chartCompareRatios(first.slope, point.slope, ctx) === 0) {
      const low = data.profile.sign > 0 ? first.height : last.height, high = data.profile.sign > 0 ? last.height : first.height;
      if (chartCompareRatios(low, point.height, ctx) <= 0 && chartCompareRatios(point.height, high, ctx) <= 0) chartFailure('UNRESOLVED', 'the winding query lies on a constant-slope boundary');
    }
  }
}
function interval(node: ChartNode): ChartWindingInterval {
  const denominator = 2 ** node.depth;
  return Object.freeze({ depth: node.depth, index: node.index, range: Object.freeze([node.index / denominator, (node.index + 1) / denominator] as const) });
}
function text(value: ChartRatio, ctx: ChartContext): TextRatio { ctx.charge(2); return Object.freeze({ numerator: value.n.toString(), denominator: value.d.toString() }); }
function pointRelation(height: ChartRatio, point: ChartWindingPoint, node: ChartNode, at: Endpoint | null, ctx: ChartContext): RootRelation {
  const relation = chartCompareRatios(height, point.height, ctx);
  if (relation === 0) chartFailure('UNRESOLVED', 'the winding query lies on an exact projected root');
  return { above: relation > 0, method: at === null ? relation > 0 ? 'midpoint-above' : 'midpoint-below' : relation > 0 ? 'endpoint-above' : 'endpoint-below', interval: interval(node),
    root: at === null ? Object.freeze({ numerator: node.index + 1, depth: node.depth }) : Object.freeze({ endpoint: at }), height: Object.freeze({ kind: 'point', value: text(height, ctx) }) };
}
function rootRelation(data: UseData, point: ChartWindingPoint, ctx: ChartContext): RootRelation {
  const profile = data.profile, root = data.use.chart.root;
  if (chartCompareRatios(point.slope, profile.endpoints[0].slope, ctx) === 0) return pointRelation(profile.endpoints[0].height, point, root, 0, ctx);
  if (chartCompareRatios(point.slope, profile.endpoints[1].slope, ctx) === 0) return pointRelation(profile.endpoints[1].height, point, root, 1, ctx);
  let node = root;
  for (;;) {
    ctx.charge(); const box = chartBox(node, ctx);
    const above = chartCompareRatios(box.height[0], point.height, ctx) > 0, below = chartCompareRatios(box.height[1], point.height, ctx) < 0;
    if (above || below) return { above, method: above ? 'root-box-above' : 'root-box-below', interval: interval(node), height: Object.freeze({ kind: 'box', lower: text(box.height[0], ctx), upper: text(box.height[1], ctx) }) };
    if (node.depth >= ctx.maxDepth) chartFailure('UNRESOLVED', 'the exact monotone slope root height remains unresolved at the depth limit');
    const [left, right] = splitChartNode(node, ctx);
    ctx.requireNode(left); ctx.requireNode(right);
    if (left.curve !== node.curve || right.curve !== node.curve || left.depth !== node.depth + 1 || right.depth !== node.depth + 1 || left.index !== 2 * node.index || right.index !== 2 * node.index + 1) chartFailure('INPUT', 'root isolation requires exact owned dyadic interval children');
    const midpoint = endpoint(left, 1), comparison = chartCompareRatios(point.slope, midpoint.slope, ctx);
    if (comparison === 0) return pointRelation(midpoint.height, point, left, null, ctx);
    // Strict canonical slope progress proves the discarded child contains no root.
    node = comparison * profile.sign < 0 ? left : right;
  }
}
function edgeReceipt(data: UseData, point: ChartWindingPoint, ctx: ChartContext): ChartWindingEdgeReceipt {
  const base = { curve: data.use.chart.source.id, sense: data.use.sense, classification: data.profile.classification }, root = data.use.chart.root;
  if (data.profile.classification === 'constant-slope-height') return Object.freeze({ ...base, contribution: 0, method: 'constant-slope-outside', interval: interval(root) });
  const low = data.profile.sign > 0 ? data.profile.endpoints[0].slope : data.profile.endpoints[1].slope;
  const high = data.profile.sign > 0 ? data.profile.endpoints[1].slope : data.profile.endpoints[0].slope;
  const lowComparison = chartCompareRatios(point.slope, low, ctx), highComparison = chartCompareRatios(point.slope, high, ctx);
  if (lowComparison < 0 || highComparison > 0) return Object.freeze({ ...base, contribution: 0, method: 'outside-slope-range', interval: interval(root) });
  if (highComparison === 0) return Object.freeze({ ...base, contribution: 0, method: 'upper-endpoint-excluded', interval: interval(root) });
  const relation = rootRelation(data, point, ctx), traversal = data.profile.sign * (data.use.sense === 'forward' ? 1 : -1);
  const contribution = relation.above ? traversal > 0 ? -1 : 1 : 0;
  return Object.freeze({ ...base, contribution, method: relation.method, interval: relation.interval, ...(relation.root === undefined ? {} : { root: relation.root }), height: relation.height });
}
/** Exact chain winding only. Closure, simplicity and component roles are obligations of the caller. */
export function certifyChartWinding(uses: readonly ChartWindingUse[], point: ChartWindingPoint, ctx: ChartContext): ChartWindingCertificate {
  const state = STATES.get(ctx);
  if (!state) chartFailure('INPUT', 'the winding uses and point require their original owning context');
  const prepared = ownUses(uses, state);
  if (!state.points.has(point)) chartFailure('INPUT', 'the winding query must be an immutable point owned by this context');
  // No unverified use/point field is read and no context work is charged before all brands pass.
  ctx.check(); ctx.charge(prepared.length + 1);
  boundaries(prepared, point, ctx);
  const edges: ChartWindingEdgeReceipt[] = []; let winding = 0;
  for (const data of prepared) { const edge = edgeReceipt(data, point, ctx); winding += edge.contribution; edges.push(edge); }
  const query = Object.freeze({ slope: text(point.slope, ctx), height: text(point.height, ctx), origin: point.origin }); ctx.check();
  const counts = ctx.counts(); Object.freeze(counts.rational); Object.freeze(counts);
  return Object.freeze({ method: 'exact-upward-ray-monotone-slope', winding, point: query, edges: Object.freeze(edges), axisUnits: Object.freeze({ slope: 'dimensionless-y-over-x', height: 'mm' }), halfOpen: 'minimum-inclusive-maximum-exclusive', boundaryExcluded: true,
    counts, limits: Object.freeze({ uses: MAX_USES, depth: ctx.maxDepth }), meaning: Object.freeze({ exactStoredProjectedChainWinding: true, individualProgressFromOwnedCharts: true, loopClosureCertified: false, loopSimplicityCertified: false, componentContainmentCertified: false, sourceCertified: false, carrierCertified: false, solidQualified: false, volumeCertified: false, globalEvaluatorErrorCertified: false }) });
}
