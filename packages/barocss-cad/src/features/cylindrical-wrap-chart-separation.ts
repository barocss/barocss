import { ownSnapshot, type OwnSnapshotSpec } from '../core/own-data.js';
import {
  ChartContext, chartBox, chartCompareRatios, chartFailure, isCylindricalWrapChartError, splitChartNode,
  type ChartCurve, type ChartNode, type ChartRatio,
} from './cylindrical-wrap-chart.js';

export interface ChartSeparationOptions {
  /** A tighter limit than the caller context, whose hard depth is8. */
  readonly maxDepth?: number;
  /** Counts every visited pair cell, including the initial cell. At most512. */
  readonly maxPairs?: number;
  /** If requested, record every accepted leaf, never a partial witness list. */
  readonly witnesses?: boolean;
}
export interface ChartSeparationInterval {
  readonly depth: number;
  readonly index: number;
  /** Exact dyadic endpoints in the original normalized t domain [0,1]. */
  readonly range: readonly [number, number];
}
export interface ChartSeparationWitness {
  readonly first: ChartSeparationInterval;
  readonly second: ChartSeparationInterval;
  readonly axis: 'slope' | 'height';
  readonly before: 'first' | 'second';
  /** The exact strict comparison upper<lower; fractions need not be reduced. */
  readonly upper: { readonly numerator: string; readonly denominator: string };
  readonly lower: { readonly numerator: string; readonly denominator: string };
}
export interface ChartSeparationCertificate {
  readonly relation: 'strict-disjoint-projected-images';
  readonly curves: readonly [string, string];
  readonly parameterFrame: 'original-normalized-bezier-t';
  readonly axisUnits: { readonly slope: 'dimensionless-y-over-x'; readonly height: 'mm' };
  readonly cover: {
    readonly domain: readonly [readonly [0, 1], readonly [0, 1]];
    readonly complete: true;
    readonly leaves: number;
    readonly visits: number;
    readonly splits: number;
    readonly witnessesRecorded: boolean;
  };
  readonly limits: { readonly depth: number; readonly pairs: number; readonly witnessLeaves: 256 };
  readonly witnesses: readonly ChartSeparationWitness[];
  readonly counts: ReturnType<ChartContext['counts']>;
  readonly meaning: {
    readonly storedProjectedPairOnly: true;
    readonly individualProgressFromOwnedCharts: true;
    readonly sourceCertified: false;
    readonly carrierCertified: false;
    readonly loopCertified: false;
    readonly solidQualified: false;
    readonly volumeCertified: false;
    readonly globalEvaluatorErrorCertified: false;
  };
}

type Code = 'INPUT' | 'SUPPORT' | 'BUDGET' | 'UNRESOLVED';
interface Settings { maxDepth: number; maxPairs: number; witnesses: boolean }
interface Cell { first: ChartNode; second: ChartNode }
interface Separation { axis: 'slope' | 'height'; before: 'first' | 'second'; upper: ChartRatio; lower: ChartRatio }
const MAX_DEPTH = 8, MAX_PAIRS = 512, MAX_WITNESSES = 256;
function wrap(code: Code, detail: string): never { return chartFailure(code, detail); }
const SNAPSHOT: OwnSnapshotSpec<Code> = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail: chartFailure, wrap, isRefusal: isCylindricalWrapChartError };
function settings(input: unknown, ctx: ChartContext): Settings {
  const data = ownSnapshot(input, false, SNAPSHOT);
  if (!data || typeof data !== 'object' || Array.isArray(data)) chartFailure('INPUT', 'nonadjacent separation options must be a plain own record');
  const fields = data as Record<string, unknown>;
  for (const key of Object.keys(fields)) if (key !== 'maxDepth' && key !== 'maxPairs' && key !== 'witnesses') chartFailure('INPUT', 'an unsupported nonadjacent separation option was supplied');
  const maxDepth = fields.maxDepth === undefined ? ctx.maxDepth : fields.maxDepth;
  const maxPairs = fields.maxPairs === undefined ? MAX_PAIRS : fields.maxPairs;
  const witnesses = fields.witnesses === undefined ? false : fields.witnesses;
  if (typeof maxDepth !== 'number' || !Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > ctx.maxDepth || maxDepth > MAX_DEPTH) chartFailure('INPUT', 'separation depth may only tighten the context depth in0..8');
  if (typeof maxPairs !== 'number' || !Number.isInteger(maxPairs) || maxPairs < 1 || maxPairs > MAX_PAIRS) chartFailure('INPUT', 'separation pair visits must be an integer in1..512');
  if (typeof witnesses !== 'boolean') chartFailure('INPUT', 'the witnesses option must be boolean');
  return { maxDepth, maxPairs, witnesses };
}
function interval(node: ChartNode): ChartSeparationInterval {
  // At depth<=8 these powers and both endpoint quotients are exactly representable binary64 dyadics.
  const denominator = 2 ** node.depth;
  return Object.freeze({ depth: node.depth, index: node.index, range: Object.freeze([node.index / denominator, (node.index + 1) / denominator] as const) });
}
function fraction(value: ChartRatio): { readonly numerator: string; readonly denominator: string } {
  return Object.freeze({ numerator: value.n.toString(), denominator: value.d.toString() });
}
function separated(first: ChartNode, second: ChartNode, ctx: ChartContext): Separation | null {
  const a = chartBox(first, ctx), b = chartBox(second, ctx);
  if (chartCompareRatios(a.slope[1], b.slope[0], ctx) < 0) return { axis: 'slope', before: 'first', upper: a.slope[1], lower: b.slope[0] };
  if (chartCompareRatios(b.slope[1], a.slope[0], ctx) < 0) return { axis: 'slope', before: 'second', upper: b.slope[1], lower: a.slope[0] };
  if (chartCompareRatios(a.height[1], b.height[0], ctx) < 0) return { axis: 'height', before: 'first', upper: a.height[1], lower: b.height[0] };
  if (chartCompareRatios(b.height[1], a.height[0], ctx) < 0) return { axis: 'height', before: 'second', upper: b.height[1], lower: a.height[0] };
  return null;
}
function children(parent: ChartNode, ctx: ChartContext): readonly [ChartNode, ChartNode] {
  const pair = splitChartNode(parent, ctx), left = pair[0], right = pair[1];
  ctx.requireNode(left); ctx.requireNode(right);
  if (left.id === right.id || left.id === parent.id || right.id === parent.id || left.curve !== parent.curve || right.curve !== parent.curve
    || left.depth !== parent.depth + 1 || right.depth !== parent.depth + 1 || left.index !== 2 * parent.index || right.index !== 2 * parent.index + 1) chartFailure('INPUT', 'owned subdivision nodes must partition the exact original dyadic interval');
  return pair;
}
function witness(cell: Cell, bound: Separation): ChartSeparationWitness {
  return Object.freeze({ first: interval(cell.first), second: interval(cell.second), axis: bound.axis, before: bound.before, upper: fraction(bound.upper), lower: fraction(bound.lower) });
}

