import { hasExactOwnFields, ownSnapshot, type OwnSnapshotSpec } from '../core/own-data.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import type { Curve, Surface } from '../types.js';
import { chartCompareRatios, chartFailure, isCylindricalWrapChartError, type ChartCode, type ChartContext, type ChartCounts } from './cylindrical-wrap-chart.js';
import { chartComponentContext, type ChartComponentResult } from './cylindrical-wrap-chart-component.js';

export interface CylindricalWrapSideFamilyPiece { readonly base: Curve; readonly outer: Curve; readonly side: Surface }
interface SideBinding {
  readonly base: string; readonly outer: string; readonly side: string;
  readonly factor: 2; readonly parameterDomain: readonly [0, 1]; readonly radialDomain: readonly [0, 1];
}
const MEANING = Object.freeze({
  guarantee: 'exact-stored-factor2-radial-side-family-embedding' as const,
  projection: 'Y-over-X-and-world-Z' as const,
  exactCoefficientBinding: true as const,
  sideFamilyEmbeddingCertified: true as const,
  regularSidesCertified: true as const,
  nonadjacentSidesDisjoint: true as const,
  adjacentSidesShareOnlyPrescribedRadialEdge: true as const,
  sourceCarrierCertified: false as const,
  originalNativeUVBindingCertified: false as const,
  retainedFaceClosureCertified: false as const,
  topologyCertified: false as const,
  physicalBrepCertified: false as const,
  solidQualified: false as const,
  representedVolumeCertified: false as const,
  globalNativeEvaluatorErrorCertified: false as const,
  generalTextSupported: false as const,
  combinedConstructionBudgetCertified: false as const,
});
export interface CylindricalWrapSideFamilyResult {
  /** Owned actual inputs in caller order. The binding list follows the certified base order. */
  readonly original: readonly CylindricalWrapSideFamilyPiece[];
  readonly bindings: readonly SideBinding[];
  readonly componentCover: ChartComponentResult['cover'];
  /** The component receipt is an earlier cumulative prefix, never an independent allowance. */
  readonly componentCounts: ChartCounts;
  readonly startedCounts: ChartCounts;
  /** Authoritative cumulative count, including the original component and this continuation. */
  readonly counts: ChartCounts;
  readonly limits: ChartContext['limits'];
  readonly budget: { readonly maxOperations: number; readonly maxDepth: number };
  readonly meaning: typeof MEANING;
}
const CURVE_FIELDS = ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'];
const SURFACE_FIELDS = ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights'];
function fail(code: ChartCode, detail: string): never { return chartFailure(code, `Side family: ${detail}`); }
function wrap(code: ChartCode, detail: string): never { return fail(code, detail); }
const OWN: OwnSnapshotSpec<ChartCode> = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail, wrap, isRefusal: isCylindricalWrapChartError };
function record(input: unknown, fields: readonly string[], ctx: ChartContext): Record<string, unknown> {
  ctx.charge();
  if (!input || typeof input !== 'object' || Array.isArray(input) || !hasExactOwnFields(input as Record<string, unknown>, fields)) fail('INPUT', 'exact own coefficient fields are required');
  return input as Record<string, unknown>;
}
function array(input: unknown, length: number, ctx: ChartContext): unknown[] {
  ctx.charge(); if (!Array.isArray(input) || input.length !== length) fail('INPUT', 'the actual coefficient array has an unsupported shape'); return input;
}
function identifier(input: unknown, ctx: ChartContext): void {
  ctx.charge(); if (typeof input !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(input)) fail('INPUT', 'bounded native coefficient identifiers are required');
}
function coordinate(input: unknown, ctx: ChartContext): void {
  ctx.charge(); if (typeof input !== 'number' || !Number.isFinite(input) || Math.abs(input) > CadNumericPolicy.coordinateAbs) fail('SUPPORT', 'all actual coordinates must remain inside the native CAD range');
}
function point(input: unknown, ctx: ChartContext): void { for (const value of array(input, 3, ctx)) coordinate(value, ctx); }
function curve(input: unknown, ctx: ChartContext): Curve {
  const data = record(input, CURVE_FIELDS, ctx); identifier(data.id, ctx);
  if (data.kind !== 'curve' || data.degree !== 3) fail('SUPPORT', 'the actual boundaries must remain native cubics');
  array(data.knots, 8, ctx); const poles = array(data.controlPoints, 4, ctx); array(data.weights, 4, ctx);
  for (const pole of poles) point(pole, ctx);
  return data as unknown as Curve;
}
function surface(input: unknown, ctx: ChartContext): Surface {
  const data = record(input, SURFACE_FIELDS, ctx); identifier(data.id, ctx);
  if (data.kind !== 'surface' || data.degreeU !== 3 || data.degreeV !== 1) fail('SUPPORT', 'the actual side must retain degree(3,1)');
  array(data.knotsU, 8, ctx); array(data.knotsV, 4, ctx);
  const poles = array(data.controlPoints, 4, ctx), weights = array(data.weights, 4, ctx);
  for (let i = 0; i < 4; i++) {
    for (const pole of array(poles[i], 2, ctx)) point(pole, ctx);
    array(weights[i], 2, ctx);
  }
  return data as unknown as Surface;
}
function sameNumbers(actual: readonly number[], expected: readonly number[], ctx: ChartContext): void {
  ctx.charge(); if (actual.length !== expected.length) fail('SUPPORT', 'the original coefficient array length changed');
  for (let i = 0; i < expected.length; i++) { ctx.charge(); if (!Object.is(actual[i], expected[i])) fail('SUPPORT', 'actual coefficient bits differ from their required binding'); }
}
function sameBase(actual: Curve, expected: Curve, ctx: ChartContext): void {
  ctx.charge(3);
  if (actual.kind !== expected.kind || actual.id !== expected.id || actual.degree !== expected.degree) fail('SUPPORT', 'the actual base differs from its certified original Curve');
  sameNumbers(actual.knots, expected.knots, ctx); sameNumbers(actual.weights, expected.weights, ctx);
  for (let i = 0; i < 4; i++) sameNumbers(actual.controlPoints[i], expected.controlPoints[i], ctx);
}
function doubled(actual: number, base: number, ctx: ChartContext): void {
  const original = ctx.q.from(base), stored = ctx.q.from(actual); ctx.check();
  const exact = { n: ctx.shift(original.n, 1), d: original.d };
  const relation = chartCompareRatios(stored, exact, ctx); ctx.charge();
  // Finite power-of-two multiplication is exact here, including subnormals. Object.is retains zero signs.
  if (relation !== 0 || !Object.is(actual, 2 * base)) fail('SUPPORT', 'the actual outer poles must retain exact factor2 XY homothety');
}
function bind(piece: CylindricalWrapSideFamilyPiece, expected: Curve, ctx: ChartContext): void {
  sameBase(piece.base, expected, ctx);
  sameNumbers(piece.outer.knots, piece.base.knots, ctx); sameNumbers(piece.outer.weights, piece.base.weights, ctx);
  sameNumbers(piece.side.knotsU, piece.base.knots, ctx); sameNumbers(piece.side.knotsV, [0, 0, 1, 1], ctx);
  for (let i = 0; i < 4; i++) {
    doubled(piece.outer.controlPoints[i][0], piece.base.controlPoints[i][0], ctx);
    doubled(piece.outer.controlPoints[i][1], piece.base.controlPoints[i][1], ctx);
    ctx.charge(); if (!Object.is(piece.outer.controlPoints[i][2], piece.base.controlPoints[i][2])) fail('SUPPORT', 'the actual outer poles must retain original Z bits');
    sameNumbers(piece.side.controlPoints[i][0], piece.base.controlPoints[i], ctx);
    sameNumbers(piece.side.controlPoints[i][1], piece.outer.controlPoints[i], ctx);
    sameNumbers(piece.side.weights[i], [piece.base.weights[i], piece.base.weights[i]], ctx);
  }
}
function copyCounts(counts: ChartCounts): ChartCounts { return { ...counts, rational: { ...counts.rational } }; }
function freezeData(input: unknown): void {
  if (!input || typeof input !== 'object' || Object.isFrozen(input)) return;
  Object.freeze(input); for (const value of Object.values(input)) freezeData(value);
}
/** Exact stored side-family proof only. Actual source/carrier/UV/B-rep binding remains a separate obligation. */
export function certifyCylindricalWrapSideFamily(component: ChartComponentResult, pieces: readonly CylindricalWrapSideFamilyPiece[]): CylindricalWrapSideFamilyResult {
  // WeakMap authority is checked before reading either a purported receipt or actual coefficient data.
  const ctx = chartComponentContext(component);
  const copied = ownSnapshot(pieces, false, OWN); ctx.check();
  if (!Array.isArray(copied) || copied.length !== component.original.curves.length) fail('INPUT', 'exactly one actual side is required for every certified base');
  const startedCounts = copyCounts(ctx.counts()), expected = new Map<string, Curve>(), ids = new Set<string>(), actual = new Map<string, CylindricalWrapSideFamilyPiece>();
  for (const base of component.original.curves) { ctx.charge(); expected.set(base.id, base); ids.add(base.id); }
  const original: CylindricalWrapSideFamilyPiece[] = [];
  for (const input of copied) {
    const data = record(input, ['base', 'outer', 'side'], ctx), piece = { base: curve(data.base, ctx), outer: curve(data.outer, ctx), side: surface(data.side, ctx) };
    if (!expected.has(piece.base.id) || actual.has(piece.base.id)) fail('INPUT', 'each actual base identifier must match one certified original exactly once');
    for (const id of [piece.outer.id, piece.side.id]) {
      ctx.charge(); if (ids.has(id)) fail('INPUT', 'actual outer and side identifiers must be distinct from all other coefficients'); ids.add(id);
    }
    actual.set(piece.base.id, piece); original.push(piece);
  }
  const bindings: SideBinding[] = [];
  for (const base of component.original.curves) {
    ctx.charge(); const piece = actual.get(base.id);
    if (!piece) fail('INPUT', 'a certified base has no matching actual side');
    bind(piece, base, ctx);
    bindings.push({ base: base.id, outer: piece.outer.id, side: piece.side.id, factor: 2, parameterDomain: [0, 1], radialDomain: [0, 1] });
  }
  // Complete coefficient identities give H(t,r)=((1+r)Bx,(1+r)By,Bz). D300's positive-X
  // projected embedding then transfers regularity, injectivity and the prescribed radial adjacencies.
  ctx.check();
  const result: CylindricalWrapSideFamilyResult = { original, bindings, componentCover: { ...component.cover }, componentCounts: copyCounts(component.counts), startedCounts,
    counts: copyCounts(ctx.counts()), limits: ctx.limits, budget: { maxOperations: ctx.maxOperations, maxDepth: ctx.maxDepth }, meaning: MEANING };
  freezeData(result); return result;
}
