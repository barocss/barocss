import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createAppServer } from './serve.mjs';
import { requestScreen } from './scenario.mjs';
const require = createRequire(process.env.PW_DIR ? `${process.env.PW_DIR}/package.json` : import.meta.url);
const { chromium } = require('playwright-core');
const reply = (request) => {
  const spec = requestScreen(request.target, request.input);
  if (request.target !== 'form') spec.elements.card.props.tone = 'dark';
  return { sessionId: request.sessionId, revision: request.revision, requestId: request.requestId, specJson: JSON.stringify(spec) };
};
const ready = (page, revision) => page.waitForFunction((wanted) => {
  const status = document.querySelector('[data-phase]');
  return status?.dataset.phase === 'ready' && Number(status.dataset.revision) === wanted;
}, revision);
async function open(app, width) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [], external = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => { window.CSP_EVENTS = []; document.addEventListener('securitypolicyviolation', (event) => window.CSP_EVENTS.push(event.violatedDirective)); });
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== app.url) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  await page.goto(app.url);
  await page.locator('[data-phase="idle"]').waitFor();
  return { browser, page, errors, external };
}
async function clean(page, errors, external) {
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  assert.deepEqual(await page.evaluate(() => window.CSP_EVENTS), []);
}
for (const width of [1200, 390]) test(`actual CSP browser request flow and owned runtime lifecycle at ${width}px`, async () => {
  const calls = [];
  const app = await createAppServer({ mode: 'injected-test', generate: (request) => { calls.push(request); return reply(request); } });
  const { browser, page, errors, external } = await open(app, width);
  try {
    await page.getByLabel('Screen request', { exact: true }).fill('이름과 주제 검토 폼 / request review');
    await page.getByRole('button', { name: 'Generate', exact: true }).click(); await ready(page, 1);
    const name = page.getByLabel('Request name', { exact: true }), topic = page.getByLabel('Request topic', { exact: true });
    await name.fill('Alice 민지'); await topic.fill('Coffee 커피');
    await topic.focus();
    await page.waitForFunction(() => window.AI_UI.diagnostics().polls >= 4);
    assert.equal(await topic.inputValue(), 'Coffee 커피');
    assert.equal(await name.inputValue(), 'Alice 민지');
    assert.equal(await topic.evaluate((element) => document.activeElement === element), true);
    const initialStyles = await page.locator('[data-node-id="card"]').evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor, padding: getComputedStyle(element).paddingTop,
    }));
    assert.equal(initialStyles.background, 'rgb(255, 255, 255)'); assert.equal(initialStyles.padding, '22px');
    assert.equal(await page.locator('[data-node-id="layout"]').evaluate((element) => getComputedStyle(element).display), 'grid');
    await page.getByRole('button', { name: 'review', exact: true }).focus(); await page.keyboard.press('Enter'); await ready(page, 2);
    const changedBackground = await page.locator('[data-node-id="card"]').evaluate((element) => getComputedStyle(element).backgroundColor);
    assert.notEqual(changedBackground, initialStyles.background);
    assert.match(await page.locator('[data-node-id="card"]').getAttribute('class'), /bg-slate-900/);
    await page.getByRole('button', { name: 'edit', exact: true }).click(); await ready(page, 3);
    assert.equal(await name.inputValue(), 'Alice 민지'); assert.equal(await topic.inputValue(), 'Coffee 커피');
    await topic.fill('Tea 차 두 잔');
    await page.getByRole('button', { name: 'review', exact: true }).click(); await ready(page, 4);
    await page.getByRole('button', { name: 'confirm', exact: true }).click(); await ready(page, 5);
    assert.equal(await page.locator('[data-node-id="topic-summary"]').textContent(), 'topic: Tea 차 두 잔');
    assert.equal(calls.length, 5); assert(calls.every((request) => request.screenRequest === '이름과 주제 검토 폼 / request review'));
    assert.deepEqual(calls[4].input, { draft: { name: 'Alice 민지', topic: 'Tea 차 두 잔' } });
    await page.waitForFunction(() => window.AI_UI.diagnostics().displays.length === 5);
    const nonceStyles = await page.locator('style').evaluateAll((elements) => elements.every((element) => element.nonce.length > 0));
    assert.equal(nonceStyles, true);
    const before = await page.evaluate(() => window.AI_UI.diagnostics());
    await page.evaluate(() => {
      const nonce = document.querySelector('meta[name="barocss-nonce"]').content;
      window.FOREIGN_RUNTIME = new window.BaroCSS.BrowserRuntime({ nonce, constructable: false, styleId: 'foreign-runtime', gc: false });
      window.AI_UI.dispose();
    });
    await page.waitForTimeout(160);
    const disposed = await page.evaluate(() => ({ ...window.AI_UI.diagnostics(), foreignDestroyed: window.FOREIGN_RUNTIME.getStats().isDestroyed }));
    assert.equal(disposed.runtimeDestroyed, true); assert.equal(disposed.stopped, true);
    assert.equal(disposed.polls, before.polls); assert.equal(disposed.foreignDestroyed, false);
    await page.evaluate(() => window.AI_UI.mount());
    await page.locator('[data-phase="ready"]').waitFor();
    assert.equal(await page.getByLabel('Screen request', { exact: true }).inputValue(), '이름과 주제 검토 폼 / request review');
    assert.equal(await page.locator('[data-node-id="layout"]').evaluate((element) => getComputedStyle(element).display), 'grid');
    assert.equal(await page.evaluate(() => window.AI_UI.diagnostics().runtimeDestroyed), false);
    await clean(page, errors, external);
    if (process.env.UI_RESULT_ROOT) {
      mkdirSync(process.env.UI_RESULT_ROOT, { recursive: true });
      writeFileSync(`${process.env.UI_RESULT_ROOT}/browser-${width}.json`, JSON.stringify({ source: 'injected-test', modelCalls: 0,
        width, node: process.version, browser: browser.version(), initialStyles, changedBackground, lifecycle: disposed,
        events: await page.evaluate(() => window.AI_UI.diagnostics()), cspViolations: [], errors, external }, null, 2));
      await page.screenshot({ path: `${process.env.UI_RESULT_ROOT}/browser-${width}.png` });
    }
  } finally { await browser.close(); await app.close(); }
});