/** Exact nonadjacent-pair diagnostic. Shared endpoints, contact and uncertain separation never succeed. */
export function certifyCylindricalWrapChartSeparation(first: ChartCurve, second: ChartCurve, ctx: ChartContext, options: ChartSeparationOptions = {}): ChartSeparationCertificate {
  // The shared context owns and freezes the admitted charts and their complete coefficient graphs.
  ctx.requireCurve(first); ctx.requireCurve(second); ctx.requireNode(first.root); ctx.requireNode(second.root);
  if (first.root.depth !== 0 || first.root.index !== 0 || second.root.depth !== 0 || second.root.index !== 0) chartFailure('INPUT', 'separation requires complete original normalized parameter domains');
  const limits = settings(options, ctx); ctx.check();
  if (first === second || first.root.id === second.root.id) chartFailure('UNRESOLVED', 'a projected curve cannot be strictly separated from itself');
  const pending: Cell[] = [{ first: first.root, second: second.root }], witnesses: ChartSeparationWitness[] = [];
  let visits = 0, splits = 0, leaves = 0;
  while (pending.length) {
    if (++visits > limits.maxPairs) chartFailure('BUDGET', 'the nonadjacent pair-cell visit budget was exhausted');
    ctx.charge();
    const cell = pending.pop()!, bound = separated(cell.first, cell.second, ctx);
    if (bound !== null) {
      leaves++;
      if (limits.witnesses) {
        if (witnesses.length >= MAX_WITNESSES) chartFailure('BUDGET', 'the complete separation witness payload exceeds256 leaves');
        witnesses.push(witness(cell, bound));
      }
      continue;
    }
    const canFirst = cell.first.depth < limits.maxDepth, canSecond = cell.second.depth < limits.maxDepth;
    if (!canFirst && !canSecond) chartFailure('UNRESOLVED', 'projected contact, crossing or separation remains unresolved at the depth limit');
    // A binary replacement needs both children; never spend a partial cover as a successful result.
    if (visits + pending.length + 2 > limits.maxPairs) chartFailure('BUDGET', 'the remaining pair-cell budget cannot cover both subdivision children');
    splits++;
    if (canFirst && (!canSecond || cell.first.depth <= cell.second.depth)) {
      const [left, right] = children(cell.first, ctx);
      pending.push({ first: right, second: cell.second }, { first: left, second: cell.second });
    } else {
      const [left, right] = children(cell.second, ctx);
      pending.push({ first: cell.first, second: right }, { first: cell.first, second: left });
    }
  }
  // One root and only complete binary replacements give a nonempty full product-domain cover.
  if (leaves < 1 || leaves !== splits + 1 || visits !== 2 * splits + 1 || limits.witnesses && witnesses.length !== leaves) chartFailure('UNRESOLVED', 'the complete original pair-domain partition could not be certified');
  ctx.check();
  const counts = ctx.counts(); Object.freeze(counts.rational); Object.freeze(counts);
  return Object.freeze({ relation: 'strict-disjoint-projected-images', curves: Object.freeze([first.source.id, second.source.id] as const), parameterFrame: 'original-normalized-bezier-t',
    axisUnits: Object.freeze({ slope: 'dimensionless-y-over-x', height: 'mm' }),
    cover: Object.freeze({ domain: Object.freeze([Object.freeze([0, 1] as const), Object.freeze([0, 1] as const)] as const), complete: true, leaves, visits, splits, witnessesRecorded: limits.witnesses }),
    limits: Object.freeze({ depth: limits.maxDepth, pairs: limits.maxPairs, witnessLeaves: MAX_WITNESSES }), witnesses: Object.freeze(witnesses), counts,
    meaning: Object.freeze({ storedProjectedPairOnly: true, individualProgressFromOwnedCharts: true, sourceCertified: false, carrierCertified: false, loopCertified: false, solidQualified: false, volumeCertified: false, globalEvaluatorErrorCertified: false }) });
}
