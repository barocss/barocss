// The Viewer in a real browser's WebGPU: a native source of two surfaces drawn and picked, a selection
// recoloured, curves drawn as lines, a material on a qualified surface, a resize, a cleared scene and
// disposal. The source is bundled with esbuild from the workspace.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --test tests/viewer-browser.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');
const page = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}canvas{display:block;width:320px;height:240px}</style><canvas id="c" width="320" height="240"></canvas>`;

async function serve(evidenceDirectory) {
  const bundle = await build({ entryPoints: [path.resolve(here, '../src/index.ts')], bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', metafile: !!evidenceDirectory });
  if (evidenceDirectory) {
    await mkdir(evidenceDirectory, { recursive: true });
    const inputs = [];
    for (const file of Object.keys(bundle.metafile.inputs)) {
      const resolved = await realpath(path.resolve(file));
      assert.ok(resolved.startsWith(root + path.sep) || resolved.includes(path.sep + 'node_modules' + path.sep), `outside worktree source: ${resolved}`);
      const bytes = await readFile(resolved);
      inputs.push({ path: resolved, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    await writeFile(path.join(evidenceDirectory, 'metafile.json'), JSON.stringify(bundle.metafile, null, 2));
    await writeFile(path.join(evidenceDirectory, 'source-inputs.json'), JSON.stringify({ worktree: root, inputs }, null, 2));
  }
  const files = new Map([
    ['/viewer.js', ['text/javascript', bundle.outputFiles[0].contents]],
    ['/two-surfaces.barocad', ['text/plain', await readFile(path.join(root, 'examples/viewer-scene/two-surfaces.barocad'))]],
    ['/weighted-curve.barocad', ['text/plain', await readFile(path.join(root, 'examples/viewer-scene/weighted-curve.barocad'))]],
    ['/lifetime-plane.barocad', ['text/plain', '@model dots { version: 0; length-unit: mm; @surface #plane { type: nurbs; degree-u: 1; degree-v: 1; knots-u: [0,0,1,1]; knots-v: [0,0,1,1]; control-points: [[[-1,-1,0],[-1,1,0]],[[1,-1,0],[1,1,0]]]; weights: [[1,1],[1,1]]; } }']],
  ]);
  const server = createServer((req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
    const file = files.get(req.url ?? '');
    if (!file) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': file[0] }); res.end(file[1]);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

test('Viewer draws, picks, selects, resizes and clears on WebGPU', { timeout: 180000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR are required'); return; }
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true,
    args: process.env.VIEWER_ADAPTER === 'swiftshader' ? ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'] : ['--enable-unsafe-webgpu'] });
  const errors = [];
  try {
    const p = await browser.newPage({ viewport: { width: 800, height: 600 } });
    p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(server.url + '/');
    if (!await p.evaluate(async () => !!(await navigator.gpu?.requestAdapter()))) { t.skip('no WebGPU adapter'); return; }

    const result = await p.evaluate(async () => {
      const { createViewer } = await import('/viewer.js');
      const canvas = document.getElementById('c'), background = [0.035, 0.055, 0.09];
      const bg = background.map(c => Math.round(c * 255));
      const stats = data => {
        let covered = 0; const colors = new Set();
        for (let i = 0; i < data.length; i += 4) {
          if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 12) {
            covered++; colors.add(`${data[i] >> 5},${data[i + 1] >> 5},${data[i + 2] >> 5}`);
          }
        }
        return { covered, colors: colors.size };
      };
      const viewer = await createViewer(canvas, { mmToSceneUnit: 0.001, background });
      const out = {};
      viewer.loadNative(await (await fetch('/two-surfaces.barocad')).text(), { sourceVersion: 0, countU: 8, countV: 8 });
      const shot = await viewer.readPixels();
      out.length = shot.length; out.surfaces = stats(shot); out.state = viewer.getState().status;
      // CPU picking through the centre of the drawn surfaces.
      let hit = null;
      for (let y = 40; y < 240 && !hit; y += 10) for (let x = 20; x < 320 && !hit; x += 10) hit = viewer.pick(x, y);
      out.hit = hit && hit.ref;
      if (hit) {
        viewer.select(hit.ref);
        const selected = await viewer.readPixels();
        out.selectionChanged = selected.some((v, i) => v !== shot[i]);
      }
      viewer.orbit(0.4, 0.2);
      out.orbitChanged = (await viewer.readPixels()).some((v, i) => v !== shot[i]);
      viewer.resize(200, 150);
      out.resized = (await viewer.readPixels()).length;
      viewer.resize(320, 240);
      viewer.loadNative(await (await fetch('/weighted-curve.barocad')).text(),
        { sourceVersion: 0, countU: 8, countV: 8, curveDisplay: { chordToleranceMM: 0.05, maxSegments: 256, maxDepth: 12 } });
      out.curves = viewer.getState().curves.length;
      out.curvePixels = stats(await viewer.readPixels());
      viewer.clear();
      out.cleared = viewer.getState().status;
      viewer.dispose();
      out.disposed = viewer.getState().status;
      return out;
    });
    t.diagnostic(JSON.stringify(result));
    assert.equal(result.length, 320 * 240 * 4);
    assert.equal(result.state, 'ready');
    assert.ok(result.surfaces.covered > 2000, 'the surfaces cover the view');
    assert.ok(result.surfaces.colors >= 2, 'two palette colours');
    assert.ok(result.hit, 'a CPU pick finds a surface');
    assert.equal(result.selectionChanged, true);
    assert.equal(result.orbitChanged, true);
    assert.equal(result.resized, 200 * 150 * 4);
    assert.ok(result.curves >= 1);
    assert.ok(result.curvePixels.covered > 20, 'curves are drawn');
    assert.equal(result.cleared, 'empty');
    assert.equal(result.disposed, 'disposed');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});

// Test-only lifetime observations of the real SDK/Core; counts are not driver bytes, VRAM or an OOM result.
test('D319 Viewer keeps only active Geometry through camera changes, replacements, curves, dots and clear', { timeout: 180000 }, async t => {
  assert.ok(process.env.CHROME && process.env.PW_DIR, 'D319 requires real Chrome and Playwright; no silent capability skip');
  const output = process.env.VIEWER_D319_ARTIFACT_DIR;
  assert.ok(output, 'VIEWER_D319_ARTIFACT_DIR is required to retain the actual receipt and screenshots');
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = await serve(output);
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
  const errors = [];
  try {
    const p = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
    p.on('pageerror', e => errors.push(e.stack ?? String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(server.url);
    const result = await p.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter(); if (!adapter) throw new Error('D319 requires an actual WebGPU adapter');
      const { createViewer } = await import('/viewer.js');
      const canvas = document.getElementById('c'), background = [0.035, 0.055, 0.09], bg = background.map(v => Math.round(v * 255));
      const viewer = await createViewer(canvas, { mmToSceneUnit: 1, background }), core = viewer.presenter.core;
      const counts = [], frames = [];
      // Read TS-private state only. No production replacement, telemetry or ownership callback is installed.
      const count = label => { const value = { label, retained: core.geometries.size, resident: [...core.geometries].filter(g => g.gpu !== null).length, active: core.meshList.length }; counts.push(value); return value; };
      const read = async label => {
        const pixels = await viewer.readPixels(); let covered = 0;
        for (let i = 0; i < pixels.length; i += 4) if (Math.abs(pixels[i] - bg[0]) + Math.abs(pixels[i + 1] - bg[1]) + Math.abs(pixels[i + 2] - bg[2]) > 12) covered++;
        frames.push({ label, bytes: pixels.length, covered }); count(label); return pixels;
      };
      const packet = { version: 0, surfaceId: 'lifetime_patch', revision: 0, lengthUnit: 'mm', coordinateSystem: 'right-handed-z-up', winding: 'ccw',
        positions: [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0], normals: [0,0,1, 0,0,1, 0,0,1, 0,0,1], indices: [0,1,2, 0,2,3], parameters: [0,0, 1,0, 1,1, 0,1], bounds: { min: [-1,-1,0], max: [1,1,0] } };
      const input = [{ modelId: 'lifetime', packet }];
      const camera = { eye: [0,0,6], target: [0,0,0], up: [0,1,0], fovY: 45, near: 0.01, far: 100 };
      const image = pixels => new Promise((resolve, reject) => {
        const c = document.createElement('canvas'); c.width = 320; c.height = 240;
        c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels), 320, 240), 0, 0);
        c.toBlob(blob => { if (!blob) reject(new Error('PNG encoding failed')); else blob.arrayBuffer().then(buffer => resolve(Array.from(new Uint8Array(buffer))), reject); }, 'image/png');
      });
      const images = {};
      try {
        count('created'); viewer.setPackets(input); viewer.setView(camera);
        const initial = await read('surface-initial'); images.surface = await image(initial);
        let hit = null; for (let y = 40; y < 240 && !hit; y += 10) for (let x = 20; x < 320 && !hit; x += 10) hit = viewer.pick(x, y);
        for (let i = 0; i < 64; i++) {
          viewer.orbit(0.005, 0.001); viewer.pan(i % 2 ? -0.001 : 0.001, 0); viewer.zoom(i % 2 ? 1 / 1.001 : 1.001);
          await read(`camera-${i + 1}`);
        }
        for (let i = 0; i < 3; i++) { viewer.setView(camera); await read(`setView-${i + 1}`); }
        // The same packet and positions array are deliberately reused: a cache must not hide an authored edit.
        const before = await viewer.readPixels(); packet.positions[0] = -0.2;
        viewer.setPackets(input); viewer.setView(camera); const changed = await read('same-array-edited');
        const authoredEditChangedPixels = changed.some((v, i) => v !== before[i]); images.edited = await image(changed);
        for (let i = 0; i < 16; i++) { viewer.setPackets(input); viewer.setView(camera); await read(`replacement-${i + 1}`); }
        const curveSource = await (await fetch('/weighted-curve.barocad')).text();
        viewer.loadNative(curveSource, { sourceVersion: 0, countU: 8, countV: 8, curveDisplay: { chordToleranceMM: 0.05, maxSegments: 256, maxDepth: 12 } });
        const curveRefs = viewer.getState().curves, curves = curveRefs.length;
        viewer.setVisibleGeometry(curveRefs.map(ref => ({ kind: 'curve', ...ref }))); viewer.fit();
        const curvePixels = await read('native-curves'); images.curves = await image(curvePixels);
        let curveHit = null;
        for (let y = 4; y < 240 && !curveHit; y += 8) for (let x = 4; x < 320 && !curveHit; x += 8) curveHit = viewer.pickGeometry({ xCss: x, yCss: y }, { kinds: ['curve'], curveTolerancePx: 8 });
        for (let i = 0; i < 16; i++) { viewer.orbit(0.005, 0); await read(`curve-orbit-${i + 1}`); }
        await viewer.loadModelSetUrls({ format: 'barocad-model-set', version: 0, entries: [{ aliasId: 'lifetime_plane', url: '/lifetime-plane.barocad',
          options: { sourceVersion: 0, countU: 4, countV: 4, unitsPerMillimeter: 1 } }] }, { baseURL: location.href });
        viewer.setView(camera);
        const noDots = await read('native-plane');
        const positions = new Float64Array(768);
        for (let i = 0; i < 256; i++) { positions[3 * i] = (-0.8 + (i % 16) * 0.1) / 1000; positions[3 * i + 1] = (-0.8 + Math.floor(i / 16) * 0.1) / 1000; positions[3 * i + 2] = 0.1 / 1000; }
        viewer.setFluidFrame({ version: 0, contextId: 'lifetime-dots', sceneRevision: 'plane-v0', stepIndex: 0, particleCount: 256, positionsM: positions });
        const dots = await read('dots-initial'); images.dots = await image(dots);
        const dotsChangedPixels = dots.some((v, i) => v !== noDots[i]);
        for (let i = 1; i <= 16; i++) { viewer.setFluidFrame({ version: 0, contextId: 'lifetime-dots', sceneRevision: 'plane-v0', stepIndex: i, particleCount: 256, positionsM: positions }); viewer.pan(i % 2 ? 0.001 : -0.001, 0); await read(`dots-frame-${i}`); }
        viewer.setFluidFrame(null); await read('dots-removed');
        viewer.clear(); const empty = await read('clear'); images.clear = await image(empty);
        const emptyStatus = viewer.getState().status;
        viewer.dispose(); count('dispose'); const disposedStatus = viewer.getState().status;
        return { adapter: adapter.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description } : null,
          counts, frames, hit: hit?.ref ?? null, curveHit: curveHit?.ref ?? null, authoredEditChangedPixels, curves, dotsChangedPixels, emptyStatus, disposedStatus, images };
      } finally { viewer.dispose(); }
    });
    const images = result.images; delete result.images;
    for (const [label, bytes] of Object.entries(images)) await writeFile(path.join(output, `${label}.png`), new Uint8Array(bytes));
    await writeFile(path.join(output, 'receipt.json'), JSON.stringify({ browserVersion: browser.version(), errors, measurement: 'test-only TS-private retained/resident Geometry counts; not driver bytes, VRAM or OOM', result }, null, 2));
    t.diagnostic(JSON.stringify({ adapter: result.adapter, frames: result.frames.length, counts: result.counts }));
    assert.ok(result.hit, 'actual public CPU picking finds the rendered surface');
    assert.ok(result.authoredEditChangedPixels, 'reusing edited source arrays changes actual captured pixels');
    assert.ok(result.curves > 0 && result.curveHit && result.frames.find(frame => frame.label === 'native-curves').covered > 20, 'a curve-only scene is captured and publicly picked');
    assert.ok(result.dotsChangedPixels, 'public fluid dots change actual captured pixels');
    for (const sample of result.counts) {
      assert.equal(sample.retained, sample.active, `${sample.label}: only active Geometry is retained`);
      assert.equal(sample.resident, sample.active, `${sample.label}: only active Geometry has a GPU upload after readback`);
    }
    for (const label of ['created', 'clear', 'dispose']) assert.deepEqual(result.counts.find(sample => sample.label === label), { label, retained: 0, resident: 0, active: 0 });
    assert.ok(result.frames.filter(frame => frame.label.startsWith('camera-')).every(frame => frame.covered > 100));
    assert.equal(result.emptyStatus, 'empty'); assert.equal(result.disposedStatus, 'disposed'); assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
