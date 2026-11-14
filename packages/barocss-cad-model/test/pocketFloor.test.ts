import assert from 'node:assert/strict';
import test from 'node:test';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { addPart } from '../src/assembly/edit';
import { deleteFeature, duplicateBody } from '../src/chat/features';
import { emptyDoc, prefixDoc, rectanglePart, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { flattenAssembly } from '../src/engine/flatten';
import { readStudioDoc } from '../src/engine/migrate';
import { currentPocketSketch, toPartDocument } from '../src/engine/part';
import { bindPocketFloor } from '../src/engine/pocketFloor';

const ref = (node: number) => ({ node, side: 'solid' as const });
const plane = (z: number) => ({ origin: [0, 0, z] as [number, number, number], normal: [0, 0, 1] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number] });
const patch = (doc: StudioDoc, index: number, fields: Partial<ModelNode>): StudioDoc => ({
  ...doc, nodes: doc.nodes.map((node, i) => i === index ? { ...node, ...fields } as ModelNode : node),
});

function pocket(linked = true): StudioDoc {
  let doc = rectanglePart(40, 30, 10);
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [10, 9], max: [22, 21], on: ref(1), plane: plane(10) });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 4, from: -2 });
  doc = withNode(doc, { kind: 'difference', parent: ref(1), tool: ref(3) });
  const binding = bindPocketFloor(doc, ref(4), plane(8), 'n3.bottom', toPartDocument(doc).features);
  assert.deepEqual(binding, { version: 1, sourceFeature: 'n4', face: 'n3.bottom', min: [10, 9], max: [22, 21] });
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [14, 13], max: [18, 17], on: ref(4), plane: plane(8), ...(linked ? { pocketFloor: binding } : {}) });
  doc = withNode(doc, { kind: 'extrude', sketch: 5, height: 1, from: -1 });
  return withNode(doc, { kind: 'difference', parent: ref(4), tool: ref(6) });
}

function volumes(doc: StudioDoc): number[] {
  return evaluateCadPart(toPartDocument(doc)).outputs.map(body => {
    assert.ok(checkOutput(body).valid);
    return massPropertiesOf(body).volume;
  });
}
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);

test('a native pocket binding follows a source depth edit without rewriting the child or moving unmarked files', () => {
  const source = pocket(), draft = patch(source, 3, { from: -4 });
  assert.deepEqual(draft.nodes.slice(4), source.nodes.slice(4));
  assert.deepEqual(currentPocketSketch(source, 5).plane, plane(8));
  assert.deepEqual(currentPocketSketch(draft, 5).plane, plane(6));
  near(volumes(source)[0], 11696);
  near(volumes(draft)[0], 11408);
  near(volumes(patch(pocket(false), 3, { from: -4 }))[0], 11424);
  assert.deepEqual(readStudioDoc(JSON.stringify(draft)), { doc: draft, notes: [] });
});

test('the floor dependency refuses missing, changed or ambiguous ownership and lateral trim changes', () => {
  const source = pocket();
  assert.ok('error' in deleteFeature(prefixDoc(source, 6), 4));
  assert.throws(() => toPartDocument(patch(source, 3, { from: 0 })), /source floor is missing/);
  assert.throws(() => toPartDocument(patch(source, 2, { max: [23, 21] })), /moved or resized in XY/);
  assert.throws(() => toPartDocument(patch(source, 3, { height: -4 })), /saved source/);
  const malformed = patch(source, 5, { pocketFloor: { version: 1, sourceFeature: 'n4', face: 'n1.top', min: [10, 9], max: [22, 21] } });
  assert.ok('error' in readStudioDoc(JSON.stringify(malformed)));
  const nested = { ...emptyDoc(), instances: [{ id: 'p1', doc: malformed, name: 'Bad', position: [0, 0, 0], rotation: [0, 0, 0] }] };
  assert.ok('error' in readStudioDoc(JSON.stringify(nested)));
});

test('copy and assembly flattening remap the support output and native floor names together', () => {
  const moved = patch(pocket(), 3, { from: -4 });
  const copy = duplicateBody(moved, ref(7), [65, 0, 0]).doc;
  assert.equal(volumes(copy).length, 2);
  volumes(copy).forEach(v => near(v, 11408));
  const assembly = addPart(rectanglePart(10, 10, 10), { name: 'Pocket', doc: moved, position: [65, 0, 0], rotation: [0, 0, 0] }).doc;
  const flat = flattenAssembly(assembly), mass = volumes(flat).sort((a, b) => a - b);
  assert.equal(mass.length, 2);
  near(mass[0], 1000);
  near(mass[1], 11408);
});
