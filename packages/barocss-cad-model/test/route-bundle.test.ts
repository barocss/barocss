import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep, evaluateCurve, outputOf, saveCadPart, type Curve } from '@barocss/cad';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { emptyDirect, geometryOf, importSource, type DirectGeometry } from '../src/engine/direct';
import { assertRouteBundleDocument, createRouteBundle, detachRouteBundle, moveRouteBundle, routeBundleDocumentIdentity, type CreateRouteBundleInput } from '../src/engine/routeBundle';
import { featureOf, partSnapshot, toPartDocument } from '../src/engine/part';
import { flattenAssembly } from '../src/engine/flatten';
import { isRefusal } from '../src/engine/refusal';
import { canonical, fnv64 } from '../src/util/revision';

// Source-only declarations. No execution, UI or manufacturing acceptance is implied.
// Reuse the fixed Kernel PB0 oracle: cubic Bernstein, abs 1e-7 mm, radius 0.5 mm.
const EPS = 1e-7, DELTA: [number, number, number] = [5, -3, 4];
const MIDPOINTS = [[-0.125, -1.125, 16.5], [3.875, -1.125, 16.5]];
const pointClose = (actual: number[], expected: number[]) => assert.ok(Math.hypot(...actual.map((v, k) => v - expected[k])) <= EPS, `${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
const curveText = (id: string, x: number) => {
  // The overflow fixture keeps 1e308, expressed in the existing decimal-only source grammar.
  const coordinate = x === 1e308 ? '1' + '0'.repeat(308) : String(x);
  return `@curve #${id} { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[${coordinate},0,0],[${coordinate},0,10],[${coordinate},0,20],[${coordinate},0,30]]; weights: [1,1,1,1]; }`;
};
const source = (name: string, curves: string[]) => `@model ${name} { version: 0; length-unit: mm; ${curves.join('\n')} }`;
function curve(direct: DirectGeometry, id: string): Curve {
  const object = direct.objects.find(o => o.id === id); assert.ok(object);
  const g = geometryOf(direct, object); assert.equal(g.kind, 'curve'); assert.ok(g.kind === 'curve'); return g;
}
function copiedPath(g: Curve) { return { degree: g.degree, knots: [...g.knots], controlPoints: g.controlPoints.map(p => [...p] as [number, number, number]), weights: [...g.weights] }; }
function fixture(shared = true, xs = [-2, 2]) {
  let direct = importSource(emptyDirect(), source('routesA', [curveText('a', xs[0]), ...(shared ? [curveText('b', xs[1])] : []), curveText('witness', 20)]), 'routes');
  if (!shared) direct = importSource(direct, source('routesB', [curveText('b', xs[1])]), 'route B');
  const a = direct.objects.find(o => o.geometry === 'a')!, b = direct.objects.find(o => o.geometry === 'b')!;
  let doc: StudioDoc = { ...emptyDoc(), direct };
  for (const [i, object] of [a, b].entries()) {
    doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 0.5 });
    doc = withNode(doc, { kind: 'sweep-curve', sketch: 2 * i, name: `route ${i}`, path: copiedPath(curve(direct, object.id)) });
  }
  const input: CreateRouteBundleInput = {
    id: 'bundle1', tieId: 'tie1', anchorMM: [0, 0, 10],
    members: [{ id: 'memberA', curveObjectId: a.id, handleKey: '1', sweepFeatureId: 'n1', profileFeatureId: 'n0' }, { id: 'memberB', curveObjectId: b.id, handleKey: '1', sweepFeatureId: 'n3', profileFeatureId: 'n2' }],
    expectedDocumentIdentity: routeBundleDocumentIdentity(doc),
  };
  return { doc, input };
}
function refused(run: () => unknown): void {
  assert.throws(run, error => { assert.ok(isRefusal(error)); assert.equal(error.code, 'BAD_REFERENCE'); assert.match(error.message, /Route bundle:/); return true; });
}
function created(shared = true) { const f = fixture(shared); return createRouteBundle(f.doc, f.input); }

