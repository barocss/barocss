import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyDoc, withNode } from '../src/engine/doc';
import { arrayOf, blobTypeOf, blobsAsBase64, blobsFromBase64, collectRecoveryBlobs, dropBlobs, getBlob, loadRecoveryBlobs, putBlob, saveRecoveryBlobs, setBlobStore, type BlobArray, type BlobStore, type BlobType } from '../src/engine/blobs';
import { decodeStudioFile, encodeStudioFile, isContainer } from '../src/engine/container';
import { isRefusal } from '../src/engine/refusal';
import { WireReceiver, WireSender } from '../src/engine/wireDoc';

// Transport-level fixtures only. Font asset references do not exist in the document yet.
// A synthetic mesh-reference carrier reaches a blob through the current collector; none
// of these carrier documents is evaluated or claimed to be a valid CAD mesh or font feature.
function carrier(hash: string) {
  return withNode(emptyDoc(), { kind: 'mesh', name: 'blob-codec-carrier', unit: 'mm', representation: 'facets', blob: { positions: hash, indices: hash } });
}
function oddBytes(): Uint8Array { return Uint8Array.of(0, 1, 127, 128, 255); }
function storedBytes(hash: string, expected: Uint8Array): Uint8Array {
  const stored = getBlob(hash);
  assert.ok(stored instanceof Uint8Array, 'a newly decoded u8 chunk retains its byte-array type');
  assert.deepEqual(stored, expected);
  return stored;
}
interface Chunk {
  header: { kind?: string; sha256?: string; dtype?: string; count?: number };
  headerAt: number;
  headerLength: number;
  payloadAt: number;
  payloadLength: number;
}
function chunks(bytes: Uint8Array): Chunk[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out: Chunk[] = [];
  let at = 16;
  for (let i = 0; i < view.getUint32(12, true); i++) {
    const headerLength = view.getUint32(at, true), payloadLength = view.getUint32(at + 4, true), headerAt = at + 8;
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(headerAt, headerAt + headerLength))) as Chunk['header'];
    const payloadAt = headerAt + Math.ceil(headerLength / 8) * 8;
    out.push({ header, headerAt, headerLength, payloadAt, payloadLength });
    at = payloadAt + Math.ceil(payloadLength / 8) * 8;
  }
  return out;
}
function changedHeader(bytes: Uint8Array, frame: Chunk, changes: Record<string, unknown>): Uint8Array {
  const out = bytes.slice(), header = new TextEncoder().encode(JSON.stringify({ ...frame.header, ...changes }));
  assert.equal(Math.ceil(header.length / 8), Math.ceil(frame.headerLength / 8), 'the authored corruption keeps the payload position fixed');
  new DataView(out.buffer).setUint32(frame.headerAt - 8, header.length, true);
  out.set(header, frame.headerAt); return out;
}

