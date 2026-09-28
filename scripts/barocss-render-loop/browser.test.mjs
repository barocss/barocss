import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
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

test('a late old state poll cannot replace the next visible screen', async () => {
  const { server, url } = await createLoopServer();
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(url, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Generate' }).click();
    await page.locator('[data-phase="ready"]').waitFor();
    let releaseOld, markHeld;
    const gate = new Promise((resolve) => { releaseOld = resolve; });
    const held = new Promise((resolve) => { markHeld = resolve; });
    let heldOnce = false;
    await page.route('**/api/state', async (route) => {
      if (heldOnce) return route.continue();
      heldOnce = true;
      const response = await route.fetch();
      const body = await response.body();
      markHeld();
      await gate;
      return route.fulfill({ status: 200, contentType: 'application/json', body });
    });
    await held;
    await page.locator('[data-node-id="name"] input').fill('Bea');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await page.getByText('Name: Bea').waitFor();
    releaseOld();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('[data-node-id="heading"]').textContent(), 'Profile saved');
    assert.equal(await page.locator('[data-phase="ready"]').count(), 1);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('late pending and cancelled polls cannot undo cancellation or restart', async () => {
  const neverFinish = () => new Promise(() => {});
  const { server, url } = await createLoopServer({ generate: (request) => request.kind === 'initial'
    ? generateMockScreen(request) : neverFinish() });
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Generate' }).click();
    await page.locator('[data-phase="ready"]').waitFor();
    await page.locator('[data-node-id="name"] input').fill('Bea');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await page.locator('[data-phase="action-pending"]').waitFor();

    async function holdOnePoll() {
      let release, held, finished;
      const gate = new Promise((resolve) => { release = resolve; });
      const seen = new Promise((resolve) => { held = resolve; });
      const done = new Promise((resolve) => { finished = resolve; });
      let used = false;
      const handler = async (route) => {
        if (used) return route.continue();
        used = true;
        const response = await route.fetch();
        const body = await response.body();
        held();
        await gate;
        await route.fulfill({ status: 200, contentType: 'application/json', body });
        finished();
      };
      await page.route('**/api/state', handler);
      await seen;
      return async () => { release(); await done; await page.unroute('**/api/state', handler); };
    }

    const releasePending = await holdOnePoll();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.locator('[data-phase="cancelled"]').waitFor();
    await releasePending();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('[data-phase="cancelled"]').count(), 1);
    const releaseCancelled = await holdOnePoll();
    await page.getByRole('button', { name: 'Restart' }).click();
    await page.locator('[data-phase="idle"]').waitFor();
    await releaseCancelled();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('[data-phase="idle"]').count(), 1);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('UTF-8 prompt and action name survive split HTTP body chunks', async () => {
  const calls = [];
  const { server, url } = await createLoopServer({ generate: async (request) => {
    calls.push(request);
    return generateMockScreen(request);
  } });
  try {
    const { token } = await (await fetch(`${url}/api/session`)).json();
    function splitPost(route, body, character) {
      const bytes = Buffer.from(JSON.stringify(body));
      const split = bytes.indexOf(Buffer.from(character)) + 1;
      assert(split > 0 && split < bytes.length);
      return new Promise((resolve, reject) => {
        const target = new URL(url);
        const request = http.request({ hostname: '127.0.0.1', port: Number(target.port), path: route,
          method: 'POST', headers: { host: target.host, origin: url,
            'x-session-token': token, 'content-type': 'application/json', 'transfer-encoding': 'chunked' } },
        (response) => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
        request.on('error', reject);
        request.write(bytes.subarray(0, split));
        setTimeout(() => request.end(bytes.subarray(split)), 5);
      });
    }
    async function waitFor(turn) {
      for (let count = 0; count < 30; count++) {
        const state = await (await fetch(`${url}/api/state`, { headers: { 'x-session-token': token } })).json();
        if (state.phase === 'ready' && state.turn === turn) return state;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.fail(`Screen turn ${turn} did not become ready`);
    }
    assert.equal(await splitPost('/api/start', { prompt: '이름 폼' }, '이'), 202);
    const firstState = await waitFor(1);
    assert.equal(calls[0].prompt, '이름 폼');
    assert.equal(await splitPost('/api/action', { action: 'save', revision: firstState.revision,
      input: { name: '이름' } }, '이'), 202);
    const nextState = await waitFor(2);
    assert.equal(calls[1].input.name, '이름');
    assert.equal(nextState.spec.elements.summary.props.text, 'Name: 이름');
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('live mode rejects changed prompt and name before generator dispatch', async () => {
  const calls = [];
  const { server, url } = await createLoopServer({ mode: 'local-cli',
    liveInputs: { prompt: 'Create a profile form', name: 'Bea' },
    generate: async (request) => { calls.push(request); return generateMockScreen(request); } });
  try {
    const { token } = await (await fetch(`${url}/api/session`)).json();
    const post = (route, body) => fetch(`${url}${route}`, { method: 'POST', headers: {
      origin: url, 'x-session-token': token, 'content-type': 'application/json',
    }, body: JSON.stringify(body) });
    assert.equal((await post('/api/start', { prompt: 'Different request' })).status, 403);
    assert.equal(calls.length, 0);
    assert.equal((await post('/api/start', { prompt: 'Create a profile form' })).status, 202);
    for (let attempt = 0; attempt < 30; attempt++) {
      const state = await (await fetch(`${url}/api/state`, { headers: { 'x-session-token': token } })).json();
      if (state.phase === 'ready') break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal((await post('/api/action', { action: 'save', revision: 1,
      input: { name: 'Other' } })).status, 403);
    assert.equal(calls.length, 1);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('registered save action works when the valid button label changes', async () => {
  const { server, url } = await createLoopServer({ generate: async (request) => {
    const result = await generateMockScreen(request);
    if (request.kind !== 'initial') return result;
    const spec = JSON.parse(result.specJson);
    spec.elements.save.props.label = 'Save';
    return { ...result, specJson: JSON.stringify(spec) };
  } });
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Generate' }).click();
    await page.locator('[data-phase="ready"]').waitFor();
    await page.locator('[data-node-id="name"] input').fill('Bea');
    await page.locator('[data-node-id="save"]').click();
    await page.getByText('Name: Bea', { exact: true }).waitFor();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
