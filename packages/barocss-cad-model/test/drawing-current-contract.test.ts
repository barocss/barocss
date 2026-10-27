import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { readDrawing } from '../src/drawing/types';
import { readFrames, checkSavedDrawingFrames, type DrawingFrame } from '../src/drawing/controls';
import { encodeStudioFile, readStudioFile, encodeStudioSnapshot, readStudioSnapshot } from '../src/engine/container';
import { emptyDirect, geometryOf, importSource } from '../src/engine/direct';
import { createRouteBundle, detachRouteBundle, routeBundleDocumentIdentity, assertRouteBundleDocument } from '../src/engine/routeBundle';
import { isRefusal } from '../src/engine/refusal';
import { canonical, revisionOf } from '../src/util/revision';
import { mergeDocs, applyMerge } from '../src/versions/merge';
import { makeVersions, makeVersion, makeBranch, applyBranch, readVersion, snapshotKeyOf, checkVersions, idOf } from '../src/versions/log';

// Source authority: Model433a035ae03a61e55b0e03b6a9b9897083774800 plus Drawing47c2abe01800fae1ec44d60c85062674e8a20f14.
// Reuses the single-argument checkSavedDrawingFrames(rawDrawing).
// Current supported drawing fields use ordinary schema3 or actual-route schema4.
// These are file/data/version fixtures, not geometry execution or browser acceptance.
const frames = (): DrawingFrame[] => [
  { id: 'placed', view: 'top', place: [12, -8], characteristic: 'flatness', value: 0.1, datums: [], freeState: true },
  { id: 'attached', dim: 'd1', characteristic: 'position', value: 0.25, datums: ['A', 'B'], diameter: true,
    material: 'maximum', datumModifiers: { A: 'maximum' }, projected: 4, tangentPlane: true,
    composite: { value: 0.15, datums: ['A'], diameter: false, material: 'least', datumModifiers: { A: 'least' } } },
];
const drawingDocument = (): StudioDoc => ({ ...emptyDoc(), drawing: { frames: frames() } });
const textBytes = (doc: unknown) => new TextEncoder().encode(JSON.stringify(doc));
const at = (n: number) => `2026-10-27T01:0${n}:00.000Z`;

function routeDocument(): StudioDoc {
  const source = `@model bundle { version: 0; length-unit: mm;
    @curve #A { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[-2,0,0],[-2,0,10],[-2,0,20],[-2,0,30]]; weights: [1,1,1,1]; }
    @curve #B { type: nurbs; degree: 3; knots: [0,0,0,0,1,1,1,1]; control-points: [[2,0,0],[2,0,10],[2,0,20],[2,0,30]]; weights: [1,1,1,1]; }
  }`;
  const direct = importSource(emptyDirect(), source, 'bundle');
  let doc: StudioDoc = { ...emptyDoc(), direct };
  for (const [i, object] of direct.objects.entries()) {
    const curve = geometryOf(direct, object); assert.equal(curve.kind, 'curve');
    if (curve.kind !== 'curve') throw new Error('expected curve');
    doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [i ? 2 : -2, 0], radius: 0.5 });
    doc = withNode(doc, { kind: 'sweep-curve', sketch: 2 * i, name: object.name, path: { degree: curve.degree, knots: [...curve.knots], controlPoints: curve.controlPoints.map(p => [p[0], p[1], p[2]] as [number, number, number]), weights: [...curve.weights] } });
  }
  doc = { ...doc, drawing: { frames: frames() } };
  return createRouteBundle(doc, { id: 'bundle1', tieId: 'tie1', anchorMM: [0, 0, 10], expectedDocumentIdentity: routeBundleDocumentIdentity(doc), members: [
    { id: 'A', curveObjectId: direct.objects[0].id, handleKey: '1', sweepFeatureId: 'n1', profileFeatureId: 'n0' },
    { id: 'B', curveObjectId: direct.objects[1].id, handleKey: '1', sweepFeatureId: 'n3', profileFeatureId: 'n2' },
  ] });
}


