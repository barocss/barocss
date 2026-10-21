import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { editFields, type BindableField } from '../src/app/editFields';
import { evaluateDoc } from '../src/engine/evaluate';

test('parameters: a feature value bound to a parameter reads its value; the part follows the parameter', () => {
  let doc: StudioDoc = { ...rectanglePart(32, 20, 8), parameters: { H: 15, W: 40 } };
  doc = withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 3 });
  const height = editFields(doc.nodes, 1, doc.parameters).find(f => f.key === 'h') as BindableField;
  assert.ok(height && height.bind, 'the height field binds');
  const bound = height.bind(doc.nodes, 'H')!;
  assert.deepEqual((bound[1] as { height: unknown }).height, { parameter: 'H' });
  assert.equal(height.get(bound), 15); assert.equal(height.param(bound), 'H');
  // The width of the sketch (its far corner) takes W; the hole's diameter (stored as a radius) cannot.
  const width = editFields(bound, 1, doc.parameters).find(f => f.label.endsWith('Width')) as BindableField;
  const both = width.bind(bound, 'W')!;
  assert.ok(both, 'width binds');
  const dia = editFields(both, 2, doc.parameters).find(f => f.key === 'dia') as BindableField;
  assert.equal(dia.bind(both, 'H'), null);
  // Typing a number unbinds.
  assert.equal(height.param(height.set(both, 9)), null);
  // The kernel evaluates with the parameters; a new value changes the part.
  const at = (p: Record<string, number>) => { const r = evaluateDoc({ ...doc, nodes: both, parameters: p }, 1); assert.ok(r.ok); return r.bodies[0].mesh.bounds.max; };
  assert.deepEqual(at({ H: 15, W: 40 }).slice(0, 3).map(Math.round), [40, 20, 15]);
  assert.deepEqual(at({ H: 6, W: 30 }).slice(0, 3).map(Math.round), [30, 20, 6]);
});
