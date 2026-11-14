import assert from 'node:assert/strict';
import test from 'node:test';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import type { Ctx } from '../src/app/commands';
import { awaitingRevolveAxis, editSavedRevolveAxisCommand } from '../src/app/revolveAxisEdit';
import { addPart } from '../src/assembly/edit';
import { deleteFeature, duplicateBody, featureDependents } from '../src/chat/features';
import { rectanglePart, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { flattenAssembly } from '../src/engine/flatten';
import { readStudioDoc } from '../src/engine/migrate';
import { revolveAxisReference } from '../src/engine/revolveAxis';
import { currentLinkedRevolveAxis, featureOf, toPartDocument } from '../src/engine/part';

const ref = (node: number) => ({ node, side: 'solid' as const });
const patch = (doc: StudioDoc, index: number, fields: Partial<ModelNode>): StudioDoc => ({
  ...doc, nodes: doc.nodes.map((node, i) => i === index ? { ...node, ...fields } as ModelNode : node),
});
function fixture(tagged = false): StudioDoc {
  const stock = rectanglePart(40, 20, 20);
  const base = tagged ? patch(stock, 0, { sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] } }) : stock;
  const profile = withNode(base, { kind: 'sketch', profile: 'rectangle', min: [10, 6], max: [20, 9],
    plane: { origin: [0, 0, 20], normal: [0, 0, 1], xAxis: [1, 0, 0] } });
  return withNode(profile, { kind: 'revolve', sketch: 2, axis: 'x', origin: [40, 20], dir: [-1, 0], angle: 360,
    axisRef: { version: 1, sourceFeature: 'n1', edge: tagged ? 'n1.side[e3]|n1.top' : 'n1.side2|n1.top', side: 2 } });
}
const outputs = (doc: StudioDoc) => evaluateCadPart(toPartDocument(doc)).outputs;
const near = (got: number, expected: number) => assert.ok(Math.abs(got - expected) < 1e-7, `${got} vs ${expected}`);

test('a linked original top edge moves in-plane without rewriting the fixed snapshot', () => {
  for (const tagged of [false, true]) {
    const doc = fixture(tagged), moved = patch(doc, 0, { max: [40, 24] });
    assert.deepEqual(currentLinkedRevolveAxis(doc, 3), { origin: [40, 20], dir: [-1, 0] });
    assert.deepEqual(currentLinkedRevolveAxis(moved, 3), { origin: [40, 24], dir: [-1, 0] });
    assert.deepEqual(moved.nodes[3], doc.nodes[3]);
    const precise = currentLinkedRevolveAxis(patch(doc, 0, { max: [40, 20.0000004] }), 3);
    assert.ok(Math.abs(precise!.origin[1] - 20.0000004) < 1e-8);
    assert.deepEqual(readStudioDoc(JSON.stringify(moved)), { doc: moved, notes: [] });
    const [stock, linked] = outputs(moved);
    for (const body of [stock, linked]) assert.ok(checkOutput(body).valid && body.bodyCount === 1);
    near(massPropertiesOf(linked).volume, 990 * Math.PI);
    const fixed = structuredClone(moved);
    if (fixed.nodes[3].kind === 'revolve') delete fixed.nodes[3].axisRef;
    near(massPropertiesOf(outputs(fixed)[1]).volume, 750 * Math.PI);
  }
});

