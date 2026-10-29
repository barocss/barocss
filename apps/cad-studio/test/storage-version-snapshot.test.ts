import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { encodeStudioSnapshot, readStudioSnapshot, encodeStudioFile, isContainer, decodeStudioFile } from '@barocss/cad-model/engine/container';
import { canonical } from '@barocss/cad-model/util/revision';
import { checkVersions, makeVersions, makeVersion, readVersion, snapshotKeyOf } from '@barocss/cad-model/versions/log';
import { meshNodeBlobs } from '@barocss/cad-model/engine/blobs';
import { emptyDirect, importSource, geometryOf } from '@barocss/cad-model/engine/direct';
import { createRouteBundle, routeBundleDocumentIdentity } from '@barocss/cad-model/engine/routeBundle';
import { defaultDrawing } from '@barocss/cad-model/drawing/types';
import { memoryStore } from '../src/storage/memoryStore';
import { readVersions, writeVersions, snapshotPath, versionsPath, writePart, readPart, writeAutosave, readAutosave } from '../src/storage/project';

test('project versions preserve an admitted snapshot with omitted nextId under its original canonical key', async () => {
  const doc = emptyDoc(); delete doc.nextId;
  const original = canonical(doc), log = makeVersions(doc, { at: '2026-10-29T00:00:00.000Z', name: 'Original' });
  const version = log.versions[0], key = version.snapshot;
  const control = await readStudioSnapshot(encodeStudioSnapshot(doc, key), key);
  assert.ok('doc' in control, JSON.stringify(control));
  assert.equal(canonical(control.doc), original, 'the existing dedicated codec admits and preserves this raw document');
  const store = memoryStore('Canonical versions');
  await writeVersions(store, 'part.bcad', log);
  const restored = await readVersions(store, 'part.bcad');
  assert.ok(restored && 'log' in restored, JSON.stringify(restored));
  assert.deepEqual(checkVersions(restored.log), []);
  const saved = readVersion(restored.log, version.id);
  assert.equal(Object.hasOwn(saved, 'nextId'), false);
  assert.equal(snapshotKeyOf(saved), key);
  assert.equal(canonical(saved), original);
  assert.equal(canonical(log.snapshots[key]), original, 'saving and reading do not mutate the source snapshot');
});

// Reuses the admitted two-curve route authoring path. No geometry evaluation is needed for snapshot persistence.
function routeDocument(): StudioDoc {
  const direct = importSource(emptyDirect(), `@model bundle { version: 0; length-unit: mm;
    @curve #A { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[-2,0,0],[-2,0,10],[-2,0,20],[-2,0,30]]; weights: [1,1,1,1]; }
    @curve #B { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[2,0,0],[2,0,10],[2,0,20],[2,0,30]]; weights: [1,1,1,1]; }
  }`, 'bundle');
  let doc: StudioDoc = { ...emptyDoc(), direct };
  for (let i = 0; i < direct.objects.length; i++) {
    const object = direct.objects[i], curve = geometryOf(direct, object);
    assert.equal(curve.kind, 'curve');
    if (curve.kind !== 'curve') throw new Error('Expected route curve');
    doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [i ? 2 : -2, 0], radius: 0.5 });
    doc = withNode(doc, { kind: 'sweep-curve', sketch: 2 * i, name: object.name, path: { degree: curve.degree, knots: [...curve.knots], controlPoints: curve.controlPoints.map(copyPoint), weights: [...curve.weights] } });
  }
  return createRouteBundle(doc, { id: 'bundle', tieId: 'tie', anchorMM: [0, 0, 10], expectedDocumentIdentity: routeBundleDocumentIdentity(doc), members: [
    { id: 'A', curveObjectId: direct.objects[0].id, handleKey: '1', sweepFeatureId: 'n1', profileFeatureId: 'n0' },
    { id: 'B', curveObjectId: direct.objects[1].id, handleKey: '1', sweepFeatureId: 'n3', profileFeatureId: 'n2' },
  ] });
}
function copyPoint(point: readonly number[]): [number, number, number] { return [point[0], point[1], point[2]]; }
function optionalDocument(base: StudioDoc): StudioDoc {
  const doc: StudioDoc = {
    ...base, parameters: { Zero: 0 }, instances: [], underlays: [], configurations: {},
    drawing: { ...defaultDrawing(), frames: [{ id: 'F', view: 'top', place: [0, 0], characteristic: 'flatness', value: 0.1, datums: [], freeState: false, tangentPlane: false }] },
  };
  delete doc.nextId;
  return doc;
}

