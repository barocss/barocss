import assert from 'node:assert/strict';
import test from 'node:test';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { deleteFeature, duplicateBody, featureDependents } from '../src/chat/features';
import { editFields } from '../src/app/editFields';
import { prefixDoc, rectanglePart, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { featureOf, toPartDocument } from '../src/engine/part';

function fixture(stockDepth = 10, through = true): StudioDoc {
  const base = rectanglePart(40, 30, 10), target = { node: 1, side: 'solid' } as const;
  const stock = base.nodes[1] as Extract<ModelNode, { kind: 'extrude' }>;
  base.nodes[1] = { ...stock, height: stockDepth, from: 10 - stockDepth };
  const sketch = withNode(base, { kind: 'sketch', profile: 'rectangle', min: [12, 10], max: [20, 18], on: target,
    plane: { origin: [0, 0, 10], xAxis: [1, 0, 0], normal: [0, 0, 1] } });
  const tool = withNode(sketch, { kind: 'extrude', sketch: 2, height: 11, from: -11, ...(through ? { cutDepth: 'through' } : {}) });
  return withNode(tool, { kind: 'difference', parent: target, tool: { node: 3, side: 'solid' } });
}

const nativeTool = (doc: StudioDoc) => toPartDocument(doc).features.find(feature => feature.id === doc.nodes[3].id);

test('Through all evaluates the current depth without rewriting its snapshot or unmarked files', () => {
  for (const [depth, expectedMM3, toolDepth] of [[10, 11360, 11], [14, 15904, 15]]) {
    const source = fixture(depth), saved = structuredClone(source);
    const { features } = toPartDocument(source), [body] = evaluateCadPart(toPartDocument(source)).outputs;
    assert.ok(checkOutput(body).valid);
    assert.ok(Math.abs(massPropertiesOf(body).volume - expectedMM3) < 1e-7);
    assert.deepEqual(features[3], { id: 'n3', kind: 'extrude', sketch: 'n2', height: toolDepth, from: -toolDepth });
    assert.ok(body.brep.faces.some(face => {
      const g = faceGeometry(face);
      return g.kind === 'plane' && g.n[2] < 0 && Math.abs(g.o[2] - (10 - depth)) < 1e-7 && face.loops.length === 2;
    }));
    assert.deepEqual(source, saved);
    const fields = editFields(source.nodes, 3).map(field => field.key);
    assert.ok(!fields.includes('h') && !fields.includes('from'));
    const rollback = prefixDoc(source, 4);
    assert.deepEqual(nativeTool(rollback), features[3]);
    assert.deepEqual(readStudioDoc(JSON.stringify(source)), { doc: source, notes: [] });
  }
  const legacy = fixture(14, false), [retained] = evaluateCadPart(toPartDocument(legacy)).outputs;
  assert.equal((nativeTool(legacy) as { height: number }).height, 11);
  assert.ok(Math.abs(massPropertiesOf(retained).volume - 16096) < 1e-7);
});

test('Through all admission refuses malformed marker, stale target and wrong cut direction', () => {
  const source = fixture(14);
  for (const [index, patch] of [
    [3, { cutDepth: 'distance' }], [3, { from: -2 }], [3, { draft: 5 }],
    [3, { sketch: 4 }], [2, { on: { node: 3, side: 'solid' } }], [2, { plane: null }],
    [4, { parent: { node: 0, side: 'solid' } }],
  ] as const) {
    const changed = { ...source, nodes: source.nodes.map((node, i) => i === index ? { ...node, ...patch } as ModelNode : node) };
    assert.ok('error' in readStudioDoc(JSON.stringify(changed)));
    assert.throws(() => toPartDocument(changed), /Through all/);
  }
  assert.throws(() => featureOf(source.nodes[3], 3, source.nodes), /current native document prefix/);
  const crossed = structuredClone(source);
  const stock = crossed.nodes[1] as Extract<ModelNode, { kind: 'extrude' }>;
  stock.from = 0;
  assert.throws(() => toPartDocument(crossed), /crosses above the sketch plane/);
});

test('Through all follows the attached target through deletion checks and a copied graph', () => {
  const source = fixture(14);
  assert.deepEqual(featureDependents(source, 1), [3, 4]);
  assert.ok('error' in deleteFeature(prefixDoc(source, 4), 1));
  const copy = duplicateBody(source, { node: 4, side: 'solid' }, [60, 0, 0]).doc;
  const [one, two] = evaluateCadPart(toPartDocument(copy)).outputs;
  for (const body of [one, two]) assert.ok(Math.abs(massPropertiesOf(body).volume - 15904) < 1e-7);
});
