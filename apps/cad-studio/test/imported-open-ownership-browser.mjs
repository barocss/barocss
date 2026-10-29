// Actual public import routes with original native reads/replies held after completion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function installHold() {
  let armed = null, selected = null, resume = null;
  const events = [];
  const note = kind => events.push({ kind, sequence: events.length });
  for (const method of ['text', 'arrayBuffer']) {
    const native = Blob.prototype[method];
    Blob.prototype[method] = async function (...args) {
      const claim = armed?.method === method && this instanceof File && this.name === armed.name;
      if (claim) { armed = null; selected = { kind: method, fulfilled: false, returned: false }; }
      const value = await native.apply(this, args);
      if (claim) {
        selected.fulfilled = true; selected.length = method === 'text' ? value.length : value.byteLength;
        note('original-read-fulfilled'); await new Promise(resolve => { resume = resolve; });
        selected.returned = true; note('original-read-return');
      }
      return value;
    };
  }
  let owner = Worker.prototype;
  while (owner && !Object.getOwnPropertyDescriptor(owner, 'onmessage')) owner = Object.getPrototypeOf(owner);
  const descriptor = owner && Object.getOwnPropertyDescriptor(owner, 'onmessage');
  if (!descriptor?.set) throw new Error('Native Worker onmessage setter required');
  Object.defineProperty(Worker.prototype, 'onmessage', {
    configurable: true, get: descriptor.get,
    set(callback) {
      const receiver = { worker: this };
      descriptor.set.call(receiver.worker, function (event) {
        if (armed && ['stepMeshes', 'diagnose'].includes(armed.method) && Object.hasOwn(event.data ?? {}, armed.method === 'diagnose' ? 'diagnosis' : 'meshes')) {
          const method = armed.method; armed = null; selected = { kind: method, fulfilled: true, returned: false };
          note('original-worker-reply-held');
          resume = () => { selected.returned = true; note('original-worker-reply-delivered'); callback.call(receiver.worker, event); };
          return;
        }
        callback.call(receiver.worker, event);
      });
    },
  });
  window.__importHold = {
    arm(value) { if (armed || selected) throw new Error('Only one original return may be held'); armed = value; },
    release() { if (!resume) throw new Error('No original return is held'); note('release-requested'); const release = resume; resume = null; release(); },
    snapshot() { return { selected: selected && { ...selected }, events: events.slice() }; },
  };
}

