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
const output = resolve(process.argv[3]); await mkdir(dirname(output), { recursive: true }); await mkdir(output);
const execute = promisify(execFile), cli = process.env.PLAYWRIGHT_CLI_PATH, session = `unsaved-scene-${process.pid}`, url = 'http://127.0.0.1:52063/mixed.html';
const comment = '\n/* Applied source kept before navigation. */\n';
let sequence = 0, server, opened = false, stage = 'environment';
const receipt = { issue: 1163, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  clean: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() === '', node: process.version,
  startedAt: new Date().toISOString(), ok: false, actualGL: false };
async function call(command, ...args) {
  try {
    const result = await execute(process.execPath, [cli, `-s=${session}`, command, ...args, '--raw'], { cwd: output, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
    writeFileSync(resolve(output, `cli-${++sequence}-${command}.log`), result.stdout + result.stderr); return result.stdout.trim();
  } catch (error) { writeFileSync(resolve(output, `cli-${++sequence}-${command}-failed.log`), String(error.stdout ?? '') + String(error.stderr ?? '') + String(error)); throw error; }
}
async function run(fn) { return JSON.parse(await call('run-code', fn.toString().replace('__CONFIG__', JSON.stringify({ output, url, comment })))); }
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22); assert(cli, 'Use installed Playwright CLI; no downloads.');
  stage = 'genuine complete native file and current public source API';
  const inputPath = '/Users/user/.barocss-ai/v3/render-editor-1136/evidence/final-native-flow/title.render-mixed.json', originalText = await readFile(inputPath, 'utf8');
  await writeFile(resolve(output, 'original.render-mixed.json'), originalText); await writeFile(resolve(output, 'invalid.render-mixed.json'), '{invalid JSON');
  const bundle = await build({ absWorkingDir: root, stdin: { contents: "export * from '@barocss/render-editor';", resolveDir: app, sourcefile: 'unsaved-scene-source.mjs' },
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true });
  const inputs = Object.keys(bundle.metafile.inputs), sourceInputs = inputs.filter((path) => /packages\/barocss-[^/]+\/src\//.test(path)), distInputs = inputs.filter((path) => /packages\/barocss-[^/]+\/dist\//.test(path));
  assert(sourceInputs.length > 0); assert.equal(distInputs.length, 0);
  await writeFile(resolve(output, 'source-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const original = api.parseRenderMixedDocument(originalText), prepared = api.prepareRenderMixedDocument(original);
  assert.equal(original.revision, 15); assert.equal(original.asset.revision, 1);
  assert.deepEqual(prepared.metadata.nativeObjects.map((object) => [object.id, object.kind]), [['front', 'surface'], ['rear', 'surface'], ['stored_guide', 'curve']]);
  receipt.cpu = { sourceInputs: sourceInputs.length, ownDistInputs: 0, actualPreparation: true, objects: prepared.metadata.nativeObjects, noPackageAPIChange: true };
  stage = 'actual compact Chrome accepted-unsaved action guard';
  server = await createServer({ root: app, configFile: resolve(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 52063, strictPort: true } });
  await server.listen(); await call('open', url, '--browser', 'chrome'); opened = true;
  receipt.browser = await run(async (base) => {
    const config = __CONFIG__, page = await base.context().newPage(), errors = [], rows = [], check = (value, message) => { if (!value) throw Error(message); };
    let downloads = 0;
    page.on('pageerror', (error) => errors.push(error.message)); page.on('download', () => downloads++); page.setDefaultTimeout(10000);
    const dialog = () => page.getByTestId('unsaved-dialog'), open = () => page.getByTestId('open-file'), newScene = () => page.getByRole('button', { name: 'New mixed scene', exact: true }),
      source = () => page.getByRole('link', { name: 'Source editor', exact: true }), x = () => page.locator('input[aria-label="Native X"]'),
      apply = () => page.getByRole('button', { name: 'Apply', exact: true }), revision = () => page.getByTestId('accepted-revision').getAttribute('data-revision');
    const pixels = () => page.evaluate(() => {
      const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2'); if (!gl || gl.isContextLost()) throw Error('Actual WebGL2 unavailable.');
      const buffer = new Uint8Array(canvas.width * canvas.height * 4); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      let hash = 2166136261; for (const value of buffer) hash = Math.imul(hash ^ value, 16777619);
      return { hash: (hash >>> 0).toString(16), width: canvas.width, height: canvas.height };
    });
    const waitRevision = async (value) => { await page.locator('[data-testid="presented-revision"][data-revision="' + value + '"]').waitFor(); check(await revision() === String(value), 'Accepted/presented revision mismatch.'); };
    const dismiss = async () => { if (await page.getByTestId('app-error').count()) { await page.getByRole('button', { name: 'Dismiss error', exact: true }).click(); await page.getByTestId('app-error').waitFor({ state: 'detached' }); } };
    const cancel = async (focus, escape = false) => {
      if (escape) await dialog().press('Escape'); else await page.getByTestId('unsaved-cancel').click();
      await dialog().waitFor({ state: 'detached' });
      if (focus) await page.waitForFunction((selector) => document.activeElement === document.querySelector(selector), focus);
    };
    const unchanged = async (expectedRevision, hash, route, nativeText) => {
      check(await revision() === String(expectedRevision) && (await pixels()).hash === hash && page.url() === route, 'Guard changed current revision/frame/route.');
      check(await page.getByTestId('mixed-native-source').inputValue() === nativeText, 'Guard edited original native source.');
    };
    const chooseAfterContinue = async (file) => { const ready = page.waitForEvent('filechooser'); await page.getByTestId('unsaved-continue').click(); await (await ready).setFiles(config.output + '/' + file); };
    const captureDownload = async (file) => { const ready = page.waitForEvent('download'); await page.getByTestId('unsaved-download').click(); const download = await ready;
      check(download.suggestedFilename() === 'surface_study.render-mixed.json', 'Guard changed file identity.'); await download.saveAs(config.output + '/' + file); };
    try {
      await page.setViewportSize({ width: 1000, height: 760 }); await page.goto(config.url); await waitRevision(0); await page.waitForLoadState('networkidle');
      const ready = page.waitForEvent('filechooser'); await open().click(); await (await ready).setFiles(config.output + '/original.render-mixed.json'); await waitRevision(15);
      await page.getByTestId('mixed-object-surface').click(); const nativeText = await page.getByTestId('mixed-native-source').inputValue();
      await x().fill('-.4'); await apply().click(); await waitRevision(16);
      check(await apply().isDisabled() && (await page.locator('.app-document-state').textContent()).includes('Not downloaded'), 'Applied-undownloaded state is not distinct from a pending draft.');
      const initial = await pixels(), route = page.url(); await page.screenshot({ animations: 'disabled', path: config.output + '/ordinary-applied-unsaved.png', fullPage: true });
      await open().click(); await dialog().waitFor(); check(await page.getByTestId('draft-dialog').count() === 0, 'Accepted-only change was treated as a pending field.');
      await page.screenshot({ animations: 'disabled', path: config.output + '/accepted-unsaved-decision.png', fullPage: true }); await cancel('[data-testid="open-file"]', true);
      await unchanged(16, initial.hash, route, nativeText); check(await page.getByRole('button', { name: 'Undo', exact: true }).isEnabled(), 'Cancel lost accepted history.');
      await newScene().click(); await dialog().waitFor(); await cancel('button[aria-label="New mixed scene"]'); await unchanged(16, initial.hash, route, nativeText);
      const project = page.getByTestId('project-rational_panel'); await project.click(); await dialog().waitFor(); await cancel('[data-testid="project-rational_panel"]');
      await source().click(); await dialog().waitFor(); await cancel('a[href="/index.html"]'); await unchanged(16, initial.hash, route, nativeText);
      rows.push({ case: 'accepted-undownloaded-Open-New-project-Source-Cancel-Escape-focus-history', revision: 16, initial });

      const help = page.getByRole('menuitem', { name: 'Help', exact: true }); await help.focus(); await help.press('ArrowDown');
      const item = page.getByRole('menuitem', { name: 'Unsaved scene', exact: true }); await item.focus(); await item.press('Enter'); await page.getByRole('dialog').waitFor();
      check((await page.getByRole('dialog').textContent()).toLowerCase().includes('download'), 'Unsaved Help omits download behavior.');
      await page.getByRole('dialog').press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' }); await page.locator('[data-slot="menubar-content"]').waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Help');
      await open().click(); await dialog().waitFor(); await page.evaluate(() => { window.location.hash = '#/mixed/rational_panel'; });
      await page.getByTestId('unsaved-error').waitFor();
      check(await page.getByTestId('unsaved-continue').isDisabled() && await page.getByTestId('unsaved-download').isDisabled(), 'Stale decision remains actionable.');
      await unchanged(16, initial.hash, route, nativeText); await cancel('[data-testid="open-file"]'); await dismiss();
      rows.push({ case: 'contextual-Help-and-stale-navigation-refusal', revision: 16 });

      await open().click(); await dialog().waitFor(); const beforeDownloads = downloads;
      await page.evaluate(() => { const original = URL.createObjectURL; URL.createObjectURL = function(...args) { URL.createObjectURL = original; throw Error('Controlled download preparation failure.'); }; });
      await page.getByTestId('unsaved-download').click(); await page.getByTestId('unsaved-error').waitFor();
      check(downloads === beforeDownloads && await dialog().isVisible() && (await page.locator('.app-document-state').textContent()).includes('Not downloaded'), 'Failed download continued or cleared unsaved status.');
      await unchanged(16, initial.hash, route, nativeText); await page.screenshot({ animations: 'disabled', path: config.output + '/download-refusal.png', fullPage: true });
      await captureDownload('accepted16.render-mixed.json');
      check(await dialog().isVisible() && await revision() === '16' && page.url() === route, 'Download automatically replaced the current document.');
      await chooseAfterContinue('invalid.render-mixed.json'); await page.getByTestId('app-error').waitFor();
      await unchanged(16, initial.hash, route, nativeText); await dismiss();
      rows.push({ case: 'failed-download-retained-actual-download-stays-explicit-Continue-invalid-file', acceptedRevision: 16 });

      await x().fill('-.3'); await apply().click(); await waitRevision(17); const stable = await pixels();
      await open().click(); await dialog().waitFor();
      await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'), original = gl.createBuffer; let count = 0;
        gl.createBuffer = function(...args) { if (++count === 3) { gl.createBuffer = original; return null; } return original.apply(this, args); }; });
      await chooseAfterContinue('original.render-mixed.json'); await page.getByTestId('app-error').waitFor();
      await unchanged(17, stable.hash, route, nativeText); check((await page.locator('.app-document-state').textContent()).includes('Not downloaded'), 'Continue without downloading cleared source unsaved status.');
      await page.screenshot({ animations: 'disabled', path: config.output + '/retained-open-refusal.png', fullPage: true }); await dismiss();
      await open().click(); await dialog().waitFor(); await chooseAfterContinue('original.render-mixed.json'); await waitRevision(15);
      await page.evaluate((originalRoute) => { window.location.hash = new URL(originalRoute).hash; }, route); await waitRevision(17);
      rows.push({ case: 'explicit-Continue-controlled-realGL-open-refusal-success-original-cache-unsaved', retainedRevision: 17 });

      await x().fill('-'); await page.getByTestId('mixed-object-sphere').click(); await newScene().click(); await page.getByTestId('draft-dialog').waitFor();
      check(await dialog().count() === 0, 'Accepted decision bypassed invalid pending fields.'); await page.getByTestId('draft-apply').click(); await page.getByTestId('draft-dialog').getByTestId('app-error').waitFor();
      check(await revision() === '17' && await x().inputValue() === '-' && !await x().isVisible(), 'Pending invalid Position was applied or lost.');
      await page.screenshot({ animations: 'disabled', path: config.output + '/pending-position-refusal.png', fullPage: true }); await page.getByTestId('draft-cancel').click(); await page.getByTestId('draft-dialog').waitFor({ state: 'detached' }); await dismiss();
      await page.getByRole('button', { name: 'Edit Surface position', exact: true }).click(); await x().fill('-.3');
      await page.getByRole('tab', { name: 'Scene', exact: true }).click(); const scene = await page.getByTestId('mixed-scene-source').inputValue();
      await page.getByTestId('mixed-scene-source').fill(scene + config.comment); await newScene().click(); await page.getByTestId('draft-discard').click(); await dialog().waitFor();
      check(await page.getByTestId('mixed-scene-source').inputValue() === scene && await revision() === '17', 'Discard lost accepted authority instead of pending fields.'); await cancel('button[aria-label="New mixed scene"]');
      await page.getByTestId('mixed-scene-source').fill(scene + config.comment); await newScene().click(); await page.getByTestId('draft-apply').click(); await dialog().waitFor(); await waitRevision(18);
      await captureDownload('guarded.render-mixed.json'); check(await dialog().isVisible() && await revision() === '18', 'Composed draft Apply/download automatically replaced accepted data.');
      await cancel('button[aria-label="New mixed scene"]');
      await page.screenshot({ animations: 'disabled', path: config.output + '/downloaded-applied-scene.png', fullPage: true });
      for (const control of [open(), apply(), page.getByTestId('save-file'), page.getByTestId('accepted-revision')]) { const box = await control.boundingBox();
        check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1001 && box.y + box.height <= 761, 'Compact File/Apply/status control is outside supported viewport.'); }
      await newScene().click(); await waitRevision(0); check(await dialog().count() === 0, 'A downloaded accepted revision got a redundant prompt.');
      await newScene().click(); await dialog().waitFor(); check((await page.locator('.app-document-state').textContent()).includes('Not downloaded'), 'New local revision0 was marked downloaded.'); await cancel('button[aria-label="New mixed scene"]');
      check(errors.length === 0, 'Page errors: ' + errors.join('; '));
      rows.push({ case: 'pending-invalid-Cancel-Discard-Apply-accepted-download-stays-new-local0', savedRevision: 18 });
      return { ok: true, errors, rows, downloads, savedRevision: 18, viewport: { width: 1000, height: 760 } };
    } catch (error) {
      const failure = { message: error.message, stack: error.stack, url: page.url() };
      try { await page.screenshot({ animations: 'disabled', path: config.output + '/first-failure.png', fullPage: true }); failure.html = await page.content(); } catch (capture) { failure.captureError = String(capture); }
      return { ok: false, errors, rows, failure };
    } finally { await page.close(); }
  });
  if (!receipt.browser.ok) { if (receipt.browser.failure.html) await writeFile(resolve(output, 'first-failure.html'), receipt.browser.failure.html); throw Error(receipt.browser.failure.stack); }
  stage = 'actual accepted-only and composed-draft downloaded bytes';
  const accepted16 = api.parseRenderMixedDocument(await readFile(resolve(output, 'accepted16.render-mixed.json'), 'utf8'));
  assert.deepEqual(accepted16, { ...original, revision: 16, display: { ...original.display, translate: [-.4, .6, -.3] } });
  const saved = api.parseRenderMixedDocument(await readFile(resolve(output, 'guarded.render-mixed.json'), 'utf8'));
  assert.deepEqual(saved, { ...original, revision: 18, sceneSource: original.sceneSource + comment, display: { ...original.display, translate: [-.3, .6, -.3] } });
  stage = 'fresh actual native picker Open and re-edit protected file';
  receipt.fresh = await run(async (base) => {
    const config = __CONFIG__, page = await base.context().newPage(), errors = [], check = (value, message) => { if (!value) throw Error(message); };
    page.on('pageerror', (error) => errors.push(error.message)); page.setDefaultTimeout(10000);
    try {
      await page.setViewportSize({ width: 1000, height: 760 }); await page.goto(config.url); await page.locator('[data-testid="presented-revision"][data-revision="0"]').waitFor(); await page.waitForLoadState('networkidle');
      const ready = page.waitForEvent('filechooser'); await page.getByTestId('open-file').click(); await (await ready).setFiles(config.output + '/guarded.render-mixed.json');
      await page.locator('[data-testid="presented-revision"][data-revision="18"]').waitFor(); check(await page.getByTestId('unsaved-dialog').count() === 0, 'Fresh known file got an unsaved replacement prompt.');
      await page.getByTestId('mixed-object-surface').click(); const x = page.locator('input[aria-label="Native X"]'); check(Number(await x.inputValue()) === -.3, 'Protected file lost position.');
      await x.fill('.1'); await page.getByRole('button', { name: 'Apply', exact: true }).click(); await page.locator('[data-testid="presented-revision"][data-revision="19"]').waitFor();
      const download = page.waitForEvent('download'); await page.getByTestId('save-file').click(); await (await download).saveAs(config.output + '/reedited.render-mixed.json');
      check(await page.getByTestId('unsaved-dialog').count() === 0, 'Save used a redundant replacement dialog.');
      await page.screenshot({ animations: 'disabled', path: config.output + '/fresh-reedited-protected-scene.png', fullPage: true }); check(errors.length === 0, 'Fresh page errors.');
      return { ok: true, errors, revision: 19, actualNativePicker: true, ordinarySaveNoReplacementPrompt: true };
    } catch (error) {
      const failure = { message: error.message, stack: error.stack };
      try { await page.screenshot({ animations: 'disabled', path: config.output + '/fresh-first-failure.png', fullPage: true }); failure.html = await page.content(); } catch (capture) { failure.captureError = String(capture); }
      return { ok: false, errors, failure };
    } finally { await page.close(); }
  });
  if (!receipt.fresh.ok) { if (receipt.fresh.failure.html) await writeFile(resolve(output, 'fresh-first-failure.html'), receipt.fresh.failure.html); throw Error(receipt.fresh.failure.stack); }
  stage = 'cold complete original native authority';
  const finalText = await readFile(resolve(output, 'reedited.render-mixed.json'), 'utf8'), final = api.parseRenderMixedDocument(finalText), cold = api.prepareRenderMixedDocument(final);
  assert.deepEqual(final, { ...saved, revision: 19, display: { ...saved.display, translate: [.1, .6, -.3] } });
  assert.deepEqual(cold.model, prepared.model); assert.equal(final.asset.source, original.asset.source);
  assert(cold.model.objects.find((object) => object.id === 'stored_guide').controlPoints[0].every((value) => Object.is(value, -0)));
  receipt.files = { inputPath, originalBytes: Buffer.byteLength(originalText), savedBytes: Buffer.byteLength(finalText), acceptedOnlyRevision: 16,
    guardedRevision: 18, finalRevision: 19, completeNativeModelEqual: true, nativeSourceExact: true, assetRevision: final.asset.revision, signedZero: true,
    originalIds: cold.metadata.nativeObjects.map((object) => object.id) };
  receipt.ok = true; receipt.actualGL = true;
} catch (error) {
  receipt.firstFailure = { stage, message: error.message ?? String(error), stack: error.stack ?? String(error) }; process.exitCode = 1;
  if (opened && !receipt.browser?.failure && !receipt.fresh?.failure) {
    try { receipt.fallbackCapture = await run(async (base) => { const config = __CONFIG__, page = base.context().pages().filter((page) => page !== base && page.url().startsWith(config.url)).at(-1);
      if (!page) return { captured: false, reason: 'No live owned flow page.' }; await page.screenshot({ animations: 'disabled', path: config.output + '/first-failure.png', fullPage: true }); return { captured: true, html: await page.content() }; });
      if (receipt.fallbackCapture.html) await writeFile(resolve(output, 'first-failure.html'), receipt.fallbackCapture.html); } catch (capture) { receipt.captureError = String(capture); }
  }
} finally {
  if (opened) try { await call('close'); } catch (error) { receipt.cleanupFailure = String(error); receipt.ok = false; process.exitCode = 1; }
  try { await server?.close(); } catch (error) { receipt.serverCleanupFailure = String(error); receipt.ok = false; process.exitCode = 1; }
  receipt.finishedAt = new Date().toISOString(); await writeFile(resolve(output, 'unsaved-scene-flow.json'), JSON.stringify(receipt, null, 2) + '\n');
}
console.log(JSON.stringify(receipt, null, 2));
