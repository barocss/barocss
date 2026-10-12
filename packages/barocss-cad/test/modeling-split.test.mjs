import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { cad, CadModelError, CadModelLimits } = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
const refuses = (fn, code) => assert.throws(fn, error => error instanceof CadModelError && error.code === code);
const fixture = () => { const model = cad.model(); return { model, blank: model.sketch.rectangle({ width: 16, height: 8 }).extrude(8) }; };

test('horizontal split ownership and capability checks happen before append', () => {
  const { model, blank } = fixture(), foreign = cad.model().parameter('level', 2);
  refuses(() => blank.split({ axis: 'x', at: 2 }), 'CAPABILITY');
  refuses(() => blank.split({ axis: 'z', at: foreign }), 'OWNERSHIP');
  refuses(() => blank.split({ axis: 'z', at: { name: 'level' } }), 'OWNERSHIP');
  refuses(() => blank.split({ axis: 'z', at: Infinity }), 'PARAMETER');
  refuses(() => blank.split({ axis: 'z', at: 2, extra: true }), 'INPUT');
  let calls = 0; refuses(() => blank.split({ axis: 'z', get at() { calls++; return 2; } }), 'INPUT'); assert.equal(calls, 0);
  const halves = blank.split({ axis: 'z', at: model.parameter('level', 2) });
  assert.ok(Object.isFrozen(halves) && Object.isFrozen(halves.negative));
  refuses(() => blank.split({ axis: 'z', at: 4 }), 'CAPABILITY');
  refuses(() => halves.positive.split({ axis: 'z', at: 4 }), 'CAPABILITY');
  const tool = model.sketch.rectangle({ width: 8, height: 8 }).extrude(8);
  refuses(() => blank.cut(tool, { axis: 'x' }), 'CAPABILITY');
  refuses(() => blank.intersect(tool), 'CAPABILITY');
  refuses(() => halves.negative.chamfer(blank.edges({}).one(), 1), 'OWNERSHIP');
  assert.ok(halves.negative.chamfer(halves.negative.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), 1));
  for (const kind of ['cut', 'intersect']) {
    const f = fixture(), t = f.model.sketch.rectangle({ width: 8, height: 8 }).extrude(8);
    if (kind === 'cut') f.blank.cut(t, { axis: 'x' }); else f.blank.intersect(t);
    refuses(() => f.blank.split({ axis: 'z', at: 2 }), 'CAPABILITY');
  }
  assert.equal(CadModelLimits.splits, 1); assert.equal(CadModelLimits.nodes, 6);
});
const document = () => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { level: 2 }, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [16, 8] },
  { kind: 'extrude', sketch: 0, height: 8 },
  { kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'z', at: { parameter: 'level' } },
], outputs: { lower: { node: 2, side: 'negative' }, upper: { node: 2, side: 'positive' } } });
test('split file schema rejects malformed, unsupported and mixed graphs before geometry', () => {
  const check = (edit, code) => { const d = document(); edit(d); refuses(() => cad.load(JSON.stringify(d)), code); };
  check(d => { d.nodes[2].axis = 'x'; }, 'CAPABILITY');
  check(d => { d.nodes[2].other = true; }, 'INPUT');
  check(d => { delete d.nodes[2].at; }, 'INPUT');
  check(d => { d.nodes[2].parent.node = 2; }, 'INPUT');
  check(d => { d.nodes[2].parent.side = 'negative'; }, 'INPUT');
  check(d => { d.outputs.lower.side = 'solid'; }, 'INPUT');
  check(d => { d.nodes[2].at.parameter = 'unknown'; }, 'PARAMETER');
  check(d => { d.nodes.push({ ...d.nodes[2] }); }, 'CAPABILITY');
  check(d => { d.nodes.push({ ...d.nodes[2], parent: { node: 2, side: 'positive' } }); }, 'CAPABILITY');
  for (const kind of ['cut', 'intersect']) check(d => {
    d.nodes.push({ kind: 'extrude', sketch: 0, height: 4 });
    d.nodes.push(kind === 'cut' ? { kind, parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' }, axis: 'x' } : { kind, left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  }, 'CAPABILITY');
});
