import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync} from 'node:fs';
import {resolve, basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn, execFileSync} from 'node:child_process';
import {register} from 'node:module';
import {build} from 'esbuild';

const args = process.argv.slice(2), option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const repo = resolve(import.meta.dirname, '../../..');
const evidence = resolve(option('--evidence', '/Users/user/.barocss-ai/v3/evidence-cad-editor-compact-canvas'));
const baselinePath = resolve(option('--baseline', resolve(evidence, 'baseline.json')));
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
mkdirSync(evidence, {recursive: true});
const compiled = args.includes('--compiled'), mode = compiled ? 'compiled' : 'source';
const port = Number(option('--port', compiled ? '52041' : '52040'));
const attempt = readdirSync(evidence).filter(name => new RegExp('^' + mode + '-attempt-\\d+\\.json$').test(name)).length + 1;
const prefix = mode + '-attempt-' + String(attempt).padStart(3, '0');
const git = (...values) => execFileSync('git', values, {cwd: repo, encoding: 'utf8'}).trim();
const hash = value => createHash('sha256').update(value).digest('hex');
const result = {head: git('rev-parse', 'HEAD'), workingTree: git('status', '--porcelain'), mode, node: process.version,
  baselinePath, baselineSHA256: hash(readFileSync(baselinePath)), parent: baseline.parent,
  browserMode: args.includes('--headed') ? 'headed' : 'headless', events: [], pageErrors: [], outcome: 'running'};
const save = () => writeFileSync(resolve(evidence, prefix + '.json'), JSON.stringify(result, null, 2) + '\n');
let server, serverExited = false, browser, context, freshContext, activePage, mouseHeld = false;

