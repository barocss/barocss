// The viewer in a real browser's WebGPU, G1: meshes moved by their transform alone, frame after frame — nothing made
// or uploaded but their object blocks, and the GPU pick, the CPU ray, the line pick and the selection outline where the
// mesh now is.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --test tests/viewer-pose-clip-browser.test.mjs
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
  const files = new Map((await readdir(dist)).filter(f => f.endsWith('.js')).map(f => [`/viewer/${f}`, path.join(dist, f)]));
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

/** A browser page with the viewer's helpers: a box, where a world point lands, a pixel of a capture. */
async function open(t) {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR are required'); return null; }
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
  const errors = [], p = await browser.newPage({ viewport: { width: 800, height: 600 } });
  p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(server.url + '/');
  const adapter = await p.evaluate(async () => { const a = await navigator.gpu?.requestAdapter(); return a ? `${a.info?.vendor} ${a.info?.architecture}` : null; });
  if (!adapter) { await browser.close(); await server.close(); t.skip('no WebGPU adapter'); return null; }
  await p.evaluate(async () => {
    // (Buffers made, counted from here.)
    window.made = 0; const make = GPUDevice.prototype.createBuffer; GPUDevice.prototype.createBuffer = function (d) { window.made++; return make.call(this, d); };
    window.api = await import('/viewer/index.js');
    window.box = (sx, sy, sz) => {
      const P = [], N = [], I = [], E = [];
      for (const [axis, s] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
        const u = (axis + 1) % 3, v = (axis + 2) % 3, base = P.length / 3, h = [sx / 2, sy / 2, sz / 2];
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = [0, 0, 0]; q[axis] = s * h[axis]; q[u] = a * h[u]; q[v] = b * h[v] * s; P.push(...q); const n = [0, 0, 0]; n[axis] = s; N.push(...n); }
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
        for (let k = 0; k < 4; k++) E.push(...P.slice(3 * (base + k), 3 * (base + k) + 3), ...P.slice(3 * (base + (k + 1) % 4), 3 * (base + (k + 1) % 4) + 3));
      }
      return { surface: { positions: P, normals: N, indices: I, faces: Array.from({ length: 12 }, (_, i) => Math.floor(i / 2)) }, edges: { positions: E, topology: 'lines', edges: Array.from({ length: 24 }, (_, i) => i) } };
    };
    window.screen = (viewer, p) => { const m = viewer.camera.viewProjection(viewer.aspect), c = viewer.canvas, q = [0, 1, 3].map(k => m[k] * p[0] + m[4 + k] * p[1] + m[8 + k] * p[2] + m[12 + k]); return [(q[0] / q[2] * 0.5 + 0.5) * c.clientWidth, (0.5 - q[1] / q[2] * 0.5) * c.clientHeight]; };
    window.tp = (M, p) => [0, 1, 2].map(r => M[r] * p[0] + M[4 + r] * p[1] + M[8 + r] * p[2] + M[12 + r]);
    window.pixel = (img, [x, y]) => { const i = (Math.round(y) * img.width + Math.round(x)) * 4; return [...img.data.slice(i, i + 4)]; };
  });
  return { p, errors, adapter, close: async () => { await browser.close(); await server.close(); } };
}

test('G1 a mesh moved by its transform, 30 times: nothing made, and pick, ray, line pick and outline where it now is', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    t.diagnostic(`adapter: ${s.adapter}`);
    const r = await s.p.evaluate(async () => {
      const { api, box, screen, pixel, tp } = window, canvas = document.getElementById('c');
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#202020', camera: { position: [0, -12, 9], target: [0, 0, 0], up: [0, 0, 1] } });
      const b = box(2, 2, 2), surface = viewer.add(b.surface, { name: 'link', material: { color: '#d03020' } }), edges = viewer.add(b.edges, { name: 'link edges', material: { color: '#ffffff', unlit: true } });
      surface.outline = '#00e0ff';
      viewer.camera.fit({ min: [-5, -5, -2], max: [5, 5, 2] }, viewer.aspect);
      // (The first capture and pick make their read buffers.)
      await viewer.frame(); await viewer.capture(); await viewer.pick(1, 1);
      const made = window.made, out = [];
      let captures = 0;
      for (let k = 0; k < 30; k++) {
        // A link swinging about z through the origin at radius 3, turned with it.
        const a = (k / 30) * 2 * Math.PI, M = api.multiply(api.translation([3 * Math.cos(a), 3 * Math.sin(a), 0]), api.rotation([0, 0, 1], a)), inv = api.invert(M);
        surface.transform = M; edges.transform = M;
        await viewer.frame();
        if (k % 6) continue;
        const top = tp(M, [0.3, 0.2, 1]), [x, y] = screen(viewer, top);
        const ray = viewer.raycast(x, y), gpu = await viewer.pick(x, y);
        // Near the top side's front edge: the segment found lies on the moved box's edges (two of its own coordinates ±1).
        const [ex, ey] = screen(viewer, tp(M, [0.1, -1, 1])), line = viewer.pickLine(ex + 2, ey + 1, 6), local = line && tp(inv, line.point);
        // The outline: the pixels it changes, around the moved box on screen.
        const lit = await viewer.capture(); surface.outline = null; const plain = await viewer.capture(); surface.outline = '#00e0ff'; captures += 2;
        let n = 0, sx = 0, sy = 0, cyan = 0;
        for (let i = 0; i < lit.data.length; i += 4) {
          if (Math.abs(lit.data[i] - plain.data[i]) + Math.abs(lit.data[i + 1] - plain.data[i + 1]) + Math.abs(lit.data[i + 2] - plain.data[i + 2]) < 60) continue;
          n++; sx += (i / 4) % lit.width; sy += Math.floor(i / 4 / lit.width);
          if (lit.data[i + 2] > 150 && lit.data[i + 1] > 150 && lit.data[i] < 90) cyan++;
        }
        const [cx, cy] = screen(viewer, tp(M, [0, 0, 0]));
        out.push({ k, ray: ray && { name: ray.mesh.name, face: ray.face, d: Math.hypot(...ray.point.map((v, i) => v - top[i])) }, gpu: gpu && { name: gpu.mesh.name, d: Math.hypot(...gpu.point.map((v, i) => v - top[i])) },
          line: line && { name: line.mesh.name, onEdge: local.filter(v => Math.abs(Math.abs(v) - 1) < 1e-3).length, inside: local.every(v => Math.abs(v) <= 1 + 1e-3) },
          outline: { n, cyan, off: n ? Math.hypot(sx / n - cx, sy / n - cy) : null } });
      }
      viewer.dispose();
      return { out, made: window.made - made - captures };
    });
    t.diagnostic(JSON.stringify(r));
    assert.equal(r.made, 0, 'no buffer made while the mesh moves');
    for (const o of r.out) {
      assert.equal(o.ray?.name, 'link', JSON.stringify(o)); assert.equal(o.ray.face, 4, 'the top side'); assert.ok(o.ray.d < 1e-4, JSON.stringify(o));
      assert.equal(o.gpu?.name, 'link', JSON.stringify(o)); assert.ok(o.gpu.d < 0.1, JSON.stringify(o));
      assert.equal(o.line?.name, 'link edges', JSON.stringify(o)); assert.ok(o.line.onEdge >= 2 && o.line.inside, JSON.stringify(o));
      // (A ring a couple of pixels wide round a box some 50 px across, centred on it.)
      assert.ok(o.outline.cyan > 100 && o.outline.off < 12, `the outline round the moved box ${JSON.stringify(o)}`);
    }
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});
