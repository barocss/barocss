import test from 'node:test';
import assert from 'node:assert/strict';
import { brepMassProperties, evaluateCadPart, outputOf } from '../dist/index.js';

test('mass: a curved body\'s tessellated mass states its volume\'s error, and the error is within it (D200)', () => {
  // A ball r 4 (closed form 4/3 π r³) and a cylinder r 3, h 5 (π r² h), the quadrature turned off: the mesh's chord
  // error is no longer silent.
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const ball = D([{ id: 's', kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, -4] }, { kind: 'arc', start: [0, 4], center: [0, 0], direction: 'cw' }], plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } },
    { id: 'b', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' }, angle: 360 }]);
  const can = D([{ id: 's', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 3 }, { id: 'b', kind: 'extrude', sketch: 's', height: 5 }]);
  for (const [name, doc, exact] of [['ball', ball, 4 / 3 * Math.PI * 64], ['cylinder', can, Math.PI * 45]]) {
    for (const segmentsPerQuarter of [8, 16]) {
      const m = brepMassProperties(outputOf(evaluateCadPart(doc), 'b').brep, 1, { quadratureSegments: 0, segmentsPerQuarter });
      assert.equal(m.method, 'tessellated', name);
      assert.ok(m.volumeBound > 0 && Math.abs(m.volume - exact) <= m.volumeBound, `${name} at ${segmentsPerQuarter}: off ${m.volume - exact}, bound ${m.volumeBound}`);
    }
  }
  // The quadrature's and exact methods carry none.
  assert.equal(brepMassProperties(outputOf(evaluateCadPart(ball), 'b').brep, 1).volumeBound, undefined);
});
