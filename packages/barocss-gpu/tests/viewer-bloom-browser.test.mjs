// G15d.2 in a real browser's WebGPU: bloom — a small square far brighter than white glows past its edges onto the dark
// background, more with strength; a square at white stays below the threshold and does not; off, nothing glows.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --test tests/viewer-bloom-browser.test.mjs
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

test('bloom (G15d.2)', { timeout: 120000 }, async t => {
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
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#101010', camera: { position: [0, -10, 0], target: [0, 0, 0], up: [0, 0, 1] } });
      // A small unlit square (a fifth of the frame's height), emissive far over white: its glow is what's measured.
      const sq = viewer.add({ positions: [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], indices: [0, 1, 2, 0, 2, 3] }, { material: { color: '#ffffff', unlit: true, doubleSided: true } });
      viewer.fit({ min: [-2.5, 0, -2.5], max: [2.5, 0, 2.5] });
      const at = (img, x, y) => img.data[(Math.round(y) * img.width + Math.round(x)) * 4];
      // (The glow: the background's brightness just outside the square's right edge and further out.)
      const shot = async env => {
        viewer.environment = env; await viewer.frame();
        const img = await viewer.capture(), m = viewer.camera.viewProjection(viewer.aspect), q = [0.5, 0, 0], c = [0, 1, 3].map(k => m[k] * q[0] + m[4 + k] * q[1] + m[8 + k] * q[2] + m[12 + k]);
        const ex = (c[0] / c[2] * 0.5 + 0.5) * img.width, cy = img.height / 2;
        return { inside: at(img, img.width / 2, cy), near: at(img, ex + 4, cy), far: at(img, ex + 40, cy) };
      };
      const hot = { toneMapping: 'aces', exposure: 6 };
      return {
        off: await shot(hot),
        on: await shot({ ...hot, bloom: { strength: 0.08 } }),
        strong: await shot({ ...hot, bloom: { strength: 0.3 } }),
        white: await shot({ toneMapping: 'aces', exposure: 0.6, bloom: { strength: 0.3 } }),
      };
    });
    t.diagnostic(JSON.stringify(r));
    assert.ok(r.off.inside > 240 && r.off.near <= 18, `off: the square bright, the background its own (${r.off.near})`);
    assert.ok(r.on.near > r.off.near + 15, `on: the glow past the edge (${r.off.near} → ${r.on.near})`);
    assert.ok(r.on.far >= r.off.far && r.on.near > r.on.far, `the glow falls off with distance (${r.on.near}, ${r.on.far})`);
    assert.ok(r.strong.near > r.on.near + 10, `stronger, brighter (${r.on.near} → ${r.strong.near})`);
    assert.ok(r.white.near <= r.off.near + 3, `below the threshold, no glow (${r.white.near})`);
    assert.deepEqual(errors.filter(e => !/powerPreference/.test(e)), []);
  } finally {
    await browser.close(); await server.close();
  }
});
