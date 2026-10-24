import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateCadPart, massPropertiesOf, solveXYNumericalSketch, validateXYNumericalSketch } from '../dist/index.js';
import { solveXYCircularNumericalSketch, validateXYCircularNumericalSketch } from '../dist/sketch/xy-circular-numerical-sketch.js';

function sketch(circular) {
  const document = {
    format: circular ? 'barocss-xy-circular-numerical-sketch' : 'barocss-xy-numerical-sketch', version: 0,
    profile: circular ? 'bounded-radius-interior-tangent-v0' : 'bounded-length-angle-v0', id: 'sk', lengthUnit: 'mm', angleUnit: 'rad',
    points: [{ id: 'a', position: [0, 0] }, { id: 'b', position: [10, 0] }, { id: 'c', position: [0, 10] }],
    segments: [{ id: 'ab', startPointId: 'a', endPointId: 'b' }, { id: 'ac', startPointId: 'a', endPointId: 'c' }],
    constraints: [{ id: 'fa', kind: 'fixed', pointId: 'a', target: [0, 0] }, { id: 'fb', kind: 'fixed', pointId: 'b', target: [10, 0] },
      { id: 'length', kind: 'length', segmentId: 'ac', length: 10 }, { id: 'angle', kind: 'signed-angle', segmentA: 'ab', segmentB: 'ac', angle: Math.PI / 2 }],
    branchGuards: [],
  };
  if (circular) {
    document.points.push({ id: 'o', position: [20, 0] });
    document.circles = [{ id: 'circle', centerPointId: 'o', radius: { id: 'radius', valueMM: 3 }, seamId: 'seam' }];
    document.constraints.push({ id: 'fo', kind: 'fixed', pointId: 'o', target: [20, 0] }, { id: 'r', kind: 'radius', circleId: 'circle', radiusMM: 3 });
  }
  return document;
}

for (const circular of [false, true]) {
  const solve = circular ? solveXYCircularNumericalSketch : solveXYNumericalSketch;
  const validate = circular ? validateXYCircularNumericalSketch : validateXYNumericalSketch;
  const name = circular ? 'circular' : 'linear';
  test(`R7 ${name} numerical sketch admits the declared length and angle fields and rebuilds`, () => {
    const result = solve(sketch(circular));
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    const c = result.solution.points.find(p => p.id === 'c').position;
    assert.ok(Math.hypot(c[0], c[1] - 10) < 1e-7);
    assert.equal(result.document.constraints.find(c => c.kind === 'length').length, 10);
    assert.equal(result.document.constraints.find(c => c.kind === 'signed-angle').angle, Math.PI / 2);
    assert.equal(result.document.angleUnit, 'rad');
    assert.deepEqual(validate(result), result.report);
  });
  test(`R7 ${name} numerical sketch refuses the old constraint keys without aliases`, () => {
    for (const [kind, current, old] of [['length', 'length', 'lengthMM'], ['signed-angle', 'angle', 'angleRad']]) {
      const document = sketch(circular), constraint = document.constraints.find(c => c.kind === kind);
      constraint[old] = constraint[current]; delete constraint[current];
      const result = solve(document);
      assert.equal(result.ok, false);
      assert.equal(result.diagnostics[0].code, 'INVALID_DOCUMENT');
      assert.equal(result.diagnostics[0].path, `$.constraints[${document.constraints.indexOf(constraint)}]`);
    }
  });
}

test('R7 inertia-cuboid fixture uses current rotation fields and preserves its SI oracle', () => {
  const fixture = JSON.parse(readFileSync(new URL('../conformance/rm/inertia-cuboid/case.json', import.meta.url), 'utf8'));
  const nodes = fixture.input.document.nodes;
  const features = nodes.map(n => {
    if (n.kind === 'sketch') return { id: n.id, kind: n.kind, profile: n.profile, min: n.min, max: n.max };
    if (n.kind === 'extrude') return { id: n.id, kind: n.kind, sketch: nodes[n.sketch].id, height: n.height, from: n.from };
    assert.equal(n.kind, 'rotate'); assert.equal(Object.hasOwn(n, 'angleDegrees'), false);
    return { id: n.id, kind: n.kind, target: nodes[n.parent.node].id, axis: n.axis, angle: n.angle, pivot: n.pivot };
  });
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features };
  const m = massPropertiesOf(evaluateCadPart(doc).outputs.at(-1), 2.7);
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= fixture.tol_rel * Math.abs(expected), `${actual} vs ${expected}`);
  close(m.mass / 1000, fixture.expect.mass_kg);
  m.centroid.forEach((x, i) => close(x / 1000, fixture.expect.com_m[i]));
  m.inertia.flat().forEach((x, i) => close(x / 1e9, fixture.expect.inertia_kg_m2[i]));
});
