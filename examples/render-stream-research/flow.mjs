import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createResearchServer, authoredRecords, contract } from './serve.mjs';
import { createCompiler } from './compiler.mjs';
import { createJsonlDecoder, encodeRecord, STREAM_LIMITS } from './protocol.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.env.RESULT_ROOT ?? path.join(here, 'output'));
await fs.mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_DIR ?? 'playwright-core');
const controls = [];
const control = (name, run) => { run(); controls.push(name); };
const identity = { streamId: 'controls', revision: 1 };
const source = [...authoredRecords(identity)];
const compiler = () => createCompiler({ identity, contract });
const decoder = (kind = 'input', onRecord = () => {}) => createJsonlDecoder({ identity, kind, onRecord });
const bytes = Buffer.concat(source.map(encodeRecord));
control('split UTF8/LF and coalesced records', () => {
  const seen = [], d = decoder('input', (record) => seen.push(record));
  for (const byte of bytes) d.push(Uint8Array.of(byte));
  assert.equal(d.finish().records, 10); assert.equal(seen[3].node.props.text, source[3].node.props.text);
  const joined = decoder(); joined.push(bytes); assert.equal(joined.finish().records, 10);
});
const refuseInput = (feed, match) => { const d = decoder(); assert.throws(() => feed(d), match); assert.throws(() => d.finish(), /stopped/); };
control('identity, sequence and invalid UTF8 refusal', () => {
  refuseInput((d) => d.push(encodeRecord({ ...source[0], streamId: 'foreign' })), /identity/);
  refuseInput((d) => d.push(encodeRecord({ ...source[0], seq: 2 })), /sequence/);
  refuseInput((d) => d.push(Uint8Array.of(255, 10)), /encoded data/);
});
control('incomplete, missing and duplicate terminal refusal', () => {
  refuseInput((d) => { d.push(bytes.subarray(0, bytes.length - 1)); d.finish(); }, /Incomplete/);
  refuseInput((d) => { d.push(encodeRecord(source[0])); d.finish(); }, /Missing/);
  refuseInput((d) => d.push(Buffer.concat([bytes, encodeRecord({ ...source.at(-1), seq: 11 })])), /terminal/);
});
control('input byte/line limits', () => {
  refuseInput((d) => d.push(new Uint8Array(STREAM_LIMITS.inputBytes + 1)), /byte limit/);
  refuseInput((d) => d.push(new Uint8Array(STREAM_LIMITS.inputLineBytes + 1)), /line limit/);
});
control('missing child, component and action refusal at checkpoint', () => {
  for (const change of ['child', 'type', 'action']) {
    const c = compiler(), records = structuredClone(source);
    if (change === 'child') records[2].node.children = ['missing'];
    if (change === 'type') records[3].node.type = 'Script';
    if (change === 'action') records[7].node.on.press.action = 'foreign';
    assert.throws(() => { for (const record of records) c.accept(record); }, /Invalid checkpoint/);
    assert.throws(() => c.finish(), /stopped/);
  }
});
let compiled;
control('detached compiled snapshots and compiler terminal', () => {
  const c = compiler();
  for (const record of source) {
    const view = c.accept(record);
    if (view && !view.final) view.spec.elements.title.props.text = 'detached';
  }
  compiled = c.finish(); assert.equal(compiled.spec.elements.title.props.text, source[3].node.props.text);
  assert(compiled.css.includes('display: grid')); assert.throws(() => c.finish(), /stopped/);
  const missing = compiler(); missing.accept(source[0]); assert.throws(() => missing.finish(), /Missing/);
});
control('node and snapshot limits', () => {
  const c = compiler(); for (const record of source.slice(0, 4)) c.accept(record);
  let seq = 4;
  for (let i = 3; i < STREAM_LIMITS.nodes; i++) c.accept({ ...source[3], seq: ++seq, id: `n${i}`, node: { ...source[3].node, props: { id: `n${i}`, text: 'bounded' } } });
  assert.throws(() => c.accept({ ...source[3], seq: ++seq, id: 'over' }), /Node limit/);
  const views = compiler(); for (const record of source.slice(0, 4)) views.accept(record);
  for (let i = 1; i <= STREAM_LIMITS.snapshots; i++) views.accept({ ...source[4], seq: 4 + i });
  assert.throws(() => views.accept({ ...source.at(-1), seq: 13 }), /Snapshot limit/);
});
const snapshot = (seq, sourceSeq, phase = 'preview', extra = {}) => ({ version: 1, ...identity, seq,
  type: 'snapshot', sourceSeq, phase, spec: compiled.spec, css: compiled.css, ...extra });
