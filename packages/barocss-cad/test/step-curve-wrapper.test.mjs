import assert from 'node:assert/strict';
import test from 'node:test';
import { BrepError, brepMassProperties, checkBrep, evaluateCadPart, importStep } from '../dist/index.js';
import { curveWrapperStep, verifyWrapperGraph } from './step-curve-wrapper-fixtures.mjs';
import { cylinderStep } from './step-fixtures.mjs';

const baseline = process.env.D741_BASELINE === '1';
const consumers = ['edge', 'extrusion', 'revolution'];
const cycleMessage = /cyclic curve wrapper #1000 \(SURFACE_CURVE\)/i;
const part = text => evaluateCadPart({
  format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {},
  features: [{ id: 'wrapped', kind: 'import', step: text }],
});
const checkInput = (text, message) => {
  assert.throws(() => importStep(text), error =>
    error instanceof BrepError && error.code === 'INPUT' && message.test(error.message));
  assert.throws(() => part(text), error =>
    error.code === 'INPUT' && error.feature === 'wrapped' && message.test(error.message));
};

for (const consumer of consumers) {
  test(`STEP curve-wrapper traversal terminates on reached ${consumer} cycles`, { timeout: 5000 }, () => {
    for (const length of [1, 2, 3]) {
      const fixture = curveWrapperStep(consumer, { length, end: 'cycle' });
      verifyWrapperGraph(fixture, 'cycle', length);
      if (baseline) {
        assert.throws(() => importStep(fixture.text), RangeError);
        assert.throws(() => part(fixture.text), error => error.code === 'GEOMETRY' &&
          error.feature === 'wrapped' && /unexpected kernel failure/i.test(error.message));
      } else checkInput(fixture.text, cycleMessage);
    }
  });
}

test('STEP wrapper failures retain missing-reference and offset routing', { timeout: 5000 }, () => {
  for (const consumer of consumers) {
    checkInput(curveWrapperStep(consumer, { end: 'missing' }).text, /#90000 is missing/);
    const fixture = curveWrapperStep(consumer, { length: 3, end: 'cycle', offset: true });
    verifyWrapperGraph(fixture, 'cycle', 3);
    if (consumer === 'edge') {
      const message = /OFFSET_SURFACE boundary wrapper cycle or depth is not supported yet/;
      assert.throws(() => importStep(fixture.text), error =>
        error instanceof BrepError && error.code === 'INPUT' && message.test(error.message));
      assert.throws(() => part(fixture.text), error =>
        error.code === 'CAPABILITY' && error.feature === 'wrapped' && message.test(error.message));
    } else if (baseline) assert.throws(() => importStep(fixture.text), RangeError);
    else checkInput(fixture.text, cycleMessage);
  }
});

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);
const physical = {
  edge: { volume: 1400 / 3, centroid: [5, 164 / 35, 2.5], faces: ['bottom', 'curved', 'front', 'left', 'right', 'top'] },
  extrusion: { volume: 1400 / 3, centroid: [5, 164 / 35, 2.5], faces: ['bottom', 'curved', 'front', 'left', 'right', 'top'] },
  revolution: { volume: 666 * Math.PI / 5, centroid: [0, 0, 377 / 111], faces: ['bottom', 'top', 'wall#1', 'wall#2'] },
};
function checkPhysical(text, consumer) {
  const brep = importStep(text);
  const check = checkBrep(brep, { strict: true });
  assert.ok(check.valid, JSON.stringify(check.issues));
  assert.deepEqual(brep.faces.map(face => face.name).sort(), physical[consumer].faces);
  const mass = brepMassProperties(brep, 1);
  close(mass.volume, physical[consumer].volume);
  mass.centroid.forEach((value, i) => close(value, physical[consumer].centroid[i]));
  assert.deepEqual(part(text).outputs.map(output => output.id), ['wrapped']);
}

test('STEP single and nested acyclic wrappers preserve strict native swept geometry and shared reuse', { timeout: 5000 }, () => {
  for (const consumer of consumers) {
    for (const length of [1, 3]) {
      const shared = consumer === 'extrusion';
      const fixture = curveWrapperStep(consumer, { length, shared });
      verifyWrapperGraph(fixture, 'basis', length, shared);
      checkPhysical(fixture.text, consumer);
    }
  }
});

test('ordinary STEP wrapper traversal has no new finite depth limit', { timeout: 5000 }, () => {
  const fixture = curveWrapperStep('edge', { length: 12000 });
  verifyWrapperGraph(fixture, 'basis', 12000);
  if (baseline) assert.throws(() => importStep(fixture.text), RangeError);
  else checkPhysical(fixture.text, 'edge');
});

test('distinct STEP edges can share a wrapper and its basis', () => {
  const original = cylinderStep();
  const solids = original.match(/^#1=.*\n[\s\S]*?^#55=MANIFOLD_SOLID_BREP.*;$/m)?.[0];
  assert.ok(solids);
  // Translate a second cylinder below the first. Its top and the first cylinder's bottom share the z=0 circle.
  const second = solids.replace(/#(\d+)/g, (_, id) => '#' + (100 + Number(id)))
    .replace(/CARTESIAN_POINT\('',\(([^,]+),([^,]+),([^)]+)\)\)/g,
      (_, x, y, z) => `CARTESIAN_POINT('',(${x},${y},${Number(z) - 10}.))`)
    .replace("#117=EDGE_CURVE('',#104,#104,#116,.T.);", "#117=EDGE_CURVE('',#104,#104,#10,.T.);");
  assert.match(original, /^#11=EDGE_CURVE\('',#2,#2,#10,\.T\.\);$/m);
  assert.match(second, /^#117=EDGE_CURVE\('',#104,#104,#10,\.T\.\);$/m);
  const text = original.replace("#58=ADVANCED_BREP_SHAPE_REPRESENTATION('',(#55),#57);",
    second + "\n#58=ADVANCED_BREP_SHAPE_REPRESENTATION('',(#55,#155),#57);");
  const brep = importStep(text);
  assert.equal(brep.bodies.length, 2);
  assert.ok(checkBrep(brep, { strict: true }).valid);
  const mass = brepMassProperties(brep, 1);
  close(mass.volume, 500 * Math.PI);
  mass.centroid.forEach(value => close(value, 0));
});
