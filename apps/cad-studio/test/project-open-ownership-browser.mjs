// D326 final: original native read A waits while a newer public document/session owner completes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function installReadHold({ projectName, inputName }) {
  const directories = new WeakMap(), handles = new WeakMap(), files = new WeakMap(), inspected = new WeakSet(), events = [];
  const namespace = `projects/${projectName}/`, nativeRoot = Object.getPrototypeOf(navigator.storage).getDirectory;
  let armed = null, selected = null, release; const hold = new Promise(resolve => { release = resolve; });
  const own = name => typeof name === 'string' && (name.startsWith(namespace) || name === `input:${inputName}`);
  const scope = receiver => inspected.has(receiver) ? 'inspection' : 'production';
  const log = (kind, data) => events.push({ sequence: events.length, kind, ...data });
  Object.getPrototypeOf(navigator.storage).getDirectory = async function (...args) { const result = await nativeRoot.apply(this, args); directories.set(result, ''); return result; };
  const directory = FileSystemDirectoryHandle.prototype, nativeDirectory = directory.getDirectoryHandle, nativeHandle = directory.getFileHandle;
  directory.getDirectoryHandle = async function (name, ...args) {
    const parent = directories.get(this), at = parent === undefined ? null : parent ? `${parent}/${name}` : name, origin = scope(this);
    try { const result = await nativeDirectory.call(this, name, ...args); if (at !== null) directories.set(result, at); if (inspected.has(this)) inspected.add(result);
      if (own(at)) log('directory-result', { path: at, scope: origin, error: null }); return result;
    } catch (error) { if (own(at)) log('directory-result', { path: at, scope: origin, error: error.name }); throw error; }
  };
  directory.getFileHandle = async function (name, ...args) {
    const parent = directories.get(this), at = parent === undefined ? null : parent ? `${parent}/${name}` : name, origin = scope(this);
    try { const result = await nativeHandle.call(this, name, ...args); if (at !== null) handles.set(result, at); if (inspected.has(this)) inspected.add(result);
      if (own(at)) log('file-handle-result', { path: at, scope: origin, error: null }); return result;
    } catch (error) { if (own(at)) log('file-handle-result', { path: at, scope: origin, error: error.name }); throw error; }
  };
  const nativeFile = FileSystemFileHandle.prototype.getFile;
  FileSystemFileHandle.prototype.getFile = async function (...args) { const result = await nativeFile.apply(this, args), at = handles.get(this); if (at !== undefined) files.set(result, at); if (inspected.has(this)) inspected.add(result); return result; };
  const nativeArrayBuffer = Blob.prototype.arrayBuffer;
  Blob.prototype.arrayBuffer = async function (...args) {
    const at = files.get(this) ?? (this instanceof File && this.name === inputName ? `input:${inputName}` : undefined), origin = scope(this), claimed = at === armed && origin === 'production';
    if (claimed) { armed = null; selected = { path: at, fulfilled: false, returned: false, byteLength: null }; }
    const result = await nativeArrayBuffer.apply(this, args);
    if (claimed) { selected.fulfilled = true; selected.byteLength = result.byteLength; selected.bytes = Array.from(new Uint8Array(result)); log('native-read-held', { path: at }); await hold; selected.returned = true; }
    if (own(at)) log('native-read-return', { path: at, scope: origin, byteLength: result.byteLength }); return result;
  };
  window.__d326 = {
    arm(at) { if (!own(at) || armed || selected) throw new Error('Only one original native file read may be held'); armed = at; },
    release() { log('release-requested', {}); release(); },
    snapshot() { return { namespace, selected: selected && { ...selected }, events: events.slice() }; },
    async inspectRoot() { const root = await nativeRoot.call(navigator.storage); directories.set(root, ''); inspected.add(root); return root; },
  };
}

