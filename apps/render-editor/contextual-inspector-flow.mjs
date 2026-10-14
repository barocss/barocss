// run() replaces __CONFIG__ in the serialized browser callback.
/* global __CONFIG__:readonly */
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const app = resolve(root, 'apps/render-editor');
assert(process.argv.length === 4 && process.argv[2] === '--output', 'Use --output <new-evidence-directory>.');
const output = resolve(process.argv[3]);
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
const execute = promisify(execFile), session = `contextual-inspector-${process.pid}`;
const url = 'http://127.0.0.1:52055/mixed.html';
const cli = process.env.PLAYWRIGHT_CLI_PATH;
let sequence = 0, server, opened = false, stage = 'environment';
const comment = '\n/* Inspector keeps this original scene draft. */\n';
const receipt = { issue: 1130, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  clean: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() === '',
  node: process.version, startedAt: new Date().toISOString(), ok: false, actualGL: false };

async function call(command, ...args) {
  try {
    const result = await execute(process.execPath, [cli, `-s=${session}`, command, ...args, '--raw'], {
      cwd: output, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024,
    });
    writeFileSync(resolve(output, `cli-${++sequence}-${command}.log`), result.stdout + result.stderr);
    return result.stdout.trim();
  } catch (error) {
    writeFileSync(resolve(output, `cli-${++sequence}-${command}-failed.log`), String(error.stdout ?? '') + String(error.stderr ?? '') + String(error));
    throw error;
  }
}
async function run(fn, extra = {}) {
  return JSON.parse(await call('run-code', fn.toString().replace('__CONFIG__', JSON.stringify({ output, url, comment, ...extra }))));
}

