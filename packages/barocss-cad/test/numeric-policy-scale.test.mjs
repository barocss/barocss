import test from 'node:test';
import assert from 'node:assert/strict';
import { CadNumericPolicy, linearToleranceMM, geometryScaleMM } from '../dist/numeric-policy.js';
import { intersectBezierCurveWithAffinePlaneSurface } from '../dist/own-curve-plane-intersection.js';
import { intersectCoplanarCurveWithLineSegment } from '../dist/own-curve-line-intersection.js';

const plane = (S, z = 0) => ({ kind: 'surface', id: 'p', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
  controlPoints: [[[-S, -S, z], [-S, S, z]], [[S, -S, z], [S, S, z]]], weights: [[1, 1], [1, 1]] });
const quadratic = (id, poles) => ({ kind: 'curve', id, degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: poles, weights: [1, 1, 1] });

test('linear tolerance: the 1e-7 mm floor inside the modeling range, scaled beyond it', () => {
  assert.equal(linearToleranceMM(0), 1e-7);
  assert.equal(linearToleranceMM(CadNumericPolicy.coordinateAbsMM), 1e-7);
  assert.ok(Math.abs(linearToleranceMM(1e6) - 1e-5) < 1e-18);
  assert.equal(geometryScaleMM([[1, -7, 2]], [[3, 4, 5]]), 7);
  assert.equal(CadNumericPolicy.geometryCoordinateAbsMM, 1e6);
});

test('C7: curve-plane intersections at 1e6 mm bind (36 % were refused), and report the tolerance used', () => {
  let seed = 3; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (const S of [1e3, 1e6]) {
    for (let k = 0; k < 300; k++) {
      const poles = [[(rnd() - .5) * S, (rnd() - .5) * S, -(0.1 + rnd()) * S * 0.3], [(rnd() - .5) * S, (rnd() - .5) * S, (rnd() - .5) * S * 0.3], [(rnd() - .5) * S, (rnd() - .5) * S, (0.1 + rnd()) * S * 0.3]];
      const r = intersectBezierCurveWithAffinePlaneSurface(quadratic('c', poles), plane(S), { evaluationId: 'e', pointEventIds: ['a', 'b'] });
      assert.equal(r.report.numericPolicy.pointBindingComparisonMM, linearToleranceMM(geometryScaleMM(poles, plane(S).controlPoints.flat())));
    }
  }
  const small = intersectBezierCurveWithAffinePlaneSurface(quadratic('c', [[0, 0, -1], [1, 0, 0], [2, 0, 1]]), plane(10), { evaluationId: 'e', pointEventIds: ['a', 'b'] });
  assert.equal(small.report.numericPolicy.pointBindingComparisonMM, 1e-7);
});

test('C7: coplanar curve-line intersections scale the same way; modeling-range results keep 1e-7', () => {
  const options = (name) => ({ evaluationId: name + '_eval', derivedSpanIds: [name + '_span_0'], pointEventIds: Array.from({ length: 16 }, (_, i) => name + '_event_' + i),
    overlapIds: Array.from({ length: 32 }, (_, i) => name + '_overlap_' + i), spanBindingIds: [name + '_span_uv_0'],
    overlapBindingIds: Array.from({ length: 32 }, (_, i) => name + '_overlap_uv_' + i), boundaryContactIds: Array.from({ length: 64 }, (_, i) => name + '_contact_' + i) });
  for (const S of [10, 1e3, 3e5]) {
    const curve = quadratic('arc', [[-S, -S * 0.5, 0], [S * 0.1, S * 1.3, 0], [S, -S * 0.4, 0]]);
    const line = { kind: 'curve', id: 'cut', degree: 1, knots: [0, 0, 1, 1], controlPoints: [[-S * 1.2, S * 0.1, 0], [S * 1.2, S * 0.13, 0]], weights: [1, 1] };
    const r = intersectCoplanarCurveWithLineSegment(curve, line, plane(S * 2), options('s' + String(S).replace(/\W/g, '')));
    assert.equal(r.report.numericPolicy.pointBindingComparisonMM, S <= 5000 ? 1e-7 : linearToleranceMM(S * 2), String(S));
    assert.equal(r.report.pointEventCount, 2, String(S)); assert.equal(r.events.length, 2);
  }
});
