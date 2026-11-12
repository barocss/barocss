import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
const baseline = process.argv.includes('--baseline');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output);
const fixture = 'apps/cad-studio/test/fixtures/linear-cut-pattern.bcad';
const file = resolve(repo, fixture), original = JSON.parse(await readFile(file, 'utf8'));
const pins = [fixture, 'apps/cad-studio/test/viewport-startup-fallback-browser.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/viewport/gpuRenderer.ts', 'apps/cad-studio/src/viewport/renderer.ts',
  'apps/cad-studio/src/viewport/viewportRecovery.ts', 'packages/barocss-gpu/src/viewer/viewer.ts'];
const f = await createFlow({
  name: 'viewport-startup-fallback', envFrozen: 'D786_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce failure after the WebGPU context has been configured'
    : 'Open, edit and save through WebGL2 after WebGPU fails on its configured canvas',
  limits: ['Test holds and rejects one real viewport GPU pipeline result after configure.',
    'Other browser operations and all native geometry run normally.',
    'Deliberate startup injection covers one Chrome desktop profile.'],
  snapshotExtra: () => ({
    startup: window.__viewportStartup?.events.slice() ?? [],
    backend: document.querySelector('.viewport')?.getAttribute('data-renderer'),
    viewportError: document.querySelector('.vp-error')?.textContent ?? null,
    dirty: !!document.querySelector('.doc-tab [aria-label="Unsaved changes"]'),
  }),
});

function observeStartup(inject) {
  const events = [], ids = new WeakMap();
  let nextId = 0, targetContext, targetDevice, pending, release;
  const id = value => {
    if (!ids.has(value)) ids.set(value, ++nextId);
    return ids.get(value);
  };
  const record = (kind, fields = {}) => events.push({ kind, ...fields });
  const key = 'barocss-d786-pipeline-rejected';
  const armed = inject && sessionStorage.getItem(key) === null;
  window.__viewportStartup = {
    events,
    reject() {
      if (!release) throw new Error('No viewport pipeline result is held.');
      sessionStorage.setItem(key, 'true');
      record('injected-pipeline-rejection');
      release(new Error('D786 deliberate viewport startup failure after configure'));
    },
  };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
    const result = getContext.call(this, kind, ...args);
    if (this.classList.contains('vp-canvas')) {
      record('canvas-context', { canvas: id(this), backend: kind, acquired: !!result });
      if (kind === 'webgpu' && result) targetContext = result;
    }
    return result;
  };
  if (!armed) return;

  const configure = GPUCanvasContext.prototype.configure;
  GPUCanvasContext.prototype.configure = function (options) {
    const result = configure.call(this, options);
    if (this === targetContext) {
      targetDevice = options.device;
      record('native-webgpu-configured', { canvas: id(this.canvas) });
      targetDevice.lost.then(info => record('native-device-released', { reason: info.reason }));
    }
    return result;
  };
  const unconfigure = GPUCanvasContext.prototype.unconfigure;
  GPUCanvasContext.prototype.unconfigure = function () {
    const result = unconfigure.call(this);
    if (this === targetContext) record('native-webgpu-unconfigured', { canvas: id(this.canvas) });
    return result;
  };
  const createPipeline = GPUDevice.prototype.createRenderPipelineAsync;
  GPUDevice.prototype.createRenderPipelineAsync = function (options) {
    const result = createPipeline.call(this, options);
    if (this !== targetDevice || pending) return result;
    pending = true;
    return result.then(() => {
      record('native-pipeline-acquired-return-held', { label: options.label });
      return new Promise((_resolve, reject) => { release = reject; });
    });
  };
}

async function openPage({ inject = false, search = '' } = {}) {
  if (f.context) { await f.context.close(); f.report.cleanup.push('CONTEXT_CLOSED'); }
  f.context = await f.browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = f.page = await f.context.newPage(), origin = new URL(f.server.resolvedUrls.local[0]).origin;
  await f.context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
    return url.origin === origin ? route.continue() : route.abort();
  });
  await page.addInitScript(observeStartup, inject);
  page.on('pageerror', error => f.report.errors.push(error.stack ?? String(error)));
  page.on('console', message => { if (message.type() === 'error') f.report.consoleErrors.push(message.text()); });
  page.on('download', item => f.report.downloads.push({ phase: f.phase, name: item.suggestedFilename() }));
  await page.goto(f.server.resolvedUrls.local[0] + search);
}

const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D786 startup fallback ' + randomUUID();
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}

async function checkModel(doc, volume) {
  await f.same(doc);
  const state = await f.bodies();
  assert.equal(state.bodies.length, 1);
  assert.equal(state.bodies[0].key, 'b5');
  assert.ok(Math.abs(state.bodies[0].volume - volume) < 1e-8);
}

