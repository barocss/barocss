import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { compileUi } from './compiler.mjs';
import { createJsxServer } from './serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), output = path.resolve(process.env.RESULT_ROOT ?? path.join(here, 'output'));
await fs.mkdir(output, { recursive: true });
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_CORE_DIR ?? 'playwright-core');
const original = await fs.readFile(path.join(here, 'app.jsx'), 'utf8');
const controls = [];
for (const [name, text, pattern] of [
  ['source byte bound', ' '.repeat(32769), /bounded/], ['syntax refusal', 'export default function Broken(', /syntax/],
  ['foreign import', "import x from 'evil'; export default ()=>null", /dependency/],
  ['dynamic import', "export default ()=>import('react')", /dependency/],
  ['forwarded dependency', "export {x} from 'react'", /dependency/],
]) { await assert.rejects(compileUi(text), pattern); controls.push(name); }
const compiled = await compileUi(original);
assert.equal(compiled.bundleDigest, createHash('sha256').update(compiled.bundle).digest('hex'));
assert.equal(compiled.sourceDigest, createHash('sha256').update(original).digest('hex'));
assert(compiled.css.includes('display: grid')); assert(compiled.bundle.length < 2097152);
assert(!new TextDecoder().decode(compiled.bundle).includes("from '@research/ui'")); controls.push('actual compiled bundle and digest/CSS');

const gates = new Map();
const app = await createJsxServer({ sourceGate: ({ identity, signal }) => new Promise((resolve, reject) => {
  const abort = () => reject(new Error('Cancelled source'));
  signal.addEventListener('abort', abort, { once: true });
  gates.set(identity.streamId, () => { signal.removeEventListener('abort', abort); resolve(); });
  if (signal.aborted) abort();
}) });
let browser, page;
const errors = [], csp = [], external = [], wire = [], consoleErrors = [], milestones = [];
const wait = async (read, label) => {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) { const value = await read(); if (value) return value; await new Promise((resolve) => setTimeout(resolve, 20)); }
  throw new Error(`Timeout: ${label}`);
};
const inspect = () => page.evaluate(() => window.JSX_UI.inspect());
const frameUI = () => page.frameLocator('#current iframe:not([hidden])');
const activeFrame = async () => wait(() => page.frames().find((frame) => frame.parentFrame()
  && frame.url().includes(`instanceId=${givenInstance}`)), 'active frame');