test('PB0 explicit create preserves its legacy source and captures both current copied paths', () => {
  const { doc, input } = fixture(), before = structuredClone(doc), inputBefore = structuredClone(input);
  const next = createRouteBundle(doc, input);
  assert.equal(doc.schema, 3); assert.equal(Object.hasOwn(doc, 'routeBundles'), false);
  assert.equal(next.schema, 4); assertRouteBundleDocument(next);
  const bundle = next.routeBundles![0]; assert.equal(bundle.members.length, 2);
  assert.deepEqual(bundle.members.map(m => m.offsetMM), [[-2, 0, 0], [2, 0, 0]]);
  assert.equal(bundle.members[0].sourceKey, bundle.members[1].sourceKey, 'same-source different geometries are supported');
  for (const member of bundle.members) {
    assert.equal(member.sourceRevision, fnv64(member.sourceCanonical));
    const binding = JSON.parse(member.sourceCanonical), object = next.direct!.objects.find(o => o.id === member.curveObjectId)!;
    assert.equal(binding.source, next.direct!.sources[object.source]);
    assert.deepEqual(binding.object, { id: object.id, source: object.source, geometry: object.geometry });
    const node = next.nodes.find(n => n.id === member.sweepFeatureId)!; assert.ok(node.kind === 'sweep-curve');
    assert.deepEqual(node.path, copiedPath(curve(next.direct!, object.id)));
    assert.deepEqual(node.routeBundleMember, { bundleId: bundle.id, memberId: member.id });
  }
  assert.deepEqual(doc, before); assert.deepEqual(input, inputBefore);
});

for (const shared of [true, false]) test(`PB0 total translation composes latest-draft source forks (${shared ? 'shared' : 'separate'} sources)`, () => {
  const start = created(shared), before = structuredClone(start), id = routeBundleDocumentIdentity(start);
  const moved = moveRouteBundle(start, 'bundle1', DELTA, id), bundle = moved.routeBundles![0];
  assert.deepEqual(bundle.tie.anchorMM, [5, -3, 14]);
  assert.deepEqual(bundle.members.map(m => m.offsetMM), [[-2, 0, 0], [2, 0, 0]]);
  for (const [i, member] of bundle.members.entries()) {
    const original = start.routeBundles![0].members[i], a = curve(start.direct!, member.curveObjectId), b = curve(moved.direct!, member.curveObjectId);
    assert.deepEqual(b.controlPoints[1], [[3, -3, 14], [7, -3, 14]][i]);
    for (const pole of [0, 2, 3]) assert.deepEqual(b.controlPoints[pole], a.controlPoints[pole]);
    assert.deepEqual(b.knots, a.knots); assert.deepEqual(b.weights, a.weights); assert.equal(b.degree, a.degree);
    pointClose(evaluateCurve(b, 0.5), MIDPOINTS[i]);
    const object = moved.direct!.objects.find(o => o.id === member.curveObjectId)!;
    assert.equal(member.sourceKey, object.source); assert.notEqual(member.sourceKey, original.sourceKey);
    assert.notEqual(member.sourceCanonical, original.sourceCanonical); assert.equal(member.sourceRevision, fnv64(member.sourceCanonical));
  }
  assert.notEqual(bundle.members[0].sourceKey, bundle.members[1].sourceKey, 'per-object forks remain distinct');
  const selected = new Set(bundle.members.map(m => m.curveObjectId));
  assert.deepEqual(moved.direct!.objects.filter(o => !selected.has(o.id)), start.direct!.objects.filter(o => !selected.has(o.id)));
  for (const [key, text] of Object.entries(start.direct!.sources)) assert.equal(moved.direct!.sources[key], text);
  for (const t of [0, 0.5, 1]) {
    const p = bundle.members.map(m => evaluateCurve(curve(moved.direct!, m.curveObjectId), t));
    pointClose(p[1].map((v, k) => v - p[0][k]), [4, 0, 0]);
  }
  const smaller = moveRouteBundle(start, 'bundle1', [1, 0, 0], id), repeated = moveRouteBundle(start, 'bundle1', DELTA, id);
  assert.notDeepEqual(smaller, moved); assert.deepEqual(repeated, moved, 'each total delta starts from the frozen input');
  assert.deepEqual(start, before); assertRouteBundleDocument(moved);
});

test('PB0 decimal pole and anchor relationships keep the existing 1e-7 mm point boundary', () => {
  const { doc, input } = fixture(true, [0.1, 4.1]); input.anchorMM = [1, 0, 10];
  const linked = createRouteBundle(doc, input), before = structuredClone(linked);
  const moved = moveRouteBundle(linked, 'bundle1', [0.2, -0.3, 0.4], routeBundleDocumentIdentity(linked));
  for (const member of moved.routeBundles![0].members) {
    const pole = curve(moved.direct!, member.curveObjectId).controlPoints[1];
    pointClose(pole, moved.routeBundles![0].tie.anchorMM.map((v, k) => v + member.offsetMM[k]));
  }
  assert.deepEqual(linked, before);
});

