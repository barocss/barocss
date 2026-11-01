// CHROME=/path/to/chrome PW_DIR=/path/to/playwright node --test tests/viewer-render-target-size-browser.test.mjs
// GPU_RENDER_TARGET_SIZE_EVIDENCE_DIR preserves the result, screenshots and first failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/', import.meta.url));

test('explicit render-target sizes preserve aspect, canvas and effects while alternating outputs', { timeout: 180000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR required'); return; }
  const server = createServer(async (req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><style>body{background:#222;color:white;font:14px sans-serif}#c{width:101px;height:101px}#frames{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}figure canvas{display:block;max-width:280px;max-height:280px;image-rendering:pixelated}</style><canvas id="c" width="101" height="101"></canvas><div id="frames"></div>');
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
    if (process.env.GPU_RENDER_TARGET_SIZE_EVIDENCE_DIR) {
      await mkdir(process.env.GPU_RENDER_TARGET_SIZE_EVIDENCE_DIR, { recursive: true });
      evidence = await mkdtemp(join(process.env.GPU_RENDER_TARGET_SIZE_EVIDENCE_DIR, 'render-target-size-'));
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
      const { createViewer } = await import('/viewer/index.js'), canvas = document.getElementById('c');
      const reports = [], base = { sky: '#000000', ground: '#000000', ambient: 0, toneMapping: 'none' };
      const viewer = await createViewer(canvas, { controls: false, autoResize: false, antialias: false, pixelRatio: 1,
        background: '#202020', lights: [], camera: { position: [0,0,5], target: [0,0,0], up: [0,1,0], projection: 'orthographic', fovY: 2 * Math.atan(2.5 / 5) * 180 / Math.PI },
        environment: base, onRequestRender: () => {}, onError: message => reports.push(message) });
      const targets = [];
      const keep = (label, frame) => {
        const figure = document.createElement('figure'), caption = document.createElement('figcaption'), image = document.createElement('canvas');
        image.width = frame.width; image.height = frame.height; caption.textContent = label;
        image.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
        figure.append(caption, image); document.getElementById('frames').append(figure);
      };
      const difference = (a, b) => {
        let changedBytes = 0, maxDelta = 0;
        for (let i = 0; i < a.data.length; i++) { if (a.data[i] !== b.data[i]) changedBytes++; maxDelta = Math.max(maxDelta, Math.abs(a.data[i] - b.data[i])); }
        return { changedBytes, maxDelta };
      };
      const bounds = frame => {
        let x0 = frame.width, x1 = -1, y0 = frame.height, y1 = -1, count = 0;
        for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
          const i = (y * frame.width + x) * 4, d = frame.data;
          if (d[i] > 230 && d[i+1] < 20 && d[i+2] < 20) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); count++; }
        }
        return { x0, x1, y0, y1, width: x1 - x0 + 1, height: y1 - y0 + 1, count };
      };
      const error = action => { try { action(); return null; } catch (e) { return { code: e.code ?? null, name: e.name, message: e.message }; } };
      const pixel = (frame, x, y) => [...frame.data.slice((y * frame.width + x) * 4, (y * frame.width + x) * 4 + 4)];
      const cyan = frame => { let count = 0; for (let i = 0; i < frame.data.length; i += 4) if (frame.data[i] < 80 && frame.data[i+1] > 100 && frame.data[i+2] > 100) count++; return count; };
      try {
        const mesh = viewer.add({ positions: [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0], normals: [0,0,1, 0,0,1, 0,0,1, 0,0,1], indices: [0,1,2,0,2,3] }, { material: { color: '#ff0000', unlit: true, doubleSided: true } });
        const device = viewer.computeDevice, max = device.limits.maxTextureDimension2D;
        const badOptions = [{ width: 0, height: 1 }, { width: -1, height: 1 }, { width: 1.5, height: 1 }, { width: NaN, height: 1 }, { width: Infinity, height: 1 }, { width: 1 }, { height: 1 }, { width: max + 1, height: 1 }, { width: 1n, height: 1 }, { width: 1, height: 1n }, { width: Symbol('width'), height: 1 }, { width: 1, height: Symbol('height') }];
        const oldCreate = Object.getOwnPropertyDescriptor(device, 'createTexture'), nativeCreate = device.createTexture;
        let invalidAllocations = 0, invalid;
        device.pushErrorScope('validation');
        try {
          Object.defineProperty(device, 'createTexture', { configurable: true, value: function (...args) { invalidAllocations++; return Reflect.apply(nativeCreate, this, args); } });
          invalid = badOptions.map(options => error(() => viewer.createRenderTarget(options)));
        } finally {
          if (oldCreate) Object.defineProperty(device, 'createTexture', oldCreate); else delete device.createTexture;
        }
        const invalidValidation = await device.popErrorScope();
        const landscape = viewer.createRenderTarget({ width: 181, height: 97 });
        const portrait = viewer.createRenderTarget({ width: 97, height: 181 });
        const tiny = viewer.createRenderTarget({ width: 1, height: 1 });
        const defaultTarget = viewer.createRenderTarget(); targets.push(landscape, portrait, tiny, defaultTarget);
        const cameraBefore = structuredClone(viewer.camera.state()), aspectBefore = viewer.aspect;
        const canvasBefore = await viewer.capture(), hitBefore = await viewer.pick(50,50), planesBefore = [viewer.camera.near, viewer.camera.far];
        viewer.render(landscape); const pendingLandscape = landscape.read();
        viewer.render(portrait);
        const cameraAfter = structuredClone(viewer.camera.state()), planesAfter = [viewer.camera.near, viewer.camera.far], aspectAfter = viewer.aspect;
        viewer.render();
        const a = await pendingLandscape, b = await portrait.read(); viewer.render(tiny); const one = await tiny.read();
        const canvasAfter = await viewer.capture(), hitAfter = await viewer.pick(50,50);
        keep('Landscape · 181 × 97', a); keep('Portrait · 97 × 181', b); keep('Canvas · 101 × 101', canvasAfter);
        mesh.material = { color: '#0000ff' }; viewer.render(landscape);
        const blue = await landscape.read(), bAfterBlue = await portrait.read();
        mesh.material = { color: '#ff0000' };
        viewer.clipPlane = { normal: [1,0,0], offset: 0, cap: '#ffd34d' }; mesh.outline = '#00ffff';
        const translucent = viewer.add({ positions: [0.1,-0.6,0.2, 0.8,-0.6,0.2, 0.8,0.6,0.2, 0.1,0.6,0.2], normals: [0,0,1, 0,0,1, 0,0,1, 0,0,1], indices: [0,1,2,0,2,3] }, { material: { color: '#0000ff', unlit: true, opacity: 0.5, doubleSided: true } });
        const box = viewer.add({ positions: [-0.4,0.4,-0.3, 0.4,0.4,-0.3, 0.4,0.9,-0.3, -0.4,0.9,-0.3, -0.4,0.4,0.3, 0.4,0.4,0.3, 0.4,0.9,0.3, -0.4,0.9,0.3],
          normals: [0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1],
          indices: [0,2,1, 0,3,2, 4,5,6, 4,6,7, 0,1,5, 0,5,4, 1,2,6, 1,6,5, 2,3,7, 2,7,6, 3,0,4, 3,4,7] },
          { cap: true, material: { color: '#ffbb55', unlit: true } });
        viewer.shadowMapSize = 128; viewer.lights = [{ kind: 'directional', direction: [-1,-1,-2], castShadow: true, intensity: 1 }];
        viewer.render(landscape); const plainA = await landscape.read();
        viewer.render(portrait); const plainB = await portrait.read();
        const plainCanvas = await viewer.capture();
        viewer.environment = { ...base, bloom: { strength: 0.3, threshold: 0.2 }, depthOfField: { focus: 4, blur: 8 }, ambientOcclusion: { radius: 0.5, strength: 0.7 }, contactShadows: { length: 0.3, strength: 0.5 } };
        viewer.render(landscape); viewer.render(portrait);
        const fxA = await landscape.read(), fxB = await portrait.read(), fxCanvas = await viewer.capture();
        viewer.render(portrait); viewer.render(landscape);
        const fxBRepeat = await portrait.read(), fxARepeat = await landscape.read(), fxCanvasRepeat = await viewer.capture();
        keep('Landscape · clip, cap, outline, transparency and post effects', fxA);
        keep('Portrait · clip, cap, outline, transparency and post effects', fxB);
        const targetBeforeResize = await landscape.read();
        viewer.setSize(111,99);
        const defaultResize = error(() => viewer.render(defaultTarget));
        const storedAfterResize = await landscape.read(); viewer.render(landscape); const rerenderAfterResize = await landscape.read();
        const canvasResized = await viewer.capture();
        translucent.remove(); box.remove();
        return { sizes: [[a.width,a.height],[b.width,b.height],[one.width,one.height],[canvasBefore.width,canvasBefore.height],[canvasResized.width,canvasResized.height]],
          shape: { landscape: bounds(a), portrait: bounds(b), canvas: bounds(canvasBefore) },
          corner: pixel(a,0,0), tinyAlpha: one.data[3], cameraBefore, cameraAfter, planesBefore, planesAfter, aspectBefore, aspectAfter,
          canvasPreserved: difference(canvasBefore,canvasAfter), hitBefore: hitBefore?.mesh === mesh, hitAfter: hitAfter?.mesh === mesh,
          portraitPreserved: difference(b,bAfterBlue), landscapeChanged: difference(a,blue),
          fxChanged: { landscape: difference(plainA,fxA), portrait: difference(plainB,fxB), canvas: difference(plainCanvas,fxCanvas) },
          fxRepeated: { landscape: difference(fxA,fxARepeat), portrait: difference(fxB,fxBRepeat), canvas: difference(fxCanvas,fxCanvasRepeat) }, outlinePixels: { landscape: cyan(plainA), portrait: cyan(plainB) },
          clipped: { landscapeLeft: pixel(plainA, Math.floor(plainA.width / 2) - 8, Math.floor(plainA.height / 2)), landscapeRight: pixel(plainA, Math.floor(plainA.width / 2) + 8, Math.floor(plainA.height / 2)) },
          defaultResize, explicitStoredAfterResize: difference(targetBeforeResize,storedAfterResize), explicitRerenderAfterResize: difference(targetBeforeResize,rerenderAfterResize), invalid, invalidAllocations, invalidValidation: invalidValidation?.message ?? null, reports };
      } finally { for (const target of targets) target.dispose(); viewer.dispose(); }
    });
    result.errors = errors;
    t.diagnostic(JSON.stringify(result));
    if (evidence) {
      await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2) + '\n');
      await page.screenshot({ path: join(evidence, 'images.png'), fullPage: true });
    }
    assert.deepEqual(result.sizes, [[181,97],[97,181],[1,1],[101,101],[111,99]]);
    for (const [name, height] of [['landscape',97], ['portrait',181], ['canvas',101]]) {
      const b = result.shape[name], expected = height * 0.4;
      assert.ok(b.count > 0 && Math.abs(b.width - b.height) <= 2, `${name}: square is not stretched: ${JSON.stringify(b)}`);
      assert.ok(Math.abs(b.width - expected) <= 2 && Math.abs(b.height - expected) <= 2, `${name}: size is based on the target's height: ${JSON.stringify(b)}`);
    }
    assert.deepEqual(result.corner, [32,32,32,255]); assert.equal(result.tinyAlpha, 255);
    assert.deepEqual(result.cameraBefore, result.cameraAfter); assert.deepEqual(result.planesBefore, result.planesAfter); assert.equal(result.aspectBefore, 1); assert.equal(result.aspectAfter, 1);
    assert.equal(result.canvasPreserved.changedBytes, 0); assert.equal(result.hitBefore, true); assert.equal(result.hitAfter, true);
    assert.equal(result.portraitPreserved.changedBytes, 0); assert.ok(result.landscapeChanged.changedBytes > 0);
    for (const key of ['landscape','portrait','canvas']) {
      assert.ok(result.fxChanged[key].changedBytes > 0, `${key}: post effects change pixels`);
      assert.equal(result.fxRepeated[key].changedBytes, 0, `${key}: post effects survive switching target sizes`);
    }
    assert.ok(result.outlinePixels.landscape > 0 && result.outlinePixels.portrait > 0, 'outlined pixels exist at both target sizes');
    assert.ok(result.clipped.landscapeLeft[0] < 80 && result.clipped.landscapeRight[0] > 100, 'clip uses the target projection');
    assert.equal(result.defaultResize?.code, 'SIZE_INVALID');
    assert.equal(result.explicitStoredAfterResize.changedBytes, 0); assert.equal(result.explicitRerenderAfterResize.changedBytes, 0);
    assert.equal(result.invalid.length, 12); assert.ok(result.invalid.every(x => x?.code === 'SIZE_INVALID'));
    assert.equal(result.invalidAllocations, 0); assert.equal(result.invalidValidation, null); assert.deepEqual(result.reports, []); assert.deepEqual(errors, []);
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
