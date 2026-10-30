import { ownSnapshot, hasExactOwnFields, type OwnSnapshotSpec } from '../core/own-data.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import type { Curve } from '../types.js';
import { ChartContext, chartFailure, isCylindricalWrapChartError, prepareChartCurve, type ChartCurve } from './cylindrical-wrap-chart.js';
import { certifyCylindricalWrapChartSeparation, type ChartSeparationOptions } from './cylindrical-wrap-chart-separation.js';
import { certifyChartCone } from './cylindrical-wrap-chart-cone.js';

type Code = 'INPUT' | 'SUPPORT' | 'BUDGET' | 'UNRESOLVED';
interface PairBudget { readonly maxOperations?: number }
export type CylindricalWrapChartPairOptions =
  | (PairBudget & { readonly kind: 'disjoint'; readonly maxDepth?: number; readonly maxPairs?: number; readonly witnesses?: boolean })
  | (PairBudget & { readonly kind: 'shared'; readonly endpoints: readonly [0 | 1, 0 | 1]; readonly normalHint?: readonly [number, number] });
interface ProgressReceipt {
  readonly coordinate: 'slope' | 'height'; readonly sign: -1 | 1;
  readonly coefficients: readonly string[]; readonly minimum: string;
  readonly positiveScale: number; readonly homogeneousDenominator: string;
}
const MEANING = Object.freeze({
  projection: 'Y-over-X-and-world-Z' as const,
  coordinateUnits: Object.freeze(['ratio', 'world-length'] as const),
  guarantee: 'exact-stored-rational-projected-pair' as const,
  pairRelationCertified: true as const,
  sourceCarrierCertified: false as const,
  loopEmbeddingCertified: false as const,
  topologyCertified: false as const,
  solidQualified: false as const,
  representedVolumeCertified: false as const,
  globalNativeEvaluatorErrorCertified: false as const,
  generalTextSupported: false as const,
});
export interface CylindricalWrapChartPairResult {
  readonly original: readonly [Curve, Curve];
  readonly options: CylindricalWrapChartPairOptions;
  readonly relation: 'disjoint' | 'shared-endpoint-only';
  readonly progress: readonly [ProgressReceipt, ProgressReceipt];
  readonly certificate: ReturnType<typeof certifyCylindricalWrapChartSeparation> | ReturnType<typeof certifyChartCone>;
  readonly counts: ReturnType<ChartContext['counts']>;
  readonly limits: ChartContext['limits'];
  readonly budget: { readonly maxOperations: number; readonly maxDepth: number };
  readonly meaning: typeof MEANING;
}
function fail(code: Code, detail: string): never { return chartFailure(code, `Pair: ${detail}`); }
function wrap(code: Code, detail: string, _cause: unknown): never { return fail(code, detail); }
const OWN: OwnSnapshotSpec<Code> = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail, wrap, isRefusal: isCylindricalWrapChartError };
function options(input: unknown): CylindricalWrapChartPairOptions {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INPUT', 'plain pair options are required');
  const data = input as Record<string, unknown>, kind = data.kind;
  if (kind !== 'disjoint' && kind !== 'shared') fail('INPUT', 'pair kind is disjoint or shared');
  const required = kind === 'shared' ? ['kind', 'endpoints'] : ['kind'];
  const allowed = kind === 'shared' ? ['kind', 'endpoints', 'normalHint', 'maxOperations'] : ['kind', 'maxDepth', 'maxPairs', 'witnesses', 'maxOperations'];
  for (const key of required) if (!Object.hasOwn(data, key)) fail('INPUT', 'a required pair option is missing');
  for (const key of Object.keys(data)) if (!allowed.includes(key)) fail('INPUT', 'an unsupported pair option was supplied');
  if (data.maxOperations !== undefined && (!Number.isSafeInteger(data.maxOperations) || (data.maxOperations as number) < 1 || (data.maxOperations as number) > 200000)) fail('INPUT', 'the pair operation limit may only tighten200000');
  if (kind === 'disjoint') {
    if (data.maxDepth !== undefined && (!Number.isSafeInteger(data.maxDepth) || (data.maxDepth as number) < 0 || (data.maxDepth as number) > 8)) fail('INPUT', 'the pair depth may only tighten8');
    if (data.maxPairs !== undefined && (!Number.isSafeInteger(data.maxPairs) || (data.maxPairs as number) < 1 || (data.maxPairs as number) > 512)) fail('INPUT', 'the pair visit limit may only tighten512');
    if (data.witnesses !== undefined && typeof data.witnesses !== 'boolean') fail('INPUT', 'witnesses is a boolean');
  } else {
    if (!Array.isArray(data.endpoints) || data.endpoints.length !== 2 || (data.endpoints[0] !== 0 && data.endpoints[0] !== 1) || (data.endpoints[1] !== 0 && data.endpoints[1] !== 1)) fail('INPUT', 'two explicit endpoint indices0 or1 are required');
    Object.freeze(data.endpoints);
    if (data.normalHint !== undefined) {
      if (!Array.isArray(data.normalHint) || data.normalHint.length !== 2) fail('INPUT', 'a normal hint has two coordinates');
      for (const value of data.normalHint) if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > CadNumericPolicy.coordinateAbs) fail('INPUT', 'normal hints must be finite within the native coordinate bound');
      if (data.normalHint[0] === 0 && data.normalHint[1] === 0) fail('INPUT', 'a normal hint cannot be zero');
      Object.freeze(data.normalHint);
    }
  }
  Object.freeze(data); return data as unknown as CylindricalWrapChartPairOptions;
}
function progress(curve: ChartCurve): ProgressReceipt {
  const proof = curve.progress, coefficients: string[] = [];
  for (const value of proof.coefficients) coefficients.push(value.toString());
  Object.freeze(coefficients);
  return Object.freeze({ coordinate: proof.coordinate, sign: proof.sign, coefficients, minimum: proof.minimum.toString(),
    positiveScale: proof.positiveScale, homogeneousDenominator: curve.denominator.toString() });
}

