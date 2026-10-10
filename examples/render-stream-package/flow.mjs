import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createCompiledResponse } from '@barocss/render-stream/fetch';
import { encodeRecord } from '@barocss/render-stream/protocol';
import { authoredRecords, createHost } from './host.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.env.RESULT_ROOT ?? path.join(here, 'output'));
await fs.mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_DIR ?? 'playwright-core');
const identity = { streamId: 'demand-check', revision: 1 };
const contract = { textBindings: ['/name'], actions: ['save'] };
let sourceCalls = 0, sourceReads = 0, ownedAborted = false, returnCount = 0;
const demandResponse = createCompiledResponse({ identity, contract,
  source: async function* (signal) {
    sourceCalls++;
    try {
      for (const record of authoredRecords(identity)) {
        sourceReads++;
        yield encodeRecord(record);
        if (record.seq === 5) await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
      }
    } finally { ownedAborted = signal.aborted; returnCount++; }
  },
  acceptFinal() { throw new Error('Cancelled source cannot admit final'); },
});
assert.equal(sourceCalls, 0, 'source must not start before response demand');
const demandReader = demandResponse.body.getReader();
const first = await demandReader.read();
assert.equal(first.done, false);
assert.equal(sourceCalls, 1);
assert.equal(sourceReads, 5);
await demandReader.cancel();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(ownedAborted, true);
assert.equal(returnCount, 1);

const app = await createHost();
let browser;
const pageErrors = [], externalRequests = [], observations = [];
async function waitFor(read, name) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out: ${name}`);
}
async function state(page) { return page.evaluate(() => window.RENDER_STREAM.state()); }

try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => { if (new URL(request.url()).origin !== app.url) externalRequests.push(request.url()); });
  await page.goto(app.url);
  await page.waitForFunction(() => window.RENDER_STREAM?.ready === true);
  assert.equal(app.runs.length, 0);

  await page.evaluate(() => { window.RENDER_STREAM.start('ok'); });
  const firstRun = await waitFor(() => app.runs[0], 'first source');
  const early = await waitFor(async () => (await state(page)).phase === 'preview' && await state(page), 'early preview');
  assert.equal(firstRun.sourceRecords, 5);
  assert.equal(firstRun.sourceComplete, false);
  assert.equal(await page.locator('[data-node="title"]').textContent(), 'Prepared application');
  assert.equal(await page.locator('[data-node="root"]').evaluate((node) => getComputedStyle(node).display), 'grid');
  assert.equal(await page.locator('[data-node="root"]').evaluate((node) => getComputedStyle(node).gap), '10px');
  assert.equal(await page.getByRole('button', { name: 'Save' }).count(), 0);
  observations.push({ stage: 'preview-before-source-completion', sourceRecords: firstRun.sourceRecords,
    sourceComplete: firstRun.sourceComplete, phase: early.phase });
  await page.screenshot({ path: path.join(out, 'preview.png') });

  app.release(firstRun.streamId);
  await page.waitForFunction(() => window.RENDER_STREAM.state().phase === 'committed');
  assert.equal(firstRun.sourceRecords, 10);
  assert.equal(firstRun.sourceComplete, true);
  assert.equal(firstRun.accepted, true);
  assert.equal(await page.getByRole('button', { name: 'Save' }).isEnabled(), true);
  await page.getByLabel('Name').fill('Sujin');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForFunction(() => document.getElementById('saved').textContent === 'Sujin');
  assert.equal(app.saves.length, 1);
  assert.equal(await page.evaluate((run) => window.RENDER_STREAM.probeSave(run, 'duplicate'), firstRun), 409);
  observations.push({ stage: 'normal-eof-once-only-save', saves: app.saves.length });
  const accepted = await state(page);

  await page.evaluate(() => { window.RENDER_STREAM.start('cancel'); });
  const cancelled = await waitFor(() => app.runs[1], 'cancel source');
  await waitFor(async () => (await state(page)).phase === 'preview', 'cancel preview');
  assert.notEqual((await state(page)).css, accepted.css);
  await page.evaluate(() => window.RENDER_STREAM.cancel());
  const afterCancel = await state(page);
  assert.equal(afterCancel.phase, 'cancelled');
  assert.equal(afterCancel.css, accepted.css);
  assert.deepEqual(afterCancel.current, accepted.committed);
  assert.equal(afterCancel.draft, 'Sujin');
  assert.equal(await page.getByLabel('Name').inputValue(), 'Sujin');
  assert.equal(await page.getByRole('button', { name: 'Save' }).isDisabled(), true);
  await waitFor(() => cancelled.aborted, 'owned cancellation');
  assert.equal(cancelled.accepted, false);
  observations.push({ stage: 'cancel-restores-view-css-input', aborted: cancelled.aborted });

  await page.evaluate(() => { window.RENDER_STREAM.start('invalid-tail'); });
  const invalid = await waitFor(() => app.runs[2], 'invalid source');
  await waitFor(async () => (await state(page)).phase === 'preview', 'invalid preview');
  app.release(invalid.streamId);
  await page.waitForFunction(() => window.RENDER_STREAM.state().phase === 'error');
  const afterInvalid = await state(page);
  assert.equal(invalid.sourceRecords, 10);
  assert.equal(invalid.accepted, false);
  assert.equal(afterInvalid.css, accepted.css);
  assert.deepEqual(afterInvalid.current, accepted.committed);
  assert.equal(afterInvalid.draft, 'Sujin');
  assert.equal(await page.getByRole('button', { name: 'Save' }).isDisabled(), true);
  assert.equal(app.saves.length, 1);
  observations.push({ stage: 'invalid-tail-rejected', sourceRecords: invalid.sourceRecords, saves: app.saves.length });
  await page.screenshot({ path: path.join(out, 'recovered.png') });
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(externalRequests, []);
  const report = { status: 'passed', source: 'authored lazy records; zero model calls',
    browser: browser.version(), demand: { sourceCalls, sourceReads, ownedAborted, returnCount },
    observations, runs: app.runs, saves: app.saves, pageErrors, externalRequests,
    provenance: JSON.parse(await fs.readFile(path.join(here, '.build/provenance.json'), 'utf8')) };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, browser: report.browser, demand: report.demand,
    observations, pageErrors: pageErrors.length, externalRequests: externalRequests.length,
    report: path.join(out, 'report.json') }));
} catch (failure) {
  await fs.writeFile(path.join(out, 'failure.json'), JSON.stringify({ error: failure.stack, runs: app.runs,
    saves: app.saves, pageErrors, externalRequests }, null, 2));
  throw failure;
} finally { await browser?.close(); await app.close(); }
