import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHost } from './host.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.env.RESULT_ROOT ?? path.join(here, 'output'));
await fs.mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_DIR ?? 'playwright-core');
const app = await createHost();
let browser, page;
const pageErrors = [], externalRequests = [], milestones = [];

async function waitFor(read, label) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out: ${label}`);
}
const state = () => page.evaluate(() => window.RENDER_STREAM.state());

try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== app.url) externalRequests.push(request.url());
  });
  await page.goto(app.url);
  await page.waitForFunction(() => window.RENDER_STREAM?.ready === true);

  await page.evaluate(() => { window.RENDER_STREAM.start('ok'); });
  const a = await waitFor(() => app.runs[0], 'run A');
  await waitFor(() => a.callbackEntered, 'A callback held');
  await page.waitForFunction(() => window.RENDER_STREAM.state().phase === 'preview');
  assert.deepEqual(a.identity, { streamId: 'host-a', revision: 1 });
  assert.equal(a.sourceReads, 8);
  assert.equal(a.sourceEOF, true);
  assert.equal(a.callbackSettled, false);
  assert.equal(app.accepted, null);
  assert.equal(await page.locator('[data-node="title"]').textContent(), 'A preview');
  assert.equal(await page.locator('[data-node="root"]').evaluate((node) => getComputedStyle(node).display), 'grid');
  assert.equal(await page.getByRole('button', { name: 'Save' }).isDisabled(), true);
  await page.getByLabel('Name').fill('Sujin');
  const aPreview = await state();
  assert.equal(aPreview.draft, 'Sujin');
  milestones.push({ stage: 'A-valid-EOF-held-before-host-mutation', reads: a.sourceReads,
    sourceEOF: a.sourceEOF, callbackEntered: a.callbackEntered, accepted: app.accepted });
  await page.screenshot({ path: path.join(out, 'a-preview.png') });

  await page.evaluate(() => { window.RENDER_STREAM.start('ok'); });
  const b = await waitFor(() => app.runs[1], 'run B');
  await waitFor(() => b.callbackSettled, 'B callback');
  await page.waitForFunction(() => window.RENDER_STREAM.state().phase === 'committed');
  assert.deepEqual(b.identity, { streamId: 'host-b', revision: 2 });
  assert.equal(b.sourceReads, 8);
  assert.equal(b.sourceEOF, true);
  assert.equal(b.accepted, true);
  assert.equal(a.ownedAborted, true);
  assert.deepEqual(app.currentIdentity, { streamId: 'host-b', revision: 2 });
  assert.equal(app.accepted.streamId, 'host-b');
  assert.equal(await page.locator('[data-node="title"]').textContent(), 'B current');
  assert.equal(await page.getByLabel('Name').inputValue(), 'Sujin');
  assert.equal(await page.getByRole('button', { name: 'Save' }).isEnabled(), true);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForFunction(() => document.getElementById('saved').textContent === 'Sujin');
  assert.deepEqual(app.saveLedger, [{ streamId: 'host-b', revision: 2, input: 'Sujin' }]);
  assert.equal(await page.evaluate(() => window.RENDER_STREAM.probeSave(
    { streamId: 'host-b', revision: 2 }, 'duplicate')), 409);
  assert.equal(app.probeDuplicateB(), false);
  const beforeRelease = { browser: await state(), accepted: app.accepted,
    saveLedger: structuredClone(app.saveLedger) };
  milestones.push({ stage: 'B-current-accepted-and-saved-once', reads: b.sourceReads,
    accepted: b.accepted, saves: app.saveLedger.length });
  await page.screenshot({ path: path.join(out, 'b-committed.png') });

  app.releaseA();
  await waitFor(() => a.callbackSettled, 'A callback refusal');
  assert.equal(a.accepted, false);
  assert.deepEqual(app.currentIdentity, { streamId: 'host-b', revision: 2 });
  assert.equal(a.ownedListenerRemoved, true);
  assert.equal(a.responseListenerRemoved, true);
  assert.equal(b.ownedListenerRemoved, true);
  assert.equal(b.responseListenerRemoved, true);
  assert.equal(app.events.some((entry) => entry.event === 'admission-refused'
    && entry.streamId === 'host-a' && entry.why === 'aborted'), true);
  assert.deepEqual(app.accepted, beforeRelease.accepted);
  assert.deepEqual(app.saveLedger, beforeRelease.saveLedger);
  const afterRelease = await state();
  assert.deepEqual(afterRelease.current, beforeRelease.browser.current);
  assert.equal(afterRelease.css, beforeRelease.browser.css);
  assert.equal(afterRelease.draft, 'Sujin');
  milestones.push({ stage: 'released-A-refused-with-B-unchanged', aAborted: a.ownedAborted,
    aAccepted: a.accepted, acceptedStreamId: app.accepted.streamId });

  await page.evaluate(() => { window.RENDER_STREAM.start('invalid-tail'); });
  const c = await waitFor(() => app.runs[2], 'invalid-tail control');
  await waitFor(() => c.transportClosed, 'invalid-tail close');
  await page.waitForFunction(() => window.RENDER_STREAM.state().phase === 'error');
  assert.deepEqual(c.identity, { streamId: 'host-c', revision: 3 });
  assert.equal(c.sourceReads, 9);
  assert.equal(c.callbackEntered, false);
  assert.equal(c.accepted, false);
  assert.equal(c.ownedListenerRemoved, true);
  assert.equal(c.responseListenerRemoved, true);
  assert.deepEqual(app.accepted, beforeRelease.accepted);
  assert.deepEqual(app.saveLedger, beforeRelease.saveLedger);
  const afterInvalid = await state();
  assert.deepEqual(afterInvalid.current, beforeRelease.browser.current);
  assert.equal(afterInvalid.css, beforeRelease.browser.css);
  assert.equal(afterInvalid.draft, 'Sujin');
  assert.equal(await page.getByRole('button', { name: 'Save' }).isDisabled(), true);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(externalRequests, []);
  milestones.push({ stage: 'invalid-tail-before-admission', reads: c.sourceReads,
    callbackEntered: c.callbackEntered, saves: app.saveLedger.length });

  const actualBrowserVersion = browser.version();
  await page.evaluate(() => window.RENDER_STREAM.cancel());
  await page.close();
  await browser.close(); browser = null;
  await app.close();
  assert.equal(app.activeCount, 0);
  const report = { status: 'passed', source: 'two authored screens and one invalid-tail control; zero model calls',
    milestones, events: app.events, runs: app.runs.map((run) => ({ identity: run.identity, kind: run.kind,
      sourceReads: run.sourceReads, sourceEOF: run.sourceEOF, callbackEntered: run.callbackEntered,
      callbackSettled: run.callbackSettled, ownedAborted: run.ownedAborted,
      ownedListenerRemoved: run.ownedListenerRemoved,
      responseListenerRemoved: run.responseListenerRemoved, accepted: run.accepted,
      transportClosed: run.transportClosed, transportError: run.transportError })),
    accepted: app.accepted, saveLedger: app.saveLedger, pageErrors, externalRequests,
    browserVersion: actualBrowserVersion };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, milestones,
    pageErrors: pageErrors.length, externalRequests: externalRequests.length,
    activeCount: app.activeCount, report: path.join(out, 'report.json') }));
} catch (failure) {
  await fs.writeFile(path.join(out, 'failure.json'), JSON.stringify({ error: failure.stack,
    events: app.events, accepted: app.accepted, saveLedger: app.saveLedger,
    pageErrors, externalRequests }, null, 2));
  throw failure;
} finally { await page?.close().catch(() => {}); await browser?.close(); await app.close(); }
