import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep, evaluateCadPart, evaluateCurve, evaluateSurface, extractSurfaceIsoCurve, massPropertiesOf, outputOf, splitSurfaceAtParameter } from '../dist/index.js';
import { buildCylindricalWrapMap } from '../dist/features/cylindrical-wrap-map.js';
import { composeCylindricalWrapCurve } from '../dist/features/cylindrical-wrap-curve.js';

// This allowance observes native Number evaluation at a few points. It is not a production admission bound.
const OBSERVATION_SLACK = 1e-11;
function closePoint(actual, expected, bound) {
  assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1], actual[2] - expected[2]) <= bound + OBSERVATION_SLACK, `${actual} vs ${expected}, bound ${bound}`);
}
function source() {
  const input = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 'circle', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 },
    { id: 'post', kind: 'extrude', sketch: 'circle', height: 30 },
  ] };
  const output = outputOf(evaluateCadPart(input), 'post');
  let carrier;
  for (const face of output.brep.faces) {
    const surface = face.surface;
    if (surface.kind === 'surface' && surface.degreeU === 2 && surface.degreeV === 1 && surface.controlPoints.length === 5
      && surface.controlPoints[0][0][0] === 10 && surface.controlPoints[0][0][1] === 0
      && surface.controlPoints[1][0][1] > 0) carrier = surface;
  }
  assert.ok(carrier, 'the native cylinder has its original +X semicircle carrier');
  const split = splitSurfaceAtParameter(carrier, { axis: 'u', parameter: 0.5, lowerSurfaceId: 'native_quarter', upperSurfaceId: 'other_quarter' });
  assert.equal(split.provenance.refinement.kind, 'direct-copy'); assert.equal(split.provenance.refinement.insertions, 0);
  return { input, output, quarter: split.lower };
}

test('native cylinder quarter: original-U map and cubic composition share stored endpoints and separate analytic bounds', () => {
  const { input, output, quarter } = source(), before = structuredClone({ input, brep: output.brep, quarter });
  assert.equal(checkBrep(output.brep, { strict: true }).valid, true); assert.equal(output.brep.bodies.length, 1);
  assert.ok(Math.abs(massPropertiesOf(output, 1).volume - 3000 * Math.PI) < 1e-8);
  assert.deepEqual(quarter.knotsU, [0, 0, 0, 0.5, 0.5, 0.5]);
  for (let row = 0; row < 3; row++) {
    assert.equal(quarter.weights[row][0], quarter.weights[row][1]);
    assert.equal(quarter.controlPoints[row][0][0], quarter.controlPoints[row][1][0]);
    assert.equal(quarter.controlPoints[row][0][1], quarter.controlPoints[row][1][1]);
    assert.equal(quarter.controlPoints[row][0][2], 0); assert.equal(quarter.controlPoints[row][1][2], 30);
  }
  const circle = extractSurfaceIsoCurve(quarter, { fixedAxis: 'v', parameter: 0, curveId: 'original_quarter_row' }).curve;
  const map = buildCylindricalWrapMap(circle, { radius: 10, tolerance: 0.01 });
  assert.deepEqual(map.source, circle); assert.equal(map.nodes[0].u, 0); assert.equal(map.nodes.at(-1).u, 0.5);
  assert.equal(map.meaning.solid, false); assert.equal(map.meaning.surfaceBinding, false);
  let endpoint = null;
  for (let i = 0; i < map.intervals.length; i++) {
    const cell = map.intervals[i], a = map.nodes[cell.first], b = map.nodes[cell.last];
    const result = composeCylindricalWrapCurve(quarter, { start: [a.u, 0.25], end: [b.u, 0.25] },
      { curveId: `wrapped_${i}`, pcurveId: `uv_${i}`, endpoints: [endpoint, null] });
    assert.deepEqual(result.original, quarter); assert.equal(result.curve.degree, 3); assert.equal(result.pcurve.degree, 1);
    assert.deepEqual(result.pcurve.controlPoints, [[a.u, 0.25, 0], [b.u, 0.25, 0]]);
    assert.equal(result.proof.globalEvaluatorErrorCertified, false); assert.equal(result.proof.topologyCertified, false);
    assert.ok(result.proof.worldError.upper <= 1e-7);
    if (endpoint) { assert.deepEqual(result.curve.controlPoints[0], endpoint); assert.equal(result.proof.endpointOrigins[0], 'table'); }
    // Analytic certificates belong to exact affine interpolation/stored rational functions. Samples only detect regressions.
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const world = evaluateCurve(result.curve, t), uv = evaluateCurve(result.pcurve, t);
      closePoint(world, evaluateSurface(quarter, uv[0], uv[1]), result.proof.worldError.upper);
      const s = a.s * (1 - t) + b.s * t;
      closePoint(world, [10 * Math.cos(s / 10), 10 * Math.sin(s / 10), 7.5], map.bounds.basePosition.upper + result.proof.worldError.upper);
    }
    endpoint = result.curve.controlPoints.at(-1);
  }
  assert.deepEqual({ input, brep: output.brep, quarter }, before);
  // Independent per-edge requests do not qualify an aggregate glyph budget or any wrapped solid.
});