test('current drawing contract: public file writer and readers preserve supported standalone and composite frame information in schema3', async () => {
  const input = drawingDocument(), before = structuredClone(input), file = encodeStudioFile(input), bytes = file.slice();
  assert.equal(input.schema, 3); assert.deepEqual(checkSavedDrawingFrames(input.drawing), []);
  const opened = await readStudioFile(file); assert.ok('doc' in opened, JSON.stringify(opened));
  assert.equal(opened.doc.schema, 3); assert.equal(canonical(opened.doc), canonical(input));
  assert.deepEqual(opened.doc.drawing?.frames, before.drawing?.frames);
  assert.deepEqual(readFrames(opened.doc.drawing?.frames), frames());
  assert.deepEqual(readDrawing(opened.doc.drawing).frames, frames());
  assert.deepEqual(input, before); assert.deepEqual(file, bytes);
  const raw = JSON.parse(new TextDecoder().decode(file)) as StudioDoc;
  assert.equal(raw.schema, 3); assert.deepEqual(raw.drawing?.frames, frames());
});

test('current drawing contract: malformed new frame data refuses before normalization can discard it', async () => {
  const badFrames: unknown[] = [
    { ...frames()[0], place: [1] },
    { ...frames()[1], composite: null },
    { ...frames()[1], composite: { value: 0.15, datums: ['A'], unknown: true } },
  ];
  for (const frame of badFrames) {
    const doc = { ...emptyDoc(), drawing: { frames: [frame] } } as unknown as StudioDoc, before = structuredClone(doc);
    assert.ok(checkSavedDrawingFrames(doc.drawing).some(problem => problem.code === 'DRAWING_OPTIONS'));
    assert.throws(() => encodeStudioFile(doc), e => isRefusal(e, 'DRAWING_OPTIONS'));
    assert.ok('error' in await readStudioFile(textBytes(doc)));
    assert.deepEqual(doc, before);
  }
  // A new-format object in place of the frames array must not normalize to an empty drawing.
  for (const frame of [{ ...frames()[0] }, { composite: null }]) {
    const doc = { ...emptyDoc(), drawing: { frames: frame } } as unknown as StudioDoc;
    assert.ok(checkSavedDrawingFrames(doc.drawing).some(problem => problem.code === 'DRAWING_OPTIONS'));
    assert.throws(() => encodeStudioFile(doc), e => isRefusal(e, 'DRAWING_OPTIONS'));
    assert.ok('error' in await readStudioFile(textBytes(doc)));
  }
});

test('current drawing contract: actual route selects schema4 and authored detach selects schema3 without changing frame data or snapshots', () => {
  const base = emptyDoc(), ours = { ...base, parameters: { Ours: 1 } }, route = routeDocument();
  assert.equal(route.schema, 4); assert.doesNotThrow(() => assertRouteBundleDocument(route));
  const inputs = [base, ours, route].map(canonical), direct = mergeDocs(base, ours, route);
  assert.ok('doc' in direct, JSON.stringify(direct)); assert.equal(direct.doc.schema, 4);
  assert.deepEqual(direct.doc.drawing?.frames, frames()); assert.deepEqual(direct.doc.routeBundles, route.routeBundles);
  let log = makeBranch(makeVersions(base, { at: at(0) }), 'other');
  const o = makeVersion(log, ours, { at: at(1) }); log = applyBranch(o.log, 'other', ours).log;
  const t = makeVersion(log, route, { at: at(2) }); log = applyBranch(t.log, 'main', route).log;
  const before = structuredClone(log), merged = applyMerge(log, { from: 'other', working: ours, at: at(3) });
  assert.ok('doc' in merged, JSON.stringify(merged)); assert.ok(merged.version); assert.equal(merged.fastForward, false);
  assert.equal(merged.doc.schema, 4); assert.deepEqual(merged.doc.drawing?.frames, frames());
  assert.deepEqual(merged.version.parents, [o.version.id, t.version.id]);
  assert.equal(merged.version.snapshot, snapshotKeyOf(merged.doc)); assert.equal(idOf(merged.version), merged.version.id);
  assert.deepEqual(checkVersions(merged.log), []); assert.deepEqual(log, before);
  for (const [key, snapshot] of Object.entries(before.snapshots)) assert.equal(canonical(merged.log.snapshots[key]), canonical(snapshot));
  assert.deepEqual(merged.log.versions.slice(0, before.versions.length), before.versions);
  const detached = detachRouteBundle(route, 'bundle1', routeBundleDocumentIdentity(route));
  assert.equal(detached.schema, 3); assert.equal(detached.routeBundles, undefined); assert.deepEqual(detached.drawing?.frames, frames());
  const changed = { ...route, parameters: { ...route.parameters, Ours: 1 } }, result = mergeDocs(route, changed, detached);
  assert.ok('doc' in result, JSON.stringify(result)); assert.equal(result.doc.schema, 3); assert.deepEqual(result.doc.drawing?.frames, frames());
  assert.deepEqual([base, ours, route].map(canonical), inputs);
  const invalid = { ...route, schema: 3 } as StudioDoc;
  assert.throws(() => mergeDocs(base, ours, invalid), e => isRefusal(e, 'BAD_REFERENCE'));
});

