import assert from 'node:assert/strict';
import {execFileSync, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'vite';
import {writeFileSync} from 'node:fs';
import {mkdir, readFile, writeFile, access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const index = process.argv.indexOf('--output');
assert(index >= 0 && process.argv[index + 1], 'Use --output <unique-directory>. Start the real app dev server first.');
const output = resolve(process.argv[index + 1]);
await mkdir(output, {recursive: true});
const resultFile = resolve(output, 'source-browser.json');
try { await access(resultFile); throw new Error('Refuse to overwrite an existing native receipt.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const cli = process.env.PLAYWRIGHT_CLI_PATH;
assert(cli, 'Set PLAYWRIGHT_CLI_PATH to the already installed @playwright/cli/playwright-cli.js. No install is performed.');
const session = `render-editor-flow-${process.pid}`;
const url = process.env.RENDER_EDITOR_URL ?? 'http://127.0.0.1:52047/';
const receipt = {issue: 1047, mode: 'ordinary-source-browser', node: process.version, url, startedAt: new Date().toISOString(), cleanCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(), ok: false, stages: []};
let sequence = 0;
const execute = promisify(execFile);
let server;
async function call(command, ...args) {
  try {
    const {stdout: text} = await execute(process.execPath, [cli, `-s=${session}`, command, ...args, '--raw'], {cwd: output, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024});
    writeFileSync(resolve(output, `cli-${++sequence}-${command}.log`), text);
    return text.trim();
  } catch (error) {
    const text = String(error.stdout ?? '') + String(error.stderr ?? '') + String(error);
    writeFileSync(resolve(output, `cli-${++sequence}-${command}-failure.log`), text);
    throw error;
  }
}
async function run(fn, config = {}) { return JSON.parse(await call('run-code', fn.toString().replace('__CONFIG__', JSON.stringify({...config, output, url})))); }
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let fixtureOriginal;
try {
  if (!process.env.RENDER_EDITOR_URL) { server = await createServer({root: here, configFile: resolve(here, 'vite.config.ts')}); await server.listen(); }
  await call('open', url, '--browser', 'chrome');
  const edit = await run(async (page) => {
    const config = __CONFIG__, rows = [], errors = [];
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({width: 1440, height: 1000});
    await page.addInitScript(() => {
      const programs = new Set(), arrays = new Set(), losses = new Set(), observers = new Set();
      for (const [create, remove, set] of [['createProgram', 'deleteProgram', programs], ['createVertexArray', 'deleteVertexArray', arrays]]) {
        const originalCreate = WebGL2RenderingContext.prototype[create], originalRemove = WebGL2RenderingContext.prototype[remove];
        WebGL2RenderingContext.prototype[create] = function (...args) { const value = originalCreate.apply(this, args); if (value) set.add(value); return value; };
        WebGL2RenderingContext.prototype[remove] = function (value) { set.delete(value); return originalRemove.call(this, value); };
      }
      const add = HTMLCanvasElement.prototype.addEventListener, remove = HTMLCanvasElement.prototype.removeEventListener;
      HTMLCanvasElement.prototype.addEventListener = function (type, listener, options) { if (type === 'webglcontextlost') losses.add(listener); return add.call(this, type, listener, options); };
      HTMLCanvasElement.prototype.removeEventListener = function (type, listener, options) { if (type === 'webglcontextlost') losses.delete(listener); return remove.call(this, type, listener, options); };
      const OriginalObserver = ResizeObserver;
      window.ResizeObserver = class extends OriginalObserver { observe(...args) { if (args[0] instanceof HTMLCanvasElement) observers.add(this); return super.observe(...args); } disconnect() { observers.delete(this); return super.disconnect(); } };
      window.__renderEditorEvidence = {counts: () => ({programs: programs.size, vertexArrays: arrays.size, contextLossListeners: losses.size, resizeObservers: observers.size})};
    });
    await page.reload();
    await page.locator('[data-testid="presented-revision"][data-revision="0"]').waitFor();
    const pixels = () => page.evaluate(() => { const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2'), bytes = new Uint8Array(canvas.width * canvas.height * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes); let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619); return {hash: (value >>> 0).toString(16), width: canvas.width, height: canvas.height, renderer: gl.getParameter(gl.RENDERER)}; });
    const revision = () => page.getByTestId('accepted-revision').getAttribute('data-revision');
    const source = page.getByTestId('scene-source');
    const original = await source.inputValue(), initialPixels = await pixels();
    check((await page.getByRole('region', {name: 'Scene objects', exact: true}).getByRole('listitem').count()) === 3, 'Initial actual inventory count');
    let edited = original.replace('radius: .75', 'radius: 1.05').replace('size: 1.25 1.5 1.25', 'size: 1.6 1.5 1.25');
    await source.fill(edited); check(await revision() === '0', 'Typing accepted source prematurely'); check((await pixels()).hash === initialPixels.hash, 'Typing changed accepted pixels');
    await page.getByRole('button', {name: 'Apply source', exact: true}).click(); check(await revision() === '1', 'Source apply revision'); const editedPixels = await pixels(); check(editedPixels.hash !== initialPixels.hash, 'Two object edits did not change pixels'); rows.push({case: 'two-object-draft-apply', initialPixels, editedPixels});
    edited = edited.replace('  cylinder #post;', '  cylinder #post;\n  sphere #extra;') + '\n#extra { radius: .32; translate: 0 1.5 0; color: #e4b376; }\n';
    await source.fill(edited); await page.getByRole('button', {name: 'Apply source', exact: true}).click(); check(await revision() === '2', 'Add revision'); check(await page.getByRole('region', {name: 'Scene objects', exact: true}).getByRole('listitem').count() === 4, 'Added object inventory missing');
    edited = edited.replace('  cylinder #post;\n', '').replace(/#post \{[^}]*\}\n/, '');
    await source.fill(edited); await page.getByRole('button', {name: 'Apply source', exact: true}).click(); check(await revision() === '3', 'Remove revision'); check(await page.getByRole('region', {name: 'Scene objects', exact: true}).getByRole('listitem').count() === 3, 'Removed object inventory retained'); rows.push({case: 'add-remove-original-ids', ids: ['orb', 'block', 'extra']});
    const preCamera = await pixels(); await page.getByRole('spinbutton', {name: 'eye X', exact: true}).fill('2'); check(await revision() === '3' && (await pixels()).hash === preCamera.hash, 'Camera typing changed acceptance'); await page.getByRole('button', {name: 'Apply camera', exact: true}).click(); check(await revision() === '4', 'Camera apply revision'); const cameraPixels = await pixels(); check(cameraPixels.hash !== preCamera.hash && await source.inputValue() === edited, 'Camera apply did not preserve source or change pixels');
    await page.getByRole('button', {name: 'Undo', exact: true}).click(); check(await revision() === '5' && await page.getByRole('spinbutton', {name: 'eye X', exact: true}).inputValue() === '0', 'Camera Undo');
    await page.getByRole('button', {name: 'Undo', exact: true}).click(); check(await page.getByRole('region', {name: 'Scene objects', exact: true}).getByRole('listitem').count() === 4, 'Source Undo');
    await page.getByRole('button', {name: 'Redo', exact: true}).click(); await page.getByRole('button', {name: 'Redo', exact: true}).click(); check(await revision() === '8' && (await pixels()).hash === cameraPixels.hash, 'Source/camera Redo pixels'); rows.push({case: 'source-camera-undo-redo', cameraPixels});
    await source.fill('bad scene syntax'); await page.getByRole('button', {name: 'Apply source', exact: true}).click(); check(await revision() === '8' && (await pixels()).hash === cameraPixels.hash, 'Invalid syntax replaced acceptance'); check(await page.getByRole('region', {name: 'Diagnostics', exact: true}).innerText().then(text => text.includes('Expected')), 'Compiler diagnostic code absent'); check(await page.getByTestId('source-error-count').innerText() === '1', 'Compiler diagnostic badge mismatch');
    await page.getByTestId('save-file').click(); await page.getByTestId('draft-cancel').click(); check(await source.inputValue() === 'bad scene syntax', 'Cancel lost draft');
    const discard = async () => { const trigger = page.getByRole('menuitem', {name: 'Edit', exact: true}); await trigger.focus(); await trigger.press('ArrowDown'); const menu = page.locator('[data-slot="menubar-content"][data-state="open"]'); await menu.getByRole('menuitem', {name: 'Discard draft', exact: true}).focus(); await menu.getByRole('menuitem', {name: 'Discard draft', exact: true}).press('Enter'); await page.locator('[data-slot="menubar-content"]').waitFor({state: 'detached'}); };
    await discard(); await page.getByText('Advanced camera', {exact: true}).click(); await page.getByRole('spinbutton', {name: 'near', exact: true}).fill('-1'); await page.getByRole('button', {name: 'Apply camera', exact: true}).click(); check(await revision() === '8' && (await pixels()).hash === cameraPixels.hash, 'Invalid camera replaced acceptance'); await discard();
    await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'), original = gl.createProgram; gl.createProgram = function () { gl.createProgram = original; return null; }; });
    await source.fill(edited.replace('radius: 1.05', 'radius: 1.15')); await page.getByRole('button', {name: 'Apply source', exact: true}).click(); check(await revision() === '8' && (await pixels()).hash === cameraPixels.hash, 'Concrete program allocation refusal changed acceptance');
    const previewNotice = page.getByTestId('preview-notice');
    check((await previewNotice.innerText()).includes('The previous scene is still shown.'), 'Retained preview task copy missing');
    check(!(await previewNotice.innerText()).includes('Cannot allocate program'), 'Technical cause leaked into ordinary task copy');
    check((await page.getByTestId('preview-error-details').textContent()).includes('PRESENTATION_REFUSED: Cannot allocate program'), 'Actual machine refusal missing from optional Details');
    check(await page.getByTestId('source-error-count').innerText() === '0', 'Preview refusal was counted as a source error');
    check(await page.getByTestId('app-error').count() === 0, 'Duplicate app preview refusal notice');
    check(await page.getByRole('button', {name: 'Restore preview', exact: true}).count() === 0, 'Retained preview incorrectly offered remount');
    check(await page.getByTestId('presented-revision').innerText() === 'Preview unchanged', 'Retained preview status disagrees with notice');
    check(await page.evaluate(() => document.activeElement.getAttribute('aria-label')) === 'Apply source', 'Refusal stole action focus');
    await page.screenshot({path: config.output + '/retained-refusal.png', fullPage: true});
    await previewNotice.getByText('Details', {exact: true}).click(); check((await previewNotice.innerText()).includes('Cannot allocate program'), 'Details did not expose native cause');
    check((await pixels()).hash === cameraPixels.hash, 'Details changed accepted pixels');
    await page.getByRole('button', {name: 'Retry update', exact: true}).click();
    check(await revision() === '9' && await page.getByTestId('preview-notice').count() === 0 && await page.getByTestId('presented-revision').innerText() === 'Preview ready', 'Successful retry did not resolve preview notice');
    check((await pixels()).hash !== cameraPixels.hash, 'Retry did not change actual accepted pixels');
    await page.getByRole('button', {name: 'Undo', exact: true}).click(); check(await revision() === '10' && (await pixels()).hash === cameraPixels.hash, 'Retry Undo did not preserve accepted history');
    rows.push({case: 'syntax-camera-allocation-retention', refusedRevision: 8, retryRevision: 9, acceptedRevision: 10, pixels: cameraPixels, sourceErrors: 0, retainedAction: 'Retry update', focusRetained: true, detailsPreserveCause: true});
    const downloadReady = page.waitForEvent('download'); await page.getByRole('menuitem', {name: 'File', exact: true}).focus(); await page.getByRole('menuitem', {name: 'File', exact: true}).press('ArrowDown'); const saveItem = page.locator('[data-slot="menubar-content"][data-state="open"]').getByTestId('menu-save'); await saveItem.focus(); await saveItem.press('Enter'); const download = await downloadReady; await download.saveAs(config.output + '/saved.render-scene.json');
    await page.locator('[data-slot="menubar-content"]').waitFor({state: 'detached'});
    await page.getByText('Advanced camera', {exact: true}).click();
    await source.evaluate(element => { element.scrollTop = 0; });
    check(await page.getByTestId('app-error').count() === 0 && await page.getByTestId('preview-notice').count() === 0, 'Clean task screenshot still had an unresolved notice');
    await page.screenshot({path: config.output + '/accepted-app.png', fullPage: true});
    const resourcesBefore = await page.evaluate(() => window.__renderEditorEvidence.counts());
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const resourcesAfter = await page.evaluate(() => window.__renderEditorEvidence.counts());
    check(resourcesAfter.programs === 0 && resourcesAfter.vertexArrays === 0 && resourcesAfter.contextLossListeners === 0 && resourcesAfter.resizeObservers === 0, 'Owned lifecycle resources leaked: ' + JSON.stringify(resourcesAfter));
    check(await source.inputValue() === edited && await source.count() === 1 && await page.locator('canvas').count() === 1, 'Dispose removed caller DOM/data');
    check(errors.length === 0, 'App page errors: ' + errors.join('; '));
    return {rows, savedSource: edited, savedEyeX: 2, savedRevision: 10, resourcesBefore, resourcesAfter, errors};
  });
  receipt.stages.push(edit);
  const savedBytes = await readFile(resolve(output, 'saved.render-scene.json'));
  const saved = JSON.parse(savedBytes);
  assert.equal(saved.sceneSource, edit.savedSource); assert.equal(saved.camera.eye[0], edit.savedEyeX); assert.equal(saved.revision, edit.savedRevision); assert.equal(saved.sourceVersion, 1);
  assert.deepEqual(Object.keys(saved), ['format', 'version', 'kind', 'documentId', 'title', 'revision', 'sourceVersion', 'sceneSource', 'camera']);
  receipt.savedFile = {path: resolve(output, 'saved.render-scene.json'), bytes: savedBytes.length, sha256: hash(savedBytes)};
  const cases = {version: {...saved, version: 9}, syntax: {...saved, sceneSource: 'bad syntax'}, camera: {...saved, camera: {...saved.camera, near: -1}}, combined: {...saved, documentId: 'refused_import', title: 'Refused import', sceneSource: saved.sceneSource.replace('radius: 1.05', 'radius: 1.2'), camera: {...saved.camera, eye: [3, 1.3, 8]}}};
  for (const [name, value] of Object.entries(cases)) await writeFile(resolve(output, `${name}.json`), JSON.stringify(value));
  await writeFile(resolve(output, 'oversized.json'), ' '.repeat(262145));
  const reopened = await run(async (page) => {
    const config = __CONFIG__, rows = [], errors = [];
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const fresh = await page.context().newPage(); fresh.on('pageerror', error => errors.push(error.message));
    await fresh.setViewportSize({width: 1440, height: 1000}); await fresh.goto(config.url); await fresh.locator('[data-testid="presented-revision"][data-revision="0"]').waitFor();
    const open = async filename => { const chooserReady = fresh.waitForEvent('filechooser'); await fresh.getByRole('menuitem', {name: 'File', exact: true}).focus(); await fresh.getByRole('menuitem', {name: 'File', exact: true}).press('ArrowDown'); const item = fresh.locator('[data-slot="menubar-content"][data-state="open"]').getByTestId('menu-open'); await item.focus(); await item.press('Enter'); const chooser = await chooserReady; await chooser.setFiles(config.output + '/' + filename); await fresh.locator('[data-slot="menubar-content"]').waitFor({state: 'detached'}); };
    const revision = () => fresh.getByTestId('accepted-revision').getAttribute('data-revision');
    const pixels = () => fresh.evaluate(() => { const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2'), bytes = new Uint8Array(canvas.width * canvas.height * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes); let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619); return (value >>> 0).toString(16); });
    await open('saved.render-scene.json'); await fresh.locator('[data-testid="accepted-revision"][data-revision="10"]').waitFor(); const source = fresh.getByTestId('scene-source'); check(await source.inputValue() === config.saved.sceneSource && await fresh.getByRole('spinbutton', {name: 'eye X', exact: true}).inputValue() === '2', 'Fresh file Open lost source/camera');
    const reedited = config.saved.sceneSource.replace('radius: 1.05', 'radius: 1.15'); const before = await pixels(); await source.fill(reedited); await fresh.getByRole('button', {name: 'Apply source', exact: true}).click(); check(await revision() === '11' && await pixels() !== before, 'Fresh re-edit did not change pixels');
    const downloadReady = fresh.waitForEvent('download'); await fresh.getByTestId('save-file').click(); const download = await downloadReady; await download.saveAs(config.output + '/reopened.render-scene.json'); rows.push({case: 'saved-disk-file-fresh-open-reedit-save', source: reedited, revision: 11});
    const route = fresh.url(), acceptedPixels = await pixels();
    for (const name of ['version', 'syntax', 'camera', 'oversized']) { await open(name + '.json'); await fresh.getByTestId('app-error').waitFor(); check(await revision() === '11' && fresh.url() === route && await source.inputValue() === reedited && await pixels() === acceptedPixels, 'Invalid ' + name + ' file replaced accepted scene'); const copy = await fresh.getByTestId('app-error').innerText(); if (name === 'oversized') check(copy.includes('too large'), 'Oversized-file task copy hid its actual restriction'); if (name === 'version') check(copy.includes('not supported'), 'Unsupported-file task copy hid its format restriction'); if (name === 'syntax') check(copy.includes('source has an error'), 'Invalid-file source correction missing'); rows.push({case: 'invalid-file-' + name, message: copy}); await fresh.getByRole('button', {name: 'Dismiss error', exact: true}).click(); }
    await fresh.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'), original = gl.uniform3f; let calls = 0; gl.uniform3f = function (...args) { if (++calls === 5) { gl.uniform3f = original; throw new Error('Injected camera draw refusal'); } return original.apply(this, args); }; });
    await open('combined.json'); await fresh.getByTestId('app-error').waitFor(); check((await fresh.getByTestId('app-error-details').textContent()).includes('Injected camera draw refusal'), 'Second GPU failure not observed'); check(await revision() === '11' && fresh.url() === route && await source.inputValue() === reedited && await pixels() === acceptedPixels, 'Combined Open compensation failed'); rows.push({case: 'combined-open-second-call-compensated', pixels: acceptedPixels});
    await fresh.getByRole('button', {name: 'Dismiss error', exact: true}).click();
    await fresh.evaluate(() => { window.__renderEditorLostExtension = document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__renderEditorLostExtension.loseContext(); });
    await fresh.locator('[data-testid="presented-revision"][data-revision="none"]').waitFor();
    check(await revision() === '11' && await source.inputValue() === reedited, 'Context loss changed authoring');
    check((await fresh.getByTestId('preview-notice').innerText()).includes('Restore the preview to continue.'), 'Unavailable preview guidance missing');
    check(await fresh.getByTestId('source-error-count').innerText() === '0', 'Context loss was counted as a source error');
    check(await fresh.getByRole('button', {name: 'Retry update', exact: true}).count() === 0 && await fresh.getByRole('button', {name: 'Dismiss preview notice', exact: true}).count() === 0, 'Unavailable state offered an irrelevant action or dismissal');
    await fresh.screenshot({path: config.output + '/unavailable-preview.png', fullPage: true});
    await fresh.evaluate(() => { window.__renderEditorLostExtension.restoreContext(); });
    await fresh.waitForFunction(() => !document.querySelector('canvas').getContext('webgl2').isContextLost());
    await fresh.getByRole('region', {name: 'Scene viewport', exact: true}).getByRole('button', {name: 'Restore preview', exact: true}).click();
    await fresh.locator('[data-testid="presented-revision"][data-revision="11"]').waitFor();
    check(await pixels() === acceptedPixels, 'Fresh renderer recovery changed accepted frame');
    check(await fresh.getByTestId('preview-notice').count() === 0 && await fresh.getByTestId('app-error').count() === 0 && await fresh.getByRole('button', {name: 'Restore preview', exact: true}).count() === 0, 'Successful recovery left an active failure or unnecessary Restore action');
    rows.push({case: 'context-loss-unavailable-and-explicit-recovery', pixels: acceptedPixels, unavailableAction: 'Restore preview', recoveredNoticeCleared: true});
    await fresh.getByTestId('project-assembly').click(); await fresh.getByTestId('document-title').filter({hasText: 'Ring assembly'}).waitFor(); check(await fresh.getByRole('region', {name: 'Scene objects', exact: true}).getByRole('listitem').count() === 3, 'Second real fixture inventory');
    await fresh.getByRole('button', {name: 'Primitive study', exact: true}).last().click(); await fresh.locator('[data-testid="accepted-revision"][data-revision="11"]').waitFor(); check(await source.inputValue() === reedited && await pixels() === acceptedPixels, 'Project route lost accepted edits'); rows.push({case: 'workspace-route-multiple-scene-retention'});
    // Simulate a slow native file read, then enter a real source draft before it completes.
    await fresh.evaluate(() => { const original = File.prototype.text; File.prototype.text = async function () { await new Promise(resolve => setTimeout(resolve, 250)); return original.call(this); }; });
    await open('saved.render-scene.json'); await source.fill(reedited + '\n/* New draft during file read. */'); await fresh.getByTestId('app-error').filter({hasText: 'changed while'}).waitFor(); check(await revision() === '11' && (await source.inputValue()).includes('New draft during'), 'Late file read discarded draft'); rows.push({case: 'late-native-read-retains-draft'});
    check(errors.length === 0, 'Fresh app page errors: ' + errors.join('; ')); await fresh.close(); return {rows, errors};
  }, {saved});
  receipt.stages.push(reopened);
  const second = JSON.parse(await readFile(resolve(output, 'reopened.render-scene.json')));
  assert.equal(second.sceneSource, reopened.rows[0].source); assert.deepEqual(second.camera, saved.camera); assert.equal(second.revision, 11);
  const moduleURL = new URL('/src/fixtures.ts', url);
  const first = await fetch(moduleURL), firstText = await first.text();
  const cachedModule = server ? await server.environments.client.moduleGraph.getModuleByUrl('/src/fixtures.ts') : null;
  const firstTransform = cachedModule?.transformResult;
  const again = await fetch(moduleURL), secondText = await again.text();
  assert.equal(first.status, 200); assert.equal(again.status, 200); assert.equal(firstText, secondText); assert.equal(first.headers.get('etag'), again.headers.get('etag'));
  if (server) { assert(firstTransform); assert.equal(cachedModule.transformResult, firstTransform, 'Unchanged requests repeated the module transform.'); }
  fixtureOriginal = await readFile(resolve(here, 'src/fixtures.ts'), 'utf8');
  await writeFile(resolve(here, 'src/fixtures.ts'), fixtureOriginal.replace("title: 'Primitive study'", "title: 'Primitive study · reload proof'"));
  const reload = await run(async (page) => { const config = __CONFIG__; await page.goto(config.url); await page.getByTestId('document-title').filter({hasText: 'reload proof'}).waitFor(); return {title: await page.getByTestId('document-title').innerText(), presented: await page.getByTestId('presented-revision').innerText()}; });
  if (server) assert.notEqual(cachedModule.transformResult, firstTransform, 'Actual source edit reused a stale transform.');
  await writeFile(resolve(here, 'src/fixtures.ts'), fixtureOriginal); fixtureOriginal = null;
  receipt.moduleRequests = {unchangedETag: first.headers.get('etag'), unchangedBytes: Buffer.byteLength(firstText), transformObjectReused: !!server, actualSourceEdit: reload, timingClaim: false};
  receipt.ok = true;
} catch (error) { receipt.firstFailure = error.stack ?? String(error); process.exitCode = 1; try { await call('snapshot'); await call('screenshot', '--filename=' + resolve(output, 'failure.png')); } catch { /* Preserve the original driver failure. */ } }
finally {
  if (fixtureOriginal !== undefined && fixtureOriginal !== null) await writeFile(resolve(here, 'src/fixtures.ts'), fixtureOriginal);
  try { await call('close'); } catch (error) { receipt.cleanupFailure = String(error); receipt.ok = false; process.exitCode = 1; }
  await server?.close();
  await writeFile(resultFile, JSON.stringify(receipt, null, 2) + '\n');
}
console.log(JSON.stringify(receipt, null, 2));