for (const scenario of ['step-read-new', 'stl-read-new', 'direct-read-new', 'step-stage-new', 'step-stage-stop', 'mesh-dialog-new', 'mesh-diagnose-stop-retry']) {
  test(`A05 imported Open ownership: ${scenario}`, { timeout: 120000 }, async () => {
    assert.ok(process.env.CHROME && process.env.PW_DIR && process.env.A05_ARTIFACT_DIR, 'Chrome, Playwright and artifact directory required');
    const output = path.join(process.env.A05_ARTIFACT_DIR, scenario); await mkdir(output, { recursive: true });
    const report = { scenario, status: 'RUNNING', runnerProcess: process.pid, states: [], errors: [], boundary: 'Original native return scheduling only; public UI; no OS chooser/natural failure/general operation-Promise completion claim' };
    const persist = () => writeFile(path.join(output, 'receipt.json'), JSON.stringify(report, null, 2));
    const server = await createServer({ root: app, configFile: path.join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' }); await server.listen();
    const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
    let browser, context, page;
    try {
      browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
      context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }); await context.addInitScript(installHold);
      page = await context.newPage(); page.on('pageerror', error => report.errors.push(String(error)));
      await page.goto(server.resolvedUrls.local[0]);
      const ready = () => page.waitForFunction(() => { const b = window.__studioBodies?.(); return b?.fresh && b.massReady; }, null, { timeout: 30000 });
      await ready();
      assert.equal(await page.locator('.viewport').getAttribute('data-renderer'), 'webgpu');
      const newBox = async () => {
        await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
        await page.keyboard.press('b'); await page.locator('.hud').waitFor();
        for (const [label, value] of [['Width X', '8'], ['Depth Y', '9'], ['Height Z', '11']]) await page.locator('.hud .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input').fill(value);
        await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
        await page.locator('.hud button:text-is("Apply")').click(); await ready(); await page.locator('.doc-tab input').fill('C-current');
        await page.waitForFunction(() => {
          const d = window.__studioDoc, b = window.__studioBodies?.();
          return d.nodes.length === 2 && d.nodes[0].max[0] === 8 && d.nodes[0].max[1] === 9 && d.nodes[1].height === 11 && b?.massReady && Math.abs(b.bodies[0]?.volume - 792) < 1e-8;
        });
        await page.waitForFunction(() => localStorage.getItem('studio.recovery')?.includes('C-current'), null, { timeout: 15000 });
      };
      const snapshot = async label => {
        const state = await page.evaluate(() => {
          const history = document.querySelector('[aria-label="History"]');
          return { doc: window.__studioDoc, body: window.__studioBodies?.(), name: document.querySelector('.doc-tab input')?.value,
            dirty: !!document.querySelector('[aria-label="Unsaved changes"]'), recovery: localStorage.getItem('studio.recovery'),
            history: { present: !!history, type: history?.constructor.name ?? null, labels: [...(history?.querySelectorAll('button.hs') ?? [])].map(x => x.getAttribute('aria-label')) },
            working: document.querySelector('[aria-label="Working"]')?.textContent ?? null,
            units: document.querySelector('[aria-label="Mesh units"]')?.textContent ?? null,
            repair: document.querySelector('[aria-label="Mesh repair"]')?.textContent ?? null,
            toast: document.querySelector('.toast[role="alert"]')?.textContent ?? null };
        });
        report.states.push({ label, state, transport: await page.evaluate(() => window.__importHold.snapshot()) }); await persist();
        await page.screenshot({ path: path.join(output, `${label}.png`) }); return state;
      };
      await newBox(); const control = await snapshot('normal-current-control');
      assert.equal(control.history.present, true); assert.equal(control.history.type, 'HTMLDivElement'); assert.ok(control.history.labels.length > 0); assert.ok(control.history.labels.every(x => typeof x === 'string'));
      const stopRetry = scenario === 'mesh-diagnose-stop-retry';
      const mesh = scenario.startsWith('stl') || scenario.startsWith('mesh'), direct = scenario.startsWith('direct');
      const filename = mesh ? 'A.stl' : direct ? 'A.barocad' : 'A.step';
      const fixture = mesh ? '../../packages/barocss-cad-model/test/fixtures/block-cm.stl' : direct ? 'test/fixtures/study.barocad' : '../../packages/barocss-cad/conformance/a6/references/block-keepout/block.step';
      const bytes = await readFile(path.join(app, fixture)); await writeFile(path.join(output, filename), bytes);
      if (scenario !== 'mesh-dialog-new' && !stopRetry) await page.evaluate(value => window.__importHold.arm(value), { method: scenario.startsWith('step-stage') ? 'stepMeshes' : mesh ? 'arrayBuffer' : 'text', name: filename });
      await page.setInputFiles('input[aria-label="Model file"]', { name: filename, mimeType: 'application/octet-stream', buffer: bytes });
      if (scenario === 'mesh-dialog-new' || stopRetry) await page.getByRole('dialog', { name: 'Mesh units', exact: true }).waitFor();
      if (stopRetry) {
        await page.evaluate(() => window.__importHold.arm({ method: 'diagnose' }));
        await page.getByRole('dialog', { name: 'Mesh units', exact: true }).getByRole('button', { name: 'Open', exact: true }).click();
      }
      if (scenario !== 'mesh-dialog-new') await page.waitForFunction(() => window.__importHold.snapshot().selected?.fulfilled === true, null, { timeout: 30000 });
      await snapshot('original-return-held');
      if (scenario === 'step-stage-stop' || stopRetry) {
        await page.locator('[aria-label="Working"] [aria-label="Cancel the computation"]').click(); await ready();
      } else await newBox();
      await page.waitForFunction(retry => !document.querySelector('[aria-label="Working"]') && !!document.querySelector('[aria-label="Mesh units"]') === retry, stopRetry, { timeout: 15000 });
      const before = await snapshot('current-before-release');
      if (scenario !== 'mesh-dialog-new') {
        await page.evaluate(() => window.__importHold.release());
        await page.waitForFunction(() => window.__importHold.snapshot().selected?.returned === true);
      }
      // Original native event/return has reached the reviewed continuation; finite tasks/frames only.
      await page.evaluate(() => new Promise(resolve => { const channel = new MessageChannel(); channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); requestAnimationFrame(() => requestAnimationFrame(resolve)); }; channel.port2.postMessage(null); }));
      const after = await snapshot('current-after-release');
      assert.deepEqual(after, before, 'old import must not change current document/history/dialog/stage/notice/recovery');
      assert.equal(after.name, 'C-current'); assert.equal(after.body.fresh, true); assert.equal(after.body.massReady, true); assert.ok(Math.abs(after.body.bodies[0].volume - 792) < 1e-8);
      if (scenario === 'step-stage-stop') {
        await page.keyboard.press('Meta+z'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0); await ready();
        await page.keyboard.press('Meta+Shift+z'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 2); await ready();
        assert.deepEqual(await page.evaluate(() => window.__studioDoc), after.doc, 'stage Stop must preserve the public Undo/Redo entry');
        report.undoRedo = 'PUBLIC_UNDO_REDO_PRESERVED';
      }
      if (stopRetry) {
        await page.getByRole('dialog', { name: 'Mesh units', exact: true }).getByRole('button', { name: 'Open', exact: true }).click();
        await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'mesh' && window.__studioBodies?.().fresh && window.__studioBodies?.().massReady, null, { timeout: 30000 });
        await page.getByRole('dialog', { name: 'Mesh units', exact: true }).waitFor({ state: 'hidden' });
        report.retry = 'ORIGINAL_UNIT_QUESTION_RETRY_ACCEPTED'; await snapshot('retry-accepted');
      }
      assert.deepEqual(report.errors, []); report.status = 'PASS';
    } catch (error) {
      report.status = 'FAIL'; report.firstFailure = { message: error.message, stack: error.stack };
      if (page && !page.isClosed()) {
        report.failureState = await page.evaluate(() => ({ doc: window.__studioDoc, body: window.__studioBodies?.(), work: document.querySelector('[aria-label="Working"]')?.textContent ?? null, trace: window.__importHold?.snapshot(), text: document.body.innerText })).catch(cause => ({ captureError: String(cause) }));
        await page.screenshot({ path: path.join(output, 'failure.png') }).catch(cause => { report.failureScreenshotError = String(cause); });
      }
      throw error;
    }
    finally {
      if (context) { await context.close(); report.context = 'CLOSED'; }
      if (browser) { await browser.close(); report.browser = 'CLOSED'; }
      await server.close(); report.server = 'CLOSED'; await persist();
    }
  });
}
