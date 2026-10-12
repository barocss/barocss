import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { cad, CadModelError, CadModelLimits } = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
if (process.env.CAD_MODEL_TEST_MODULE) assert.ok(process.env.CAD_MODEL_REGENERATION_HELPER_MODULE);
const { modelingGraphKey: key, modelingNodeParameters: refs, modelingReusablePrefix: prefix } = await import(process.env.CAD_MODEL_REGENERATION_HELPER_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_REGENERATION_HELPER_MODULE)).href : '../dist/modeling-regeneration-internal.js');
const refuses = (fn, code, operation) => assert.throws(fn, e => e instanceof CadModelError && e.code === code && (!operation || e.operation === operation));
const blank = m => m.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
const bevel = (s, y) => s.chamfer(s.edges({ parallelTo: 'x', at: { y, z: 'max' } }).one(), 2);

test('miter options are exclusive and refused options/ownership never consume the split slot', () => {
  for (const count of [0,1,2]) {
    const m = cad.model(), at = m.parameter('at', 24); let part = blank(m);
    for (let i = 0; i < count; i++) part = bevel(part, i * 24);
    for (const options of [{ at }, { axis: 'x', plane: 'x+y', at }, { plane: 'x+y', at, extra: true }, { plane: 'x+y' }]) refuses(() => part.split(options), 'INPUT');
    for (const plane of ['x-y', 'y+z', 'x+y=24', {}, null]) refuses(() => part.split({ plane, at }), 'CAPABILITY');
    let calls = 0;
    refuses(() => part.split({ get plane() { calls++; return 'x+y'; }, at }), 'INPUT');
    refuses(() => part.split({ plane: 'x+y', get at() { calls++; return 24; } }), 'INPUT');
    assert.equal(calls, 0);
    refuses(() => part.split({ plane: 'x+y', at: Infinity }), 'PARAMETER');
    for (const dimension of [cad.model().parameter('at',24), { ...at }, { parameter: 'at' }, { ...m.dimension.add(at, 0) }]) refuses(() => part.split({ plane: 'x+y', at: dimension }), 'OWNERSHIP');
    const parts = part.split({ plane: 'x+y', at: m.dimension.add(m.dimension.scale(at, 1), -0) });
    assert.ok(Object.isFrozen(parts) && Object.isFrozen(parts.negative) && Object.isFrozen(parts.positive));
    refuses(() => m.build({ negative: { ...parts.negative } }), 'OWNERSHIP');
    refuses(() => cad.model().build({ negative: parts.negative }), 'OWNERSHIP');
    refuses(() => parts.negative.chamfer(parts.positive.edges({}).one(), 1), 'OWNERSHIP');
    refuses(() => parts.negative.chamfer(part.edges({}).one(), 1), 'OWNERSHIP');
    refuses(() => parts.positive.split({ plane: 'x+y', at: 8 }), 'CAPABILITY');
    refuses(() => part.split({ axis: 'x', at: 8 }), 'CAPABILITY');
    refuses(() => part.split({ plane: 'x+y', at: 8 }), 'CAPABILITY');
  }
  assert.equal(CadModelLimits.nodes, 6); assert.equal(CadModelLimits.splits, 1); assert.equal(CadModelLimits.chamfers, 2);
});

test('miter keeps direct-root ancestry and global Boolean ownership limits before native work', () => {
  for (const kind of ['cut','intersect']) {
    const m = cad.model(), a = blank(m), b = blank(m);
    const result = kind === 'cut' ? a.cut(b, { axis: 'x' }).positive : a.intersect(b);
    refuses(() => result.split({ plane: 'x+y', at: 24 }), 'CAPABILITY');
    refuses(() => bevel(result, 0).split({ plane: 'x+y', at: 24 }), 'CAPABILITY');
  }
  for (const kind of ['cut','intersect']) {
    const m = cad.model(), a = blank(m), b = blank(m); a.split({ plane: 'x+y', at: 24 });
    refuses(() => kind === 'cut' ? a.cut(b, { axis: 'x' }) : a.intersect(b), 'CAPABILITY');
  }
  const m = cad.model(), halves = blank(m).split({ axis: 'x', at: 16 });
  refuses(() => bevel(halves.negative, 0).split({ plane: 'x+y', at: 24 }), 'CAPABILITY');
});

