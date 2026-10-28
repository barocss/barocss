import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dropBlobs, getBlob, putKnownBlob, sha256 } from '../src/engine/blobs';
import { fontFromBytes, fontSourceError, isFontSourceError, readFontSource, type FontSource } from '../src/engine/font/source';
import { isTrueTypeError } from '../src/engine/font/trueType';

function original(): Uint8Array { return new Uint8Array(readFileSync(resolve(import.meta.dirname, '../../../apps/cad-studio/test/fixtures/fonts/abeezee/ABeeZee-Regular.ttf'))); }
function originalLicense(): string { return readFileSync(resolve(import.meta.dirname, '../../../apps/cad-studio/test/fixtures/fonts/abeezee/OFL.txt'), 'utf8'); }

test('font import snapshots before its first await and preserves authored source and license text', async () => {
  const bytes = original(), expected = bytes.slice(), metadata = { filename: 'font-n5.ttf', source: 'https://example.test/n5', license: originalLicense() };
  const pending = fontFromBytes(bytes, metadata);
  bytes.fill(0); metadata.filename = 'changed.ttf';
  const source = await pending;
  try {
    assert.equal(source.filename, 'font-n5.ttf'); assert.equal(source.source, 'https://example.test/n5');
    assert.equal(source.license, originalLicense()); assert.equal(fontSourceError(source), null); assert.ok(Object.isFrozen(source));
    assert.equal(source.blob, await sha256(expected));
    const font = readFontSource(source); assert.deepEqual(font.copyBytes(), expected); assert.equal(font.metrics.glyphCount, 268);
    font.copyBytes().fill(0); assert.deepEqual(readFontSource(source).copyBytes(), expected);
  } finally { dropBlobs([source.blob]); }
});
test('font bytes remain readable when byte deduplication retained a different array class', async () => {
  const bytes = original(), hash = await sha256(bytes);
  dropBlobs([hash]); putKnownBlob(hash, new Uint32Array(bytes.slice().buffer));
  try {
    const source = await fontFromBytes(bytes, { filename: 'ABeeZee-Regular.ttf' });
    assert.ok(getBlob(hash) instanceof Uint32Array); assert.equal(source.blob, hash);
    assert.deepEqual(readFontSource(source).copyBytes(), bytes);
  } finally { dropBlobs([hash]); }
});
test('font source rejects absent bytes, forged content, and malformed descriptors explicitly', async () => {
  const bytes = original(), hash = await sha256(bytes), source: FontSource = { blob: hash, filename: 'font.ttf' };
  dropBlobs([hash]);
  assert.throws(() => readFontSource(source), error => isFontSourceError(error) && error.code === 'FONT_SOURCE_MISSING');
  putKnownBlob(hash, Uint8Array.of(1, 2, 3));
  try { await assert.rejects(fontFromBytes(bytes, { filename: 'font.ttf' }), error => isFontSourceError(error) && error.code === 'FONT_SOURCE_CONFLICT'); }
  finally { dropBlobs([hash]); }
  const detached = new Uint8Array(16); putKnownBlob(hash, detached);
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  try {
    assert.throws(() => readFontSource(source), error => isFontSourceError(error) && error.code === 'FONT_SOURCE_INPUT');
    await assert.rejects(fontFromBytes(bytes, { filename: 'font.ttf' }), error => isFontSourceError(error) && error.code === 'FONT_SOURCE_CONFLICT');
  } finally { dropBlobs([hash]); }
  for (const value of [null, [], { ...source, blob: hash.toUpperCase() }, { ...source, filename: '' }, { ...source, filename: 'a'.repeat(257) }, { ...source, source: 's'.repeat(4097) }, { ...source, license: 'l'.repeat(65537) }, { ...source, version: 1 }, { ...source, filename: 'a\0b' }]) {
    assert.ok(fontSourceError(value));
    assert.throws(() => readFontSource(value as FontSource), error => isFontSourceError(error) && error.code === 'FONT_SOURCE_INPUT');
  }
});
test('font metadata has no executable getters and invalid original TTF errors keep their source', async () => {
  let calls = 0;
  const metadata = { get filename(): string { calls++; return 'font.ttf'; } };
  await assert.rejects(fontFromBytes(original(), metadata), error => isFontSourceError(error) && error.code === 'FONT_SOURCE_INPUT');
  assert.equal(calls, 0);
  await assert.rejects(fontFromBytes(original(), { filename: 'font.ttf', version: 1 } as never), error => isFontSourceError(error) && error.code === 'FONT_SOURCE_INPUT');
  await assert.rejects(fontFromBytes(new Uint8Array(), { filename: 'font.ttf' }), error => isTrueTypeError(error) && error.code === 'TTF_MALFORMED');
});
