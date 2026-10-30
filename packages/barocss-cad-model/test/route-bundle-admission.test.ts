import test from 'node:test';
import assert from 'node:assert/strict';
import { carryOver, emptyDoc, prefixDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { emptyDirect, geometryOf, importSource } from '../src/engine/direct';
import { assertRouteBundleDocument, createRouteBundle, detachRouteBundle, routeBundleDocumentIdentity } from '../src/engine/routeBundle';
import { SCHEMA, readStudioDoc } from '../src/engine/migrate';
import { decodeStudioFile, encodeStudioFile, isContainer, readStudioFile } from '../src/engine/container';
import { meshNodeBlobs } from '../src/engine/blobs';
import { isRefusal } from '../src/engine/refusal';
import { captureOp, effectOf, mergeTurn, type TurnPatch } from '../src/chat/merge';
import type { Evaluate } from '../src/chat/tools';
import { featureId, nextSerial } from '../src/engine/ids';
import { revisionOf } from '../src/util/revision';

// Source declarations only until the coordinator runs the affected contract file.
// Old-reader refusal is a separate frozen-source control-flow observation, not an old-reader runtime result.
const SOURCE = `@model bundle {
  version: 0;
  length-unit: mm;
  @curve #A { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[-2,0,0],[-2,0,10],[-2,0,20],[-2,0,30]]; weights: [1,1,1,1]; }
  @curve #B { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[2,0,0],[2,0,10],[2,0,20],[2,0,30]]; weights: [1,1,1,1]; }
}`;
function copiedDocument(): StudioDoc {
  const direct = importSource(emptyDirect(), SOURCE, 'bundle');
  assert.equal(direct.objects.length, 2);
  let doc: StudioDoc = { ...emptyDoc(), direct };
  for (const [i, object] of direct.objects.entries()) {
    const curve = geometryOf(direct, object);
    assert.ok(curve.kind === 'curve');
    doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [i ? 2 : -2, 0], radius: 0.5 });
    doc = withNode(doc, { kind: 'sweep-curve', sketch: 2 * i, name: object.name, path: {
      degree: curve.degree, knots: [...curve.knots], controlPoints: curve.controlPoints.map((p): [number, number, number] => [p[0], p[1], p[2]]), weights: [...curve.weights],
    } });
  }
  return doc;
}
function bundledDocument(doc: StudioDoc = copiedDocument()): StudioDoc {
  assert.ok(doc.direct);
  return createRouteBundle(doc, {
    id: 'bundle1', tieId: 'tie1', anchorMM: [0, 0, 10], expectedDocumentIdentity: routeBundleDocumentIdentity(doc),
    members: [
      { id: 'A', curveObjectId: doc.direct.objects[0].id, handleKey: '1', sweepFeatureId: 'n1', profileFeatureId: 'n0' },
      { id: 'B', curveObjectId: doc.direct.objects[1].id, handleKey: '1', sweepFeatureId: 'n3', profileFeatureId: 'n2' },
    ],
  });
}
const refused = (run: () => unknown) => assert.throws(run, cause => isRefusal(cause, 'BAD_REFERENCE'));
function readError(doc: unknown): string {
  const read = readStudioDoc(JSON.stringify(doc));
  assert.ok('error' in read, 'the input must not be silently admitted');
  return read.error;
}

test('route bundle admission: legacy export target stays 3 and plain JSON preserves copied sweeps', async () => {
  const doc = copiedDocument(), before = structuredClone(doc);
  assert.equal(SCHEMA, 3);
  const bytes = encodeStudioFile(doc);
  assert.equal(isContainer(bytes), false);
  const back = await readStudioFile(bytes);
  assert.ok('doc' in back);
  assert.equal(back.doc.schema, 3);
  assert.equal(Object.hasOwn(back.doc, 'routeBundles'), false);
  assert.deepEqual(back.doc.direct, doc.direct);
  assert.deepEqual(back.doc.nodes, doc.nodes);
  assert.deepEqual(doc, before);
});

