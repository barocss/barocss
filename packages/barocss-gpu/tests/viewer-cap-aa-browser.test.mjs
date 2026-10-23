// G7 (G-R20), antialiased cap edges (Codex's per-sample caps, 22e129e36), browser acceptance. The same capped scene drawn
// with antialiasing on and off, seen along +Y and cut by y = 0: a box turned 0°, 30° and 45° about Y (the cap a square
// turned in the frame) and a 64-sided cylinder standing along Y (the cap a disc). The cap's interior (pixels whose whole 3 × 3 neighbourhood is cap by the CPU's ray) the same within
// 1/255 either way; the edge antialiased — partly covered pixels along the inclined edges; an uncut frame byte-identical
// with the cap path on; capFrontSamples' memory and the frame time with and without a section, the load stated.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --import ./tests/cad-dist.mjs --test tests/viewer-cap-aa-browser.test.mjs
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

import { loadavg } from 'node:os';

test('G7 antialiased caps: the interior unchanged, the edge covered, an uncut frame unchanged, the cost stated', { timeout: 240000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box } = window, canvas = document.getElementById('c');
      canvas.style.width = '480px'; canvas.style.height = '360px';
      const cylinder = (rad, h, n) => {
        const P = [], N = [], I = [];
        for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n, c = Math.cos(a), sn = Math.sin(a); P.push(rad * c, rad * sn, -h / 2, rad * c, rad * sn, h / 2); N.push(c, sn, 0, c, sn, 0); }
        for (let i = 0; i < n; i++) { const a = 2 * i, b = 2 * ((i + 1) % n); I.push(a, b, a + 1, b, b + 1, a + 1); }
        const top = P.length / 3; P.push(0, 0, h / 2); N.push(0, 0, 1); const bottom = top + 1; P.push(0, 0, -h / 2); N.push(0, 0, -1);
        for (let i = 0; i < n; i++) { const a = 2 * i, b = 2 * ((i + 1) % n); I.push(top, a + 1, b + 1, bottom, b, a); }
        return { positions: P, normals: N, indices: I };
      };
      const aboutY = deg => { const a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a); return [c, 0, -sn, 0, 0, 1, 0, 0, sn, 0, c, 0, 0, 0, 0, 1]; };
      const cases = [['box 0°', box(8, 8, 8).surface, aboutY(0)], ['box 30°', box(8, 8, 8).surface, aboutY(30)], ['box 45°', box(8, 8, 8).surface, aboutY(45)], ['cylinder', cylinder(4, 8, 64), [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1]]];
      const draw = async (surface, transform, aa, cut, capped = true) => {
        const v = await api.createViewer(canvas, { pixelRatio: 1, antialias: aa, background: '#000000', camera: { position: [0, -30, 0], target: [0, 0, 0], up: [0, 0, 1], projection: 'orthographic' }, lights: [] });
        v.add(surface, { name: 'part', material: { color: '#404040', unlit: true }, cap: capped, capColor: '#ff00ff', transform });
        v.camera.fit({ min: [-7, -7, -7], max: [7, 7, 7] }, v.aspect);
        if (cut) v.clipPlanes = [{ normal: [0, 1, 0], offset: 0, cap: '#ff00ff' }];
        const img = await v.capture(), W = img.width, H = img.height, cpu = new Uint8Array(W * H);
        if (cut) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = v.raycast(x + 0.5, y + 0.5); if (h && h.cap) cpu[y * W + x] = 1; }
        // (The frame time: 20 captures, each a frame and its read-back.)
        const t0 = performance.now(); for (let k = 0; k < 20; k++) await v.capture(); const ms = (performance.now() - t0) / 20;
        v.dispose();
        return { data: img.data, W, H, cpu, ms };
      };
      const out = [];
      for (const [name, surface, transform] of cases) {
        const on = await draw(surface, transform, true, true), off = await draw(surface, transform, false, true), { W, H, cpu } = on;
        let interior = 0, worst = 0, edge = 0, covered = 0;
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          let all = true, any = false;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = cpu[(y + dy) * W + x + dx]; all = all && !!c; any = any || !!c; }
          const i = (y * W + x) * 4;
          if (all) { interior++; for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(on.data[i + k] - off.data[i + k])); continue; }
          if (!any) continue;
          // (A pixel on the cap's edge: cap and not cap in its neighbourhood. Covered: a mix of the cap's magenta and what is beside it.)
          edge++;
          const r = on.data[i], g = on.data[i + 1], b = on.data[i + 2], pureCap = r >= 245 && b >= 245 && g <= 10, pureOther = Math.abs(r - g) <= 2 && Math.abs(g - b) <= 2;
          if (!pureCap && !pureOther && r > g + 20 && b > g + 20) covered++;
        }
        const uncutOn = await draw(surface, transform, true, false, true), uncutOff = await draw(surface, transform, true, false, false);
        let differ = 0; for (let k = 0; k < uncutOn.data.length; k++) if (uncutOn.data[k] !== uncutOff.data[k]) differ++;
        out.push({ name, interior, worst, edge, covered, share: edge ? covered / edge : 0, uncutDiffer: differ, msCut: on.ms, msUncut: uncutOn.ms, msNoAA: off.ms, W, H });
      }
      return out;
    });
    const load = loadavg().map(x => x.toFixed(1)).join(' ');
    for (const c of r) {
      // (capFrontSamples: an rgba16float MSAA target, 8 bytes a sample, 4 samples, for a capped frame only.)
      const bytes = c.W * c.H * 4 * 8;
      t.diagnostic(`${c.name}: interior ${c.interior} px, worst |Δ| ${c.worst}/255; edge ${c.edge} px, ${c.covered} partly covered (${(100 * c.share).toFixed(0)} %); uncut frame ${c.uncutDiffer} bytes differ; capFrontSamples ${(bytes / 1048576).toFixed(2)} MiB at ${c.W}×${c.H}; frame ${c.msCut.toFixed(1)} ms cut, ${c.msUncut.toFixed(1)} ms uncut, ${c.msNoAA.toFixed(1)} ms cut without AA (load ${load})`);
      assert.ok(c.interior > 1000, `${c.name}: ${c.interior} interior pixels`);
      assert.ok(c.worst <= 1, `${c.name}: the interior differs by ${c.worst}/255 with antialiasing`);
      if (c.name !== 'box 0°') assert.ok(c.share >= 0.3, `${c.name}: ${(100 * c.share).toFixed(0)} % of the edge partly covered`);
      assert.equal(c.uncutDiffer, 0, `${c.name}: the cap path changes an uncut frame`);
    }
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});
