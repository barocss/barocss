import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { catalog } from './samples.mjs';
import { appendRecords, loadIndex, digest, readData, recordKey } from './store.mjs';
import { captureBatch } from './capture.mjs';
import { createGallery } from './serve.mjs';
test('12-by-2 actual captures remain paired across append and immutable second batch; corruption is detected', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'render-gallery-capture-'));
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), samples = catalog(sha);
  try {
    appendRecords(root, samples);
    const first = await captureBatch(root, { id: 'initial' }); assert.equal(first.images, 24);
    const before = new Map();
    for (const sample of samples) { const name = path.join('samples', recordKey(sample)+'.json'); before.set(name, digest(fs.readFileSync(path.join(root, name)))); }
    for (const name of fs.readdirSync(path.join(root, 'captures', 'initial'))) before.set(path.join('captures', 'initial', name), digest(fs.readFileSync(path.join(root, 'captures', 'initial', name))));
    const extra = structuredClone(samples[0]); extra.id = 'append-additional'; extra.title = 'Additional preserved specimen'; appendRecords(root, [extra]);
    const second = await captureBatch(root, { id: 'appended', sampleIds: [extra.id] }); assert.equal(second.images, 2);
    const index = loadIndex(root); assert.equal(index.samples.length, 13); assert.equal(index.batches.length, 2);
    for (const [name, hash] of before) assert.equal(digest(fs.readFileSync(path.join(root, name))), hash);
    await assert.rejects(captureBatch(root, { id: 'initial' }), /exist/i);
    const batch = readData(path.join(root, 'captures', 'initial', 'batch.json'));
    assert.equal(batch.candidateSha, sha); assert.equal(batch.captures.length, 24);
    assert.equal(new Set(batch.captures.map((c) => c.id)).size, 12);
    assert(batch.captures.every((c) => c.validated && c.sourceKind === 'authored' && !c.errors.length && !c.csp.length && !c.external.length));
    const app = await createGallery({ root });
    try {
      const visible = await (await fetch(app.url+'/api/index')).json(); assert.equal(visible.samples.length, 13);
      assert.equal(visible.samples.flatMap((r) => r.captures).length, 26);
      for (const sample of visible.samples) for (const capture of sample.captures) {
        assert.equal(digest(Buffer.from(await (await fetch(app.url+capture.url)).arrayBuffer())), capture.imageDigest);
        assert.deepEqual(Object.keys(capture.viewport).sort(), ['height', 'width']);
      }
    } finally { await app.close(); }
    if (process.env.GALLERY_RESULT_ROOT) {
      const target = path.join(process.env.GALLERY_RESULT_ROOT, `verified-dataset-${randomUUID()}`);
      fs.mkdirSync(process.env.GALLERY_RESULT_ROOT, { recursive: true, mode: 0o700 }); fs.cpSync(root, target, { recursive: true }); fs.chmodSync(target, 0o700);
    }
    const originalIndex = fs.readFileSync(path.join(root, 'index.json')), originalBatch = fs.readFileSync(path.join(root, 'captures', 'initial', 'batch.json'));
    batch.captures[0].stateDigest = '0'.repeat(64);
    fs.writeFileSync(path.join(root, 'captures', 'initial', 'batch.json'), JSON.stringify(batch));
    index.batches[0].digest = digest(batch); fs.writeFileSync(path.join(root, 'index.json'), JSON.stringify(index));
    assert.throws(() => loadIndex(root), /provenance/);
    fs.writeFileSync(path.join(root, 'index.json'), originalIndex); fs.writeFileSync(path.join(root, 'captures', 'initial', 'batch.json'), originalBatch);
    const image = path.join(root, 'captures', 'initial', `${recordKey(samples[0])}-1200.png`), bytes = fs.readFileSync(image);
    fs.unlinkSync(image); assert.throws(() => loadIndex(root)); fs.writeFileSync(image, bytes); assert.equal(loadIndex(root).batches.length, 2);
    fs.appendFileSync(image, 'corrupt'); assert.throws(() => loadIndex(root), /corrupt/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