test('route bundle admission: a missing or older schema is refused, not migrated', () => {
  const old = rectanglePart(10, 10, 5);
  Reflect.deleteProperty(old, 'schema');
  const read = readStudioDoc(JSON.stringify(old));
  assert.ok('error' in read);
  assert.match(read.error, /older form \(no schema\)/);
  const two = rectanglePart(10, 10, 5);
  two.schema = 2 as never;
  const refused = readStudioDoc(JSON.stringify(two));
  assert.ok('error' in refused);
  assert.match(refused.error, /older form \(schema 2\)/);
});

test('route bundle admission: explicit schema-4 JSON roundtrip retains recipe, markers, source and copied paths', async () => {
  const doc = bundledDocument(), before = structuredClone(doc);
  assert.equal(doc.schema, 4);
  const bytes = encodeStudioFile(doc);
  assert.equal(isContainer(bytes), false);
  const read = await readStudioFile(bytes);
  assert.ok('doc' in read);
  assert.equal(read.doc.schema, 4);
  assert.deepEqual(read.doc.routeBundles, doc.routeBundles);
  assert.deepEqual(read.doc.nodes, doc.nodes);
  assert.deepEqual(read.doc.direct, doc.direct);
  assert.deepEqual(doc, before);
});

test('route bundle admission: BCADPACK remains version 1 while its document carries schema 3 or 4', async () => {
  const mesh = await meshNodeBlobs({ kind: 'mesh', name: 'Stored triangles', unit: 'mm', representation: 'facets' } as const,
    [0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
  for (const source of [copiedDocument(), bundledDocument()]) {
    const doc = withNode(source, mesh), bytes = encodeStudioFile(doc);
    assert.equal(isContainer(bytes), true);
    assert.equal(new TextDecoder().decode(bytes.subarray(0, 8)), 'BCADPACK');
    assert.equal(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, true), 1);
    const decoded = await decodeStudioFile(bytes);
    assert.equal(JSON.parse(decoded.text).schema, source.schema);
    const back = await readStudioFile(bytes);
    assert.ok('doc' in back);
    assert.equal(back.doc.schema, source.schema);
    assert.deepEqual(back.doc.routeBundles, source.routeBundles);
    assert.deepEqual(back.doc.nodes, doc.nodes);
  }
});

test('route bundle admission: any own recipe field at schema 3 refuses before encoding, including undefined', () => {
  for (const value of [undefined, null, [], false, {}]) {
    const doc = copiedDocument(); Object.defineProperty(doc, 'routeBundles', { value, enumerable: true });
    const before = structuredClone(doc);
    refused(() => assertRouteBundleDocument(doc));
    refused(() => encodeStudioFile(doc));
    assert.deepEqual(doc, before);
    // JSON erases an undefined own field, so its object admission is intentionally tested above.
    if (value !== undefined) assert.match(readError(doc), /BAD_REFERENCE/);
  }
});

test('route bundle admission: schema 4 needs a nonempty valid supported root recipe', () => {
  const malformed: Array<(doc: StudioDoc) => void> = [
    doc => { Reflect.deleteProperty(doc, 'routeBundles'); },
    doc => { Object.assign(doc, { routeBundles: null }); },
    doc => { doc.routeBundles = []; },
    doc => { Object.assign(doc.routeBundles![0], { version: 2 }); },
    doc => { Object.assign(doc.routeBundles![0], { kind: 'unknown-bundle' }); },
    doc => { doc.routeBundles![0].members[1].id = doc.routeBundles![0].members[0].id; },
    doc => { doc.routeBundles![0].members[0].sourceCanonical += 'stale'; },
    doc => { doc.routeBundles![0].members[0].offsetMM[1] = Infinity; },
  ];
  for (const mutate of malformed) {
    const doc = bundledDocument(); mutate(doc); const before = structuredClone(doc);
    refused(() => assertRouteBundleDocument(doc));
    refused(() => encodeStudioFile(doc));
    assert.match(readError(doc), /BAD_REFERENCE/);
    assert.deepEqual(doc, before);
  }
});

test('route bundle admission: an orphan sweep marker cannot launder a legacy copied path into a bundle', () => {
  for (const schema of [3, 4] as const) {
    const doc = copiedDocument(); doc.schema = schema;
    const node = doc.nodes[1]; assert.ok(node.kind === 'sweep-curve');
    node.routeBundleMember = { bundleId: 'missing', memberId: 'A' };
    refused(() => assertRouteBundleDocument(doc));
    refused(() => encodeStudioFile(doc));
    assert.match(readError(doc), /BAD_REFERENCE/);
  }
});

test('route bundle admission: raw missing stable IDs refuse before withIds can assign replacements', () => {
  const doc = bundledDocument(); Reflect.deleteProperty(doc.nodes[0], 'id');
  assert.match(readError(doc), /BAD_REFERENCE/);
});

test('route bundle admission: instance and pending child bundles refuse even when hidden or nested', () => {
  const child = bundledDocument();
  const instance = (doc: StudioDoc) => ({ id: 'p1', name: 'Stored child', doc, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], hidden: true });
  const middle = { ...emptyDoc(), instances: [instance(child)] };
  const inputs: StudioDoc[] = [
    { ...emptyDoc(), instances: [instance(child)] },
    { ...emptyDoc(), pendingParts: { pending: { doc: child, rev: 'pending', name: 'Waiting child' } } },
    { ...emptyDoc(), instances: [instance(middle)] },
    { ...emptyDoc(), pendingParts: { pending: { doc: middle, rev: 'pending', name: 'Waiting assembly' } } },
  ];
  for (const doc of inputs) {
    const before = structuredClone(doc);
    refused(() => assertRouteBundleDocument(doc));
    refused(() => encodeStudioFile(doc));
    assert.match(readError(doc), /BAD_REFERENCE/);
    assert.deepEqual(doc, before);
  }
  const legacy = { ...emptyDoc(), instances: [instance(copiedDocument())] };
  assert.doesNotThrow(() => assertRouteBundleDocument(legacy));
  assert.doesNotThrow(() => encodeStudioFile(legacy));
});

