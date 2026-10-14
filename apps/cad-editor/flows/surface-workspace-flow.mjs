import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn, execFileSync} from 'node:child_process';
import {register} from 'node:module';
import {build} from 'esbuild';

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const repo = resolve(import.meta.dirname, '../../..');
const evidence = resolve(option('--evidence', '/Users/user/.barocss-ai/v3/evidence-cad-editor-surface-workspace'));
mkdirSync(evidence, {recursive: true});
const compiled = args.includes('--compiled'), mode = compiled ? 'compiled' : 'source';
const port = Number(option('--port', compiled ? '52037' : '52036'));
const attempt = readdirSync(evidence).filter(name => new RegExp('^' + mode + '-attempt-\\d+\\.json$').test(name)).length + 1;
const prefix = mode + '-attempt-' + String(attempt).padStart(3, '0');
const git = (...values) => execFileSync('git', values, {cwd: repo, encoding: 'utf8'}).trim();
const hash = value => createHash('sha256').update(value).digest('hex');
const result = {head: git('rev-parse', 'HEAD'), workingTree: git('status', '--porcelain'), mode,
  node: process.version, browserMode: args.includes('--headed') ? 'headed' : 'headless', events: [], pageErrors: [], outcome: 'running'};
const save = () => writeFileSync(resolve(evidence, prefix + '.json'), JSON.stringify(result, null, 2) + '\n');
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
let server, serverExited = false, browser, context, freshContext, activePage, mouseHeld = false;

