import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createLoopServer } from './serve.mjs';
import { generateMockScreen } from './mock.mjs';

const fromPW = createRequire(path.join(process.env.PW_DIR ?? '/missing', 'package.json'));
const { chromium } = fromPW('playwright-core');
const chrome = process.env.CHROME ?? chromium.executablePath();
const resultDir = process.env.RESULT_DIR;

test('loopback browser renders two authored mock screens after one allowed action', async () => {
  assert(fs.existsSync(chrome), `Missing approved Chromium: ${chrome}`);
  const calls = [];
  const { server, url } = await createLoopServer({ generate: async (request) => {
    calls.push(request);
    return generateMockScreen(request);
  } });
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    const unauthorized = await fetch(`${url}/api/start`, { method: 'POST', headers: {
      origin: 'https://untrusted.example', 'x-session-token': 'wrong', 'content-type': 'application/json',
    }, body: JSON.stringify({ prompt: 'Make a profile form' }) });
    assert.equal(unauthorized.status, 403);
    const { token } = await (await fetch(`${url}/api/session`)).json();
    const wrongOrigin = await fetch(`${url}/api/start`, { method: 'POST', headers: {
      origin: 'https://untrusted.example', 'x-session-token': token, 'content-type': 'application/json',
    }, body: JSON.stringify({ prompt: 'Make a profile form' }) });
    assert.equal(wrongOrigin.status, 403);
    const wrongToken = await fetch(`${url}/api/start`, { method: 'POST', headers: {
      origin: url, 'x-session-token': 'wrong', 'content-type': 'application/json',
    }, body: JSON.stringify({ prompt: 'Make a profile form' }) });
    assert.equal(wrongToken.status, 403);
    assert.equal(calls.length, 0);
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const errors = [], external = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (!request.url().startsWith(url)) external.push(request.url()); });
    await page.goto(url, { waitUntil: 'load' });
    await page.getByText('Authored mock. No model runs.').waitFor();
    await page.getByRole('button', { name: 'Generate' }).click();
    await page.locator('[data-phase="ready"]').waitFor();
    assert.equal(await page.locator('[data-node-id="heading"]').textContent(), 'Profile settings');
    await page.locator('[data-node-id="name"] input').fill('Bea');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await page.getByText('Name: Bea').waitFor();
    const state = await page.evaluate(async () => {
      const { token } = await (await fetch('/api/session')).json();
      return (await fetch('/api/state', { headers: { 'x-session-token': token } })).json();
    });
    assert.equal(state.phase, 'ready');
    assert.equal(state.revision, 2);
    assert.equal(state.turn, 2);
    assert.equal(state.name, 'Bea');
    assert.equal(Object.hasOwn(state, 'threadId'), false);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].kind, 'initial');
    assert.equal(calls[1].kind, 'next');
    assert.deepEqual(calls[1].input, { name: 'Bea' });
    await page.waitForFunction(() => window.LOOP_METRICS.sampleCount === 2);
    const metrics = await page.evaluate(() => window.LOOP_METRICS);
    assert(metrics.firstVisibleMs >= 0);
    assert(metrics.actionToNextVisibleMs >= 0);
    if (resultDir) {
      fs.mkdirSync(resultDir, { recursive: true });
      await page.screenshot({ path: path.join(resultDir, 'mock-next-screen.png') });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('pending action freezes input; cancellation and restart reject late or stale work', async () => {
  let finishNext;
  const delayed = new Promise((resolve) => { finishNext = resolve; });
  const calls = [];
  const { server, url } = await createLoopServer({ generate: (request) => {
    calls.push(request);
    return request.kind === 'initial' ? generateMockScreen(request) : delayed;
  } });
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(url, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Generate' }).click();
    await page.locator('[data-phase="ready"]').waitFor();
    await page.locator('[data-node-id="name"] input').fill('Bea');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await page.locator('[data-phase="action-pending"]').waitFor();
    assert.equal(await page.locator('[data-node-id="name"] input').isDisabled(), true);
    const { token } = await (await fetch(`${url}/api/session`)).json();
    const duplicate = await fetch(`${url}/api/action`, { method: 'POST', headers: {
      origin: url, 'x-session-token': token, 'content-type': 'application/json',
    }, body: JSON.stringify({ action: 'save', revision: 1, input: { name: 'Changed while pending' } }) });
    assert.equal(duplicate.status, 409);
    assert.equal(calls.length, 2);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.locator('[data-phase="cancelled"]').waitFor();
    finishNext(await generateMockScreen({ kind: 'next', input: { name: 'Wrong' } }));
    await page.waitForTimeout(150);
    assert.equal(await page.locator('[data-node-id="heading"]').textContent(), 'Profile settings');
    assert.equal(await page.locator('[data-node-id="name"] input').inputValue(), 'Bea');
    await page.getByRole('button', { name: 'Restart' }).click();
    await page.locator('[data-phase="idle"]').waitFor();
    await page.getByRole('button', { name: 'Generate' }).click();
    await page.locator('[data-phase="ready"]').waitFor();
    const stale = await fetch(`${url}/api/action`, { method: 'POST', headers: {
      origin: url, 'x-session-token': token, 'content-type': 'application/json',
    }, body: JSON.stringify({ action: 'save', revision: 1, input: { name: 'Bea' } }) });
    assert.equal(stale.status, 409);
    assert.equal(calls.length, 3);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
