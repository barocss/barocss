import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire, register } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const repo = resolve(import.meta.dirname, '../../..');
const evidence = resolve(option('--evidence', '/Users/user/.barocss-ai/v3/evidence-cad-editor-foundation'));
const port = Number(option('--port', '52010'));
const compiled = args.includes('--compiled');
const mode = compiled ? 'compiled' : 'source';
mkdirSync(evidence, { recursive: true });
const previous = readdirSync(evidence).filter(name => name.startsWith(mode + '-attempt-') && name.endsWith('.json')).length;
const prefix = mode + '-attempt-' + String(previous + 1).padStart(3, '0');
const result = { mode, node: process.version, events: [], pageErrors: [], outcome: 'running' };
const save = () => writeFileSync(resolve(evidence, prefix + '.json'), JSON.stringify(result, null, 2));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = resolve(repo, 'apps/cad-editor/fixtures/canonical-surface-and-curve.cad-document.json');
let server, browser, context, activePage;
let serverExited = false;

try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Use the installed Node22 runtime.');
  let cad, editor, runtimeMapPath;
  if (compiled) {
    const { prepareCompiledCheckpoint } = await import('./compiled-checkpoint.mjs');
    const checkpoint = await prepareCompiledCheckpoint({ repo, evidence });
    runtimeMapPath = checkpoint.runtimeMapPath;
    register(pathToFileURL(checkpoint.loaderPath));
    assert.equal(typeof globalThis.window, 'undefined');
    assert.equal(typeof globalThis.document, 'undefined');
    cad = await import(pathToFileURL(checkpoint.nativeCadPath));
    editor = await import(pathToFileURL(checkpoint.editorRootPath));
    result.compiledCheckpoint = checkpoint;
  } else {
    const output = resolve(evidence, 'source-native-session.mjs');
    await build({ stdin: { contents: `export * from ${JSON.stringify(resolve(repo, 'packages/barocss-cad/src/index.ts'))}; export * from ${JSON.stringify(resolve(repo, 'packages/barocss-cad-editor/src/index.ts'))};`, resolveDir: repo }, bundle: true, platform: 'node', format: 'esm', target: 'es2022', outfile: output });
    cad = editor = await import(pathToFileURL(output));
  }
  function observe(snapshot, expectedZ) {
    const accepted = snapshot.accepted;
    const surfaceRef = cad.createCadGeometryReference(accepted, { bodyId: 'surface_body' }).reference;
    const curveRef = cad.createCadGeometryReference(accepted, { bodyId: 'curve_body' }).reference;
    const surface = cad.queryCadDocumentPoint(accepted, surfaceRef, { kind: 'surface', u: 0.5, v: 0.5 }).pointMM;
    const curve = cad.queryCadDocumentPoint(accepted, curveRef, { kind: 'curve', parameter: 0.5 }).pointMM;
    [30, 20, expectedZ].forEach((value, i) => assert.ok(Math.abs(surface[i] - value) <= 1e-8, 'Independent tensor-Bernstein point mismatch.'));
    assert.deepEqual(curve, [-15, 20, -5]);
    const original = cad.resolveCadGeometryReference(accepted, surfaceRef).geometry;
    assert.equal(Object.is(original.controlPoints[0][0][1], -0), true, 'Native signed zero must remain.');
    return { surface, curve, surfaceRef, curveRef, surfaceCoefficients: original };
  }
  const pure = editor.createCadEditorSession(cad.parseCadDocument(readFileSync(fixture, 'utf8')).document);
  pure.selectSurfacePole({ bodyId: 'surface_body', uIndex: 1, vIndex: 1 });
  pure.stageSurfacePoleField('zMM', '18');
  assert.equal(pure.prepareApply(), null);
  assert.equal(pure.getSnapshot().accepted.document.revision, 0);
  assert.equal(pure.getSnapshot().history.count, 1);
  pure.stageSurfacePoleField('zMM', '24');
  const candidate = pure.prepareApply();
  candidate.result.document.assets[1].source = 'caller-mutated';
  pure.acceptCandidate(candidate.token);
  assert.notEqual(pure.getSnapshot().accepted.document.assets[1].source, 'caller-mutated');
  const staleDownload = pure.serializeAccepted();
  pure.stageSurfacePoleField('zMM', '25');
  pure.acceptCandidate(pure.prepareApply().token);
  assert.throws(() => pure.markDownloaded(staleDownload.token), error => error.code === 'STALE');
  pure.dispose(); pure.dispose();
  assert.throws(() => pure.stageSurfacePoleField('zMM', '26'), error => error.code === 'LIFECYCLE');
  if (args.includes('--draft')) {
    const selectionSession = editor.createCadEditorSession(cad.parseCadDocument(readFileSync(fixture, 'utf8')).document);
    selectionSession.selectSurfacePole({bodyId:'surface_body',uIndex:1,vIndex:1});
    selectionSession.stageSurfacePoleField('zMM','24');
    const choice = selectionSession.requestSelection({bodyId:'surface_body',uIndex:0,vIndex:1});
    choice.target.bodyId = 'curve_body';
    const privateCandidate = selectionSession.resolveSelectionTransition(choice.token, 'apply');
    const privateAccepted = selectionSession.acceptCandidate(privateCandidate.token);
    assert.equal(privateAccepted.selection.uIndex,0); assert.equal(privateAccepted.selectedBodyId,'surface_body');
    selectionSession.stageSurfacePoleField('zMM','20');
    const retry = selectionSession.requestSelection({bodyId:'surface_body',uIndex:1,vIndex:1});
    const keptCandidate = selectionSession.resolveSelectionTransition(retry.token,'apply');
    const beforeOpen = selectionSession.getSnapshot();
    assert.throws(()=>selectionSession.prepareOpen(readFileSync(fixture,'utf8')),error=>error.code==='INPUT');
    assert.deepEqual(selectionSession.getSnapshot(),beforeOpen);
    assert.throws(()=>selectionSession.prepareUndo(),error=>error.code==='INPUT');
    assert.deepEqual(selectionSession.getSnapshot(),beforeOpen);
    selectionSession.cancelCandidate(keptCandidate.token);
    assert.ok(selectionSession.getSnapshot().selectionTransition);
    selectionSession.resolveSelectionTransition(retry.token,'cancel');
    assert.equal(selectionSession.getSnapshot().pending.zMM,'20');
    selectionSession.dispose();
    result.events.push({stage:'pure-draft-decisions',privateSelectionTarget:true,openAndHistoryRefusalRetainedCandidateDraft:true,displayCancelDecisionRetained:true});
  }
  result.events.push({ stage: 'pure-root', browserGlobalsAbsent: true, candidateOwnership: true, staleDownload: true, disposedRefusal: true });

  const runtime = option('--playwright', '/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  const { chromium } = await import(pathToFileURL(runtime));
  const executablePath = option('--browser', '/Users/user/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  assert.ok(existsSync(executablePath), 'Select an already installed Chromium executable.');
  result.runtime = { playwright: runtime, executablePath };
  const require = createRequire(resolve(repo, 'package.json'));
  const vite = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
  server = spawn(process.execPath, [vite, '--force', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: resolve(repo, 'apps/cad-editor'), env: { ...process.env, ...(compiled ? { CAD_EDITOR_COMPILED_MAP: runtimeMapPath } : {}) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', bytes => { serverLog += bytes.toString(); writeFileSync(resolve(evidence, prefix + '-server.log'), serverLog); });
  server.on('exit', () => { serverExited = true; });
  const url = `http://127.0.0.1:${port}/?flow`;
  const deadline = Date.now() + 20000;
  while (true) {
    assert.equal(serverExited, false, 'The owned Vite server exited.');
    assert.ok(!serverLog.includes('already in use'), 'The port is occupied; do not connect to another Work server.');
    if (serverLog.includes(`http://127.0.0.1:${port}/`)) {
      try { if ((await fetch(url)).ok) break; } catch {}
    }
    assert.ok(Date.now() < deadline, 'Vite startup timed out.');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  result.ownedServer = {port, pid:server.pid, worktree:repo, url, childListeningConfirmed:true};
  browser = await chromium.launch({ headless: !args.includes('--headed'), executablePath });
  context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage(); activePage = page;
  page.on('pageerror', error => result.pageErrors.push(error.message));
  await page.goto(url);
  await page.locator('[data-viewer-ready="true"]').waitFor();
  await page.waitForFunction(() => window.__cadEditorFlow?.display()?.nonBackgroundPixels > 0);
  const snapshot = () => page.evaluate(() => window.__cadEditorFlow.snapshot());
  const receipt = () => page.evaluate(() => window.__cadEditorFlow.display());
  const waitGeneration = generation => page.waitForFunction(value => window.__cadEditorFlow.snapshot().generation === value && !window.__cadEditorFlow.snapshot().candidate, generation);
  await page.getByLabel('Open native document file').setInputFiles(fixture);
  await waitGeneration(1);
  await page.getByRole('button', { name: /Weighted surface Editable surface/ }).click();
  const initial = await snapshot();
  const untouchedAsset = initial.accepted.document.assets[1];
  const untouchedBody = initial.accepted.document.bodies[1];
  const untouchedModel = initial.accepted.compiledAssets[1].model;
  function curveUnchanged(value) {
    assert.deepEqual(value.accepted.document.assets[1], untouchedAsset);
    assert.deepEqual(value.accepted.document.bodies[1], untouchedBody);
    assert.deepEqual(value.accepted.compiledAssets[1].model, untouchedModel);
  }
  await page.waitForFunction(() => window.__cadEditorFlow.display()?.state.selectedGeometry?.kind === 'surface');
  const initialDisplay = await receipt();
  await page.getByTestId('cad-editor-help').click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('dialog').getByText('Editing limits', {exact:true}).waitFor();
  await page.screenshot({path:resolve(evidence,prefix+'-help.png')});
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'cad-editor-help', undefined, {timeout:3000});
  assert.equal(await page.getByTestId('cad-editor-help').evaluate(element=>element===document.activeElement),true);
  assert.equal((await receipt()).pixelHash,initialDisplay.pixelHash);
  result.events.push({stage:'contextual-help',keyboardClose:true,focusRestored:true,viewportRetained:true});
  assert.equal(initialDisplay.state.surfaces.length, 1); assert.equal(initialDisplay.state.curves.length, 1);
  assert.equal(initialDisplay.state.mmToSceneUnit, 0.01);
  await page.screenshot({ path: resolve(evidence, prefix + '-initial.png') });
  result.events.push({ stage: 'open-fixture', native: observe(initial, 70 / 9), display: initialDisplay, assetCount: 2, bodyCount: 2 });
  await page.getByTestId('cad-editor-zMM').fill('24');
  await page.getByTestId('cad-editor-weight').fill('2');
  assert.equal((await snapshot()).accepted.document.revision, 0);
  await page.getByTestId('cad-editor-apply').click(); await waitGeneration(2);
  const edited = await snapshot(); curveUnchanged(edited);
  assert.equal(edited.accepted.document.revision, 1); assert.equal(edited.accepted.document.assets[0].revision, 1);
  assert.deepEqual(edited.lastProvenance[0].changedFields, ['zMM', 'weight']);
  const editedDisplay = await receipt();
  assert.notEqual(editedDisplay.pixelHash, initialDisplay.pixelHash);
  await page.screenshot({ path: resolve(evidence, prefix + '-edited.png') });
  result.events.push({ stage: 'apply', native: observe(edited, 56 / 5), display: editedDisplay, provenance: edited.lastProvenance });

  const cameraBytes = cad.serializeCadDocument(edited.accepted.document);
  const cameraHistory = edited.history;
  const canvas = page.getByTestId('cad-editor-canvas');
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 45, bounds.y + bounds.height / 2 + 25, { steps: 5 }); await page.mouse.up();
  await page.waitForFunction(oldHash => window.__cadEditorFlow.display().pixelHash !== oldHash, editedDisplay.pixelHash);
  const cameraChanged = await snapshot();
  assert.equal(cad.serializeCadDocument(cameraChanged.accepted.document), cameraBytes); assert.deepEqual(cameraChanged.history, cameraHistory);
  result.events.push({ stage: 'camera', historyExcluded: true, fileExcluded: true, display: await receipt() });

  if (!compiled) {
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await waitGeneration(3);
    const undone = await snapshot(); curveUnchanged(undone); observe(undone, 70 / 9);
    assert.equal(undone.accepted.document.revision, 2); assert.equal(undone.accepted.document.assets[0].revision, 2);
    await page.getByRole('button', { name: 'Redo', exact: true }).click(); await waitGeneration(4);
    const redone = await snapshot(); curveUnchanged(redone); observe(redone, 56 / 5);
    assert.equal(redone.accepted.document.revision, 3); assert.equal(redone.accepted.document.assets[0].revision, 3);
    result.events.push({ stage: 'history', undoRevision: 2, redoRevision: 3, curveUnchanged: true });
    const prior = await snapshot();
    const priorFrame = await receipt();
    let lastRead = priorFrame.readIndex;
    const retainedFrame = async () => {
      await page.waitForFunction(read => window.__cadEditorFlow.display().readIndex > read, lastRead);
      const actual = await receipt(); lastRead = actual.readIndex;
      assert.equal(actual.pixelHash, priorFrame.pixelHash);
      assert.equal(actual.width, priorFrame.width); assert.equal(actual.height, priorFrame.height);
      assert.deepEqual(actual.state.camera, priorFrame.state.camera);
      assert.deepEqual(actual.state.selectedGeometry, priorFrame.state.selectedGeometry);
      return { pixelHash: actual.pixelHash, readIndex: actual.readIndex, width: actual.width, height: actual.height };
    };
    await page.getByTestId('cad-editor-weight').fill('0'); await page.getByTestId('cad-editor-apply').click();
    await page.waitForFunction(() => window.__cadEditorFlow.error()?.message.includes('Native Surface control-net edit failed'));
    await page.getByRole('alert').first().waitFor();
    const refused = await snapshot();
    assert.deepEqual(refused.accepted, prior.accepted); assert.deepEqual(refused.history, prior.history); assert.equal(refused.pending.weight, '0');
    await retainedFrame();
    result.events.push({ stage: 'weight-zero-refusal', actualNativeDiagnostic: await page.evaluate(() => window.__cadEditorFlow.error()), userMessage: await page.getByRole('alert').first().textContent(), documentHistoryFrameRetained: true });
    await page.getByTestId('cad-editor-discard').click();
    const malformed = resolve(evidence, 'malformed.cad-document.json'); writeFileSync(malformed, '{"schema":');
    await page.getByLabel('Open native document file').setInputFiles(malformed);
    await page.waitForFunction(() => window.__cadEditorFlow.error()?.message.includes('Native document Open failed'));
    assert.deepEqual((await snapshot()).accepted, prior.accepted); await retainedFrame();
    const unsupported = JSON.parse(readFileSync(fixture, 'utf8')); unsupported.assets[1].source = '@model reference_line { version:0; length-unit:mm; @curve #reference_line { type:nurbs; degree:5; knots:[0,0,0,0,0,0,1,1,1,1,1,1]; control-points:[[-15,-10,-5],[-15,0,-5],[-15,10,-5],[-15,20,-5],[-15,30,-5],[-15,50,-5]]; weights:[1,1,1,1,1,1]; } }';
    cad.createCadDocument(unsupported);
    const unsupportedPath = resolve(evidence, 'unsupported.cad-document.json'); writeFileSync(unsupportedPath, JSON.stringify(unsupported));
    await page.getByLabel('Open native document file').setInputFiles(unsupportedPath);
    await page.waitForFunction(() => window.__cadEditorFlow.error()?.code === 'DISPLAY');
    assert.deepEqual((await snapshot()).accepted, prior.accepted); await retainedFrame();
    result.events.push({ stage: 'file-refusals', malformedParserReached: true, actualUnsupportedNativePreviewRefused: true, acceptedFrameRetained: true });
    await page.getByTestId('cad-editor-zMM').fill('26');
    await page.evaluate(() => window.__cadEditorFlow.setDisplayRefusal(true));
    await page.waitForFunction(() => window.__cadEditorFlow.error()?.message.includes('Display options were refused'));
    await page.getByTestId('cad-editor-apply').click();
    await page.waitForFunction(() => window.__cadEditorFlow.error()?.message.includes('pending values remain'));
    const displayRefused = await snapshot(); assert.deepEqual(displayRefused.accepted, prior.accepted); assert.deepEqual(displayRefused.history, prior.history); assert.equal(displayRefused.pending.zMM, '26');
    await retainedFrame();
    result.events.push({ stage: 'actual-viewer-refusal', countU: 1, actualDiagnostic: await page.evaluate(() => window.__cadEditorFlow.error()), userMessage: await page.getByRole('alert').first().textContent(), documentHistoryFrameRetained: true });
    await page.evaluate(() => window.__cadEditorFlow.setDisplayRefusal(false));
    await page.getByTestId('cad-editor-discard').click();
    const stale = await page.evaluate(() => {
      const s = window.__cadEditorFlow.session; s.stageSurfacePoleField('zMM', '26'); const c = s.prepareApply(); s.stageSurfacePoleField('zMM', '27');
      try { s.acceptCandidate(c.token); return 'accepted'; } catch (error) { s.discardPending(); return error.code; }
    });
    assert.equal(stale, 'STALE'); assert.deepEqual((await snapshot()).accepted, prior.accepted);
    result.events.push({ stage: 'stale-candidate', code: stale });
  }
  await page.getByTestId('cad-editor-zMM').fill('29');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  const download = await downloadPromise;
  const downloadedPath = resolve(evidence, prefix + '-' + download.suggestedFilename()); await download.saveAs(downloadedPath);
  const downloadedBytes = readFileSync(downloadedPath, 'utf8');
  assert.equal(downloadedBytes, cad.serializeCadDocument((await snapshot()).accepted.document));
  const cold = cad.parseCadDocument(downloadedBytes);
  curveUnchanged({ accepted: cold }); observe({ accepted: cold }, 56 / 5);
  assert.equal(JSON.parse(downloadedBytes).camera, undefined); assert.equal(JSON.parse(downloadedBytes).pending, undefined);
  assert.equal((await snapshot()).pending.zMM, '29');
  result.events.push({ stage: 'genuine-download', path: downloadedPath, sha256: hash(downloadedBytes), coldNativePoint: observe({ accepted: cold }, 56 / 5), pendingExcluded: true });
  const freshContext = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, acceptDownloads: true });
  const fresh = await freshContext.newPage(); activePage = fresh; fresh.on('pageerror', error => result.pageErrors.push(error.message));
  await fresh.goto(url); await fresh.locator('[data-viewer-ready="true"]').waitFor();
  await fresh.getByLabel('Open native document file').setInputFiles(downloadedPath);
  await fresh.waitForFunction(() => window.__cadEditorFlow.snapshot().generation === 1 && !window.__cadEditorFlow.snapshot().candidate);
  await fresh.getByRole('button', { name: /Weighted surface Editable surface/ }).click();
  await fresh.getByTestId('cad-editor-zMM').fill('28'); await fresh.getByTestId('cad-editor-apply').click();
  await fresh.waitForFunction(() => window.__cadEditorFlow.snapshot().generation === 2 && !window.__cadEditorFlow.snapshot().candidate);
  const reopened = await fresh.evaluate(() => window.__cadEditorFlow.snapshot()); curveUnchanged(reopened);
  assert.equal(reopened.selection.uIndex, 1); assert.equal(reopened.selection.vIndex, 1);
  assert.equal(reopened.accepted.document.revision, cold.document.revision + 1);
  const freshDisplay = await fresh.evaluate(() => window.__cadEditorFlow.display());
  assert.ok(freshDisplay.nonBackgroundPixels > 0); assert.equal(freshDisplay.state.curves.length, 1);
  await fresh.screenshot({ path: resolve(evidence, prefix + '-fresh-reedit.png') });
  result.events.push({ stage: 'fresh-open-reedit', native: observe(reopened, 64 / 5), display: freshDisplay, curveUnchanged: true });
  if (args.includes('--draft')) {
    const { runDraftSelectionFlow } = await import('./draft-selection-flow.mjs');
    await runDraftSelectionFlow({ page: fresh, cad, result, curveUnchanged, evidence, prefix, resolve });
  }
  if (args.includes('--inventory')) {
    const { runBodyInventoryFlow } = await import('./body-inventory-flow.mjs');
    await runBodyInventoryFlow({page:fresh,cad,editor,result,evidence,prefix,resolve,repo});
  }
  const retained = await fresh.evaluate(() => window.__cadEditorFlow.snapshot());
  await fresh.evaluate(() => window.__cadEditorFlow.setMounted(false));
  await fresh.waitForFunction(() => window.__cadEditorFlow.display()?.state.status === 'disposed');
  const disposal = await fresh.evaluate(() => window.__cadEditorFlow.display());
  assert.deepEqual(disposal.lifecycle, { mounts: 1, disposals: 1 });
  assert.deepEqual(await fresh.evaluate(() => window.__cadEditorFlow.snapshot()), retained);
  await fresh.evaluate(() => window.__cadEditorFlow.setMounted(true));
  await fresh.locator('[data-viewer-ready="true"]').waitFor();
  assert.deepEqual(await fresh.evaluate(() => window.__cadEditorFlow.snapshot()), retained);
  result.events.push({ stage: 'unmount-remount', disposal: disposal.lifecycle, hostSessionRetained: true, display: await fresh.evaluate(() => window.__cadEditorFlow.display()) });
  await freshContext.close();
  assert.deepEqual(result.pageErrors, []);
  result.outcome = 'passed'; save();
  process.stdout.write(JSON.stringify({ mode, outcome: result.outcome, stages: result.events.map(event => event.stage), evidence: resolve(evidence, prefix + '.json') }) + '\n');
} catch (error) {
  if (activePage) {
    try { result.failureWindowState = await activePage.evaluate(() => ({activeElement:{tag:document.activeElement?.tagName,testId:document.activeElement?.getAttribute('data-testid')},error:window.__cadEditorFlow?.error(),snapshot:window.__cadEditorFlow?.snapshot(),display:window.__cadEditorFlow?.display()})); await activePage.screenshot({path:resolve(evidence,prefix+'-failure.png')}); } catch {}
  }
  result.outcome = 'failed'; result.failure = { message: error.message, stack: error.stack }; save();
  process.stderr.write(error.stack + '\n'); process.exitCode = 1;
} finally {
  await context?.close(); await browser?.close();
  if (server && !serverExited) {
    server.kill('SIGTERM');
    await new Promise(resolve => { server.once('exit', resolve); setTimeout(resolve, 2000); });
  }
}
