import test from 'node:test';
import assert from 'node:assert/strict';
import { massPropertiesOf } from '@barocss/cad';
import {
  cylinderPart, emptyDoc, parentsOf, placedBase, placedDoc, rectanglePart, withNode,
  type LoopSegment, type PlanarFaceOutlineInsetAssociation, type SketchNode, type StudioDoc,
} from '../src/engine/doc';
import { featureId, withIds } from '../src/engine/ids';
import { featureOf, partSnapshot, resolveAssociativeSketch, toPartDocument } from '../src/engine/part';
import { evaluatePart } from '../src/engine/evaluate';
import { deleteFeature, duplicateBody, moveFeature, renumber } from '../src/chat/features';
import { flattenAssembly } from '../src/engine/flatten';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { isRefusal } from '../src/engine/refusal';

// Source-only regression candidate. No browser evidence is manufactured here.
// Independent oracle: rectangular annulus area × cut depth, in mm³. The 1e-9
// volume comparison follows the existing R7 MMGS test convention, not a new solver tolerance.
const near = (actual: number, expected: number) => {
  assert.ok(Number.isFinite(actual));
  assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} != ${expected}`);
};
type Point = [number, number];
const corners = (x0: number, y0: number, x1: number, y1: number): Point[] =>
  [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const lines = (points: Point[]): LoopSegment[] => points.map(start => ({ kind: 'line', start }));
const savedRing = (): SketchNode => ({
  kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 24],
  holes: [lines(corners(2, 2, 38, 22))],
  plane: { origin: [0, 0, 8], normal: [0, 0, 1], xAxis: [1, 0, 0] },
  on: { node: 1, side: 'solid' },
});
function document(linked = true, source = withIds(rectanglePart(40, 24, 8))): StudioDoc {
  const association: PlanarFaceOutlineInsetAssociation = {
    kind: 'planar-face-outline-inset', version: 1, source: { node: 1, side: 'solid' },
    sourceFeature: featureId(source.nodes, 1), face: `${featureId(source.nodes, 1)}.top`, insetMM: 2,
  };
  let doc = withNode(source, { ...savedRing(), ...(linked ? { association } : {}) });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 4, from: -4 });
  return withNode(doc, { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } });
}
function width(doc: StudioDoc, value: number): StudioDoc {
  const copy = structuredClone(doc), source = copy.nodes[0];
  assert.ok(source.kind === 'sketch' && source.profile === 'rectangle');
  source.max[0] = Number(source.min[0]) + value;
  return copy;
}
function recipe(doc: StudioDoc): PlanarFaceOutlineInsetAssociation {
  const node = doc.nodes[2]; assert.equal(node.kind, 'sketch');
  assert.ok(node.kind === 'sketch' && node.association); return node.association;
}
function volume(doc: StudioDoc): number {
  const snapshot = partSnapshot(doc);
  assert.equal(snapshot.outputs.length, 1, 'the actual cut must yield one body');
  return massPropertiesOf(snapshot.outputs[0], 1).volume;
}
function outer(node: SketchNode): Point[] {
  if (node.profile === 'rectangle') return corners(Number(node.min[0]), Number(node.min[1]), Number(node.max[0]), Number(node.max[1]));
  if (node.profile === 'polygon') return node.points.map(p => [Number(p[0]), Number(p[1])] as Point);
  assert.ok(node.profile === 'loop', 'the source must resolve as a straight planar outline');
  return node.segments.map(segment => { assert.equal(segment.kind, 'line'); return [Number(segment.start[0]), Number(segment.start[1])] as Point; });
}
// Hand-written plane lift, independent of production placement/profile/offset helpers.
function worldBounds(node: SketchNode, points: Point[]) {
  assert.ok(node.plane);
  const { origin: o, normal: n, xAxis: x } = node.plane;
  const y = [n[1] * x[2] - n[2] * x[1], n[2] * x[0] - n[0] * x[2], n[0] * x[1] - n[1] * x[0]];
  const world = points.map(([u, v]) => o.map((a, k) => a + x[k] * u + y[k] * v));
  return { min: [0, 1, 2].map(k => Math.min(...world.map(p => p[k]))), max: [0, 1, 2].map(k => Math.max(...world.map(p => p[k]))) };
}
function ringBounds(node: SketchNode, lo: number[], hi: number[], innerLo: number[], innerHi: number[]) {
  const bounds = worldBounds(node, outer(node));
  bounds.min.forEach((v, k) => near(v, lo[k])); bounds.max.forEach((v, k) => near(v, hi[k]));
  assert.equal(node.holes?.length, 1);
  const hole = node.holes![0].map(segment => { assert.equal(segment.kind, 'line'); return [Number(segment.start[0]), Number(segment.start[1])] as Point; });
  const inner = worldBounds(node, hole);
  inner.min.forEach((v, k) => near(v, innerLo[k])); inner.max.forEach((v, k) => near(v, innerHi[k]));
}
const refused = (run: () => unknown) => assert.throws(run, e => isRefusal(e, 'BAD_REFERENCE'));

test('explicit inset: independent annulus oracle distinguishes linked width edit from the legacy snapshot', () => {
  const base = document(), before = structuredClone(base), edited = width(base, 60);
  near(volume(base), 40 * 24 * 8 - (40 * 24 - 36 * 20) * 4); // 6720
  near(volume(edited), 60 * 24 * 8 - (60 * 24 - 56 * 20) * 4); // 10240
  const legacy = width(document(false), 60);
  near(volume(legacy), 60 * 24 * 8 - (40 * 24 - 36 * 20) * 4); // 10560
  assert.deepEqual(base, before, 'resolving must not rewrite authored snapshots or recipes');
  assert.deepEqual((edited.nodes[2] as SketchNode).on, { node: 1, side: 'solid' });
  assert.deepEqual(recipe(edited), recipe(base), 'the producer binding survives the dimension edit');
});

test('explicit inset: resolved outer/inner geometry follows source width and the current source plane', () => {
  const doc = width(document(), 60), base = doc.nodes[0], solid = doc.nodes[1];
  assert.ok(base.kind === 'sketch' && base.profile === 'rectangle' && solid.kind === 'extrude');
  base.min = [10, 5]; base.max = [70, 29]; solid.height = 12;
  const before = structuredClone(doc), resolved = resolveAssociativeSketch(doc, 2);
  ringBounds(resolved, [10, 5, 12], [70, 29, 12], [12, 7, 12], [68, 27, 12]);
  assert.deepEqual(resolved.association, recipe(doc));
  assert.deepEqual(resolved.on, { node: 1, side: 'solid' });
  assert.deepEqual(doc, before);
});

test('explicit inset: source-only parent and kernel metadata stripping do not invent a legacy dependency', () => {
  const linked = document(), node = linked.nodes[2];
  assert.deepEqual(parentsOf(node), [1]);
  assert.deepEqual(parentsOf(document(false).nodes[2]), []);
  refused(() => featureOf(node, 2, linked.nodes));
  assert.doesNotThrow(() => featureOf(document(false).nodes[2], 2, document(false).nodes));
  const part = toPartDocument(width(linked, 60));
  const sketch = part.features.find(f => f.id === featureId(linked.nodes, 2));
  assert.ok(sketch && sketch.kind === 'sketch');
  assert.ok(!('association' in sketch) && !('on' in sketch), 'Studio recipe metadata must not reach the kernel');
});

test('explicit inset: actual file encoding/reading retains the recipe and future width evaluation', async () => {
  const doc = document(), before = structuredClone(doc), encoded = encodeStudioFile(doc);
  const originalBytes = Array.from(encoded), read = await readStudioFile(encoded);
  assert.deepEqual(Array.from(encoded), originalBytes, 'opening must not alter the received file bytes');
  assert.deepEqual(doc, before, 'encoding/opening must not alter the authored document');
  assert.ok(!('error' in read), 'error' in read ? read.error : '');
  assert.deepEqual(recipe(read.doc), recipe(doc));
  assert.deepEqual((read.doc.nodes[2] as SketchNode).on, { node: 1, side: 'solid' });
  near(volume(width(read.doc, 60)), 10240);
  const legacy = await readStudioFile(encodeStudioFile(document(false)));
  assert.ok(!('error' in legacy), 'error' in legacy ? legacy.error : '');
  assert.equal((legacy.doc.nodes[2] as SketchNode).association, undefined, 'old snapshots are never auto-upgraded');
  near(volume(width(legacy.doc, 60)), 10560);
});

test('explicit inset: stable feature identity resolves after earlier unrelated feature insertion', () => {
  const doc = document(), sourceId = recipe(doc).sourceFeature;
  // Real preceding geometry, not a mocked face table. Existing source ids stay fixed.
  doc.nodes.unshift({ kind: 'sketch', profile: 'circle', center: [100, 100], radius: 3, id: 'n99' });
  const source = doc.nodes[2], linked = doc.nodes[3];
  assert.ok(source.kind === 'extrude' && linked.kind === 'sketch' && linked.association);
  source.sketch = 1; linked.association.source.node = 2; linked.on = { node: 2, side: 'solid' };
  assert.equal(featureId(doc.nodes, 2), sourceId);
  ringBounds(resolveAssociativeSketch(doc, 3), [0, 0, 8], [40, 24, 8], [2, 2, 8], [38, 22, 8]);
});

test('explicit inset: invalid or stale bindings refuse without falling back to saved geometry', () => {
  const mutations: Array<[string, (doc: StudioDoc) => void]> = [
    ['missing feature', d => { recipe(d).source.node = 999; }],
    ['wrong stable identity', d => { recipe(d).sourceFeature = 'n987'; }],
    ['ambiguous stable identity', d => { d.nodes[0].id = recipe(d).sourceFeature; }],
    ['missing face', d => { recipe(d).face = 'n1.missing'; }],
    ['ambiguous/composite face', d => { recipe(d).face = 'n1.top+n1.side0'; }],
    ['self reference', d => { recipe(d).source = { node: 2, side: 'solid' }; recipe(d).sourceFeature = featureId(d.nodes, 2); }],
    ['forward reference', d => { recipe(d).source = { node: 4, side: 'solid' }; recipe(d).sourceFeature = featureId(d.nodes, 4); }],
    ['suppressed source', d => { d.nodes[1].suppressed = true; }],
    ['collapsed inset', d => { recipe(d).insetMM = 12; }],
    ['zero inset', d => { recipe(d).insetMM = 0; }],
    ['negative inset', d => { recipe(d).insetMM = -2; }],
    ['nonfinite inset', d => { recipe(d).insetMM = Infinity; }],
  ];
  for (const [label, mutate] of mutations) {
    const doc = document(); mutate(doc); const before = structuredClone(doc);
    assert.throws(() => resolveAssociativeSketch(doc, 2), e => isRefusal(e, 'BAD_REFERENCE'), label);
    assert.throws(() => toPartDocument(doc), e => isRefusal(e, 'BAD_REFERENCE'), `${label}: consumer must refuse too`);
    assert.deepEqual(doc, before, `${label}: failed resolution must preserve the authored document`);
  }
});

test('explicit inset: an actual cylindrical source side is unsupported rather than approximated as planar', () => {
  const source = withIds(cylinderPart(10, 8)), evaluated = evaluatePart(source, 1);
  assert.ok(evaluated.ok, evaluated.ok ? '' : evaluated.error.title);
  const side = evaluated.bodies[0].mesh.faces.find(f => f.exact?.kind === 'cylinder');
  assert.ok(side, 'the fixture must contain a real cylindrical face');
  const doc = document(true, source);
  recipe(doc).face = side.name;
  refused(() => resolveAssociativeSketch(doc, 2));
});

test('explicit inset: flattening and placing a recipe refuse instead of silently copying source indices', () => {
  const linked = document(), before = structuredClone(linked);
  const instance = { id: 'p1', name: 'Linked part', doc: linked, position: [10, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };
  refused(() => flattenAssembly(linked));
  refused(() => toPartDocument({ ...linked, instances: [{ ...instance, doc: rectanglePart(3, 3, 3) }] }));
  refused(() => placedBase(instance));
  refused(() => placedDoc(instance));
  refused(() => flattenAssembly({ ...emptyDoc(), instances: [instance] }));
  assert.deepEqual(linked, before);
  const ordinary = { ...instance, doc: document(false) };
  assert.doesNotThrow(() => flattenAssembly({ ...emptyDoc(), instances: [ordinary] }));
});


test('explicit inset: real feature reorder and unrelated deletion renumber only source indices and protect dependencies', () => {
  const doc = document();
  // A separate real solid, added before the linked sketch. Its ids are distinct.
  doc.nodes.splice(2, 0,
    { kind: 'sketch', profile: 'rectangle', min: [100, 100], max: [105, 105], id: 'n70' },
    { kind: 'extrude', sketch: 2, height: 5, id: 'n71' });
  doc.nodes = doc.nodes.map((node, i) => i >= 4 ? renumber(node, old => old >= 2 ? old + 2 : old) : node);
  const before = structuredClone(doc), original = doc.nodes[4];
  assert.ok(original.kind === 'sketch' && original.association);
  const binding = structuredClone(original.association);
  const moved = moveFeature(doc, 3, -1);
  assert.ok(!('error' in moved), 'error' in moved ? moved.error : '');
  const linked = moved.doc.nodes[4];
  assert.ok(linked.kind === 'sketch' && linked.association);
  assert.equal(linked.association.source.node, 3);
  assert.equal(linked.association.sourceFeature, binding.sourceFeature);
  assert.equal(linked.association.face, binding.face);
  ringBounds(resolveAssociativeSketch(moved.doc, 4), [0, 0, 8], [40, 24, 8], [2, 2, 8], [38, 22, 8]);
  assert.deepEqual(doc, before, 'moveFeature must not mutate its input');
  const movedBefore = structuredClone(moved.doc), deleted = deleteFeature(moved.doc, 1);
  assert.ok(!('error' in deleted), 'error' in deleted ? deleted.error : '');
  assert.deepEqual(recipe(deleted.doc), binding);
  near(volume(deleted.doc), 6720);
  assert.deepEqual(moved.doc, movedBefore, 'deleteFeature must not mutate its input');
  const protectedBefore = structuredClone(deleted.doc);
  assert.ok('error' in deleteFeature(deleted.doc, 1), 'source deletion must refuse while the linked sketch depends on it');
  assert.ok('error' in moveFeature(deleted.doc, 3, -1), 'the linked step must not move before its producer');
  assert.deepEqual(deleted.doc, protectedBefore);
});

test('explicit inset: duplicateBody with new stable ids refuses stale recipe identity instead of claiming automatic rematch', () => {
  const doc = document(), before = structuredClone(doc);
  const duplicate = duplicateBody(doc, { node: 4, side: 'solid' }, [100, 0, 0]);
  const copiedIndex = duplicate.doc.nodes.findIndex((node, i) => i >= doc.nodes.length && node.kind === 'sketch' && node.association);
  assert.ok(copiedIndex >= doc.nodes.length, 'the production duplicate must include the dependent linked sketch');
  refused(() => resolveAssociativeSketch(duplicate.doc, copiedIndex));
  refused(() => toPartDocument(duplicate.doc));
  assert.deepEqual(doc, before);
});


test('explicit inset: defined malformed association values refuse at resolve, dependency and renumber boundaries', () => {
  for (const malformed of [null, false, 0, '']) {
    const doc = document(), node = doc.nodes[2];
    // Raw stored-input negative: do not normalize malformed input to absent metadata.
    Object.assign(node, { association: malformed });
    const before = structuredClone(doc);
    refused(() => parentsOf(node));
    refused(() => renumber(node, i => i + 1));
    refused(() => resolveAssociativeSketch(doc, 2));
    refused(() => toPartDocument(doc));
    refused(() => flattenAssembly(doc));
    assert.deepEqual(doc, before, 'a malformed recipe must never mutate or become a legacy snapshot');
  }
});

test('explicit inset: an actual planar cylinder top with circular boundary refuses straight-outline support', () => {
  const source = withIds(cylinderPart(10, 8)), evaluated = evaluatePart(source, 1);
  assert.ok(evaluated.ok, evaluated.ok ? '' : evaluated.error.title);
  const top = evaluated.bodies[0].mesh.faces.find(f => f.name === `${featureId(source.nodes, 1)}.top`);
  assert.ok(top && top.kind === 'plane', 'this negative must use a real planar cap, not a curved side');
  const doc = document(true, source); recipe(doc).face = top.name;
  const before = structuredClone(doc);
  refused(() => resolveAssociativeSketch(doc, 2));
  refused(() => toPartDocument(doc));
  assert.deepEqual(doc, before);
});


test('explicit inset: a frame following the linked sketch refuses raw snapshot consumption', () => {
  const doc = withNode(document(), {
    kind: 'frame', follows: { sketch: 2 },
    section: { kind: 'rect-tube', width: 4, height: 4, wall: 1, outerRadius: 0 },
    corners: { default: 'mitre' },
  });
  const before = structuredClone(doc), index = doc.nodes.length - 1;
  refused(() => featureOf(doc.nodes[index], index, doc.nodes));
  refused(() => toPartDocument(doc));
  assert.deepEqual(doc, before);
});


test('explicit inset: the original face drives geometry while a separate earlier on target remains an independent copied BodyRef', () => {
  let doc = withIds(rectanglePart(40, 24, 8));
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [100, 100], max: [110, 110] });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 5 });
  const association: PlanarFaceOutlineInsetAssociation = {
    kind: 'planar-face-outline-inset', version: 1,
    source: { node: 1, side: 'solid' }, sourceFeature: featureId(doc.nodes, 1),
    face: `${featureId(doc.nodes, 1)}.top`, insetMM: 2,
  };
  doc = withNode(doc, { ...savedRing(), on: { node: 3, side: 'solid' }, association });
  const before = structuredClone(doc), stored = doc.nodes[4];
  assert.ok(stored.kind === 'sketch');
  const resolved = resolveAssociativeSketch(doc, 4);
  assert.deepEqual(resolved.on, { node: 3, side: 'solid' });
  assert.notEqual(resolved.on, stored.on, 'the resolved on target must be a copy');
  assert.deepEqual(resolved.association?.source, { node: 1, side: 'solid' });
  ringBounds(resolved, [0, 0, 8], [40, 24, 8], [2, 2, 8], [38, 22, 8]);
  assert.deepEqual(doc, before, 'resolving must preserve the separate authored on target and original document');
});
