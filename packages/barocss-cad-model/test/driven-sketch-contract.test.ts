import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, leafBodies, parentsOf, rectanglePart, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { bindParameter, bindSketchLength, unbindSketchLength, withParameters, renameParameter, removeParameter } from '../src/engine/parameters';
import { editFields, type BindableField } from '../src/app/editFields';
import { readStudioDoc } from '../src/engine/migrate';
import { featureOf, resolveAssociativeSketch, toPartDocument } from '../src/engine/part';
import { flattenAssembly } from '../src/engine/flatten';
import { emptyDirect, importSource } from '../src/engine/direct';
import { createRouteBundle, routeBundleDocumentIdentity, type CreateRouteBundleMemberInput } from '../src/engine/routeBundle';
import { assertDrivenSketchNode } from '../src/sketch/driven';

const points: [number, number][] = [[0, 0], [60, 0], [60, 20], [20, 20], [20, 40], [0, 40]];
const fixture = (): StudioDoc => ({ ...emptyDoc(), parameters: { L: 64, B: 68 }, nextId: 2, nodes: [
  { kind: 'sketch', id: 'n0', profile: 'loop', segments: points.map(start => ({ kind: 'line', start: [...start] as [number, number] })),
    outline: { points: points.map(p => [...p] as [number, number]), bulges: points.map(() => 0), lengths: { 0: 60, 1: 20 }, hv: { h: [0, 2, 4], v: [1, 3, 5] } },
    sideTags: { outer: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'] } },
  { kind: 'extrude', id: 'n1', sketch: 0, height: 8 },
] });
const driven = () => bindSketchLength(fixture(), 'n0', 'e1', 'L');
const field = (doc: StudioDoc): BindableField => {
  const f = editFields(doc.nodes, 1, doc.parameters).find(f => f.key === 'olen0');
  assert.ok(f?.kind === 'number' && 'bind' in f); return f as BindableField;
};

function schemaFour(doc: StudioDoc): StudioDoc {
  const knots = [0, 0, 0, 0, 1, 1, 1, 1], weights = [1, 1, 1, 1];
  const controlPoints = (x: number): [number, number, number][] => [[x, 0, 0], [x, 0, 10], [x, 0, 20], [x, 0, 30]];
  const curve = (id: string, x: number) => `@curve #${id} { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: ${JSON.stringify(controlPoints(x))}; weights: [1,1,1,1]; }`;
  const direct = importSource(emptyDirect(), `@model routes { version: 0; length-unit: mm; ${curve('a', -2)} ${curve('b', 2)} }`, 'routes');
  const base: StudioDoc = { ...emptyDoc(), direct, parameters: doc.parameters, nextId: 4, nodes: [-2, 2].flatMap((x, i): ModelNode[] => [
    { kind: 'sketch', id: `n${2 * i}`, profile: 'circle', center: [0, 0], radius: 0.5 },
    { kind: 'sweep-curve', id: `n${2 * i + 1}`, sketch: 2 * i, name: `route ${i}`, path: { degree: 3, knots, weights, controlPoints: controlPoints(x) } },
  ]) };
  const member = (name: string, i: number): CreateRouteBundleMemberInput => ({ id: `member${i}`, curveObjectId: direct.objects.find(o => o.geometry === name)!.id, handleKey: '1', sweepFeatureId: `n${2 * i + 1}`, profileFeatureId: `n${2 * i}` });
  const bundled = createRouteBundle(base, { id: 'bundle1', tieId: 'tie1', anchorMM: [0, 0, 10], expectedDocumentIdentity: routeBundleDocumentIdentity(base),
    members: [member('a', 0), member('b', 1)] });
  return { ...bundled, nextId: 6, nodes: [...bundled.nodes, { ...doc.nodes[0], id: 'n4' }, { kind: 'extrude', id: 'n5', sketch: 4, height: 8 }] };
}

test('D537 raw schema 3/4 roundtrip retains authored seed, recipe and current parameter authority', () => {
  const original = fixture(), before = JSON.stringify(original), doc = driven(), raw = JSON.stringify(doc);
  assert.equal(JSON.stringify(original), before);
  assert.equal(doc.nodes[0].kind, 'driven-sketch');
  assert.deepEqual(parentsOf(doc.nodes[0]), []);
  assert.deepEqual(leafBodies(doc.nodes), [{ node: 1, side: 'solid' }]);
  for (const saved of [doc, schemaFour(doc)]) {
    const out = readStudioDoc(JSON.stringify(saved));
    assert.ok('doc' in out, JSON.stringify(out));
    assert.deepEqual(out.doc.nodes, saved.nodes);
  }
  const one = toPartDocument(doc), two = toPartDocument(withParameters(doc, { L: 68 }));
  assert.notDeepEqual(two.features[0], one.features[0]);
  assert.equal(JSON.stringify(doc), raw);
  assert.throws(() => featureOf(doc.nodes[0], 0, doc.nodes), /document parameter resolution/);
  assert.throws(() => flattenAssembly(doc), /Driven sketch/);
});

test('D537 semantic field binds, replaces and unbinds without arbitrary numeric edits', () => {
  const ordinary = fixture(), f = field(ordinary), bound = bindParameter(ordinary, { feature: 1, value: 'olen0', parameter: 'L' });
  assert.equal(f.param(bound.nodes), 'L'); assert.equal(f.get(bound.nodes), 64);
  const fields = editFields(bound.nodes, 1, bound.parameters);
  assert.deepEqual(fields.filter(f => f.key.startsWith('o')).map(f => f.key), ['olen0']);
  const bf = field(bound); assert.throws(() => bf.set(bound.nodes, 65), /Unbind/);
  const replaced = bindParameter(bound, { feature: 1, value: 'olen0', parameter: 'B' });
  assert.equal(field(replaced).param(replaced.nodes), 'B'); assert.equal(field(replaced).get(replaced.nodes), 68);
  const numeric = { ...replaced, nodes: field(replaced).set(replaced.nodes, 68) };
  assert.equal(numeric.nodes[0].kind, 'sketch');
  assert.deepEqual(toPartDocument(numeric), toPartDocument(replaced));
  assert.deepEqual(unbindSketchLength(replaced, 'n0'), numeric);
});

test('D537 rename keeps recipe; remove materializes current geometry before removing references', () => {
  const doc = driven(), renamed = renameParameter(doc, 'L', 'Width');
  assert.equal(field(renamed).param(renamed.nodes), 'Width');
  const removed = removeParameter(withParameters(renamed, { Width: 68 }), 'Width');
  assert.equal(removed.nodes[0].kind, 'sketch');
  assert.equal('Width' in removed.parameters, false);
  assert.deepEqual(toPartDocument(removed).features, toPartDocument(withParameters(doc, { L: 68 })).features);
});

test('D537 malformed recipes and inherited parameters refuse without mutation', () => {
  const doc = driven(), node = doc.nodes[0], raw = JSON.stringify(doc);
  assert.equal(node.kind, 'driven-sketch'); if (node.kind !== 'driven-sketch') return;
  const mutations: unknown[] = [
    { ...node, version: 2 }, { ...node, stale: true }, { ...node, bindings: [] },
    { ...node, bindings: [...node.bindings, ...node.bindings] },
    { ...node, bindings: [{ ...node.bindings[0], entity: 'gone' }] },
    { ...node, seed: { ...node.seed, association: {} } },
    { ...node, seed: { ...node.seed, outline: { ...node.seed.outline, spline: {} } } },
    { ...node, seed: { ...node.seed, segments: [{ kind: 'line', start: [{ parameter: 'L' }, 0] }, ...node.seed.segments.slice(1)] } },
  ];
  for (const bad of mutations) {
    assert.throws(() => assertDrivenSketchNode(bad, doc.parameters));
    const result = readStudioDoc(JSON.stringify({ ...doc, nodes: [bad, doc.nodes[1]] }));
    assert.ok('error' in result);
  }
  const inherited = Object.create({ L: 64 }) as Record<string, number>;
  assert.throws(() => assertDrivenSketchNode(node, inherited), /parameter/i);
  assert.throws(() => bindSketchLength({ ...fixture(), parameters: inherited }, 0, 'e1', 'L'), /parameter/i);
  assert.equal(JSON.stringify(doc), raw);
  assert.equal((fixture().nodes[0] as ModelNode).kind, 'sketch');
});


test('D537 linked-sketch source prefix ignores an invalid later driven recipe', () => {
  const source = rectanglePart(40, 24, 8), bad = driven().nodes[0];
  assert.equal(bad.kind, 'driven-sketch'); if (bad.kind !== 'driven-sketch') return;
  const linked: ModelNode = { kind: 'sketch', id: 'n2', profile: 'rectangle', min: [0, 0], max: [40, 24],
    plane: { origin: [0, 0, 8], normal: [0, 0, 1], xAxis: [1, 0, 0] },
    association: { kind: 'planar-face-outline-inset', version: 1, source: { node: 1, side: 'solid' }, sourceFeature: 'n1', face: 'n1.top', insetMM: 2 } };
  const prefix = { ...source, nodes: [...source.nodes, linked] }, full = { ...prefix, nodes: [...prefix.nodes, { ...bad, id: 'n3' }] };
  const raw = JSON.stringify(full);
  assert.deepEqual(resolveAssociativeSketch(full, 2), resolveAssociativeSketch(prefix, 2));
  assert.throws(() => toPartDocument(full), /parameter/i);
  assert.equal(JSON.stringify(full), raw);
});

import { checkNode, deleteFeature, moveFeature } from '../src/chat/features';
import { bodySteps, rootOf } from '../src/app/bodies';
import { profileRings, boundParameters } from '../src/app/profiles';
import { studioBackend } from '../src/api/studio';

test('D537 feature admission and body ancestry treat a driven recipe as a sketch', () => {
  const doc = driven();
  assert.equal(checkNode({ kind: 'extrude', sketch: 0, height: 8 }, doc.nodes, doc.parameters), null);
  assert.deepEqual(bodySteps(doc.nodes, 1), [1]);
  assert.equal(rootOf(doc.nodes, 1), 1);
  const finished: ModelNode[] = [...doc.nodes, { kind: 'hole', id: 'n2', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 2 }];
  assert.deepEqual(bodySteps(finished, 2), [1, 2]);
  assert.equal(rootOf(finished, 2), 1);
});

test('D537 deletion removes an exclusive driven source and retains a shared source', () => {
  const doc = driven(), raw = JSON.stringify(doc), exclusive = deleteFeature(doc, 1);
  assert.ok('doc' in exclusive, JSON.stringify(exclusive));
  assert.deepEqual(exclusive.doc.nodes, []);
  assert.deepEqual([...exclusive.removed].sort((a, b) => a - b), [0, 1]);
  const shared: StudioDoc = { ...doc, nextId: 3, nodes: [...doc.nodes, { kind: 'extrude', id: 'n2', sketch: 0, height: 12 }] };
  const removed = deleteFeature(shared, 1);
  assert.ok('doc' in removed, JSON.stringify(removed));
  assert.deepEqual(removed.removed, [1]);
  assert.deepEqual(removed.doc.nodes[0], shared.nodes[0]);
  assert.deepEqual(removed.doc.nodes.map(n => n.id), ['n0', 'n2']);
  const remaining = removed.doc.nodes[1];
  assert.equal(remaining.kind, 'extrude'); if (remaining.kind === 'extrude') assert.equal(remaining.sketch, 0);
  assert.equal(JSON.stringify(doc), raw);
});

test('D537 history moves a driven source and its exclusive owner as one step', () => {
  const first = driven(), doc: StudioDoc = { ...first, nextId: 4, nodes: [...first.nodes,
    { kind: 'sketch', id: 'n2', profile: 'rectangle', min: [100, 0], max: [120, 10] },
    { kind: 'extrude', id: 'n3', sketch: 2, height: 5 },
  ] }, raw = JSON.stringify(doc);
  const moved = moveFeature(doc, 1, 1), pickedSketch = moveFeature(doc, 0, 1);
  assert.ok('doc' in moved, JSON.stringify(moved)); assert.ok('doc' in pickedSketch, JSON.stringify(pickedSketch));
  assert.deepEqual(moved.doc.nodes.map(n => n.id), ['n2', 'n3', 'n0', 'n1']);
  assert.deepEqual(pickedSketch.doc.nodes, moved.doc.nodes);
  assert.deepEqual(moved.doc.nodes[2], doc.nodes[0]);
  const ordinaryOwner = moved.doc.nodes[1], drivenOwner = moved.doc.nodes[3];
  assert.equal(ordinaryOwner.kind, 'extrude'); if (ordinaryOwner.kind === 'extrude') assert.equal(ordinaryOwner.sketch, 0);
  assert.equal(drivenOwner.kind, 'extrude'); if (drivenOwner.kind === 'extrude') assert.equal(drivenOwner.sketch, 2);
  const restored = moveFeature(moved.doc, 3, -1);
  assert.ok('doc' in restored, JSON.stringify(restored)); assert.deepEqual(restored.doc.nodes, doc.nodes);
  assert.equal(JSON.stringify(doc), raw);
});

test('D537 profile rings and parameter labels use current own parameter values', () => {
  const doc = driven(), later = withParameters(doc, { L: 68 }), node = doc.nodes[0];
  assert.equal(node.kind, 'driven-sketch'); if (node.kind !== 'driven-sketch') return;
  const a = profileRings(node, doc.parameters), b = profileRings(node, later.parameters);
  assert.notDeepEqual(a, b);
  const firstLength = (rings: number[][][]) => Math.hypot(...rings[0][0].map((v, i) => v - rings[0][1][i]));
  assert.ok(Math.abs(firstLength(a) - 64) <= 1e-7);
  assert.ok(Math.abs(firstLength(b) - 68) <= 1e-7);
  assert.deepEqual(boundParameters(doc.nodes, [0], doc.parameters), [['L', 64]]);
  assert.deepEqual(boundParameters(later.nodes, [0], later.parameters), [['L', 68]]);
  assert.deepEqual(boundParameters(doc.nodes, [0], Object.create({ L: 64 }) as Record<string, number>), []);
});

test('D537 public Studio backend explicitly refuses suppressing a driven sketch', () => {
  const doc = driven(), raw = JSON.stringify(doc);
  assert.throws(() => studioBackend.suppress!(doc, 'n0', true), error => error instanceof Error && 'code' in error && error.code === 'UNAVAILABLE');
  assert.equal(JSON.stringify(doc), raw);
});