const document = () => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { at: 24 }, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [32,24] }, { kind: 'extrude', sketch: 0, height: 8 },
  { kind: 'split', parent: { node: 1, side: 'solid' }, plane: 'x+y', at: { parameter: 'at' } },
], outputs: { negative: { node: 2, side: 'solid' } } });

test('miter codec is exact and legacy cardinal admission remains intact without evaluating geometry', () => {
  const check = (edit, code, operation) => { const d = document(); edit(d); refuses(() => cad.load(JSON.stringify(d)), code, operation); };
  check(() => {}, 'INPUT', 'body'); // Valid new node reaches deliberately invalid output side.
  check(d => { delete d.nodes[2].plane; d.nodes[2].axis = 'z'; }, 'INPUT', 'body');
  check(d => { d.nodes[2].axis = 'x'; }, 'INPUT', 'split');
  check(d => { delete d.nodes[2].plane; }, 'INPUT', 'split');
  check(d => { delete d.nodes[2].at; }, 'INPUT', 'split');
  check(d => { d.nodes[2].extra = true; }, 'INPUT', 'split');
  check(d => { d.nodes[2].plane = 'y+z'; }, 'CAPABILITY');
  check(d => { d.nodes[2].parent.node = 2; }, 'INPUT');
  check(d => { d.nodes[2].parent.node = 3; }, 'INPUT');
  check(d => { d.nodes[2].parent.side = 'negative'; }, 'INPUT');
  check(d => { d.nodes[2].at.parameter = 'missing'; }, 'PARAMETER');
  check(d => { d.nodes.push({ ...d.nodes[2] }); }, 'CAPABILITY');
  check(d => { d.nodes.push({ ...d.nodes[2], parent: { node: 2, side: 'negative' } }); }, 'CAPABILITY');
  check(d => { d.nodes[2].at = { op: 'add', left: 24, right: { parameter: 'missing' } }; }, 'PARAMETER');
  refuses(() => cad.load(JSON.stringify(document()).replace('"plane":"x+y"', '"plane":"x+y","plane":"x+y"')), 'FORMAT');
  for (const kind of ['cut','intersect']) check(d => {
    d.nodes[2] = { kind: 'extrude', sketch: 0, height: 8 };
    d.nodes.push(kind === 'cut' ? { kind, parent: { node: 1, side: 'solid' }, tool: { node: 2, side: 'solid' }, axis: 'x' } : { kind, left: { node: 1, side: 'solid' }, right: { node: 2, side: 'solid' } });
    d.nodes.push({ kind: 'split', parent: { node: 3, side: kind === 'cut' ? 'positive' : 'solid' }, plane: 'x+y', at: 24 });
    d.outputs.negative.node = 4;
  }, 'CAPABILITY');
});

test('unchanged regeneration helpers key plane intent and all nested miter dimensions with signed zero', () => {
  const d = document(), p = parameter => ({ parameter });
  d.parameters = { width: 32, offset: 0 };
  d.nodes[2].at = { op: 'add', left: { op: 'scale', value: p('width'), factor: .5 }, right: p('offset') };
  assert.deepEqual(refs(d.nodes[2]), ['offset','width']);
  const before = key(d), cardinal = structuredClone(d); delete cardinal.nodes[2].plane; cardinal.nodes[2].axis = 'x';
  assert.notEqual(key(cardinal), before);
  const changed = structuredClone(d); changed.nodes[2].at.right = -0;
  const positiveZero = structuredClone(changed); positiveZero.nodes[2].at.right = 0;
  assert.notEqual(key(changed), key(positiveZero));
  const names = [[],[],refs(d.nodes[2])];
  assert.equal(prefix(true, before, before, { width: 32, offset: -0 }, d.parameters, names), 2);
  assert.equal(prefix(true, before, before, { width: 32, offset: 0 }, d.parameters, names), 3);
  assert.equal(prefix(true, key(cardinal), before, d.parameters, d.parameters, names), 0);
});
