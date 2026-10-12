import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { cad, CadModelError, CadModelLimits } = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
const refuses = (fn, code) => assert.throws(fn, error => error instanceof CadModelError && error.code === code);
const pair = () => {
  const model = cad.model(), left = model.sketch.rectangle({ width: 16, height: 16 }).extrude(8);
  const right = model.sketch.rectangle({ min: [8, 0], max: [24, 16] }).extrude(8);
  return { model, left, right };
};

test('intersection authoring rejects foreign, copied and unsupported handles before appending', () => {
  const a = pair(), b = pair();
  refuses(() => a.left.intersect(b.right), 'OWNERSHIP');
  refuses(() => a.left.intersect({ ...a.right }), 'OWNERSHIP');
  refuses(() => a.left.intersect(a.left), 'CAPABILITY');
  const part = a.left.intersect(a.right);
  assert.ok(Object.isFrozen(part));
  refuses(() => part.chamfer(a.left.edges({}).one(), 1), 'OWNERSHIP');
  refuses(() => a.left.intersect(a.right), 'CAPABILITY');
  refuses(() => part.intersect(a.right), 'CAPABILITY');
  refuses(() => a.left.intersect(part), 'CAPABILITY');
  refuses(() => a.left.cut(a.right, { axis: 'x' }), 'CAPABILITY');
  refuses(() => part.cut(a.right, { axis: 'x' }), 'CAPABILITY');
  // A rejected addition did not consume the sixth/final node.
  const finish = part.chamfer(part.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), 1);
  assert.ok(Object.isFrozen(finish));
  refuses(() => finish.intersect(a.right), 'CAPABILITY');
  const split = b.left.cut(b.right, { axis: 'x' });
  refuses(() => b.left.intersect(b.right), 'CAPABILITY');
  refuses(() => split.negative.intersect(b.right), 'CAPABILITY');
  assert.equal(CadModelLimits.nodes, 6);
  assert.equal(CadModelLimits.intersections, 1);
});

const document = () => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [16, 16] },
  { kind: 'extrude', sketch: 0, height: 8 },
  { kind: 'sketch', profile: 'rectangle', min: [8, 0], max: [24, 16] },
  { kind: 'extrude', sketch: 2, height: 8 },
  { kind: 'intersect', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } },
], outputs: { overlap: { node: 4, side: 'solid' } } });

test('intersection codec rejects invalid references, extra fields and mixed operation graphs without native work', () => {
  const check = (edit, code) => { const value = document(); edit(value); refuses(() => cad.load(JSON.stringify(value)), code); };
  check(d => { d.nodes[4].extra = 1; }, 'INPUT');
  check(d => { delete d.nodes[4].right; }, 'INPUT');
  check(d => { d.nodes[4].left.node = 4; }, 'INPUT');
  check(d => { d.nodes[4].right.side = 'positive'; }, 'INPUT');
  check(d => { d.outputs.overlap.side = 'negative'; }, 'INPUT');
  check(d => { d.nodes[4].right.node = 1; }, 'CAPABILITY');
  check(d => { d.nodes.push({ ...d.nodes[4] }); }, 'CAPABILITY');
  check(d => { d.nodes.push({ kind: 'cut', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' }, axis: 'x' }); }, 'CAPABILITY');
  check(d => { d.nodes.push({ kind: 'intersect', left: { node: 4, side: 'solid' }, right: { node: 3, side: 'solid' } }); }, 'CAPABILITY');
  check(d => { d.nodes[4].kind = 'intersection'; }, 'CAPABILITY');
  refuses(() => cad.load(JSON.stringify(document()).replace('"left":', '"left":{},"left":')), 'FORMAT');
});
