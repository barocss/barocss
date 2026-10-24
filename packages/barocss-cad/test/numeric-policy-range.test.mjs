import test from 'node:test';
import assert from 'node:assert/strict';
import { CadNumericPolicy, sampleCurveAdaptive, splitCurveAtParameter, evaluateCurveCurvature } from '../dist/index.js';
import { intersectBezierCurveWithAffinePlaneSurface } from '../dist/intersect/own-curve-plane-intersection.js';

const cubic = S => ({ kind: 'curve', id: 'c', degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: [[-S, 0, -S * .2], [-S * .3, S * .6, S * .1], [S * .4, -S * .5, S * .05], [S, S * .2, S * .3]], weights: [1, 1, 1, 1] });
const quadratic = S => ({ kind: 'curve', id: 'q', degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [[-S, 0, -S * .2], [0, S * .6, S * .1], [S, S * .2, S * .3]], weights: [1, 1, 1] });
const plane = S => ({ kind: 'surface', id: 'p', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[-S, -S, 0], [-S, S, 0]], [[S, -S, 0], [S, S, 0]]], weights: [[1, 1], [1, 1]] });
const ops = S => ({
  intersect: () => intersectBezierCurveWithAffinePlaneSurface(quadratic(S), plane(S * 1.1), { evaluationId: 'e', pointEventIds: ['a', 'b'] }),
  sample: () => sampleCurveAdaptive(cubic(S), { chordToleranceMM: S * 1e-4, maxSegments: 1024, maxDepth: 16, resultIdPrefix: 's' }),
  split: () => splitCurveAtParameter(cubic(S), { parameter: 0.37, lowerCurveId: 'lo', upperCurveId: 'hi' }),
  curvature: () => evaluateCurveCurvature(cubic(S), 0.37),
});

test('C9: geometry operations share the geometry range — all work at 5e5 mm (sampling, split, curvature refused beyond 1e4 before)', () => {
  for (const [name, run] of Object.entries(ops(5e5))) assert.doesNotThrow(run, name);
});

test('C9: beyond the geometry range every geometry operation refuses alike', () => {
  for (const [name, run] of Object.entries(ops(2e6))) assert.throws(run, undefined, name);
});

test('modeling-range results keep the 1e-7 mm floor; reports name the range used', () => {
  const split = ops(100).split(), sample = ops(100).sample();
  assert.equal(split.report.limits.observationComparison, 1e-7);
  assert.equal(sample.report.inputProfile.coordinateAbsMM, CadNumericPolicy.geometryCoordinateAbs);
  assert.ok(ops(5e5).split().report.limits.observationComparison > 1e-7);
});

test('knot / parameter range stays the parameter range (only coordinates widened)', () => {
  const curve = { ...cubic(10), knots: [0, 0, 0, 0, 2e4, 2e4, 2e4, 2e4] };
  assert.throws(() => evaluateCurveCurvature(curve, 1e4), e => { let m = ''; for (let c = e; c; c = c.cause) m += c.message + ' | '; return /knots must be finite and within 10000/.test(m); });
});
