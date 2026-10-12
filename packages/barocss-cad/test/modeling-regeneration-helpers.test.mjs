import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
if (process.env.CAD_MODEL_TEST_MODULE) assert.ok(process.env.CAD_MODEL_REGENERATION_HELPER_MODULE, 'Source helper checks require the actual source helper bundle');
const { modelingGraphKey: key, modelingNodeParameters: refs, modelingReusablePrefix: prefix } = await import(process.env.CAD_MODEL_REGENERATION_HELPER_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_REGENERATION_HELPER_MODULE)).href : '../dist/modeling-regeneration-internal.js');

test('private key binds graph/options/output/names and exact structural signed-zero literals', () => {
  const document = () => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { width: 32, level: 2 }, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [{ parameter: 'width' },24] },
    { kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'z', at: { parameter: 'level' } },
  ], outputs: { lower: { node: 2, side: 'negative' } } });
  const original = document(), baseline = key(original);
  for (const edit of [
    d => { d.nodes[0].min[0] = -0; }, d => { d.nodes[1].height = 10; }, d => { d.nodes[2].axis = 'x'; },
    d => { d.outputs.lower.side = 'positive'; }, d => { d.outputs = { other: d.outputs.lower }; },
    d => { d.parameters.unused = 0; }, d => { d.units = 'm'; }, d => { d.schema = 2; },
  ]) { const d = document(); edit(d); assert.notEqual(key(d), baseline); }
  const valuesOnly = document(); valuesOnly.parameters.width = 40; assert.equal(key(valuesOnly), baseline);
  const reordered = document(); reordered.parameters = { level: 2, width: 32 }; assert.equal(key(reordered), baseline);
});

test('private reference collector covers every admitted dimension location and excludes topology references', () => {
  const p = parameter => ({ parameter });
  for (const [node, expected] of [
    [{ kind: 'sketch', profile: 'polygon', points: [[p('px'),0],[8,p('py')],[p('px'),8]] }, ['px','py']],
    [{ kind: 'sketch', profile: 'rectangle', min: [p('minX'),0], max: [p('width'),p('height')] }, ['height','minX','width']],
    [{ kind: 'extrude', sketch: 0, height: p('height') }, ['height']],
    [{ kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'x', at: p('level') }, ['level']],
    [{ kind: 'chamfer', parent: { node: 1, side: 'solid' }, distance: p('distance'), edge: { parallelTo: 'x', at: { x: p('sx'), y: 'min', z: p('sz') } } }, ['distance','sx','sz']],
    [{ kind: 'cut', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' }, axis: 'x' }, []],
    [{ kind: 'intersect', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } }, []],
  ]) { const result = refs(node); assert.deepEqual(result, expected); assert.ok(Object.isFrozen(result)); }
});

test('private prefix rejects authority/key mismatch and uses Object.is on relevant values only', () => {
  const names = [['minX','width'], ['height'], ['front'], ['back','y']];
  const previous = { minX: 0, width: 32, height: 8, front: 1, back: 2, y: 24, unused: 0 };
  const run = (edits = {}, authority = true, nextKey = 'same') => prefix(authority, nextKey, 'same', { ...previous, ...edits }, previous, names);
  assert.equal(run(), 4); assert.equal(run({ back: 2 }), 4); assert.equal(run({ unused: -0 }), 4);
  assert.equal(run({ minX: -0 }), 0); assert.equal(run({ width: 40, back: 3 }), 0);
  assert.equal(run({ height: 10 }), 1); assert.equal(run({ front: 2 }), 2); assert.equal(run({ back: 3 }), 3); assert.equal(run({ y: 1 }), 3);
  assert.equal(run({}, false), 0); assert.equal(run({}, true, 'different'), 0);
  assert.ok(Object.is(previous.minX, 0) && Object.is(previous.unused, 0));
});
