// R7, the facades together in Chrome's WebGPU: a bracket built through @barocss/cad/api, its .meshes() put in a
// @barocss/gpu/api scene and shown in a real Viewer with show(). The scene's bounds are the part's 80 × 40 × 10 mm, the
// camera's up is +Z, and the meshes go in unconverted (the frame is Z-up as given).
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --test tests/api-show-browser.test.mjs
// (Builds first: this package's and @barocss/cad's dist, each with its api/ folder.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.resolve(here, '../dist/index.js'), gpuDist = path.resolve(here, '../dist'), cadDist = path.resolve(here, '../../barocss-cad/dist');
// (The bundle keeps CAD external, G18: the page maps @barocss/cad to CAD's built entry. The facades are served unbundled:
// /gpu/api/… from this package's dist, /cad/… — the kernel and its api/ — from CAD's.)
const page = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><style>body{margin:0}canvas{display:block;width:320px;height:240px}</style><canvas id="c"></canvas>`;
const js = (res, body) => { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(body); };

test('a facade-built part shows through show() in a real Viewer, Z-up, at its own bounds', { timeout: 120000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR are required'); return; }
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = createServer(async (req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
    if (req.url === '/gpu.js') { js(res, await readFile(bundle)); return; }
    if (/^\/gpu\/api\/[\w.-]+\.js$/.test(req.url)) { js(res, await readFile(path.join(gpuDist, req.url.slice(5)))); return; }
    if (/^\/cad\/[\w./-]+\.js$/.test(req.url) && !req.url.includes('..')) { js(res, await readFile(path.join(cadDist, req.url.slice(5)))); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: process.env.VIEWER_ADAPTER === 'swiftshader' ? ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'] : ['--enable-unsafe-webgpu'] });
  const errors = [];
  try {
    const p = await browser.newPage();
    p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(`http://127.0.0.1:${server.address().port}/`);
    if (!await p.evaluate(async () => !!(await navigator.gpu?.requestAdapter()))) { t.skip('no WebGPU adapter'); return; }
    const r = await p.evaluate(async () => {
      const gpu = await import('/gpu.js');
      const { scene, show } = await import('/gpu/api/index.js');
      const { part } = await import('/cad/api/index.js');
      const bracket = part('bracket').box(80, 40, 10).hole({ at: [20, 20], diameterMM: 8 }).fillet(b => b.edges().along('z'), 2);
      const meshes = bracket.meshes();
      const viewer = await gpu.createViewer(document.getElementById('c'), { pixelRatio: 1, controls: false });
      show(viewer, scene().add(meshes, { color: '#c8ccd2' }).background('#102030'));
      const box = viewer.sceneBounds(), img = await viewer.capture();
      // (A pixel where the part's top face projects, against the background: drawn, not cleared.)
      const m = viewer.camera.viewProjection(viewer.aspect), q = [60, 30, 10];
      const c = [0, 1, 3].map(k => m[k] * q[0] + m[4 + k] * q[1] + m[8 + k] * q[2] + m[12 + k]);
      const x = Math.round((c[0] / c[2] * 0.5 + 0.5) * img.width), y = Math.round((0.5 - c[1] / c[2] * 0.5) * img.height), i = (y * img.width + x) * 4;
      return {
        min: [...box.min], max: [...box.max], up: [...viewer.camera.up],
        meshes: viewer.meshList.length, names: viewer.meshList.map(mesh => mesh.name), keys: meshes.map(mesh => mesh.key),
        // (The array the viewer drew from is the facade's own: no converted copy — compared by its first vertex.)
        firstVertex: [...meshes[0].positions.slice(0, 3)],
        top: [...img.data.slice(i, i + 3)], corner: [...img.data.slice(4, 7)],
      };
    });
    const close = (a, b) => a.every((v, k) => Math.abs(v - b[k]) < 1e-6);
    assert.ok(close(r.min, [0, 0, 0]) && close(r.max, [80, 40, 10]), `scene bounds ${JSON.stringify([r.min, r.max])}`);
    assert.deepEqual(r.up, [0, 0, 1], 'Z is up');
    assert.equal(r.meshes, 1); assert.deepEqual(r.names, r.keys);
    assert.ok(r.firstVertex.every(v => v >= -1e-9) && r.firstVertex[2] <= 10 + 1e-9, 'CAD coordinates as given');
    assert.notDeepEqual(r.top, r.corner, 'the part is drawn over the background');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise(res => server.close(res)); }
});
