// O10, the viewer's frame costs (Viewer.costs, meshCosts), browser acceptance. Off: no record, and the frame's stats the
// same as with them on. On: each mesh's draws, primitives and passes are what it draws — a box's 12 triangles in the
// main pass, its 24 edges there and again behind the surfaces (lineHidden), three copies in one draw 36 triangles, a
// see-through box in the order-independent pass, the shadow map's casters only when it is drawn again; the main pass's
// counts add up to FrameStats; records are kept from frame to frame and dropped with their mesh.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --import ./tests/cad-dist.mjs --test tests/viewer-costs-browser.test.mjs
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
  files.set('/core/barocss-error.js', path.join(dist, '../core/barocss-error.js')); // (R7.3a: the viewer refuses with the package's one BarocssError.)
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


test('O10 frame costs: off, nothing kept and the same stats; on, each mesh\'s draws, primitives and passes, kept between frames and dropped with the mesh', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api } = window, canvas = document.getElementById('c');
      const v = await api.createViewer(canvas, { pixelRatio: 1, background: '#000000', camera: { position: [30, -40, 25], target: [0, 0, 0], up: [0, 0, 1] }, lights: [{ kind: 'directional', direction: [-0.3, 0.4, -1], castShadow: true }] });
      const b = window.box(4, 4, 4), at = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
      const surface = v.add(b.surface, { material: { color: '#a0a0a0' } });
      const edges = v.add(b.edges, { material: { color: '#ffffff', unlit: true, lineHidden: 0.5 }, castShadow: false, pickable: false });
      const copies = v.add(b.surface, { material: { color: '#8080ff' }, instances: { transforms: [...at(8, 0, 0), ...at(8, 8, 0), ...at(0, 8, 0)] } });
      const glass = v.add(b.surface, { material: { color: '#ff8080', opacity: 0.4 }, transform: at(-8, 0, 0) });
      v.camera.fit({ min: [-12, -4, -4], max: [12, 12, 4] }, v.aspect);
      const copy = c => c && { draws: c.draws, triangles: c.triangles, lines: c.lines, points: c.points, passes: { ...c.passes } };
      const stats = () => ({ drawCalls: v.stats.drawCalls, triangles: v.stats.triangles, lines: v.stats.lines, points: v.stats.points });
      // (Off: two frames, the second with the shadow map as it was.)
      v.render(); v.render();
      const off = { size: v.meshCosts().size, stats: stats(), cost: surface.cost };
      // (On, a caster moved: the shadow map is drawn again.)
      v.costs = true; surface.transform = at(0, 0, 0.5);
      v.render();
      const moved = { stats: stats(), surface: copy(v.meshCosts().get(surface)), size: v.meshCosts().size };
      const record = v.meshCosts().get(surface);
      v.render();
      const same = { stats: stats(), surface: copy(v.meshCosts().get(surface)), edges: copy(v.meshCosts().get(edges)), copies: copy(v.meshCosts().get(copies)), glass: copy(v.meshCosts().get(glass)), kept: v.meshCosts().get(surface) === record };
      // (The main pass's counts, as FrameStats counts them: surface, transparent and order-independent.)
      let tris = 0, lines = 0;
      for (const c of v.meshCosts().values()) { const per = c.draws ? 1 / c.draws : 0; tris += c.triangles * per * (c.passes.surface + c.passes.transparent + c.passes.oit); lines += c.lines * per * (c.passes.surface + c.passes.transparent); }
      v.remove(glass); v.render();
      const removed = { has: v.meshCosts().has(glass), size: v.meshCosts().size, cost: glass.cost }, last = copy(v.meshCosts().get(surface));
      v.costs = false; v.render();
      const offAgain = { stats: stats(), surface: copy(v.meshCosts().get(surface)) };
      v.dispose();
      return { off, moved, same, sums: { tris, lines }, removed, last, offAgain };
    });
    t.diagnostic(JSON.stringify(r));
    const { off, moved, same, sums, removed, last, offAgain } = r;
    assert.deepEqual([off.size, off.cost], [0, null]);
    // (Counting changes nothing drawn: the same stats.)
    assert.deepEqual(same.stats, off.stats);
    // (A caster moved: the shadow map is drawn again, the box in it.)
    assert.deepEqual(moved.surface, { draws: 2, triangles: 24, lines: 0, points: 0, passes: { shadow: 1, surface: 1, transparent: 0, oit: 0, hiddenLines: 0, caps: 0, outlineMask: 0 } });
    assert.equal(moved.size, 4);
    // (Nothing moved: the shadow map kept, so no shadow draws — zeroed, not carried over.)
    const pass = (o) => ({ shadow: 0, surface: 0, transparent: 0, oit: 0, hiddenLines: 0, caps: 0, outlineMask: 0, ...o });
    assert.deepEqual(same.surface, { draws: 1, triangles: 12, lines: 0, points: 0, passes: pass({ surface: 1 }) });
    assert.deepEqual(same.edges, { draws: 2, triangles: 0, lines: 48, points: 0, passes: pass({ surface: 1, hiddenLines: 1 }) });
    assert.deepEqual(same.copies, { draws: 1, triangles: 36, lines: 0, points: 0, passes: pass({ surface: 1 }) });
    assert.deepEqual(same.glass, { draws: 1, triangles: 12, lines: 0, points: 0, passes: pass({ oit: 1 }) });
    assert.ok(same.kept, 'the record is kept from frame to frame');
    assert.deepEqual([sums.tris, sums.lines], [same.stats.triangles, same.stats.lines]);
    assert.deepEqual(removed, { has: false, size: 3, cost: null });
    // (Off again: the last counted frame's records stay — the removal's, the shadow map drawn again for the smaller
    // scene — and nothing more is counted.)
    assert.equal(last.passes.shadow, 1);
    assert.deepEqual(offAgain.surface, last);
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});