for (const scenario of ['project-to-B', 'project-to-new', 'project-to-close', 'file-to-new', 'file-to-project-B']) {
test(`D326 late Open ownership: ${scenario}`, { timeout: 120000 }, async () => {
  assert.ok(process.env.CHROME && process.env.PW_DIR && process.env.D326_ARTIFACT_DIR, 'Actual Chrome, Playwright and artifact directory required');
  const output = path.join(process.env.D326_ARTIFACT_DIR, scenario); await mkdir(output, { recursive: true });
  const inputName = 'D326-input-A.bcad', fromInput = scenario.startsWith('file-');
  const projectName = `d326-open-${randomUUID()}`, namespace = `projects/${projectName}/`, target = `${namespace}A.bcad`;
  const report = { status: 'RUNNING', scenario, baseline: 'f841c0c34', runnerProcess: process.pid, projectName, namespace, target, states: [], errors: [] }, cleanup = {};
  const persist = () => writeFile(path.join(output, 'receipt.json'), JSON.stringify(report, null, 2));
  const server = await createServer({ root: app, configFile: path.join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' }); await server.listen();
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  let browser, context, page, phase = 'startup', measured = false;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }); await context.addInitScript(installReadHold, { projectName, inputName }); page = await context.newPage();
    page.on('pageerror', error => report.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    await page.goto(server.resolvedUrls.local[0]);
    const ready = () => page.waitForFunction(() => { const value = window.__studioBodies?.(); return value?.fresh && value.massReady; }, null, { timeout: 30000 });
    const readyB = () => page.waitForFunction(() => {
      const doc = window.__studioDoc, body = window.__studioBodies?.();
      return doc?.nodes?.length === 2 && doc.nodes[0].kind === 'sketch' && doc.nodes[0].max[0] === 12 && doc.nodes[0].max[1] === 13 && doc.nodes[1].kind === 'extrude' && doc.nodes[1].height === 14 &&
        body?.fresh === true && body.massReady === true && body.bodies.length === 1 && Number.isFinite(body.bodies[0].volume) && Math.abs(body.bodies[0].volume - 2184) < 1e-8;
    }, null, { timeout: 30000 });
    const snapshot = async label => {
      const state = await page.evaluate(async ({ label, projectName }) => {
        const root = await window.__d326.inspectRoot(), project = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
        const read = async name => { const file = await (await project.getFileHandle(name)).getFile(); return { tag: `${file.size}-${file.lastModified}`, bytes: Array.from(new Uint8Array(await file.arrayBuffer())) }; };
        const history = document.querySelector('[aria-label="History"]');
        return { label, doc: window.__studioDoc, body: window.__studioBodies?.(), fileName: document.querySelector('.doc-tab input')?.value,
          dirty: !!document.querySelector('[aria-label="Unsaved changes"]'), recovery: localStorage.getItem('studio.recovery'),
          history: { present: history !== null, type: history?.constructor.name ?? null, rows: [...(history?.querySelectorAll('button.hs') ?? [])].map(row => ({ tag: row.tagName, label: row.getAttribute('aria-label'), index: row.getAttribute('data-node-index') })) },
          project: document.querySelector('[aria-label="Project"]')?.textContent ?? null,
          activePath: document.querySelector('[aria-label="Project documents"] [data-active="true"]')?.textContent ?? null,
          versions: [...document.querySelectorAll('[aria-label="Versions"] > li')].map(row => row.getAttribute('aria-label')),
          offered: document.querySelector('[aria-label="Autosaved work"]')?.textContent ?? null,
          nativeA: await read('A.bcad'), nativeB: await read('B.bcad'), trace: window.__d326.snapshot() };
      }, { label, projectName });
      for (const key of ['nativeA', 'nativeB']) { const name = `${label}-${key}.bcad`; await writeFile(path.join(output, name), new Uint8Array(state[key].bytes)); state[key].bytesFile = name; delete state[key].bytes; }
      if (state.trace.selected?.bytes) { await writeFile(path.join(output, 'held-original-A.bcad'), new Uint8Array(state.trace.selected.bytes)); delete state.trace.selected.bytes; state.trace.selected.bytesFile = 'held-original-A.bcad'; }
      report.states.push(state); await persist(); await page.screenshot({ path: path.join(output, `${label}.png`) }); return state;
    };
    const newBox = async (name, dimensions) => {
      await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0); await page.keyboard.press('b'); await page.waitForSelector('.hud');
      for (const [label, value] of [['Width X', dimensions[0]], ['Depth Y', dimensions[1]], ['Height Z', dimensions[2]]]) await page.locator('.hud .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input').fill(String(value));
      await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 }); await page.locator('.hud button', { hasText: 'Apply' }).click(); await ready(); await page.locator('.doc-tab input').fill(name);
    };
    const card = page.locator('[aria-label="Versions panel"]');
    const makeVersion = async name => { await card.locator('[aria-label="Version name"]').fill(name); await card.locator('[aria-label="Make version"]').click(); await page.waitForSelector(`[aria-label="Version ${name}"]`, { timeout: 15000 }); };
    await ready(); phase = 'author genuine saved A and B project versions';
    await newBox('A', [10,10,10]); await page.click('[aria-label="Project and versions"]'); await card.waitFor();
    await card.locator('[aria-label="Browser project name"]').fill(projectName); await card.locator('[aria-label="Project in this browser"]').click(); await card.locator('[aria-label="Project"]').waitFor(); await makeVersion('A-version');
    await newBox('B', [12,13,14]); await makeVersion('B-version');
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await card.locator('[aria-label="Open B.bcad"]').click(); await ready(); await page.waitForSelector('[aria-label="Version B-version"]'); await readyB();
    const control = await snapshot('normal-B-control');
    assert.equal(control.body.fresh, true); assert.equal(control.body.massReady, true); assert.equal(control.body.bodies.length, 1);
    assert.equal(control.doc.nodes[0].max[0], 12); assert.equal(control.doc.nodes[0].max[1], 13); assert.equal(control.doc.nodes[1].height, 14);
    assert.equal(control.fileName, 'B'); assert.equal(control.activePath, 'B.bcad'); assert.ok(Math.abs(control.body.bodies[0].volume - 2184) < 1e-8);
    assert.equal(control.history.present, true); assert.equal(control.history.type, 'HTMLDivElement'); assert.ok(control.history.rows.length > 0); assert.ok(control.history.rows.every(row => row.tag === 'BUTTON' && typeof row.label === 'string'));
    phase = 'prepare reachable newer owner before holding A';
    if (scenario !== 'project-to-close') { await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0); }
    const heldTarget = fromInput ? `input:${inputName}` : target;
    await page.evaluate(target => window.__d326.arm(target), heldTarget);
    if (fromInput) {
      const actualA = await readFile(path.join(output, control.nativeA.bytesFile));
      await page.setInputFiles('input[aria-label="Model file"]', { name: inputName, mimeType: 'application/json', buffer: actualA });
    } else await card.locator('[aria-label="Open A.bcad"]').click();
    await page.waitForFunction(() => window.__d326.snapshot().selected?.fulfilled === true, null, { timeout: 15000 }); await snapshot('A-read-held');
    if (scenario === 'project-to-new' || scenario === 'file-to-new') {
      phase = 'new public document C with complete local recovery';
      await newBox('C-current', [8,9,11]);
      await page.waitForFunction(() => {
        const doc = window.__studioDoc, body = window.__studioBodies?.(), raw = localStorage.getItem('studio.recovery');
        if (!raw || doc?.nodes?.[0]?.max?.[0] !== 8 || doc.nodes[0].max[1] !== 9 || doc.nodes[1]?.height !== 11) return false;
        const recovery = JSON.parse(raw); return recovery.fileName === 'C-current' && JSON.stringify(recovery.doc) === JSON.stringify(doc) && body?.fresh === true && body.massReady === true && body.bodies.length === 1 && Math.abs(body.bodies[0].volume - 792) < 1e-8;
      }, null, { timeout: 30000 });
    } else if (scenario === 'project-to-close') {
      phase = 'public Close project with current B document';
      await card.locator('[aria-label="Close project"]').click(); await card.locator('[aria-label="Project"]').waitFor({ state: 'detached' }); await readyB();
    } else {
      phase = 'complete newer public Open B'; await card.locator('[aria-label="Open B.bcad"]').click(); await page.waitForSelector('[aria-label="Version B-version"]'); await readyB();
    }
    const before = await snapshot('current-before-A-release');
    assert.equal(before.body.fresh, true); assert.equal(before.body.massReady, true); assert.equal(before.body.bodies.length, 1);
    assert.equal(before.history.present, true); assert.equal(before.history.type, 'HTMLDivElement'); assert.ok(before.history.rows.length > 0);
    if (scenario.endsWith('new')) { assert.equal(before.fileName, 'C-current'); assert.equal(before.activePath, null); assert.ok(before.recovery); assert.ok(Math.abs(before.body.bodies[0].volume - 792) < 1e-8); }
    else { assert.deepEqual(before.doc, control.doc); assert.equal(before.fileName, 'B'); assert.ok(Math.abs(before.body.bodies[0].volume - 2184) < 1e-8); assert.equal(before.activePath, scenario === 'project-to-close' ? null : 'B.bcad'); }
    phase = 'forward original native read and drain its reviewed plain-JSON continuation';
    await page.evaluate(() => window.__d326.release());
    await page.waitForFunction(target => {
      const events = window.__d326.snapshot().events, release = events.find(event => event.kind === 'release-requested');
      return release && events.some(event => event.kind === 'native-read-return' && event.path === target && event.scope === 'production' && event.sequence > release.sequence);
    }, heldTarget, { timeout: 15000 });
    report.completion = await page.evaluate(() => new Promise(resolve => {
      const channel = new MessageChannel(); channel.port1.onmessage = () => {
        channel.port1.close(); channel.port2.close();
        resolve({ nativeReturnObserved: window.__d326.snapshot().selected?.returned === true, nextTaskAfterMicrotasks: true, operationPromise: 'NOT_EXPOSED', sourceBoundary: 'Asset-free JSON: project readPart decoding drains microtasks then stale guard returns; App input guard returns directly after arrayBuffer. No old metadata tail required.' });
      }; channel.port2.postMessage(null);
    }));
    await ready(); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const after = await snapshot('after-A-release'); measured = true;
    report.observed = { liveDocEqualsCurrent: JSON.stringify(after.doc) === JSON.stringify(before.doc), fileName: after.fileName, activePath: after.activePath, versions: after.versions, historyPresent: after.history.present, historyType: after.history.type };
    report.status = report.observed.liveDocEqualsCurrent ? 'OBSERVATIONS_COMPLETE' : 'BASELINE_REPRODUCED_PRODUCT_FAIL'; await persist();
    phase = 'safe ownership assertions after original snapshots and bytes';
    assert.deepEqual(await readFile(path.join(output, after.nativeB.bytesFile)), await readFile(path.join(output, before.nativeB.bytesFile)), 'late reads must leave actual saved B bytes unchanged');
    assert.deepEqual(await readFile(path.join(output, 'held-original-A.bcad')), await readFile(path.join(output, control.nativeA.bytesFile)), 'held native/file-input A must retain actual UI-authored A bytes');
    assert.equal(after.history.present, true); assert.equal(after.history.type, 'HTMLDivElement'); assert.ok(after.history.rows.length > 0);
    assert.deepEqual(after.doc, before.doc, scenario === 'project-to-B' ? 'late native Open A must not replace completed public Open B' : 'late Open A must not replace the current public document owner');
    assert.equal(after.fileName, before.fileName); assert.equal(after.activePath, before.activePath); assert.equal(after.project, before.project); assert.deepEqual(after.versions, before.versions); assert.deepEqual(after.history, before.history);
    assert.equal(after.body.fresh, true); assert.equal(after.body.massReady, true); assert.equal(after.body.bodies.length, 1); assert.ok(Math.abs(after.body.bodies[0].volume - before.body.bodies[0].volume) < 1e-8);
    assert.equal(after.dirty, before.dirty); assert.equal(after.recovery, before.recovery); assert.equal(after.offered, before.offered); assert.deepEqual(report.errors, []);
    report.status = 'SAFE_CONTRACT_PASS'; await persist();
  } catch (error) { report.failureClass = measured ? 'SAFE_OPEN_OWNERSHIP_CONTRACT_FAILURE' : 'SETUP_OR_SCHEDULE_FAILURE'; report.failure = { phase, message: error.message, stack: error.stack }; await persist(); throw error; }
  finally {
    if (page && !page.isClosed()) {
      try { await page.evaluate(() => window.__d326?.release());
        if (await page.locator('[aria-label="Close project"]').count()) await page.click('[aria-label="Close project"]');
        cleanup.namespace = await page.evaluate(async projectName => { const root = await window.__d326.inspectRoot(), projects = await root.getDirectoryHandle('projects'); await projects.removeEntry(projectName, { recursive: true }); try { await projects.getDirectoryHandle(projectName); return 'STILL_PRESENT'; } catch (error) { if (error.name === 'NotFoundError') return 'REMOVED_AND_ABSENT'; throw error; } }, projectName);
      } catch (error) { cleanup.error = String(error); }
    }
    if (context) await context.close(); if (browser) await browser.close(); await server.close(); cleanup.resources = 'OWN_CONTEXT_BROWSER_SERVER_CLOSED'; await writeFile(path.join(output, 'cleanup.json'), JSON.stringify(cleanup, null, 2));
  }
});
}
