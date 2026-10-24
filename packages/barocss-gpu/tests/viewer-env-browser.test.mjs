// G15b in a real browser's WebGPU: an environment's lighting — its diffuse light from the cosine-weighted convolution (a
// sphere under a white sky over black ground: lit above, half lit at its equator, dark below) and its reflections
// prefiltered by roughness (a mirror's horizon sharp, a rough metal's soft).
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --test tests/viewer-env-browser.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/viewer');
const page = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}canvas{display:block;width:320px;height:240px}</style><canvas id="c"></canvas>`;

async function serve() {
  const files = new Map((await readdir(dist, { recursive: true })).filter(f => f.endsWith('.js')).map(f => [`/viewer/${f.split(path.sep).join('/')}`, path.join(dist, f)]));
  files.set('/core/barocss-error.js', path.join(dist, '../core/barocss-error.js'));
  const server = createServer(async (req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
    const file = files.get(req.url ?? '');
    if (!file) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

test('the environment\'s diffuse light and prefiltered reflections (G15b)', { timeout: 120000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR are required'); return; }
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: (process.env.VIEWER_ADAPTER === 'swiftshader' ? ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'] : ['--enable-unsafe-webgpu']) });
  const errors = [];
  try {
    const p = await browser.newPage({ viewport: { width: 800, height: 600 } });
    p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    await p.goto(server.url + '/');
    if (!(await p.evaluate(async () => !!(await navigator.gpu?.requestAdapter())))) { t.skip('no WebGPU adapter'); return; }

    const r = await p.evaluate(async () => {
      const api = await import('/viewer/index.js');
      const canvas = document.getElementById('c');
      // The environment: white above the horizon, black below (equirectangular, Z up: its top half the sky).
      const W = 256, H = 128, data = new Uint8Array(W * H * 4);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, v = y < H / 2 ? 255 : 0; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255; }
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#404040', camera: { position: [0, -8, 0], target: [0, 0, 0], up: [0, 0, 1] }, lights: [] });
      viewer.environment = { map: viewer.createTexture({ width: W, height: H, data }), mapIntensity: 1, toneMapping: 'none', exposure: 1 };
      // A sphere of radius 1 (smooth normals).
      const P = [], I = [], S = 64, R = 32;
      for (let j = 0; j <= R; j++) for (let i = 0; i <= S; i++) { const th = (j / R) * Math.PI, ph = (i / S) * 2 * Math.PI; P.push(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)); }
      for (let j = 0; j < R; j++) for (let i = 0; i < S; i++) { const a = j * (S + 1) + i, b = a + S + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
      const sphere = viewer.add({ positions: P, normals: P, indices: I }, { material: { color: '#ffffff', metallic: 0, roughness: 1 } });
      viewer.fit({ min: [-1.2, -1.2, -1.2], max: [1.2, 1.2, 1.2] });
      const grab = async () => { await viewer.frame(); return viewer.capture(); };
      const centre = img => [img.width >> 1, img.height >> 1];
      const lum = (img, x, y) => { const i = (Math.round(y) * img.width + Math.round(x)) * 4; return img.data[i]; };
      // (The sphere's top, middle and bottom along the centre column; its radius on screen from its silhouette.)
      const column = img => { const [cx, cy] = centre(img), col = []; for (let y = 0; y < img.height; y++) col.push(lum(img, cx, y)); return { col, cx, cy }; };
      const diffuse = await grab(), d = column(diffuse);
      let top = 0; while (top < d.col.length && Math.abs(d.col[top] - 64) <= 2) top++;
      let bottom = d.col.length - 1; while (bottom > 0 && Math.abs(d.col[bottom] - 64) <= 2) bottom--;
      const span = bottom - top, at = f => d.col[Math.round(top + f * span)];
      const out = { diffuse: { top: at(0.08), middle: at(0.5), bottom: at(0.97), span } };
      // A mirror and a rough metal: the horizon's reflection across the middle — how many pixels it takes to go from 10% to 90%.
      const edge = col => { const lo = Math.min(...col.slice(top + 4, bottom - 4)), hi = Math.max(...col.slice(top + 4, bottom - 4)); let a = -1, b = -1; for (let y = top + 4; y < bottom - 4; y++) { if (a < 0 && col[y] < hi - 0.1 * (hi - lo)) a = y; if (b < 0 && col[y] < lo + 0.1 * (hi - lo)) b = y; } return { lo, hi, width: b - a }; };
      sphere.material = { metallic: 1, roughness: 0 }; out.mirror = edge(column(await grab()).col);
      sphere.material = { metallic: 1, roughness: 0.6 }; out.rough = edge(column(await grab()).col);
      return out;
    });
    t.diagnostic(JSON.stringify(r));
    // Diffuse light: above, the whole sky (white); at the equator, half of it; below, the black ground.
    assert.ok(r.diffuse.span > 60, `the sphere found: ${r.diffuse.span} px`);
    assert.ok(r.diffuse.top > 225, `lit from above: ${r.diffuse.top}`);
    assert.ok(r.diffuse.middle > 150 && r.diffuse.middle < 215, `half lit at the equator (0.5 linear is 188): ${r.diffuse.middle}`);
    assert.ok(r.diffuse.bottom < 90 && r.diffuse.middle > r.diffuse.bottom + 80, `dark below (a sliver of sky and a rough sheen): ${r.diffuse.bottom}`);
    // Reflections: the mirror's horizon sharp, the rough metal's spread.
    assert.ok(r.mirror.hi > 220 && r.mirror.lo < 30, `the mirror reflects the sky and the ground: ${r.mirror.lo}–${r.mirror.hi}`);
    assert.ok(r.mirror.width <= 6, `the mirror's horizon sharp: ${r.mirror.width} px`);
    assert.ok(r.rough.width > 3 * Math.max(1, r.mirror.width), `the rough metal's horizon soft: ${r.rough.width} px against ${r.mirror.width}`);
    assert.deepEqual(errors.filter(e => !/powerPreference/.test(e)), []);
  } finally {
    await browser.close(); await server.close();
  }
});