test('route bundle admission: nested schema 4 or marker alone refuses without requiring a valid child bundle', () => {
  for (const child of [Object.assign(copiedDocument(), { schema: 4 }), copiedDocument()]) {
    if (child.schema === 3) {
      const node = child.nodes[1]; assert.ok(node.kind === 'sweep-curve');
      node.routeBundleMember = { bundleId: 'orphan', memberId: 'A' };
    }
    const doc: StudioDoc = { ...emptyDoc(), pendingParts: { p: { doc: child, rev: 'p', name: 'Nested input' } } };
    refused(() => assertRouteBundleDocument(doc)); refused(() => encodeStudioFile(doc));
    assert.match(readError(doc), /BAD_REFERENCE/);
  }
});

test('route bundle admission: full-length prefix retains bundle while genuine rollback refuses', () => {
  const doc = bundledDocument(), before = structuredClone(doc);
  assert.deepEqual(prefixDoc(doc, doc.nodes.length).routeBundles, doc.routeBundles);
  assert.deepEqual(prefixDoc(doc, doc.nodes.length + 1).routeBundles, doc.routeBundles);
  refused(() => prefixDoc(doc, doc.nodes.length - 1));
  const orphan = copiedDocument(), node = orphan.nodes[1]; assert.ok(node.kind === 'sweep-curve');
  node.routeBundleMember = { bundleId: 'missing', memberId: 'A' };
  refused(() => prefixDoc(orphan, orphan.nodes.length - 1));
  const legacy = copiedDocument();
  assert.equal(prefixDoc(legacy, 2).nodes.length, 2);
  assert.deepEqual(doc, before);
});

test('route bundle admission: explicit Detach yields a legacy snapshot candidate without changing the accepted input', async () => {
  const doc = bundledDocument(), before = structuredClone(doc);
  const detached = detachRouteBundle(doc, 'bundle1', routeBundleDocumentIdentity(doc));
  assert.equal(detached.schema, 3);
  assert.equal(Object.hasOwn(detached, 'routeBundles'), false);
  assert.deepEqual(detached.direct, doc.direct);
  for (const [i, node] of detached.nodes.entries()) {
    assert.equal(Object.hasOwn(node, 'routeBundleMember'), false);
    const expected = structuredClone(doc.nodes[i]); Reflect.deleteProperty(expected, 'routeBundleMember');
    assert.deepEqual(node, expected);
  }
  const read = await readStudioFile(encodeStudioFile(detached));
  assert.ok('doc' in read); assert.equal(read.doc.schema, 3);
  assert.deepEqual(read.doc.nodes, detached.nodes);
  assert.deepEqual(doc, before);
  refused(() => detachRouteBundle(doc, 'bundle1', 'stale-document'));
  assert.deepEqual(doc, before, 'a refused candidate cannot consume or mutate the accepted document');
  // No Undo stack is fabricated here: the caller must evaluate and install this entire candidate once.
});

