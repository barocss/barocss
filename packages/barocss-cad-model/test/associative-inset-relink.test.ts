import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { relinkAssociativeInset } from '../src/app/associativeInsetRelink';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { emptyDoc, withNode, type LoopSegment, type SketchNode, type StudioDoc } from '../src/engine/doc';
import { partSnapshot, resolveAssociativeSketch } from '../src/engine/part';
import { isRefusal } from '../src/engine/refusal';

const solid = (node: number) => ({ node, side: 'solid' as const });
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

function specimen(width = 60) {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 24] });
  doc = withNode(doc, { kind: 'extrude', sketch: 0, height: 8 });
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [100, 0], max: [100 + width, 24] });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 8 });
  const inner: LoopSegment[] = ([[2, 2], [38, 2], [38, 22], [2, 22]] as [number, number][]).map(start => ({ kind: 'line', start }));
  doc = withNode(doc, {
    kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 24], holes: [inner],
    sideTags: { outer: ['e10', 'e11', 'e12', 'e13'], holes: [['e14', 'e15', 'e16', 'e17']] },
    plane: { origin: [0, 0, 8], normal: [0, 0, 1], xAxis: [1, 0, 0] }, on: solid(1),
    association: { kind: 'planar-face-outline-inset', version: 1, source: solid(1), sourceFeature: 'n1', face: 'n1.top', insetMM: 2 },
  });
  return withNode(doc, { kind: 'extrude', sketch: 4, height: 4 });
}

function pick(doc: StudioDoc, id = 'n3', faceName = `${id}.top`) {
  const output = partSnapshot(doc).outputs.find(output => output.id === id);
  const face = output?.brep.faces.find(face => face.name === faceName);
  assert.ok(face);
  return { bodyKey: `b${id.slice(1)}`, faceId: face.id, faceName };
}

function profile(doc: StudioDoc) {
  const node = doc.nodes[4];
  assert.ok(node?.kind === 'sketch' && node.association);
  return node as SketchNode & { association: NonNullable<SketchNode['association']> };
}

function verifyOutput(doc: StudioDoc, sourceWidth: number, ringVolume: number, ringX: number) {
  const outputs = partSnapshot(doc).outputs;
  assert.deepEqual(outputs.map(output => output.id), ['n1', 'n3', 'n5']);
  assert.ok(outputs.every(output => checkBrep(output.brep, { strict: true }).valid));
  const [a, b, ring] = outputs.map(output => massPropertiesOf(output, 1));
  near(a.volume, 40 * 24 * 8);
  near(b.volume, sourceWidth * 24 * 8);
  near(ring.volume, ringVolume);
  ring.centroid.forEach((value, i) => near(value, [ringX, 12, 10][i]));
}

test('explicit healthy inset replacement changes only source custody and regenerates the independent extrusion', async () => {
  const doc = specimen(), before = structuredClone(doc), selected = pick(doc);
  const { doc: next, outputKey, resolved } = relinkAssociativeInset(doc, 4, selected);
  assert.equal(outputKey, 'b5');
  assert.deepEqual(doc, before);
  const expected = structuredClone(before);
  Object.assign(profile(expected).association, { source: solid(3), sourceFeature: 'n3', face: 'n3.top' });
  assert.deepEqual(next, expected);
  assert.deepEqual(resolved, resolveAssociativeSketch(next, 4));
  assert.deepEqual(resolved.on, solid(1));
  assert.deepEqual(resolved.association, profile(next).association);
  verifyOutput(doc, 60, (40 * 24 - 36 * 20) * 4, 20);
  verifyOutput(next, 60, (60 * 24 - 56 * 20) * 4, 130);

  const read = await readStudioFile(encodeStudioFile(next));
  assert.ok('doc' in read);
  assert.deepEqual(profile(read.doc), profile(next));
  const source = read.doc.nodes[2];
  assert.ok(source.kind === 'sketch' && source.profile === 'rectangle');
  source.max[0] = 170;
  verifyOutput(read.doc, 70, (70 * 24 - 66 * 20) * 4, 135);
});

test('relink needs the current native face ID and name on one unique earlier output', () => {
  const doc = specimen(), before = structuredClone(doc), selected = pick(doc), old = pick(doc, 'n1');
  assert.throws(() => relinkAssociativeInset(doc, 4, old), e => isRefusal(e, 'NO_CHANGE'));
  for (const bad of [
    { ...old, faceId: 'gone' }, { ...selected, faceId: 'gone' }, { ...selected, faceName: 'n3.bottom' },
    { ...selected, faceName: 'n3.top+n3.side0' }, { ...selected, bodyKey: 'b99' },
    pick(doc, 'n5'),
  ]) assert.throws(() => relinkAssociativeInset(doc, 4, bad), e => isRefusal(e, 'BAD_REFERENCE'));
  const duplicate = structuredClone(doc);
  duplicate.nodes[2].id = 'n3';
  assert.throws(() => relinkAssociativeInset(duplicate, 4, selected), e => isRefusal(e, 'BAD_REFERENCE'));
  assert.deepEqual(doc, before);
});

test('relink refuses an unhealthy old recipe and a replacement whose inset collapses', () => {
  const doc = specimen(), selected = pick(doc);
  profile(doc).association.face = 'n1.missing';
  const before = structuredClone(doc);
  assert.throws(() => relinkAssociativeInset(doc, 4, selected), /named source face is missing or ambiguous/);
  assert.deepEqual(doc, before);

  const narrow = specimen(3), narrowBefore = structuredClone(narrow);
  assert.throws(() => relinkAssociativeInset(narrow, 4, pick(narrow)), e => isRefusal(e, 'BAD_REFERENCE'));
  assert.deepEqual(narrow, narrowBefore);
});

test('relink keeps explicit target custody and refuses downstream geometry or saved face references', () => {
  const doc = specimen(), selected = pick(doc), targetless = structuredClone(doc);
  delete profile(targetless).on;
  assert.throws(() => relinkAssociativeInset(targetless, 4, selected), /explicit earlier solid/);
  const chained = withNode(doc, { kind: 'translate', parent: solid(5), offset: [1, 0, 0] });
  assert.throws(() => relinkAssociativeInset(chained, 4, selected), /final straight extrusion/);
  const colored = { ...doc, bodies: { b5: { faces: { 'n5.top': '#ffffff' } } } };
  assert.throws(() => relinkAssociativeInset(colored, 4, selected), /saved face or edge references/);
  const drawings = { ...doc, drawing: {} } as StudioDoc;
  assert.throws(() => relinkAssociativeInset(drawings, 4, selected), /no drawing/);
  const extrusion = doc.nodes[5];
  assert.equal(extrusion.kind, 'extrude');
  const draft = { ...doc, nodes: [...doc.nodes.slice(0, 5), { ...extrusion, draft: 2 }] };
  assert.throws(() => relinkAssociativeInset(draft, 4, selected), /final straight extrusion/);
});
