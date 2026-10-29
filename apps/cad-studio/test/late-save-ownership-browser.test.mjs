// D322 actual Studio project Save: native OPFS close return held across public document/session changes.
// Baseline run source capsules remain immutable; final selected cases require a producer source freeze.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installD322NativeSaveScheduler } from './late-save-native-scheduler.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), app = path.resolve(here, '..');

for (const scenario of ['same-document', 'new-document', 'closed-project']) {
test(`D322 late project Save ownership: ${scenario}`, { timeout: 120000 }, async () => {
  assert.ok(process.env.CHROME && process.env.PW_DIR && process.env.D322_ARTIFACT_DIR, 'real Chrome, Playwright and artifact directory are required; no silent skip');
  const output = path.join(process.env.D322_ARTIFACT_DIR, scenario); await mkdir(output, { recursive: true });
  const projectName = `d322-late-save-${randomUUID()}`, part = 'D322-owned.bcad', namespace = `projects/${projectName}/`, target = namespace + part;
  const server = await createServer({ root: app, configFile: path.join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
  await server.listen();
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  let browser, context, page, measured = false, phase = 'startup';
  const states = [], errors = [], report = { status: 'RUNNING', scenario, baseline: 'a386c8705beda2c72d215da61a55fd6119351ca2', projectName, namespace, target, states, errors }, cleanup = {};
  const persist = () => writeFile(path.join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await context.addInitScript(installD322NativeSaveScheduler, { projectName }); page = await context.newPage();
    page.on('pageerror', error => errors.push(error.stack ?? String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(server.resolvedUrls.local[0]);
    const ready = () => page.waitForFunction(() => { const b = window.__studioBodies?.(); return b?.fresh && b.massReady === true; }, null, { timeout: 30000 });
    const snapshot = async label => {
      const state = await page.evaluate(async ({ label, projectName, part }) => {
        const root = await window.__d322Save.inspectRoot(), projects = await root.getDirectoryHandle('projects'), project = await projects.getDirectoryHandle(projectName);
        const read = async path => {
          try { const pieces = path.split('/'); let directory = project; for (const name of pieces.slice(0, -1)) directory = await directory.getDirectoryHandle(name);
            const file = await (await directory.getFileHandle(pieces.at(-1))).getFile(), bytes = new Uint8Array(await file.arrayBuffer());
            return { path, size: file.size, lastModified: file.lastModified, tag: `${file.size}-${file.lastModified}`, bytes: Array.from(bytes), doc: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) };
          } catch (error) { if (error.name === 'NotFoundError') return null; throw error; }
        };
        return { label, doc: window.__studioDoc, body: window.__studioBodies?.(), dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
          recovery: localStorage.getItem('studio.recovery'), name: document.querySelector('.doc-tab input')?.value,
          projectUI: document.querySelector('[aria-label="Project"]')?.textContent ?? null,
          activePartUI: document.querySelector('[aria-label="Project documents"] [data-active="true"]')?.textContent ?? null,
          documentsUI: document.querySelector('[aria-label="Project documents"]')?.textContent ?? null,
          versionsUI: document.querySelector('[aria-label="Versions panel"]')?.textContent ?? null,
          nativeSaved: await read(part), nativeAutosave: await read(`.barocss/autosave/${part}`), trace: window.__d322Save.snapshot(),
          feedback: [...document.querySelectorAll('.toast')].map(element => element.textContent) };
      }, { label, projectName, part });
      for (const key of ['nativeSaved', 'nativeAutosave']) if (state[key]) {
        const file = `${label}-${key}.bcad`; await writeFile(path.join(output, file), new Uint8Array(state[key].bytes)); state[key].bytesFile = file; delete state[key].bytes;
      }
      states.push(state); await persist(); await page.screenshot({ path: path.join(output, `${label}.png`) }); return state;
    };
    await ready(); phase = 'create real project and saved part';
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await page.keyboard.press('b'); await page.waitForSelector('.hud');
    for (const [label, value] of [['Width X', '10'], ['Depth Y', '10'], ['Height Z', '10']]) await page.locator('.hud .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input').fill(value);
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 });
    await page.locator('.hud button', { hasText: 'Apply' }).click(); await ready();
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && window.__studioBodies().bodies.length === 1);
    await page.locator('.doc-tab input').fill('D322-owned'); await page.click('[aria-label="Project and versions"]');
    const card = page.locator('[aria-label="Versions panel"]'); await card.waitFor();
    await card.locator('[aria-label="Browser project name"]').fill(projectName); await card.locator('[aria-label="Project in this browser"]').click();
    await card.locator('[aria-label="Project"]').waitFor(); assert.match(await card.innerText(), /in this browser/);
    await page.click('[aria-label="Save"]'); await page.waitForSelector('[aria-label="Unsaved changes"]', { state: 'detached', timeout: 15000 });
    const initial = await snapshot('initial-saved'); assert.deepEqual(initial.nativeSaved.doc, initial.doc); assert.equal(initial.dirty, false);

    await page.click('.mode button:text-is("Render")'); await page.waitForSelector('.render-panel');
    await page.locator('.render-panel [role="tab"]', { hasText: 'Scene' }).click(); const grid = page.locator('.render-panel input[aria-label="Grid"]');
    const savedGrid = !(await grid.isChecked()); await grid.setChecked(savedGrid); await page.waitForFunction(value => window.__studioDoc.render?.environment?.grid === value, savedGrid);
    await page.click('.mode button:text-is("Model")');
    const before = await snapshot('before-save'); assert.equal(before.dirty, true);
    phase = 'hold actual native close return for Save A'; await page.evaluate(path => window.__d322Save.arm(path), target);
    await page.click('[aria-label="Save"]');
    await page.waitForFunction(() => window.__d322Save.snapshot().claimed?.closedNative === true, null, { timeout: 15000 });
    const held = await snapshot('held-save'); assert.deepEqual(held.nativeSaved.doc, before.doc); assert.equal(held.trace.claimed.returnedToCaller, false);

    let newer;
    if (scenario === 'same-document') {
      phase = 'newer public Render edit and finished native autosave';
      await page.click('.mode button:text-is("Render")'); await page.waitForSelector('.render-panel');
      await page.locator('.render-panel [role="tab"]', { hasText: 'Scene' }).click();
      const newerGrid = !savedGrid; await grid.setChecked(newerGrid);
      await page.waitForFunction(value => window.__studioDoc.render?.environment?.grid === value, newerGrid); await ready();
      const expectedNewer = await page.evaluate(() => window.__studioDoc);
      let autosaveRecord = null, polls = 0;
      for (; polls < 60; polls++) {
        autosaveRecord = await page.evaluate(async ({ projectName, part }) => {
          try { const root = await window.__d322Save.inspectRoot(), projects = await root.getDirectoryHandle('projects'), project = await projects.getDirectoryHandle(projectName), metadata = await project.getDirectoryHandle('.barocss'), autosave = await metadata.getDirectoryHandle('autosave');
            const file = await (await autosave.getFileHandle(part)).getFile();
            return { doc: JSON.parse(await file.text()), size: file.size, tag: `${file.size}-${file.lastModified}` };
          } catch (error) { if (error.name === 'NotFoundError') return null; throw error; }
        }, { projectName, part });
        if (autosaveRecord && isDeepStrictEqual(autosaveRecord.doc, expectedNewer)) break;
        await page.waitForTimeout(250);
      }
      report.newerAutosaveObservation = { polls: polls + 1, last: autosaveRecord }; await persist();
      assert.ok(autosaveRecord && isDeepStrictEqual(autosaveRecord.doc, expectedNewer), 'the complete newer document must exist in actual native autosave before release');
      await page.click('.mode button:text-is("Model")');
      newer = await snapshot('newer-edit-autosaved'); assert.equal(newer.dirty, true); assert.ok(newer.nativeAutosave, 'completed newer native autosave must still exist at the captured checkpoint'); assert.deepEqual(newer.nativeAutosave.doc, newer.doc); assert.deepEqual(newer.nativeSaved.doc, before.doc);

    } else if (scenario === 'new-document') {
      phase = 'New part and a new public Box with complete local recovery';
      await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
      await page.keyboard.press('b'); await page.waitForSelector('.hud');
      for (const [label, value] of [['Width X', '12'], ['Depth Y', '13'], ['Height Z', '14']]) await page.locator('.hud .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input').fill(value);
      await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 });
      await page.locator('.hud button', { hasText: 'Apply' }).click(); await ready();
      await page.locator('.doc-tab input').fill('D322-new-document');
      await page.waitForFunction(() => {
        const raw = localStorage.getItem('studio.recovery'); if (!raw) return false;
        const record = JSON.parse(raw); return record.fileName === 'D322-new-document' && JSON.stringify(record.doc) === JSON.stringify(window.__studioDoc);
      }, null, { timeout: 15000 });
      newer = await snapshot('new-document-recovered');
      assert.equal(newer.dirty, true); assert.equal(newer.name, 'D322-new-document'); assert.equal(newer.activePartUI, null);
      assert.deepEqual(JSON.parse(newer.recovery).doc, newer.doc);
      assert.equal(newer.body.bodies.length, 1); assert.ok(Math.abs(newer.body.bodies[0].volume - 2184) < 1e-8, 'the new 12 by 13 by 14 Box must be evaluated');
    } else {
      phase = 'public Close project while old Save return is held';
      await page.click('[aria-label="Close project"]'); await page.waitForSelector('[aria-label="Project"]', { state: 'detached' });
      newer = await snapshot('project-closed');
      assert.equal(newer.projectUI, null); assert.equal(newer.activePartUI, null); assert.equal(newer.documentsUI, null);
    }

    phase = 'release old Save and capture its actual completion'; await page.evaluate(() => window.__d322Save.release());
    const completion = await page.waitForFunction(({ target, rootPath, requireRefresh }) => {
      const events = window.__d322Save.snapshot().events, release = events.find(event => event.kind === 'release-requested');
      const returned = release && events.find(event => event.kind === 'native-close-return-released' && event.path === target && event.sequence > release.sequence);
      const tagRead = returned && events.find(event => event.kind === 'native-getFile-return' && event.scope === 'production' && event.path === target && event.sequence > returned.sequence);
      const refresh = tagRead && events.find(event => event.kind === 'native-entries-complete' && event.scope === 'production' && event.path === rootPath && event.sequence > tagRead.sequence);
      return tagRead && (!requireRefresh || refresh) && { nativeCloseReturn: returned.sequence, returnedTagRead: tagRead.sequence, projectRefreshComplete: refresh?.sequence ?? null };
    }, { target, rootPath: namespace.slice(0, -1), requireRefresh: scenario === 'same-document' }, { timeout: 15000 });
    report.nativeCompletion = await completion.jsonValue();
    // Native progress above is the completion condition; frame turns only allow public UI state to commit.
    await page.evaluate(async () => { await new Promise(resolve => queueMicrotask(resolve)); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    const after = await snapshot('after-release'); measured = true;
    report.observed = { liveDocEqualsNewer: JSON.stringify(after.doc) === JSON.stringify(newer.doc), savedDocEqualsA: JSON.stringify(after.nativeSaved.doc) === JSON.stringify(before.doc),
      dirtyAfter: after.dirty, newerAutosavePresent: after.nativeAutosave !== null, recoveryBefore: newer.recovery, recoveryAfter: after.recovery,
      projectPartUIBefore: newer.activePartUI, projectPartUIAfter: after.activePartUI, projectTagRef: 'NOT_EXPOSED; native file tags are retained',
      baselineBugObserved: scenario === 'same-document' && after.dirty === false && after.nativeAutosave === null };
    report.status = report.observed.baselineBugObserved ? 'BASELINE_REPRODUCED_PRODUCT_FAIL' : 'SCHEDULE_COMPLETED';
    report.browserVersion = browser.version(); await persist();
    phase = 'safe ownership assertions after all raw snapshots and bytes were persisted';
    assert.deepEqual(after.nativeSaved.doc, before.doc, 'the completed native Save A bytes remain valid');
    if (scenario === 'same-document') {
      assert.deepEqual(after.doc, newer.doc, 'late Save must not replace the newer live document');
      assert.equal(after.dirty, true, 'late Save A must not mark newer Render edit B clean');
      assert.deepEqual(after.nativeAutosave?.doc, newer.doc, 'late Save A must not remove the completed newer autosave B');
    } else if (scenario === 'new-document') {
      assert.deepEqual(after.doc, newer.doc, 'late Save must not replace the new document');
      assert.equal(after.name, 'D322-new-document'); assert.equal(after.dirty, true, 'late Save must not mark the new document clean');
      assert.ok(after.recovery, 'the completed new-document local recovery must remain');
      assert.deepEqual(JSON.parse(after.recovery).doc, newer.doc); assert.equal(JSON.parse(after.recovery).fileName, 'D322-new-document');
      assert.equal(after.activePartUI, null, 'late Save must not reattach the old project part');
      assert.equal(after.body.fresh, true); assert.equal(after.body.massReady, true); assert.equal(after.body.bodies.length, 1);
      assert.ok(Math.abs(after.body.bodies[0].volume - 2184) < 1e-8);
    } else {
      assert.deepEqual(after.doc, newer.doc, 'late Save must not replace the document after Close project');
      assert.equal(after.projectUI, null, 'late Save must not restore closed project metadata');
      assert.equal(after.documentsUI, null, 'late Save must not restore the old project document list');
      assert.equal(after.activePartUI, null, 'late Save must not restore an active old project part');
      assert.doesNotMatch(after.versionsUI ?? '', /D322-owned\.bcad/, 'late Save must not restore the old version/part view');
    }
    if (scenario === 'same-document') {
      phase = 'normal public Save B after original late-Save safety assertions';
      const start = await page.evaluate(() => window.__d322Save.snapshot().events.length);
      await page.click('[aria-label="Save"]');
      await page.waitForFunction(({ target, rootPath, start }) => {
        const events = window.__d322Save.snapshot().events;
        const close = events.find(event => event.kind === 'native-close-committed' && event.path === target && event.sequence >= start);
        const tagRead = close && events.find(event => event.kind === 'native-getFile-return' && event.scope === 'production' && event.path === target && event.sequence > close.sequence);
        return tagRead && events.some(event => event.kind === 'native-entries-complete' && event.scope === 'production' && event.path === rootPath && event.sequence > tagRead.sequence);
      }, { target, rootPath: namespace.slice(0, -1), start }, { timeout: 15000 });
      await page.waitForSelector('[aria-label="Unsaved changes"]', { state: 'detached', timeout: 15000 });
      const savedB = await snapshot('normal-save-B');
      assert.equal(savedB.dirty, false, 'normal Save B must complete cleanly using the advanced same-path native tag');
      assert.deepEqual(savedB.doc, newer.doc); assert.deepEqual(savedB.nativeSaved.doc, newer.doc, 'normal Save B must persist the newer document bytes');
      assert.doesNotMatch(savedB.feedback.join('\n'), /STORAGE_CHANGED|changed elsewhere|Could not save|could not be saved/i, 'normal Save B must not conflict with its own completed Save A');
      report.normalSaveB = { completed: true, dirty: savedB.dirty, nativeTag: savedB.nativeSaved.tag, savedDocEqualsB: true };
    }
    assert.deepEqual(errors, []); report.status = 'SAFE_CONTRACT_PASS'; await persist();
  } catch (error) {
    report.failureClass = measured ? 'SAFE_OWNERSHIP_CONTRACT_FAILURE' : 'SETUP_OR_SCHEDULE_FAILURE'; if (!measured) report.status = 'SETUP_OR_SCHEDULE_FAILURE'; report.failure = { phase, message: error.message, stack: error.stack }; await persist(); throw error;
  } finally {
    if (page && !page.isClosed()) {
      try { await page.evaluate(() => window.__d322Save?.release()); } catch { /* closing context */ }
      try {
        await page.click('.mode button:text-is("Model")');
        if (await page.locator('[aria-label="Close project"]').count()) await page.click('[aria-label="Close project"]');
        cleanup.projectClose = 'cleanup-only, after measured case';
        cleanup.namespace = await page.evaluate(async projectName => { const root = await window.__d322Save.inspectRoot(), projects = await root.getDirectoryHandle('projects');
          await projects.removeEntry(projectName, { recursive: true }); try { await projects.getDirectoryHandle(projectName); return 'STILL_PRESENT'; } catch (error) { if (error.name === 'NotFoundError') return 'REMOVED_AND_ABSENT'; throw error; }
        }, projectName);
      } catch (error) { cleanup.namespace = 'FAILED'; cleanup.error = String(error); }
    }
    if (context) { await context.close(); cleanup.context = 'CLOSED'; }
    if (browser) { await browser.close(); cleanup.browser = 'CLOSED'; }
    await server.close(); cleanup.server = 'CLOSED'; await writeFile(path.join(output, 'cleanup.json'), JSON.stringify(cleanup, null, 2));
  }
});
}