test('linked axes refuse a bad reference, an out-of-plane cap and a changed axis direction', () => {
  const doc = fixture();
  assert.deepEqual(featureDependents(doc, 1), [3]);
  assert.ok('error' in deleteFeature(doc, 1));
  assert.throws(() => toPartDocument(patch(doc, 1, { height: 24 })), /edge must remain in the sketch plane/);
  assert.throws(() => toPartDocument(patch(doc, 1, { height: -20 })), /earlier rectangular solid/);
  assert.throws(() => toPartDocument(patch(fixture(true), 0, { sideTags: { outer: ['e1', 'e3', 'e2', 'e4'] } })), /original rectangle side/);
  assert.throws(() => toPartDocument(patch(fixture(true), 0, { sideTags: { outer: ['e3', 'e2', 'e1', 'e4'] } })), /original rectangle side/);
  assert.doesNotThrow(() => toPartDocument(patch(patch(doc, 3, { suppressed: true }), 1, { suppressed: true })));
  const malformed = patch(doc, 3, { axisRef: { version: 1, sourceFeature: 'n0', edge: 'n1.side2|n1.top', side: 2 } });
  assert.ok('error' in readStudioDoc(JSON.stringify(malformed)));
  assert.ok('error' in readStudioDoc(JSON.stringify(patch(doc, 3, { dir: [0, 0] }))));
  assert.throws(() => featureOf(doc.nodes[3], 3, doc.nodes), /current native document prefix/);
});

test('copy and flatten preserve the stock reference with one body per output', () => {
  const doc = fixture(), copy = duplicateBody(doc, ref(3), [0, 65, 0]).doc;
  const copied = outputs(copy);
  assert.equal(copied.length, 3, 'a standalone copy shares the original axis stock');
  [copied[1], copied[2]].forEach(body => near(massPropertiesOf(body).volume, 750 * Math.PI));
  const assembly = addPart(rectanglePart(4, 4, 4), { name: 'Rotor', doc, position: [65, 0, 0], rotation: [0, 0, 0] }).doc;
  const flattened = outputs(flattenAssembly(assembly));
  assert.equal(flattened.length, 3);
  assert.ok(flattened.every(body => checkOutput(body).valid));
  near(massPropertiesOf(flattened[2]).volume, 750 * Math.PI);
  const joined = withNode(doc, { kind: 'union', left: ref(1), right: ref(3) });
  const joinedCopy = outputs(duplicateBody(joined, ref(4), [0, 65, 0]).doc);
  assert.equal(joinedCopy.length, 2);
  joinedCopy.forEach(body => near(massPropertiesOf(body).volume, 16000 + 562.5 * Math.PI));
});

test('History replaces only the saved Revolve after an earlier current edge pick', () => {
  let doc = patch(fixture(), 0, { max: [40, 24] });
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [60, 0], max: [70, 12] });
  doc = withNode(doc, { kind: 'extrude', sketch: 4, height: 20 });
  const cmd = editSavedRevolveAxisCommand(doc, 3), result = evaluateDoc(doc, 0);
  assert.ok(cmd?.onPick && cmd.build && result.ok);
  const ctx: Ctx = { doc, bodies: result.bodies, selection: { faces: [], edges: [], bodies: [], sketches: [4] } };
  const stale = { ...ctx, doc: { ...doc } };
  const pick = (key: string, name: string) => {
    const body = ctx.bodies.findIndex(b => b.key === key);
    const edge = ctx.bodies[body].mesh.edges.findIndex(e => e.names.includes(name));
    assert.ok(edge >= 0);
    return { edge: { body, edge }, face: null };
  };
  const later = pick('b5', 'n5.side0|n5.top'), earlier = pick('b1', 'n1.side0|n1.top');
  assert.ok(awaitingRevolveAxis(cmd.id, {}));
  assert.throws(() => cmd.build!(ctx, {}), /earlier rectangular solid/);
  assert.match(String(cmd.onPick(ctx, {}, later)?.error), /earlier rectangular solid/);
  assert.match(String(cmd.onPick(stale, {}, earlier)?.error), /current Revolve/);
  const picked = cmd.onPick(ctx, {}, earlier);
  assert.ok(picked && !('error' in picked) && !awaitingRevolveAxis(cmd.id, picked));
  assert.throws(() => cmd.build!(stale, picked), /current Revolve/);
  const candidate = cmd.build(ctx, picked);
  assert.equal(candidate.outputs, doc.outputs);
  assert.equal(candidate.nextId, doc.nextId);
  doc.nodes.forEach((node, index) => { if (index !== 3) assert.equal(candidate.nodes[index], node); });
  assert.deepEqual(candidate.nodes[3], { ...doc.nodes[3], origin: [0, 0], dir: [1, 0],
    axisRef: { version: 1, sourceFeature: 'n1', edge: 'n1.side0|n1.top', side: 0 } });
  const rotor = outputs(candidate).find(body => body.id === 'n3')!;
  assert.ok(checkOutput(rotor).valid);
  near(massPropertiesOf(rotor).volume, 450 * Math.PI);
});

