import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

// Root runs this bounded real-browser gate after the fixture/exporter are complete.
const args = process.argv.slice(2), option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
assert(args.includes('--evidence'), 'Usage: node current-v29-svg-flow.mjs --evidence ABSOLUTE_DIR [--compiled] [--headed] [--executable CHROME]');
assert.equal(Number(process.versions.node.split('.')[0]), 22);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const mode = args.includes('--compiled') ? 'compiled' : 'source';
const evidence = resolve(option('--evidence'));
await mkdir(evidence, { recursive: true });
const attempt = resolve(evidence, mode + '-' + new Date().toISOString().replaceAll(':', '-') + '-' + process.pid);
await mkdir(attempt);
const receipt = { mode, node: process.version, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  browserMode: args.includes('--headed') ? 'headed' : 'headless', stages: [], downloads: [], pageErrors: [], consoleErrors: [], httpFailures: [], outcome: 'running',
  priorFailure: { rootFirst: 'source-2026-10-10T14-55-28.453Z-91125/receipt.json', symptom: 'ready timeout/console404/stages0', staticCause: 'Consumer fixture import pointed at absent repo examples; actual file is package examples/canvas2d-scene. Corrected module path only; ready predicate remains mandatory.', journal: 'First Root receipt remains unchanged; this runner adds startup/HTTP failure visibility, not an acceptance waiver.' } };