test('route bundle admission: a future document schema stays a newer-reader refusal', () => {
  assert.match(readError({ ...emptyDoc(), schema: 5 }), /newer cad-studio \(schema 5; this one reads up to 4\)/);
});

test('route bundle admission: carryOver retains a valid current recipe and marked sweeps together', () => {
  const was = copiedDocument(), doc = bundledDocument(was), before = structuredClone(doc);
  // A command result based on the legacy snapshot carries the current marked nodes but not workflow fields.
  // The field registry must carry the current schema and recipe; this is not an Undo implementation.
  const next: StudioDoc = { ...was, nodes: doc.nodes.map(node => structuredClone(node)), outputs: { ...doc.outputs } };
  const carried = carryOver(next, was, doc);
  assert.equal(carried.schema, 4);
  assert.deepEqual(carried.routeBundles, doc.routeBundles);
  assert.deepEqual(carried.nodes, doc.nodes);
  assert.doesNotThrow(() => assertRouteBundleDocument(carried));
  assert.deepEqual(doc, before);
});

test('route bundle admission: legacy carryOver never invents a recipe or sweep marker', () => {
  const was = copiedDocument(), doc = { ...was, bodies: { b1: { name: 'Current look' } } };
  const next: StudioDoc = { ...was, nodes: was.nodes.map(node => structuredClone(node)) };
  const carried = carryOver(next, was, doc);
  assert.equal(carried.schema, 3);
  assert.equal(Object.hasOwn(carried, 'routeBundles'), false);
  assert.ok(carried.nodes.every(node => !Object.hasOwn(node, 'routeBundleMember')));
  assert.equal(carried.bodies?.b1?.name, 'Current look');
  assert.doesNotThrow(() => assertRouteBundleDocument(carried));
});

function emptyPatch(doc: StudioDoc): TurnPatch {
  return { id: 'route-admission-turn', by: { agent: 'contract-test' }, base: revisionOf(doc), nextId: nextSerial(doc), ops: [] };
}
function carrierPatch(doc: StudioDoc, fields: Record<string, unknown> = {}): TurnPatch {
  const patch = emptyPatch(doc), effect = effectOf(doc, doc);
  effect.fields = fields;
  patch.ops.push({ tool: 'edit_feature', args: { index: 1, values: {} }, order: doc.nodes.map((_, i) => featureId(doc.nodes, i)), made: [], effect });
  return patch;
}

test('route bundle admission: chat merge rejects a valid linked base or current document before evaluation or deferAll', async () => {
  const legacy = copiedDocument(), linked = bundledDocument(legacy);
  let calls = 0;
  const evaluate: Evaluate = async () => { calls++; return { ok: true, revision: 0, bodies: [], wallTime: 0 }; };
  for (const [base, now] of [[linked, legacy], [legacy, linked]]) for (const deferAll of [undefined, 'The user is still editing']) {
    const beforeBase = structuredClone(base), beforeNow = structuredClone(now);
    await assert.rejects(mergeTurn(base, now, emptyPatch(base), evaluate, { deferAll }), cause => isRefusal(cause, 'BAD_REFERENCE'));
    assert.equal(calls, 0, 'unsupported merge must not evaluate copied geometry');
    assert.deepEqual(base, beforeBase); assert.deepEqual(now, beforeNow);
  }
});

