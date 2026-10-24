import test from 'node:test';
import assert from 'node:assert/strict';
import { readNativeSIInertia } from '@barocss/cad/internal/native-si-mass';
import { rectanglePart, cylinderPart, emptyDoc, placedBase, placedDoc, type PartInstance } from '../src/engine/doc';
import { deferMasses, evaluatePart, evaluatePlaced, forgetSnapshots, massOfRef, nativeMassPropertiesOfBody, placedMassFields, placeBody, type BodyResult } from '../src/engine/evaluate';
import { nativeMassEnvelope, nativeSIOfBody, receiveNativeMass, receiveNativeMassPatch, matchesNativeMassPatch, type NativeMassSource } from '../src/engine/nativeMassWire';
import { placementOf } from '../src/engine/placement';
import { nativeLinkInertia } from '../src/robot/nativeInertia';
import { MATERIALS } from '../src/library/materials';
import { linkInertia } from '../src/robot/inertia';

const source: NativeMassSource = { epoch: 1, requestId: 17, revision: 8, slot: 'part:read' };
const bodyOf = (doc = rectanglePart(13, 23, 7)) => { const r = evaluatePart(doc, source.revision); assert.ok(r.ok); return r.bodies[0]; };
const frame = { origin: [0, 0, 0] as [number, number, number], R: [1, 0, 0, 0, 1, 0, 0, 0, 1] as [number, number, number, number, number, number, number, number, number] };
const publicMass = (b: BodyResult) => JSON.stringify([b.volume, b.mass, b.centroid, b.inertia]);

test('eager structuredClone binds only the exact source/body/fields; public MMGS and default JSON inertia stay identical', () => {
  const doc = rectanglePart(13, 23, 7), body = bodyOf(doc), before = publicMass(body);
  const envelope = nativeMassEnvelope(source, body), clone = structuredClone(body);
  assert.doesNotThrow(() => JSON.stringify(envelope), 'only JSON data types; structuredClone retains signed zero');
  assert.deepEqual(structuredClone(envelope), envelope);
  assert.equal(nativeSIOfBody(clone).ok, false, 'a source-less clone is not promoted');
  const ordinary = linkInertia('base', 'base', doc, [clone], frame);
  assert.ok(receiveNativeMass(clone, structuredClone(envelope), source));
  assert.deepEqual(nativeSIOfBody(clone), nativeSIOfBody(body));
  const steel = MATERIALS.find(m => m.gPerCm3 > 7)!;
  const raw = nativeSIOfBody(clone); assert.ok(raw.ok);
  const materialDoc = { ...doc, bodies: { [clone.key]: { material: steel.id } } };
  const withMaterial = nativeLinkInertia('base', 'base', materialDoc, [clone], frame);
  assert.deepEqual(withMaterial.inertia.inertia, raw.inertia.flat().map(x => x * (steel.gPerCm3 / raw.density) + 0), 'one density ratio after transfer');
  assert.equal(publicMass(clone), before);
  assert.deepEqual(linkInertia('base', 'base', doc, [clone], frame), ordinary);
  assert.deepEqual(nativeLinkInertia('base', 'base', doc, [clone], frame).basis, [{ link: 'base', body: clone.key, mode: 'raw-native-si' }]);
  for (const patch of [{ epoch: 2 }, { requestId: 18 }, { revision: 9 }, { slot: 'placed' }]) assert.equal(receiveNativeMass(structuredClone(body), envelope, { ...source, ...patch }), false);
  for (const patch of [{ key: 'another-body' }, { mass: body.mass! + 1 }, { volume: body.volume! + 1 }, { centroid: [0, 0, 0] as [number, number, number] }, { inertia: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] }]) assert.equal(receiveNativeMass({ ...structuredClone(body), ...patch }, envelope, source), false);
});