for (const schema of [3, 4] as const) {
  test(`project versions: schema${schema} raw optional fields, original identifiers and binary mesh survive`, async t => {
    const mesh = await meshNodeBlobs({ kind: 'mesh', name: '', unit: 'mm', bought: false, representation: 'facets' } as const,
      [0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
    const doc = optionalDocument(withNode(schema === 4 ? routeDocument() : emptyDoc(), mesh));
    const original = canonical(doc), log = makeVersions(doc, { at: '2026-10-29T00:00:00.000Z' });
    const store = memoryStore('Binary snapshots'), version = log.versions[0], key = version.snapshot;
    const receipt = await writeVersions(store, 'mesh.bcad', log), path = snapshotPath(key);
    const raw = await store.read(path); assert.ok(raw); assert.ok(isContainer(raw.bytes));
    const rawCopy = raw.bytes.slice(), decoded = await decodeStudioFile(raw.bytes);
    assert.equal(decoded.blobs, 2);
    const restored = await readVersions(store, 'mesh.bcad'); assert.ok(restored && 'log' in restored, JSON.stringify(restored));
    assert.deepEqual(checkVersions(restored.log), []);
    const saved = readVersion(restored.log, version.id);
    assert.equal(canonical(saved), original);
    assert.equal(snapshotKeyOf(saved), key);
    assert.deepEqual(restored.log.versions, log.versions, 'original IDs, parents, revisions and keys stay unchanged');
    assert.deepEqual(restored.log.branches, log.branches);
    assert.equal(Object.hasOwn(saved, 'nextId'), false);
    assert.equal(saved.schema, schema);
    assert.equal(saved.nodes.at(-1)!.bought, false);
    assert.equal(saved.parameters.Zero, 0);
    const savedMesh = saved.nodes.at(-1)!; assert.ok(savedMesh.kind === 'mesh');
    assert.equal(savedMesh.name, '');
    assert.deepEqual(saved.instances, []);
    assert.deepEqual(saved.drawing!.frames![0].datums, []);
    assert.equal(saved.drawing!.frames![0].freeState, false);
    assert.equal(saved.drawing!.frames![0].tangentPlane, false);
    const reencoded = encodeStudioSnapshot(saved, key);
    // Observation for this fixture only; the codec contract is canonical content, not original file bytes.
    t.diagnostic(`schema${schema} fixture re-encoded bytes equal: ${Buffer.from(reencoded).equals(Buffer.from(rawCopy))}`);
    assert.deepEqual((await store.read(path))!.bytes, rawCopy, 'reading never rewrites stored bytes');
    const nextDoc = { ...doc, parameters: { Zero: 0, Added: 1 } };
    const next = makeVersion(restored.log, nextDoc, { at: '2026-10-29T00:01:00.000Z' }).log;
    await writeVersions(store, 'mesh.bcad', next, { expect: receipt.tag });
    assert.equal((await store.read(path))!.tag, raw.tag, 'existing snapshot is never written again');
    assert.deepEqual((await store.read(path))!.bytes, rawCopy);
    const after = await readVersions(store, 'mesh.bcad'); assert.ok(after && 'log' in after, JSON.stringify(after));
    assert.equal(canonical(readVersion(after.log, version.id)), original);
    assert.equal(canonical(readVersion(after.log, next.versions[1].id)), canonical(nextDoc));
    assert.equal(canonical(doc), original, 'source snapshot remains unchanged');
  });
}

test('project versions retain missing-snapshot refusal and refuse a different document stored under an original key', async () => {
  const doc = optionalDocument(emptyDoc()), log = makeVersions(doc, { at: '2026-10-29T00:00:00.000Z' });
  const store = memoryStore('Refusals'), key = log.versions[0].snapshot;
  await writeVersions(store, 'part.bcad', log);
  const metadata = await store.read(versionsPath('part.bcad')); assert.ok(metadata);
  await store.remove(snapshotPath(key));
  const absent = await readVersions(store, 'part.bcad'); assert.ok(absent && 'error' in absent); assert.match(absent.error, /VERSION_LOG/);
  await store.write(snapshotPath(key), encodeStudioFile({ ...doc, parameters: { Wrong: 1 } }));
  const wrong = await readVersions(store, 'part.bcad'); assert.ok(wrong && 'error' in wrong); assert.match(wrong.error, /VERSION_LOG.*canonical content key/);
  assert.deepEqual(await store.read(versionsPath('part.bcad')), metadata, 'failed reads preserve version metadata');
  // New snapshots with a mismatched declared key fail before publishing a log that references them.
  const bad = { ...log, snapshots: { wrong: doc } };
  await assert.rejects(writeVersions(store, 'new.bcad', bad), /VERSION_LOG.*canonical content key/);
  assert.equal(await store.read(versionsPath('new.bcad')), null);
  assert.equal(await store.read(snapshotPath('wrong')), null);
});

test('ordinary part and autosave Open still normalize omitted nextId while version snapshot remains raw', async () => {
  const doc = emptyDoc(); delete doc.nextId;
  const store = memoryStore('Ordinary Open');
  await writePart(store, 'part.bcad', doc);
  const ordinary = await readPart(store, 'part.bcad'); assert.ok('doc' in ordinary);
  assert.equal(ordinary.doc.nextId, 0);
  await writeAutosave(store, 'part.bcad', { ...doc, parameters: { Changed: 1 } });
  const autosave = await readAutosave(store, 'part.bcad'); assert.ok(autosave && 'doc' in autosave);
  assert.equal(autosave.doc.nextId, 0);
  assert.equal(Object.hasOwn(doc, 'nextId'), false);
});
