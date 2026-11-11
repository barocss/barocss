import assert from 'node:assert/strict';
import test from 'node:test';
import { part } from '../src/api';
import { runTool, type ChatState } from '../src/chat/tools';
import { rectanglePart, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { addParameters, removeParameter, renameParameter } from '../src/engine/parameters';
import { bindSketchLengthNode } from '../src/sketch/driven';

function source(): StudioDoc {
  const doc = addParameters(rectanglePart(40, 20, 10), { B: 40, A: 10 });
  const sketch = doc.nodes[0];
  assert.ok(sketch.kind === 'sketch' && sketch.profile === 'rectangle');
  return { ...doc, nodes: [{ ...sketch, max: [{ parameter: 'B' }, 20] }, ...doc.nodes.slice(1)] };
}
function widthBinding(doc: StudioDoc) {
  const sketch = doc.nodes[0];
  assert.ok(sketch.kind === 'sketch' && sketch.profile === 'rectangle');
  return sketch.max;
}
const withoutA = (configurations: NonNullable<StudioDoc['configurations']>) => removeParameter({ ...source(), configurations }, 'A');
const expected = { message: /^\[PARAMETER_EXISTS\].*configuration .*parameter A$/ };

test('rename refuses retained target keys independent of key order, presence and value equality', () => {
  const cases: NonNullable<StudioDoc['configurations']>[] = [
    { Production: { B: 40, A: 10 } },
    { Production: { A: 10, B: 40 } },
    { Legacy: { A: 10 }, Production: { B: 45 } },
    { Production: { B: 45 }, Legacy: { A: 10 } },
    { Equal: { B: 40, A: 40 } },
    { First: { A: 10 }, Second: { B: 45, A: 12 } },
  ];
  for (const configuration of cases) {
    const doc = withoutA(configuration), before = structuredClone(doc);
    assert.throws(() => renameParameter(doc, 'B', 'A'), expected);
    assert.deepEqual(doc, before);
    assert.equal(renameParameter(doc, 'B', 'B'), doc);
    assert.deepEqual(doc.parameters, { B: 40 });
    assert.deepEqual(widthBinding(doc), [{ parameter: 'B' }, 20]);
  }
  const active = source();
  assert.throws(() => renameParameter(active, 'B', 'A'), { message: '[PARAMETER_EXISTS] there is a parameter A already' });
});

test('ordinary rename retains configuration order, absent overrides, binding and physical Apply', () => {
  const doc = withoutA({ Production: { B: 48, A: 10 }, Legacy: { A: 12 }, Workshop: { B: 32 } });
  const original = structuredClone(doc);
  const renamed = renameParameter(doc, 'B', 'Width');
  assert.deepEqual(renamed.parameters, { Width: 40 });
  assert.deepEqual(Object.keys(renamed.configurations!), ['Production', 'Legacy', 'Workshop']);
  assert.deepEqual(renamed.configurations, { Production: { Width: 48, A: 10 }, Legacy: { A: 12 }, Workshop: { Width: 32 } });
  assert.deepEqual(widthBinding(renamed), [{ parameter: 'Width' }, 20]);
  for (const [name, width] of [['Production', 48], ['Legacy', 40], ['Workshop', 32]] as const) {
    const configured = part('Width test', renamed).withConfiguration(name).doc;
    assert.deepEqual(configured.parameters, { Width: width });
    const result = evaluateDoc(configured, 1);
    assert.ok(result.ok);
    assert.ok(Math.abs((result.bodies[0].volume ?? 0) - width * 20 * 10) < 1e-7);
  }
  assert.deepEqual(doc, original);
});

test('a configuration collision keeps a driven sketch and an agent batch atomic', async () => {
  const doc = withoutA({ Production: { B: 48, A: 10 } });
  const sketch: ModelNode = {
    kind: 'sketch', id: 'n0', profile: 'loop', segments: [
      { kind: 'line', start: [0, 0] }, { kind: 'line', start: [40, 0] },
      { kind: 'line', start: [40, 20] }, { kind: 'line', start: [0, 20] },
    ], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] },
    outline: { points: [[0, 0], [40, 0], [40, 20], [0, 20]], bulges: [0, 0, 0, 0],
      lengths: { 0: 40 }, hv: { h: [0, 2], v: [1, 3] } },
  };
  doc.nodes[0] = bindSketchLengthNode(sketch, 'e1', 'B', doc.parameters);
  const original = structuredClone(doc);
  assert.throws(() => renameParameter(doc, 'B', 'A'), expected);
  const state: ChatState = { doc, bodies: [] }, was = process.env.CAD_AUTONOMY;
  process.env.CAD_AUTONOMY = '3';
  try {
    const result = await runTool(state, 'set_parameters', { set: { B: 50 }, rename: { B: 'A' } },
      async () => { throw new Error('A refused batch must not evaluate'); });
    assert.ok(result.isError);
    assert.match(JSON.parse(result.content).error, expected.message);
    assert.equal(result.state, state);
    assert.deepEqual(doc, original);
  } finally {
    if (was === undefined) delete process.env.CAD_AUTONOMY;
    else process.env.CAD_AUTONOMY = was;
  }
});