test('placed tensors retain raw SI in the exact legacy R I R-transpose order, across repeated placements and clones', () => {
  const body = bodyOf(), props = nativeMassPropertiesOfBody(body); assert.ok(props);
  const raw = readNativeSIInertia(props); assert.ok(raw.ok);
  const rotations = [[.8, -.6, 0, .6, .8, 0, 0, 0, 1], [1, 0, 0, 0, .6, -.8, 0, .8, .6]];
  let expected = raw.inertia.map(r => [...r]), placed = body;
  for (const m of rotations) {
    const next = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => { let v = 0; for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) v += m[i * 3 + k] * expected[k][l] * m[j * 3 + l]; return v; }));
    expected = next;
    placed = placeBody(placed, m, [10, -2, 7]);
  }
  const result = nativeSIOfBody(placed); assert.ok(result.ok); assert.deepEqual(result.inertia, expected);
  const cloned = structuredClone(placed); assert.ok(receiveNativeMass(cloned, structuredClone(nativeMassEnvelope(source, placed)), source));
  assert.deepEqual(nativeSIOfBody(cloned), result);
  cloned.inertia![0][0] += 1; assert.equal(nativeSIOfBody(cloned).ok, false, 'mutated public tensors lose their attachment');
});

test('deferred placed patches require body identity, current epoch/request/revision/ref and unchanged public signatures', () => {
  const doc = cylinderPart(4, 15), inst: PartInstance = { id: 'i', name: 'i', doc, position: [11, 22, 33], rotation: [17, 29, 41] };
  const root = { ...emptyDoc(), instances: [inst] };
  forgetSnapshots(); deferMasses(true);
  let body: BodyResult;
  try { const r = evaluatePlaced(placedDoc(inst, root), placedBase(inst, root), placementOf(inst), source.revision); assert.ok(r.ok); body = r.bodies[0]; } finally { deferMasses(false); }
  assert.ok(body.massRef !== undefined); const ref = body.massRef;
  const clone = structuredClone(body), pending = structuredClone(nativeMassEnvelope(source, body));
  assert.ok(receiveNativeMass(clone, pending, source));
  const fields = massOfRef(ref)!; assert.ok(fields.inertia);
  const envelope = structuredClone(nativeMassEnvelope(source, fields, ref)), patch = structuredClone(fields);
  assert.equal(matchesNativeMassPatch(clone, patch), false, 'source-less patch cannot alter the body');
  assert.ok(receiveNativeMassPatch(patch, ref, envelope, source));
  assert.ok(matchesNativeMassPatch(clone, patch));
  assert.equal(matchesNativeMassPatch(structuredClone(clone), patch), false, 'an unrelated body clone has no pending source');
  for (const delta of [{ epoch: 2 }, { requestId: 99 }, { revision: 99 }, { slot: 'other' }]) assert.equal(receiveNativeMassPatch(structuredClone(fields), ref, envelope, { ...source, ...delta }), false);
  assert.equal(receiveNativeMassPatch(structuredClone(fields), ref + 1, envelope, source), false);
  const applied = { ...clone, ...placedMassFields(patch, clone.massPlace!) };
  assert.deepEqual(nativeSIOfBody(applied), nativeSIOfBody(massOfRef(ref, body.massPlace)!));
  assert.deepEqual([applied.volume, applied.mass, applied.centroid, applied.inertia], [fields.volume, fields.mass, massOfRef(ref, body.massPlace)!.centroid, massOfRef(ref, body.massPlace)!.inertia]);
  clone.massPlace![0].t[0] += 1; assert.equal(matchesNativeMassPatch(clone, patch), false);
});

test('malformed, missing and non-JSON provenance never binds; explicit Kernel unavailable remains unavailable', () => {
  const body = bodyOf(), envelope = nativeMassEnvelope(source, body); assert.equal(envelope.kind, 'ready');
  if (envelope.kind !== 'ready') return;
  const bad: unknown[] = [null, {}, { ...envelope, kind: 'unknown' }, { ...envelope, signature: 'wrong' }, { ...envelope, basis: { result: { ok: true }, rotations: [] } }, { ...envelope, extra: undefined }, { ...envelope, extra: () => 1 }, { ...envelope, extra: new Float64Array([1]) }];
  for (const density of [0, -1, Infinity, NaN]) bad.push({ ...envelope, basis: { result: { ok: true, density, inertia: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] }, rotations: [] } });
  for (const value of bad) assert.equal(receiveNativeMass(structuredClone(body), value, source), false);
  const invalidFields = { ...structuredClone(body), mass: NaN };
  assert.equal(receiveNativeMass(invalidFields, nativeMassEnvelope(source, invalidFields), source), false);
  const unsupported = structuredClone(body), unavailable = nativeMassEnvelope(source, unsupported);
  assert.ok(receiveNativeMass(unsupported, unavailable, source));
  assert.equal(nativeSIOfBody(unsupported).ok, false);
});
