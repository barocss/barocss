// CHROME=/path/to/chrome PW_DIR=/path/to/playwright node --test tests/viewer-render-target-texture-browser.test.mjs
// GPU_RENDER_TARGET_TEXTURE_EVIDENCE_DIR saves the first failure and screenshots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/', import.meta.url));

test('render target as a live sRGB colour map: pixels, ownership, feedback and lifetime', { timeout: 180000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR required'); return; }
  const server = createServer(async (req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><style>body{background:#222;color:white;font:16px sans-serif}canvas{width:256px;height:256px;image-rendering:pixelated}#frames{display:flex;gap:1em}figure{margin:0}</style><canvas id="view" width="96" height="96"></canvas><canvas id="other" width="96" height="96"></canvas><div id="frames"></div>'); return;
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
    if (process.env.GPU_RENDER_TARGET_TEXTURE_EVIDENCE_DIR) {
      await mkdir(process.env.GPU_RENDER_TARGET_TEXTURE_EVIDENCE_DIR, { recursive: true });
      evidence = await mkdtemp(join(process.env.GPU_RENDER_TARGET_TEXTURE_EVIDENCE_DIR, 'render-target-texture-'));
      t.diagnostic(`evidence: ${evidence}`);
    }
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    if (!await page.evaluate(async () => !!await navigator.gpu?.requestAdapter())) { t.skip('no WebGPU adapter'); return; }
    const result = await page.evaluate(async () => {
      const { createViewer } = await import('/viewer/index.js');
      const reports = [], viewers = [], targets = [];
      const options = { controls: false, autoResize: false, antialias: false, pixelRatio: 1, background: '#000000', lights: [],
        camera: { position: [0,0,5], target: [0,0,0], up: [0,1,0], projection: 'orthographic', fovY: 2 * Math.atan(2 / 5) * 180 / Math.PI },
        environment: { sky: '#000000', ground: '#000000', ambient: 0, toneMapping: 'none' }, onRequestRender: () => {}, onError: message => reports.push(message) };
      const quad = (x0,y0,x1,y1) => ({ positions: [x0,y0,0,x1,y0,0,x1,y1,0,x0,y1,0], normals: [0,0,1,0,0,1,0,0,1,0,0,1], uvs: [0,1,1,1,1,0,0,0], indices: [0,1,2,0,2,3] });
      const pixel = (frame,x,y) => [...frame.data.slice((y * frame.width + x) * 4, (y * frame.width + x) * 4 + 4)];
      const points = [[24,24],[72,24],[24,72],[72,72]];
      const sample = frame => points.map(([x,y]) => pixel(frame,x,y));
      const keep = (label, frame) => {
        const figure = document.createElement('figure'), caption = document.createElement('figcaption'), image = document.createElement('canvas');
        caption.textContent = label; image.width = frame.width; image.height = frame.height;
        image.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
        figure.append(caption, image); document.getElementById('frames').append(figure);
      };
      const err = action => { try { action(); return null; } catch (e) { return { code: e.code ?? null, name: e.name, message: e.message }; } };
      const asyncErr = async action => { try { await action(); return null; } catch (e) { return { code: e.code ?? null, name: e.name, message: e.message }; } };
      try {
        const viewer = await createViewer(document.getElementById('view'), options); viewers.push(viewer);
        const other = await createViewer(document.getElementById('other'), { ...options, background: 'transparent' }); viewers.push(other);
        const device = viewer.computeDevice, otherDevice = other.computeDevice;
        device.pushErrorScope('validation'); otherDevice.pushErrorScope('validation');
        const a = viewer.createRenderTarget({ width: 96, height: 96 }), b = viewer.createRenderTarget({ width: 96, height: 96 }); targets.push(a,b);
        const blank = viewer.createRenderTarget({ width: 96, height: 96 }); targets.push(blank);
        const source = [
          viewer.add(quad(-2,0,0,2), { material: { color: '#ff0000', unlit: true, doubleSided: true } }),
          viewer.add(quad(0,0,2,2), { material: { color: '#00ff00', unlit: true, doubleSided: true } }),
          viewer.add(quad(-2,-2,0,0), { material: { color: '#0000ff', unlit: true, doubleSided: true } }),
          viewer.add(quad(0,-2,2,0), { material: { color: '#808080', unlit: true, doubleSided: true } })
        ];
        const consumer = viewer.add(quad(-2,-2,2,2), { visible: false, material: { color: '#ffffff', unlit: true, doubleSided: true } });
        const showSource = visible => { for (const mesh of source) mesh.visible = visible; consumer.visible = !visible; };
        viewer.render(a); const first = await a.read(), map = a.asTexture();
        showSource(false); consumer.material = { map }; viewer.render(b); const sampled = await b.read();
        keep('Source A · first', first); keep('Material B · first', sampled);
        const feedback = err(() => viewer.render(a));
        const afterFeedback = await a.read(); viewer.render(b); const afterRecovery = await b.read();
        const unrendered = err(() => { consumer.material = { map: blank.asTexture() }; viewer.render(b); });
        consumer.material = { map };
        showSource(true); source[0].material = { color: '#0000ff' }; viewer.render(a); const updated = await a.read();
        showSource(false); viewer.render(b); const sampledUpdated = await b.read();
        keep('Source A · changed', updated); keep('Material B · changed', sampledUpdated);
        // A map created for an opaque frame must be checked again after the source changes.
        showSource(true); viewer.setBackground('transparent'); viewer.render(a);
        showSource(false); const becameTransparent = err(() => viewer.render(b));
        showSource(true); viewer.setBackground('#000000'); viewer.render(a);
        showSource(false); viewer.render(b); const afterOpaqueRestore = await b.read();
        const pathTrace = await asyncErr(async () => { const session = await viewer.createPathTrace(); session.dispose(); });
        const dataMaps = ['normalMap', 'roughnessMap', 'metallicMap'].map(slot => err(() => { consumer.material = { [slot]: map }; }));
        const environment = viewer.environment;
        const environmentMap = err(() => { viewer.environment = { ...environment, map }; viewer.render(b); });
        viewer.environment = environment;
        const foreign = err(() => { const mesh = other.add(quad(-2,-2,2,2), { material: { map, unlit: true, doubleSided: true } }); try { other.render(); } finally { mesh.remove(); } });
        const transparent = other.createRenderTarget({ width: 96, height: 96 }); targets.push(transparent);
        const transparentFrame = err(() => { other.render(transparent); const tm = transparent.asTexture(); const mesh = other.add(quad(-2,-2,2,2), { material: { map: tm, unlit: true, doubleSided: true } }); try { other.render(); } finally { mesh.remove(); } });
        a.dispose();
        const disposed = err(() => viewer.render(b));
        const disposedAccessor = err(() => a.asTexture());
        const validation = [await device.popErrorScope(), await otherDevice.popErrorScope()].map(e => e?.message ?? null);
        // Exercise the actual animation-frame scheduler in a separate owned viewer.
        const autoCanvas = document.createElement('canvas'); autoCanvas.width = 96; autoCanvas.height = 96; document.body.append(autoCanvas);
        const autoReports = [];
        const auto = await createViewer(autoCanvas, { ...options, onRequestRender: undefined, onError: message => autoReports.push(message) }); viewers.push(auto);
        const producer = auto.add(quad(-2,-2,2,2), { material: { color: '#ff0000', unlit: true, doubleSided: true } });
        const receiver = auto.add(quad(-2,-2,2,2), { visible: false, material: { color: '#ffffff', unlit: true, doubleSided: true } });
        const timedFrame = () => Promise.race([
          auto.frame().then(() => ({ code: 'OK' }), e => ({ code: e.code ?? null, name: e.name, message: e.message })),
          new Promise(resolve => setTimeout(() => resolve({ code: 'TIMEOUT' }), 5000))
        ]);
        const prepareAutoTarget = async () => {
          receiver.visible = false; producer.visible = true;
          const target = auto.createRenderTarget(); targets.push(target); auto.render(target);
          producer.visible = false; receiver.material = { map: target.asTexture() }; receiver.visible = true;
          const initial = await timedFrame();
          if (initial.code !== 'OK') throw new Error(`The initial automatic frame failed: ${JSON.stringify(initial)}`);
          return target;
        };
        const autoFailure = async action => {
          const reportStart = autoReports.length;
          await action();
          const outcomes = await Promise.all([timedFrame(), timedFrame()]);
          const report = autoReports.slice(reportStart);
          receiver.material = { map: null };
          const recovery = await timedFrame();
          return { outcomes, report, recovery };
        };
        const toDispose = await prepareAutoTarget();
        const autoDisposed = await autoFailure(() => toDispose.dispose());
        await prepareAutoTarget();
        const autoResize = await autoFailure(() => auto.setSize(97,96));
        auto.setSize(96,96);
        const toTransparent = await prepareAutoTarget();
        const autoTransparent = await autoFailure(() => {
          receiver.visible = false; producer.visible = true; auto.setBackground('transparent'); auto.render(toTransparent);
          producer.visible = false; receiver.visible = true;
        });
        auto.setBackground('#000000');
        const toLose = await prepareAutoTarget(), oldDevice = auto.computeDevice;
        const autoLoss = await autoFailure(async () => {
          auto.loseDeviceForTesting(); await oldDevice.lost;
          if (auto.recovery) await auto.recovery;
        });
        const lostAccessor = err(() => toLose.asTexture());
        return { first: sample(first), sampled: sample(sampled), afterFeedback: sample(afterFeedback), afterRecovery: sample(afterRecovery), updated: sample(updated), sampledUpdated: sample(sampledUpdated), afterOpaqueRestore: sample(afterOpaqueRestore), feedback, unrendered, foreign, transparentFrame, becameTransparent, environmentMap, disposed, disposedAccessor, pathTrace, dataMaps, validation, reports, autoDisposed, autoResize, autoTransparent, autoLoss, lostAccessor };
      } finally { for (const target of targets) target.dispose(); for (const viewer of viewers) viewer.dispose(); }
    });
    result.errors = errors;
    t.diagnostic(JSON.stringify(result));
    if (evidence) { await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2) + '\n'); await page.screenshot({ path: join(evidence, 'images.png'), fullPage: true }); }
    const expected = [[255,0,0,255],[0,255,0,255],[0,0,255,255],[128,128,128,255]];
    const near = (actual, want, label) => actual.forEach((p,i) => p.forEach((v,c) => assert.ok(Math.abs(v-want[i][c]) <= 3, `${label}[${i}][${c}]: ${v} != ${want[i][c]}`)));
    near(result.first, expected, 'source'); near(result.sampled, expected, 'sampled');
    near(result.afterFeedback, expected, 'source after feedback'); near(result.afterRecovery, expected, 'sample after feedback');
    const changed = [[0,0,255,255], ...expected.slice(1)]; near(result.updated, changed, 'updated source'); near(result.sampledUpdated, changed, 'updated sampled');
    near(result.afterOpaqueRestore, changed, 'sample after opaque frame restored');
    for (const name of ['feedback','unrendered','foreign','transparentFrame','becameTransparent','environmentMap']) assert.equal(result[name]?.code, 'TEXTURE_INVALID', `${name}: ${JSON.stringify(result[name])}`);
    assert.equal(result.disposed?.code, 'DISPOSED'); assert.equal(result.disposedAccessor?.code, 'DISPOSED'); assert.equal(result.pathTrace?.code, 'PATH_TRACE_UNSUPPORTED');
    assert.ok(result.dataMaps.every(error => error?.code === 'TEXTURE_INVALID'), `data maps: ${JSON.stringify(result.dataMaps)}`);
    assert.deepEqual(result.validation, [null, null]);
    for (const [name, code] of [['autoDisposed','DISPOSED'], ['autoResize','SIZE_INVALID'], ['autoTransparent','TEXTURE_INVALID'], ['autoLoss','DEVICE_LOST']]) {
      const item = result[name];
      assert.deepEqual(item.outcomes.map(o => o.code), [code, code], `${name} rejects both frame waiters`);
      assert.ok(item.report.some(message => message.includes(code)), `${name} reports ${code}: ${JSON.stringify(item.report)}`);
      assert.equal(item.recovery.code, 'OK', `${name} recovers after removing the map`);
    }
    assert.equal(result.lostAccessor?.code, 'DEVICE_LOST');
    assert.deepEqual(result.reports, []); assert.deepEqual(errors, []);
  } catch (error) {
    if (evidence) {
      await writeFile(join(evidence, 'first-error.json'), JSON.stringify({ name: error.name, message: error.message, stack: error.stack, errors }, null, 2) + '\n');
      if (page && !page.isClosed()) await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {});
    }
    throw error;
  } finally { if (browser) await browser.close(); if (server.listening) await new Promise(r => server.close(r)); }
});
