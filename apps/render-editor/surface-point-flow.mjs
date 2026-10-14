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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), app = resolve(root, 'apps/render-editor');
assert(process.argv.length === 4 && process.argv[2] === '--output', 'Use --output <new-evidence-directory>.');
const output = resolve(process.argv[3]);
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
const execute = promisify(execFile), session = `surface-point-${process.pid}`, url = 'http://127.0.0.1:52059/mixed.html';
const cli = process.env.PLAYWRIGHT_CLI_PATH;
let sequence = 0, server, opened = false, stage = 'environment';
const receipt = { issue: 1143, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  clean: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() === '',
  node: process.version, startedAt: new Date().toISOString(), ok: false, actualGL: false };
async function call(command, ...args) {
  try {
    const result = await execute(process.execPath, [cli, `-s=${session}`, command, ...args, '--raw'], {
      cwd: output, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
    writeFileSync(resolve(output, `cli-${++sequence}-${command}.log`), result.stdout + result.stderr);
    return result.stdout.trim();
  } catch (error) {
    writeFileSync(resolve(output, `cli-${++sequence}-${command}-failed.log`), String(error.stdout ?? '') + String(error.stderr ?? '') + String(error));
    throw error;
  }
}
async function run(fn) { return JSON.parse(await call('run-code', fn.toString().replace('__CONFIG__', JSON.stringify({ output, url })))); }
// Independent degree-1 rational fixture oracle; no CAD evaluation or preview packet.
function oracle(u, v, rear = false) {
  const weights = rear ? [[1, 1.5], [2, 2.5]] : [[1, 2], [3, 4]], result = [0, 0, 0];
  let denominator = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const weight = [1 - u, u][i] * [1 - v, v][j] * weights[i][j];
    denominator += weight;
    const point = [i ? 15 : -15, j ? 11 : -11, rear ? -8 : 14];
    point.forEach((value, axis) => { result[axis] += value * weight; });
  }
  return result.map((value) => value / denominator);
}
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Use installed Node 22.');
  assert(cli, 'Set PLAYWRIGHT_CLI_PATH to the installed CLI. No dependencies are downloaded.');
  stage = 'original native fixture and public source API';
  const inputPath = '/Users/user/.barocss-ai/v3/render-editor-1136/evidence/final-native-flow/title.render-mixed.json';
  const originalText = await readFile(inputPath, 'utf8');
  await writeFile(resolve(output, 'original.render-mixed.json'), originalText);
  const bundle = await build({ absWorkingDir: root, stdin: { contents: "export * from '@barocss/render-editor';",
    resolveDir: app, sourcefile: 'surface-point-source.mjs' }, bundle: true, write: false,
    format: 'esm', platform: 'node', target: 'es2022', metafile: true });
  const inputs = Object.keys(bundle.metafile.inputs), sourceInputs = inputs.filter((path) => /packages\/barocss-[^/]+\/src\//.test(path)),
    distInputs = inputs.filter((path) => /packages\/barocss-[^/]+\/dist\//.test(path));
  assert(sourceInputs.length > 0); assert.equal(distInputs.length, 0);
  await writeFile(resolve(output, 'source-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const original = api.parseRenderMixedDocument(originalText), prepared = api.prepareRenderMixedDocument(original);
  assert.equal(original.revision, 15); assert.equal(original.asset.surfaceId, 'front');
  assert.deepEqual(prepared.metadata.nativeObjects.map((object) => [object.id, object.kind]),
    [['front', 'surface'], ['rear', 'surface'], ['stored_guide', 'curve']]);
  const before = JSON.stringify(original), samples = [];
  for (const [u, v] of [[0, 0], [.5, .5], [.25, .75], [1, 1]]) {
    const result = api.queryRenderMixedSurfacePoint(original, u, v), expected = oracle(u, v);
    result.pointMM.forEach((value, axis) => assert(Math.abs(value - expected[axis]) < 1e-12));
    assert.deepEqual(result.domain, { u: [0, 1], v: [0, 1] });
    assert.equal(result.modelId, 'imported_pair'); assert.equal(result.surfaceId, 'front');
    assert.equal(result.documentRevision, 15); assert.equal(result.assetRevision, 1);
    for (const value of [result, result.domain, result.domain.u, result.domain.v, result.parameters, result.pointMM]) assert(Object.isFrozen(value));
    assert.notEqual(result, api.queryRenderMixedSurfacePoint(original, u, v));
    samples.push({ u, v, pointMM: result.pointMM, independentExpected: expected });
  }
  let refusals = 0;
  for (const [u, v] of [[NaN, .5], [.5, Infinity], ['0.5', .5], [-.01, .5], [.5, 1.01]]) {
    assert.throws(() => api.queryRenderMixedSurfacePoint(original, u, v), (error) => {
      assert(error instanceof api.RenderMixedDocumentError);
      if (typeof u === 'number' && Number.isFinite(u) && Number.isFinite(v)) {
        assert.equal(error.code, 'NATIVE'); assert(error.cause instanceof Error); assert.equal(error.cause.message, 'Parameter is outside the knot domain');
      } else assert.equal(error.code, 'INPUT');
      return true;
    }); refusals++;
  }
  for (const asset of [{ ...original.asset, source: 'invalid source' }, { ...original.asset, modelId: 'wrong_model' },
    { ...original.asset, surfaceId: 'stored_guide' }]) {
    assert.throws(() => api.queryRenderMixedSurfacePoint({ ...original, asset }, .5, .5), (error) => {
      assert.equal(error.code, 'QUALIFICATION'); assert(error.cause); return true;
    }); refusals++;
  }
  assert.equal(JSON.stringify(original), before);
  receipt.cpu = { sourceInputs: sourceInputs.length, ownDistInputs: 0, samples, refusals, deepFrozenCopied: true, originalUnchanged: true };
  stage = 'actual compact Chrome applied Surface query';
  server = await createServer({ root: app, configFile: resolve(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 52059, strictPort: true } });
  await server.listen(); await call('open', url, '--browser', 'chrome'); opened = true;
  receipt.browser = await run(async (base) => {
    const config = __CONFIG__, page = await base.context().newPage(), errors = [], rows = [];
    let downloads = 0;
    const check = (value, message) => { if (!value) throw Error(message); };
    page.on('pageerror', (error) => errors.push(error.message)); page.on('download', () => downloads++);
    page.setDefaultTimeout(10000);
    const panel = () => page.getByTestId('surface-point-panel'), u = () => page.getByRole('textbox', { name: 'Surface U', exact: true }),
      v = () => page.getByRole('textbox', { name: 'Surface V', exact: true }), inspect = () => page.getByTestId('inspect-surface-point'),
      apply = () => page.getByRole('button', { name: 'Apply', exact: true }), x = () => page.locator('input[aria-label="Native X"]'),
      revision = () => page.getByTestId('accepted-revision').getAttribute('data-revision');
    const pixels = () => page.evaluate(() => {
      const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2');
      if (!gl || gl.isContextLost()) throw Error('Actual WebGL2 unavailable.');
      const buffer = new Uint8Array(canvas.width * canvas.height * 4);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      let hash = 2166136261; for (const value of buffer) hash = Math.imul(hash ^ value, 16777619);
      return { hash: (hash >>> 0).toString(16), width: canvas.width, height: canvas.height };
    });
    const save = async (file) => { const ready = page.waitForEvent('download'); await page.getByTestId('save-file').click(); await (await ready).saveAs(config.output + '/' + file); };
    const showPoint = async () => { if (await panel().getAttribute('open') === null) await panel().locator('summary').first().click(); };
    const readPoint = async (expected, surface = 'front') => {
      await inspect().click(); await page.getByTestId('surface-point-result').waitFor();
      const point = [];
      for (const [axis, value] of expected.entries()) {
        const actual = Number(await page.getByTestId('surface-point-' + ['x', 'y', 'z'][axis]).textContent());
        check(Math.abs(actual - value) < 1e-9, 'Native point mismatch: ' + axis + ', ' + actual + ' != ' + value); point.push(actual);
      }
      check((await page.getByTestId('surface-point-scope').textContent()).includes('imported_pair / ' + surface), 'Result uses a draft or stale ref.');
      return point;
    };
    const waitRevision = async (value) => { await page.locator('[data-testid="presented-revision"][data-revision="' + value + '"]').waitFor(); check(await revision() === String(value), 'Accepted/presented revision mismatch.'); };
    try {
      await page.setViewportSize({ width: 1000, height: 760 }); await page.goto(config.url);
      await waitRevision(0); await page.waitForLoadState('networkidle');
      const ready = page.waitForEvent('filechooser'); await page.getByTestId('open-file').click(); await (await ready).setFiles(config.output + '/original.render-mixed.json');
      await waitRevision(15); await page.getByTestId('mixed-object-surface').click(); await showPoint();
      const initial = await pixels(), nativeText = await page.getByTestId('mixed-native-source').inputValue();
      await save('before-inspection.render-mixed.json');
      await readPoint([6, 2.2, 14]); await inspect().scrollIntoViewIfNeeded();
      for (const target of [inspect(), apply(), page.getByTestId('open-file'), page.getByTestId('save-file'), page.getByTestId('accepted-revision')]) {
        const box = await target.boundingBox(); check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1001 && box.y + box.height <= 761, 'Compact control is outside the supported viewport.');
      }
      await page.screenshot({ path: config.output + '/compact-native-point.png', fullPage: true });
      await u().fill('0'); await v().fill('0'); await readPoint([-15, -11, 14]);
      await u().fill('.25'); await v().fill('.75'); await readPoint([-2.5, 7.333333333333333, 14]);
      for (const raw of ['-', '', '1.1']) {
        await u().fill(raw); check(await u().inputValue() === raw && await inspect().isDisabled(), 'Invalid parameter was clamped or accepted.');
        check(await page.getByTestId('surface-point-result').count() === 0 && await page.getByTestId('surface-point-error').isVisible(), 'Invalid query kept a stale result or omitted error.');
        check(await apply().isDisabled() && await revision() === '15', 'Query input changed document draft.');
      }
      await page.screenshot({ path: config.output + '/invalid-query.png', fullPage: true });
      await u().fill('.25'); await v().fill('.75'); await readPoint([-2.5, 7.333333333333333, 14]);
      await page.getByTestId('mixed-object-sphere').click();
      check(!await panel().isVisible(), 'Surface point controls remain visible under Sphere.');
      check(!await panel().locator('input').first().evaluate((element) => { element.focus(); return document.activeElement === element; }), 'Hidden query input remains focusable.');
      const help = page.getByRole('menuitem', { name: 'Help', exact: true }); await help.focus(); await help.press('ArrowDown');
      const item = page.getByRole('menuitem', { name: 'Source point', exact: true }); await item.focus(); await item.press('Enter');
      await page.getByRole('dialog').waitFor(); check((await page.getByRole('dialog').textContent()).includes('millimeters'), 'Source point Help missing native units.');
      await page.getByRole('dialog').press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
      await page.locator('[data-slot="menubar-content"]').waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Help');
      await page.getByTestId('mixed-object-surface').click();
      check(await u().inputValue() === '.25' && await v().inputValue() === '.75' && await page.getByTestId('surface-point-result').count() === 1, 'Hide/show/Help lost same-context query.');
      check(await revision() === '15' && (await pixels()).hash === initial.hash && await apply().isDisabled(), 'Inspection changed accepted pixels/draft.');
      check(await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled() && await page.getByRole('button', { name: 'Redo', exact: true }).isDisabled(), 'Inspection changed history.');
      check(await page.getByTestId('mixed-native-source').inputValue() === nativeText, 'Inspection edited native source.');
      await save('inspection-only.render-mixed.json');
      rows.push({ case: 'compact-reachability-rational-endpoint-interior-raw-errors-Help-hide-show', initial, queryMutatesDocument: false });

      await page.getByTestId('mixed-native-source').fill(nativeText.replaceAll(',14]', ',24]'));
      await page.getByTestId('mixed-surface-selector').selectOption('rear'); await u().fill('-');
      check(!await apply().isDisabled() && await inspect().isDisabled(), 'Invalid local query blocked authored Apply.');
      await u().fill('.5'); await v().fill('.5'); await readPoint([6, 2.2, 14]);
      check((await page.getByTestId('surface-point-applied').textContent()).includes('front') && (await pixels()).hash === initial.hash, 'Query used pending Surface.');
      await page.screenshot({ path: config.output + '/draft-ref-applied-query.png', fullPage: true });
      await apply().click(); await waitRevision(16);
      check(await page.getByTestId('surface-point-result').count() === 0 && await u().inputValue() === '0.5', 'Applied changed ref retained stale result/default.');
      await readPoint([4.285714285714286, 1.5714285714285714, -8], 'rear');
      await page.getByRole('button', { name: 'Undo', exact: true }).click(); await waitRevision(17);
      check(await page.getByTestId('surface-point-result').count() === 0 && (await page.getByTestId('surface-point-applied').textContent()).includes('front'), 'Undo retained the previous ref result.');
      await readPoint([6, 2.2, 14]);
      rows.push({ case: 'query-independent-of-native-source-ref-draft-Apply-Undo-invalidates-ref', appliedRevision: 16, undoRevision: 17 });

      await x().fill('-'); await page.getByTestId('mixed-object-sphere').click();
      check(await apply().isDisabled() && await x().inputValue() === '-' && !await x().isVisible(), 'Hidden authored invalid position lost its guard.');
      const count = downloads; await page.getByTestId('save-file').click(); await page.getByTestId('draft-dialog').waitFor();
      await page.getByTestId('draft-apply').click(); await page.getByTestId('draft-dialog').getByTestId('app-error').waitFor();
      check(await revision() === '17' && downloads === count, 'Hidden invalid position was applied/downloaded.');
      await page.screenshot({ path: config.output + '/hidden-position-file-refusal.png', fullPage: true });
      await page.getByTestId('draft-cancel').click(); await page.getByTestId('draft-dialog').waitFor({ state: 'detached' });
      if (await page.getByTestId('app-error').count()) await page.getByRole('button', { name: 'Dismiss error', exact: true }).click();
      await page.getByRole('button', { name: 'Edit Surface position', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Native X');
      check(await x().inputValue() === '-', 'Correction replaced raw authored invalid input.');
      await readPoint([6, 2.2, 14]); check(await apply().isDisabled(), 'Query bypassed the authored position guard.');
      await x().fill('-.5'); await save('point.render-mixed.json');
      check(await revision() === '17' && await apply().isDisabled(), 'Correction to accepted position created a new transaction.');
      await inspect().scrollIntoViewIfNeeded(); await page.screenshot({ path: config.output + '/accepted-point.png', fullPage: true });
      check(errors.length === 0, 'Page errors: ' + errors.join('; '));
      rows.push({ case: 'hidden-authored-position-file-refusal-correct-query-retained', revision: 17 });
      return { ok: true, rows, errors, downloads, viewport: { width: 1000, height: 760 }, revision: 17 };
    } catch (error) {
      const failure = { message: error.message, stack: error.stack, url: page.url() };
      try { await page.screenshot({ path: config.output + '/first-failure.png', fullPage: true }); failure.html = await page.content(); } catch (capture) { failure.captureError = String(capture); }
      return { ok: false, rows, errors, failure };
    } finally { await page.close(); }
  });
  if (!receipt.browser.ok) { if (receipt.browser.failure.html) await writeFile(resolve(output, 'first-failure.html'), receipt.browser.failure.html); throw Error(receipt.browser.failure.stack); }
  stage = 'inspection-only real file byte equality';
  const beforeFile = await readFile(resolve(output, 'before-inspection.render-mixed.json'), 'utf8'), afterFile = await readFile(resolve(output, 'inspection-only.render-mixed.json'), 'utf8');
  assert.equal(afterFile, beforeFile); assert.deepEqual(api.parseRenderMixedDocument(afterFile), original);
  const saved = api.parseRenderMixedDocument(await readFile(resolve(output, 'point.render-mixed.json'), 'utf8'));
  assert.deepEqual(saved, { ...original, revision: 17 });
  stage = 'fresh real file Open inspect and display re-edit';
  receipt.fresh = await run(async (base) => {
    const config = __CONFIG__, page = await base.context().newPage(), errors = [];
    const check = (value, message) => { if (!value) throw Error(message); };
    page.on('pageerror', (error) => errors.push(error.message)); page.setDefaultTimeout(10000);
    try {
      await page.setViewportSize({ width: 1000, height: 760 }); await page.goto(config.url);
      await page.locator('[data-testid="presented-revision"][data-revision="0"]').waitFor(); await page.waitForLoadState('networkidle');
      const ready = page.waitForEvent('filechooser'); await page.getByTestId('open-file').click(); await (await ready).setFiles(config.output + '/point.render-mixed.json');
      await page.locator('[data-testid="presented-revision"][data-revision="17"]').waitFor();
      check(await page.getByTestId('mixed-object-sphere').getAttribute('aria-pressed') === 'true', 'Fresh editor target is not Sphere.');
      await page.getByTestId('mixed-object-surface').click();
      const panel = page.getByTestId('surface-point-panel'); await panel.locator('summary').first().click();
      const u = page.getByRole('textbox', { name: 'Surface U', exact: true }), v = page.getByRole('textbox', { name: 'Surface V', exact: true });
      check(await u.inputValue() === '0.5' && await v.inputValue() === '0.5' && await page.getByTestId('surface-point-result').count() === 0, 'File persisted local query/result state.');
      await page.getByTestId('inspect-surface-point').click();
      check(Math.abs(Number(await page.getByTestId('surface-point-x').textContent()) - 6) < 1e-9, 'Fresh original rational point changed.');
      await page.getByRole('textbox', { name: 'Native X', exact: true }).fill('-.2');
      await page.getByRole('button', { name: 'Apply', exact: true }).click();
      await page.locator('[data-testid="presented-revision"][data-revision="18"]').waitFor();
      check(await page.getByTestId('surface-point-result').count() === 0, 'Same-ref display Apply kept previous accepted-context result.');
      await page.getByTestId('inspect-surface-point').click();
      const point = await Promise.all(['x', 'y', 'z'].map(async (axis) => Number(await page.getByTestId('surface-point-' + axis).textContent())));
      check(point.every((value, axis) => Math.abs(value - [6, 2.2, 14][axis]) < 1e-9), 'Display position scaled or translated original source point.');
      const download = page.waitForEvent('download'); await page.getByTestId('save-file').click(); await (await download).saveAs(config.output + '/reedited.render-mixed.json');
      await page.getByTestId('inspect-surface-point').scrollIntoViewIfNeeded(); await page.screenshot({ path: config.output + '/fresh-reedited-point.png', fullPage: true });
      check(errors.length === 0, 'Fresh page errors: ' + errors.join('; '));
      return { ok: true, errors, revision: 18, pointMM: point, localStateNotRestored: true, sameRefApplyInvalidated: true };
    } catch (error) {
      const failure = { message: error.message, stack: error.stack };
      try { await page.screenshot({ path: config.output + '/fresh-first-failure.png', fullPage: true }); failure.html = await page.content(); } catch (capture) { failure.captureError = String(capture); }
      return { ok: false, errors, failure };
    } finally { await page.close(); }
  });
  if (!receipt.fresh.ok) { if (receipt.fresh.failure.html) await writeFile(resolve(output, 'fresh-first-failure.html'), receipt.fresh.failure.html); throw Error(receipt.fresh.failure.stack); }
  stage = 'cold complete original native source preservation';
  const finalText = await readFile(resolve(output, 'reedited.render-mixed.json'), 'utf8'), final = api.parseRenderMixedDocument(finalText), cold = api.prepareRenderMixedDocument(final);
  assert.deepEqual(final, { ...original, revision: 18, display: { ...original.display, translate: [-.2, .6, -.3] } });
  assert.deepEqual(cold.model, prepared.model); assert.equal(final.asset.source, original.asset.source);
  assert(cold.model.objects.find((object) => object.id === 'stored_guide').controlPoints[0].every((value) => Object.is(value, -0)));
  receipt.files = { inputPath, originalBytes: Buffer.byteLength(originalText), savedBytes: Buffer.byteLength(finalText),
    inspectionOnlyBytesEqual: true, completeNativeModelEqual: true, nativeSourceExact: true, signedZero: true, assetRevision: final.asset.revision,
    finalRevision: 18, selectedSurface: final.asset.surfaceId, originalIds: cold.metadata.nativeObjects.map((object) => object.id) };
  receipt.ok = true; receipt.actualGL = true;
} catch (error) {
  receipt.firstFailure = { stage, message: error.message ?? String(error), stack: error.stack ?? String(error) }; process.exitCode = 1;
  if (opened && !receipt.browser?.failure && !receipt.fresh?.failure) {
    try { receipt.fallbackCapture = await run(async (base) => {
      const config = __CONFIG__, page = base.context().pages().filter((page) => page !== base && page.url().startsWith(config.url)).at(-1);
      if (!page) return { captured: false, reason: 'No live owned flow page.' };
      await page.screenshot({ path: config.output + '/first-failure.png', fullPage: true }); return { captured: true, url: page.url(), html: await page.content() };
    }); if (receipt.fallbackCapture.html) await writeFile(resolve(output, 'first-failure.html'), receipt.fallbackCapture.html); }
    catch (capture) { receipt.failureCaptureError = String(capture); }
  }
} finally {
  if (opened) try { await call('close'); } catch (error) { receipt.cleanupFailure = String(error); process.exitCode = 1; receipt.ok = false; }
  try { await server?.close(); } catch (error) { receipt.serverCleanupFailure = String(error); process.exitCode = 1; receipt.ok = false; }
  receipt.finishedAt = new Date().toISOString(); await writeFile(resolve(output, 'surface-point-flow.json'), JSON.stringify(receipt, null, 2) + '\n');
}
console.log(JSON.stringify(receipt, null, 2));