test('PB0 zero total translation validates freshness and returns an independent unchanged copy', () => {
  const start = created(), before = structuredClone(start), id = routeBundleDocumentIdentity(start);
  const zero = moveRouteBundle(start, 'bundle1', [0, 0, 0], id);
  assert.deepEqual(zero, start); assert.notEqual(zero, start); assert.notEqual(zero.direct, start.direct);
  refused(() => moveRouteBundle(start, 'bundle1', [0, 0, 0], id + 'stale'));
  assert.deepEqual(start, before);
});

test('PB0 full JSON identity catches metadata and workflow edits outside selected model revision fields', () => {
  const start = created(), id = routeBundleDocumentIdentity(start), changed = structuredClone(start);
  changed.process = 'a different process';
  assert.notEqual(routeBundleDocumentIdentity(changed), id);
  refused(() => moveRouteBundle(changed, 'bundle1', DELTA, id));
  refused(() => detachRouteBundle(changed, 'bundle1', id));
  assert.equal(routeBundleDocumentIdentity(start), canonical(start));
  assert.equal(routeBundleDocumentIdentity(JSON.parse(JSON.stringify(start))), id);
});

test('PB0 create rejects duplicate or partial references and stale copied paths without rewriting inputs', () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => { f.input.members[1].id = f.input.members[0].id; },
    (f: ReturnType<typeof fixture>) => { f.input.members[1].curveObjectId = f.input.members[0].curveObjectId; },
    (f: ReturnType<typeof fixture>) => { f.input.members[1].sweepFeatureId = f.input.members[0].sweepFeatureId; },
    (f: ReturnType<typeof fixture>) => { f.input.members[1].profileFeatureId = 'missing'; },
    (f: ReturnType<typeof fixture>) => { f.input.members[1].handleKey = '0'; },
    (f: ReturnType<typeof fixture>) => { const n = f.doc.nodes[3]; assert.ok(n.kind === 'sweep-curve'); n.path.controlPoints[1][0] += 1; f.input.expectedDocumentIdentity = routeBundleDocumentIdentity(f.doc); },
  ]) {
    const f = fixture(); mutate(f); const doc = structuredClone(f.doc), input = structuredClone(f.input);
    refused(() => createRouteBundle(f.doc, f.input)); assert.deepEqual(f.doc, doc); assert.deepEqual(f.input, input);
  }
});

test('PB0 alias objects cannot tie the same source geometry twice', () => {
  const f = fixture(), first = f.doc.direct!.objects.find(o => o.id === f.input.members[0].curveObjectId)!;
  f.doc.direct!.objects.push({ ...first, id: 'alias' }); f.input.members[1].curveObjectId = 'alias';
  const node = f.doc.nodes[3]; assert.ok(node.kind === 'sweep-curve'); node.path = copiedPath(curve(f.doc.direct!, first.id));
  f.input.expectedDocumentIdentity = routeBundleDocumentIdentity(f.doc); const before = structuredClone(f.doc);
  refused(() => createRouteBundle(f.doc, f.input)); assert.deepEqual(f.doc, before);
});

test('PB0 shared profiles and holes, regions or separate reopen outlines refuse', () => {
  const shared = fixture(), second = shared.doc.nodes[3]; assert.ok(second.kind === 'sweep-curve');
  second.sketch = 0; shared.input.members[1].profileFeatureId = 'n0';
  shared.input.expectedDocumentIdentity = routeBundleDocumentIdentity(shared.doc);
  refused(() => createRouteBundle(shared.doc, shared.input));
  for (const field of ['holes', 'regions', 'outline']) {
    const f = fixture(), raw = JSON.parse(JSON.stringify(f.doc));
    raw.nodes[0][field] = field === 'outline' ? { closed: true, points: [[0, 0], [1, 0], [0, 1]] } : [[{ kind: 'line', start: [0, 0] }]];
    f.input.expectedDocumentIdentity = routeBundleDocumentIdentity(raw);
    const before = structuredClone(raw); refused(() => createRouteBundle(raw, f.input)); assert.deepEqual(raw, before);
  }
  const empty = fixture(), p = empty.doc.nodes[0]; assert.ok(p.kind === 'sketch'); p.holes = []; p.regions = [];
  empty.input.expectedDocumentIdentity = routeBundleDocumentIdentity(empty.doc);
  assertRouteBundleDocument(createRouteBundle(empty.doc, empty.input));
});

