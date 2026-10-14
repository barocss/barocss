import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn, execFileSync} from 'node:child_process';
import {register} from 'node:module';
import {build} from 'esbuild';

const args = process.argv.slice(2), option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const repo = resolve(import.meta.dirname, '../../..');
const evidence = resolve(option('--evidence', '/Users/user/.barocss-ai/v3/evidence-cad-editor-axis-snap'));
mkdirSync(evidence, {recursive: true});
const compiled = args.includes('--compiled'), mode = compiled ? 'compiled' : 'source';
const port = Number(option('--port', compiled ? '52039' : '52038'));
const attempt = readdirSync(evidence).filter(name => new RegExp('^' + mode + '-attempt-\\d+\\.json$').test(name)).length + 1;
const prefix = mode + '-attempt-' + String(attempt).padStart(3, '0');
const git = (...values) => execFileSync('git', values, {cwd: repo, encoding: 'utf8'}).trim();
const hash = value => createHash('sha256').update(value).digest('hex');
const result = {head: git('rev-parse', 'HEAD'), workingTree: git('status', '--porcelain'), mode, node: process.version,
  browserMode: args.includes('--headed') ? 'headed' : 'headless', events: [], pageErrors: [], outcome: 'running'};
const save = () => writeFileSync(resolve(evidence, prefix + '.json'), JSON.stringify(result, null, 2) + '\n');
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const names = ['x', 'y', 'z'], fields = ['xMM', 'yMM', 'zMM'];
let server, serverExited = false, browser, context, freshContext, activePage, mouseHeld = false;

