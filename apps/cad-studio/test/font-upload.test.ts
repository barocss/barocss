import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dropBlobs, evictBlobs, getBlob } from '@barocss/cad-model/engine/blobs';
import { isTrueTypeError } from '@barocss/cad-model/engine/font/trueType';
import { FontUpload, type FontFile } from '../src/app/fontUpload';

function original(): ArrayBuffer { return Uint8Array.from(readFileSync(resolve(process.cwd(), 'test/fixtures/fonts/abeezee/ABeeZee-Regular.ttf'))).buffer; }
function deferredFile(name: string) {
  const buffer = original();
  let resolveRead!: (value: ArrayBuffer) => void, rejectRead!: (error: Error) => void;
  const pending = new Promise<ArrayBuffer>((resolve, reject) => { resolveRead = resolve; rejectRead = reject; });
  const file: FontFile = { name, size: buffer.byteLength, arrayBuffer: () => pending };
  return { file, finish: () => resolveRead(buffer), fail: () => rejectRead(new Error('old read failed')) };
}

test('a newer font upload wins even when the older read finishes later', async () => {
  const upload = new FontUpload(), session = {}, first = deferredFile('first.ttf'), second = deferredFile('second.ttf');
  const older = upload.load(session, first.file), newer = upload.load(session, second.file);
  second.finish(); const source = await newer;
  try {
    assert.ok(source); assert.equal(source.filename, 'second.ttf');
    first.finish(); assert.equal(await older, null);
    // An active HUD is not a document root. Its font remains pinned across both sweeps.
    evictBlobs([]); evictBlobs([]); assert.ok(getBlob(source.blob));
    upload.sync(null); evictBlobs([]); assert.equal(getBlob(source.blob), undefined);
  } finally { upload.sync(null); if (source) dropBlobs([source.blob]); }
});
test('Cancel and a different command session suppress stale reads and stale errors', async () => {
  const upload = new FontUpload(), canceled = deferredFile('canceled.ttf'), failed = deferredFile('failed.ttf');
  const first = upload.load({}, canceled.file); upload.sync(null); canceled.finish(); assert.equal(await first, null);
  const second = upload.load({}, failed.file); upload.sync({}); failed.fail(); assert.equal(await second, null);
});
test('current font errors remain visible and an oversized file is refused before its read', async () => {
  const upload = new FontUpload(), session = {};
  let reads = 0;
  const large: FontFile = { name: 'large.ttf', size: 8 * 1024 * 1024 + 1, arrayBuffer: async () => { reads++; return new ArrayBuffer(0); } };
  await assert.rejects(upload.load(session, large), error => isTrueTypeError(error) && error.code === 'TTF_BUDGET');
  assert.equal(reads, 0);
  const invalid: FontFile = { name: 'bad.ttf', size: 0, arrayBuffer: async () => new ArrayBuffer(0) };
  await assert.rejects(upload.load(session, invalid), error => isTrueTypeError(error) && error.code === 'TTF_MALFORMED');
  upload.sync(null);
});
