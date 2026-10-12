import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { cad, CadModelError } = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
const refuses = (fn, code) => assert.throws(fn, e => e instanceof CadModelError && e.code === code);

test('cardinal split authoring accepts all axes and rejects invalid inputs before appending', () => {
  for (const axis of ['x', 'y', 'z']) {
    const model = cad.model(), at = model.parameter('at', -0), blank = model.sketch.rectangle({ width: 8, height: 8 }).extrude(8);
    for (const invalid of ['w', 'X', '', null, 0, {}, ['x']]) refuses(() => blank.split({ axis: invalid, at }), 'CAPABILITY');
    refuses(() => blank.split({ axis, at: cad.model().parameter('at', 2) }), 'OWNERSHIP');
    refuses(() => blank.split({ axis, at, extra: 1 }), 'INPUT');
    let calls = 0; refuses(() => blank.split({ get axis() { calls++; return axis; }, at }), 'INPUT'); assert.equal(calls, 0);
    const parts = blank.split({ axis, at }); assert.ok(Object.isFrozen(parts) && Object.isFrozen(parts.negative));
    refuses(() => blank.split({ axis, at: 4 }), 'CAPABILITY');
    refuses(() => parts.positive.split({ axis, at: 4 }), 'CAPABILITY');
  }
});

test('all cardinal axes pass file axis admission while malformed graphs fail before native work', () => {
  const document = axis => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { at: 2 }, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [8,8] }, { kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'split', parent: { node: 1, side: 'solid' }, axis, at: { parameter: 'at' } },
  ], outputs: { negative: { node: 2, side: 'solid' } } });
  for (const axis of ['x', 'y', 'z']) {
    const d = document(axis); refuses(() => cad.load(JSON.stringify(d)), 'INPUT');
    d.outputs.negative.side = 'negative'; d.nodes[2].at.parameter = 'missing'; refuses(() => cad.load(JSON.stringify(d)), 'PARAMETER');
    d.nodes[2].at.parameter = 'at'; d.nodes[2].parent.node = 2; refuses(() => cad.load(JSON.stringify(d)), 'INPUT');
  }
  for (const axis of ['w', 'X', '', null, 0, {}, ['x']]) refuses(() => cad.load(JSON.stringify(document(axis))), 'CAPABILITY');
});
