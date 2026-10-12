import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const api = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
const { cad, CadModelError, CadModelLimits } = api;
const refuses = (fn, code, message) => assert.throws(fn, e => e instanceof CadModelError && e.code === code && (!message || e.message.includes(message)));

test('add/scale dimensions are frozen same-model handles and invalid arithmetic consumes no features', () => {
  const model = cad.model(), width = model.parameter('width', 32), offset = model.parameter('offset', 0);
  const half = model.dimension.scale(width, .5), at = model.dimension.add(half, offset);
  assert.ok(Object.isFrozen(model.dimension) && Object.isFrozen(half) && Object.isFrozen(at));
  assert.equal(api.resolveModelDimension, undefined); assert.equal(api.ModelDimensionError, undefined);
  const foreign = cad.model(), p = foreign.parameter('width', 32), expression = foreign.dimension.scale(p, .5);
  for (const bad of [p, expression, { ...width }, { ...half }, { kind: 'dimension-expression' }, { op: 'scale', value: 32, factor: .5 }]) {
    refuses(() => model.dimension.add(bad, offset), 'OWNERSHIP');
    refuses(() => model.dimension.scale(bad, .5), 'OWNERSHIP');
  }
  for (const factor of [Infinity, NaN, '2', width, null]) refuses(() => model.dimension.scale(width, factor), 'PARAMETER');
  refuses(() => model.dimension.scale(width, Number.MAX_VALUE), 'PARAMETER');
  refuses(() => model.dimension.add(10000, 1), 'PARAMETER');
  assert.ok(model.dimension.scale(0, Number.MAX_VALUE));
  assert.ok(model.dimension.scale(width, -1));
  const blank = model.sketch.rectangle({ width, height: 24 }).extrude(8), parts = blank.split({ axis: 'x', at });
  refuses(() => model.build({ negative: { ...parts.negative } }), 'OWNERSHIP'); // No native work.
  assert.equal(CadModelLimits.nodes, 6); assert.equal(CadModelLimits.dimensionNodes, 32); assert.equal(CadModelLimits.dimensionDepth, 6);
});

test('expression tree limits count repeated owned subtrees by occurrence', () => {
  const model = cad.model(); let depth = 1;
  for (let i = 0; i < 5; i++) depth = model.dimension.scale(depth, 1);
  refuses(() => model.dimension.scale(depth, 1), 'BUDGET');
  let tree = 1; for (let i = 0; i < 4; i++) tree = model.dimension.add(tree, tree); // 31 occurrences, depth5.
  assert.ok(model.dimension.scale(tree, 1)); // Exactly32 occurrences, depth6.
  refuses(() => model.dimension.add(tree, tree), 'BUDGET'); // Shared physical handle still means63 occurrences.
  assert.ok(model.dimension.add(1, 2));
});

const add = (left, right) => ({ op: 'add', left, right }), scale = (value, factor) => ({ op: 'scale', value, factor });
const document = (slot, value) => {
  const d = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { width: 32, offset: 0 }, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [32,24] }, { kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'chamfer', parent: { node: 1, side: 'solid' }, distance: 1, edge: { parallelTo: 'x', at: { y: 777, z: 'max' } } },
  ], outputs: { part: { node: 2, side: 'negative' } } };
  if (slot === 'polygon') d.nodes[0] = { kind: 'sketch', profile: 'polygon', points: [[value,0],[32,0],[0,24]] };
  if (slot === 'rectangle') d.nodes[0].max[0] = value;
  if (slot === 'extrude') d.nodes[1].height = value;
  if (slot === 'distance') d.nodes[2].distance = value;
  if (slot === 'selector') d.nodes[2].edge.at.y = value;
  if (slot === 'split') { d.nodes[2] = { kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'x', at: value }; d.outputs.part.side = 'solid'; }
  return d;
};
test('every serialized dimension slot resolves nested arithmetic before output or native selection', () => {
  for (const slot of ['polygon','rectangle','extrude','distance','selector','split']) {
    const check = (value, code, message) => refuses(() => cad.load(JSON.stringify(document(slot, value))), code, message);
    check(add(scale({ parameter: 'width' }, .5), { parameter: 'offset' }), 'INPUT', 'Body reference kind mismatch');
    check(add(scale({ parameter: 'unknown' }, .5), 1), 'PARAMETER', 'Unknown parameter');
    check(add(scale(10000, 2), -10000), 'PARAMETER', 'intermediate');
    check({ op: 'divide', value: 1, factor: 0 }, 'INPUT', 'Only add and scale');
    check({ op: 'add', left: 1, right: 2, extra: 0 }, 'INPUT', 'Exact own dimension fields');
    let deep = 1; for (let i = 0; i < 6; i++) deep = scale(deep, 1); check(deep, 'BUDGET');
  }
});