test('route bundle admission: patch-only recipe, version and child carriers refuse before deferred proposal creation', async () => {
  const base = copiedDocument(), linked = bundledDocument(base);
  const child = { id: 'p1', name: 'Linked child', doc: linked, position: [0, 0, 0], rotation: [0, 0, 0], hidden: true };
  const carriers: Record<string, unknown>[] = [
    { routeBundles: undefined }, { routeBundles: null }, { routeBundles: [] },
    { routeBundles: linked.routeBundles },
    { schema: 4, routeBundles: linked.routeBundles },
    { instances: [child] },
    { pendingParts: { pending: { doc: linked, rev: 'pending', name: 'Waiting linked child' } } },
  ];
  let calls = 0;
  const evaluate: Evaluate = async () => { calls++; return { ok: true, revision: 0, bodies: [], wallTime: 0 }; };
  for (const fields of carriers) for (const deferAll of [undefined, 'Do not run these ops yet']) {
    const patch = carrierPatch(base, fields), before = structuredClone(patch), accepted = structuredClone(base);
    await assert.rejects(mergeTurn(base, base, patch, evaluate, { deferAll }), cause => isRefusal(cause, 'BAD_REFERENCE'));
    assert.equal(calls, 0);
    assert.deepEqual(patch, before); assert.deepEqual(base, accepted);
  }
});

test('route bundle admission: added and changed orphan sweep markers cannot bypass chat merge via deferAll', async () => {
  const base = copiedDocument(), marked = structuredClone(base.nodes[1]);
  assert.ok(marked.kind === 'sweep-curve');
  marked.routeBundleMember = { bundleId: 'unadmitted', memberId: 'A' };
  let calls = 0;
  const evaluate: Evaluate = async () => { calls++; return { ok: true, revision: 0, bodies: [], wallTime: 0 }; };
  for (const kind of ['added', 'changed']) for (const deferAll of [undefined, 'Keep pending']) {
    const patch = carrierPatch(base);
    if (kind === 'added') patch.ops[0].effect.added.push({ id: 'n9', after: 'n3', node: marked });
    else patch.ops[0].effect.changed.push({ id: 'n1', node: marked });
    const before = structuredClone(patch);
    await assert.rejects(mergeTurn(base, base, patch, evaluate, { deferAll }), cause => isRefusal(cause, 'BAD_REFERENCE'));
    assert.equal(calls, 0); assert.deepEqual(patch, before);
  }
});

test('route bundle admission: plain legacy no-op chat merge still evaluates and keeps recipe fields absent', async () => {
  const base = rectanglePart(10, 10, 5), before = structuredClone(base);
  let calls = 0;
  // This stub tests merge admission and call order only; it is not native geometry evidence.
  const evaluate: Evaluate = async () => { calls++; return { ok: true, revision: 0, bodies: [], wallTime: 0 }; };
  const result = await mergeTurn(base, base, emptyPatch(base), evaluate);
  assert.ok(calls > 0);
  assert.equal(result.doc.schema, 3);
  assert.equal(Object.hasOwn(result.doc, 'routeBundles'), false);
  assert.deepEqual(result.doc.nodes, base.nodes);
  assert.deepEqual(result.applied, []); assert.deepEqual(result.deferred, []); assert.equal(result.proposal, null);
  assert.deepEqual(base, before);
});

test('route bundle admission: plain legacy deferAll preserves its existing unevaluated proposal path', async () => {
  const base = rectanglePart(10, 10, 5), next = structuredClone(base);
  const extrude = next.nodes[1]; assert.ok(extrude.kind === 'extrude'); extrude.height = 9;
  const patch = emptyPatch(base);
  patch.ops.push(captureOp(base, next, 'edit_feature', { index: 1, values: { h: 9 } }));
  let calls = 0;
  const evaluate: Evaluate = async () => { calls++; return { ok: true, revision: 0, bodies: [], wallTime: 0 }; };
  const result = await mergeTurn(base, base, patch, evaluate, { deferAll: 'The user is still editing' });
  assert.equal(calls, 0);
  assert.deepEqual(result.applied, []);
  assert.equal(result.deferred.length, 1);
  assert.equal(result.deferred[0].code, 'TURN_STILL_EDITING');
  assert.ok(result.proposal);
  assert.ok(result.doc.proposals?.some(proposal => proposal.id === result.proposal));
  assert.equal(result.doc.schema, 3);
  assert.equal(Object.hasOwn(result.doc, 'routeBundles'), false);
  assert.deepEqual(result.doc.nodes, base.nodes);
});