let givenInstance;
const start = async (variant = 'counter') => {
  const previous = app.records.length; await page.evaluate((value) => { void window.JSX_UI.start(value); }, variant);
  const run = await wait(() => app.records[previous], 'new source');
  if (variant !== 'invalid') { await wait(() => gates.has(run.streamId), 'source held');
    await wait(async () => (await inspect()).active?.state, 'frame initialized'); }
  return run;
};
const phase = (value) => page.waitForFunction((expected) => window.JSX_UI?.inspect().phase === expected, value);
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', (request) => { if (new URL(request.url()).origin !== app.url) external.push(request.url()); });
  page.on('response', (response) => { if (/\/bundle\//.test(response.url())) wire.push({ url: response.url(), type: response.headers()['content-type'] }); });
  await page.addInitScript(() => { window.CSP_ERRORS = []; document.addEventListener('securitypolicyviolation', (event) => window.CSP_ERRORS.push(event.violatedDirective)); });
  await page.goto(app.url); await page.waitForFunction(() => window.JSX_UI?.inspect().ready);
  const run = await start(); await phase('preview');
  const preview = await inspect(); givenInstance = preview.active.instanceId;
  const frame = await activeFrame();
  assert.equal(run.sourceComplete, false); assert.equal(run.moduleRecords, 1);
  const geometry = await frame.evaluate(() => {
    const card = getComputedStyle(document.querySelector('[data-node-id="card"]'));
    const layout = getComputedStyle(document.querySelector('[data-node-id="root"]'));
    let parentBlocked = false; try { void parent.document.body; } catch { parentBlocked = true; }
    return { padding: card.padding, display: layout.display, gap: layout.gap, parentBlocked };
  });
  assert.deepEqual(geometry, { padding: '22px', display: 'grid', gap: '10px', parentBlocked: true });
  assert.equal(await frameUI().getByRole('button', { name: '저장', exact: true }).isDisabled(), true);
  await frameUI().getByRole('button', { name: '더하기', exact: true }).click();
  await frameUI().getByLabel('이름', { exact: true }).fill('수진');
  await wait(async () => { const state = (await inspect()).active.state; return state.count === 3 && state.name === '수진'; }, 'local hook state');
  assert.equal(await frameUI().getByText('금액: 5400원', { exact: true }).count(), 1);
  const identity = { streamId: run.streamId, revision: run.revision, bundleDigest: preview.active.record.bundleDigest };
  assert.equal(await page.evaluate((value) => window.JSX_UI.probeSave(value), { ...identity, count: 3, name: '수진' }), 409);
  milestones.push({ kind: 'compiled-native-ui-local-state-before-source-completion', geometry, initialState: preview.active.record.initialState, selectedState: { count: 3, name: '수진' } });
  await page.screenshot({ path: path.join(output, 'jsx-preview.png') });
  await page.evaluate(() => window.JSX_UI.rerender({ count: 90, name: 'host hint' }));
  assert.equal(await frameUI().getByLabel('이름', { exact: true }).inputValue(), '수진');
  assert.equal(await frameUI().getByText('개수: 3', { exact: true }).count(), 1);
  gates.get(run.streamId)(); await phase('committed');
  await frameUI().getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('saved').textContent === '수진: 3');
  assert.deepEqual({ count: app.saves[0].count, name: app.saves[0].name }, { count: 3, name: '수진' });
  assert.equal(await page.evaluate((value) => window.JSX_UI.probeSave(value), { ...identity, count: 3, name: '수진' }), 409);
  milestones.push({ kind: 'same-module-hooks-preserved-final-save-once' });
  const before = await inspect();
  await page.evaluate((record) => window.postMessage({ type: 'state', instanceId: record.instanceId, bundleDigest: record.record.bundleDigest, state: { count: 99, name: 'forged' } }, location.origin), before.active);
  assert.deepEqual((await inspect()).active.state, before.active.state); milestones.push({ kind: 'foreign-window-bridge-state-ignored' });

  const replacement = await start('different');
  assert.notEqual(replacement.compiled.bundleDigest, run.compiled.bundleDigest);
  assert.deepEqual((await inspect()).active.state, { count: 2, name: '민지' });
  await page.getByRole('button', { name: '취소', exact: true }).click(); await phase('cancelled');
  assert.equal((await inspect()).active.instanceId, before.active.instanceId);
  assert.deepEqual((await inspect()).active.state, { count: 3, name: '수진' });
  assert.equal(await frameUI().getByLabel('이름', { exact: true }).inputValue(), '수진');
  await wait(() => replacement.cancelled, 'replacement cancellation');
  milestones.push({ kind: 'cancel-restores-exact-mounted-frame-and-hooks' });

  const invalid = await start('invalid'); await phase('error');
  assert.equal(invalid.failed, true); assert.equal(invalid.moduleRecords, 0);
  assert.equal((await inspect()).active.instanceId, before.active.instanceId);
  assert.deepEqual((await inspect()).active.state, { count: 3, name: '수진' });
  milestones.push({ kind: 'invalid-jsx-no-executable-replacement' });
  const different = await start('different'); gates.get(different.streamId)(); await phase('committed');
  assert.notEqual((await inspect()).active.instanceId, before.active.instanceId);
  assert.deepEqual((await inspect()).active.state, { count: 2, name: '민지' });
  assert.equal(await frameUI().getByText('금액: 4400원', { exact: true }).count(), 1);
  milestones.push({ kind: 'new-code-module-explicit-state-reset' });
  await page.screenshot({ path: path.join(output, 'jsx-new-module.png') });
  let blockedRoute;
  await page.route('**/bundle/*.js', (route) => { blockedRoute = route; });
  const previousRuns = app.records.length;
  await page.evaluate(() => { window.PENDING_JSX_START = window.JSX_UI.start(); });
  const mounting = await wait(() => app.records[previousRuns], 'pending frame source');
  await wait(() => gates.has(mounting.streamId) && blockedRoute, 'blocked frame bundle');
  gates.get(mounting.streamId)(); await wait(() => mounting.sourceComplete, 'source EOF before frame mount');
  assert.equal((await inspect()).active.state, null);
  await page.evaluate(() => window.JSX_UI.cancel());
  assert.equal(await page.evaluate(() => window.PENDING_JSX_START), false);
  await blockedRoute.abort().catch(() => {}); await page.unroute('**/bundle/*.js');
  milestones.push({ kind: 'cancel-after-EOF-before-mount-settles-start' });
  csp.push(...await page.evaluate(() => window.CSP_ERRORS));
  for (const item of page.frames().filter((value) => value.parentFrame())) csp.push(...await item.evaluate(() => window.CSP_ERRORS ?? []));
  assert.deepEqual(errors, []); assert.deepEqual(csp, []); assert.deepEqual(external, []);
  assert(wire.length >= 3); assert(wire.every((value) => value.type.startsWith('text/javascript')));
  const browserEvents = (await inspect()).events;
  await page.evaluate(() => window.JSX_UI.dispose());
  assert.equal(await page.locator('iframe').count(), 0);
  assert.equal(await page.evaluate(() => document.getElementById('start').onclick === null && !window.JSX_UI), true);
  milestones.push({ kind: 'owned-frame-listener-entrypoint-disposal' });
  const report = { status: 'passed', source: 'authored JSX modules; zero model/provider calls', browser: browser.version(),
    controls, milestones, runs: app.records, saves: app.saves, versions: compiled.versions, bundleBytes: compiled.bundle.length,
    cssBytes: Buffer.byteLength(compiled.css), sourceDigest: compiled.sourceDigest, bundleDigest: compiled.bundleDigest,
    networkBundles: wire, assetRequests: app.assetRequests, browserEvents, pageErrors: errors, cspErrors: csp, externalRequests: external,
    timingMeaning: 'same browser events; complete module before source terminal, not token-level JSX or model latency' };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, browser: report.browser, runs: app.records.length, controls: controls.length,
    milestones: milestones.length, versions: compiled.versions, bundleBytes: compiled.bundle.length, pageErrors: 0, cspErrors: 0, externalRequests: 0, report: path.join(output, 'report.json') }));
} catch (error) {
  let browserState = null;
  if (page) {
    browserState = await inspect().catch(() => null);
    for (const frame of page.frames()) csp.push(...await frame.evaluate(() => window.CSP_ERRORS ?? []).catch(() => []));
  }
  await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack, runs: app.records,
    assetRequests: app.assetRequests, browserState, consoleErrors, errors, csp, external, controls }, null, 2)); throw error;
} finally { await browser?.close(); await app.close(); }