test('a linked axis resolves an earlier Move using its original prism edge names', () => {
  const stock = withNode(rectanglePart(40, 20, 20), { kind: 'translate', parent: ref(1), offset: [0, 2, 0] });
  const profile = withNode(stock, { kind: 'sketch', profile: 'rectangle', min: [10, 6], max: [20, 9],
    plane: { origin: [0, 0, 20], normal: [0, 0, 1], xAxis: [1, 0, 0] } });
  const axisRef = { version: 1, sourceFeature: 'n2', edge: 'n1.side2|n1.top', side: 2 } as const;
  const doc = withNode(profile, { kind: 'revolve', sketch: 3, axis: 'x', origin: [40, 22], dir: [-1, 0], angle: 360, axisRef });
  const moved = patch(doc, 2, { offset: [0, 6, 0] });
  assert.deepEqual(revolveAxisReference(profile, 2, 3, axisRef.edge), axisRef);
  assert.equal(revolveAxisReference(profile, 2, 3, 'n2.side2|n2.top'), undefined);
  assert.deepEqual(featureDependents(doc, 2), [4]);
  assert.ok('error' in deleteFeature(doc, 2));
  assert.deepEqual(currentLinkedRevolveAxis(moved, 4), { origin: [40, 26], dir: [-1, 0] });
  assert.throws(() => toPartDocument(patch(moved, 2, { offset: [0, 6, 4] })), /edge must remain in the sketch plane/);
  assert.throws(() => toPartDocument(patch(moved, 2, { suppressed: true })), /earlier rectangular solid/);
  assert.doesNotThrow(() => toPartDocument(patch(patch(moved, 4, { suppressed: true }), 2, { suppressed: true })));
  assert.throws(() => toPartDocument(patch(moved, 2, { parent: ref(2) })), /earlier rectangular solid/);
  const later = withNode(moved, { kind: 'translate', parent: ref(2), offset: [0, 7, 0] });
  assert.deepEqual(currentLinkedRevolveAxis(later, 4), { origin: [40, 26], dir: [-1, 0] });
  assert.equal(outputs(later).find(body => body.id === 'n5')?.brep.vertices[0].point[1], 13);
  const mass = (body: ReturnType<typeof outputs>[number]) => {
    assert.ok(checkOutput(body).valid);
    return massPropertiesOf(body).volume;
  };
  near(mass(outputs(doc).find(b => b.id === 'n4')!), 870 * Math.PI);
  near(mass(outputs(later).find(b => b.id === 'n4')!), 1110 * Math.PI);
  const copied = outputs(duplicateBody(moved, ref(4), [55, 0, 0]).doc);
  assert.equal(copied.length, 3);
  assert.equal(copied.filter(b => Math.abs(mass(b) - 1110 * Math.PI) < 1e-7).length, 2);
  const joined = withNode(doc, { kind: 'union', left: ref(2), right: ref(4) });
  const joinedCopy = outputs(duplicateBody(joined, ref(5), [55, 0, 0]).doc);
  assert.equal(joinedCopy.length, 2);
  near(mass(joinedCopy[0]), mass(joinedCopy[1]));
  const assembly = addPart(rectanglePart(4, 4, 4), { name: 'Moved axis', doc: moved, position: [65, 0, 0], rotation: [0, 0, 0] }).doc;
  const flattened = outputs(flattenAssembly(assembly));
  assert.equal(flattened.length, 3);
  assert.equal(flattened.filter(b => Math.abs(mass(b) - 1110 * Math.PI) < 1e-7).length, 1);
});
