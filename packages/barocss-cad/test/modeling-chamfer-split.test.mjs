import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { cad, CadModelError, CadModelLimits } = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
const refuses = (fn, code) => assert.throws(fn, e => e instanceof CadModelError && e.code === code);
const blank = model => model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
const bevel = (shape, y = 0) => shape.chamfer(shape.edges({ parallelTo: 'x', at: { y, z: 'max' } }).one(), 1);

test('owned chamfer split admits exact ancestry without consuming nodes for refused inputs', () => {
  for (const count of [0,1,2]) {
    const model = cad.model(); let part = blank(model);
    for (let i = 0; i < count; i++) part = bevel(part, i * 24);
    refuses(() => cad.model().build({ part }), 'OWNERSHIP');
    refuses(() => model.build({ part: { ...part } }), 'OWNERSHIP');
    refuses(() => part.split({ axis: 'x', at: cad.model().parameter('at', 16) }), 'OWNERSHIP');
    refuses(() => part.split({ axis: 'x', at: Infinity }), 'PARAMETER');
    refuses(() => part.split({ axis: 'w', at: 16 }), 'CAPABILITY');
    refuses(() => part.split({ axis: 'x', at: 16, extra: true }), 'INPUT');
    let calls = 0; refuses(() => part.split({ axis: 'x', get at() { calls++; return 16; } }), 'INPUT'); assert.equal(calls, 0);
    const sides = part.split({ axis: 'x', at: model.parameter('at', 16) });
    assert.ok(Object.isFrozen(sides) && Object.isFrozen(sides.negative) && Object.isFrozen(sides.positive));
    refuses(() => model.build({ negative: { ...sides.negative } }), 'OWNERSHIP');
    refuses(() => sides.negative.chamfer(sides.positive.edges({}).one(), 1), 'OWNERSHIP');
    refuses(() => sides.negative.chamfer({ ...sides.negative.edges({}).one() }, 1), 'OWNERSHIP');
    refuses(() => sides.positive.split({ axis: 'x', at: 8 }), 'CAPABILITY');
    refuses(() => part.split({ axis: 'x', at: 8 }), 'CAPABILITY');
    if (count) refuses(() => bevel(sides.negative), 'CAPABILITY'); // Existing chain cannot jump across split.
    if (count === 2) refuses(() => bevel(part), 'CAPABILITY');
  }
  assert.equal(CadModelLimits.nodes, 6); assert.equal(CadModelLimits.chamfers, 2); assert.equal(CadModelLimits.splits, 1);
});

test('cut/intersection-rooted chains and nested splits remain unsupported before geometry', () => {
  for (const kind of ['cut','intersect']) {
    const model = cad.model(), parent = blank(model), tool = blank(model);
    const result = kind === 'cut' ? parent.cut(tool, { axis: 'x' }).positive : parent.intersect(tool);
    refuses(() => result.split({ axis: 'x', at: 16 }), 'CAPABILITY');
    const chamfered = bevel(result);
    refuses(() => chamfered.split({ axis: 'x', at: 16 }), 'CAPABILITY');
  }
  const model = cad.model(), sides = blank(model).split({ axis: 'x', at: 16 });
  const chamfered = bevel(sides.negative);
  refuses(() => chamfered.split({ axis: 'z', at: 4 }), 'CAPABILITY');
});

test('codec admits only direct-rooted chamfer split and rejects malformed references before native work', () => {
  const chamfer = parent => ({ kind: 'chamfer', parent: { node: parent, side: 'solid' }, edge: { parallelTo: 'x', at: { y: 0, z: 'max' } }, distance: 1 });
  const document = () => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { at: 16 }, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [32,24] }, { kind: 'extrude', sketch: 0, height: 8 }, chamfer(1), chamfer(2),
    { kind: 'split', parent: { node: 3, side: 'solid' }, axis: 'x', at: { parameter: 'at' } },
  ], outputs: { negative: { node: 4, side: 'solid' } } });
  const check = (edit, code) => { const d = document(); edit(d); refuses(() => cad.load(JSON.stringify(d)), code); };
  check(() => {}, 'INPUT'); // Accepted chain reaches deliberately invalid output side.
  check(d => { d.nodes.splice(3,1); d.nodes[3].parent.node = 2; d.outputs.negative.node = 3; }, 'INPUT');
  check(d => { d.nodes[4].parent.node = 4; }, 'INPUT');
  check(d => { d.nodes[4].parent.node = 5; }, 'INPUT');
  check(d => { d.nodes[4].parent.side = 'negative'; }, 'INPUT');
  check(d => { d.nodes[4].at.parameter = 'missing'; }, 'PARAMETER');
  check(d => { d.nodes[4].extra = true; }, 'INPUT');
  check(d => { d.nodes[4].axis = 'w'; }, 'CAPABILITY');
  check(d => { d.nodes.push({ ...d.nodes[4] }); }, 'CAPABILITY');
  check(d => { d.nodes.push({ ...d.nodes[4], parent: { node: 4, side: 'negative' } }); }, 'CAPABILITY');
  check(d => { d.nodes.push(chamfer(3)); }, 'CAPABILITY');
  for (const kind of ['cut','intersect']) check(d => {
    d.nodes[2] = { kind: 'extrude', sketch: 0, height: 8 };
    d.nodes[3] = kind === 'cut' ? { kind, parent: { node: 1, side: 'solid' }, tool: { node: 2, side: 'solid' }, axis: 'x' } : { kind, left: { node: 1, side: 'solid' }, right: { node: 2, side: 'solid' } };
    d.nodes[4] = chamfer(3); if (kind === 'cut') d.nodes[4].parent.side = 'positive';
    d.nodes.push({ kind: 'split', parent: { node: 4, side: 'solid' }, axis: 'x', at: 16 });
    d.outputs.negative.node = 5;
  }, 'CAPABILITY');
});
