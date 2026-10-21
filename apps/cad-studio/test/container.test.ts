import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { meshInMM, readMeshFile } from '@barocss/cad-model/engine/meshImport';
import { blobRefs, blobsAsBase64, blobsFromBase64, getBlob, inlineMeshes, meshNodeBlobs, putKnownBlob, sha256 } from '@barocss/cad-model/engine/blobs';
import { decodeStudioFile, encodeStudioFile, isContainer, readStudioFile } from '../src/engine/container';
import { WireReceiver, WireSender } from '@barocss/cad-model/engine/wireDoc';

// M1 (R3.3): mesh arrays as blobs named by SHA-256; the .bcad container; plain JSON when there are none.
const block = () => meshInMM(readMeshFile('block-cm.stl', new Uint8Array(readFileSync(join(process.cwd(), 'test/fixtures/block-cm.stl')))), 'cm');
const summary = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.hint); return r.bodies.map(b => ({ key: b.key, volume: b.volumeMM3, faces: b.mesh.faces.map(f => f.name) })); };

test('an old file (inline arrays) and the same part as blobs in the container: the same bodies, volumes and names', async () => {
  const m = block();
  // The fixture pair: inline (as files before M1 wrote it) → blobs → container → read back.
  const inline = withNode(emptyDoc(), { kind: 'mesh', name: 'block', unit: 'cm', positions: m.positions, indices: m.indices, representation: 'facets' });
  const text = JSON.stringify(inline, null, 2), old = await readStudioFile(new TextEncoder().encode(text));
  assert.ok('doc' in old, JSON.stringify(old));
  assert.equal(encodeStudioFile(old.doc)[0], 0x7b, 'no blobs: saved as plain JSON, as before');
  const node = await meshNodeBlobs({ kind: 'mesh' as const, name: 'block', unit: 'cm', representation: 'facets' as const }, m.positions, m.indices);
  const asBlobs = withNode(emptyDoc(), node);
  // (An STL's positions at their own precision: single, D45.)
  assert.equal(node.blob.positions, await sha256(Float32Array.from(m.positions)));
  assert.ok(getBlob(node.blob.positions) instanceof Float32Array);
  const bytes = encodeStudioFile(asBlobs);
  assert.ok(isContainer(bytes));
  const back = await readStudioFile(bytes);
  assert.ok('doc' in back, JSON.stringify(back));
  assert.deepEqual(summary(back.doc), summary(old.doc));
  assert.ok(Math.abs(summary(back.doc)[0].volume! - 7000) < 1e-6);
  // The document names its blobs; written inline again (templates), it is the old file's part.
  assert.deepEqual([...blobRefs(back.doc)].sort(), [node.blob.positions, node.blob.indices].sort());
  assert.deepEqual(summary(inlineMeshes(back.doc)!), summary(old.doc));
});

test('the container: blobs deduplicated (two nodes, one mesh), checked against their hash, a missing one refused, a newer version refused', async () => {
  const m = block();
  const a = await meshNodeBlobs({ kind: 'mesh' as const, name: 'a', unit: 'cm', representation: 'facets' as const }, m.positions, m.indices);
  const b = await meshNodeBlobs({ kind: 'mesh' as const, name: 'b', unit: 'cm', representation: 'facets' as const }, m.positions, m.indices);
  assert.deepEqual(a.blob, b.blob, 'the same arrays, the same blobs');
  const doc = withNode(withNode(emptyDoc(), a), { ...b });
  const bytes = encodeStudioFile(doc), { blobs } = await decodeStudioFile(bytes);
  assert.equal(blobs, 2, 'positions and indices once each');
  // A flipped byte in a blob: refused, the file is damaged.
  const bad = bytes.slice(); bad[bad.length - 9] ^= 0xff;
  const r = await readStudioFile(bad);
  assert.ok('error' in r && /does not match its hash/.test(r.error), JSON.stringify(r));
  // A document naming a blob nobody has: refused when opened; not saved either.
  const ghost = withNode(emptyDoc(), { kind: 'mesh', name: 'g', unit: 'mm', blob: { positions: 'f'.repeat(64), indices: 'e'.repeat(64) } });
  const missing = await readStudioFile(new TextEncoder().encode(JSON.stringify(ghost)));
  assert.ok('error' in missing && /does not hold/.test(missing.error));
  assert.throws(() => encodeStudioFile(ghost), /not loaded/);
  // A container from a newer studio: refused, saying so.
  const newer = bytes.slice(); new DataView(newer.buffer).setUint32(8, 9, true);
  const n = await readStudioFile(newer);
  assert.ok('error' in n && /newer cad-studio/.test(n.error));
  // Cut short: refused.
  assert.ok('error' in await readStudioFile(bytes.slice(0, bytes.length - 100)));
});

test('blobs cross to the worker once, and to the chat server as base64 (checked)', async () => {
  const m = block();
  const node = await meshNodeBlobs({ kind: 'mesh' as const, name: 'block', unit: 'cm', representation: 'facets' as const }, m.positions, m.indices);
  const doc = withNode(emptyDoc(), node), sender = new WireSender(), receiver = new WireReceiver();
  const first = sender.pack(doc), again = sender.pack(doc);
  assert.equal(first.blobs?.length, 2); assert.equal(again.blobs, undefined, 'sent once');
  receiver.unpack(first);
  // Over JSON: the same bytes back, refused when altered.
  const wire = blobsAsBase64(doc), bad = { ...wire, [node.blob.indices]: { ...wire[node.blob.indices], base64: wire[node.blob.positions].base64 } };
  assert.deepEqual(await blobsFromBase64(wire), []);
  assert.deepEqual(await blobsFromBase64(bad), [node.blob.indices]);
  putKnownBlob('x', new Uint32Array(1));
  assert.ok(getBlob(node.blob.positions) instanceof Float32Array);
});

test('fixture pair: block-inline.bcad (inline arrays, as before M1) and block-container.bcad (blobs) open as the same part', async () => {
  const read = async (name: string) => { const r = await readStudioFile(new Uint8Array(readFileSync(join(process.cwd(), 'test/fixtures', name)))); assert.ok('doc' in r, JSON.stringify(r)); return r.doc; };
  const inline = await read('block-inline.bcad'), packed = await read('block-container.bcad');
  assert.ok(!isContainer(new Uint8Array(readFileSync(join(process.cwd(), 'test/fixtures/block-inline.bcad')))));
  assert.ok(isContainer(new Uint8Array(readFileSync(join(process.cwd(), 'test/fixtures/block-container.bcad')))));
  assert.deepEqual(summary(packed), summary(inline));
  assert.ok(Math.abs(summary(packed)[0].volume! - 7000) < 1e-6);
});
