import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { url, close } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_DIR ?? 'playwright-core');
const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(process.env.RESULT_ROOT ?? path.join(here, 'output/cleanup-corrected'));
await fs.mkdir(output, { recursive: true });
const pageErrors = [];
let browser;
let page;
const inspect = () => page.evaluate(() => window.fixture.inspect());
const visible = () => page.frameLocator('iframe:not([hidden])');

try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true });
  page = await browser.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/host.mjs', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.TEST_RUNTIME = runtime;\n` });
  });
  await page.goto(url);
  await page.waitForFunction(() => !!window.TEST_RUNTIME && !!window.fixture);

  await page.evaluate(() => { window.firstRun = window.fixture.start('base'); });
  await page.waitForFunction(() => window.fixture.inspect().phase === 'preview');
  await visible().getByRole('button', { name: 'Add' }).click();
  await visible().getByLabel('Name').fill('Sujin');
  await page.evaluate(() => window.fixture.finish());
  assert.equal(await page.evaluate(() => window.firstRun), true);
  await page.waitForFunction(() => window.fixture.inspect().phase === 'committed');
  await visible().getByRole('button', { name: 'Save' }).click();
  await page.waitForFunction(() => window.fixture.saves.length === 1);
  const committed = await inspect();
  assert.deepEqual(committed.active.state, { name: 'Sujin', count: 3 });
  const frameUrl = await page.locator('iframe').getAttribute('src');

  for (const mode of ['throw', 'reject', 'scalar']) {
    const result = await page.evaluate(async (cleanupMode) => {
      let cleanupCalls = 0;
      const iterator = {
        next: () => new Promise(() => {}),
        return: () => {
          cleanupCalls += 1;
          if (cleanupMode === 'throw') throw new Error('Iterator cleanup failed');
          if (cleanupMode === 'reject') return Promise.reject(new Error('Iterator cleanup rejected'));
          return undefined;
        },
      };
      const pending = window.TEST_RUNTIME.start({ [Symbol.asyncIterator]: () => iterator });
      let cancelError = null;
      try { window.TEST_RUNTIME.cancel(); } catch (error) { cancelError = error.message; }
      return { cancelError, admitted: await pending, cleanupCalls, snapshot: window.fixture.inspect() };
    }, mode);
    assert.equal(result.cancelError, null);
    assert.equal(result.admitted, false);
    assert.equal(result.cleanupCalls, 1);
    assert.equal(result.snapshot.phase, 'cancelled');
    assert.equal(result.snapshot.active.instanceId, committed.active.instanceId);
    assert.deepEqual(result.snapshot.active.state, committed.active.state);
    assert.equal(await page.locator('iframe').count(), 1);
    assert.equal(await page.locator('iframe').getAttribute('src'), frameUrl);
    assert.equal(await visible().getByLabel('Name').inputValue(), 'Sujin');
  }

  const completed = await page.evaluate(async () => {
    let replacedCleanupCalls = 0;
    let completedCleanupCalls = 0;
    const stale = {
      next: () => new Promise(() => {}),
      return: () => { replacedCleanupCalls += 1; throw new Error('Replaced iterator cleanup failed'); },
    };
    const replaced = window.TEST_RUNTIME.start({ [Symbol.asyncIterator]: () => stale });
    const item = await (await fetch('/manifest/different.json')).json();
    const identity = { streamId: 'cleanup_valid', revision: 999 };
    const module = { version: 1, seq: 1, type: 'module', phase: 'preview', ...identity,
      moduleId: item.moduleId, sourceDigest: item.sourceDigest, bundleDigest: item.bundleDigest,
      initialState: { name: 'Mina', count: 2 } };
    const commit = { version: 1, seq: 2, type: 'commit', ...identity, bundleDigest: item.bundleDigest };
    const steps = [{ value: module, done: false }, { value: commit, done: false }, { done: true }];
    const iterator = { next: () => Promise.resolve(steps.shift()),
      return: () => { completedCleanupCalls += 1; throw new Error('Completed iterator cleanup failed'); } };
    const admitted = await window.TEST_RUNTIME.start({ [Symbol.asyncIterator]: () => iterator });
    return { replaced: await replaced, admitted, replacedCleanupCalls, completedCleanupCalls };
  });
  assert.deepEqual(completed, { replaced: false, admitted: true,
    replacedCleanupCalls: 1, completedCleanupCalls: 1 });
  const next = await inspect();
  assert.equal(next.phase, 'committed');
  assert.notEqual(next.active.instanceId, committed.active.instanceId);
  assert.deepEqual(next.active.state, { name: 'Mina', count: 2 });
  await visible().getByRole('button', { name: 'Save' }).click();
  await page.waitForFunction(() => window.fixture.saves.length === 2);
  assert.deepEqual(pageErrors, []);
  const disposedPending = await page.evaluate(async () => {
    let cleanupCalls = 0;
    const pending = window.TEST_RUNTIME.start({ [Symbol.asyncIterator]: () => ({
      next: () => new Promise(() => {}),
      return: () => { cleanupCalls += 1; throw new Error('Disposed iterator cleanup failed'); },
    }) });
    window.TEST_RUNTIME.dispose();
    return { admitted: await pending, phase: window.fixture.inspect().phase, cleanupCalls };
  });
  assert.deepEqual(disposedPending, { admitted: false, phase: 'disposed', cleanupCalls: 1 });
  assert.equal(await page.locator('iframe').count(), 0);

  const report = { status: 'passed', browser: browser.version(),
    cleanupModes: ['throw', 'reject', 'scalar', 'replacement', 'normal completion', 'dispose'],
    restoredInstanceId: committed.active.instanceId,
    restoredState: committed.active.state, laterValidState: next.active.state,
    saves: await page.evaluate(() => window.fixture.saves.length), pageErrors };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, browser: report.browser,
    cleanupModes: report.cleanupModes, saves: report.saves, pageErrors: pageErrors.length }));
} catch (error) {
  await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({
    status: 'failed', message: error.message, stack: error.stack,
    snapshot: await inspect().catch(() => null), pageErrors,
  }, null, 2));
  throw error;
} finally {
  await browser?.close();
  await close();
}
