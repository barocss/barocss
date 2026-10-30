// D324: real public GPU pick with only a native mapAsync fulfilled return held.
// No readback contents, render submission, draw commands or result values are substituted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), packageRoot = path.resolve(here, '..');
const dist = path.join(packageRoot, 'dist/viewer');
const html = '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#202020}canvas{display:block;width:320px;height:240px}</style><canvas id="c"></canvas>';

async function serve() {
  const files = new Map((await readdir(dist, { recursive: true })).filter(file => file.endsWith('.js')).map(file => [`/viewer/${file.split(path.sep).join('/')}`, path.join(dist, file)]));
  files.set('/core/barocss-error.js', path.join(dist, '../core/barocss-error.js'));
  const server = createServer(async (request, response) => {
    if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    if (request.url === '/') { response.writeHead(200, { 'content-type': 'text/html' }); response.end(html); return; }
    const file = files.get(request.url ?? '');
    if (!file) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(await readFile(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

// This helper observes only one native pick buffer per arm. Original native receiver/args/results stay intact.
function installNativeReadbackHold() {
  const prototype = GPUBuffer.prototype, nativeMap = prototype.mapAsync, nativeUnmap = prototype.unmap, nativeRange = prototype.getMappedRange;
  let armed = false, selected = null, releaseHold;
  const events = [];
  const log = (kind, data = {}) => events.push({ sequence: events.length, kind, ...data });
  prototype.mapAsync = async function (...args) {
    const claimed = armed && this.label === 'pick read' && this.size === 768 && args[0] === GPUMapMode.READ;
    if (claimed) { armed = false; selected = { buffer: this, fulfilled: false, released: false, unmaps: 0, ranges: 0, arguments: args.slice() }; log('native-map-start', { label: this.label, size: this.size, arguments: args.slice() }); }
    const result = await nativeMap.apply(this, args);
    if (claimed) {
      selected.fulfilled = true; log('native-map-fulfilled');
      await new Promise(resolve => { releaseHold = resolve; });
      selected.released = true; log('native-map-return-released');
    }
    return result;
  };
  prototype.getMappedRange = function (...args) {
    const result = nativeRange.apply(this, args);
    if (this === selected?.buffer) { selected.ranges++; log('native-getMappedRange', { arguments: args.slice() }); }
    return result;
  };
  prototype.unmap = function (...args) {
    const result = nativeUnmap.apply(this, args);
    if (this === selected?.buffer) { selected.unmaps++; log('native-unmap'); }
    return result;
  };
  window.__d324 = {
    arm() { if (armed || (selected && !selected.released)) throw new Error('Only one selected native map may be pending'); selected = null; releaseHold = undefined; armed = true; log('arm'); },
    release() { if (!releaseHold) throw new Error('Native map must fulfill before release'); log('release-requested'); releaseHold(); },
    snapshot() { return { armed, selected: selected && { fulfilled: selected.fulfilled, released: selected.released, unmaps: selected.unmaps, ranges: selected.ranges, arguments: selected.arguments }, events: events.slice() }; },
  };
}

test('D324 public pick rejects changed instance ownership after native GPU readback', { timeout: 180000 }, async t => {
  assert.ok(process.env.CHROME && process.env.PW_DIR && process.env.D324_ARTIFACT_DIR, 'CHROME, PW_DIR and D324_ARTIFACT_DIR required; no silent skip');
  const output = process.env.D324_ARTIFACT_DIR; await mkdir(output, { recursive: true });
  const sources = [];
  for (const file of ['src/viewer/viewer.ts', 'src/viewer/scene.ts', 'dist/viewer/viewer.js', 'dist/viewer/scene.js']) {
    const bytes = await readFile(path.join(packageRoot, file)); sources.push({ path: path.join(packageRoot, file), sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const report = { status: 'RUNNING', runnerProcess: process.pid, worktree: path.resolve(packageRoot, '../..'), sources, cases: [], errors: [], boundary: 'Native mapAsync fulfilled-return schedule only. Counts are native buffer cleanup observations, not driver bytes, VRAM, performance or OOM proof.' };
  const persist = () => writeFile(path.join(output, 'receipt.json'), JSON.stringify(report, null, 2));
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = await serve(); let browser, context, page;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    context = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 }); page = await context.newPage();
    page.on('pageerror', error => report.errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    await page.goto(server.url);
    const adapter = await page.evaluate(async () => { const adapter = await navigator.gpu?.requestAdapter(); return adapter ? { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture } : null; });
    if (!adapter) { report.status = 'SKIP_NO_NATIVE_ADAPTER'; await persist(); t.skip('No actual WebGPU adapter; no native proof'); return; }
    report.adapter = adapter; report.browser = browser.version();
    await page.evaluate(installNativeReadbackHold);
    for (const name of ['unchanged', 'matrix-replacement', 'reorder', 'shrink', 'instances-null', 'mesh-removal']) {
      const positive = await page.evaluate(async () => {
        const api = await import('/viewer/index.js'), canvas = document.querySelector('canvas');
        const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#202020', camera: { position: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0] } });
        const geometry = viewer.createGeometry({ positions: [-0.4, -0.35, 0, 0.4, -0.35, 0, 0, 0.45, 0], indices: [0, 1, 2], faces: [71] });
        const options = { name: 'original', material: { color: '#ff4020', unlit: true, doubleSided: true }, instances: { transforms: [...api.translation([-0.8, 0, 0]), ...api.translation([0.8, 0, 0])] } };
        const mesh = viewer.add(geometry, options);
        const screen = point => { const m = viewer.camera.viewProjection(viewer.aspect), q = [0, 1, 3].map(k => m[k] * point[0] + m[4 + k] * point[1] + m[8 + k] * point[2] + m[12 + k]); return [(q[0] / q[2] * 0.5 + 0.5) * canvas.clientWidth, (0.5 - q[1] / q[2] * 0.5) * canvas.clientHeight]; };
        const summarize = hit => hit && { mesh: hit.mesh.name, instance: hit.instance, triangle: hit.triangle, face: hit.face, point: hit.point, depth: hit.depth };
        window.__d324Scene = { api, viewer, geometry, mesh, options, screen, summarize };
        await viewer.frame(); const capture = await viewer.capture(), at = screen([0.8, 0, 0]);
        const offset = (Math.floor(at[1]) * capture.width + Math.floor(at[0])) * 4;
        return { pixel: [...capture.data.slice(offset, offset + 4)], hit: summarize(await viewer.pick(...at)), size: [capture.width, capture.height] };
      });
      const record = { name, positive }; report.cases.push(record); await persist();
      try {
        assert.equal(positive.hit?.instance, 1, 'actual positive pick must hit original instance 1'); assert.equal(positive.hit.face, 71); assert.equal(positive.hit.triangle, 0);
        assert.ok(positive.pixel[0] > positive.pixel[1] + 80, 'actual red rendered pixels must cover the picked triangle');
        if (name === 'unchanged') await page.locator('canvas').screenshot({ path: path.join(output, 'native-positive.png') });
        await page.evaluate(() => { window.__d324.arm(); const scene = window.__d324Scene; scene.pending = scene.viewer.pick(...scene.screen([0.8, 0, 0])); });
        await page.waitForFunction(() => window.__d324.snapshot().selected?.fulfilled === true, null, { timeout: 15000 });
        record.held = await page.evaluate(name => {
          const scene = window.__d324Scene, { api, mesh, viewer } = scene;
          if (name === 'matrix-replacement') mesh.setInstances({ transforms: [...api.translation([-0.8, 0, 0]), ...api.translation([1.2, 0, 0])] });
          else if (name === 'reorder') mesh.setInstances({ transforms: [...api.translation([0.8, 0, 0]), ...api.translation([-0.8, 0, 0])] });
          else if (name === 'shrink') mesh.setInstances({ transforms: api.translation([-0.8, 0, 0]) });
          else if (name === 'instances-null') mesh.setInstances(null);
          else if (name === 'mesh-removal') viewer.remove(mesh);
          return window.__d324.snapshot();
        }, name);
        await persist(); await page.evaluate(() => window.__d324.release());
        record.delayed = await page.evaluate(async () => { const scene = window.__d324Scene; return scene.summarize(await scene.pending); });
        record.afterDelayed = await page.evaluate(() => window.__d324.snapshot()); await persist();
        if (name === 'unchanged') { assert.equal(record.delayed?.instance, 1); assert.equal(record.delayed.face, 71); }
        else assert.equal(record.delayed, null, 'changed public ownership must reject the actual stale GPU hit');
        assert.equal(record.afterDelayed.selected.unmaps, 1, 'selected native read buffer must unmap exactly once before next pick');
        record.fresh = await page.evaluate(async name => {
          const scene = window.__d324Scene; let at = [0.8, 0, 0];
          if (name === 'matrix-replacement') at = [1.2, 0, 0];
          else if (name === 'shrink') at = [-0.8, 0, 0];
          else if (name === 'instances-null') at = [0, 0, 0];
          else if (name === 'mesh-removal') scene.replacement = scene.viewer.add(scene.geometry, { ...scene.options, name: 'replacement' });
          await scene.viewer.frame(); return scene.summarize(await scene.viewer.pick(...scene.screen(at)));
        }, name);
        record.afterFresh = await page.evaluate(() => window.__d324.snapshot()); await persist();
        assert.equal(record.fresh?.face, 71); assert.equal(record.fresh.triangle, 0);
        assert.equal(record.fresh.instance, name === 'instances-null' ? null : ['shrink', 'reorder'].includes(name) ? 0 : 1);
        assert.equal(record.fresh.mesh, name === 'mesh-removal' ? 'replacement' : 'original');
        assert.ok(record.fresh.point.every(Number.isFinite)); assert.ok(Number.isFinite(record.fresh.depth));
        assert.equal(record.afterFresh.selected.unmaps, 2, 'next public pick must reuse and unmap the native buffer successfully');
        record.status = 'PASS'; await persist();
        if (name === 'mesh-removal') await page.locator('canvas').screenshot({ path: path.join(output, 'native-fresh-after-removal.png') });
      } finally {
        record.cleanup = await page.evaluate(async () => { const scene = window.__d324Scene, hold = window.__d324.snapshot(); if (hold.selected?.fulfilled && !hold.selected.released) window.__d324.release();
          try { await scene.pending; } catch { /* original failure retained by the test */ }
          scene.viewer.dispose(); delete window.__d324Scene; return 'OWN_VIEWER_DISPOSED'; }); await persist();
      }
    }
    assert.deepEqual(report.errors, []); report.status = 'PASS'; await persist();
  } catch (error) { report.status = 'FAIL'; report.failure = { message: error.message, stack: error.stack }; await persist(); throw error; }
  finally {
    if (context) await context.close(); if (browser) await browser.close(); await server.close();
    report.cleanup = 'OWN_CONTEXT_BROWSER_SERVER_CLOSED'; await persist();
  }
});
