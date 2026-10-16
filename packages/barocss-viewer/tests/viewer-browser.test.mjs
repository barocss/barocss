// The Viewer in a real browser's WebGPU: a native source of two surfaces drawn and picked, a selection
// recoloured, curves drawn as lines, a material on a qualified surface, a resize, a cleared scene and
// disposal. The source is bundled with esbuild from the workspace.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --test tests/viewer-browser.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');
const page = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}canvas{display:block;width:320px;height:240px}</style><canvas id="c" width="320" height="240"></canvas>`;

async function serve() {
  const bundle = await build({ entryPoints: [path.resolve(here, '../src/index.ts')], bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022' });
  const files = new Map([
    ['/viewer.js', ['text/javascript', bundle.outputFiles[0].contents]],
    ['/two-surfaces.barocad', ['text/plain', await readFile(path.join(root, 'examples/viewer-scene/two-surfaces.barocad'))]],
    ['/weighted-curve.barocad', ['text/plain', await readFile(path.join(root, 'examples/viewer-scene/weighted-curve.barocad'))]],
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
