import { CurveInterpolationError } from './curve-interpolation.js';
import type { CurveInterpolationPoint, CurveInterpolationOptions, CurveInterpolationReport } from './curve-interpolation.js';
import { buildCurveInterpolationKernel, snapshotCurveInterpolationKernelData, sameCurveInterpolationKernelData } from './curve-interpolation-kernel-internal.js';
import type { Curve, Model } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';

export const WeightedCurveInterpolationDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', NATIVE: 'NATIVE',
  REPRESENTABILITY: 'REPRESENTABILITY', CONDITIONING: 'CONDITIONING', BINDING: 'BINDING', OWNED: 'OWNED' } as const);
export type WeightedCurveInterpolationDiagnosticCode = typeof WeightedCurveInterpolationDiagnosticCode[keyof typeof WeightedCurveInterpolationDiagnosticCode];
export class WeightedCurveInterpolationError extends KernelError {
  readonly code: WeightedCurveInterpolationDiagnosticCode;
  constructor(code: WeightedCurveInterpolationDiagnosticCode, detail: string, cause?: unknown) {
    super(('Weighted Curve interpolation: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'WeightedCurveInterpolationError'; this.code = code;
  }
}
export type WeightedCurveInterpolationPoint = CurveInterpolationPoint;
export type WeightedCurveInterpolationOptions = CurveInterpolationOptions;
export interface WeightedCurveInterpolationReport extends Omit<CurveInterpolationReport, 'schema' | 'quality' | 'limits'> {
  schema: 'barocss-native-weighted-curve-interpolation'; weights: number[];
  quality: Omit<CurveInterpolationReport['quality'], 'weights'> & { weights: 'supplied-positive-fixed-weights-no-weight-fitting';
    providedWeightBitsPreserved: true; weightOptimization: false; commonWeightScalingGlobalInvarianceCertified: false };
  limits: CurveInterpolationReport['limits'] & { weightRange: [1e-6, 1e6] };
}
export interface WeightedCurveInterpolationResult { points: WeightedCurveInterpolationPoint[]; weights: number[]; options: WeightedCurveInterpolationOptions;
  curve: Curve; source: string; sourceVersion: 0; model: Model; report: WeightedCurveInterpolationReport }

const CODE = WeightedCurveInterpolationDiagnosticCode;
function check(condition: boolean, code: WeightedCurveInterpolationDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new WeightedCurveInterpolationError(code, detail);
}
function shared<T>(action: () => T, detail: string): T {
  try { return action(); } catch (cause) {
    if (cause instanceof WeightedCurveInterpolationError) throw cause;
    throw new WeightedCurveInterpolationError(cause instanceof CurveInterpolationError ? cause.code : CODE.NATIVE,
      detail + ': ' + (cause instanceof Error ? cause.message : 'shared operation refused'), cause);
  }
}
/** Fixed original positive rational weights, using the sole original native interpolation kernel. */
export function buildWeightedInterpolatingCurve(pointsInput: WeightedCurveInterpolationPoint[], weightsInput: number[],
  optionsInput: WeightedCurveInterpolationOptions): WeightedCurveInterpolationResult {
  // Required explicit weights are copied separately BEFORE shared basis/solve work.
  // Runtime undefined cannot enter the kernel's old polynomial-only optional default.
  const weights = shared(() => snapshotCurveInterpolationKernelData(weightsInput), 'positive fixed weight own-data admission refused');
  check(Array.isArray(weights), CODE.INPUT, 'explicit positive weight array required; polynomial default is not a weighted API input');
  const kernel = shared(() => buildCurveInterpolationKernel(pointsInput, optionsInput, weights as number[]), 'actual shared native fixed-weight interpolation refused');
  check(sameCurveInterpolationKernelData(kernel.curve.weights, weights), CODE.BINDING, 'actual compiled Curve must retain complete provided weight bits');
  // Only numeric evidence is retained here; the old polynomial schema/policy never enters the public weighted report.
  const { schema: oldSchema, quality: oldQuality, ...evidence } = kernel.report;
  const { weights: oldPolynomialPolicy, ...qualityEvidence } = oldQuality;
  void oldSchema; void oldPolynomialPolicy;
  const report: WeightedCurveInterpolationReport = { ...evidence, schema: 'barocss-native-weighted-curve-interpolation', weights: kernel.curve.weights,
    quality: { ...qualityEvidence, weights: 'supplied-positive-fixed-weights-no-weight-fitting', providedWeightBitsPreserved: true,
      weightOptimization: false, commonWeightScalingGlobalInvarianceCertified: false }, limits: { ...kernel.report.limits, weightRange: [1e-6, 1e6] } };
  return shared(() => snapshotCurveInterpolationKernelData({ points: kernel.points, weights: kernel.curve.weights, options: kernel.options,
    curve: kernel.curve, source: kernel.source, sourceVersion: 0, model: kernel.model, report }, true), 'weighted result own-data budget refused') as WeightedCurveInterpolationResult;
}
/** Rebuild fixed weights and every actual basis/solver/Source0/observation datum, not a polynomial projection. */
export function validateWeightedInterpolatingCurve(input: WeightedCurveInterpolationResult): WeightedCurveInterpolationReport {
  const copied = shared(() => snapshotCurveInterpolationKernelData(input, true), 'weighted owned-data snapshot refused');
  check(copied !== null && typeof copied === 'object' && !Array.isArray(copied), CODE.OWNED, 'owned weighted interpolation record required');
  const data = copied as Record<string, unknown>, fields = ['points', 'weights', 'options', 'curve', 'source', 'sourceVersion', 'model', 'report'];
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), CODE.OWNED, 'exact eight owned weighted-result fields required');
  const owned = data as unknown as WeightedCurveInterpolationResult;
  let expected: WeightedCurveInterpolationResult;
  try { expected = buildWeightedInterpolatingCurve(owned.points, owned.weights, owned.options); } catch (cause) {
    throw new WeightedCurveInterpolationError(CODE.OWNED, 'owned complete fixed-weight native interpolation reconstruction refused', cause);
  }
  check(sameCurveInterpolationKernelData(owned, expected), CODE.OWNED, 'owned original points/weights/options/native basis/solver/source/Curve/report mismatch');
  return shared(() => snapshotCurveInterpolationKernelData(expected.report, true), 'weighted owned report snapshot refused') as WeightedCurveInterpolationReport;
}