try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  assert.equal(result.workingTree, '', 'Density acceptance requires one clean exact child.');
  for (const [path, expected] of Object.entries(baseline.protectedTrees)) assert.equal(git('rev-parse', 'HEAD:' + path), expected, path + ' changed outside CSS scope.');
  save();
  let cad, runtimeMapPath;
  if (compiled) {
    const {prepareCompiledCheckpoint} = await import('./compiled-checkpoint.mjs');
    result.compiledCheckpoint = await prepareCompiledCheckpoint({repo, evidence});
    runtimeMapPath = result.compiledCheckpoint.runtimeMapPath;
    register(pathToFileURL(result.compiledCheckpoint.loaderPath));
    cad = await import(pathToFileURL(result.compiledCheckpoint.nativeCadPath));
  } else {
    const output = resolve(evidence, prefix + '-native.mjs');
    await build({stdin: {contents: 'export * from ' + JSON.stringify(resolve(repo, 'packages/barocss-cad/src/index.ts')) + ';', resolveDir: repo},
      bundle: true, platform: 'node', format: 'esm', target: 'es2022', outfile: output});
    cad = await import(pathToFileURL(output));
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
    try { if ((await fetch('http://127.0.0.1:' + port)).ok) break; } catch { /* Retry readiness after the existing ignored connection failure. */ }
    if (index === 99) throw new Error('Owned Vite readiness timeout.'); await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({executablePath, headless: !args.includes('--headed'), args: ['--enable-unsafe-webgpu']});
  context = await browser.newContext({viewport: {width: 1440, height: 960}, deviceScaleFactor: 1, acceptDownloads: true});
  const setup = async page => {
    page.setDefaultTimeout(30000); page.on('pageerror', error => result.pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:' + port + '/?flow#/documents/cad_editor_fixture');
    await page.waitForFunction(() => window.__cadEditorFlow?.display()?.state.status === 'ready');
    await page.getByTestId('body-select-surface_body').click();
    await page.waitForFunction(() => window.__cadEditorFlow.snapshot().selection?.bodyId === 'surface_body');
    await page.evaluate(() => document.addEventListener('pointerdown', event => {
      if (event.target?.closest?.('[data-testid^="pole-axis-"]')) window.__compactFlowPointerId = event.pointerId;
    }, true));
  };
  const snapshot = page => page.evaluate(() => window.__cadEditorFlow.snapshot());
  const frame = page => page.evaluate(() => window.__cadEditorFlow.display());
  async function ready(page, generation) {
    await page.waitForFunction(generation => {
      const s = window.__cadEditorFlow.snapshot(), f = window.__cadEditorFlow.display();
      return s.generation === generation && !s.candidate && f?.state.status === 'ready'
        && f.state.document?.document.revision === s.accepted.document.revision;
    }, generation);
    assert.deepEqual((await frame(page)).state.document, (await snapshot(page)).accepted);
  }
  async function read(page) {
    const old = await frame(page); await page.evaluate(() => window.__cadEditorFlow.readFrame());
    await page.waitForFunction(index => window.__cadEditorFlow.display()?.readIndex > index, old.readIndex);
    return frame(page);
  }
  async function measure(page, key) {
    const actualFrame = await read(page);
    const dom = await page.evaluate(() => {
      const box = selector => { const b = document.querySelector(selector).getBoundingClientRect(); return {x: b.x, y: b.y, width: b.width, height: b.height}; };
      const input = document.querySelector('[data-testid="cad-editor-xMM"]');
      return {canvas: box('[data-testid="cad-editor-canvas"]'), header: box('.cad-direct-app .app-header'),
        toolbar: box('.cad-direct-app .app-toolbar'), footer: box('.cad-direct-app .app-status'),
        browser: box('.cad-direct-app .document-tree'), inspector: box('.cad-direct-app .cad-editor-inspector'),
        palette: box('.cad-editor-axis-palette'), inputFontPx: Number.parseFloat(getComputedStyle(input).fontSize),
        documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth, viewportHeight: innerHeight};
    });
    const old = baseline[key].canvas, area = dom.canvas.width * dom.canvas.height, oldArea = old.width * old.height;
    assert.ok(dom.canvas.width > old.width && dom.canvas.height > old.height, key + ' Canvas must grow in both measured dimensions.');
    assert.equal(actualFrame.width, Math.round(dom.canvas.width)); assert.equal(actualFrame.height, Math.round(dom.canvas.height));
    assert.equal(actualFrame.pixelCount, actualFrame.width * actualFrame.height); assert.ok(actualFrame.nonBackgroundPixels > 0);
    assert.ok(dom.documentWidth <= dom.viewportWidth && dom.bodyWidth <= dom.viewportWidth, 'The overall workspace must not scroll horizontally.');
    assert.ok(dom.inputFontPx >= 11, 'Coordinate text must stay readable.');
    assert.ok(dom.canvas.x >= 0 && dom.canvas.y >= 0 && dom.canvas.x + dom.canvas.width <= dom.viewportWidth && dom.canvas.y + dom.canvas.height <= dom.viewportHeight);
    return {...dom, baselineCanvas: old, areaRatio: area / oldArea, frame: {width: actualFrame.width, height: actualFrame.height,
      nonBackgroundPixels: actualFrame.nonBackgroundPixels, pixelHash: actualFrame.pixelHash}};
  }
  async function inside(page, locator, label) {
    await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(), viewport = page.viewportSize();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height,
      label + ' must be reachable inside the workspace.');
  }
  async function controls(page) {
    for (const id of ['document-open', 'cad-editor-u', 'cad-editor-v', 'cad-editor-xMM', 'cad-editor-yMM', 'cad-editor-zMM',
      'cad-editor-weight', 'cad-editor-apply', 'cad-editor-discard', 'view-front', 'view-isometric', 'pole-snap-enabled', 'pole-snap-step', 'app-unsaved-state', 'app-draft-state'])
      await inside(page, page.getByTestId(id), id);
    await inside(page, page.getByRole('button', {name: 'Download', exact: true}), 'Download');
    await inside(page, page.getByRole('menuitem', {name: 'File', exact: true}), 'File');
  }
  async function beginAxis(page, pixels = 15) {
    const arrow = await page.getByTestId('pole-axis-x').evaluate(node => {
      const line = node.closest('.pole-axis').querySelector('line'), matrix = line.getScreenCTM();
      const a = new DOMPoint(line.x1.baseVal.value, line.y1.baseVal.value).matrixTransform(matrix);
      const b = new DOMPoint(line.x2.baseVal.value, line.y2.baseVal.value).matrixTransform(matrix);
      const length = Math.hypot(b.x - a.x, b.y - a.y), box = node.getBoundingClientRect();
      return {x: box.x + box.width / 2, y: box.y + box.height / 2, dx: (b.x - a.x) / length, dy: (b.y - a.y) / length};
    });
    await page.mouse.move(arrow.x, arrow.y); await page.mouse.down(); mouseHeld = true;
    await page.mouse.move(arrow.x + arrow.dx * pixels, arrow.y + arrow.dy * pixels, {steps: 4});
    await page.waitForFunction(() => Object.keys(window.__cadEditorFlow.snapshot().pending).length === 1 && Object.hasOwn(window.__cadEditorFlow.snapshot().pending, 'xMM'));
    return snapshot(page);
  }
  async function release(page) { await page.mouse.up(); mouseHeld = false; }
  const surface = graph => cad.resolveCadGeometryReference(graph, cad.createCadGeometryReference(graph, {bodyId: 'surface_body'}).reference).geometry;
  function editProof(before, after, xMM) {
    const old = surface(before.accepted), actual = surface(after.accepted);
    assert.deepEqual(actual.controlPoints[1][1], [xMM, old.controlPoints[1][1][1], old.controlPoints[1][1][2]]);
    assert.deepEqual(actual.weights, old.weights); assert.ok(Object.is(actual.controlPoints[0][0][1], -0));
    assert.deepEqual(after.accepted.document.assets.find(asset => asset.id === 'curve_asset'), before.accepted.document.assets.find(asset => asset.id === 'curve_asset'));
    const native = cad.editSourceSurfaceControlNet({source: before.accepted.document.assets.find(asset => asset.id === 'surface_asset').source,
      sourceVersion: 0, surfaceId: old.id, edits: {poleEdits: [{uIndex: 1, vIndex: 1, xMM}]}});
    assert.equal(after.accepted.document.assets.find(asset => asset.id === 'surface_asset').source, native.source);
    assert.deepEqual(after.lastProvenance, native.edit.provenance); assert.equal(after.history.count, before.history.count + 1);
    return {pointMM: actual.controlPoints[1][1], weight: actual.weights[1][1], sourceSHA256: hash(native.source)};
  }

  const page = await context.newPage(); activePage = page; await setup(page);
  const browserPanel = page.getByRole('complementary', {name: 'Object browser', exact: true});
  const browserBefore = await snapshot(page);
  assert.ok((await browserPanel.locator('h2').innerText()).includes('Objects'));
  assert.equal(await browserPanel.locator('.tree-count').innerText(), String(browserBefore.accepted.document.bodies.length));
  assert.equal(await browserPanel.locator('.tree-details,.tree-foot,.tree-document,.tree-section').count(), 0);
  assert.equal(await browserPanel.locator('small').count(), 0);
  assert.equal(await browserPanel.locator('.body-symbol.surface').count(), 1);
  assert.equal(await browserPanel.locator('.body-symbol.curve').count(), 1);
  assert.doesNotMatch(await browserPanel.innerText(), /Editable|Read-only|Focused/i);
  await page.getByRole('button', {name: 'Reference line Curve', exact: true}).click();
  await page.waitForFunction(() => window.__cadEditorFlow.snapshot().selectedBodyId === 'curve_body');
  assert.equal(await page.getByTestId('body-select-curve_body').getAttribute('aria-pressed'), 'true');
  await page.getByTestId('body-visible-curve_body').uncheck(); await ready(page, browserBefore.generation);
  assert.deepEqual((await snapshot(page)).displayBodyIds, ['surface_body']);
  await page.getByTestId('body-visible-curve_body').check(); await ready(page, browserBefore.generation);
  assert.deepEqual((await snapshot(page)).displayBodyIds, browserBefore.displayBodyIds);
  await page.getByRole('button', {name: 'Weighted surface Surface', exact: true}).click();
  await page.waitForFunction(() => window.__cadEditorFlow.snapshot().selectedBodyId === 'surface_body');
  assert.equal(await page.getByTestId('body-select-surface_body').getAttribute('aria-pressed'), 'true');
  assert.deepEqual((await snapshot(page)).accepted, browserBefore.accepted);
  assert.deepEqual((await snapshot(page)).history, browserBefore.history);
  const initial = await snapshot(page); assert.deepEqual(initial.accepted.document, baseline.ordinary.snapshot.accepted.document);
  const ordinary = await measure(page, 'ordinary'); await controls(page);
  assert.equal(await page.getByTestId('pole-snap-step').isDisabled(), true);
  await page.getByTestId('pole-snap-enabled').check(); assert.equal(await page.getByTestId('pole-snap-step').isDisabled(), false);
  const fullStep = '0.1234567890123456'; await page.getByTestId('pole-snap-step').fill(fullStep);
  await page.getByTestId('pole-snap-step').focus(); await page.keyboard.press('Tab');
  assert.equal(await page.getByTestId('pole-snap-step').inputValue(), fullStep); assert.deepEqual(await snapshot(page), initial);
  await page.getByRole('menuitem', {name: 'File', exact: true}).click();
  await inside(page, page.getByRole('menuitem', {name: 'Open native document…', exact: true}), 'Open menu action');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.textContent?.includes('File'));
  await page.screenshot({path: resolve(evidence, prefix + '-ordinary-expanded-canvas.png')});
  result.events.push({stage: 'ordinary-measured-expanded-real-Canvas-and-primary-controls', ordinary, snapRawFullPrecision: fullStep,
    minimalObjectsCountNamesIconsAndVisibility: true, noRepeatedSidebarCaptionOrDetailBlocks: true,
    namedSelectionAndVisibilityStillFunctional: true, nativeSourceHistorySelectionRetained: true, actualCSSAndPhysicalPixels: true}); save();

  const raw = '30.1234567890123456'; await page.getByTestId('cad-editor-xMM').fill(raw); await page.keyboard.press('Tab');
  const pending = await snapshot(page); assert.equal(pending.pending.xMM, raw); assert.deepEqual(pending.accepted, initial.accepted);
  await page.setViewportSize({width: 1000, height: 700}); const compact = await measure(page, 'compact');
  assert.deepEqual(await snapshot(page), pending); assert.equal(await page.getByTestId('cad-editor-xMM').inputValue(), raw);
  await controls(page); await page.getByTestId('cad-editor-xMM').focus();
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'cad-editor-xMM');
  await page.screenshot({path: resolve(evidence, prefix + '-compact-expanded-canvas-raw.png')});
  await page.getByTestId('cad-editor-discard').click(); await page.getByTestId('pole-snap-enabled').uncheck();
  await page.setViewportSize({width: 1440, height: 960}); await read(page);
  assert.deepEqual((await snapshot(page)).accepted, initial.accepted); assert.deepEqual((await snapshot(page)).history, initial.history);
  result.events.push({stage: 'compact-measured-Canvas-growth-precision-focus-and-resize-retention', compact, coordinateRawFullPrecision: raw,
    sourceHistoryUnchangedByResize: true, noOverallHorizontalOverflow: true}); save();

  await page.getByTestId('view-isometric').click(); await page.waitForFunction(() => document.querySelector('[data-testid="view-isometric"]')?.getAttribute('aria-pressed') === 'true');
  const beforeDrag = await snapshot(page), beforeFrame = await read(page), ghost = await beginAxis(page);
  assert.deepEqual(ghost.accepted, beforeDrag.accepted); assert.deepEqual(ghost.history, beforeDrag.history);
  assert.equal((await read(page)).pixelHash, beforeFrame.pixelHash);
  const xMM = Number(ghost.pending.xMM); await release(page); await ready(page, beforeDrag.generation + 1);
  const drag = editProof(beforeDrag, await snapshot(page), xMM); assert.ok((await read(page)).nonBackgroundPixels > 0);
  const afterDrag = await snapshot(page); await page.getByRole('button', {name: 'Undo', exact: true}).click(); await ready(page, afterDrag.generation + 1);
  assert.deepEqual(surface((await snapshot(page)).accepted), surface(beforeDrag.accepted));
  const beforeCancel = await snapshot(page); await beginAxis(page); await page.keyboard.press('Escape'); await release(page);
  assert.deepEqual(await snapshot(page), beforeCancel);
  await page.screenshot({path: resolve(evidence, prefix + '-axis-undo-cancel.png')});
  result.events.push({stage: 'dense-workspace-real-axis-native-gate-one-history-Undo-cancel', drag,
    pendingIsGhostOnly: true, actualRendererAdmission: true, oneUndoRestoresOriginalGeometry: true}); save();

  const fileSnapshot = await snapshot(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name: 'Download', exact: true}).click()]);
  const nativePath = resolve(evidence, prefix + '-accepted-document-with-a-long-native-filename-for-reediting.cad-document.json');
  await download.saveAs(nativePath); assert.deepEqual(cad.parseCadDocument(readFileSync(nativePath, 'utf8')).document, fileSnapshot.accepted.document);
  freshContext = await browser.newContext({viewport: {width: 1440, height: 960}, deviceScaleFactor: 1, acceptDownloads: true});
  const fresh = await freshContext.newPage(); activePage = fresh; await setup(fresh); const freshOld = await snapshot(fresh);
  await fresh.getByLabel('Open native document file').setInputFiles(nativePath);
  await fresh.getByTestId('replacement-dialog').waitFor(); await fresh.getByTestId('replacement-continue').click(); await ready(fresh, freshOld.generation + 1);
  assert.deepEqual((await snapshot(fresh)).accepted.document, fileSnapshot.accepted.document);
  await fresh.getByTestId('body-select-surface_body').click(); await fresh.getByTestId('view-isometric').click();
  await fresh.getByTestId('pole-axis-x').waitFor(); const beforeFresh = await snapshot(fresh), freshGhost = await beginAxis(fresh);
  await release(fresh); await ready(fresh, beforeFresh.generation + 1); const reedit = editProof(beforeFresh, await snapshot(fresh), Number(freshGhost.pending.xMM));
  const beforeTitleResize = await snapshot(fresh);
  await fresh.setViewportSize({width: 1000, height: 700});
  await fresh.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="cad-editor-canvas"]'), f = window.__cadEditorFlow.display();
    const box = canvas?.getBoundingClientRect();
    return box && f?.state.status === 'ready' && f.width === Math.round(box.width) && f.height === Math.round(box.height);
  });
  const compactTitleFrame = await read(fresh); assert.deepEqual(await snapshot(fresh), beforeTitleResize);
  const title = await fresh.locator('.cad-direct-app .document-title').evaluate(node => {
    const style = getComputedStyle(node); return {title: node.title, textOverflow: style.textOverflow, whiteSpace: style.whiteSpace,
      overflowX: style.overflowX, width: node.clientWidth, contentWidth: node.scrollWidth};
  });
  assert.equal(title.title, basename(nativePath)); assert.equal(title.textOverflow, 'ellipsis'); assert.equal(title.whiteSpace, 'nowrap');
  assert.equal(title.overflowX, 'hidden'); assert.ok(title.contentWidth > title.width, 'The actual long accepted filename must truncate inside its header space.');
  await fresh.screenshot({path: resolve(evidence, prefix + '-fresh-native-reedit-long-name.png')});
  await fresh.setViewportSize({width: 1440, height: 960});
  await fresh.waitForFunction(() => {
    const box = document.querySelector('[data-testid="cad-editor-canvas"]')?.getBoundingClientRect(), f = window.__cadEditorFlow.display();
    return box && f?.state.status === 'ready' && f.width === Math.round(box.width) && f.height === Math.round(box.height);
  });
  await read(fresh);
  assert.deepEqual(await snapshot(fresh), beforeTitleResize);
  result.events.push({stage: 'genuine-native-download-fresh-picker-reedit-and-document-ellipsis', nativePath,
    nativeFileSHA256: hash(readFileSync(nativePath)), reedit, title, titleViewport: [1000, 700],
    titleFrame: {width: compactTitleFrame.width, height: compactTitleFrame.height}, nativeHistoryRetainedDuringTitleResize: true,
    acceptedFilenameTokenRespected: true}); save();

  const retained = await snapshot(fresh);
  await fresh.getByRole('menuitem', {name: 'File', exact: true}).click(); await fresh.getByRole('menuitem', {name: 'New Boolean extrusion', exact: true}).click();
  await fresh.waitForFunction(() => window.__cadFeatureFlow?.display()?.status === 'ready');
  const featureBefore = await fresh.evaluate(() => window.__cadFeatureFlow.snapshot());
  const oldFeatureFrame = await fresh.evaluate(() => window.__cadFeatureFlow.display());
  await fresh.evaluate(() => window.__cadFeatureFlow.readFrame());
  await fresh.waitForFunction(index => window.__cadFeatureFlow.display()?.readIndex > index, oldFeatureFrame.readIndex);
  const featureFrame = await fresh.evaluate(() => window.__cadFeatureFlow.display()), featureCanvas = await fresh.getByTestId('cad-editor-feature-canvas').boundingBox();
  assert.ok(featureCanvas && featureCanvas.width > baseline.ordinary.canvas.width && featureCanvas.height > baseline.ordinary.canvas.height);
  assert.equal(featureFrame.width, Math.round(featureCanvas.width)); assert.equal(featureFrame.height, Math.round(featureCanvas.height));
  assert.ok(featureFrame.nonBackgroundPixels > 0); assert.deepEqual(await fresh.evaluate(() => window.__cadFeatureFlow.snapshot()), featureBefore);
  assert.deepEqual(await snapshot(fresh), retained);
  await fresh.screenshot({path: resolve(evidence, prefix + '-dense-feature-workspace.png')});
  await fresh.evaluate(() => { location.hash = '/documents/' + window.__cadEditorFlow.snapshot().accepted.document.documentId; });
  await fresh.waitForFunction(() => !document.querySelector('.cad-mode')?.hidden); await ready(fresh, retained.generation);
  assert.deepEqual(await snapshot(fresh), retained); assert.ok((await read(fresh)).nonBackgroundPixels > 0);
  assert.deepEqual(result.pageErrors, []);
  result.events.push({stage: 'coherent-feature-Canvas-and-retained-Direct-return', featureCanvas,
    featureFrame: {width: featureFrame.width, height: featureFrame.height, nonBackgroundPixels: featureFrame.nonBackgroundPixels, pixelHash: featureFrame.pixelHash},
    featureAndDirectNativeHistoryRetained: true, actualFreshFramesAndNoPageErrors: true});
  result.outcome = 'passed'; save();
  console.log(JSON.stringify({mode, head: result.head, outcome: result.outcome, stages: result.events.map(event => event.stage), evidence: resolve(evidence, prefix + '.json')}));
} catch (error) {
  if (activePage) try {
    result.failureWindow = await activePage.evaluate(() => ({error: window.__cadEditorFlow?.error(), snapshot: window.__cadEditorFlow?.snapshot(), display: window.__cadEditorFlow?.display()}));
    if (mouseHeld) {
      await activePage.evaluate(() => {
        const id = window.__compactFlowPointerId;
        const handle = [...document.querySelectorAll('[data-testid^="pole-axis-"]')].find(node => node.hasPointerCapture(id));
        handle?.dispatchEvent(new PointerEvent('pointercancel', {pointerId: id, isPrimary: true, bubbles: true}));
      }); await activePage.mouse.up(); mouseHeld = false;
    }
    await activePage.screenshot({path: resolve(evidence, prefix + '-failure.png')});
  } catch { /* Preserve the original failure if collecting diagnostics also fails. */ }
  result.outcome = 'failed'; result.failure = {message: error.message, stack: error.stack}; save(); console.error(error.stack); process.exitCode = 1;
} finally {
  await freshContext?.close(); await context?.close(); await browser?.close();
  if (server && !serverExited) { server.kill('SIGTERM'); await new Promise(resolve => { server.once('exit', resolve); setTimeout(resolve, 2000); }); }
}