await f.run(async () => {
  f.phase = 'hold the real first viewport pipeline after WebGPU configuration';
  await openPage({ inject: true });
  await f.page.waitForFunction(() => window.__viewportStartup?.events.some(event => event.kind === 'native-pipeline-acquired-return-held'));
  assert.equal(await f.page.locator('.viewport').getAttribute('data-renderer'), null);
  await f.openFile(file, 6);
  await checkModel(original, 17840);
  const held = await f.snapshot('01-document-open-with-gpu-startup-held');
  const configured = held.startup.find(event => event.kind === 'native-webgpu-configured');
  assert.ok(configured);
  assert.equal(held.dirty, false);

  f.phase = 'release the injected failure and observe actual WebGL2 startup';
  await f.page.evaluate(() => window.__viewportStartup.reject());
  await f.page.waitForFunction(() => window.__viewportStartup.events.some(event => event.kind === 'native-device-released'));
  if (baseline) {
    await f.page.locator('.vp-error').filter({ hasText: 'Error: WebGL2 is not available in this browser.' }).waitFor();
    await checkModel(original, 17840);
    const failed = await f.snapshot('02-baseline-fallback-unavailable');
    assert.equal(failed.backend, null);
    assert.ok(failed.startup.some(event => event.kind === 'native-webgpu-unconfigured' && event.canvas === configured.canvas));
    assert.ok(failed.startup.some(event => event.kind === 'canvas-context' && event.backend === 'webgl2'
      && event.canvas === configured.canvas && !event.acquired));
    f.report.observations.push({ actualProductFailure: 'WebGL2 fallback tried the WebGPU canvas and failed.', documentRetained: true });
    return;
  }

  await f.page.waitForSelector('.viewport[data-renderer="webgl2"]');
  await checkModel(original, 17840);
  const fallback = await f.snapshot('02-webgl2-current-document');
  assert.equal(fallback.viewportError, null);
  assert.equal(fallback.dirty, false);
  const webgl = fallback.startup.find(event => event.kind === 'canvas-context' && event.backend === 'webgl2' && event.acquired);
  assert.ok(webgl && webgl.canvas !== configured.canvas);
  assert.equal(fallback.startup.filter(event => event.kind === 'canvas-context' && event.backend === 'webgl2').length, 1);
  assert.equal(await f.page.locator('canvas.vp-canvas').count(), 1);
  assert.ok(fallback.startup.some(event => event.kind === 'native-webgpu-unconfigured' && event.canvas === configured.canvas));

  f.phase = 'edit and pick the document through WebGL2';
  await f.openFeatureEditor(3, 'source Cut tool');
  const field = f.editor().getByRole('spinbutton', { name: 'Width', exact: true });
  assert.equal(await field.inputValue(), '4');
  await field.fill('6');
  await button(f.editor(), 'Apply').click();
  const edited = structuredClone(original);
  edited.nodes[2].max[0] = 6;
  delete edited.nodes[3].made;
  await checkModel(edited, 17760);
  await f.closeEditor();
  await f.page.locator('.views').getByRole('button', { name: 'Top', exact: true }).click();
  await f.page.keyboard.press('f');
  const filter = f.page.getByRole('button', { name: 'Selection filter', exact: true });
  for (let attempt = 0; attempt < 4 && !(await filter.innerText()).includes('Faces'); attempt++) await filter.click();
  assert.ok((await filter.innerText()).includes('Faces'));
  const xy = await f.page.evaluate(() => window.__studioScreenOf([30, 15, 10]));
  assert.ok(xy?.length === 2 && xy.every(Number.isFinite));
  await f.page.mouse.click(...xy);
  await f.page.waitForFunction(() => window.__studioSelection?.selection.faces.length === 1);
  const pick = await f.snapshot('03-webgl2-edit-and-pick');
  assert.equal(pick.dirty, true);
  assert.equal(pick.selection.selection.faces[0].body, 0);

  f.phase = 'save through WebGL2 and reopen with healthy WebGPU';
  await openProject();
  assert.equal(await f.page.locator('.doc-tab input').inputValue(), 'linear-cut-pattern');
  await button(f.page, 'Save').click();
  const path = 'linear-cut-pattern.bcad';
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(path, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, path]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(path)).getFile()).arrayBuffer()));
  }, [project, path]));
  assert.deepEqual(JSON.parse(bytes), edited);
  await writeFile(join(output, 'fallback-project-save.bcad'), bytes);
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await openProject();
  await button(versions(), 'Open ' + path).click();
  await checkModel(edited, 17760);
  const reopened = await f.snapshot('04-reopened-with-healthy-webgpu');
  assert.equal(reopened.dirty, false);
  assert.equal(reopened.viewportError, null);

  f.phase = 'keep the explicit WebGL2 option independent of WebGPU';
  await openPage({ search: '?renderer=webgl2' });
  await f.page.waitForSelector('.viewport[data-renderer="webgl2"]');
  await f.openFile(file, 6);
  await checkModel(original, 17840);
  const forced = await f.snapshot('05-forced-webgl2');
  assert.deepEqual(forced.startup.filter(event => event.kind === 'canvas-context').map(event => [event.backend, event.acquired]),
    [['webgl2', true]]);
  f.report.observations.push({ initialVolumeMm3: 17840, editedVolumeMm3: 17760, saveBytes: bytes.length, saveSHA256: sha256(bytes),
    failedCanvas: configured.canvas, fallbackCanvas: webgl.canvas });
  assert.deepEqual(f.report.downloads, []);
});
