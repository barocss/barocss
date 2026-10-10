// One real-browser host lifecycle flow with authored generation; zero model calls.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createAppServer } from './serve.mjs';
import { requestScreen } from './scenario.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const calls = [];
const app = await createAppServer({ mode: 'injected-test', generate(request) {
  calls.push(structuredClone({ input: request.input, sessionId: request.sessionId, revision: request.revision, action: request.action }));
  return { sessionId: request.sessionId, revision: request.revision, requestId: request.requestId,
    specJson: JSON.stringify(requestScreen(request.target, request.input)) };
} });
let browser, releaseHeld;
try {
  browser = await chromium.launch({ headless: true });
  assert.equal(browser.version(), '148.0.7778.96');
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.setDefaultTimeout(5000);
  const errors = [], external = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.CSP_EVENTS = [];
    document.addEventListener('securitypolicyviolation', (event) => window.CSP_EVENTS.push(event.violatedDirective));
  });
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== app.url) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  const ready = (revision) => page.waitForFunction((wanted) => {
    const status = document.querySelector('[data-phase]');
    return status?.dataset.phase === 'ready' && Number(status.dataset.revision) === wanted;
  }, revision);
  const name = page.getByLabel('Request name', { exact: true });
  const topic = page.getByLabel('Request topic', { exact: true });
  const remount = async (revision) => {
    await page.evaluate(() => { window.AI_UI.dispose(); window.AI_UI.mount(); });
    await ready(revision);
  };
  await page.goto(app.url); await page.locator('[data-phase="idle"]').waitFor();
  await page.getByRole('button', { name: 'Generate', exact: true }).click(); await ready(1);
  const original = app.session.snapshot();
  await name.fill('Alice 민지'); await topic.fill('Unsent 차');
  assert.deepEqual(app.session.snapshot().input, original.input);

  // Hold one old root's poll. Its eventual response must not overwrite the new root.
  let markHeld;
  const seen = new Promise((resolve) => { markHeld = resolve; });
  const held = new Promise((resolve) => { releaseHeld = resolve; });
  let once = false;
  await page.route('**/api/state', async (route) => {
    if (once) return route.continue();
    once = true;
    const response = await route.fetch(), body = await response.body(); markHeld(); await held;
    try { await route.fulfill({ status: 200, contentType: 'application/json', body }); }
    catch { /* disposal can abort this owned request before its held response */ }
  });
  const heldTimeout = setTimeout(() => markHeld('timeout'), 5000);
  const heldResult = await seen; clearTimeout(heldTimeout); assert.notEqual(heldResult, 'timeout');
  const disposed = await page.evaluate(() => {
    const nonce = document.querySelector('meta[name="barocss-nonce"]').content;
    window.FOREIGN_RUNTIME = new window.BaroCSS.BrowserRuntime({ nonce, constructable: false, styleId: 'draft-foreign', gc: false });
    const input = document.querySelector('[aria-label="Request topic"]');
    // Dispose within the same task as the input event, before a later React render.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Immediate 차 두 잔');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    window.AI_UI.dispose();
    return { ...window.AI_UI.diagnostics(), foreignDestroyed: window.FOREIGN_RUNTIME.getStats().isDestroyed };
  });
  assert.equal(disposed.stopped, true); assert.equal(disposed.runtimeDestroyed, true); assert.equal(disposed.foreignDestroyed, false);
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => window.AI_UI.diagnostics().polls), disposed.polls);
  await page.evaluate(() => window.AI_UI.mount()); await ready(1);
  assert.equal(await name.inputValue(), 'Alice 민지', 'unsent name survives same-lineage remount');
  assert.equal(await topic.inputValue(), 'Immediate 차 두 잔', 'same-task input survives disposal');
  releaseHeld();
  await page.waitForFunction((before) => window.AI_UI.diagnostics().polls >= before + 3, disposed.polls);
  assert.equal(await topic.inputValue(), 'Immediate 차 두 잔');
  assert.equal(calls.length, 1); assert.deepEqual(app.session.snapshot().input, original.input);
  await page.unroute('**/api/state');

  await page.getByRole('button', { name: 'review', exact: true }).click(); await ready(2);
  assert.deepEqual(calls[1].input, { draft: { name: 'Alice 민지', topic: 'Immediate 차 두 잔' } });
  assert.equal(await page.locator('[data-node-id="topic-summary"]').textContent(), 'topic: Immediate 차 두 잔');
  await page.getByRole('button', { name: 'edit', exact: true }).click(); await ready(3);
  assert.equal(await name.inputValue(), 'Alice 민지'); assert.equal(await topic.inputValue(), 'Immediate 차 두 잔');

  // A same-revision authoritative host write invalidates the old local baseline.
  await topic.fill('Local obsolete 차');
  const current = app.session.snapshot();
  const authoritative = { draft: { name: 'Host 민지', topic: 'Server 차 update' } };
  assert.equal(app.session.updateInput({ sessionId: current.sessionId, revision: current.revision, input: authoritative }).status, 200);
  await remount(3);
  assert.equal(await name.inputValue(), authoritative.draft.name); assert.equal(await topic.inputValue(), authoritative.draft.topic);
  assert.equal(calls.length, 3);
  await topic.fill('Confirmed 차');
  // Object insertion order is not a change to the authoritative values.
  assert.equal(app.session.updateInput({ sessionId: current.sessionId, revision: current.revision,
    input: { draft: { topic: authoritative.draft.topic, name: authoritative.draft.name } } }).status, 200);
  await remount(3);
  assert.equal(await topic.inputValue(), 'Confirmed 차');
  await page.getByRole('button', { name: 'review', exact: true }).click(); await ready(4);
  await page.getByRole('button', { name: 'confirm', exact: true }).click(); await ready(5);
  assert.equal(await page.locator('[data-node-id="topic-summary"]').textContent(), 'topic: Confirmed 차');
  assert.equal(calls.length, 5);

  await page.getByRole('button', { name: 'Restart', exact: true }).click(); await page.locator('[data-phase="idle"]').waitFor();
  await page.getByRole('button', { name: 'Generate', exact: true }).click(); await ready(7);
  assert.notEqual(app.session.snapshot().sessionId, original.sessionId);
  assert.equal(await name.inputValue(), '민지'); assert.equal(await topic.inputValue(), '커피');
  await topic.fill('Discard after restart');
  await page.getByRole('button', { name: 'Restart', exact: true }).click(); await page.locator('[data-phase="idle"]').waitFor();
  await page.getByRole('button', { name: 'Generate', exact: true }).click(); await ready(9);
  await remount(9);
  assert.equal(await topic.inputValue(), '커피'); assert.equal(calls.length, 7);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  assert.deepEqual(await page.evaluate(() => window.CSP_EVENTS), []);
  await page.evaluate(() => window.AI_UI.dispose());
  const final = await page.evaluate(() => ({ ...window.AI_UI.diagnostics(), foreignDestroyed: window.FOREIGN_RUNTIME.getStats().isDestroyed }));
  assert.equal(final.stopped, true); assert.equal(final.runtimeDestroyed, true); assert.equal(final.foreignDestroyed, false);
  await page.evaluate(() => window.FOREIGN_RUNTIME.destroy());
  console.log(JSON.stringify({ status: 'passed', source: 'authored injected generation; zero models', browser: browser.version(),
    generations: calls.length, remountDraftRetained: true, hostBaselineInvalidates: true, restartClears: true,
    stalePollRejected: true, ownedDisposal: true, foreignRuntimePreserved: true, pageErrors: 0, csp: 0, external: 0 }));
} finally {
  releaseHeld?.();
  if (browser) await browser.close();
  await app.close();
}
