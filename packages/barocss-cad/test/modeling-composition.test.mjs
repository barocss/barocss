import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { bracketSlot, authoredDocument, signedData } from './modeling-composition-fixture.mjs';
const { cad, CadModelError, CadModelLimits } = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
const refuses = (action, codes = ['INPUT', 'CAPABILITY', 'BUDGET', 'PARAMETER', 'OWNERSHIP', 'FORMAT']) => assert.throws(action, error => {
  assert.ok(error instanceof CadModelError); assert.ok(codes.includes(error.code), error.message); assert.notEqual(error.code, 'NATIVE'); return true;
});
function prefix() {
  const model = cad.model(), base = model.sketch.rectangle({ width: 32, height: 8 }).extrude(8);
  const leg = model.sketch.rectangle({ min: [-0, 0], max: [8, 24] }).extrude(8), bracket = base.union(leg);
  return { model, base, leg, bracket };
}
test('union slot expands only its exact prefix; rejected additions preserve the remaining authored budget', () => {
  const { model, base, leg, bracket } = prefix();
  refuses(() => bracket.cut(base)); refuses(() => bracket.cut(leg)); refuses(() => bracket.cut({ ...base }));
  refuses(() => model.sketch.circle({ center: [0, 0], radius: 1 }));
  refuses(() => model.sketch.polygon([[0, 0], [1, 0], [0, 1]]));
  const foreign = cad.model().sketch.rectangle({ width: 1, height: 1 }).extrude(1);
  refuses(() => bracket.cut(foreign));
  const sketch = model.sketch.rectangle({ min: [16, 2], max: [24, 6] });
  const foreignDimension = cad.model().parameter('height', 8);
  refuses(() => sketch.extrude(foreignDimension));
  const tool = sketch.extrude(8);
  for (const options of [undefined, {}, { axis: 'x' }, { axis: 'z' }]) refuses(() => bracket.cut(tool, options));
  refuses(() => tool.cut(bracket)); refuses(() => base.cut(tool)); refuses(() => bracket.union(tool));
  const result = bracket.cut(tool); assert.ok(Object.isFrozen(result));
  refuses(() => result.cut(tool)); refuses(() => result.union(base)); refuses(() => result.split({ axis: 'x', at: 1 }));
  refuses(() => result.edges({}).one()); refuses(() => model.build({ result: { ...result } }));
  assert.equal(CadModelLimits.nodes, 6); assert.equal(CadModelLimits.sketches, 2); assert.equal(CadModelLimits.extrusions, 2);
  assert.equal(CadModelLimits.compositionNodes, 8); assert.equal(CadModelLimits.compositionSketches, 3); assert.equal(CadModelLimits.compositionExtrusions, 3);
});
test('third box is unavailable before a qualifying union and partial expansion never evaluates', () => {
  const m = cad.model(), a = m.sketch.rectangle({ width: 32, height: 8 }).extrude(8), b = m.sketch.rectangle({ width: 8, height: 24 }).extrude(8);
  refuses(() => m.sketch.rectangle({ width: 1, height: 1 }));
  const union = a.union(b); const extra = m.sketch.rectangle({ width: 1, height: 1 });
  refuses(() => m.build({ union })); extra.extrude(8); refuses(() => m.build({ union }));
});
test('composed codec accepts only exact fields, direct ownership and full canonical chain before native work', () => {
  const check = edit => { const d = authoredDocument(); edit(d); refuses(() => cad.load(signedData(d))); };
  // Complete valid graph reaches the deliberately invalid output side, proving pre-native admission.
  check(d => { d.outputs.slotted.side = 'negative'; });
  for (const kind of ['union', 'intersect', 'split', 'hole', 'chamfer', 'cut']) check(d => { d.nodes[7].kind = kind; });
  for (const index of [0, 1, 3, 6, 7, 8, -1, -0]) check(d => { d.nodes[7].parent.node = index; });
  for (const index of [0, 1, 3, 4, 5, 7, 8, -1, -0]) check(d => { d.nodes[7].tool.node = index; });
  for (const field of ['parent', 'tool']) {
    check(d => { delete d.nodes[7][field]; }); check(d => { d.nodes[7][field].side = 'negative'; });
  }
  for (const field of ['axis', 'native', 'composition', 'cache']) check(d => { d.nodes[7][field] = 'forged'; });
  for (const count of [5, 6, 7]) check(d => { d.nodes.length = count; });
  check(d => { d.nodes.push(d.nodes[7]); });
  check(d => { [d.nodes[4].left, d.nodes[4].right] = [d.nodes[4].right, d.nodes[4].left]; });
  check(d => { d.nodes[6].sketch = 0; });
  check(d => { d.nodes[5] = { kind: 'sketch', profile: 'circle', center: [16, 2], radius: 2 }; });
  check(d => { d.nodes[2] = { kind: 'sketch', profile: 'polygon', points: [[0, 0], [8, 0], [0, 24]] }; });
  for (const field of ['legWidth', 'slotX', 'slotY', 'slotWidth', 'slotSpanY']) check(d => { d.parameters[field] += .5; });
  check(d => { d.nodes[5].max[0].right.parameter = 'missing'; });
  check(d => { d.outputs.slotted.node = 8; }); check(d => { d.units = 'cm'; });
});
test('existing direct difference and union recipes keep their six-node envelope and old node grammar', () => {
  const { model, base, leg, bracket } = prefix();
  refuses(() => bracket.cut(base)); refuses(() => model.build({ bad: { ...leg } }));
  const d = authoredDocument(); d.nodes.length = 5; d.outputs = { bracket: { node: 4, side: 'negative' } };
  refuses(() => cad.load(signedData(d)), ['INPUT']);
  assert.ok(bracketSlot(cad).slotted); // Authored handles only: no build, native query or mesh.
});
