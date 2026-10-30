// D325 final: actual SDK clipping, closed boundaries, unit conversion and native Core GPU pick.
// Baseline source capsules remain immutable. Native readback values and GPU results are never substituted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');
const html = '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}canvas{display:block;width:320px;height:240px}</style><canvas id="c" width="320" height="240"></canvas>';

test('D325 SDK displayed clipping agrees with public CPU pick', { timeout: 180000 }, async t => {
  assert.ok(process.env.CHROME && process.env.PW_DIR && process.env.VIEWER_D325_ARTIFACT_DIR, 'Actual Chrome, Playwright and artifact directory required; no silent skip');
  const output = process.env.VIEWER_D325_ARTIFACT_DIR; await mkdir(output, { recursive: true });
  const report = { status: 'RUNNING', baseline: 'd85558ce0031d812341d5871743f8535520eb8d4', worktree: root, runnerProcess: process.pid, samples: [], errors: [], fixture: 'Original audit/audit_patch public authored square packet, not a user file or Studio UI-generated document.', pickPath: 'Public SDK CPU pick plus public Core GPU pick; supported base raster only' };
  const persist = () => writeFile(path.join(output, 'receipt.json'), JSON.stringify(report, null, 2));
  let server, browser, context, page, phase = 'source bundle', measured = false;
  try {
    const critical = [];
    for (const name of ['packages/barocss-viewer/src/index.ts', 'packages/barocss-viewer/src/presenter.ts', 'packages/barocss-gpu/src/viewer/viewer.ts', 'packages/barocss-gpu/src/viewer/scene.ts', 'packages/barocss-gpu/src/viewer/camera.ts', 'packages/barocss-gpu/src/viewer/shaders/pick.ts']) {
      const bytes = await readFile(path.join(root, name)); critical.push({ path: name, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    const bundle = await build({ stdin: { contents: `export { createViewer } from ${JSON.stringify(path.join(here, '../src/index.ts'))}; export { createViewer as createCore, identity } from ${JSON.stringify(path.join(root, 'packages/barocss-gpu/src/viewer/index.ts'))};`, resolveDir: root, sourcefile: 'd325-native-entry.ts' }, bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', metafile: true });
    report.bundle = { critical, inputCount: Object.keys(bundle.metafile.inputs).length, sha256: createHash('sha256').update(bundle.outputFiles[0].contents).digest('hex'), source: 'Current worktree SDK source esbuild; no dist rebuild or source patch' }; await persist();
    server = createServer((request, response) => {
      if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      if (request.url === '/') { response.writeHead(200, { 'content-type': 'text/html' }); response.end(html); return; }
      if (request.url === '/viewer.js') { response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(bundle.outputFiles[0].contents); return; }
      response.writeHead(404); response.end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    context = await browser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 }); page = await context.newPage();
    page.on('pageerror', error => report.errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    report.browser = browser.version();
    report.adapter = await page.evaluate(async () => { const adapter = await navigator.gpu?.requestAdapter(); return adapter ? { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture } : null; });
    if (!report.adapter) { report.status = 'SKIP_NO_NATIVE_ADAPTER'; await persist(); t.skip('No actual WebGPU adapter; no native clipping proof'); return; }
    for (const scale of [1, 0.001]) {
      phase = `public authored packet admission at scale ${scale}`;
      await page.evaluate(async scale => {
        window.__d325?.viewer.dispose();
        const { createViewer } = await import('/viewer.js'), background = [0.035, 0.055, 0.09];
        const packet = { version: 0, surfaceId: 'audit_patch', revision: 0, lengthUnit: 'mm', coordinateSystem: 'right-handed-z-up', winding: 'ccw',
          positions: scale === 1 ? [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0] : [-1000,-1000,0, 1000,-1000,0, 1000,1000,0, -1000,1000,0],
          normals: [0,0,1, 0,0,1, 0,0,1, 0,0,1], indices: [0,1,2, 0,2,3], parameters: [0,0, 1,0, 1,1, 0,1],
          bounds: scale === 1 ? { min: [-1,-1,0], max: [1,1,0] } : { min: [-1000,-1000,0], max: [1000,1000,0] } };
        const viewer = await createViewer(document.querySelector('canvas'), { mmToSceneUnit: scale, background });
        window.__d325 = { viewer, background }; viewer.setPackets([{ modelId: 'audit', packet }]);
      }, scale);
      for (const [label, near, far, visible] of [['control', 0.01, 100, true], ['near-excludes', 7, 100, false], ['far-excludes', 0.01, 5, false], ['closed-near', 6, 12, true], ['closed-far', 3, 6, true], ['restored', 0.01, 100, true]]) {
        phase = `observe ${label} at scale ${scale}`;
        const sample = await page.evaluate(async ({ label, near, far, scale, visible }) => {
          const { viewer, background } = window.__d325, camera = { eye: [0,0,6], target: [0,0,0], up: [0,1,0], fovY: 45, near, far };
          viewer.setView(camera); const pixels = await viewer.readPixels(), bg = background.map(value => Math.round(value * 255)); let covered = 0;
          for (let i = 0; i < pixels.length; i += 4) if (Math.abs(pixels[i] - bg[0]) + Math.abs(pixels[i + 1] - bg[1]) + Math.abs(pixels[i + 2] - bg[2]) > 12) covered++;
          return { label, scale, expectedVisible: visible, requestedCamera: camera, byteLength: pixels.length, covered,
            centerRGBA: Array.from(pixels.slice((120 * 320 + 160) * 4, (120 * 320 + 160) * 4 + 4)), pick: viewer.pick(160, 120) };
        }, { label, near, far, scale, visible });
        report.samples.push(sample); await persist();
        await page.locator('canvas').screenshot({ path: path.join(output, `${scale === 1 ? 'scene' : 'scaled'}-${label}.png`) });
        if (label === 'control') {
          assert.ok(sample.covered > 100 && sample.pick !== null, 'actual visible control must render and return a public CPU hit');
          assert.ok(Math.abs(sample.pick.distanceScene - 6) < 1e-8, 'positive public CPU hit must retain depth-six scene distance');
        }
      }
    }
    measured = true;
    report.mismatches = report.samples.filter(sample => sample.expectedVisible ? !(sample.covered > 100 && sample.pick !== null) : !(sample.covered === 0 && sample.pick === null));
    report.status = report.mismatches.length ? 'SDK_CLIPPING_CONTRACT_FAIL' : 'SDK_OBSERVATIONS_COMPLETE'; await persist();
    phase = 'safe SDK clipping assertions after all native observations';
    for (const sample of report.samples) {
      if (sample.expectedVisible) { assert.ok(sample.covered > 100, `${sample.label}: closed interval square must display`); assert.ok(sample.pick, `${sample.label}: square must be CPU selectable`); assert.ok(Math.abs(sample.pick.distanceScene - 6) < 1e-8); }
      else { assert.equal(sample.pick, null, `${sample.label}: excluded square must not be CPU selectable`); assert.equal(sample.covered, 0, `${sample.label}: CPU-excluded square must also be absent from actual display`); }
    }
    phase = 'actual Core automatic and exact-far duplicate-instance picking';
    report.core = await page.evaluate(async () => {
      window.__d325.viewer.dispose(); delete window.__d325;
      const { createCore, identity } = await import('/viewer.js'), core = await createCore(document.querySelector('canvas'), { controls: false, autoResize: false, pixelRatio: 1, background: '#202020', camera: { position: [0,0,6], target: [0,0,0], up: [0,1,0] } });
      core.environment = { ambientOcclusion: false, contactShadows: false };
      core.add({ positions: [-1,-1,0, 1,-1,0, 0,1,0], indices: [0,1,2], faces: [71] }, { name: 'duplicates', material: { color: '#ff4020', unlit: true, doubleSided: true }, instances: { transforms: [...identity(), ...identity()] } });
      const summarize = hit => hit && { mesh: hit.mesh.name, face: hit.face, instance: hit.instance, triangle: hit.triangle, depth: hit.depth, point: hit.point };
      window.__d325Core = { core, summarize };
      await core.frame(); const automatic = summarize(await core.pick(160, 120));
      const automaticCamera = { near: core.camera.near, farValue: String(core.camera.far), farFinite: Number.isFinite(core.camera.far), autoClip: core.camera.autoClip };
      Object.assign(core.camera, { autoClip: false, near: 3, far: 6 });
      await core.frame(); const manual = summarize(await core.pick(160, 120));
      return { automatic, manual, automaticCamera, camera: { near: core.camera.near, far: core.camera.far, autoClip: core.camera.autoClip } };
    });
    await persist(); await page.locator('canvas').screenshot({ path: path.join(output, 'core-exact-far.png') });
    assert.equal(report.core.automatic?.instance, 0, 'default strict-depth first hit of equal instances must be instance0');
    assert.equal(report.core.automatic.face, 71);
    assert.equal(report.core.manual?.depth, 0, 'exact finite far plane retains original raw zero readback depth');
    assert.equal(report.core.manual.face, 71); assert.equal(report.core.manual.instance, 0); assert.equal(report.core.manual.triangle, 0);
    phase = 'native fulfilled readback held across autoClip-only change';
    await page.evaluate(() => {
      const prototype = GPUBuffer.prototype, nativeMap = prototype.mapAsync, nativeUnmap = prototype.unmap;
      const observation = { fulfilled: false, released: false, unmaps: 0, arguments: null }; let selected, release;
      const hold = new Promise(resolve => { release = resolve; });
      prototype.mapAsync = async function (...args) {
        const claimed = !selected && this.label === 'pick read' && this.size === 768 && args[0] === GPUMapMode.READ;
        if (claimed) { selected = { buffer: this }; observation.arguments = args.slice(); }
        const result = await nativeMap.apply(this, args);
        if (claimed) { observation.fulfilled = true; await hold; observation.released = true; }
        return result;
      };
      prototype.unmap = function (...args) { const result = nativeUnmap.apply(this, args); if (this === selected?.buffer) observation.unmaps++; return result; };
      window.__d325Hold = { observation, release: () => release?.(), restore: () => { prototype.mapAsync = nativeMap; prototype.unmap = nativeUnmap; } };
      const scene = window.__d325Core; scene.pending = scene.core.pick(160, 120);
    });
    await page.waitForFunction(() => window.__d325Hold.observation.fulfilled === true, null, { timeout: 15000 });
    report.cameraGuard = await page.evaluate(() => {
      const camera = window.__d325Core.core.camera, before = { near: camera.near, far: camera.far, autoClip: camera.autoClip };
      camera.autoClip = true;
      return { before, afterToggle: { near: camera.near, far: camera.far, autoClip: camera.autoClip }, held: { ...window.__d325Hold.observation } };
    }); await persist();
    await page.evaluate(() => window.__d325Hold.release());
    report.cameraGuard.delayed = await page.evaluate(async () => { const scene = window.__d325Core; return scene.summarize(await scene.pending); });
    report.cameraGuard.afterDelayed = await page.evaluate(() => ({ ...window.__d325Hold.observation })); await persist();
    assert.equal(report.cameraGuard.before.near, report.cameraGuard.afterToggle.near); assert.equal(report.cameraGuard.before.far, report.cameraGuard.afterToggle.far);
    assert.equal(report.cameraGuard.delayed, null, 'autoClip-only pending camera change must reject old native hit'); assert.equal(report.cameraGuard.afterDelayed.unmaps, 1);
    report.cameraGuard.fresh = await page.evaluate(async () => { const scene = window.__d325Core; scene.core.camera.autoClip = false; return scene.summarize(await scene.core.pick(160, 120)); });
    report.cameraGuard.afterFresh = await page.evaluate(() => ({ ...window.__d325Hold.observation })); await persist();
    assert.equal(report.cameraGuard.fresh?.depth, 0); assert.equal(report.cameraGuard.fresh.face, 71); assert.equal(report.cameraGuard.fresh.instance, 0); assert.equal(report.cameraGuard.afterFresh.unmaps, 2);
    assert.deepEqual(report.errors, []); report.status = 'SAFE_CONTRACT_PASS'; await persist();
  } catch (error) {
    report.failureClass = measured ? 'SAFE_CLIPPING_CONTRACT_FAILURE' : 'SETUP_OR_POSITIVE_CONTROL_FAILURE'; if (!measured) report.status = 'SETUP_OR_POSITIVE_CONTROL_FAILURE';
    report.failure = { phase, message: error.message, stack: error.stack }; await persist(); throw error;
  } finally {
    if (page && !page.isClosed()) await page.evaluate(async () => { if (window.__d325Hold) { window.__d325Hold.release(); try { await window.__d325Core?.pending; } catch { /* first failure retained */ } window.__d325Hold.restore(); } window.__d325?.viewer.dispose(); window.__d325Core?.core.dispose(); }).catch(error => { report.errors.push(`Viewer cleanup: ${error}`); });
    if (context) await context.close(); if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
    report.cleanup = 'OWN_VIEWER_CONTEXT_BROWSER_SERVER_CLOSED'; await persist();
  }
});
