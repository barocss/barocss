import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), app = resolve(root, 'apps/render-editor');
assert(process.argv.length === 4 && process.argv[2] === '--output', 'Use --output <new-evidence-directory>.');
const output = resolve(process.argv[3]);
await mkdir(dirname(output), { recursive: true }); await mkdir(output);
const execute = promisify(execFile), cli = process.env.PLAYWRIGHT_CLI_PATH, session = `duplicate-scene-${process.pid}`,
  url = 'http://127.0.0.1:52061/mixed.html';
let server, opened = false, sequence = 0, stage = 'environment';
const receipt = { issue: 1153, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  clean: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() === '', node: process.version,
  startedAt: new Date().toISOString(), ok: false, actualGL: false };
async function call(command, ...args) {
  try {
    const result = await execute(process.execPath, [cli, `-s=${session}`, command, ...args, '--raw'], {
      cwd: output, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
    writeFileSync(resolve(output, `cli-${++sequence}-${command}.log`), result.stdout + result.stderr); return result.stdout.trim();
  } catch (error) {
    writeFileSync(resolve(output, `cli-${++sequence}-${command}-failed.log`), String(error.stdout ?? '') + String(error.stderr ?? '') + String(error)); throw error;
  }
}
async function run(fn) { return JSON.parse(await call('run-code', fn.toString().replace('__CONFIG__', JSON.stringify({ output, url })))); }
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22); assert(cli, 'Use installed Playwright CLI; no downloads.');
  stage = 'public source API and genuine original native file';
  const inputPath = '/Users/user/.barocss-ai/v3/render-editor-1136/evidence/final-native-flow/title.render-mixed.json', originalText = await readFile(inputPath, 'utf8');
  await writeFile(resolve(output, 'original.render-mixed.json'), originalText);
  const bundle = await build({ absWorkingDir: root, stdin: { contents: "export * from '@barocss/render-editor';", resolveDir: app, sourcefile: 'duplicate-scene-source.mjs' },
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true });
  const inputs = Object.keys(bundle.metafile.inputs), sourceInputs = inputs.filter((path) => /packages\/barocss-[^/]+\/src\//.test(path)),
    distInputs = inputs.filter((path) => /packages\/barocss-[^/]+\/dist\//.test(path));
  assert(sourceInputs.length > 0); assert.equal(distInputs.length, 0);
  await writeFile(resolve(output, 'source-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const original = api.parseRenderMixedDocument(originalText), originalPrepared = api.prepareRenderMixedDocument(original), before = JSON.stringify(original), title = '  Alternate view 🔭  ';
  const duplicate = api.duplicateRenderMixedDocument(original, 'scene_independent_copy', title), prepared = api.prepareRenderMixedDocument(duplicate);
  assert.deepEqual(duplicate, { ...original, documentId: 'scene_independent_copy', title, revision: 0 });
  assert.notEqual(duplicate.asset, original.asset); assert.notEqual(duplicate.display.translate, original.display.translate);
  for (const value of [duplicate, duplicate.asset, duplicate.display, duplicate.display.translate, duplicate.camera, duplicate.camera.eye]) assert(Object.isFrozen(value));
  assert.deepEqual(prepared.model, originalPrepared.model); assert.equal(JSON.stringify(original), before);
  let refusals = 0;
  for (const [id, label] of [[original.documentId, title], ['1invalid', title], ['x'.repeat(49), title], [null, title],
    ['valid_copy', ''], ['valid_copy', '   '], ['valid_copy', 'x'.repeat(129)], ['valid_copy', '🔭'.repeat(129)], ['valid_copy', null]]) {
    assert.throws(() => api.duplicateRenderMixedDocument(original, id, label), (error) => error instanceof api.RenderMixedDocumentError && error.code === 'INPUT'); refusals++;
  }
  assert.equal(api.duplicateRenderMixedDocument(original, 'unicode_copy', '🔭'.repeat(128)).title.length, 256);
  for (const asset of [{ ...original.asset, source: 'invalid native source' }, { ...original.asset, modelId: 'foreign_model' }, { ...original.asset, surfaceId: 'stored_guide' }]) {
    assert.throws(() => api.duplicateRenderMixedDocument({ ...original, asset }, 'qualified_copy', title), (error) => error instanceof api.RenderMixedDocumentError); refusals++;
  }
  for (const input of [{ ...original, sceneSource: 'invalid scene source' }, { ...original, profile: 'unsupported-profile' }]) {
    assert.throws(() => api.duplicateRenderMixedDocument(input, 'qualified_copy', title), (error) => error instanceof api.RenderMixedDocumentError); refusals++;
  }
  assert.equal(JSON.stringify(original), before);
  receipt.cpu = { sourceInputs: sourceInputs.length, ownDistInputs: 0, qualifiedIndependentCopy: true, rawTitle: title, unicode128: true,
    refusals, originalUnchanged: true, deepFrozenCopied: true, completeNativeModelEqual: true };
  stage = 'actual compact Chrome duplication and draft/refusal guards';
  server = await createServer({ root: app, configFile: resolve(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 52061, strictPort: true } });
  await server.listen(); await call('open', url, '--browser', 'chrome'); opened = true;
  receipt.browser = await run(async (base) => {
    const config = __CONFIG__, page = await base.context().newPage(), errors = [], rows = [];
    const check = (value, message) => { if (!value) throw Error(message); };
    page.on('pageerror', (error) => errors.push(error.message)); page.setDefaultTimeout(10000);
    const trigger = () => page.getByTestId('duplicate-scene'), dialog = () => page.getByTestId('duplicate-dialog'), title = () => page.getByTestId('duplicate-title'),
      confirm = () => page.getByTestId('duplicate-confirm'), revision = () => page.getByTestId('accepted-revision').getAttribute('data-revision'),
      header = () => page.getByTestId('document-title').textContent(), projects = () => page.locator('nav[aria-label="Projects"] button'),
      apply = () => page.getByRole('button', { name: 'Apply', exact: true }), x = () => page.locator('input[aria-label="Native X"]');
    const waitRevision = async (value) => { await page.locator('[data-testid="presented-revision"][data-revision="' + value + '"]').waitFor(); check(await revision() === String(value), 'Accepted/presented revision mismatch.'); };
    const pixels = () => page.evaluate(() => {
      const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2'); if (!gl || gl.isContextLost()) throw Error('Actual WebGL2 unavailable.');
      const buffer = new Uint8Array(canvas.width * canvas.height * 4); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buffer); let hash = 2166136261;
      for (const value of buffer) hash = Math.imul(hash ^ value, 16777619);
      return { hash: (hash >>> 0).toString(16), width: canvas.width, height: canvas.height };
    });
    const cancel = async () => { await page.getByTestId('duplicate-cancel').click(); await dialog().waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement === document.querySelector('[data-testid="duplicate-scene"]')); };
    const dismiss = async () => { if (await page.getByTestId('app-error').count()) { await page.getByRole('button', { name: 'Dismiss error', exact: true }).click(); await page.getByTestId('app-error').waitFor({ state: 'detached' }); } };
    const save = async (file, expectedName) => { const ready = page.waitForEvent('download'); await page.getByTestId('save-file').click(); const download = await ready;
      if (expectedName) check(download.suggestedFilename() === expectedName, 'Download basename does not use host document identity.'); await download.saveAs(config.output + '/' + file); };
    try {
      await page.setViewportSize({ width: 1000, height: 760 }); await page.goto(config.url); await waitRevision(0); await page.waitForLoadState('networkidle');
      const ready = page.waitForEvent('filechooser'); await page.getByTestId('open-file').click(); await (await ready).setFiles(config.output + '/original.render-mixed.json');
      await waitRevision(15); const initial = await pixels(), route = page.url(), projectCount = await projects().count(), originalTitle = await header();
      await trigger().click();
      for (const value of ['', '   ', 'x'.repeat(129), '🔭'.repeat(129)]) { await title().fill(value); check(await title().inputValue() === value && await confirm().isDisabled(), 'Invalid copy title was erased or permitted.'); }
      await page.screenshot({ path: config.output + '/invalid-copy-title.png', fullPage: true }); await title().fill('Canceled copy'); await cancel();
      check(await revision() === '15' && await header() === originalTitle && page.url() === route && (await pixels()).hash === initial.hash && await projects().count() === projectCount, 'Cancel changed original authority.');
      await trigger().click(); await title().fill('Stale copy'); await page.evaluate(() => { window.location.hash = '#/mixed/rational_panel'; });
      await page.getByTestId('duplicate-error').waitFor(); await title().fill('Still stale');
      check(await confirm().isDisabled() && (await page.getByTestId('duplicate-error').textContent()).toLowerCase().includes('navigation'), 'Typing made a stale copy current.');
      check(await revision() === '15' && page.url() === route && await projects().count() === projectCount, 'Stale dialog created or selected a copy.');
      await cancel(); await dismiss(); rows.push({ case: 'raw-title-validation-Cancel-stale-route-focus', originalRevision: 15, projectCount });

      await page.getByTestId('mixed-object-surface').click(); await x().fill('-'); await page.getByTestId('mixed-object-sphere').click();
      const help = page.getByRole('menuitem', { name: 'Help', exact: true }); await help.focus(); await help.press('ArrowDown');
      const item = page.getByRole('menuitem', { name: 'Duplicate scene', exact: true }); await item.focus(); await item.press('Enter');
      await page.getByRole('dialog').waitFor(); check((await page.getByRole('dialog').textContent()).includes('original'), 'Copy Help is missing original authority.');
      await page.getByRole('dialog').press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
      await page.locator('[data-slot="menubar-content"]').waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Help');
      check(await x().inputValue() === '-' && !await x().isVisible(), 'Copy Help erased hidden raw Position.');
      await trigger().click(); await page.getByTestId('draft-dialog').waitFor(); check(await dialog().count() === 0, 'Copy dialog bypassed dirty guard.');
      await page.getByTestId('draft-apply').click(); await page.getByTestId('draft-dialog').getByTestId('app-error').waitFor();
      check(await revision() === '15' && await projects().count() === projectCount && (await pixels()).hash === initial.hash, 'Hidden invalid Position created a copy.');
      await page.screenshot({ path: config.output + '/hidden-position-copy-refusal.png', fullPage: true });
      await page.getByTestId('draft-cancel').click(); await page.getByTestId('draft-dialog').waitFor({ state: 'detached' }); await dismiss();
      check(await x().inputValue() === '-', 'Guard Cancel erased hidden raw input.');
      await page.getByRole('button', { name: 'Edit Surface position', exact: true }).click(); await x().fill('-.5');
      await page.getByRole('tab', { name: 'Scene', exact: true }).click();
      const scene = await page.getByTestId('mixed-scene-source').inputValue(); await page.getByTestId('mixed-scene-source').fill(scene + '\n/* canceled copy draft */\n');
      await trigger().click(); await page.getByTestId('draft-cancel').click(); await page.getByTestId('draft-dialog').waitFor({ state: 'detached' });
      check((await page.getByTestId('mixed-scene-source').inputValue()).includes('canceled copy draft') && await revision() === '15', 'Guard Cancel erased source draft.');
      await trigger().click(); await page.getByTestId('draft-discard').click(); await dialog().waitFor(); await cancel();
      check(await page.getByTestId('mixed-scene-source').inputValue() === scene && await apply().isDisabled() && await projects().count() === projectCount, 'Guard Discard did not restore original source.');
      await x().fill('-.4'); await trigger().click(); await page.getByTestId('draft-apply').click(); await dialog().waitFor();
      await waitRevision(16); await cancel(); await save('before-copy.render-mixed.json', 'surface_study.render-mixed.json');
      rows.push({ case: 'Help-hidden-position-refusal-guard-Cancel-Discard-Apply', originalRevision: 16 });

      const stable = await pixels(); await trigger().click(); const copyTitle = '  Alternate view 🔭  '; await title().fill(copyTitle);
      await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'), original = gl.createBuffer; let count = 0;
        gl.createBuffer = function(...args) { if (++count === 3) { gl.createBuffer = original; return null; } return original.apply(this, args); }; });
      await confirm().click(); await page.getByTestId('duplicate-error').waitFor();
      check(await dialog().isVisible() && await title().inputValue() === copyTitle && await revision() === '16' && page.url() === route
        && await projects().count() === projectCount && (await pixels()).hash === stable.hash, 'Real GPU refusal changed original or created a phantom copy.');
      await page.screenshot({ path: config.output + '/retained-copy-preview-refusal.png', fullPage: true });
      await confirm().click(); await dialog().waitFor({ state: 'detached' }); await waitRevision(0);
      check(await header() === copyTitle && page.url() !== route && await projects().count() === projectCount + 1, 'Copy was not registered/selected independently.');
      const active = page.getByRole('navigation', { name: 'Projects' }).locator('button[aria-current="page"]'), copyId = (await active.getAttribute('data-testid')).slice('project-'.length), copyRoute = page.url();
      check(copyId !== 'surface_study' && /^scene_[a-f0-9]{32}$/.test(copyId), 'Copy host identity is invalid.');
      check((await page.locator('.app-document-state').textContent()).includes('Not downloaded'), 'New copy was marked downloaded.');
      check(await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled() && await page.getByRole('button', { name: 'Redo', exact: true }).isDisabled(), 'Copy inherited original history.');
      for (const control of [trigger(), apply(), page.getByTestId('save-file'), page.getByTestId('accepted-revision')]) { const box = await control.boundingBox();
        check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1001 && box.y + box.height <= 761, 'Compact copy/File/Apply/footer control is outside the viewport.'); }
      await page.screenshot({ path: config.output + '/compact-independent-copy.png', fullPage: true });
      await save('copy.render-mixed.json', copyId + '.render-mixed.json');
      await x().fill('-.2'); await apply().click(); await waitRevision(1);
      await page.getByRole('button', { name: 'Undo', exact: true }).click(); await waitRevision(2); check(Number(await x().inputValue()) === -.4, 'Copy Undo did not restore its own starting position.');
      await page.getByRole('button', { name: 'Redo', exact: true }).click(); await waitRevision(3); check(Number(await x().inputValue()) === -.2, 'Copy Redo failed.');
      await save('edited-copy.render-mixed.json', copyId + '.render-mixed.json');
      const originalKey = decodeURIComponent(new URL(route).hash.slice('#/mixed/'.length));
      await page.getByRole('navigation', { name: 'Projects' }).locator('button').filter({ hasText: 'Final lens view' }).last().click(); await waitRevision(16);
      check(page.url() === route && await header() === originalTitle && Number(await x().inputValue()) === -.4, 'Copy edits changed the original project.');
      await save('original-after-copy.render-mixed.json', 'surface_study.render-mixed.json');
      check(originalKey.length > 0 && copyRoute.includes(copyId) && errors.length === 0, 'Unexpected route or page errors.');
      rows.push({ case: 'controlled-GPU-refusal-independent-copy-history-edit-original-switch', copyId, copyTitle, copyRoute, originalRoute: route, originalRevision: 16, copyRevision: 3 });
      return { ok: true, errors, rows, copyId, copyTitle, originalRevision: 16, copyRevision: 3, viewport: { width: 1000, height: 760 } };
    } catch (error) {
      const failure = { message: error.message, stack: error.stack, url: page.url() };
      try { await page.screenshot({ path: config.output + '/first-failure.png', fullPage: true }); failure.html = await page.content(); } catch (capture) { failure.captureError = String(capture); }
      return { ok: false, rows, errors, failure };
    } finally { await page.close(); }
  });
  if (!receipt.browser.ok) { if (receipt.browser.failure.html) await writeFile(resolve(output, 'first-failure.html'), receipt.browser.failure.html); throw Error(receipt.browser.failure.stack); }
  stage = 'real independent files and unchanged original workspace';
  const originalBefore = await readFile(resolve(output, 'before-copy.render-mixed.json'), 'utf8'), originalAfter = await readFile(resolve(output, 'original-after-copy.render-mixed.json'), 'utf8');
  assert.equal(originalAfter, originalBefore);
  const copied = api.parseRenderMixedDocument(await readFile(resolve(output, 'copy.render-mixed.json'), 'utf8'));
  assert.deepEqual(copied, { ...original, documentId: receipt.browser.copyId, title: receipt.browser.copyTitle, revision: 0, display: { ...original.display, translate: [-.4, .6, -.3] } });
  const edited = api.parseRenderMixedDocument(await readFile(resolve(output, 'edited-copy.render-mixed.json'), 'utf8'));
  assert.deepEqual(edited, { ...copied, revision: 3, display: { ...copied.display, translate: [-.2, .6, -.3] } });
  stage = 'fresh actual native picker Open independent copy and re-edit';
  receipt.fresh = await run(async (base) => {
    const config = __CONFIG__, page = await base.context().newPage(), errors = [], check = (value, message) => { if (!value) throw Error(message); };
    page.on('pageerror', (error) => errors.push(error.message)); page.setDefaultTimeout(10000);
    try {
      await page.setViewportSize({ width: 1000, height: 760 }); await page.goto(config.url);
      await page.locator('[data-testid="presented-revision"][data-revision="0"]').waitFor(); await page.waitForLoadState('networkidle');
      const ready = page.waitForEvent('filechooser'); await page.getByTestId('open-file').click(); await (await ready).setFiles(config.output + '/edited-copy.render-mixed.json');
      await page.locator('[data-testid="presented-revision"][data-revision="3"]').waitFor();
      check((await page.getByTestId('document-title').textContent()) === '  Alternate view 🔭  ', 'Fresh file did not restore raw copy title.');
      await page.getByTestId('mixed-object-surface').click(); const x = page.getByRole('textbox', { name: 'Native X', exact: true });
      check(Number(await x.inputValue()) === -.2, 'Fresh copy display setting changed.'); await x.fill('.1'); await page.getByRole('button', { name: 'Apply', exact: true }).click();
      await page.locator('[data-testid="presented-revision"][data-revision="4"]').waitFor();
      const readySave = page.waitForEvent('download'); await page.getByTestId('save-file').click(); const download = await readySave;
      await download.saveAs(config.output + '/reedited-copy.render-mixed.json');
      await page.screenshot({ path: config.output + '/fresh-reedited-copy.png', fullPage: true }); check(errors.length === 0, 'Fresh page errors.');
      return { ok: true, errors, revision: 4, suggestedFilename: download.suggestedFilename(), actualNativePicker: true };
    } catch (error) {
      const failure = { message: error.message, stack: error.stack };
      try { await page.screenshot({ path: config.output + '/fresh-first-failure.png', fullPage: true }); failure.html = await page.content(); } catch (capture) { failure.captureError = String(capture); }
      return { ok: false, errors, failure };
    } finally { await page.close(); }
  });
  if (!receipt.fresh.ok) { if (receipt.fresh.failure.html) await writeFile(resolve(output, 'fresh-first-failure.html'), receipt.fresh.failure.html); throw Error(receipt.fresh.failure.stack); }
  stage = 'cold complete original authority preservation';
  const finalText = await readFile(resolve(output, 'reedited-copy.render-mixed.json'), 'utf8'), final = api.parseRenderMixedDocument(finalText), cold = api.prepareRenderMixedDocument(final);
  assert.deepEqual(final, { ...copied, revision: 4, display: { ...copied.display, translate: [.1, .6, -.3] } });
  assert.deepEqual(cold.model, originalPrepared.model); assert.equal(final.asset.source, original.asset.source); assert.equal(final.sceneSource, original.sceneSource);
  assert(cold.model.objects.find((object) => object.id === 'stored_guide').controlPoints[0].every((value) => Object.is(value, -0)));
  assert.equal(receipt.fresh.suggestedFilename, final.documentId + '.render-mixed.json');
  receipt.files = { originalBytes: Buffer.byteLength(originalText), copiedBytes: Buffer.byteLength(await readFile(resolve(output, 'copy.render-mixed.json'), 'utf8')),
    savedBytes: Buffer.byteLength(finalText), originalWorkspaceBytesEqual: true, originalSourcesExact: true, completeNativeModelEqual: true, signedZero: true,
    newDocumentId: final.documentId, assetId: final.asset.assetId, assetRevision: final.asset.revision, selectedSurface: final.asset.surfaceId, finalRevision: 4,
    originalIds: cold.metadata.nativeObjects.map((object) => object.id) };
  receipt.ok = true; receipt.actualGL = true;
} catch (error) {
  receipt.firstFailure = { stage, message: error.message ?? String(error), stack: error.stack ?? String(error) }; process.exitCode = 1;
  if (opened && !receipt.browser?.failure && !receipt.fresh?.failure) {
    try { receipt.fallbackCapture = await run(async (base) => { const config = __CONFIG__, page = base.context().pages().filter((page) => page !== base && page.url().startsWith(config.url)).at(-1);
      if (!page) return { captured: false, reason: 'No live owned flow page.' };
      await page.screenshot({ path: config.output + '/first-failure.png', fullPage: true }); return { captured: true, html: await page.content() }; });
      if (receipt.fallbackCapture.html) await writeFile(resolve(output, 'first-failure.html'), receipt.fallbackCapture.html); }
    catch (capture) { receipt.captureError = String(capture); }
  }
} finally {
  if (opened) try { await call('close'); } catch (error) { receipt.cleanupFailure = String(error); receipt.ok = false; process.exitCode = 1; }
  try { await server?.close(); } catch (error) { receipt.serverCleanupFailure = String(error); receipt.ok = false; process.exitCode = 1; }
  receipt.finishedAt = new Date().toISOString(); await writeFile(resolve(output, 'duplicate-scene-flow.json'), JSON.stringify(receipt, null, 2) + '\n');
}
console.log(JSON.stringify(receipt, null, 2));