let activePage;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let server, browser, context;
const save = () => writeFile(resolve(attempt, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
try {
  await save();
  const entry = resolve(repo, 'packages/barocss-canvas2d', mode === 'source' ? 'src/index.ts' : 'dist/index.js');
  const runtime = await build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, write: false,
    format: 'esm', platform: 'browser', target: 'es2022', metafile: true });
  const inputs = Object.keys(runtime.metafile.inputs);
  const ownSource = inputs.filter(path => /packages\/barocss-canvas2d\/src\//.test(path));
  const ownDist = inputs.filter(path => /packages\/barocss-canvas2d\/dist\//.test(path));
  if (mode === 'source') { assert(ownSource.length > 0); assert.equal(ownDist.length, 0); }
  else { assert(ownDist.length > 0); assert.equal(ownSource.length, 0); }
  receipt.delivery = { ownSource, ownDist, publicEntry: entry, runtimeSHA256: hash(runtime.outputFiles[0].contents), sourceFallbacks: 0 };
  await writeFile(resolve(attempt, 'runtime-metafile.json'), JSON.stringify(runtime.metafile, null, 2) + '\n');
  await writeFile(resolve(attempt, 'public-runtime.mjs'), runtime.outputFiles[0].contents);
  const htmlPath = '/packages/barocss-canvas2d/consumer/current-v29-svg.html';
  const html = (await readFile(resolve(repo, '.' + htmlPath), 'utf8')).replace('"../dist/index.js"', '"/985-public-runtime.mjs"');
  server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (path === htmlPath) { response.setHeader('Content-Type', 'text/html'); response.end(html); return; }
      if (path === '/985-public-runtime.mjs') { response.setHeader('Content-Type', 'text/javascript'); response.end(runtime.outputFiles[0].contents); return; }
      const file = resolve(repo, '.' + path);
      if (!file.startsWith(repo + sep) || !(await stat(file)).isFile()) { response.writeHead(404); response.end(); return; }
      response.setHeader('Content-Type', ({ '.mjs': 'text/javascript', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.html': 'text/html' })[extname(file)] ?? 'application/octet-stream');
      response.end(await readFile(file));
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  const { chromium } = await import(option('--playwright', '/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
  const executablePath = option('--executable', '/Users/user/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  browser = await chromium.launch({ executablePath, headless: !args.includes('--headed'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  context = await browser.newContext({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage(); activePage = page; page.setDefaultTimeout(30000);
  page.on('pageerror', error => receipt.pageErrors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) receipt.httpFailures.push({ url: response.url(), status: response.status() }); });
  page.on('requestfailed', request => receipt.httpFailures.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('console', message => { if (message.type() === 'error') receipt.consoleErrors.push(message.text()); });
  await page.goto('http://127.0.0.1:' + server.address().port + htmlPath);
  await page.waitForFunction(() => {
    const startup = window.__currentSVGStartup;
    if (startup?.error) throw Error('Host startup failed: ' + startup.error.message);
    const state = window.__currentSVGConsumer?.observe();
    if (state?.failure) throw Error('Host failed: ' + state.failure);
    return document.documentElement.dataset.svgReady === 'ready' && state?.ready;
  });
  const capture = async label => {
    const value = await page.evaluate(() => window.__currentSVGConsumer.observe());
    assert.equal(value.failure, null, label + ' host failure');
    assert(value.contexts.every(row => row.errors.length === 0), label + ' GL errors');
    receipt.stages.push({ label, ...value }); return value;
  };
  const checkRoundtrip = value => {
    assert(value.opened && value.comparison, 'Actual imported retained tree missing');
    assert.equal(value.original.scene.version, 29, 'Current public tree');
    assert.equal(value.opened.scene.version, 29, 'Imported Scene5 is retained through current public tree');
    assert.equal(value.original.samples.length, value.opened.samples.length);
    for (let i = 0; i < value.original.samples.length; i++) {
      const a = value.original.samples[i], b = value.opened.samples[i];
      assert.equal(a.hit, a.expectedHitId, a.name + ' original hit oracle');
      assert.equal(b.hit, a.expectedHitId, a.name + ' opened hit oracle');
      assert(a.rgba.every((v, c) => Math.abs(v - b.rgba[c]) <= 2), a.name + ' actual RGBA difference > 2');
    }
  };
  const download = async number => {
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download SVG', exact: true }).click()]);
    const path = resolve(attempt, 'download-' + number + '.svg'); await file.saveAs(path);
    const bytes = await readFile(path), state = await capture('download-' + number);
    assert.equal(bytes.toString('utf8'), state.lastSVG, 'Physical download bytes differ from accepted export');
    receipt.downloads.push({ path, bytes: bytes.length, sha256: hash(bytes) }); return path;
  };
  const upload = async (path, number) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open SVG', exact: true }).click()]);
    await chooser.setFiles(path);
    await page.waitForFunction(n => { const state = window.__currentSVGConsumer.observe();
      if (state.failure) throw Error('File Open failed: ' + state.failure);
      return state.opens === n;
    }, number);
    const state = await capture('physical-open-' + number); checkRoundtrip(state);
    assert.equal(state.openedSVG, (await readFile(path)).toString('utf8'));
    assert.equal(state.lifecycle.uploads, number); return state;
  };
  await capture('ready');
  const first = await download(1), firstBytes = await readFile(first);
  const initial = await upload(first, 1);
  const clickSample = initial.original.samples.find(sample => sample.expectedHitId !== null);
  assert(clickSample, 'Meaningful painted hit sample required');
  for (const id of ['original', 'opened']) {
    const box = await page.locator('#' + id).boundingBox(); assert(box);
    // Account for the actual CSS border; logical canvas content is 320x220.
    await page.mouse.click(box.x + 1 + clickSample.point.x, box.y + 1 + clickSample.point.y);
  }
  const pointerState = await capture('actual-pointer-input');
  assert.equal(pointerState.pointers.length, 2); assert(pointerState.pointers.every(p => p.trusted && p.hit === clickSample.expectedHitId));
  await page.getByRole('button', { name: 'Edit original paint', exact: true }).click();
  const edited = await capture('original-edit'); assert.equal(edited.revision, 1);
  assert.notDeepEqual(edited.original.scene, initial.original.scene); assert.deepEqual(edited.opened.scene, initial.opened.scene);
  const second = await download(2); assert.notEqual((await readFile(second)).toString('utf8'), firstBytes.toString('utf8'));
  const reopened = await upload(second, 2); assert.equal(reopened.firstSVG, firstBytes.toString('utf8'));
  assert.equal(hash(await readFile(first)), hash(firstBytes), 'Original downloaded SVG mutated');
  const beforeRefusal = await capture('before-refusal');
  await page.getByRole('button', { name: 'Refuse unsupported export', exact: true }).click();
  const refused = await capture('unsupported-refusal'); assert(refused.refusal?.retained && refused.refusal.fullFramesEqual);
  assert.deepEqual(refused.original, beforeRefusal.original); assert.deepEqual(refused.opened, beforeRefusal.opened);
  assert.equal(refused.firstSVG, beforeRefusal.firstSVG);
  await page.screenshot({ path: resolve(attempt, 'two-canvases.png'), fullPage: true });
  const box = await page.locator('#original').boundingBox();
  await page.getByRole('button', { name: 'Dispose', exact: true }).click();
  await page.mouse.click(box.x + 1 + clickSample.point.x, box.y + 1 + clickSample.point.y);
  const final = await capture('dispose-and-late-pointer');
  assert(final.disposed); assert.equal(final.activeRenderers, 0); assert.equal(final.lifecycle.creates, final.lifecycle.disposes);
  assert.equal(final.lifecycle.binds, final.lifecycle.unbinds); assert.equal(final.pointers.length, 2);
  assert(final.contexts.every(row => Object.values(row.resources).every(r => r.live === 0 && r.created === r.deleted)), 'Real GL allocation cleanup');
  assert.equal(receipt.pageErrors.length, 0); assert.equal(receipt.consoleErrors.length, 0); assert.equal(receipt.httpFailures.length, 0);
  receipt.acceptance = { physicalDownloads: 2, physicalChooserUploads: 2, boundedPixelTolerance: 2,
    retainedScene29: true, immutableFirstSVG: true, actualTrustedPointers: 2, unsupportedPreservesBothFrames: true,
    noMockedGL: true, finalLifecycleBalanced: true, scope: 'One solid group/path Scene29 fixture only; importer Scene5 normalization explicit, no general SVG/culling/device parity' };
  receipt.outcome = 'passed';
} catch (error) {
  receipt.outcome = 'failed'; receipt.firstFailure = { message: error.message, stack: error.stack };
  if (activePage && !activePage.isClosed()) receipt.hostAtFailure = await activePage.evaluate(() => ({
    startup: window.__currentSVGStartup ?? null, readyMarker: document.documentElement.dataset.svgReady ?? null,
    status: document.querySelector('#status')?.textContent, consumer: window.__currentSVGConsumer?.observe() ?? null
  })).catch(error => ({ captureError: String(error) }));
  process.exitCode = 1;
} finally {
  await context?.close().catch(() => {}); await browser?.close().catch(() => {});
  if (server) await new Promise(accept => server.close(accept));
  receipt.cleanup = { browserClosed: !!browser, ownedServerClosed: !!server };
  await save(); console.log(JSON.stringify({ outcome: receipt.outcome, mode, receipt: resolve(attempt, 'receipt.json'), firstFailure: receipt.firstFailure }));
}