control('output identity/order/terminal/CSS/view limits', () => {
  for (const value of [snapshot(2, 5), snapshot(1, 5, 'preview', { streamId: 'foreign' }), snapshot(1, 5, 'preview', { css: ' '.repeat(STREAM_LIMITS.cssBytes + 1) })]) {
    assert.throws(() => decoder('output').push(encodeRecord(value)));
  }
  const stale = decoder('output'); stale.push(encodeRecord(snapshot(1, 5)));
  assert.throws(() => stale.push(encodeRecord(snapshot(2, 5))), /source sequence/i);
  const duplicate = decoder('output'); duplicate.push(encodeRecord(snapshot(1, 10, 'committed')));
  assert.throws(() => duplicate.push(encodeRecord(snapshot(2, 11, 'committed'))), /terminal/);
  const many = decoder('output'); for (let i = 1; i <= 8; i++) many.push(encodeRecord(snapshot(i, i)));
  assert.throws(() => many.push(encodeRecord(snapshot(9, 9))), /record limit/);
});

const gates = new Map();
function gate(stage) { return ({ identity: run, mode, signal }) => new Promise((resolve, reject) => {
  const entry = gates.get(run.streamId) ?? { ...run, mode }; gates.set(run.streamId, entry);
  const aborted = () => { entry.cancelled = true; signal.removeEventListener('abort', aborted); reject(new Error('Cancelled gate')); };
  entry[stage] = () => { signal.removeEventListener('abort', aborted); resolve(); };
  if (signal.aborted) aborted(); else signal.addEventListener('abort', aborted, { once: true });
}); }
const hostKind = process.env.STREAM_HOST ?? 'node';
if (!['node', 'fetch'].includes(hostKind)) throw new Error('Unknown stream host');
const compiledResponse = hostKind === 'fetch' ? (await import('./fetch-host.mjs')).createCompiledResponse : null;
if (compiledResponse) {
  const responseControl = async (name, run) => { await run(); controls.push(name); };
  await responseControl('Fetch pull demand and one final admission', async () => {
    let reads = 0, admits = 0;
    const response = compiledResponse({ identity, contract, source: async function* () {
      for (const record of source) { reads++; yield encodeRecord(record); }
    }, acceptFinal() { admits++; } });
    assert.equal(reads, 0); assert.equal(admits, 0);
    const reader = response.body.getReader(); assert.equal((await reader.read()).done, false);
    assert.equal(reads, 5); assert.equal(admits, 0);
    const output = decoder('output');
    // The first frame is already consumed; inspect subsequent reads through a fresh decoder below.
    let frames = 1;
    while (!(await reader.read()).done) frames++;
    assert.equal(frames, 3); assert.equal(reads, 10); assert.equal(admits, 1);
    reader.releaseLock();
    const replay = compiledResponse({ identity, contract, source: async function* () { yield bytes; }, acceptFinal() {} });
    for await (const part of replay.body) output.push(part);
    assert.equal(output.finish().records, 3);
  });
  await responseControl('Fetch cancellation aborts pending source', async () => {
    let sourceSignal, admits = 0, returned = 0;
    const response = compiledResponse({ identity, contract, source(signal) {
      sourceSignal = signal;
      return { [Symbol.asyncIterator]() { return this; },
        next() { return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Source aborted')), { once: true })); },
        return() { returned++; return Promise.resolve({ done: true }); } };
    }, acceptFinal() { admits++; } });
    const reader = response.body.getReader(), pending = reader.read();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await reader.cancel('host cancelled'); await pending;
    assert.equal(sourceSignal.aborted, true); assert.equal(returned, 1); assert.equal(admits, 0);
    reader.releaseLock();
  });
  await responseControl('Fetch invalid EOF and refused host admission', async () => {
    for (const failure of ['tail', 'missing', 'admission']) {
      let admits = 0;
      const response = compiledResponse({ identity, contract, source: async function* () {
        yield failure === 'tail' ? Buffer.concat([bytes, Buffer.from('x')]) : failure === 'missing' ? encodeRecord(source[0]) : bytes;
      }, acceptFinal() { admits++; if (failure === 'admission') throw new Error('Host refused'); } });
      await assert.rejects(async () => { for await (const part of response.body) assert(part instanceof Uint8Array); });
      assert.equal(admits, failure === 'admission' ? 1 : 0);
    }
  });
}
const app = await createResearchServer({ checkpointGate: gate('checkpoint'), finalGate: gate('final'), compiledResponse });
let browser, page;
const errors = [], csp = [], external = [], milestones = [];
const wait = async (read, name) => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) { const value = await read(); if (value) return value; await new Promise((resolve) => setTimeout(resolve, 20)); }
  throw new Error(`Timeout: ${name}`);
};
const inspect = () => page.evaluate(() => window.STREAM_UI.inspect());
const phase = (value) => page.waitForFunction((expected) => window.STREAM_UI?.inspect().phase === expected, value);
const start = async (options) => {
  const previous = app.records.length;
  await page.evaluate((value) => { void window.STREAM_UI.start(value); }, options);
  return wait(() => app.records[previous], 'new source');
};
const held = (run, stage) => wait(() => gates.get(run.streamId)?.[stage] && gates.get(run.streamId), `held ${stage}`);
const finish = async (run) => { (await held(run, 'checkpoint')).checkpoint(); (await held(run, 'final')).final(); await phase('committed'); };
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (new URL(request.url()).origin !== app.url) external.push(request.url()); });
  await page.addInitScript(() => { window.CSP_ERRORS = []; document.addEventListener('securitypolicyviolation', (event) => window.CSP_ERRORS.push(event.violatedDirective)); });
  assert.equal((await fetch(`${app.url}/stream`, { method: 'POST', headers: { origin: app.url,
    'content-type': 'application/json', 'x-session-token': 'é'.repeat(48) }, body: '{}' })).status, 403);
  await page.goto(app.url); await page.waitForFunction(() => window.STREAM_UI?.inspect().ready);
  const stream = await start({ mode: 'stream' }); await held(stream, 'checkpoint'); await phase('preview');
  const early = await inspect(), visible = early.trace.filter((item) => item.kind === 'visible').at(-1);
  assert.equal(stream.sourceComplete, false); assert.equal(stream.sourceRecords, 5); assert.equal(stream.snapshots, 1);
  assert.equal(visible.display, 'grid'); assert.equal(visible.gap, '10px'); assert.equal(visible.padding, '22px');
  assert.equal(visible.text, '서버에서 준비한 신청 화면'); assert.equal(await page.getByLabel('이름', { exact: true }).count(), 0);
  milestones.push({ kind: 'useful-before-source-completion', sourceComplete: stream.sourceComplete,
    sourceRecords: stream.sourceRecords, totalAuthoredRecords: source.length, visible });
  await page.screenshot({ path: path.join(out, 'early-preview.png') });
  gates.get(stream.streamId).checkpoint(); await held(stream, 'final');
  await page.waitForFunction(() => document.querySelector('[data-node-id="name"]'));
  assert.equal(await page.getByRole('button', { name: '저장', exact: true }).isDisabled(), true);
  assert.equal(stream.sourceComplete, false);
  assert.equal((await page.evaluate((run) => window.STREAM_UI.probeAction(run, '거부'), { streamId: stream.streamId, revision: stream.revision })).status, 409);
  await page.screenshot({ path: path.join(out, 'form-preview.png') });
  gates.get(stream.streamId).final(); await phase('committed'); assert.equal(stream.sourceComplete, true);
  const first = await inspect();
  await page.getByLabel('이름', { exact: true }).fill('수진');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('saved').textContent === '저장됨: 수진');
  assert.equal(app.saves.length, 1); assert.equal(app.saves[0].name, '수진');
  assert.equal((await page.evaluate((run) => window.STREAM_UI.probeAction(run, '중복'), { streamId: stream.streamId, revision: stream.revision })).status, 409);
  milestones.push({ kind: 'commit-edit-save', sourceComplete: true, snapshots: stream.snapshots });
  await page.screenshot({ path: path.join(out, 'committed.png') });

  const complete = await start({ mode: 'complete' }); await held(complete, 'checkpoint');
  assert.equal(complete.snapshots, 0); assert.equal((await inspect()).screen.streamId, first.screen.streamId);
  await finish(complete); const baseline = await inspect();
  assert.deepEqual(baseline.screen.spec, first.screen.spec); assert.equal(baseline.css, first.css);
  assert.equal(baseline.draft.name, '수진'); assert.equal(complete.snapshots, 1);
  milestones.push({ kind: 'same-source-final-equivalence', streamingViews: stream.snapshots, completeViews: complete.snapshots });

  const cancelled = await start({ mode: 'stream', tone: 'dark' }); await held(cancelled, 'checkpoint'); await phase('preview');
  assert.notEqual((await inspect()).css, baseline.css);
  gates.get(cancelled.streamId).checkpoint(); await held(cancelled, 'final');
  await page.getByLabel('이름', { exact: true }).fill('혜진');
  await page.getByRole('button', { name: '취소', exact: true }).click(); await phase('cancelled');
  let restored = await inspect(); assert.equal(restored.css, baseline.css); assert.deepEqual(restored.screen, baseline.screen);
  assert.equal(restored.draft.name, '혜진'); assert.equal(await page.getByLabel('이름', { exact: true }).inputValue(), '혜진');
  await wait(() => cancelled.cancelled, 'server cancellation');
  milestones.push({ kind: 'cancel-restores-view-css-current-input' });

  const broken = await start({ mode: 'stream', broken: true }); await held(broken, 'checkpoint'); await phase('preview');
  gates.get(broken.streamId).checkpoint(); await phase('error');
  restored = await inspect(); assert.equal(restored.css, baseline.css); assert.deepEqual(restored.screen, baseline.screen);
  assert.equal(restored.draft.name, '혜진'); assert.equal(broken.sourceComplete, false); assert.equal(broken.failed, true);
  milestones.push({ kind: 'invalid-action-checkpoint-restores-last-commit' });
  await page.screenshot({ path: path.join(out, 'recovered.png') });

  const old = await start({ mode: 'stream', tone: 'dark' }); await held(old, 'checkpoint'); await phase('preview');
  const newer = await start({ mode: 'stream' }); await held(newer, 'checkpoint'); await finish(newer);
  await wait(() => old.cancelled, 'superseded source'); assert.equal((await inspect()).screen.streamId, newer.streamId);
  gates.get(old.streamId).checkpoint(); assert.equal((await inspect()).screen.streamId, newer.streamId);
  assert.equal((await page.evaluate((run) => window.STREAM_UI.probeAction(run, '구형'), { streamId: old.streamId, revision: old.revision })).status, 409);
  milestones.push({ kind: 'superseded-source-cannot-overwrite-or-save' });

  const acceptedBeforeFault = (await inspect()).committed;
  // Deterministic transport fault: a valid final followed by a second final in the same body.
  await page.route('**/stream', async (route) => {
    const fault = { streamId: 'fault-injection', revision: newer.revision + 1 };
    const final = snapshot(1, 10, 'committed', { ...fault });
    await route.fulfill({ status: 200, contentType: 'application/x-ndjson',
      headers: { 'x-stream-id': fault.streamId, 'x-revision': String(fault.revision) },
      body: Buffer.concat([encodeRecord(final), encodeRecord({ ...final, seq: 2, sourceSeq: 11 })]) });
  });
  await page.evaluate(() => { void window.STREAM_UI.start(); }); await phase('error');
  const afterFault = await inspect(); assert.deepEqual(afterFault.committed, acceptedBeforeFault);
  assert.deepEqual(afterFault.screen, acceptedBeforeFault); assert.equal(afterFault.draft.name, '혜진');
  assert(!afterFault.trace.some((item) => item.kind === 'committed' && item.streamId === 'fault-injection'));
  assert.equal(await page.getByRole('button', { name: '저장', exact: true }).isDisabled(), true);
  await page.unroute('**/stream'); milestones.push({ kind: 'duplicate-final-does-not-release-actions' });
  csp.push(...await page.evaluate(() => window.CSP_ERRORS));
  assert.deepEqual(errors, []); assert.deepEqual(csp, []); assert.deepEqual(external, []);
  const report = { status: 'passed', host: hostKind, source: 'authored deterministic records; no model calls',
    browser: browser.version(), browserBundleBytes: app.bundleBytes,
    compiled: JSON.parse(await fs.readFile(path.join(here, '.build/provenance.json'), 'utf8')),
    controls, milestones, sourceRuns: app.records, saves: app.saves,
    browserTrace: afterFault.trace, pageErrors: errors, cspErrors: csp, externalRequests: external,
    timingMeaning: 'same browser performance clock; held-source causal relation, not model latency or physical paint' };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, host: hostKind, browser: report.browser, sourceRuns: app.records.length,
    controls: controls.length, milestones: milestones.length, pageErrors: errors.length, cspErrors: csp.length, externalRequests: external.length, report: path.join(out, 'report.json') }));
} catch (error) {
  await fs.writeFile(path.join(out, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack, controls, sourceRuns: app.records, errors, csp, external }, null, 2));
  throw error;
} finally { await browser?.close(); await app.close(); }
