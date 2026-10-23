import { insertCurveKnotCoefficientsTrusted } from './curve-knot-insertion.js';
import type { CurveKnotCoefficientResult } from './curve-knot-insertion.js';
import { compileCadModel } from '../../model-compiler.js';
import { curveDomain, validateCurve } from '../../core/math.js';
import { curveDecimal } from './curve-source.js';
import { copyCadData } from '../../data-copy.js';
import type { Curve, Model, Point } from '../../types.js';
import { same } from '../../core/structural-equality.js';

type PoleMap = { refinedPoleIndex: number; childPoleIndex: number };
type KnotMap = { childKnotIndex: number; refinedKnotIndex: number | null; value: number;
  origin: 'refined-copy' | 'requested-clamp' };
type ChildMap = { side: 'lower' | 'upper'; curveId: string; poleMappings: PoleMap[]; knots: KnotMap[] };
export interface BezierSubdivisionResult {
  input: Curve; parameter: number; coefficientResult: CurveKnotCoefficientResult;
  lower: Curve; upper: Curve; source: string; sourceVersion: 0; model: Model;
  provenance: { firstRefinedKnotIndex: number; lower: ChildMap; upper: ChildMap;
    shared: { refinedPoleIndex: number; lowerPoleIndex: number; upperPoleIndex: 0; pointMM: Point; weight: number } };
  directCounts: { coefficientHelperInvocationCount: number; sourceCompileCount: number };
}
const LABEL = 'Bezier subdivision';
function check(value: boolean, detail: string): asserts value {
  if (!value) throw new Error((LABEL + ': ' + detail).slice(0, 1024));
}
function id(value: string): void {
  check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), 'A bounded reserved ASCII identity is required');
}