test('PB0 stored admission rejects version, sparse, nonfinite, stale and orphan metadata atomically', () => {
  const start = created();
  for (const mutate of [
    (d: StudioDoc) => { d.schema = 3; },
    (d: StudioDoc) => { d.routeBundles = []; },
    (d: StudioDoc) => { delete d.routeBundles; },
    (d: StudioDoc) => { d.routeBundles![0].tie.anchorMM[0] = NaN; },
    (d: StudioDoc) => { Reflect.deleteProperty(d.routeBundles![0].members, '1'); },
    (d: StudioDoc) => { d.routeBundles![0].members[0].sourceRevision = 'stale'; },
    (d: StudioDoc) => { d.routeBundles![0].members[0].sourceCanonical += ' '; },
    (d: StudioDoc) => { d.direct!.sources[d.routeBundles![0].members[0].sourceKey] += '\n'; },
    (d: StudioDoc) => { const n = d.nodes[1]; assert.ok(n.kind === 'sweep-curve'); n.routeBundleMember!.memberId = 'another'; },
    (d: StudioDoc) => { const n = d.nodes[3]; assert.ok(n.kind === 'sweep-curve'); delete n.routeBundleMember; },
  ]) {
    const bad = structuredClone(start); mutate(bad); const before = structuredClone(bad);
    refused(() => assertRouteBundleDocument(bad)); assert.deepEqual(bad, before); assert.deepEqual(start, created());
  }
  for (const value of [null, [], false, 0, '']) refused(() => assertRouteBundleDocument({ ...emptyDoc(), routeBundles: value }));
  for (const schema of [undefined, 0, 1, 2, 3]) assertRouteBundleDocument({ ...emptyDoc(), schema });
  const unknownVersion = JSON.parse(JSON.stringify(start)); unknownVersion.routeBundles[0].version = 2;
  refused(() => assertRouteBundleDocument(unknownVersion));
  const wrongMarkerKind = JSON.parse(JSON.stringify(start)); wrongMarkerKind.nodes[0].routeBundleMember = { bundleId: 'bundle1', memberId: 'memberA' };
  refused(() => assertRouteBundleDocument(wrongMarkerKind));
});

test('PB0 nested bundle children refuse; plain legacy children remain admitted', () => {
  const child = created(), legacy = emptyDoc();
  for (const doc of [
    { ...emptyDoc(), instances: [{ id: 'p', name: 'p', doc: child, position: [0, 0, 0], rotation: [0, 0, 0] }] },
    { ...emptyDoc(), pendingParts: { p: { doc: child, rev: 'r', name: 'p' } } },
    { ...emptyDoc(), schema: 4, instances: [{ doc: child }] },
  ]) refused(() => assertRouteBundleDocument(doc));
  assertRouteBundleDocument({ ...emptyDoc(), instances: [{ doc: legacy }], pendingParts: { p: { doc: legacy } } });
});

test('PB0 overflow or producer refusal preserves the accepted input', () => {
  const f = fixture(false, [0, 1e308]), start = createRouteBundle(f.doc, f.input), before = structuredClone(start);
  // Arithmetic for the second pole overflows. The native first edit may refuse
  // earlier; this test does not claim that an intermediate edit completed.
  refused(() => moveRouteBundle(start, 'bundle1', [1e308, 0, 0], routeBundleDocumentIdentity(start)));
  assert.deepEqual(start, before); assert.deepEqual(f.doc.direct, fixture(false, [0, 1e308]).doc.direct);
});

test('PB0 marked raw feature consumption and assembly flattening refuse without changing the input', () => {
  const doc = created(), before = structuredClone(doc);
  refused(() => featureOf(doc.nodes[1], 1, doc.nodes));
  refused(() => flattenAssembly(doc));
  assert.deepEqual(doc, before);
});