try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  assert.equal(result.workingTree, '', 'Acceptance requires one clean exact owned child.');
  save();
  let cad, runtimeMapPath;
  if (compiled) {
    const {prepareCompiledCheckpoint} = await import('./compiled-checkpoint.mjs');
    result.compiledCheckpoint = await prepareCompiledCheckpoint({repo, evidence});
    runtimeMapPath = result.compiledCheckpoint.runtimeMapPath;
    register(pathToFileURL(result.compiledCheckpoint.loaderPath));
    cad = await import(pathToFileURL(result.compiledCheckpoint.nativeCadPath));
    await import(pathToFileURL(result.compiledCheckpoint.editorRootPath));
  } else {
    const output = resolve(evidence, prefix + '-native.mjs');
    await build({stdin: {contents: 'export * from ' + JSON.stringify(resolve(repo, 'packages/barocss-cad/src/index.ts')) + ';', resolveDir: repo},
      bundle: true, platform: 'node', format: 'esm', target: 'es2022', outfile: output});
    cad = await import(pathToFileURL(output));
  }
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof globalThis.document, 'undefined');
  const sample = cad.parseCadDocument(readFileSync(resolve(repo, 'apps/cad-editor/fixtures/canonical-surface-and-curve.cad-document.json'), 'utf8'));
  const mixedPath = resolve(repo, 'apps/cad-editor/fixtures/source-preserving-surface.cad-document.json');
  void (cad.parseCadDocument(readFileSync(mixedPath, 'utf8')));
  const nativeSurface = graph => cad.resolveCadGeometryReference(graph,
    cad.createCadGeometryReference(graph, {bodyId: 'surface_body'}).reference).geometry;
  // Independent rational quadratic tensor control for these original clamped 3-by-3 fixtures.
  function surfacePoint(surface, u, v) {
    const basis = t => [(1 - t) ** 2, 2 * t * (1 - t), t ** 2];
    const bu = basis(u), bv = basis(v), point = [0, 0, 0]; let denominator = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const weight = bu[i] * bv[j] * surface.weights[i][j]; denominator += weight;
      for (let axis = 0; axis < 3; axis++) point[axis] += weight * surface.controlPoints[i][j][axis];
    }
    return point.map(value => value / denominator);
  }
  function assertEdit(before, after, u, v, point) {
    const previous = nativeSurface(before.accepted), actual = nativeSurface(after.accepted);
    assert.deepEqual(actual.controlPoints[u][v], point);
    assert.deepEqual(actual.weights, previous.weights);
    assert.equal(actual.weights[1][1], 1.5);
    assert.deepEqual(actual.knotsU, previous.knotsU); assert.deepEqual(actual.knotsV, previous.knotsV);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== u || j !== v)
      assert.deepEqual(actual.controlPoints[i][j], previous.controlPoints[i][j]);
    assert.ok(Object.is(actual.controlPoints[0][0][1], -0));
    const reference = cad.createCadGeometryReference(before.accepted, {bodyId: 'surface_body'}).reference;
    const resolved = cad.resolveCadGeometryReference(before.accepted, reference);
    const expected = cad.editSourceSurfaceControlNet({source: resolved.source, sourceVersion: 0, surfaceId: resolved.geometry.id,
      edits: {poleEdits: [{uIndex: u, vIndex: v, xMM: point[0], yMM: point[1], zMM: point[2]}]}});
    cad.validateSourceSurfaceControlNetEdit(expected);
    const assetId = reference.assetId;
    assert.equal(after.accepted.document.assets.find(asset => asset.id === assetId).source, expected.source);
    assert.deepEqual(after.lastProvenance, expected.edit.provenance);
    for (const asset of before.accepted.document.assets.filter(asset => asset.id !== assetId))
      assert.deepEqual(after.accepted.document.assets.find(value => value.id === asset.id), asset);
    const oldModel = before.accepted.compiledAssets.find(asset => asset.assetId === assetId).model;
    const newModel = after.accepted.compiledAssets.find(asset => asset.assetId === assetId).model;
    assert.equal(newModel.name, oldModel.name);
    for (let index = 0; index < oldModel.objects.length; index++) if (oldModel.objects[index].id !== actual.id)
      assert.deepEqual(newModel.objects[index], oldModel.objects[index]);
    assert.equal(after.accepted.document.revision, before.accepted.document.revision + 1);
    assert.equal(after.accepted.document.assets.find(asset => asset.id === assetId).revision,
      before.accepted.document.assets.find(asset => asset.id === assetId).revision + 1);
    assert.equal(after.selection.reference.documentRevision, after.accepted.document.revision);
    const nativePoint = cad.evaluateSurface(actual, .37, .61), independent = surfacePoint(actual, .37, .61);
    nativePoint.forEach((value, index) => close(value, independent[index]));
    return {pointMM: point, weight: actual.weights[u][v], nativePointMM: nativePoint,
      sourceSHA256: hash(expected.source), sourceModelObjects: newModel.objects.length, originalSignedZeroRetained: true};
  }

  const {chromium} = await import(option('--playwright', '/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
  const executablePath = option('--browser', '/Users/user/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  assert.ok(existsSync(executablePath));
  server = spawn(process.execPath, [resolve(repo, 'node_modules/vite/bin/vite.js'), '--force', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {cwd: resolve(repo, 'apps/cad-editor'), env: {...process.env, ...(compiled ? {CAD_EDITOR_COMPILED_MAP: runtimeMapPath} : {})}, stdio: ['ignore', 'pipe', 'pipe']});
  let log = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', bytes => { log += bytes; writeFileSync(resolve(evidence, prefix + '-server.log'), log); });
  server.on('exit', () => { serverExited = true; });
  for (let index = 0; index < 100; index++) {
    if (serverExited) throw new Error('Owned Vite exited before readiness.');
    try { if ((await fetch('http://127.0.0.1:' + port)).ok) break; } catch { /* Retry readiness after the existing ignored connection failure. */ }
    if (index === 99) throw new Error('Owned Vite readiness timeout.');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({executablePath, headless: !args.includes('--headed'), args: ['--enable-unsafe-webgpu']});
  context = await browser.newContext({viewport: {width: 1440, height: 960}, deviceScaleFactor: 1, acceptDownloads: true});
  const setup = async page => {
    page.setDefaultTimeout(30000); page.on('pageerror', error => result.pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:' + port + '/?flow#/documents/cad_editor_fixture');
    await page.waitForFunction(() => window.__cadEditorFlow?.display()?.state.status === 'ready');
    await page.evaluate(() => document.addEventListener('pointerdown', event => {
      if (event.target?.getAttribute?.('data-testid')?.startsWith('surface-pole-handle-')) window.__surfaceFlowPointerId = event.pointerId;
    }, true));
  };
  const snapshot = page => page.evaluate(() => window.__cadEditorFlow.snapshot());
  const frame = page => page.evaluate(() => window.__cadEditorFlow.display());
  async function ready(page, generation) {
    await page.waitForFunction(generation => {
      const s = window.__cadEditorFlow.snapshot(), f = window.__cadEditorFlow.display();
      return s.generation === generation && s.view.kind === 'document' && !s.candidate && f?.state.status === 'ready'
        && f.state.document?.document.revision === s.accepted.document.revision
        && f.state.documentBodies.length === s.displayBodyIds.length;
    }, generation);
    assert.deepEqual((await frame(page)).state.document, (await snapshot(page)).accepted);
  }
  async function read(page) {
    const old = await frame(page); await page.evaluate(() => window.__cadEditorFlow.readFrame());
    await page.waitForFunction(index => window.__cadEditorFlow.display()?.readIndex > index, old.readIndex);
    return frame(page);
  }
  async function selectSurface(page, u = 1, v = 1) {
    await page.getByTestId('body-select-surface_body').click();
    await page.waitForFunction(() => window.__cadEditorFlow.snapshot().selection?.bodyId === 'surface_body');
    await page.getByTestId('cad-editor-u').selectOption(String(u));
    await page.getByTestId('cad-editor-v').selectOption(String(v));
    await page.getByTestId(`surface-pole-handle-${u}-${v}`).waitFor();
  }
  async function preset(page, name) {
    const before = await snapshot(page), previous = await read(page);
    await page.getByTestId('view-' + name).click();
    await page.waitForFunction(index => window.__cadEditorFlow.display()?.readIndex > index, previous.readIndex);
    const actual = await frame(page), camera = actual.state.camera, oldCamera = previous.state.camera;
    assert.deepEqual(await snapshot(page), before); assert.deepEqual(camera.target, oldCamera.target);
    for (const key of ['near', 'far', 'fovYDegrees']) assert.equal(camera[key], oldCamera[key]);
    const direction = camera.eye.map((value, index) => value - camera.target[index]);
    const distance = Math.hypot(...direction);
    close(distance, Math.hypot(...oldCamera.eye.map((value, index) => value - oldCamera.target[index])));
    const expected = {front: [0, 0, 1], right: [1, 0, 0], top: [0, 1, 0], isometric: [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)]}[name];
    direction.forEach((value, index) => close(value / distance, expected[index]));
    assert.deepEqual(camera.up, name === 'top' ? [0, 0, -1] : [0, 1, 0]);
    assert.equal(await page.getByTestId('view-' + name).getAttribute('aria-pressed'), 'true');
    assert.ok((await page.getByTestId('viewport-view-status').innerText()).toLowerCase().includes(name));
    assert.ok(actual.nonBackgroundPixels > 0);
    return {name, camera, pixelHash: actual.pixelHash, nonBackgroundPixels: actual.nonBackgroundPixels};
  }
  async function beginDrag(page, u, v, dx, dy) {
    const handle = page.getByTestId(`surface-pole-handle-${u}-${v}`), box = await handle.boundingBox();
    assert.ok(box, 'The original Surface handle must be visible.');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); mouseHeld = true;
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, {steps: 5});
    await page.waitForFunction(() => Object.keys(window.__cadEditorFlow.snapshot().pending).length === 3);
    assert.ok((await page.getByTestId('surface-drag-status').innerText()).includes('Release to apply'));
    return snapshot(page);
  }
  async function release(page) { await page.mouse.up(); mouseHeld = false; }
  async function cancelPointer(page) {
    await page.evaluate(() => {
      const pointerId = window.__surfaceFlowPointerId;
      const handle = [...document.querySelectorAll('[data-testid^="surface-pole-handle-"]')].find(node => node.hasPointerCapture(pointerId));
      if (!handle) throw new Error('No actual Surface pointer capture exists.');
      handle.dispatchEvent(new PointerEvent('pointercancel', {pointerId, isPrimary: true, bubbles: true}));
    });
    await release(page);
  }
  async function open(page, path) {
    const old = await snapshot(page), graph = cad.parseCadDocument(readFileSync(path, 'utf8'));
    await page.getByLabel('Open native document file').setInputFiles(path);
    if (graph.document.bodies.length > 4 || graph.compiledAssets.some(asset => asset.model.objects.some(object => object.kind === 'curve' && object.degree > 3))) {
      await page.getByTestId('open-display-choice').waitFor();
      for (const id of ['surface_body', 'curve_body']) await page.getByTestId('open-body-' + id).check();
      await page.getByTestId('open-view-mode').selectOption('document');
      await page.getByTestId('open-display-confirm').click();
    }
    if (old.dirty || await page.evaluate(() => window.__cadEditorFlow.recovery().unsaved)) {
      await page.getByTestId('replacement-dialog').waitFor(); await page.getByTestId('replacement-continue').click();
    }
    await ready(page, old.generation + 1);
    assert.deepEqual((await snapshot(page)).accepted.document, graph.document);
  }
  const page = await context.newPage(); activePage = page; await setup(page);
  assert.deepEqual((await snapshot(page)).accepted.document, sample.document);
  await selectSurface(page); const views = [];
  for (const name of ['front', 'right', 'top', 'isometric']) views.push(await preset(page, name));
  await page.screenshot({path: resolve(evidence, prefix + '-ordinary-workspace.png')});
  result.events.push({stage: 'actual-original-Surface-workspace-camera-presets', views, noNativeHistoryOrDirtyChange: true}); save();

  await open(page, mixedPath); await selectSurface(page); await preset(page, 'front');
  let before = await snapshot(page), previousFrame = await read(page);
  const staged = await beginDrag(page, 1, 1, 42, -18);
  assert.deepEqual(staged.accepted, before.accepted); assert.deepEqual(staged.history, before.history);
  assert.equal(staged.generation, before.generation); assert.equal(staged.candidate, null);
  assert.equal((await read(page)).pixelHash, previousFrame.pixelHash);
  for (const name of ['front', 'right', 'top', 'isometric']) assert.ok(await page.getByTestId('view-' + name).isDisabled());
  const target = ['xMM', 'yMM', 'zMM'].map(field => Number(staged.pending[field]));
  await release(page); await ready(page, before.generation + 1);
  let after = await snapshot(page); assert.equal(after.history.count, before.history.count + 1); assert.deepEqual(after.pending, {});
  const drag = assertEdit(before, after, 1, 1, target);
  assert.notEqual((await read(page)).pixelHash, previousFrame.pixelHash);
  await page.screenshot({path: resolve(evidence, prefix + '-drag-accepted.png')});
  let generation = after.generation;
  await page.getByRole('button', {name: 'Undo', exact: true}).click(); await ready(page, generation + 1);
  assert.deepEqual(nativeSurface((await snapshot(page)).accepted), nativeSurface(before.accepted));
  generation = (await snapshot(page)).generation;
  await page.getByRole('button', {name: 'Redo', exact: true}).click(); await ready(page, generation + 1);
  assert.deepEqual(nativeSurface((await snapshot(page)).accepted).controlPoints[1][1], target);
  result.events.push({stage: 'real-Surface-pointer-ghost-release-full-source-and-one-UndoRedo', drag,
    mixedSourceObjects: 3, rawGhostOnlyUntilRelease: true, acceptedRGBAChanged: true, noScreenshotWhilePointerHeld: true}); save();

  await selectSurface(page, 0, 0); before = await snapshot(page); previousFrame = await read(page);
  await beginDrag(page, 1, 1, 20, 12); await page.keyboard.press('Escape'); await release(page);
  await page.waitForFunction(() => Object.keys(window.__cadEditorFlow.snapshot().pending).length === 0);
  assert.deepEqual(await snapshot(page), before); assert.equal((await read(page)).pixelHash, previousFrame.pixelHash);
  await beginDrag(page, 1, 0, -19, 13); await cancelPointer(page);
  assert.deepEqual(await snapshot(page), before); assert.equal((await read(page)).pixelHash, previousFrame.pixelHash);
  await page.getByTestId('surface-pole-handle-0-0').focus(); await page.keyboard.press('Space');
  assert.equal((await snapshot(page)).selection.uIndex, 0); assert.equal((await snapshot(page)).selection.vIndex, 0);
  await page.getByTestId('cad-editor-zMM').fill('invalid'); await page.keyboard.press('Tab');
  const invalidRaw = await snapshot(page); assert.deepEqual(invalidRaw.accepted, before.accepted);
  await page.getByTestId('cad-editor-help').click(); await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'cad-editor-help');
  assert.deepEqual(await snapshot(page), invalidRaw);
  await page.getByTestId('cad-editor-apply').click();
  await page.waitForFunction(() => window.__cadEditorFlow.error()?.code === 'INPUT');
  assert.deepEqual(await snapshot(page), invalidRaw); assert.equal((await read(page)).pixelHash, previousFrame.pixelHash);
  await page.getByTestId('cad-editor-discard').click();
  await page.getByTestId('cad-editor-weight').fill('0'); const invalidWeight = await snapshot(page);
  await page.getByTestId('cad-editor-apply').click();
  await page.waitForFunction(() => window.__cadEditorFlow.error()?.code === 'NATIVE');
  const nativeError = await page.evaluate(() => window.__cadEditorFlow.error());
  assert.ok(nativeError.causeChain.some(cause => /weight/i.test(cause.message)));
  assert.deepEqual(await snapshot(page), invalidWeight); assert.equal((await read(page)).pixelHash, previousFrame.pixelHash);
  await page.screenshot({path: resolve(evidence, prefix + '-native-weight-refusal.png')});
  await page.getByTestId('cad-editor-discard').click();
  before = await snapshot(page); previousFrame = await read(page);
  await page.evaluate(() => window.__cadEditorFlow.setDisplayRefusal(true));
  await page.waitForFunction(() => window.__cadEditorFlow.error()?.message.includes('Display options were refused'));
  await page.getByTestId('cad-editor-zMM').fill('1'); const displayDraft = await snapshot(page);
  await page.getByTestId('cad-editor-apply').click();
  await page.waitForFunction(() => !window.__cadEditorFlow.snapshot().candidate && window.__cadEditorFlow.error()?.code === 'DISPLAY');
  assert.deepEqual(await snapshot(page), displayDraft); assert.equal((await read(page)).pixelHash, previousFrame.pixelHash);
  assert.deepEqual((await frame(page)).state.camera, previousFrame.state.camera);
  const displayError = await page.evaluate(() => window.__cadEditorFlow.error());
  await page.evaluate(() => window.__cadEditorFlow.setDisplayRefusal(false));
  await page.getByTestId('cad-editor-discard').click(); await read(page);
  result.events.push({stage: 'Surface-gesture-cancel-native-input-and-real-display-refusals', EscapeAndDOMPointercancelRestoreUV: true,
    actualNativeError: nativeError, actualCountU1DisplayError: displayError, rawAndNativeFrameRetained: true, HelpKeyboardFocus: true}); save();

  before = await snapshot(page);
  await page.getByTestId('body-visible-surface_body').uncheck();
  await page.waitForFunction(generation => window.__cadEditorFlow.snapshot().displayGeneration > generation && !window.__cadEditorFlow.snapshot().candidate, before.displayGeneration);
  assert.equal(await page.getByTestId('surface-control-overlay').count(), 0);
  assert.deepEqual((await snapshot(page)).accepted, before.accepted);
  await page.getByTestId('body-visible-surface_body').check(); await page.getByTestId('surface-control-overlay').waitFor();
  await page.getByTestId('body-select-curve_body').click(); const beforeFocus = await snapshot(page);
  await page.getByTestId('curve-focus').click();
  await page.waitForFunction(() => window.__cadEditorFlow.snapshot().view.kind === 'curve-focus' && !window.__cadEditorFlow.snapshot().candidate && window.__cadEditorFlow.curveDisplay()?.state.status === 'ready');
  assert.equal(await page.getByTestId('surface-control-overlay').count(), 0);
  assert.deepEqual((await snapshot(page)).accepted, beforeFocus.accepted); assert.deepEqual((await snapshot(page)).history, beforeFocus.history);
  await page.getByTestId('curve-return-document').click(); await ready(page, beforeFocus.generation);
  await selectSurface(page); await preset(page, 'front');
  await page.setViewportSize({width: 1000, height: 700}); await read(page);
  async function inside(locator, label) {
    await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1000 && box.y + box.height <= 700,
      label + ' must remain inside the supported compact workspace.');
  }
  await inside(page.getByTestId('cad-editor-zMM'), 'Coordinate input');
  await inside(page.getByTestId('cad-editor-apply'), 'Apply');
  await inside(page.getByTestId('cad-editor-discard'), 'Discard');
  await inside(page.getByTestId('document-open'), 'Open');
  await inside(page.getByRole('button', {name: 'Download', exact: true}), 'Download');
  await inside(page.getByRole('menuitem', {name: 'File', exact: true}), 'File');
  await inside(page.getByTestId('app-unsaved-state'), 'Accepted unsaved status');
  await inside(page.getByTestId('app-draft-state'), 'Draft status');
  await inside(page.getByTestId('view-front'), 'Front view');
  await page.screenshot({path: resolve(evidence, prefix + '-compact-workspace.png')});
  await page.setViewportSize({width: 1440, height: 960}); await read(page);
  result.events.push({stage: 'hidden-focus-exclusion-and-compact-modeling-workspace', SurfaceHandlesRequireVisibleDocumentSurface: true,
    originalFullSourceRetainedThroughFocus: true, minimumWorkspace: [1000, 700], broaderDeviceCoverageNotClaimed: true}); save();

  const savedSnapshot = await snapshot(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name: 'Download', exact: true}).click()]);
  const nativePath = resolve(evidence, prefix + '-' + download.suggestedFilename()); await download.saveAs(nativePath);
  const saved = cad.parseCadDocument(readFileSync(nativePath, 'utf8')); assert.deepEqual(saved.document, savedSnapshot.accepted.document);
  freshContext = await browser.newContext({viewport: {width: 1440, height: 960}, deviceScaleFactor: 1, acceptDownloads: true});
  const fresh = await freshContext.newPage(); activePage = fresh; await setup(fresh); await open(fresh, nativePath);
  await selectSurface(fresh); await preset(fresh, 'front'); before = await snapshot(fresh);
  const freshStaged = await beginDrag(fresh, 1, 1, -23, 14);
  const freshPoint = ['xMM', 'yMM', 'zMM'].map(field => Number(freshStaged.pending[field]));
  await release(fresh); await ready(fresh, before.generation + 1); after = await snapshot(fresh);
  const reedit = assertEdit(before, after, 1, 1, freshPoint);
  assert.equal(after.history.count, before.history.count + 1);
  await fresh.screenshot({path: resolve(evidence, prefix + '-fresh-file-Surface-reedit.png')});
  await fresh.getByTestId('cad-editor-zMM').fill('99'); const pendingCopy = await snapshot(fresh);
  await fresh.getByRole('menuitem', {name: 'File', exact: true}).click(); await fresh.getByRole('menuitem', {name: 'Recovery copies…', exact: true}).click();
  await fresh.waitForFunction(() => window.__cadEditorFlow.recovery().status === 'empty');
  await fresh.getByTestId('recovery-save').click();
  await fresh.waitForFunction(() => window.__cadEditorFlow.recovery().slot?.record?.hadPending === true);
  const stored = await fresh.evaluate(() => window.__cadEditorFlow.recovery().slot);
  assert.equal(stored.record.schema, 'barocss-cad-editor-accepted-recovery'); assert.equal(stored.record.version, 1);
  assert.deepEqual(cad.parseCadDocument(stored.record.text).document, pendingCopy.accepted.document);
  assert.deepEqual(stored.record.displayBodyIds, pendingCopy.displayBodyIds); assert.equal(stored.record.wasDirty, true);
  assert.deepEqual(await snapshot(fresh), pendingCopy);
  assert.deepEqual(Object.keys(stored.record).sort(), ['schema', 'version', 'text', 'filename', 'displayBodyIds', 'wasDirty', 'hadPending', 'savedAtUTC'].sort());
  await fresh.getByTestId('recovery-cancel').click(); await fresh.getByTestId('cad-editor-discard').click();
  await fresh.getByTestId('surface-control-overlay').waitFor();
  result.events.push({stage: 'genuine-native-file-fresh-Surface-reedit-and-manual-accepted-recovery', nativePath,
    nativeFileSHA256: hash(readFileSync(nativePath)), reedit, recoveryRawSHA256: hash(stored.raw), acceptedCopyExcludedDraft: true,
    recoverySnapshotUnchanged: true, noNewDurabilityOrCurveAuthoringClaim: true});
  assert.deepEqual(result.pageErrors, []); result.outcome = 'passed'; save();
  console.log(JSON.stringify({mode, head: result.head, outcome: result.outcome, stages: result.events.map(event => event.stage), evidence: resolve(evidence, prefix + '.json')}));
} catch (error) {
  if (activePage) try {
    result.failureWindow = await activePage.evaluate(() => ({error: window.__cadEditorFlow?.error(), snapshot: window.__cadEditorFlow?.snapshot(), display: window.__cadEditorFlow?.display()}));
    if (mouseHeld) {
      await activePage.evaluate(() => {
        const pointerId = window.__surfaceFlowPointerId;
        const handle = [...document.querySelectorAll('[data-testid^="surface-pole-handle-"]')].find(node => node.hasPointerCapture(pointerId));
        handle?.dispatchEvent(new PointerEvent('pointercancel', {pointerId, isPrimary: true, bubbles: true}));
      });
      await activePage.mouse.up(); mouseHeld = false;
    }
    await activePage.screenshot({path: resolve(evidence, prefix + '-failure.png')});
  } catch { /* Preserve the original failure if collecting diagnostics also fails. */ }
  result.outcome = 'failed'; result.failure = {message: error.message, stack: error.stack}; save();
  console.error(error.stack); process.exitCode = 1;
} finally {
  await freshContext?.close(); await context?.close(); await browser?.close();
  if (server && !serverExited) { server.kill('SIGTERM'); await new Promise(resolve => { server.once('exit', resolve); setTimeout(resolve, 2000); }); }
}
