// D320: current-source handleStore on real fresh-context OPFS. Wrappers only control native call scheduling.
// CHROME=... PW_DIR=... OPFS_D320_ARTIFACT_DIR=... node --test test/handle-store-opfs-browser.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');

test('D320 native OPFS serializes same-adapter exact-path write ownership through returned tag read', { timeout: 120000 }, async () => {
  assert.ok(process.env.CHROME && process.env.PW_DIR && process.env.OPFS_D320_ARTIFACT_DIR, 'Chrome, Playwright and evidence directory are required; no silent skip');
  const output = process.env.OPFS_D320_ARTIFACT_DIR; await mkdir(output, { recursive: true });
  const bundle = await build({ entryPoints: [path.join(here, '../src/storage/handleStore.ts')], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', metafile: true });
  const inputs = [];
  for (const file of Object.keys(bundle.metafile.inputs)) {
    const resolved = await realpath(path.resolve(file));
    assert.ok(resolved.startsWith(root + path.sep) || resolved.includes(path.sep + 'node_modules' + path.sep), `outside worktree product source: ${resolved}`);
    const bytes = await readFile(resolved); inputs.push({ path: resolved, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  await writeFile(path.join(output, 'source-inputs.json'), JSON.stringify({ worktree: root, inputs }, null, 2));
  await writeFile(path.join(output, 'metafile.json'), JSON.stringify(bundle.metafile, null, 2));
  const server = createServer((request, response) => {
    if (request.url === '/store.js') { response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(bundle.outputFiles[0].contents); }
    else if (request.url === '/') { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<!doctype html><meta charset="utf-8"><title>D320 native OPFS harness</title><h1>D320 native OPFS harness — not Studio UI</h1><pre id="status">Running real native file operations</pre>'); }
    else if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); }
    else { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  let browser, context;
  const errors = [], cleanup = {};
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true });
    context = await browser.newContext(); const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.stack ?? String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const result = await page.evaluate(async () => {
      const events = [], checks = [], held = [], pending = [], snapshots = [];
      const namespace = 'd320-native-write-ownership'; let nativeRoot, directory;
      const ensure = (value, message) => { if (!value) throw new Error(message); };
      const deferred = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
      const bytes = text => new TextEncoder().encode(text), text = data => new TextDecoder().decode(data);
      const tag = file => `${file.size}-${file.lastModified}`;
      const outcome = promise => { const observed = promise.then(value => ({ ok: true, value }), error => ({ ok: false, code: error?.code ?? null, name: error?.name ?? null, message: error?.message ?? String(error), reasonType: typeof error })); pending.push(observed); return observed; };
      const tracked = promise => { pending.push(promise.then(() => null, () => null)); return promise; };
      const bounded = async (promise, label) => {
        let timer;
        try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} did not complete while another path was held`)), 10000); })]); }
        finally { clearTimeout(timer); }
      };
      const control = { holdStream: null, streamEntered: null, streamRelease: null, abortNext: null, holdTag: null, tagEntered: null, tagRelease: null, finalTagPending: null };
      const holdStream = file => { const entered = deferred(), release = deferred(); held.push(release); Object.assign(control, { holdStream: file, streamEntered: entered, streamRelease: release }); return { entered, release }; };
      // Plain adapter interfaces forward to genuine native handles and streams with their native receivers.
      const wrapDirectory = (native, prefix = '') => ({
        kind: native.kind, name: native.name,
        async getDirectoryHandle(name, options) { return wrapDirectory(await native.getDirectoryHandle(name, options), prefix + name + '/'); },
        async getFileHandle(name, options) {
          const file = await native.getFileHandle(name, options), full = prefix + name;
          return { kind: file.kind, name: file.name,
            async getFile() {
              if (control.finalTagPending === full) { control.finalTagPending = null; events.push({ type: 'returned-tag-read-held', path: full }); control.tagEntered.release(); await control.tagRelease.promise; }
              const value = await file.getFile(); snapshots.push({ path: full, tag: tag(value), size: value.size }); return value;
            },
            async createWritable() {
              const stream = await file.createWritable();
              events.push({ type: 'native-stream-admitted', path: full, arguments: 0, streamType: stream.constructor.name, observedMode: stream.mode ?? null });
              if (control.holdStream === full) { control.holdStream = null; control.streamEntered.release(); await control.streamRelease.promise; }
              if (control.abortNext === full) { control.abortNext = null; await stream.abort(); events.push({ type: 'native-aborted-before-write', path: full }); }
              return {
                async write(data) { events.push({ type: 'native-write', path: full, size: data.length }); await stream.write(data); },
                async close() { await stream.close(); events.push({ type: 'native-close', path: full }); if (control.holdTag === full) { control.holdTag = null; control.finalTagPending = full; } },
                async abort() { events.push({ type: 'native-abort', path: full }); await stream.abort(); },
              };
            },
          };
        },
        async removeEntry(name) { await native.removeEntry(name); },
        async *entries() { yield* native.entries(); },
      });
      const direct = async file => { const handle = await directory.getFileHandle(file), value = await handle.getFile(); return { bytes: text(new Uint8Array(await value.arrayBuffer())), tag: tag(value), size: value.size }; };
      const report = { status: 'RUNNING', secureContext: isSecureContext, origin: location.origin, namespace, checks, events, snapshots, cleanup: {} };
      try {
        ensure(isSecureContext && navigator.storage?.getDirectory, 'real secure-context OPFS is required');
        const { handleStore } = await import('/store.js');
        nativeRoot = await navigator.storage.getDirectory(); directory = await nativeRoot.getDirectoryHandle(namespace, { create: true });
        const store = handleStore(wrapDirectory(directory), 'browser');
        const original = await store.write('overlap', bytes('seed'));
        const firstHold = holdStream('overlap');
        const first = outcome(store.write('overlap', bytes('writer-A-is-longer'), { expect: original.tag })); await bounded(firstHold.entered.promise, 'A native stream admission');
        const second = outcome(store.write('overlap', bytes('writer-B-must-refuse'), { expect: original.tag }));
        // Do not wait for B's admission: correct same-path exclusion prevents it. Another path must progress.
        const independent = await bounded(tracked(store.write('independent', bytes('independent-path'))), 'independent path');
        const during = await store.read('overlap'); ensure(text(during.bytes) === 'seed', 'native read during uncommitted A retains seed');
        ensure(events.filter(event => event.type === 'native-stream-admitted' && event.path === 'overlap').length === 2, 'B has not acquired a stream while A owns the path');
        firstHold.release.release();
        const a = await first, b = await second, after = await direct('overlap');
        ensure(a.ok && !b.ok && b.code === 'STORAGE_CHANGED', 'one success and one stale-tag refusal required');
        ensure(after.bytes === 'writer-A-is-longer' && a.value.tag === after.tag && after.tag !== original.tag, 'A owns final native bytes and returned changed tag');
        checks.push({ name: 'same-path-overlap', a, b, original, after, independent, readWhileUncommitted: text(during.bytes) });

        const follow = await store.write('overlap', bytes('fresh-followup-is-even-longer'), { expect: after.tag });
        const followed = await direct('overlap'); ensure(follow.tag === followed.tag, 'fresh follow-up returns its own native tag');
        const stale = await outcome(store.write('overlap', bytes('stale'), { expect: after.tag }));
        ensure(!stale.ok && stale.code === 'STORAGE_CHANGED' && (await direct('overlap')).bytes === followed.bytes, 'serial stale write preserves fresh bytes');
        checks.push({ name: 'fresh-and-serial-stale', follow, followed, stale });

        const createHold = holdStream('created');
        const createA = outcome(store.write('created', bytes('created-first'), { expect: null })); await bounded(createHold.entered.promise, 'first creator native admission');
        const createB = outcome(store.write('created', bytes('created-second'), { expect: null })); createHold.release.release();
        const createdA = await createA, createdB = await createB;
        ensure(createdA.ok && !createdB.ok && createdB.code === 'STORAGE_CHANGED' && (await direct('created')).bytes === 'created-first', 'expect:null admits one creator');
        checks.push({ name: 'expect-null-create', a: createdA, b: createdB });

        await store.write('returned-tag', bytes('tag-seed'));
        const tagEntered = deferred(), tagRelease = deferred(); held.push(tagRelease);
        Object.assign(control, { holdTag: 'returned-tag', tagEntered, tagRelease });
        const taggedA = outcome(store.write('returned-tag', bytes('tag-writer-A-long'))); await bounded(tagEntered.promise, 'A returned-tag native read');
        const admittedAtHold = events.filter(event => event.type === 'native-stream-admitted' && event.path === 'returned-tag').length;
        const taggedB = outcome(store.write('returned-tag', bytes('unconditional-B-is-longer')));
        await bounded(tracked(store.write('other', bytes('other-progress'))), 'other path at returned tag');
        ensure(events.filter(event => event.type === 'native-stream-admitted' && event.path === 'returned-tag').length === admittedAtHold, 'unconditional B remains excluded through A returned-tag read');
        const ownA = await direct('returned-tag'); tagRelease.release();
        const tagA = await taggedA, tagB = await taggedB, ownB = await direct('returned-tag');
        ensure(tagA.ok && tagB.ok && tagA.value.tag === ownA.tag && tagB.value.tag === ownB.tag && ownB.bytes === 'unconditional-B-is-longer', 'unconditional order and returned-tag ownership');
        checks.push({ name: 'unconditional-and-returned-tag', a: tagA, b: tagB, nativeA: ownA, nativeB: ownB });

        control.abortNext = 'native-error';
        const failed = await outcome(store.write('native-error', bytes('native-aborted-write')));
        ensure(!failed.ok, 'a genuinely aborted native stream must reject write');
        const resumed = await bounded(tracked(store.write('native-error', bytes('after-native-error'))), 'same path after native error');
        const recovered = await direct('native-error'); ensure(recovered.bytes === 'after-native-error' && resumed.tag === recovered.tag, 'queue progresses after actual native failure');
        checks.push({ name: 'native-error-then-progress', failed, resumed, recovered });
        report.status = 'PASS';
      } catch (error) { report.status = 'FAIL'; report.error = { name: error.name, message: error.message, stack: error.stack }; }
      finally {
        for (const hold of held) hold.release(); await Promise.allSettled(pending);
        if (nativeRoot && directory) {
          try { await nativeRoot.removeEntry(namespace, { recursive: true }); report.cleanup.namespace = 'REMOVED'; }
          catch (error) { report.cleanup.namespace = 'FAILED'; report.cleanup.error = String(error); }
          try { await nativeRoot.getDirectoryHandle(namespace); report.cleanup.absenceVerified = false; }
          catch (error) { report.cleanup.absenceVerified = error.name === 'NotFoundError'; }
        }
      }
      document.getElementById('status').textContent = JSON.stringify({ status: report.status, secureContext: report.secureContext, checks: report.checks, cleanup: report.cleanup, error: report.error }, null, 2);
      return report;
    });
    await writeFile(path.join(output, 'receipt.json'), JSON.stringify({ browserVersion: browser.version(), errors, result }, null, 2));
    await page.screenshot({ path: path.join(output, 'native-opfs-harness.png'), fullPage: true });
    assert.equal(result.status, 'PASS', JSON.stringify(result.error)); assert.deepEqual(errors, []);
    assert.equal(result.cleanup.namespace, 'REMOVED'); assert.equal(result.cleanup.absenceVerified, true);
    assert.equal(result.checks.length, 5);
  } finally {
    if (context) { await context.close(); cleanup.context = 'CLOSED'; }
    if (browser) { await browser.close(); cleanup.browser = 'CLOSED'; }
    await new Promise(resolve => server.close(resolve)); cleanup.server = 'CLOSED';
    await writeFile(path.join(output, 'cleanup.json'), JSON.stringify(cleanup, null, 2));
  }
});