try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  assert.equal(result.workingTree, '', 'Acceptance requires one clean exact child.'); save();
  const helperPath = resolve(repo, 'packages/barocss-cad-editor/src/react/pole-axis-projection.ts');
  const helperOutput = resolve(evidence, prefix + '-axis-math.mjs');
  let cad, gpu, math, runtimeMapPath;
  if (compiled) {
    const {prepareCompiledCheckpoint} = await import('./compiled-checkpoint.mjs');
    result.compiledCheckpoint = await prepareCompiledCheckpoint({repo, evidence});
    runtimeMapPath = result.compiledCheckpoint.runtimeMapPath;
    register(pathToFileURL(result.compiledCheckpoint.loaderPath));
    cad = await import(pathToFileURL(result.compiledCheckpoint.nativeCadPath));
    gpu = await import('@barocss/gpu');
    await build({entryPoints: [helperPath], bundle: true, platform: 'node', format: 'esm', target: 'es2022', external: ['@barocss/*'], outfile: helperOutput});
    math = await import(pathToFileURL(helperOutput));
  } else {
    await build({stdin: {contents: 'export * from ' + JSON.stringify(resolve(repo, 'packages/barocss-cad/src/index.ts')) + ';'
      + 'export {prepareCamera} from ' + JSON.stringify(resolve(repo, 'packages/barocss-gpu/src/index.ts')) + ';'
      + 'export * from ' + JSON.stringify(helperPath) + ';', resolveDir: repo}, bundle: true, platform: 'node', format: 'esm', target: 'es2022', outfile: helperOutput});
    cad = gpu = math = await import(pathToFileURL(helperOutput));
  }
  result.mathCompilation = {source: helperPath, sourceSHA256: hash(readFileSync(helperPath)), outputSHA256: hash(readFileSync(helperOutput)),
    publicCompiledGPU: compiled, internalOwnedHelperCompiledExplicitly: true, noSourceRuntimeFallback: true};
  assert.equal(typeof globalThis.window, 'undefined'); assert.equal(typeof globalThis.document, 'undefined');
  const camera = {eye: [3, 4, 5], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100};
  const size = {cssWidth: 560, cssHeight: 640, pixelWidth: 1120, pixelHeight: 1280}, scale = .01;
  // Independent general matrix forward projection through the actual public camera.
  function screen(point, cameraInput, mmScale, dimensions) {
    const {view, projection} = gpu.prepareCamera(cameraInput, dimensions.pixelWidth / dimensions.pixelHeight);
    const multiply = (matrix, vector) => [0, 1, 2, 3].map(row => vector.reduce((sum, value, column) => sum + matrix[column * 4 + row] * value, 0));
    const clip = multiply(projection, multiply(view, [...point.map(value => value * mmScale), 1]));
    return [dimensions.cssWidth * (1 + clip[0] / clip[3]) / 2, dimensions.cssHeight * (1 - clip[1] / clip[3]) / 2];
  }
  let maxInverseErrorMM = 0, inverseSamples = 0;
  for (const origin of [[-0, 1.125, 2.25], [3.125, -0, .25]]) for (const axis of [0, 1, 2]) {
    const projection = math.projectPoleAxis(origin, camera, scale, size.cssWidth, size.cssHeight, size.pixelWidth, size.pixelHeight, axis);
    assert.ok(projection); const start = screen(origin, camera, scale, size);
    for (const displacement of [-2, -.25, 0, .6, 2.5]) {
      const moved = [...origin]; moved[axis] += displacement;
      const end = screen(moved, camera, scale, size);
      const actual = math.axisPointerParameter(projection, ...end);
      maxInverseErrorMM = Math.max(maxInverseErrorMM, Math.abs(actual - displacement)); inverseSamples++;
      close(actual, displacement);
      const restored = math.movePoleOnAxis(projection, axis, ...start, ...end, null);
      restored.forEach((value, index) => index === axis ? close(value, moved[index]) : assert.ok(Object.is(value, origin[index])));
    }
    assert.deepEqual(math.movePoleOnAxis(projection, axis, start[0] + 5, start[1] + 7, start[0] + 5, start[1] + 7, null), origin);
    if (projection.cameraAxisDepth !== 0) {
      const horizon = -projection.lengthCoefficient / projection.cameraAxisDepth;
      assert.throws(() => math.axisPointerParameter(projection, projection.xCss + horizon * projection.dirX,
        projection.yCss + horizon * projection.dirY), RangeError);
    }
  }
  const origin = [-0, 1.125, 2.25], projection = math.projectPoleAxis(origin, camera, scale,
    size.cssWidth, size.cssHeight, size.pixelWidth, size.pixelHeight, 1);
  const start = screen(origin, camera, scale, size), end = screen([origin[0], origin[1] + 1.1, origin[2]], camera, scale, size);
  const snapped = math.movePoleOnAxis(projection, 1, ...start, ...end, .25);
  close(snapped[1], origin[1] + 1); assert.ok(Object.is(snapped[0], -0)); assert.notEqual(snapped[1] / .25, Math.round(snapped[1] / .25));
  assert.deepEqual(math.movePoleOnAxis(projection, 1, ...start, ...end, 1000000), origin);
  assert.equal(math.projectPoleAxis(origin, {...camera, eye: [0, 0, 6]}, scale,
    size.cssWidth, size.cssHeight, size.pixelWidth, size.pixelHeight, 2), null);
  const invalidSteps = ['', ' 2', '1e-6', '0', '-1', '1000001', '1'.repeat(129)];
  for (const value of invalidSteps) assert.throws(() => math.parseMovementSnapStep(value), RangeError);
  assert.equal(math.parseMovementSnapStep('0.000001'), .000001); assert.equal(math.parseMovementSnapStep('.25'), .25);
  result.events.push({stage: 'pure-public-camera-axis-forward-inverse-snap-and-guards', inverseSamples, maxInverseErrorMM,
    displacementNotGlobalGrid: true, signedZeroAndUntouchedAxes: true, actualEndOnAndHorizonRefusal: true, invalidSteps}); save();

  const mixedPath = resolve(repo, 'apps/cad-editor/fixtures/source-preserving-surface.cad-document.json');
  const curvePath = resolve(repo, 'apps/cad-editor/fixtures/curve-pole-authoring.cad-document.json');
  const resolveBody = (graph, bodyId) => cad.resolveCadGeometryReference(graph, cad.createCadGeometryReference(graph, {bodyId}).reference);
  function selected(snapshot) {
    const selection = snapshot.curveSelection ?? snapshot.selection;
    const resolved = cad.resolveCadGeometryReference(snapshot.accepted, selection.reference);
    const point = resolved.geometry.kind === 'curve' ? resolved.geometry.controlPoints[selection.index] : resolved.geometry.controlPoints[selection.uIndex][selection.vIndex];
    return {selection, resolved, point};
  }
  function assertNativeMove(before, after, axis, value) {
    const old = selected(before), next = selected(after), expectedPoint = [...old.point]; expectedPoint[axis] = value;
    assert.deepEqual(next.point, expectedPoint);
    const field = fields[axis], geometry = old.resolved.geometry;
    const operation = geometry.kind === 'curve'
      ? cad.editSourceCurveControlPolygon({source: old.resolved.source, sourceVersion: 0, curveId: geometry.id,
        edits: {poleEdits: [{index: old.selection.index, [field]: value}]}})
      : cad.editSourceSurfaceControlNet({source: old.resolved.source, sourceVersion: 0, surfaceId: geometry.id,
        edits: {poleEdits: [{uIndex: old.selection.uIndex, vIndex: old.selection.vIndex, [field]: value}]}});
    if (geometry.kind === 'curve') cad.validateSourceCurveControlPolygonEdit(operation); else cad.validateSourceSurfaceControlNetEdit(operation);
    assert.equal(next.resolved.source, operation.source);
    const provenance = geometry.kind === 'curve' ? operation.provenance : operation.edit.provenance;
    assert.deepEqual(geometry.kind === 'curve' ? after.lastCurveProvenance : after.lastProvenance, provenance);
    assert.deepEqual(provenance[0].requestedFields, [field]);
    assert.deepEqual(next.resolved.geometry.weights, geometry.weights);
    if (geometry.kind === 'curve') assert.deepEqual(next.resolved.geometry.knots, geometry.knots);
    else { assert.deepEqual(next.resolved.geometry.knotsU, geometry.knotsU); assert.deepEqual(next.resolved.geometry.knotsV, geometry.knotsV); }
    for (const asset of before.accepted.document.assets.filter(asset => asset.id !== old.selection.reference.assetId))
      assert.deepEqual(after.accepted.document.assets.find(value => value.id === asset.id), asset);
    const previousModel = before.accepted.compiledAssets.find(asset => asset.assetId === old.selection.reference.assetId).model;
    const nextModel = after.accepted.compiledAssets.find(asset => asset.assetId === old.selection.reference.assetId).model;
    assert.equal(nextModel.name, previousModel.name);
    previousModel.objects.forEach((object, index) => { if (object.id !== geometry.id) assert.deepEqual(nextModel.objects[index], object); });
    assert.equal(after.history.count, before.history.count + 1); assert.equal(after.generation, before.generation + 1);
    return {axis: names[axis], pointMM: expectedPoint, sourceSHA256: hash(operation.source), sourceModelObjects: nextModel.objects.length};
  }
  const {chromium} = await import(option('--playwright', '/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
  const executablePath = option('--browser', '/Users/user/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  assert.ok(existsSync(executablePath));
  server = spawn(process.execPath, [resolve(repo, 'node_modules/vite/bin/vite.js'), '--force', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {cwd: resolve(repo, 'apps/cad-editor'), env: {...process.env, ...(compiled ? {CAD_EDITOR_COMPILED_MAP: runtimeMapPath} : {})}, stdio: ['ignore', 'pipe', 'pipe']});
  let log = ''; for (const stream of [server.stdout, server.stderr]) stream.on('data', bytes => { log += bytes; writeFileSync(resolve(evidence, prefix + '-server.log'), log); });
  server.on('exit', () => { serverExited = true; });
  for (let index = 0; index < 100; index++) {
    if (serverExited) throw new Error('Owned Vite exited before readiness.');
    try { if ((await fetch('http://127.0.0.1:' + port)).ok) break; } catch {/* Retry while the owned server starts. */}
    if (index === 99) throw new Error('Owned Vite readiness timeout.'); await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({executablePath, headless: !args.includes('--headed'), args: ['--enable-unsafe-webgpu']});
  context = await browser.newContext({viewport: {width: 1440, height: 960}, deviceScaleFactor: 1, acceptDownloads: true});
  const setup = async page => {
    page.setDefaultTimeout(30000); page.on('pageerror', error => result.pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:' + port + '/?flow#/documents/cad_editor_fixture');
    await page.waitForFunction(() => window.__cadEditorFlow?.display()?.state.status === 'ready');
    await page.evaluate(() => document.addEventListener('pointerdown', event => {
      if (event.target?.closest?.('[data-testid^="pole-axis-"]')) window.__axisFlowPointerId = event.pointerId;
    }, true));
  };
  const snapshot = page => page.evaluate(() => window.__cadEditorFlow.snapshot());
  const frame = page => page.evaluate(() => window.__cadEditorFlow.snapshot().view.kind === 'curve-focus' ? window.__cadEditorFlow.curveDisplay() : window.__cadEditorFlow.display());
  async function ready(page, generation, kind = 'document') {
    await page.waitForFunction(({generation, kind}) => {
      const api = window.__cadEditorFlow, s = api.snapshot(), f = kind === 'curve-focus' ? api.curveDisplay() : api.display();
      return s.generation === generation && s.view.kind === kind && !s.candidate && f?.state.status === 'ready'
        && (kind === 'curve-focus' ? f.generation === generation && f.displayGeneration === s.displayGeneration : f.state.document?.document.revision === s.accepted.document.revision);
    }, {generation, kind});
  }
  async function read(page) {
    const previous = await frame(page); await page.evaluate(() => window.__cadEditorFlow.readFrame());
    await page.waitForFunction(index => {
      const a = window.__cadEditorFlow, f = a.snapshot().view.kind === 'curve-focus' ? a.curveDisplay() : a.display();
      return f?.readIndex > index;
    }, previous.readIndex); return frame(page);
  }
  async function open(page, path, focus = null) {
    const old = await snapshot(page), graph = cad.parseCadDocument(readFileSync(path, 'utf8'));
    await page.getByLabel('Open native document file').setInputFiles(path);
    if (graph.document.bodies.length > 4 || graph.compiledAssets.some(asset => asset.model.objects.some(object => object.kind === 'curve' && object.degree > 3))) {
      await page.getByTestId('open-display-choice').waitFor();
      for (const id of focus ? ['surface_body', 'foreign_body'] : ['surface_body', 'curve_body']) await page.getByTestId('open-body-' + id).check();
      await page.getByTestId('open-view-mode').selectOption(focus ? 'curve-focus' : 'document');
      if (focus) await page.getByTestId('open-focus-curve').selectOption(focus);
      await page.getByTestId('open-display-confirm').click();
    }
    if (old.dirty || await page.evaluate(() => window.__cadEditorFlow.recovery().unsaved)) {
      await page.getByTestId('replacement-dialog').waitFor(); await page.getByTestId('replacement-continue').click();
    }
    await ready(page, old.generation + 1, focus ? 'curve-focus' : 'document');
    assert.deepEqual((await snapshot(page)).accepted.document, graph.document);
  }
  async function selectSurface(page) {
    await page.getByTestId('body-select-surface_body').click(); await page.getByTestId('cad-editor-u').selectOption('1');
    await page.getByTestId('cad-editor-v').selectOption('1'); await page.getByTestId('pole-axis-overlay').waitFor();
  }
  async function isometric(page) {
    await page.getByTestId('view-isometric').click(); await page.waitForFunction(() => document.querySelector('[data-testid="view-isometric"]')?.getAttribute('aria-pressed') === 'true');
    for (const name of names) await page.getByTestId('pole-axis-' + name).waitFor(); await read(page);
  }
  async function axisStart(page, axis, pixels = 15) {
    const handle = page.getByTestId('pole-axis-' + names[axis]);
    const arrow = await handle.evaluate(node => {
      const line = node.closest('.pole-axis').querySelector('line'), matrix = line.getScreenCTM();
      const first = new DOMPoint(line.x1.baseVal.value, line.y1.baseVal.value).matrixTransform(matrix);
      const last = new DOMPoint(line.x2.baseVal.value, line.y2.baseVal.value).matrixTransform(matrix);
      const length = Math.hypot(last.x - first.x, last.y - first.y), box = node.getBoundingClientRect();
      return {x: box.x + box.width / 2, y: box.y + box.height / 2, dx: (last.x - first.x) / length, dy: (last.y - first.y) / length};
    });
    await page.mouse.move(arrow.x, arrow.y); await page.mouse.down(); mouseHeld = true;
    if (pixels !== 0) await page.mouse.move(arrow.x + arrow.dx * pixels, arrow.y + arrow.dy * pixels, {steps: 4});
    if (pixels > 3) await page.waitForFunction(field => Object.keys(window.__cadEditorFlow.snapshot().pending).length === 1 && Object.hasOwn(window.__cadEditorFlow.snapshot().pending, field), fields[axis]);
    return {arrow, staged: await snapshot(page)};
  }
  async function release(page) { await page.mouse.up(); mouseHeld = false; }
  async function cancelPointer(page) {
    await page.evaluate(() => {
      const id = window.__axisFlowPointerId;
      const handle = [...document.querySelectorAll('[data-testid^="pole-axis-"]')].find(node => node.hasPointerCapture(id));
      if (!handle) throw new Error('No actual axis pointer capture exists.');
      handle.dispatchEvent(new PointerEvent('pointercancel', {pointerId: id, isPrimary: true, bubbles: true}));
    }); await release(page);
  }
  async function drag(page, axis, snapStep = null) {
    const before = await snapshot(page), previous = await read(page), oldPoint = selected(before).point;
    const {staged} = await axisStart(page, axis);
    assert.deepEqual(staged.accepted, before.accepted); assert.deepEqual(staged.history, before.history); assert.equal(staged.candidate, null);
    assert.equal((await read(page)).pixelHash, previous.pixelHash); assert.deepEqual((await frame(page)).state.camera, previous.state.camera);
    assert.ok(await page.getByTestId('pole-snap-enabled').isDisabled()); assert.ok(await page.getByTestId('pole-snap-step').isDisabled());
    const value = Number(staged.pending[fields[axis]]), delta = value - oldPoint[axis];
    assert.ok(delta > 0, 'Dragging along the positive rendered axis must move the selected world coordinate positively.');
    if (snapStep !== null) close(delta / snapStep, Math.round(delta / snapStep));
    await release(page); await ready(page, before.generation + 1, before.view.kind);
    const after = await snapshot(page), proof = assertNativeMove(before, after, axis, value);
    assert.deepEqual(after.pending, {}); assert.ok((await read(page)).nonBackgroundPixels > 0);
    return {...proof, deltaMM: delta, stepMM: snapStep};
  }
  const page = await context.newPage(); activePage = page; await setup(page); await open(page, mixedPath); await selectSurface(page);
  assert.equal(await page.getByTestId('pole-snap-enabled').isChecked(), false); assert.equal(await page.getByTestId('pole-snap-step').inputValue(), '1');
  await page.getByTestId('view-front').click(); await read(page); assert.equal(await page.getByTestId('pole-axis-z').count(), 0);
  await isometric(page); let before = await snapshot(page); const beforeAxes = selected(before).point;
  const surfaceMoves = []; for (const axis of [0, 1, 2]) surfaceMoves.push(await drag(page, axis));
  const beforeUndo = await snapshot(page), pointBeforeZ = [...selected(beforeUndo).point]; pointBeforeZ[2] = surfaceMoves[1].pointMM[2];
  await page.getByRole('button', {name: 'Undo', exact: true}).click(); await ready(page, beforeUndo.generation + 1);
  assert.deepEqual(selected(await snapshot(page)).point, pointBeforeZ);
  const undo = await snapshot(page); await page.getByRole('button', {name: 'Redo', exact: true}).click(); await ready(page, undo.generation + 1);
  assert.deepEqual(selected(await snapshot(page)).point, selected(beforeUndo).point);
  await page.screenshot({path: resolve(evidence, prefix + '-Surface-XYZ-axes.png')});
  result.events.push({stage: 'actual-mixed-original-Surface-world-XYZ-and-single-UndoRedo', originalPointMM: beforeAxes, surfaceMoves,
    otherCoordinatesWeightsSiblingsAndSignedZeroRetained: true, nativeAndRGBAUnchangedDuringPointerMove: true}); save();

  await page.getByTestId('cad-editor-xMM').fill('30.125'); before = await snapshot(page); await page.getByTestId('cad-editor-apply').click(); await ready(page, before.generation + 1);
  await page.getByTestId('pole-snap-enabled').check(); await page.getByTestId('pole-snap-step').fill('2');
  const snap2 = await drag(page, 0, 2); assert.notEqual(snap2.pointMM[0] / 2, Math.round(snap2.pointMM[0] / 2));
  await page.getByTestId('cad-editor-yMM').fill('20.125'); before = await snapshot(page); await page.getByTestId('cad-editor-apply').click(); await ready(page, before.generation + 1);
  await page.getByTestId('pole-snap-step').fill('0.25'); const snapQuarter = await drag(page, 1, .25);
  assert.notEqual(snapQuarter.pointMM[1] / .25, Math.round(snapQuarter.pointMM[1] / .25));
  await page.getByTestId('pole-snap-step').fill('1000000'); before = await snapshot(page); await axisStart(page, 0); await release(page);
  await page.waitForFunction(() => Object.keys(window.__cadEditorFlow.snapshot().pending).length === 0); assert.deepEqual(await snapshot(page), before);
  await axisStart(page, 0, 0); await release(page); assert.deepEqual(await snapshot(page), before);
  await page.getByTestId('pole-snap-step').fill('1e-6'); await page.getByTestId('pole-snap-error').waitFor();
  assert.equal(await page.getByTestId('pole-snap-step').inputValue(), '1e-6'); assert.deepEqual(await snapshot(page), before);
  for (const name of names) assert.ok(await page.getByTestId('pole-axis-' + name).isDisabled());
  await page.screenshot({path: resolve(evidence, prefix + '-invalid-snap-step.png')});
  await page.getByTestId('pole-snap-step').fill('0.25'); const keyboardBefore = await snapshot(page);
  await page.getByTestId('pole-axis-x').focus(); await page.keyboard.press('ArrowRight'); await ready(page, keyboardBefore.generation + 1);
  const keyboard = assertNativeMove(keyboardBefore, await snapshot(page), 0, selected(keyboardBefore).point[0] + .25);
  before = await snapshot(page); await page.getByTestId('pole-axis-x').dispatchEvent('keydown', {key: 'ArrowRight', repeat: true}); assert.deepEqual(await snapshot(page), before);
  result.events.push({stage: 'explicit-displacement-snap-fractional-step-noop-invalid-and-keyboard', snap2, snapQuarter, keyboard,
    globalGridNotUsed: true, snappedZeroAndNoMotionNoHistory: true, invalidRawRetained: true, repeatedDOMKeyDoesNotCommit: true}); save();

  await page.getByTestId('pole-snap-enabled').uncheck(); before = await snapshot(page); const retainedFrame = await read(page);
  await axisStart(page, 0); await page.keyboard.press('Escape'); await release(page); assert.deepEqual(await snapshot(page), before);
  await axisStart(page, 2); await cancelPointer(page); assert.deepEqual(await snapshot(page), before);
  const stale = await axisStart(page, 0); await page.evaluate(() => window.__cadEditorFlow.session.stageSurfacePoleField('yMM', '23'));
  await page.mouse.move(stale.arrow.x + stale.arrow.dx * 20, stale.arrow.y + stale.arrow.dy * 20); await release(page);
  const corrective = await snapshot(page); assert.deepEqual(corrective.accepted, before.accepted); assert.deepEqual(corrective.history, before.history);
  assert.equal(corrective.pending.yMM, '23'); assert.equal(corrective.pending.xMM, stale.staged.pending.xMM);
  assert.equal((await read(page)).pixelHash, retainedFrame.pixelHash); await page.getByTestId('cad-editor-discard').click();
  before = await snapshot(page); const oldSize = await read(page), resizedDrag = await axisStart(page, 0);
  await page.setViewportSize({width: 1400, height: 900});
  await page.waitForFunction(width => window.__cadEditorFlow.display()?.width !== width, oldSize.width);
  await page.keyboard.press('Escape'); await release(page);
  const resized = await snapshot(page);
  assert.deepEqual(resized.accepted, before.accepted); assert.deepEqual(resized.history, before.history);
  assert.deepEqual(resized.pending, resizedDrag.staged.pending);
  await page.getByTestId('cad-editor-discard').click(); await page.setViewportSize({width: 1440, height: 960}); await read(page);
  await page.getByTestId('cad-editor-weight').fill('0'); const badWeight = await snapshot(page); await page.getByTestId('cad-editor-apply').click();
  await page.waitForFunction(() => window.__cadEditorFlow.error()?.code === 'NATIVE'); assert.deepEqual(await snapshot(page), badWeight);
  const nativeError = await page.evaluate(() => window.__cadEditorFlow.error()); assert.ok(nativeError.causeChain.some(cause => /weight/i.test(cause.message)));
  await page.getByTestId('cad-editor-discard').click(); before = await snapshot(page); const beforeDisplayRefusal = await read(page);
  await page.evaluate(() => window.__cadEditorFlow.setDisplayRefusal(true)); await page.waitForFunction(() => window.__cadEditorFlow.error()?.message.includes('Display options were refused'));
  await page.getByTestId('cad-editor-zMM').fill(String(selected(before).point[2] + 1)); const refusedDraft = await snapshot(page); await page.getByTestId('cad-editor-apply').click();
  await page.waitForFunction(() => !window.__cadEditorFlow.snapshot().candidate && window.__cadEditorFlow.error()?.code === 'DISPLAY');
  assert.deepEqual(await snapshot(page), refusedDraft);
  const refusedFrame = await read(page); assert.deepEqual(refusedFrame.state.document, before.accepted);
  assert.equal(refusedFrame.pixelHash, beforeDisplayRefusal.pixelHash); assert.deepEqual(refusedFrame.state.camera, beforeDisplayRefusal.state.camera);
  await page.evaluate(() => window.__cadEditorFlow.setDisplayRefusal(false)); await page.getByTestId('cad-editor-discard').click(); await read(page);
  before = await snapshot(page); await page.getByTestId('cad-editor-help').click(); await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'cad-editor-help'); assert.deepEqual(await snapshot(page), before);
  const beforeHidden = await snapshot(page);
  await page.getByTestId('body-visible-surface_body').uncheck();
  await page.waitForFunction(() => !window.__cadEditorFlow.snapshot().candidate && !window.__cadEditorFlow.snapshot().displayBodyIds.includes('surface_body'));
  assert.equal(await page.getByTestId('pole-axis-overlay').count(), 0);
  assert.deepEqual((await snapshot(page)).accepted, beforeHidden.accepted);
  await page.getByTestId('body-visible-surface_body').check(); await page.getByTestId('pole-axis-overlay').waitFor();
  await page.setViewportSize({width: 1000, height: 700}); await read(page);
  for (const id of ['pole-snap-enabled', 'pole-snap-step', 'pole-axis-x', 'pole-axis-y', 'pole-axis-z', 'document-open', 'app-draft-state']) {
    await page.getByTestId(id).scrollIntoViewIfNeeded(); const box = await page.getByTestId(id).boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1000 && box.y + box.height <= 700, id + ' exceeds the supported compact workspace.');
  }
  await page.screenshot({path: resolve(evidence, prefix + '-compact-axis-palette.png')}); await page.setViewportSize({width: 1440, height: 960}); await read(page);
  const retainedDirect = await snapshot(page);
  await page.getByRole('menuitem', {name: 'File', exact: true}).click();
  await page.getByRole('menuitem', {name: 'New Boolean extrusion', exact: true}).click();
  await page.waitForFunction(() => window.__cadFeatureFlow?.display()?.status === 'ready');
  assert.deepEqual(await snapshot(page), retainedDirect);
  await page.evaluate(() => { location.hash = '/documents/' + window.__cadEditorFlow.snapshot().accepted.document.documentId; });
  await page.waitForFunction(() => !document.querySelector('.cad-mode')?.hidden);
  await ready(page, retainedDirect.generation); assert.deepEqual(await snapshot(page), retainedDirect);
  assert.ok((await read(page)).nonBackgroundPixels > 0); assert.deepEqual(result.pageErrors, []);
  result.events.push({stage: 'axis-cancel-external-raw-native-display-refusal-and-compact', EscapeAndMatchingDOMCancelRetainNative: true,
    externalCorrectiveRawPreserved: true, actualResizeThenEscapeRetainsCorrectiveRaw: true, actualNativeError: nativeError,
    actualCountU1Refusal: true, hiddenSurfaceHasNoGizmo: true, retainedDirectFeatureNavigationHasNoPageError: true, minimumWorkspace: [1000, 700]}); save();

  await open(page, curvePath, 'quintic_body'); await page.getByTestId('body-select-quintic_body').click();
  await page.getByTestId('cad-editor-curve-index').selectOption('2'); await isometric(page);
  let focused = await frame(page), focusedSnapshot = await snapshot(page);
  assert.equal(focused.state.document, null); assert.deepEqual(focused.state.documentBodies, []); assert.deepEqual(focused.state.selectedUniformCurve, focused.preview);
  assert.equal(focused.preview.source, resolveBody(focusedSnapshot.accepted, 'quintic_body').source); assert.equal(focused.preview.model.objects.length, 4);
  assert.equal(selected(focusedSnapshot).resolved.geometry.degree, 5); assert.equal(selected(focusedSnapshot).point[1], -0);
  const focusedMove = await drag(page, 0); assert.ok(Object.is(selected(await snapshot(page)).point[1], -0));
  await page.getByTestId('body-select-surface_body').click(); assert.equal(await page.getByTestId('pole-axis-overlay').count(), 0);
  await page.getByTestId('body-select-quintic_body').click(); await page.getByTestId('cad-editor-curve-index').selectOption('2');
  const savedSnapshot = await snapshot(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name: 'Download', exact: true}).click()]);
  const nativePath = resolve(evidence, prefix + '-' + download.suggestedFilename()); await download.saveAs(nativePath);
  assert.deepEqual(cad.parseCadDocument(readFileSync(nativePath, 'utf8')).document, savedSnapshot.accepted.document);
  freshContext = await browser.newContext({viewport: {width: 1440, height: 960}, deviceScaleFactor: 1, acceptDownloads: true});
  const fresh = await freshContext.newPage(); activePage = fresh; await setup(fresh); await open(fresh, nativePath, 'quintic_body');
  await fresh.getByTestId('body-select-quintic_body').click(); await fresh.getByTestId('cad-editor-curve-index').selectOption('2'); await isometric(fresh);
  const reedit = await drag(fresh, 0); focused = await frame(fresh); focusedSnapshot = await snapshot(fresh);
  assert.equal(focused.state.document, null); assert.deepEqual(focused.state.documentBodies, []);
  assert.equal(focused.preview.source, selected(focusedSnapshot).resolved.source); assert.ok(focused.nonBackgroundPixels > 0);
  await fresh.screenshot({path: resolve(evidence, prefix + '-fresh-quintic-axis-reedit.png')});
  result.events.push({stage: 'actual-focused-quintic-axis-native-file-and-fresh-reedit', focusedMove, reedit, nativePath,
    nativeFileSHA256: hash(readFileSync(nativePath)), truthfulFocusedReceipt: true, noFabricatedDocumentBodies: true}); save();

  await fresh.getByTestId('cad-editor-zMM').fill('0.7'); const copyBefore = await snapshot(fresh);
  await fresh.getByRole('menuitem', {name: 'File', exact: true}).click(); await fresh.getByRole('menuitem', {name: 'Recovery copies…', exact: true}).click();
  await fresh.waitForFunction(() => window.__cadEditorFlow.recovery().status === 'empty'); await fresh.getByTestId('recovery-save').click();
  await fresh.waitForFunction(() => window.__cadEditorFlow.recovery().slot?.record?.hadPending === true);
  const stored = await fresh.evaluate(() => window.__cadEditorFlow.recovery().slot);
  assert.deepEqual(cad.parseCadDocument(stored.record.text).document, copyBefore.accepted.document); assert.equal(stored.record.wasDirty, true);
  assert.deepEqual(Object.keys(stored.record).sort(), ['schema', 'version', 'text', 'filename', 'displayBodyIds', 'wasDirty', 'hadPending', 'savedAtUTC'].sort());
  assert.deepEqual(await snapshot(fresh), copyBefore); assert.deepEqual(stored.record.displayBodyIds, copyBefore.displayBodyIds);
  await fresh.getByTestId('recovery-cancel').click(); await fresh.getByTestId('cad-editor-discard').click();
  result.events.push({stage: 'manual-accepted-recovery-excludes-axis-settings-and-corrective-draft', rawSHA256: hash(stored.raw),
    unchangedAcceptedSourceAndNativeSnapshot: true, noSettingsViewCameraOrPendingInNativeFile: true, noNewDurabilityClaim: true});
  assert.deepEqual(result.pageErrors, []); result.outcome = 'passed'; save();
  console.log(JSON.stringify({mode, head: result.head, outcome: result.outcome, stages: result.events.map(event => event.stage), evidence: resolve(evidence, prefix + '.json')}));
} catch (error) {
  if (activePage) try {
    result.failureWindow = await activePage.evaluate(() => ({error: window.__cadEditorFlow?.error(), snapshot: window.__cadEditorFlow?.snapshot(), display: window.__cadEditorFlow?.display(), curveDisplay: window.__cadEditorFlow?.curveDisplay()}));
    if (mouseHeld) {
      await activePage.evaluate(() => {
        const id = window.__axisFlowPointerId;
        const handle = [...document.querySelectorAll('[data-testid^="pole-axis-"]')].find(node => node.hasPointerCapture(id));
        handle?.dispatchEvent(new PointerEvent('pointercancel', {pointerId: id, isPrimary: true, bubbles: true}));
      }); await activePage.mouse.up(); mouseHeld = false;
    }
    await activePage.screenshot({path: resolve(evidence, prefix + '-failure.png')});
  } catch {/* Keep the original failure if capture fails. */}
  result.outcome = 'failed'; result.failure = {message: error.message, stack: error.stack}; save(); console.error(error.stack); process.exitCode = 1;
} finally {
  await freshContext?.close(); await context?.close(); await browser?.close();
  if (server && !serverExited) { server.kill('SIGTERM'); await new Promise(resolve => { server.once('exit', resolve); setTimeout(resolve, 2000); }); }
}
