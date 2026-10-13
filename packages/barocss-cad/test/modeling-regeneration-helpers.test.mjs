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

test('circle dimensions use the same nested dependency/key and signed-zero authority rules', () => {
  const parameter = name => ({ parameter: name });
  const circle = { kind: 'sketch', profile: 'circle', center: [parameter('cx'), { op: 'add', left: parameter('cy'), right: parameter('offset') }], radius: { op: 'scale', value: parameter('diameter'), factor: .5 } };
  const height = { kind: 'extrude', sketch: 0, height: parameter('height') };
  const names = [refs(circle), refs(height)];
  assert.deepEqual(names, [['cx','cy','diameter','offset'], ['height']]);
  const values = { cx: 0, cy: -3, offset: 0, diameter: 8, height: 6 };
  const document = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: values, nodes: [circle, height], outputs: { post: { node: 1, side: 'solid' } } };
  const graph = key(document);
  assert.equal(prefix(true, graph, graph, { ...values }, values, names), 2);
  assert.equal(prefix(true, graph, graph, { ...values, height: 9 }, values, names), 1);
  for (const edits of [{ cx: -0 }, { offset: -0 }, { diameter: 4 }, { cy: -2 }]) assert.equal(prefix(true, graph, graph, { ...values, ...edits }, values, names), 0);
  assert.notEqual(key({ ...document, nodes: [{ ...circle, center: [-0, -3] }, height] }), key({ ...document, nodes: [{ ...circle, center: [0, -3] }, height] }));
  assert.notEqual(key({ ...document, nodes: [{ ...circle, profile: 'rectangle' }, height] }), graph);
  assert.equal(prefix(false, graph, graph, values, values, names), 0);
});

test('union-slot graph keeps complete dependencies and only reuses the unchanged prefix', () => {
  const p = parameter => ({ parameter });
  const nodes = [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 8] }, { kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'sketch', profile: 'rectangle', min: [p('x'), 0], max: [p('legWidth'), 24] }, { kind: 'extrude', sketch: 2, height: 8 },
    { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } },
    { kind: 'sketch', profile: 'rectangle', min: [16, 2], max: [{ op: 'add', left: 16, right: p('slotWidth') }, 6] },
    { kind: 'extrude', sketch: 5, height: 8 }, { kind: 'difference', parent: { node: 4, side: 'solid' }, tool: { node: 6, side: 'solid' } }];
  const values = { x: -0, legWidth: 8, slotWidth: 8 }, names = nodes.map(refs);
  assert.deepEqual(names, [[], [], ['legWidth', 'x'], [], [], ['slotWidth'], [], []]);
  const doc = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: values, nodes, outputs: { slotted: { node: 7, side: 'solid' } } }, k = key(doc);
  assert.equal(prefix(true, k, k, { ...values }, values, names), 8);
  assert.equal(prefix(true, k, k, { ...values, slotWidth: 12 }, values, names), 5);
  assert.equal(prefix(true, k, k, { ...values, legWidth: 12 }, values, names), 2);
  assert.equal(prefix(true, k, k, { ...values, x: 0 }, values, names), 2);
  const changed = structuredClone(doc); changed.nodes[7].parent.node = 1; assert.notEqual(key(changed), k);
  assert.equal(prefix(false, k, k, values, values, names), 0);
});

test('offset extrusion binds optional intent, nested start dimensions and exact signed-zero parameters', () => {
  const p = parameter => ({ parameter });
  const sketch = { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [32,24] };
  const omitted = { kind: 'extrude', sketch: 0, height: p('height') };
  const offset = { ...omitted, from: { op: 'add', left: p('thickness'), right: { op: 'scale', value: p('depth'), factor: -1 } } };
  assert.deepEqual(refs(offset), ['depth','height','thickness']);
  const values = { height: 4, thickness: 8, depth: 4, start: 0 };
  const document = nodes => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: values, nodes, outputs: { tool: { node: 1, side: 'solid' } } });
  const doc = document([sketch, offset]), k = key(doc), names = doc.nodes.map(refs);
  assert.equal(prefix(true, k, k, { ...values }, values, names), 2);
  assert.equal(prefix(true, k, k, { ...values, depth: 6 }, values, names), 1);
  assert.equal(prefix(true, k, k, { ...values, thickness: 10 }, values, names), 1);
  assert.notEqual(key(document([sketch, omitted])), key(document([sketch, { ...omitted, from: 0 }])));
  assert.notEqual(key(document([sketch, { ...omitted, from: 0 }])), key(document([sketch, { ...omitted, from: -0 }])));
  const parameterNode = { ...omitted, from: p('start') }, parameterDoc = document([sketch, parameterNode]), pk = key(parameterDoc);
  assert.equal(prefix(true, pk, pk, { ...values, start: -0 }, values, parameterDoc.nodes.map(refs)), 1);
  assert.equal(prefix(false, pk, pk, values, values, parameterDoc.nodes.map(refs)), 0);
});