test('current drawing contract: file bytes and existing snapshot identities survive codec and version operations', async () => {
  for (const doc of [drawingDocument(), routeDocument()]) {
    const before = structuredClone(doc), bytes = textBytes(doc), original = bytes.slice(), key = snapshotKeyOf(doc);
    const read = await readStudioFile(bytes); assert.ok('doc' in read, JSON.stringify(read));
    assert.equal(canonical(read.doc), canonical(doc)); assert.equal(snapshotKeyOf(read.doc), key);
    const encoded = encodeStudioFile(read.doc), reopened = await readStudioFile(encoded);
    assert.ok('doc' in reopened, JSON.stringify(reopened)); assert.equal(canonical(reopened.doc), canonical(doc));
    assert.equal(snapshotKeyOf(reopened.doc), key);
    // New minimal snapshot API: authenticate the original key and keep every raw document field.
    const raw = await readStudioSnapshot(bytes, key); assert.ok('doc' in raw, JSON.stringify(raw));
    assert.deepEqual(raw.doc, doc); assert.equal(snapshotKeyOf(raw.doc), key); assert.equal(raw.doc.schema, doc.schema);
    const archive = encodeStudioSnapshot(raw.doc, key), restored = await readStudioSnapshot(archive, key);
    assert.ok('doc' in restored, JSON.stringify(restored)); assert.deepEqual(restored.doc, doc);
    assert.equal(snapshotKeyOf(restored.doc), key);
    assert.throws(() => encodeStudioSnapshot(raw.doc, 'wrong-key'), e => isRefusal(e, 'VERSION_LOG'));
    const wrong = await readStudioSnapshot(bytes, 'wrong-key');
    assert.ok('error' in wrong, JSON.stringify(wrong)); assert.match(wrong.error, /^\[VERSION_LOG\]/);
    const log = makeVersions(doc, { at: at(0) }), logBefore = structuredClone(log), version = log.versions[0];
    assert.equal(version.snapshot, key); assert.equal(idOf(version), version.id); assert.deepEqual(version.parents, []);
    const snapshot = readVersion(log, version.id);
    assert.equal(canonical(snapshot), canonical(doc)); assert.equal(revisionOf(snapshot), version.revision);
    assert.deepEqual(checkVersions(log), []); assert.deepEqual(log, logBefore);
    // The existing version validator detects content changed under an old key; never overwrite that snapshot.
    const altered = structuredClone(log);
    altered.snapshots[key] = { ...altered.snapshots[key], parameters: { ...altered.snapshots[key].parameters, Changed: 1 } };
    assert.ok(checkVersions(altered).some(problem => problem.code === 'VERSION_LOG'));
    assert.deepEqual(log, logBefore); assert.deepEqual(doc, before); assert.deepEqual(bytes, original);
  }
});