/** Private projected-pair certificate. It is conditional on later exact radial-side binding and loop ownership. */
export function certifyCylindricalWrapChartPair(firstInput: Curve, secondInput: Curve, optionsInput: CylindricalWrapChartPairOptions = { kind: 'disjoint' }): CylindricalWrapChartPairResult {
  const copied = ownSnapshot({ first: firstInput, second: secondInput, options: optionsInput }, false, OWN) as Record<string, unknown>;
  if (!hasExactOwnFields(copied, ['first', 'second', 'options'])) fail('INPUT', 'pair inputs are incomplete');
  const settings = options(copied.options), contextOptions: { maxOperations?: number; maxDepth?: number } = {};
  if (settings.maxOperations !== undefined) contextOptions.maxOperations = settings.maxOperations;
  if (settings.kind === 'disjoint' && settings.maxDepth !== undefined) contextOptions.maxDepth = settings.maxDepth;
  const ctx = new ChartContext(contextOptions), first = prepareChartCurve(copied.first as Curve, ctx), second = prepareChartCurve(copied.second as Curve, ctx);
  if (first.source.id === second.source.id) fail('INPUT', 'two distinct source curve identifiers are required');
  let certificate: CylindricalWrapChartPairResult['certificate'];
  if (settings.kind === 'shared') certificate = certifyChartCone(first, second, settings.endpoints[0], settings.endpoints[1], ctx, settings.normalHint);
  else {
    const separation: ChartSeparationOptions = {
      ...(settings.maxDepth !== undefined ? { maxDepth: settings.maxDepth } : {}),
      ...(settings.maxPairs !== undefined ? { maxPairs: settings.maxPairs } : {}),
      ...(settings.witnesses !== undefined ? { witnesses: settings.witnesses } : {}),
    };
    certificate = certifyCylindricalWrapChartSeparation(first, second, ctx, separation);
  }
  ctx.check();
  const original = [first.source, second.source] as const, proofs = [progress(first), progress(second)] as const;
  Object.freeze(original); Object.freeze(proofs);
  const counts = ctx.counts(); Object.freeze(counts.rational); Object.freeze(counts);
  const relation: CylindricalWrapChartPairResult['relation'] = settings.kind === 'shared' ? 'shared-endpoint-only' : 'disjoint';
  return Object.freeze({ original, options: settings, relation, progress: proofs,
    certificate, counts, limits: ctx.limits, budget: Object.freeze({ maxOperations: ctx.maxOperations, maxDepth: ctx.maxDepth }), meaning: MEANING });
}
