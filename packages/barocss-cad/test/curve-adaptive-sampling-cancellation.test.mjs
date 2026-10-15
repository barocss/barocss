import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleCurveAdaptive, evaluateCurve } from '../dist/index.js';
import { finiteSegmentDistance } from '../dist/curve-adaptive-sampling.js';

test('C6: a point whose chord projection cancels to ~0 is measured, not refused', () => {
  // Exactly perpendicular above the start, with coordinates whose products round.
  const start = [0.1, 0.2, 0.3], end = [0.1 + 3e1, 0.2 + 7e-1, 0.3 - 1.1], dir = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
  const perpendicular = [-dir[1], dir[0], 0], point = start.map((v, i) => v + perpendicular[i] * 0.37);
  const d = finiteSegmentDistance(point, start, end);
  assert.ok(Math.abs(d - Math.hypot(...perpendicular) * 0.37) < 1e-9, String(d));
});

test('C6: the cubic that used to throw "projection cancellation uncertain" now samples within tolerance', () => {
  const curve = { kind: 'curve', id: 'c', degree: 3, knots: [0, 0, 0, 0, 0.2, 0.4, 0.6, 0.8, 1, 1, 1, 1],
    controlPoints: [[27, 33, -4], [75, 84, -15], [-72, 80, 19], [-39, -30, -16], [-58, 21, -5], [2, -32, 18], [66, 55, -7], [-52, -10, -18]], weights: Array(8).fill(1) };
  const r = sampleCurveAdaptive(curve, { chordToleranceMM: 0.05, maxSegments: 1024, maxDepth: 16, resultIdPrefix: 's' });
  assert.ok(r.segments.length > 8);
  // Every returned point is on the original curve.
  r.parameters.forEach((t, i) => { const p = evaluateCurve(curve, t); assert.ok(Math.hypot(...p.map((v, k) => v - r.pointsMM[i][k])) < 1e-9); });
});
