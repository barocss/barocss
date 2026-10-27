// CHROME=/path/to/chrome PW_DIR=/path/to/playwright node --test tests/viewer-render-target-browser.test.mjs
// GPU_RENDER_TARGET_EVIDENCE_DIR preserves the result, screenshots, and first failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/', import.meta.url));

test('render targets preserve independent pixels and reject stale ownership and lifetime', { timeout: 180000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR required'); return; }
  const server = createServer(async (req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><style>body{background:#222;color:white;font:14px sans-serif}#c,#other{width:194px;height:146px}#frames{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}figure canvas{display:block;width:291px;height:219px;image-rendering:pixelated}</style><canvas id="c" width="97" height="73"></canvas><canvas id="other" width="97" height="73"></canvas><div id="frames"></div>');
      return;
    }
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const base = req.url?.startsWith('/cad/') ? cad : dist;
    const file = resolve(base, '.' + (base === cad ? req.url.slice(4) : (req.url ?? '')));
    if (!file.startsWith(base)) { res.writeHead(404); res.end(); return; }
    try { res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(file)); }
    catch { res.writeHead(404); res.end(); }
  });
  let browser, page, evidence;
  const errors = [];
  try {
    if (process.env.GPU_RENDER_TARGET_EVIDENCE_DIR) {
      await mkdir(process.env.GPU_RENDER_TARGET_EVIDENCE_DIR, { recursive: true });
      evidence = await mkdtemp(join(process.env.GPU_RENDER_TARGET_EVIDENCE_DIR, 'render-target-'));
      t.diagnostic(`evidence: ${evidence}`);
    }
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    if (!await page.evaluate(async () => !!await navigator.gpu?.requestAdapter())) { t.skip('no WebGPU adapter'); return; }
    const result = await page.evaluate(async () => {
      const { createViewer } = await import('/viewer/index.js');
      const reports = [];
      const options = { controls: false, autoResize: false, antialias: false, pixelRatio: 1, background: '#202020',
        camera: { position: [0,0,5], target: [0,0,0], up: [0,1,0], projection: 'orthographic', fovY: 2 * Math.atan(2 / 5) * 180 / Math.PI },
        lights: [], environment: { sky: '#000000', ground: '#000000', ambient: 0, toneMapping: 'none' }, onRequestRender: () => {}, onError: message => reports.push(message) };
      const viewer = await createViewer(document.getElementById('c'), options);
      const other = await createViewer(document.getElementById('other'), options);
      const targets = [];
      const keep = (label, frame) => {
        const figure = document.createElement('figure'), caption = document.createElement('figcaption'), canvas = document.createElement('canvas');
        canvas.width = frame.width; canvas.height = frame.height; caption.textContent = label;
        canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
        figure.append(caption, canvas); document.getElementById('frames').append(figure);
      };
      const pixel = (image, x, y) => [...image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];
      const difference = (a, b) => {
        let changedBytes = 0, maxDelta = 0;
        for (let i = 0; i < a.data.length; i++) { if (a.data[i] !== b.data[i]) changedBytes++; maxDelta = Math.max(maxDelta, Math.abs(a.data[i] - b.data[i])); }
        return { changedBytes, maxDelta };
      };
      const error = async action => { try { await action(); return null; } catch (e) { return { code: e.code ?? null, name: e.name, message: e.message }; } };
      // Override only the JS-visible limits/canvas width during the synchronous admission call.
      // The real device remains in use; no oversized canvas backing store or large GPU texture is allocated.
      const admission = async kind => {
        const device = viewer.computeDevice, canvas = document.getElementById('c');
        const oldWidth = Object.getOwnPropertyDescriptor(canvas, 'width'), oldLimits = Object.getOwnPropertyDescriptor(device, 'limits');
        const oldCreate = Object.getOwnPropertyDescriptor(device, 'createTexture'), nativeCreate = device.createTexture;
        const restore = (object, key, descriptor) => descriptor ? Object.defineProperty(object, key, descriptor) : delete object[key];
        const maxDimension = device.limits.maxTextureDimension2D, rowBytes = Math.ceil(canvas.width * 4 / 256) * 256;
        let textureCalls = 0, caught = null, unexpectedTarget = null;
        device.pushErrorScope('validation');
        try {
          Object.defineProperty(device, 'createTexture', { configurable: true, value: function (...args) { textureCalls++; return Reflect.apply(nativeCreate, this, args); } });
          if (kind === 'dimension') Object.defineProperty(canvas, 'width', { configurable: true, get: () => maxDimension + 1 });
          else Object.defineProperty(device, 'limits', { configurable: true, value: { maxTextureDimension2D: maxDimension, maxBufferSize: rowBytes * canvas.height - 1 } });
          try { unexpectedTarget = viewer.createRenderTarget(); } catch (e) { caught = { code: e.code ?? null, name: e.name, message: e.message }; }
        } finally {
          unexpectedTarget?.dispose();
          restore(canvas, 'width', oldWidth); restore(device, 'limits', oldLimits); restore(device, 'createTexture', oldCreate);
        }
        const validation = await device.popErrorScope();
        return { caught, textureCalls, validation: validation?.message ?? null, width: canvas.width, height: canvas.height };
      };
      // Let the actual GPU map finish first. Hold only its consumer continuation, then change public state.
      // This controlled boundary proves the continuation guard, not the frequency of natural GPU delays.
      const controlledRead = async (target, mutate) => {
        const descriptor = Object.getOwnPropertyDescriptor(GPUBuffer.prototype, 'mapAsync');
        if (!descriptor || typeof descriptor.value !== 'function') throw new Error('GPUBuffer.mapAsync descriptor is not callable');
        let release, ready, rejectReady, heldBuffer, calls = 0;
        const gate = new Promise(resolve => { release = resolve; });
        const nativeDone = new Promise((resolve, reject) => { ready = resolve; rejectReady = reject; });
        const native = descriptor.value;
        Object.defineProperty(GPUBuffer.prototype, 'mapAsync', { ...descriptor, value: function (...args) {
          const promise = Reflect.apply(native, this, args);
          if (calls || this.label !== 'viewer target readback') return promise;
          calls++; heldBuffer = this;
          return promise.then(value => { ready({ state: this.mapState, label: this.label }); return gate.then(() => value); }, reason => { rejectReady(reason); throw reason; });
        } });
        try {
          const pending = error(() => target.read());
          const nativeMap = await Promise.race([nativeDone, pending.then(outcome => { throw new Error(`Target read ended before its GPU map: ${JSON.stringify(outcome)}`); })]);
          await mutate();
          release();
          const outcome = await pending;
          return { calls, nativeMap, outcome, after: heldBuffer?.mapState ?? null };
        } finally {
          release();
          Object.defineProperty(GPUBuffer.prototype, 'mapAsync', descriptor);
        }
      };
      try {
        const dimensionAdmission = await admission('dimension'), bufferAdmission = await admission('buffer');
        const mesh = viewer.add({ positions: [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0], normals: [0,0,1, 0,0,1, 0,0,1, 0,0,1], indices: [0,1,2,0,2,3] }, { material: { color: '#ff0000', unlit: true, doubleSided: true } });
        const a = viewer.createRenderTarget(), b = viewer.createRenderTarget(); targets.push(a, b);
        const unread = await error(() => a.read());
        const foreign = await error(() => other.render(a));
        const forged = await error(() => viewer.render({}));
        viewer.render(a);
        const aRed = await a.read(), canvasRed = await viewer.capture();
        keep('Target A · red', aRed); keep('Canvas · red', canvasRed);
        mesh.material = { color: '#0000ff' };
        viewer.render(b);
        const bBlue = await b.read(), aAfterBlue = await a.read();
        keep('Target B · blue', bBlue); keep('Target A · still red', aAfterBlue);
        let frameDone = false;
        const framesBeforeTarget = viewer.stats.frames;
        const frame = viewer.frame().then(() => { frameDone = true; });
        viewer.render(a);
        const framesAfterTarget = viewer.stats.frames;
        await viewer.computeDevice.queue.onSubmittedWorkDone();
        const frameDoneBeforeCanvas = frameDone;
        viewer.render();
        await frame;
        const framesAfterCanvas = viewer.stats.frames;
        const frameDoneAfterAwait = frameDone, aBlue = await a.read(), bAfterA = await b.read();
        const beforeResize = viewer.createRenderTarget(); targets.push(beforeResize); viewer.render(beforeResize);
        const pendingResize = await controlledRead(beforeResize, () => viewer.setSize(101, 73));
        const resizedRenderError = await error(() => viewer.render(beforeResize));
        const resizedReadError = await error(() => beforeResize.read());
        viewer.setSize(97, 73);
        const restoredRead = await beforeResize.read();
        const pendingDisposeTarget = viewer.createRenderTarget(); targets.push(pendingDisposeTarget); viewer.render(pendingDisposeTarget);
        const pendingDispose = await controlledRead(pendingDisposeTarget, () => { pendingDisposeTarget.dispose(); pendingDisposeTarget.dispose(); });
        const disposedRender = await error(() => viewer.render(pendingDisposeTarget));
        const disposedRead = await error(() => pendingDisposeTarget.read());
        const losing = viewer.createRenderTarget(); targets.push(losing); viewer.render(losing);
        const pendingLoss = await controlledRead(losing, async () => {
          const oldDevice = viewer.computeDevice; viewer.loseDeviceForTesting();
          await oldDevice.lost;
          // The loss handler is registered before this continuation; wait for its actual recovery when present.
          if (viewer.recovery) await viewer.recovery;
        });
        const lostRead = await error(() => losing.read());
        const lostRender = await error(() => viewer.render(losing));
        const replacement = viewer.createRenderTarget(); targets.push(replacement); viewer.render(replacement);
        const restoredDeviceImage = await replacement.read();
        const otherTarget = other.createRenderTarget(); targets.push(otherTarget); other.render(otherTarget);
        const pendingViewerDispose = await controlledRead(otherTarget, () => other.dispose());
        viewer.dispose();
        const disposedViewerRead = await error(() => replacement.read());
        const disposedViewerRender = await error(() => viewer.render(replacement));
        return {
          size: [aRed.width, aRed.height], redCenter: pixel(aRed, 48, 36), redCorner: pixel(aRed, 1, 1), blueCenter: pixel(bBlue, 48, 36),
          targetCanvas: difference(aRed, canvasRed), targetAUnchanged: difference(aRed, aAfterBlue), targetBAfterA: difference(bBlue, bAfterA),
          targetAChangedAfterRedraw: difference(aRed, aBlue), restoredSize: [restoredRead.width, restoredRead.height], restoredDeviceSize: [restoredDeviceImage.width, restoredDeviceImage.height],
          unread, foreign, forged, pendingResize, resizedRenderError, resizedReadError, pendingDispose, pendingViewerDispose, disposedRender, disposedRead, pendingLoss, lostRead, lostRender, disposedViewerRead, disposedViewerRender,
          dimensionAdmission, bufferAdmission, frameDoneBeforeCanvas, frameDoneAfterAwait, framesBeforeTarget, framesAfterTarget, framesAfterCanvas, reports,
        };
      } finally { for (const target of targets) target.dispose(); viewer.dispose(); other.dispose(); }
    });
    result.errors = errors;
    t.diagnostic(JSON.stringify(result));
    if (evidence) {
      await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2) + '\n');
      await page.screenshot({ path: join(evidence, 'images.png'), fullPage: true });
    }
    assert.deepEqual(result.size, [97, 73]);
    assert.deepEqual(result.redCorner, [32, 32, 32, 255]);
    assert.ok(result.redCenter[0] > 245 && result.redCenter[1] < 5 && result.redCenter[2] < 5 && result.redCenter[3] === 255, `red ${result.redCenter}`);
    assert.ok(result.blueCenter[2] > 245 && result.blueCenter[0] < 5 && result.blueCenter[1] < 5 && result.blueCenter[3] === 255, `blue ${result.blueCenter}`);
    for (const key of ['targetCanvas', 'targetAUnchanged', 'targetBAfterA']) assert.equal(result[key].changedBytes, 0, `${key} preserves all RGBA bytes, including padded rows`);
    assert.ok(result.targetAChangedAfterRedraw.changedBytes > 0, 'rendering A again changes its pixels');
    for (const key of ['dimensionAdmission', 'bufferAdmission']) {
      assert.equal(result[key].caught?.code, 'SIZE_INVALID', `${key} rejects exceeding a device limit`);
      assert.equal(result[key].textureCalls, 0, `${key} rejects before allocating a GPU texture`);
      assert.equal(result[key].validation, null); assert.deepEqual([result[key].width, result[key].height], [97, 73]);
    }
    for (const key of ['unread', 'foreign', 'forged']) assert.equal(result[key]?.code, 'TEXTURE_INVALID', `${key} rejects invalid ownership or unread target`);
    for (const key of ['resizedRenderError', 'resizedReadError']) assert.equal(result[key]?.code, 'SIZE_INVALID', `${key} rejects resized target`);
    for (const key of ['disposedRender', 'disposedRead', 'disposedViewerRead', 'disposedViewerRender']) assert.equal(result[key]?.code, 'DISPOSED', `${key} rejects disposed lifetime`);
    for (const [key, code] of [['pendingResize', 'SIZE_INVALID'], ['pendingDispose', 'DISPOSED'], ['pendingViewerDispose', 'DISPOSED'], ['pendingLoss', 'DEVICE_LOST']]) {
      assert.equal(result[key].calls, 1, `${key} invokes the actual GPU map once`);
      assert.equal(result[key].nativeMap.state, 'mapped', `${key} holds only after actual native map completion`);
      assert.equal(result[key].outcome?.code, code, `${key} refuses stale data after the controlled boundary`);
    }
    for (const key of ['lostRead', 'lostRender']) assert.equal(result[key]?.code, 'DEVICE_LOST', `${key} rejects an observed lost device`);
    assert.deepEqual(result.restoredSize, [97, 73]); assert.deepEqual(result.restoredDeviceSize, [97, 73]);
    assert.equal(result.frameDoneBeforeCanvas, false); assert.equal(result.frameDoneAfterAwait, true);
    assert.equal(result.framesAfterTarget, result.framesBeforeTarget + 1); assert.equal(result.framesAfterCanvas, result.framesAfterTarget + 1);
    assert.deepEqual(result.reports, []); assert.deepEqual(errors, []);
  } catch (error) {
    if (evidence) {
      await writeFile(join(evidence, 'first-error.json'), JSON.stringify({ name: error.name, message: error.message, stack: error.stack, errors }, null, 2) + '\n');
      if (page && !page.isClosed()) await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {});
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(r => server.close(r));
  }
});