test('pending, malformed, cancelled, restarted and stale state results retain authoritative screens', async () => {
  const calls = []; let lateResolve; let nextMode = 'pending';
  const app = await createAppServer({ mode: 'injected-test', generate: (request) => {
    calls.push(request);
    if (request.kind === 'initial') return reply(request);
    if (nextMode === 'pending') return new Promise((resolve) => { lateResolve = resolve; });
    if (nextMode === 'invalid') return { ...reply(request), specJson: '{' };
    return reply(request);
  } });
  const { browser, page, errors, external } = await open(app, 390);
  try {
    await page.getByRole('button', { name: 'Generate', exact: true }).click(); await ready(page, 1);
    await page.getByLabel('Request topic', { exact: true }).fill('Tea 차');
    await page.getByRole('button', { name: 'review', exact: true }).click(); await page.locator('[data-phase="action-pending"]').waitFor();
    assert.equal(await page.getByLabel('Request topic', { exact: true }).inputValue(), 'Tea 차');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.locator('[data-phase="cancelled"]').waitFor();
    const old = calls[1]; nextMode = 'invalid';
    await page.getByRole('button', { name: 'review', exact: true }).click(); await page.locator('[data-phase="failed"]').waitFor();
    assert.equal(await page.getByLabel('Request topic', { exact: true }).inputValue(), 'Tea 차');
    assert.equal(await page.getByRole('alert').textContent(), 'Generated screen is not JSON');
    nextMode = 'normal'; await page.getByRole('button', { name: 'review', exact: true }).click(); await ready(page, 4);
    lateResolve(reply(old)); await new Promise((resolve) => setImmediate(resolve));
    await page.waitForTimeout(120);
    assert.equal(await page.locator('[data-node-id="topic-summary"]').textContent(), 'topic: Tea 차');
    const { token } = await (await fetch(`${app.url}/api/session`)).json();
    const stale = await fetch(`${app.url}/api/action`, { method: 'POST', headers: { origin: app.url, 'content-type': 'application/json', 'x-session-token': token },
      body: JSON.stringify({ sessionId: old.sessionId, revision: old.revision, action: 'review' }) });
    assert.equal(stale.status, 409);
    // Hold an old review poll; restart must invalidate its browser ticket as well as server work.
    let release, held; const gate = new Promise((resolve) => { release = resolve; });
    const seen = new Promise((resolve) => { held = resolve; }); let once = false;
    await page.route('**/api/state', async (route) => {
      if (once) return route.continue(); once = true;
      const response = await route.fetch(), body = await response.body(); held(); await gate;
      await route.fulfill({ status: 200, contentType: 'application/json', body });
    });
    await seen; await page.getByRole('button', { name: 'Restart', exact: true }).click(); await page.locator('[data-phase="idle"]').waitFor();
    release(); await page.waitForTimeout(120);
    assert.equal(await page.locator('[data-phase="idle"]').count(), 1); assert.equal(app.session.snapshot().screenRequest, null);
    assert.equal(await page.locator('[data-node-id="card"]').count(), 0); assert.equal(calls.length, 4);
    await clean(page, errors, external);
  } finally { await browser.close(); await app.close(); }
});
