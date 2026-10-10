// One real-browser host-input flow with authored generation; zero model calls.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createAppServer } from './serve.mjs';
import { requestScreen } from './scenario.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const calls = [];
const app = await createAppServer({ mode: 'injected-test', generate(request) {
  calls.push(structuredClone({ input: request.input, action: request.action }));
  return { sessionId: request.sessionId, revision: request.revision, requestId: request.requestId,
    specJson: JSON.stringify(requestScreen(request.target, request.input)) };
} });
let browser;
try {
  browser = await chromium.launch({ headless: true });
  assert.equal(browser.version(), '148.0.7778.96');
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.setDefaultTimeout(5000);
  const errors = [], external = [], inputWrites = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/input') inputWrites.push(request.postDataJSON());
  });
  await page.addInitScript(() => {
    window.CSP_EVENTS = [];
    document.addEventListener('securitypolicyviolation', (event) => window.CSP_EVENTS.push(event.violatedDirective));
  });
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== app.url) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  const name = page.getByLabel('Request name', { exact: true });
  const topic = page.getByLabel('Request topic', { exact: true });
  const ready = (revision) => page.waitForFunction((wanted) => {
    const status = document.querySelector('[data-phase]');
    return status?.dataset.phase === 'ready' && Number(status.dataset.revision) === wanted;
  }, revision);
  const visible = (input) => page.waitForFunction((wanted) =>
    document.querySelector('[aria-label="Request name"]')?.value === wanted.draft.name
      && document.querySelector('[aria-label="Request topic"]')?.value === wanted.draft.topic, input);
  const hostUpdate = (input) => {
    const current = app.session.snapshot();
    assert.equal(app.session.updateInput({ sessionId: current.sessionId, revision: current.revision, input }).status, 200);
    assert.equal(app.session.snapshot().revision, current.revision);
  };
  const morePolls = async () => {
    const before = await page.evaluate(() => window.AI_UI.diagnostics().polls);
    await page.waitForFunction((wanted) => window.AI_UI.diagnostics().polls >= wanted + 3, before);
  };
  const remount = async (revision) => {
    await page.evaluate(() => { window.AI_UI.dispose(); window.AI_UI.mount(); });
    await ready(revision);
  };
  await page.goto(app.url); await page.locator('[data-phase="idle"]').waitFor();
  await page.getByRole('button', { name: 'Generate', exact: true }).click(); await ready(1);

  // A same-revision host edit must appear even when there was no local edit.
  const first = { draft: { name: 'Host 민지', topic: 'Host new 차' } };
  hostUpdate(first); await visible(first);
  assert.equal(calls.length, 1); assert.equal(inputWrites.length, 0);

  // Equivalent host values and ordinary polls must preserve an unsent local edit.
  await name.fill('Local 민지'); await topic.fill('Unsent 차');
  hostUpdate({ draft: { topic: first.draft.topic, name: first.draft.name } });
  await morePolls();
  assert.equal(await name.inputValue(), 'Local 민지'); assert.equal(await topic.inputValue(), 'Unsent 차');
  assert.equal(inputWrites.length, 0); assert.equal(calls.length, 1);

  // A changed host baseline invalidates the old local draft without a remount.
  const current = { draft: { name: 'Current 민지', topic: 'Current 차' } };
  hostUpdate(current); await visible(current); await remount(1); await visible(current);
  assert.deepEqual(app.session.snapshot().input, current);
  assert.equal(calls.length, 1); assert.equal(inputWrites.length, 0);
  await topic.fill('Submitted 차 두 잔'); await remount(1);
  assert.equal(await topic.inputValue(), 'Submitted 차 두 잔');
  const submitted = { draft: { name: current.draft.name, topic: 'Submitted 차 두 잔' } };
  await page.getByRole('button', { name: 'review', exact: true }).click(); await ready(2);
  assert.deepEqual(inputWrites.map((request) => request.input), [submitted]);
  assert.deepEqual(calls[1].input, submitted);
  assert.equal(await page.locator('[data-node-id="topic-summary"]').textContent(), 'topic: Submitted 차 두 잔');
  await page.getByRole('button', { name: 'edit', exact: true }).click(); await ready(3); await visible(submitted);
  await page.getByRole('button', { name: 'review', exact: true }).click(); await ready(4);
  await page.getByRole('button', { name: 'confirm', exact: true }).click(); await ready(5);
  assert.deepEqual(app.session.snapshot().input, submitted); assert.equal(calls.length, 5);
  assert.equal(await page.locator('[data-node-id="name-summary"]').textContent(), 'name: Current 민지');
  assert.equal(await page.locator('[data-node-id="topic-summary"]').textContent(), 'topic: Submitted 차 두 잔');

  await page.getByRole('button', { name: 'Restart', exact: true }).click(); await page.locator('[data-phase="idle"]').waitFor();
  await page.getByRole('button', { name: 'Generate', exact: true }).click(); await ready(7);
  await visible({ draft: { name: '민지', topic: '커피' } }); assert.equal(calls.length, 6);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  assert.deepEqual(await page.evaluate(() => window.CSP_EVENTS), []);
  await page.evaluate(() => window.AI_UI.dispose());
  console.log(JSON.stringify({ status: 'passed', source: 'authored injected generation; zero models', browser: browser.version(),
    generations: calls.length, sameRevisionHostVisible: true, equivalentHostPreservesLocal: true,
    changedHostInvalidatesLocal: true, submittedVisibleValues: true, remountRetained: true,
    restartClears: true, pageErrors: 0, csp: 0, external: 0 }));
} finally {
  if (browser) await browser.close();
  await app.close();
}
