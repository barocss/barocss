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
// /gpu/… (api/ and what it imports) from this package's dist, /cad/… — the kernel and its api/ — from CAD's.)
const page = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><style>body{margin:0}canvas{display:block;width:320px;height:240px}</style><canvas id="c"></canvas>`;
const js = (res, body) => { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(body); };

// (The page, its server and a browser with WebGPU; null when this machine can't run it.)
async function open(t) {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR are required'); return null; }
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = createServer(async (req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
    if (req.url === '/gpu.js') { js(res, await readFile(bundle)); return; }
    // (The facade's modules and what they import from the package's own dist — core/barocss-error.js since R7.3a.)
    if (/^\/gpu\/[\w./-]+\.js$/.test(req.url) && !req.url.includes('..')) { js(res, await readFile(path.join(gpuDist, req.url.slice(5)))); return; }
    if (/^\/cad\/[\w./-]+\.js$/.test(req.url) && !req.url.includes('..')) { js(res, await readFile(path.join(cadDist, req.url.slice(5)))); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: process.env.VIEWER_ADAPTER === 'swiftshader' ? ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'] : ['--enable-unsafe-webgpu'] });
  const errors = [], p = await browser.newPage();
  p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const close = async () => { await browser.close(); await new Promise(res => server.close(res)); };
  await p.goto(`http://127.0.0.1:${server.address().port}/`);
  if (!await p.evaluate(async () => !!(await navigator.gpu?.requestAdapter()))) { await close(); t.skip('no WebGPU adapter'); return null; }
  return { p, errors, close };
}

test('a facade-built part shows through show() in a real Viewer, Z-up, at its own bounds', { timeout: 120000 }, async t => {
  const opened = await open(t); if (!opened) return;
  const { p, errors, close } = opened;
  try {
    const r = await p.evaluate(async () => {
      const gpu = await import('/gpu.js');
      const { scene, show } = await import('/gpu/api/index.js');
      const { part } = await import('/cad/api/index.js');
      const bracket = part('bracket').box({ wMM: 80, dMM: 40, hMM: 10 }).hole(b => b.faces().facing('+z'), { dMM: 8, xMM: 20, yMM: 20 }).fillet(b => b.edges().along('z'), { radiusMM: 2 });
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
    const same = (a, b) => a.every((v, k) => Math.abs(v - b[k]) < 1e-6);
    assert.ok(same(r.min, [0, 0, 0]) && same(r.max, [80, 40, 10]), `scene bounds ${JSON.stringify([r.min, r.max])}`);
    assert.deepEqual(r.up, [0, 0, 1], 'Z is up');
    assert.equal(r.meshes, 1); assert.deepEqual(r.names, r.keys);
    assert.ok(r.firstVertex.every(v => v >= -1e-9) && r.firstVertex[2] <= 10 + 1e-9, 'CAD coordinates as given');
    assert.notDeepEqual(r.top, r.corner, 'the part is drawn over the background');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

// R7.5b: a part's material by its id (its body names al6061; the scene holds that id's look), its display lines, and a
// top orthographic view — drawn: the plate's top in the look's colour, the bore's middle the background, the lines there.
test('show() draws a material by id, the display lines and a top view', { timeout: 120000 }, async t => {
  const opened = await open(t); if (!opened) return;
  const { p, errors, close } = opened;
  try {
    const r = await p.evaluate(async () => {
      const gpu = await import('/gpu.js');
      const { scene, show } = await import('/gpu/api/index.js');
      const { part } = await import('/cad/api/index.js');
      const plate = part('plate').box({ wMM: 80, dMM: 40, hMM: 10 }).hole(b => b.faces().facing('+z'), { dMM: 16, xMM: 20, yMM: 20 });
      // (cad's kernel names no material, so the mesh is given the id cad-model's part would carry.)
      const meshes = plate.meshes().map(m => ({ ...m, material: 'al6061' }));
      const viewer = await gpu.createViewer(document.getElementById('c'), { pixelRatio: 1, controls: false });
      show(viewer, scene().material('al6061', { color: '#e03020', unlit: true }).add(meshes, undefined, { lines: { color: '#00ff00', unlit: true, lineWidth: 2 } }).background('#000000').camera('top', { projection: 'orthographic' }));
      const img = await viewer.capture(), m = viewer.camera.viewProjection(viewer.aspect);
      const at = q => { const c = [0, 1, 3].map(k => m[k] * q[0] + m[4 + k] * q[1] + m[8 + k] * q[2] + m[12 + k]); const x = Math.round((c[0] / c[2] * 0.5 + 0.5) * img.width), y = Math.round((0.5 - c[1] / c[2] * 0.5) * img.height); return [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3)]; };
      return { up: [...viewer.camera.up], projection: viewer.camera.projection, names: viewer.meshList.map(x => x.name), top: at([60, 30, 10]), bore: at([20, 20, 10]), rim: at([28, 20, 10]) };
    });
    assert.deepEqual(r.up, [0, 1, 0]); assert.equal(r.projection, 'orthographic');
    assert.deepEqual(r.names, ['hole1', 'hole1/lines']);
    const near = (c, rgb, tol = 40) => c.every((v, k) => Math.abs(v - rgb[k]) <= tol);
    assert.ok(near(r.top, [224, 48, 32]), `the top in al6061's look: ${r.top}`);
    assert.ok(near(r.bore, [0, 0, 0]), `the bore's middle open to the background: ${r.bore}`);
    assert.ok(r.rim[1] > 150 && r.rim[0] < 150, `a display line on the bore's rim: ${r.rim}`);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