test('u8 blob type and factory preserve an odd-length byte view without adjacent buffer data', async () => {
  const surrounding = Uint8Array.of(91, 0, 1, 127, 128, 255, 90), source = surrounding.subarray(1, 6);
  assert.equal(blobTypeOf(source), 'u8');
  const own = new Uint8Array(source), made = arrayOf('u8', own.buffer);
  assert.ok(made instanceof Uint8Array); assert.deepEqual(made, oddBytes());
  const hash = await putBlob(source);
  try {
    const wire = blobsAsBase64(emptyDoc(), [hash]);
    assert.equal(wire[hash].dtype, 'u8'); assert.equal(wire[hash].base64, Buffer.from(oddBytes()).toString('base64'));
  } finally { dropBlobs([hash]); }
});
test('BCADPACK carries the original TTF bytes as a u8 chunk without a container version change', async () => {
  const original = new Uint8Array(readFileSync(resolve(import.meta.dirname, '../../../apps/cad-studio/test/fixtures/fonts/abeezee/ABeeZee-Regular.ttf')));
  const hash = await putBlob(original);
  try {
    const doc = carrier(hash), encoded = encodeStudioFile(doc), frame = chunks(encoded).find(chunk => chunk.header.kind === 'blob');
    assert.ok(isContainer(encoded)); assert.equal(new DataView(encoded.buffer).getUint32(8, true), 1);
    assert.ok(frame); assert.equal(frame.header.dtype, 'u8'); assert.equal(frame.header.count, original.length);
    assert.equal(frame.payloadLength, original.length);
    assert.deepEqual(encoded.subarray(frame.payloadAt, frame.payloadAt + frame.payloadLength), original);
    dropBlobs([hash]);
    const decoded = await decodeStudioFile(encoded);
    assert.equal(decoded.text, JSON.stringify(doc)); assert.equal(decoded.blobs, 1);
    const restored = storedBytes(hash, original);
    encoded.fill(0);
    assert.deepEqual(restored, original, 'decoded bytes own their buffer rather than retaining the file view');
  } finally { dropBlobs([hash]); }
});
test('odd u8 payloads survive container alignment and offset input views; malformed chunks are refused', async () => {
  const original = oddBytes(), hash = await putBlob(original);
  try {
    const encoded = encodeStudioFile(carrier(hash)), frame = chunks(encoded).find(chunk => chunk.header.kind === 'blob');
    assert.ok(frame); assert.equal(frame.payloadLength, 5); assert.equal(frame.payloadAt % 8, 0);
    const surrounding = new Uint8Array(encoded.length + 6); surrounding.set(encoded, 3);
    dropBlobs([hash]);
    assert.equal((await decodeStudioFile(surrounding.subarray(3, 3 + encoded.length))).blobs, 1);
    storedBytes(hash, original);
    const badCount = changedHeader(encoded, frame, { count: 6 }), stringCount = changedHeader(encoded, frame, { count: '5' }), badType = changedHeader(encoded, frame, { dtype: 'u7' });
    const badPayload = encoded.slice(); badPayload[frame.payloadAt + 2] ^= 0x80;
    for (const bad of [badCount, stringCount, badType, badPayload]) {
      await assert.rejects(() => decodeStudioFile(bad), error => isRefusal(error) && error.code === 'CONTAINER_DAMAGED');
    }
  } finally { dropBlobs([hash]); }
});
test('u8 base64 preserves every byte and rejects altered payload bytes under the original hash', async () => {
  const original = oddBytes(), hash = await putBlob(original);
  try {
    const wire = blobsAsBase64(emptyDoc(), [hash]);
    dropBlobs([hash]);
    assert.deepEqual(await blobsFromBase64(wire), []); storedBytes(hash, original);
    const changed = original.slice(); changed[3] ^= 0x80;
    dropBlobs([hash]);
    assert.deepEqual(await blobsFromBase64({ [hash]: { dtype: 'u8', base64: Buffer.from(changed).toString('base64') } }), [hash]);
    assert.equal(getBlob(hash), undefined);
  } finally { dropBlobs([hash]); }
});
test('the existing worker wire retains u8 type through structured clone and sends it only once', async () => {
  const original = oddBytes(), hash = await putBlob(original);
  try {
    const doc = carrier(hash), sender = new WireSender(), receiver = new WireReceiver(), first = sender.pack(doc), cloned = structuredClone(first);
    const copied = cloned.blobs?.find(([key]) => key === hash)?.[1];
    assert.ok(copied instanceof Uint8Array); assert.deepEqual(copied, original);
    assert.notEqual(copied.buffer, original.buffer);
    copied[0] = 91; assert.equal(original[0], 0); copied[0] = 0;
    assert.equal(original.byteLength, 5, 'the current postMessage path copies without a transfer list');
    dropBlobs([hash]);
    assert.deepEqual(receiver.unpack(cloned).nodes, doc.nodes); storedBytes(hash, original);
    assert.equal(sender.pack(doc).blobs, undefined);
  } finally { dropBlobs([hash]); }
});

class MemoryBlobStore implements BlobStore {
  readonly entries = new Map<string, { type: BlobType; data: BlobArray }>();
  async keys(): Promise<Set<string>> { return new Set(this.entries.keys()); }
  async get(hashes: readonly string[]): Promise<Map<string, { type: BlobType; data: BlobArray }>> {
    const out = new Map<string, { type: BlobType; data: BlobArray }>();
    for (const hash of hashes) { const entry = this.entries.get(hash); if (entry) out.set(hash, structuredClone(entry)); }
    return out;
  }
  async put(entries: readonly { hash: string; type: BlobType; data: BlobArray }[]): Promise<boolean> {
    for (const entry of entries) this.entries.set(entry.hash, { type: entry.type, data: structuredClone(entry.data) });
    return true;
  }
  async delete(hashes: readonly string[]): Promise<void> { for (const hash of hashes) this.entries.delete(hash); }
}
test('the existing recovery BlobStore interface saves and reloads u8 metadata and bytes', async () => {
  const original = oddBytes(), hash = await putBlob(original), doc = carrier(hash), recovery = new MemoryBlobStore();
  try {
    setBlobStore(recovery);
    assert.equal(await saveRecoveryBlobs(doc), true);
    const kept = recovery.entries.get(hash);
    assert.ok(kept); assert.equal(kept.type, 'u8'); assert.ok(kept.data instanceof Uint8Array); assert.deepEqual(kept.data, original);
    dropBlobs([hash]);
    assert.deepEqual(await loadRecoveryBlobs(doc), []); storedBytes(hash, original);
    await collectRecoveryBlobs(null); assert.equal(recovery.entries.size, 0);
  } finally { setBlobStore(null); dropBlobs([hash]); }
});
