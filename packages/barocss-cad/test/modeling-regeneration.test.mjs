import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { cad, CadModelError } = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
const refuses = (fn, code) => assert.throws(fn, e => e instanceof CadModelError && e.code === code);
const document = () => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { width: 32, height: 8, distance: 1, y: 0 }, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [{ parameter: 'width' },24] },
  { kind: 'extrude', sketch: 0, height: { parameter: 'height' } },
  { kind: 'chamfer', parent: { node: 1, side: 'solid' }, distance: { parameter: 'distance' }, edge: { parallelTo: 'x', at: { y: { parameter: 'y' }, z: 'max' } } },
], outputs: { part: { node: 2, side: 'solid' } } });

test('saved documents cannot import public diagnostics, geometry or evaluation frames', () => {
  for (const key of ['recomputation', 'evidence', 'values', 'cache', 'authority']) {
    const d = document(); d[key] = {}; refuses(() => cad.load(JSON.stringify(d)), 'INPUT');
  }
  const m = cad.model(), blank = m.sketch.rectangle({ width: 8, height: 8 }).extrude(8);
  refuses(() => m.build({ part: { ...blank } }), 'OWNERSHIP');
});

test('all dimension locations retain strict parameter admission before any possible reuse', () => {
  for (const edit of [
    d => { d.nodes[0].max[0].parameter = 'unknown'; },
    d => { d.nodes[1].height.parameter = 'unknown'; },
    d => { d.nodes[2].distance.parameter = 'unknown'; },
    d => { d.nodes[2].edge.at.y.parameter = 'unknown'; },
    d => { d.nodes[2] = { kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'x', at: { parameter: 'unknown' } }; },
    d => { d.nodes[0] = { kind: 'sketch', profile: 'polygon', points: [[0,0],[{ parameter: 'unknown' },0],[0,8]] }; },
  ]) { const d = document(); edit(d); refuses(() => cad.load(JSON.stringify(d)), 'PARAMETER'); }
});
