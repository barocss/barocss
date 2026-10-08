import { createHomogeneousBernsteinEquation, solveHomogeneousBernsteinEquation } from './own-homogeneous-bernstein-roots.js';
import type { HomogeneousBernsteinEquation, HomogeneousBernsteinRoot } from './own-homogeneous-bernstein-roots.js';

export interface CubicBernsteinRootEvidence {
  originalCoefficients: [number, number, number, number]; normalizedCoefficients: [number, number, number, number];
  normalizationScale: number; maximumOriginalMagnitude: number; derivativeCoefficients: [number, number, number];
  derivativeEquation: HomogeneousBernsteinEquation; derivativeRoots: HomogeneousBernsteinRoot[];
  derivativeSearchStatus: 'not-required-coincident' | 'not-required-strict-cubic-sign-exclusion' | 'executed';
  controlHullExclusion: { sign: 'positive' | 'negative'; minimumMagnitude: number; arithmeticGuard: number;
    policy: 'strict-normalized-cubic-bernstein-control-hull-beyond64-epsilon-guard' } | null;
  criticalBrackets: { derivativeRootIndex: number; bracket: [number, number]; center: number; centerValue: number;
    leftValue: number; rightValue: number; lipschitzBound: number; lipschitzMargin: number;
    arithmeticGuard: number; totalMargin: number; sign: -1 | 1 }[];
  monotoneIntervals: { domain: [number, number]; leftValue: number; rightValue: number;
    status: 'support-disjoint' | 'endpoint-only' | 'crossing'; rootIndex: number | null;
    iterations: number; nearZeroQuarterSteps: number }[];
  roots: HomogeneousBernsteinRoot[]; scalarEvaluations: { parameter: number; value: number; arithmeticGuard: number }[];
  scalarEvaluationCount: number; derivativeRootSteps: number[]; cubicRootSteps: number[];
  coincident: boolean; parameterWidthTarget: number; arithmeticGuard: number;
}
export class CubicBernsteinRootError extends Error {
  readonly code: 'INPUT' | 'REPRESENTABILITY' | 'BUDGET';
  constructor(code: CubicBernsteinRootError['code'], detail: string, cause?: unknown) {
    super(('Own cubic Bernstein roots: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CubicBernsteinRootError'; this.code = code;
  }
}
function check(condition: boolean, detail: string, code: CubicBernsteinRootError['code'] = 'REPRESENTABILITY'): asserts condition {
  if (!condition) throw new CubicBernsteinRootError(code, detail);
}
function finite(value: number, detail: string): number { check(Number.isFinite(value), detail); return value; }
function product(a: number, b: number): number {
  const value = finite(a * b, 'scalar product overflow');
  check(a === 0 || b === 0 || value !== 0, 'nonzero scalar product underflow'); return value;
}
function midpoint(low: number, high: number): number {
  const value = finite(low + product(finite(high - low, 'interval width overflow'), .5), 'midpoint overflow');
  check(value > low && value < high, 'strict interior midpoint not represented'); return value;
}

/** Own cubic scalar isolation; the actual existing quadratic solver supplies derivative brackets. */
export function solveCubicBernsteinRoots(originalInput: number[], parameterWidthTarget: number): {
  roots: HomogeneousBernsteinRoot[]; evidence: CubicBernsteinRootEvidence;
} {
  check(originalInput.length === 4 && originalInput.every(Number.isFinite), 'four finite cubic coefficients required', 'INPUT');
  check(Number.isFinite(parameterWidthTarget) && parameterWidthTarget > 0 && parameterWidthTarget < 1,
    'positive represented normalized root target required');
  const originalCoefficients = originalInput.slice() as CubicBernsteinRootEvidence['originalCoefficients'];
  const maximumOriginalMagnitude = Math.max(...originalCoefficients.map(Math.abs));
  const coincident = maximumOriginalMagnitude === 0, normalizationScale = coincident ? 1 : maximumOriginalMagnitude;
  const normalizedCoefficients = originalCoefficients.map(value => {
    const normalized = finite(value / normalizationScale, 'derived normalization overflow');
    check(value === 0 || normalized !== 0, 'nonzero derived normalization underflow'); return normalized;
  }) as CubicBernsteinRootEvidence['normalizedCoefficients'];
  for (let i = 0; i < 3; i++) check(originalCoefficients[i] === originalCoefficients[i + 1]
    || normalizedCoefficients[i] !== normalizedCoefficients[i + 1], 'distinct neighboring coefficients collapsed under derived normalization');
  const derivativeCoefficients = normalizedCoefficients.slice(0, 3).map((value, i) =>
    product(3, finite(normalizedCoefficients[i + 1] - value, 'derived derivative difference overflow')))
    as CubicBernsteinRootEvidence['derivativeCoefficients'];
  const arithmeticGuard = finite(64 * Number.EPSILON * Math.max(1, ...normalizedCoefficients.map(Math.abs)), 'scalar guard overflow');
  const strictPositive = normalizedCoefficients.every(value => value > arithmeticGuard);
  const strictNegative = normalizedCoefficients.every(value => value < -arithmeticGuard);
  const controlHullExclusion: CubicBernsteinRootEvidence['controlHullExclusion'] = strictPositive || strictNegative
    ? { sign: strictPositive ? 'positive' : 'negative', minimumMagnitude: Math.min(...normalizedCoefficients.map(Math.abs)),
      arithmeticGuard, policy: 'strict-normalized-cubic-bernstein-control-hull-beyond64-epsilon-guard' } : null;
  const derivativeSearchStatus: CubicBernsteinRootEvidence['derivativeSearchStatus'] = coincident
    ? 'not-required-coincident' : controlHullExclusion ? 'not-required-strict-cubic-sign-exclusion' : 'executed';
  let derivativeEquation: HomogeneousBernsteinEquation, derivativeRoots: HomogeneousBernsteinRoot[] = [];
  try {
    // Keep the actual quadratic operation's original default label in its refusal cause.
    derivativeEquation = createHomogeneousBernsteinEquation(derivativeCoefficients);
    if (derivativeSearchStatus === 'executed')
      derivativeRoots = solveHomogeneousBernsteinEquation(derivativeEquation, { parameterWidthTarget });
  } catch (cause) {
    throw new CubicBernsteinRootError('REPRESENTABILITY', 'actual quadratic derivative operation refused: '
      + (cause instanceof Error ? cause.message : 'unknown derivative refusal'), cause);
  }
  check(derivativeRoots.length <= 2, 'derivative root capacity exceeded', 'BUDGET');
  const roots: HomogeneousBernsteinRoot[] = [], criticalBrackets: CubicBernsteinRootEvidence['criticalBrackets'] = [];
  const monotoneIntervals: CubicBernsteinRootEvidence['monotoneIntervals'] = [], scalarEvaluations: CubicBernsteinRootEvidence['scalarEvaluations'] = [];
  const evaluate = (parameter: number): number => {
    check(parameter >= 0 && parameter <= 1 && Number.isFinite(parameter), 'original normalized cubic parameter required');
    check(scalarEvaluations.length < 1024, 'cubic scalar evaluation budget exhausted', 'BUDGET');
    let value: number;
    if (parameter === 0) value = normalizedCoefficients[0];
    else if (parameter === 1) value = normalizedCoefficients[3];
    else {
      const complement = finite(1 - parameter, 'Bernstein complement overflow');
      let row: number[] = normalizedCoefficients.slice();
      // Scalar Bernstein recurrence only; no native point evaluator or power-basis cubic formula.
      for (let degree = 3; degree > 0; degree--) row = row.slice(0, degree).map((left, i) =>
        finite(product(complement, left) + product(parameter, row[i + 1]), 'cubic Bernstein sum overflow'));
      value = row[0];
    }
    scalarEvaluations.push({ parameter, value, arithmeticGuard }); return value;
  };
  const safeSign = (value: number): -1 | 0 | 1 => Math.abs(value) <= arithmeticGuard ? 0 : value < 0 ? -1 : 1;
  const makeEvidence = (): CubicBernsteinRootEvidence => ({ originalCoefficients, normalizedCoefficients, normalizationScale,
    maximumOriginalMagnitude, derivativeCoefficients, derivativeEquation, derivativeRoots, derivativeSearchStatus, controlHullExclusion,
    criticalBrackets, monotoneIntervals,
    roots, scalarEvaluations, scalarEvaluationCount: scalarEvaluations.length,
    derivativeRootSteps: derivativeRoots.map(root => root.iterations), cubicRootSteps: roots.map(root => root.iterations),
    coincident, parameterWidthTarget, arithmeticGuard });
  if (coincident || controlHullExclusion) return { roots, evidence: makeEvidence() };
  const derivativeHullBound = Math.max(...derivativeCoefficients.map(Math.abs));
  const lipschitzBound = finite(derivativeHullBound + arithmeticGuard * Math.max(1, derivativeHullBound),
    'guarded derivative control-hull bound overflow');
  for (const [derivativeRootIndex, root] of derivativeRoots.entries()) {
    if (root.t === 0 || root.t === 1) continue;
    check(!root.touch, 'interior stationary/tangent derivative ambiguity');
    const [low, high] = root.bracket, center = root.t;
    check(low > 0 && low < center && center < high && high < 1, 'strict interior critical bracket required');
    if (criticalBrackets.length) check(criticalBrackets.at(-1)!.bracket[1] < low, 'critical brackets must remain strictly disjoint');
    const radius = Math.max(finite(center - low, 'critical radius overflow'), finite(high - center, 'critical radius overflow'));
    const lipschitzMargin = product(lipschitzBound, radius), totalMargin = finite(lipschitzMargin + arithmeticGuard, 'critical total margin overflow');
    const centerValue = evaluate(center), leftValue = evaluate(low), rightValue = evaluate(high);
    check(Math.abs(centerValue) > totalMargin, 'critical bracket root/tangent cannot be excluded by Lipschitz and scalar guard');
    const sign = safeSign(centerValue);
    check(sign !== 0 && safeSign(leftValue) === sign && safeSign(rightValue) === sign, 'critical bracket endpoint sign is unresolved');
    criticalBrackets.push({ derivativeRootIndex, bracket: [low, high], center, centerValue, leftValue, rightValue,
      lipschitzBound, lipschitzMargin, arithmeticGuard, totalMargin, sign });
  }
  check(criticalBrackets.length <= 2, 'critical bracket capacity exceeded', 'BUDGET');
  if (originalCoefficients[0] === 0) roots.push({ t: 0, bracket: [0, 0], iterations: 0, touch: originalCoefficients[1] === 0 });
  if (originalCoefficients[3] === 0) roots.push({ t: 1, bracket: [1, 1], iterations: 0, touch: originalCoefficients[2] === 0 });
  const intervals: [number, number][] = [];
  let cursor = 0;
  for (const critical of criticalBrackets) { intervals.push([cursor, critical.bracket[0]]); cursor = critical.bracket[1]; }
  intervals.push([cursor, 1]);
  check(intervals.length <= 3, 'monotone interval capacity exceeded', 'BUDGET');
  const associations: { interval: CubicBernsteinRootEvidence['monotoneIntervals'][number]; root: HomogeneousBernsteinRoot }[] = [];
  for (const domain of intervals) {
    let [low, high] = domain;
    check(low < high, 'positive represented monotone interval required');
    const leftValue = evaluate(low), rightValue = evaluate(high), leftSign = safeSign(leftValue), rightSign = safeSign(rightValue);
    const leftEndpoint = low === 0 && originalCoefficients[0] === 0, rightEndpoint = high === 1 && originalCoefficients[3] === 0;
    check(leftEndpoint || leftSign !== 0, 'nonzero monotone left sign is uncertain');
    check(rightEndpoint || rightSign !== 0, 'nonzero monotone right sign is uncertain');
    const interval: CubicBernsteinRootEvidence['monotoneIntervals'][number] = {
      domain, leftValue, rightValue, status: 'support-disjoint', rootIndex: null, iterations: 0, nearZeroQuarterSteps: 0,
    };
    monotoneIntervals.push(interval);
    if (leftEndpoint || rightEndpoint) {
      check(!(leftEndpoint && rightEndpoint), 'noncoincident flat endpoint-to-endpoint interval unresolved');
      interval.status = 'endpoint-only';
      associations.push({ interval, root: roots.find(root => root.t === (leftEndpoint ? 0 : 1))! }); continue;
    }
    if (leftSign === rightSign) continue;
    interval.status = 'crossing';
    let iterations = 0, nearZeroQuarterSteps = 0;
    while (high - low > parameterWidthTarget && iterations < 64) {
      const center = midpoint(low, high), centerSign = safeSign(evaluate(center));
      if (centerSign === 0) {
        const quarterLow = midpoint(low, center), quarterHigh = midpoint(center, high);
        const quarterLowSign = safeSign(evaluate(quarterLow)), quarterHighSign = safeSign(evaluate(quarterHigh));
        check(quarterLowSign === leftSign && quarterHighSign === rightSign,
          'near-zero midpoint quarter points do not provide safely opposite ordered signs');
        low = quarterLow; high = quarterHigh; nearZeroQuarterSteps++;
      } else if (centerSign === leftSign) low = center;
      else { check(centerSign === rightSign, 'monotone cubic crossing sign/order changed'); high = center; }
      iterations++;
    }
    check(high - low <= parameterWidthTarget, 'cubic root bisection width budget exhausted', 'BUDGET');
    check(low > 0 && high < 1, 'interior crossing bracket must not become a global endpoint');
    const t = midpoint(low, high);
    evaluate(t);
    const root: HomogeneousBernsteinRoot = { t, bracket: [low, high], iterations, touch: false };
    roots.push(root); interval.iterations = iterations; interval.nearZeroQuarterSteps = nearZeroQuarterSteps;
    associations.push({ interval, root });
  }
  check(roots.length <= 3, 'isolated cubic root capacity exceeded', 'BUDGET');
  roots.sort((a, b) => a.t < b.t ? -1 : a.t > b.t ? 1 : 0);
  for (let i = 1; i < roots.length; i++) check(roots[i - 1].t < roots[i].t && roots[i - 1].bracket[1] < roots[i].bracket[0],
    'distinct cubic roots/brackets/order must not merge');
  for (const association of associations) association.interval.rootIndex = roots.indexOf(association.root);
  return { roots, evidence: makeEvidence() };
}