/** Private admitted-Bezier wrapper; no D0/D1 calls or widening of the existing public providers. */
export function splitBezierCurveTrusted(curve: Curve, parameter: number,
  lowerCurveId: string, upperCurveId: string, modelName: string): BezierSubdivisionResult {
  try {
    const input = copyCadData(curve), p = input.degree;
    id(input.id); id(lowerCurveId); id(upperCurveId); id(modelName);
    check(new Set([input.id, lowerCurveId, upperCurveId, modelName]).size === 4, 'Input, child and fresh Model identities must be distinct');
    check(input.kind === 'curve' && Number.isInteger(p) && p >= 1 && p <= 5 &&
      input.controlPoints.length === p + 1 && input.controlPoints.length <= 6 && input.knots.length === 2 * (p + 1),
    'A degree1..5 single-span Bezier with at most six controls is required');
    validateCurve(input);
    check(input.controlPoints.every(point => point.every(value => Number.isFinite(value) && Math.abs(value) <= 10000)),
      'Working Cartesian coordinates must stay within10000mm');
    const domain = curveDomain(input), width = domain[1] - domain[0], half = width * .5, midpoint = domain[0] + half;
    check(Number.isFinite(width) && width > 0 && Number.isFinite(half) && half > 0 && Number.isFinite(midpoint) &&
      midpoint > domain[0] && midpoint < domain[1], 'The local midpoint must have a strictly represented interior parameter');
    check(Number.isFinite(parameter) && Object.is(parameter, midpoint), 'The requested cut must retain the admitted midpoint bits');
    check(input.knots.slice(0, p + 1).every(value => Object.is(value, domain[0])) &&
      input.knots.slice(p + 1).every(value => Object.is(value, domain[1])), 'Local clamps must retain original endpoint bits');
    check(2 * p + 1 <= 11 && input.knots.length + p <= 17, 'Temporary subdivision dimensions exceed the private profile');

    const directCounts = { coefficientHelperInvocationCount: 0, sourceCompileCount: 0 };
    directCounts.coefficientHelperInvocationCount++;
    const coefficientResult = insertCurveKnotCoefficientsTrusted(input, parameter, p);
    const refined = coefficientResult.candidate, first = refined.knots.findIndex(value => value === parameter), common = first - 1;
    check(refined.id === input.id && refined.degree === p && same(curveDomain(refined), domain) &&
      refined.controlPoints.length === 2 * p + 1 && refined.controlPoints.length <= 11 &&
      refined.knots.length === 3 * p + 2 && refined.knots.length <= 17 &&
      refined.knots.filter(value => value === parameter).length === p && first === p + 1 && common === p,
    'Actual p-fold refinement, shared index and original domain must match the admitted local profile');
    check(coefficientResult.steps.length === p && coefficientResult.homogeneousSteps.length === p,
      'The complete unchanged p-fold coefficient receipts are required');
    for (const mapping of coefficientResult.unchangedPoles) check(
      same(refined.controlPoints[mapping.refinedPoleIndex], input.controlPoints[mapping.originalPoleIndex]) &&
      Object.is(refined.weights[mapping.refinedPoleIndex], input.weights[mapping.originalPoleIndex]), 'Unchanged coefficient bits differ');
    for (const mapping of coefficientResult.unchangedKnots) check(
      Object.is(refined.knots[mapping.refinedKnotIndex], input.knots[mapping.originalKnotIndex]), 'Unchanged knot bits differ');

    const child = (side: 'lower' | 'upper', curveId: string): { curve: Curve; map: ChildMap } => {
      const offset = side === 'lower' ? 0 : common;
      const poleMappings: PoleMap[] = Array.from({ length: p + 1 }, (_, childPoleIndex) => ({ refinedPoleIndex: offset + childPoleIndex, childPoleIndex }));
      const knots: KnotMap[] = side === 'lower'
        ? [...refined.knots.slice(0, first + p).map((value, index): KnotMap => ({ childKnotIndex: index, refinedKnotIndex: index, value, origin: 'refined-copy' })),
          { childKnotIndex: first + p, refinedKnotIndex: null, value: parameter, origin: 'requested-clamp' }]
        : [{ childKnotIndex: 0, refinedKnotIndex: null, value: parameter, origin: 'requested-clamp' },
          ...refined.knots.slice(first).map((value, index): KnotMap => ({ childKnotIndex: index + 1, refinedKnotIndex: first + index, value, origin: 'refined-copy' }))];
      const staged: Curve = { kind: 'curve', id: curveId, degree: p, knots: knots.map(knot => knot.value),
        controlPoints: poleMappings.map(mapping => copyCadData(refined.controlPoints[mapping.refinedPoleIndex])),
        weights: poleMappings.map(mapping => refined.weights[mapping.refinedPoleIndex]) };
      check(staged.controlPoints.length <= 6 && staged.knots.length === 2 * (p + 1) && staged.knots.length <= 12,
        'Indexed child dimensions exceed the private profile');
      validateCurve(staged);
      return { curve: staged, map: { side, curveId, poleMappings, knots } };
    };
    const stagedLower = child('lower', lowerCurveId), stagedUpper = child('upper', upperCurveId);
    const decimal = (value: number): string => curveDecimal(value, LABEL);
    const list = (values: number[]): string => '[' + values.map(decimal).join(',') + ']';
    const literal = (value: Curve): string => '@curve #' + value.id + ' { type:nurbs; degree:' + decimal(value.degree) +
      '; knots:' + list(value.knots) + '; control-points:[' + value.controlPoints.map(list).join(',') + ']; weights:' + list(value.weights) + '; }';
    const source = '@model ' + modelName + ' { version:0; length-unit:mm; ' + literal(stagedLower.curve) + ' ' + literal(stagedUpper.curve) + ' }\n';
    check(source.length <= 262144 && new TextEncoder().encode(source).length <= 262144, 'Complete child Source0 exceeds the unchanged compiler source cap');
    directCounts.sourceCompileCount++;
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    if (!compiled.ok) throw new Error((LABEL + ': Actual child Source0 compilation refused').slice(0, 1024), { cause: compiled });
    const expected: Model = { name: modelName, version: 0, lengthUnit: 'mm', objects: [stagedLower.curve, stagedUpper.curve] };
    check(same(compiled.model, expected), 'The whole actual two-child Model must retain every field, coefficient and bit');
    const [lower, upper] = compiled.model.objects as Curve[], lowerDomain = curveDomain(lower), upperDomain = curveDomain(upper);
    check(Object.is(lowerDomain[0], domain[0]) && Object.is(upperDomain[1], domain[1]) &&
      Object.is(lowerDomain[1], parameter) && Object.is(upperDomain[0], parameter), 'Actual child domains must partition the original interval with unchanged endpoint/cut bits');
    for (const entry of [{ curve: lower, map: stagedLower.map }, { curve: upper, map: stagedUpper.map }]) {
      for (const mapping of entry.map.poleMappings) check(
        same(entry.curve.controlPoints[mapping.childPoleIndex], refined.controlPoints[mapping.refinedPoleIndex]) &&
        Object.is(entry.curve.weights[mapping.childPoleIndex], refined.weights[mapping.refinedPoleIndex]), 'Actual child pole/weight lineage differs');
      for (const mapping of entry.map.knots) check(Object.is(entry.curve.knots[mapping.childKnotIndex],
        mapping.refinedKnotIndex === null ? parameter : refined.knots[mapping.refinedKnotIndex]), 'Actual child knot lineage differs');
    }
    check(same(lower.controlPoints[common], upper.controlPoints[0]) && Object.is(lower.weights[common], upper.weights[0]),
      'Both actual children must share exactly the indexed Cartesian coefficient and weight');
    return copyCadData({ input, parameter, coefficientResult, lower, upper, source, sourceVersion: 0 as const, model: compiled.model,
      provenance: { firstRefinedKnotIndex: first, lower: stagedLower.map, upper: stagedUpper.map,
        shared: { refinedPoleIndex: common, lowerPoleIndex: common, upperPoleIndex: 0 as const,
          pointMM: copyCadData(refined.controlPoints[common]), weight: refined.weights[common] } }, directCounts });
  } catch (cause) {
    throw new Error((LABEL + ': ' + (cause instanceof Error ? cause.message : 'Private coefficient/source subdivision refused')).slice(0, 1024), { cause });
  }
}