try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Use installed Node 22.');
  assert(cli, 'Set PLAYWRIGHT_CLI_PATH to the installed CLI. This flow downloads no dependencies.');
  stage = 'actual retained native file and public source API';
  const inputPath = '/Users/user/.barocss-ai/v3/render-editor-1122/evidence/first-native-flow/position.render-mixed.json';
  const originalText = await readFile(inputPath, 'utf8');
  await writeFile(resolve(output, 'original.render-mixed.json'), originalText);
  const bundle = await build({ absWorkingDir: root, stdin: { contents: "export * from '@barocss/render-editor';",
    resolveDir: app, sourcefile: 'contextual-inspector-source.mjs' }, bundle: true, write: false,
    format: 'esm', platform: 'node', target: 'es2022', metafile: true });
  const inputs = Object.keys(bundle.metafile.inputs);
  const sourceInputs = inputs.filter((path) => /packages\/barocss-[^/]+\/src\//.test(path));
  const distInputs = inputs.filter((path) => /packages\/barocss-[^/]+\/dist\//.test(path));
  assert(sourceInputs.length > 0);
  assert.equal(distInputs.length, 0, 'Ordinary source graph reached own dist.');
  await writeFile(resolve(output, 'source-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const original = api.parseRenderMixedDocument(originalText), originalPrepared = api.prepareRenderMixedDocument(original);
  assert.equal(original.revision, 10);
  assert.equal(original.asset.revision, 1);
  assert.equal(original.asset.modelId, 'imported_pair');
  assert.equal(original.asset.surfaceId, 'rear');
  assert.deepEqual(original.display.translate, [-.9, .6, -.3]);
  assert.equal(originalPrepared.metadata.objectId, 'orb');
  assert.deepEqual(originalPrepared.metadata.nativeObjects.map((object) => [object.id, object.kind]),
    [['front', 'surface'], ['rear', 'surface'], ['stored_guide', 'curve']]);
  await writeFile(resolve(output, 'original.barocad'), original.asset.source);
  receipt.cpu = { publicSourceImport: true, sourceInputs: sourceInputs.length, ownDistInputs: distInputs.length,
    actualPreparation: true, objectId: originalPrepared.metadata.objectId, nativeObjects: originalPrepared.metadata.nativeObjects };

  stage = 'isolated Chrome object-inspector flow';
  server = await createServer({ root: app, configFile: resolve(app, 'vite.config.ts'),
    server: { host: '127.0.0.1', port: 52055, strictPort: true } });
  await server.listen();
  await call('open', url, '--browser', 'chrome');
  opened = true;
  receipt.browser = await run(async (base) => {
    const config = __CONFIG__, page = await base.context().newPage(), rows = [], errors = [];
    let downloads = 0;
    const check = (value, message) => { if (!value) throw Error(message); };
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('download', () => downloads++);
    page.setDefaultTimeout(10000);
    const sphere = () => page.getByTestId('mixed-object-sphere'), surface = () => page.getByTestId('mixed-object-surface');
    const sphereInspector = () => page.getByTestId('inspector-sphere'), surfaceInspector = () => page.getByTestId('inspector-surface');
    const x = () => page.locator('input[aria-label="Native X"]');
    const apply = () => page.getByRole('button', { name: 'Apply', exact: true });
    const revision = () => page.getByTestId('accepted-revision').getAttribute('data-revision');
    const pixels = () => page.evaluate(() => {
      const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2');
      if (!gl || gl.isContextLost()) throw Error('Actual WebGL2 unavailable.');
      const buffer = new Uint8Array(canvas.width * canvas.height * 4);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      let hash = 2166136261;
      for (const value of buffer) hash = Math.imul(hash ^ value, 16777619);
      return { hash: (hash >>> 0).toString(16), width: canvas.width, height: canvas.height };
    });
    const chooser = async (file) => {
      const ready = page.waitForEvent('filechooser');
      await page.getByTestId('open-file').click();
      await (await ready).setFiles(config.output + '/' + file);
    };
    const save = async (file) => {
      const ready = page.waitForEvent('download');
      await page.getByTestId('save-file').click();
      await (await ready).saveAs(config.output + '/' + file);
    };
    const target = async (kind) => {
      check(await sphere().getAttribute('aria-pressed') === String(kind === 'sphere'), 'Sphere pressed row mismatch.');
      check(await surface().getAttribute('aria-pressed') === String(kind === 'surface'), 'Surface pressed row mismatch.');
      check(await sphereInspector().isVisible() === (kind === 'sphere'), 'Sphere inspector visibility mismatch.');
      check(await surfaceInspector().isVisible() === (kind === 'surface'), 'Surface inspector visibility mismatch.');
      const hidden = kind === 'sphere' ? surfaceInspector() : sphereInspector();
      check(await hidden.getAttribute('hidden') !== null, 'Inactive inspector must use native HTML hidden.');
      check(await page.getByRole('region', { name: 'Mixed camera', exact: true }).isVisible(), 'Common camera disappeared.');
    };
    const unchanged = async (hash, scene) => {
      check(await revision() === '10' && await page.getByTestId('presented-revision').getAttribute('data-revision') === '10', 'Selection changed accepted/presented revision.');
      check((await pixels()).hash === hash, 'Selection changed actual pixels.');
      check(await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled()
        && await page.getByRole('button', { name: 'Redo', exact: true }).isDisabled(), 'Selection changed history.');
      check(await apply().isDisabled(), 'Selection made an authored draft.');
      if (scene !== null) check(await page.getByTestId('mixed-scene-source').inputValue() === scene, 'Selection changed original scene source.');
    };
    try {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(config.url);
      await page.locator('[data-testid="presented-revision"][data-revision="0"]').waitFor();
      await page.waitForLoadState('networkidle');
      await chooser('original.render-mixed.json');
      await page.locator('[data-testid="presented-revision"][data-revision="10"]').waitFor();
      await target('sphere');
      check((await sphereInspector().textContent()).includes('orb') && (await sphereInspector().textContent()).toLowerCase().includes('sphere'), 'Default Sphere name/type is not actual orb.');
      const scene = await page.getByTestId('mixed-scene-source').inputValue(), route = page.url();
      const initial = await pixels();
      await page.screenshot({ path: config.output + '/normal-sphere.png', fullPage: true });
      await save('before-selection.render-mixed.json');
      const fileState = await page.locator('.app-document-state').textContent();

      await surface().click();
      await target('surface');
      check(await surface().evaluate((element) => document.activeElement === element), 'Row click moved focus away from Surface.');
      check(await page.getByRole('tab', { name: 'CAD source', exact: true }).getAttribute('aria-selected') === 'true', 'Surface row did not select CAD source tab.');
      check((await page.getByTestId('mixed-native-source').inputValue()).includes('@curve #stored_guide'), 'Original unrendered Curve is missing from source.');
      await unchanged(initial.hash, null);
      await page.screenshot({ path: config.output + '/normal-surface.png', fullPage: true });
      await sphere().focus(); await sphere().press('Enter');
      await target('sphere');
      check(await sphere().evaluate((element) => document.activeElement === element), 'Keyboard row selection stole focus.');
      await unchanged(initial.hash, scene);
      await page.getByRole('tab', { name: 'CAD source', exact: true }).click();
      await target('sphere');
      check(await page.getByRole('tab', { name: 'CAD source', exact: true }).getAttribute('aria-selected') === 'true', 'Source tab could not change independently.');
      await sphereInspector().getByRole('button', { name: 'Edit source', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'mixed-scene-source');
      check(await page.getByTestId('mixed-scene-source').evaluate((element) => document.activeElement === element), 'Edit source did not focus Scene source.');
      await unchanged(initial.hash, scene);
      check(page.url() === route && await page.locator('.app-document-state').textContent() === fileState, 'Selection changed project/file identity.');
      await save('selection-only.render-mixed.json');
      rows.push({ case: 'default-context-click-keyboard-source-tab-Edit-source', initial, acceptedRevision: 10, selectionOnlySave: true });

      const sceneDraft = scene + config.comment;
      await page.getByTestId('mixed-scene-source').fill(sceneDraft);
      await surface().click();
      await x().fill('-');
      check(await x().inputValue() === '-' && await x().getAttribute('aria-invalid') === 'true', 'Raw minus not retained as invalid Surface draft.');
      await sphere().click(); await target('sphere');
      check(await x().inputValue() === '-' && !await x().isVisible(), 'Hidden raw minus was lost or remains visible.');
      check(!await x().evaluate((element) => { element.focus(); return document.activeElement === element; }), 'Hidden position remains focusable.');
      check(await page.getByTestId('mixed-scene-source').inputValue() === sceneDraft && await apply().isDisabled(), 'Hidden invalid position/source draft was dropped.');
      const help = page.getByRole('menuitem', { name: 'Help', exact: true });
      await help.focus(); await help.press('ArrowDown');
      const helpItem = page.getByRole('menuitem', { name: 'Object inspector', exact: true });
      await helpItem.focus(); await helpItem.press('Enter');
      await page.getByRole('dialog').waitFor();
      check((await page.getByRole('dialog').textContent()).includes('Object inspector'), 'Wrong contextual Help topic.');
      await page.getByRole('dialog').press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      await page.locator('[data-slot="menubar-content"]').waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Help');
      check(await x().inputValue() === '-' && !await x().isVisible(), 'Help discarded hidden raw input.');
      await page.screenshot({ path: config.output + '/hidden-invalid-sphere.png', fullPage: true });

      const beforeFailureDownloads = downloads;
      await page.getByTestId('save-file').click();
      await page.getByTestId('draft-dialog').waitFor();
      await page.getByTestId('draft-apply').click();
      await page.getByTestId('draft-dialog').getByTestId('app-error').waitFor();
      check(await revision() === '10' && (await pixels()).hash === initial.hash && downloads === beforeFailureDownloads, 'File Apply accepted or saved hidden invalid data.');
      await page.screenshot({ path: config.output + '/hidden-invalid-file-refusal.png', fullPage: true });
      await page.getByTestId('draft-cancel').click();
      await page.getByTestId('draft-dialog').waitFor({ state: 'detached' });
      check(await x().inputValue() === '-' && await page.getByTestId('mixed-scene-source').inputValue() === sceneDraft, 'File Cancel erased pending raw/source data.');
      // Dismiss the retained action error before clicking rows behind its overlay.
      if (await page.getByTestId('app-error').count()) {
        await page.getByRole('button', { name: 'Dismiss error', exact: true }).click();
        await page.getByTestId('app-error').waitFor({ state: 'detached' });
      }
      check(await x().inputValue() === '-', 'Dismissing the action error changed the hidden raw draft.');
      await page.getByRole('button', { name: 'Edit Surface position', exact: true }).click();
      await target('surface');
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Native X');
      check(await x().inputValue() === '-', 'Correction action replaced raw minus.');
      await x().fill('');
      await sphere().click(); await target('sphere');
      check(await x().inputValue() === '' && !await x().isVisible() && await apply().isDisabled(), 'Hidden empty position was dropped.');
      await page.getByRole('button', { name: 'Edit Surface position', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Native X');
      check(await x().inputValue() === '', 'Correction action replaced raw empty input.');
      await x().fill('-.5');
      check(await x().getAttribute('aria-invalid') === 'false', 'Corrected X remains invalid.');
      await page.getByTestId('mixed-surface-selector').selectOption('front');
      const targetStatus = await page.getByTestId('mixed-inspector-target-status').textContent();
      check(targetStatus.includes('Draft: imported_pair / front') && targetStatus.includes('Applied: imported_pair / rear'), 'Staged ref was shown as applied.');
      check((await surface().textContent()).includes('rear') && (await surfaceInspector().textContent()).includes('Draft'), 'Displayed geometry/header status is not truthful.');
      check(await revision() === '10' && (await pixels()).hash === initial.hash && !await apply().isDisabled(), 'Staging selected Surface changed the displayed scene.');
      await page.screenshot({ path: config.output + '/draft-surface-target.png', fullPage: true });
      await apply().click();
      await page.locator('[data-testid="presented-revision"][data-revision="11"]').waitFor();
      const applied = await pixels();
      check(await revision() === '11' && applied.hash !== initial.hash && (await surface().textContent()).includes('front'), 'Actual Surface Apply did not update geometry/revision.');
      await save('inspector.render-mixed.json');
      await page.getByRole('tab', { name: 'Scene', exact: true }).click();
      await target('surface');
      check(await page.getByTestId('mixed-scene-source').inputValue() === sceneDraft, 'Scene draft was lost when Surface applied.');
      await page.screenshot({ path: config.output + '/applied-surface.png', fullPage: true });
      check(errors.length === 0, 'Page errors: ' + errors.join('; '));
      rows.push({ case: 'hidden-minus-empty-Help-file-refusal-correction-focus-staged-ref-real-Apply', initial, applied, acceptedRevision: 11 });
      return { ok: true, rows, errors, downloads, revision: 11 };
    } catch (error) {
      const failure = { message: error.message, stack: error.stack, url: page.url(), errors };
      try { await page.screenshot({ path: config.output + '/first-failure.png', fullPage: true }); failure.html = await page.content(); }
      catch (capture) { failure.captureError = String(capture); }
      return { ok: false, rows, errors, failure };
    } finally { await page.close(); }
  });
  if (!receipt.browser.ok) {
    if (receipt.browser.failure.html) await writeFile(resolve(output, 'first-failure.html'), receipt.browser.failure.html);
    throw new Error(receipt.browser.failure.stack ?? receipt.browser.failure.message);
  }

  stage = 'selection-only authored-file equality';
  const beforeSelection = await readFile(resolve(output, 'before-selection.render-mixed.json'), 'utf8');
  const selectionOnly = await readFile(resolve(output, 'selection-only.render-mixed.json'), 'utf8');
  assert.equal(selectionOnly, beforeSelection, 'Selection changed authored download bytes.');
  assert.deepEqual(api.parseRenderMixedDocument(selectionOnly), original);
  const saved = api.parseRenderMixedDocument(await readFile(resolve(output, 'inspector.render-mixed.json'), 'utf8'));
  assert.equal(saved.revision, 11);
  assert.equal(saved.sceneSource, original.sceneSource + comment);
  assert.deepEqual(saved.asset, { ...original.asset, surfaceId: 'front' });
  assert.deepEqual(saved.camera, original.camera);
  assert.deepEqual(saved.display, { ...original.display, translate: [-.5, .6, -.3] });

  stage = 'fresh real file Open and re-edit';
  receipt.fresh = await run(async (base) => {
    const config = __CONFIG__, page = await base.context().newPage(), errors = [];
    const check = (value, message) => { if (!value) throw Error(message); };
    page.on('pageerror', (error) => errors.push(error.message));
    page.setDefaultTimeout(10000);
    const pixels = () => page.evaluate(() => {
      const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2');
      if (!gl || gl.isContextLost()) throw Error('Fresh actual WebGL2 unavailable.');
      const buffer = new Uint8Array(canvas.width * canvas.height * 4);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      let hash = 2166136261;
      for (const value of buffer) hash = Math.imul(hash ^ value, 16777619);
      return (hash >>> 0).toString(16);
    });
    try {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(config.url);
      await page.locator('[data-testid="presented-revision"][data-revision="0"]').waitFor();
      const ready = page.waitForEvent('filechooser');
      await page.getByTestId('open-file').click();
      await (await ready).setFiles(config.output + '/inspector.render-mixed.json');
      await page.locator('[data-testid="presented-revision"][data-revision="11"]').waitFor();
      check(await page.getByTestId('mixed-object-sphere').getAttribute('aria-pressed') === 'true'
        && await page.getByTestId('inspector-sphere').isVisible() && !await page.getByTestId('inspector-surface').isVisible(), 'Inspector target was persisted as document authority.');
      check(await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled()
        && await page.getByRole('button', { name: 'Redo', exact: true }).isDisabled(), 'Fresh Open retained previous history.');
      await page.screenshot({ path: config.output + '/fresh-default-sphere.png', fullPage: true });
      await page.getByTestId('mixed-object-surface').click();
      const x = page.locator('input[aria-label="Native X"]');
      check(Number(await x.inputValue()) === -.5 && Number(await page.locator('input[aria-label="Native Y"]').inputValue()) === .6
        && Number(await page.locator('input[aria-label="Native Z"]').inputValue()) === -.3, 'Fresh Surface position was lost.');
      check(await page.getByTestId('mixed-surface-selector').inputValue() === 'front', 'Fresh selected original Surface was lost.');
      const beforeEdit = await pixels();
      await x.fill('-.2');
      check(await page.getByTestId('accepted-revision').getAttribute('data-revision') === '11'
        && await pixels() === beforeEdit, 'Re-edit applied before request.');
      await page.getByRole('button', { name: 'Apply', exact: true }).click();
      await page.locator('[data-testid="presented-revision"][data-revision="12"]').waitFor();
      const afterApply = await pixels();
      check(afterApply !== beforeEdit, 'Fresh real Apply did not change Surface pixels.');
      const download = page.waitForEvent('download');
      await page.getByTestId('save-file').click();
      await (await download).saveAs(config.output + '/reedited.render-mixed.json');
      await page.screenshot({ path: config.output + '/fresh-reedited-surface.png', fullPage: true });
      check(errors.length === 0, 'Fresh page errors: ' + errors.join('; '));
      return { ok: true, revision: 12, errors, initialTarget: 'sphere', selectedSurface: 'front', beforeEdit, afterApply };
    } catch (error) {
      const failure = { message: error.message, stack: error.stack, url: page.url(), errors };
      try { await page.screenshot({ path: config.output + '/fresh-first-failure.png', fullPage: true }); failure.html = await page.content(); }
      catch (capture) { failure.captureError = String(capture); }
      return { ok: false, errors, failure };
    } finally { await page.close(); }
  });
  if (!receipt.fresh.ok) {
    if (receipt.fresh.failure.html) await writeFile(resolve(output, 'fresh-first-failure.html'), receipt.fresh.failure.html);
    throw new Error(receipt.fresh.failure.stack ?? receipt.fresh.failure.message);
  }
  stage = 'cold original native source and geometry preservation';
  const finalText = await readFile(resolve(output, 'reedited.render-mixed.json'), 'utf8');
  const final = api.parseRenderMixedDocument(finalText), cold = api.prepareRenderMixedDocument(final);
  assert.equal(final.revision, 12);
  assert.equal(final.sceneSource, original.sceneSource + comment);
  assert.deepEqual(final.asset, { ...original.asset, surfaceId: 'front' });
  assert.deepEqual(final.camera, original.camera);
  assert.deepEqual(final.display, { ...original.display, translate: [-.2, .6, -.3] });
  assert.deepEqual(cold.model, originalPrepared.model, 'Original complete F64/poles/weights/UV/model changed.');
  const curve = cold.model.objects.find((object) => object.id === 'stored_guide');
  assert(curve && curve.kind === 'curve');
  assert(curve.controlPoints[0].every((value) => Object.is(value, -0)), 'Original signed zero control point changed.');
  assert.deepEqual(cold.metadata.nativeObjects, originalPrepared.metadata.nativeObjects);
  assert.equal(cold.metadata.objectId, 'orb');
  receipt.files = { originalPath: inputPath, originalBytes: Buffer.byteLength(originalText), savedBytes: Buffer.byteLength(finalText),
    selectionOnlyBytesEqual: true, nativeSourceExact: true, sceneSourceCommentRetained: true, completeNativeModelEqual: true,
    originalIds: cold.metadata.nativeObjects.map((object) => object.id), selectedSurface: final.asset.surfaceId,
    assetRevision: final.asset.revision, position: final.display.translate, signedZero: true };
  receipt.ok = true;
  receipt.actualGL = true;
} catch (error) {
  receipt.firstFailure = { stage, message: error.message ?? String(error), stack: error.stack ?? String(error) };
  process.exitCode = 1;
  // A timed-out CLI may still own a new Page. Capture it, never the CLI root tab.
  if (opened && !receipt.browser?.failure && !receipt.fresh?.failure) {
    try {
      receipt.fallbackCapture = await run(async (base) => {
        const config = __CONFIG__, pages = base.context().pages().filter((page) => page !== base && page.url().startsWith(config.url));
        const page = pages.at(-1);
        if (!page) return { captured: false, reason: 'No live owned flow page.' };
        await page.screenshot({ path: config.output + '/first-failure.png', fullPage: true });
        return { captured: true, url: page.url(), html: await page.content() };
      });
      if (receipt.fallbackCapture.html) await writeFile(resolve(output, 'first-failure.html'), receipt.fallbackCapture.html);
    } catch (capture) { receipt.failureCaptureError = String(capture); }
  }
} finally {
  if (opened) {
    try { await call('close'); }
    catch (error) { receipt.cleanupFailure = String(error); process.exitCode = 1; receipt.ok = false; }
  }
  try { await server?.close(); }
  catch (error) { receipt.serverCleanupFailure = String(error); process.exitCode = 1; receipt.ok = false; }
  receipt.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, 'contextual-inspector-flow.json'), JSON.stringify(receipt, null, 2) + '\n');
}
console.log(JSON.stringify(receipt, null, 2));
