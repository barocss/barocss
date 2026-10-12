import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { cad, CadModelError, CadModelLimits } = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
const refuses = (fn, code) => assert.throws(fn, e => e instanceof CadModelError && e.code === code);
const rectangle = model => model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);

test('two-step chamfer requires the exact first-result selector and refuses sibling/third steps atomically', () => {
  const model = cad.model(), blank = rectangle(model), foreign = rectangle(cad.model());
  const originalEdge = blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one();
  const first = blank.chamfer(originalEdge, 1);
  refuses(() => first.chamfer(originalEdge, 2), 'OWNERSHIP');
  refuses(() => first.chamfer({ ...originalEdge }, 2), 'OWNERSHIP');
  refuses(() => first.chamfer(foreign.edges({}).one(), 2), 'OWNERSHIP');
  refuses(() => first.chamfer({ kind: 'edge-selection' }, 2), 'OWNERSHIP');
  const secondEdge = first.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one();
  refuses(() => first.chamfer(secondEdge, Infinity), 'PARAMETER');
  refuses(() => first.chamfer(secondEdge, cad.model().parameter('d', 2)), 'OWNERSHIP');
  refuses(() => blank.chamfer(originalEdge, 2), 'CAPABILITY');
  const second = first.chamfer(secondEdge, 2); assert.ok(Object.isFrozen(second));
  refuses(() => second.chamfer(second.edges({}).one(), 1), 'CAPABILITY');
  refuses(() => first.chamfer(secondEdge, 1), 'CAPABILITY');
  assert.equal(CadModelLimits.chamfers, 2); assert.equal(CadModelLimits.nodes, 6);
  const full = cad.model(), parent = rectangle(full), tool = rectangle(full);
  const a = parent.chamfer(parent.edges({}).one(), 1), b = a.chamfer(a.edges({}).one(), 1); assert.ok(b);
  refuses(() => parent.cut(tool, { axis: 'x' }), 'CAPABILITY');
});

test('chamfer chain codec admits legacy/serial graphs but refuses siblings, third steps and malformed references before native work', () => {
  const chamfer = parent => ({ kind: 'chamfer', parent: { node: parent, side: 'solid' }, edge: { parallelTo: 'x', at: { y: 24, z: 'max' } }, distance: 1 });
  const document = () => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [32,24] }, { kind: 'extrude', sketch: 0, height: 8 }, chamfer(1), chamfer(2),
  ], outputs: { part: { node: 3, side: 'negative' } } });
  const check = (edit, code) => { const d = document(); edit(d); refuses(() => cad.load(JSON.stringify(d)), code); };
  check(() => {}, 'INPUT'); // Both valid chain nodes pass; the deliberately wrong output side is refused.
  check(d => { d.nodes.pop(); d.outputs.part.node = 2; }, 'INPUT'); // Legacy one-chamfer graph remains admitted.
  check(d => { d.nodes[3].parent.node = 1; }, 'CAPABILITY');
  check(d => { d.nodes.push(chamfer(3)); }, 'CAPABILITY');
  check(d => { d.nodes[3].parent.node = 3; }, 'INPUT');
  check(d => { d.nodes[3].parent.node = 4; }, 'INPUT');
  check(d => { d.nodes[3].parent.side = 'positive'; }, 'INPUT');
  check(d => { d.nodes[3].extra = true; }, 'INPUT');
  check(d => { d.nodes[3].distance = { parameter: 'missing' }; }, 'PARAMETER');
  check(d => { d.nodes.push(chamfer(3), chamfer(4), chamfer(5)); }, 'BUDGET');
});