test('PB0 stale binding and missing selections require explicit re-selection, without repair inference', () => {
  const start = created();
  for (const mutate of [
    (d: StudioDoc) => { d.routeBundles![0].members[0].sourceRevision = 'stale'; },
    (d: StudioDoc) => { d.routeBundles![0].members[0].curveObjectId = 'missing'; },
    (d: StudioDoc) => { d.routeBundles![0].members[0].profileFeatureId = 'missing'; },
    (d: StudioDoc) => { const n = d.nodes[1]; assert.ok(n.kind === 'sweep-curve'); n.path.controlPoints[1][0] += 1; },
  ]) {
    const bad = structuredClone(start); mutate(bad); const before = structuredClone(bad);
    assert.throws(() => assertRouteBundleDocument(bad), /Reselect the current curve and copied sweep/);
    assert.deepEqual(bad, before);
  }
});

test('PB0 explicit detach preserves current copied geometry and removes the final schema4 requirement', () => {
  const start = created(), moved = moveRouteBundle(start, 'bundle1', DELTA, routeBundleDocumentIdentity(start)), before = structuredClone(moved);
  const detached = detachRouteBundle(moved, 'bundle1', routeBundleDocumentIdentity(moved));
  assert.equal(detached.schema, 3); assert.equal(Object.hasOwn(detached, 'routeBundles'), false);
  assert.deepEqual(detached.direct, moved.direct);
  for (const [i, node] of detached.nodes.entries()) {
    if (node.kind === 'sweep-curve') { const old = moved.nodes[i]; assert.ok(old.kind === 'sweep-curve'); assert.deepEqual(node.path, old.path); assert.equal(Object.hasOwn(node, 'routeBundleMember'), false); }
  }
  assertRouteBundleDocument(detached); assert.deepEqual(moved, before);
  const stale = structuredClone(moved); stale.routeBundles![0].members[0].sourceRevision = 'stale';
  refused(() => detachRouteBundle(stale, 'bundle1', canonical(stale)));
});

test('PB0 both copied sweeps feed real part conversion and native snapshots with fixed midpoint and radius oracles', () => {
  const start = created(), before = structuredClone(start), initial = partSnapshot(start), initialSaved = saveCadPart(initial);
  const moved = moveRouteBundle(start, 'bundle1', DELTA, routeBundleDocumentIdentity(start)), movedBefore = structuredClone(moved);
  const document = toPartDocument(moved), snapshot = partSnapshot(moved), snapshotSaved = saveCadPart(snapshot);
  assert.deepEqual(document.features.filter(f => f.kind === 'sweep-curve').map(f => f.id), ['n1', 'n3']);
  for (const [i, member] of moved.routeBundles![0].members.entries()) {
    const g = curve(moved.direct!, member.curveObjectId); pointClose(evaluateCurve(g, 0.5), MIDPOINTS[i]);
    const output = outputOf(snapshot, member.sweepFeatureId), report = checkBrep(output.brep);
    assert.equal(output.representation, 'planar'); assert.equal(output.bodyCount, 1); assert.equal(report.valid, true); assert.deepEqual(report.issues, []);
    assert.equal(output.brep.bodies[0].kind, 'solid'); assert.equal(output.brep.shells[0].closed, true);
    for (const [center, tangent] of [[g.controlPoints[0], [5, -3, 14]], [g.controlPoints[3], [0, 0, 1]]] as const) {
      const length = Math.hypot(...tangent), points = output.brep.vertices.map(v => v.point).filter(p => Math.abs(p.reduce((s, v, k) => s + (v - center[k]) * tangent[k], 0)) / length <= EPS);
      assert.ok(points.length >= 3);
      for (const p of points) assert.ok(Math.abs(Math.hypot(...p.map((v, k) => v - center[k])) - 0.5) <= EPS);
    }
  }
  const bad = structuredClone(moved), profile = bad.nodes[2]; assert.ok(profile.kind === 'sketch' && profile.profile === 'circle'); profile.radius = 0;
  // The second profile is rejected at admission, before a native failure. The
  // already produced native snapshots remain untouched; no native-failure claim.
  const badBefore = structuredClone(bad); refused(() => toPartDocument(bad));
  assert.deepEqual(bad, badBefore); assert.equal(saveCadPart(snapshot), snapshotSaved); assert.equal(saveCadPart(initial), initialSaved);
  assert.deepEqual(start, before); assert.deepEqual(moved, movedBefore);
  // No volume/mass, cable physics, global self-intersection or manufacturing tolerance claim.
});
