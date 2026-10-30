// Normal committed App mount/unmount through actual native module Workers; no StrictMode claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function observeWorkers() {
  const NativeWorker = window.Worker, records = [];
  window.Worker = class extends NativeWorker {
    constructor(url, options) { super(url, options); this.record = { url: String(url), terminations: 0 }; records.push({ worker: this, record: this.record }); }
    terminate() { this.record.terminations++; return super.terminate(); }
  };
  const owned = () => records.filter(row => /\/engine\/engine\.worker\.ts/.test(row.record.url));
  Object.assign(window, {
    __nativeEngineWorkers: () => owned().map(row => ({ ...row.record })),
    __failOwnedEngine() {
      const active = owned().filter(row => row.record.terminations === 0);
      if (active.length !== 1) throw new Error('Exactly one owned engine worker required');
      active[0].worker.dispatchEvent(new ErrorEvent('error', { message: 'A06 controlled Worker error' }));
    },
  });
}
test('A06 real App committed mount/unmount releases its owned native engine Worker', { timeout: 120000 }, async () => {
  assert.ok(process.env.CHROME && process.env.PW_DIR && process.env.A06_ARTIFACT_DIR, 'Actual Chrome/Playwright/output required');
  const output = process.env.A06_ARTIFACT_DIR; await mkdir(output, { recursive: true });
  const report = { status: 'RUNNING', runnerProcess: process.pid, states: [], errors: [], boundary: 'Real App with controlled React root; native Worker subclass delegates constructor/terminate. Public call counts, not heap or driver memory; no StrictMode/natural failure acceptance.' };
  const persist = () => writeFile(path.join(output, 'receipt.json'), JSON.stringify(report, null, 2));
  const server = await createServer({ root: app, configFile: path.join(app, 'vite.config.ts'), plugins: [{ name: 'owned-engine-lifecycle-entry', transformIndexHtml(html) { return html.replace('/src/main.tsx', '/test/fixtures/engine-lifecycle-entry.ts'); } }], server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  await server.listen();
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  let browser, context, page;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }); await context.addInitScript(observeWorkers);
    page = await context.newPage(); page.on('pageerror', error => report.errors.push(String(error)));
    await page.goto(server.resolvedUrls.local[0]);
    const ready = () => page.waitForFunction(() => { const state = window.__studioBodies?.(); return document.getElementById('root')?.childElementCount > 0 && document.querySelector('.viewport')?.dataset.renderer === 'webgpu' && window.__nativeEngineWorkers().filter(row => row.terminations === 0).length === 1 && state?.fresh && state.massReady && state.bodies.length > 0; }, null, { timeout: 30000 });
    const snapshot = async label => {
      const state = await page.evaluate(() => ({ workers: window.__nativeEngineWorkers(), doc: window.__studioDoc, bodies: window.__studioBodies?.(), rootEmpty: document.getElementById('root').childElementCount === 0 }));
      report.states.push({ label, ...state }); await persist(); await page.screenshot({ path: path.join(output, `${label}.png`) }); return state;
    };
    await ready(); assert.equal(await page.locator('.viewport').getAttribute('data-renderer'), 'webgpu');
    for (let cycle = 0; cycle < 3; cycle++) {
      if (cycle) { await page.evaluate(() => window.__engineLifecycle.mount()); await ready(); }
      const before = await snapshot(`mounted-${cycle}`);
      assert.equal(before.workers.length, cycle + 1, 'one native engine worker for each committed App');
      assert.equal(before.workers.filter(row => row.terminations === 0).length, 1);
      await page.evaluate(() => window.__engineLifecycle.unmount());
      const after = await snapshot(`unmounted-${cycle}`);
      assert.equal(after.rootEmpty, true); assert.equal(after.workers.length, before.workers.length);
      assert.ok(after.workers.every(row => row.terminations === 1), 'each retired native engine worker terminated exactly once');
    }
    const idle = await page.evaluate(async () => {
      const before = window.__nativeEngineWorkers().length;
      const { EngineClient } = await import('/src/engine/client.ts');
      const client = new EngineClient(); const constructed = window.__nativeEngineWorkers().length;
      client.dispose(); client.dispose();
      return { before, constructed, disposed: window.__nativeEngineWorkers().length };
    });
    assert.equal(idle.constructed, idle.before); assert.equal(idle.disposed, idle.before); report.unusedConstructor = idle;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal((await snapshot('normal-unmount-no-revival')).workers.length, 3);
    await page.evaluate(() => window.__engineLifecycle.mount()); await ready();
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await page.keyboard.press('b'); await page.locator('.hud').waitFor();
    for (const [label, value] of [['Width X', '8'], ['Depth Y', '9'], ['Height Z', '11']]) await page.locator('.hud .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input').fill(value);
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
    await page.locator('.hud button:text-is("Apply")').click(); await ready();
    await page.locator('.doc-tab input').fill('A06-current');
    await page.waitForFunction(() => localStorage.getItem('studio.recovery')?.includes('A06-current'));
    const beforeFailure = await snapshot('before-controlled-error');
    await page.evaluate(() => window.__failOwnedEngine());
    await page.getByRole('button', { name: 'Retry engine', exact: true }).waitFor();
    await page.waitForFunction(() => window.__studioBodies?.().fresh === false);
    const failed = await snapshot('after-controlled-error');
    assert.deepEqual(failed.doc, beforeFailure.doc, 'Worker failure preserves accepted document');
    assert.equal(failed.workers.length, 4, 'failure does not silently create another worker');
    assert.ok(failed.workers.every(row => row.terminations === 1), 'failure retires the owned worker');
    await page.getByRole('button', { name: 'Retry engine', exact: true }).click(); await ready();
    const retried = await snapshot('after-public-retry');
    assert.deepEqual(retried.doc, beforeFailure.doc); assert.equal(retried.workers.length, 5);
    assert.equal(retried.workers.filter(row => row.terminations === 0).length, 1);
    assert.ok(Math.abs(retried.bodies.bodies[0].volume - 792) < 1e-8);
    await page.keyboard.press('Meta+z'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0 && window.__studioBodies?.().fresh && window.__studioBodies?.().massReady);
    await page.keyboard.press('Meta+Shift+z'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 2); await ready();
    assert.deepEqual(await page.evaluate(() => window.__studioDoc), beforeFailure.doc, 'public retry preserves the original Undo/Redo entry');
    report.publicUndoRedo = 'PRESERVED';
    await page.evaluate(() => window.__engineLifecycle.unmount());
    const final = await snapshot('final-no-revival');
    assert.ok(final.rootEmpty); assert.ok(final.workers.every(row => row.terminations === 1));
    report.failureBoundary = 'Controlled ErrorEvent delivered to original native Worker handler; no natural OS/driver failure claim';
    assert.deepEqual(report.errors, []); report.status = 'PASS';
  } catch (error) {
    report.status = 'FAIL'; report.firstFailure = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    if (context) { await context.close(); report.context = 'CLOSED'; }
    if (browser) { await browser.close(); report.browser = 'CLOSED'; }
    await server.close(); report.server = 'CLOSED'; await persist();
  }
});
