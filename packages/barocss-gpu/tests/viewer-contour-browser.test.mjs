// G8, a curved surface's contour on the GPU (GeometryInput.contour), browser acceptance. A smooth torus drawn dark with its
// contour in white, the contour two ways: segments from the CPU (a port of the studio's silhouetteLines: the facing,
// linear between a triangle's vertices, at zero) drawn as lines, and the contour geometry, its segments found in the
// vertex shader. In perspective and orthographic, and turned and moved: the same pixels within a pixel; moving it
// makes no GPU buffer.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --import ./tests/cad-dist.mjs --test tests/viewer-contour-browser.test.mjs
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
  // (R2c: the viewer's modules in subfolders too — shaders/.)
  const files = new Map((await readdir(dist, { recursive: true })).filter(f => f.endsWith('.js')).map(f => [`/viewer/${f.split(path.sep).join('/')}`, path.join(dist, f)]));
  const server = createServer(async (req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
    const file = files.get(req.url ?? '');
    if (!file) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(file));
  });
  await new Promise(r => server.listen(Number(process.env.GPU_TEST_PORT ?? 0), '127.0.0.1', r));
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


test('G8 contour: the GPU contour draws the CPU contour within a pixel, in perspective and orthographic, turned and moved; moving it makes no buffer', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api } = window, canvas = document.getElementById('c');
      canvas.style.width = '400px'; canvas.style.height = '300px';
      const torus = (R, r, nu, nv) => {
        const P = [], N = [], I = [];
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
          const u = 2 * Math.PI * i / nu, v = 2 * Math.PI * j / nv, cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
          P.push((R + r * cv) * cu, (R + r * cv) * su, r * sv); N.push(cv * cu, cv * su, sv);
        }
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
          const a = i * nv + j, b = ((i + 1) % nu) * nv + j, c = ((i + 1) % nu) * nv + (j + 1) % nv, d = i * nv + (j + 1) % nv;
          I.push(a, b, c, a, c, d);
        }
        return { positions: P, normals: N, indices: I };
      };
      // (The studio's silhouetteLines, ported: every triangle, in double precision.)
      const cpuContour = (m, M, eye, target, ortho) => {
        const P = m.positions, Nn = m.normals, I = m.indices, n = P.length / 3, f = new Float64Array(n), out = [];
        for (let v = 0; v < n; v++) {
          const x = P[3 * v], y = P[3 * v + 1], z = P[3 * v + 2], nx = Nn[3 * v], ny = Nn[3 * v + 1], nz = Nn[3 * v + 2];
          const w = [0, 1, 2].map(k => M[k] * x + M[4 + k] * y + M[8 + k] * z + M[12 + k]), a = [0, 1, 2].map(k => M[k] * nx + M[4 + k] * ny + M[8 + k] * nz);
          const e = [0, 1, 2].map(k => eye[k] - (ortho ? target[k] : w[k])), l = Math.hypot(...a) * Math.hypot(...e), d = (a[0] * e[0] + a[1] * e[1] + a[2] * e[2]) / l;
          f[v] = Math.abs(d) <= 1e-7 ? 0 : d;
        }
        const pt = v => [P[3 * v], P[3 * v + 1], P[3 * v + 2]];
        for (let t = 0; t < I.length; t += 3) {
          const ids = [I[t], I[t + 1], I[t + 2]], vals = ids.map(v => f[v]), zeros = ids.filter(v => f[v] === 0);
          if (zeros.length === 3) continue;
          if (zeros.length === 2) { out.push(...pt(zeros[0]), ...pt(zeros[1])); continue; }
          const pts = zeros.map(pt);
          for (let e = 0; e < 3; e++) { const j = (e + 1) % 3, a = vals[e], b = vals[j]; if (a * b >= 0) continue; const p = pt(ids[e]), q = pt(ids[j]), k = a / (a - b); pts.push([0, 1, 2].map(c => p[c] + k * (q[c] - p[c]))); }
          if (pts.length === 2) out.push(...pts[0], ...pts[1]);
        }
        return out;
      };
      const mesh = torus(6, 2, 64, 32);
      const turn = a => { const c = Math.cos(a), sn = Math.sin(a); return [1, 0, 0, 0, 0, c, sn, 0, 0, -sn, c, 0, 2, -1, 3, 1]; };
      const cases = [['perspective', 'perspective', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((_, i) => i % 5 ? 0 : 1)], ['orthographic', 'orthographic', [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]], ['turned and moved', 'perspective', turn(0.7)]];
      const eye = [14, -20, 12], target = [0, 0, 0];
      const draw = async (projection, M, gpu) => {
        const v = await api.createViewer(canvas, { pixelRatio: 1, antialias: false, background: '#000000', camera: { position: eye, target, up: [0, 0, 1], projection }, lights: [] });
        v.camera.fit({ min: [-10, -10, -6], max: [10, 10, 8] }, v.aspect);
        const cam = v.camera.position, tgt = v.camera.target;
        v.add(mesh, { material: { color: '#202020', unlit: true }, transform: M });
        const line = gpu
          ? v.add({ ...mesh, topology: 'lines', contour: true }, { material: { color: '#ffffff', unlit: true, lineWidth: 2 }, pickable: false, transform: M })
          : v.add({ positions: cpuContour(mesh, M, cam, tgt, projection === 'orthographic'), topology: 'lines' }, { material: { color: '#ffffff', unlit: true, lineWidth: 2 }, pickable: false, transform: M });
        const img = await v.capture();
        let made = 0;
        // (Less what 10 captures alone make: their read-backs.)
        if (gpu) { const m0 = window.made; for (let k = 1; k <= 10; k++) await v.capture(); const m1 = window.made; for (let k = 1; k <= 10; k++) { line.transform = turn(0.7 + 0.05 * k); await v.capture(); } made = window.made - m1 - (m1 - m0); }
        v.dispose();
        return { img, made };
      };
      const lit = (img, i) => img.data[4 * i] > 128;
      const near = (img, x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < img.width && yy < img.height && lit(img, yy * img.width + xx)) return true; } return false; };
      const out = [];
      for (const [name, projection, M] of cases) {
        const cpu = await draw(projection, M, false), gpu = await draw(projection, M, true), W = cpu.img.width, H = cpu.img.height;
        let a = 0, b = 0, missing = 0, extra = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (lit(cpu.img, i)) { a++; if (!near(gpu.img, x, y)) missing++; }
          if (lit(gpu.img, i)) { b++; if (!near(cpu.img, x, y)) extra++; }
        }
        out.push({ name, cpu: a, gpu: b, missing, extra, made: gpu.made });
      }
      return out;
    });
    for (const c of r) {
      t.diagnostic(`${c.name}: CPU contour ${c.cpu} px, GPU ${c.gpu} px; ${c.missing} of the CPU's more than a pixel from the GPU's, ${c.extra} of the GPU's from the CPU's; moved 10 times, ${c.made} buffers made`);
      assert.ok(c.cpu > 500, `${c.name}: ${c.cpu} contour pixels`);
      assert.ok(c.missing <= 0.01 * c.cpu && c.extra <= 0.01 * c.gpu, `${c.name}: ${c.missing} missing, ${c.extra} extra`);
      assert.equal(c.made, 0, `${c.name}: moving the contour made ${c.made} buffers`);
    }
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});
