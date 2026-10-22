// G25b (G-R12), experimental compute on WebGPU: the access pass's masks (six rays a sample) against its CPU mirror on the
// same packed words and samples — every sample's mask the same but for samples within f32 of a grazing ray (at most 1 in
// 10 000), and the per-triangle shares within 1e-3; on a box with a sealed cavity and a 20 000-triangle sphere shell;
// GPU and CPU times reported (load stated).
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --import ./tests/cad-dist.mjs --test tests/compute-access-browser.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { loadavg } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.resolve(here, '../dist/index.js'), cadDist = path.resolve(here, '../../barocss-cad/dist');
const page = '<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><body></body>';

test('G25b access on WebGPU equals its CPU mirror per sample and per triangle', { timeout: 240000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR are required'); return; }
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = createServer(async (req, res) => {
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
    if (req.url === '/gpu.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(bundle)); return; }
    if (/^\/cad\/[\w./-]+\.js$/.test(req.url) && !req.url.includes('..')) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(path.join(cadDist, req.url.slice(5)))); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
  try {
    const p = await browser.newPage(), errors = [];
    p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(`http://127.0.0.1:${server.address().port}/`);
    if (!await p.evaluate(async () => !!(await navigator.gpu?.requestAdapter()))) { t.skip('no WebGPU adapter'); return; }
    const results = await p.evaluate(async () => {
      const { computeExperimental: C } = await import('/gpu.js'), { triangleBvh } = await import('@barocss/cad');
      const device = await (await navigator.gpu.requestAdapter()).requestDevice();
      const box = (lo, hi) => { const P = []; for (let i = 0; i < 8; i++) P.push(i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]); return { positions: P, indices: [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5] }; };
      const shell = (R, r, n) => { const P = [], I = []; for (const [rad, flip] of [[R, false], [r, true]]) { const base = P.length / 3; for (let i = 0; i <= n; i++) for (let j = 0; j <= 2 * n; j++) { const th = Math.PI * i / n, ph = Math.PI * j / n; P.push(rad * Math.sin(th) * Math.cos(ph), rad * Math.sin(th) * Math.sin(ph), rad * Math.cos(th)); } const row = 2 * n + 1; for (let i = 0; i < n; i++) for (let j = 0; j < 2 * n; j++) { const a = base + i * row + j, b = a + 1, d = a + row, e = d + 1; if (flip) I.push(a, b, d, b, e, d); else I.push(a, d, b, b, d, e); } } return { positions: P, indices: I }; };
      const BOXI = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5];
      const cavity = () => { const P = [], I = []; for (const [lo, hi, inward] of [[[0, 0, 0], [40, 30, 20], false], [[10, 10, 5], [30, 20, 15], true]]) { const o = P.length / 3; for (let i = 0; i < 8; i++) P.push(i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]); for (let t = 0; t < 12; t++) { const a = BOXI[3 * t] + o, b = BOXI[3 * t + 1] + o, c = BOXI[3 * t + 2] + o; I.push(...(inward ? [a, c, b] : [a, b, c])); } } return { positions: P, indices: I }; };
      const out = [];
      for (const [name, m, step] of [['box with a sealed cavity', cavity(), 1], ['sphere shell R30 r25, 20k triangles', shell(30, 25, 50), 0.6]]) {
        const packed = C.packBvh(triangleBvh(m.positions, m.indices)), s = C.accessSampleSet(m.positions, m.indices, step);
        let c0 = performance.now(); const cpu = C.cpuAccessMasks(packed, s); const cpuMs = performance.now() - c0;
        await C.gpuAccessMasks(device, packed, s);
        c0 = performance.now(); const gpu = await C.gpuAccessMasks(device, packed, s); const gpuMs = performance.now() - c0;
        let differ = 0; for (let k = 0; k < s.count; k++) if (cpu[k] !== gpu[k]) differ++;
        const a = C.accessByTriangle(s, cpu), b = C.accessByTriangle(s, gpu);
        let worst = 0; for (let t = 0; t < s.triangles; t++) worst = Math.max(worst, Math.abs(a.unreachedShare[t] - b.unreachedShare[t]));
        out.push({ name, samples: s.count, triangles: s.triangles, differ, worst, cpuMs, gpuMs });
      }
      device.destroy();
      return out;
    });
    console.log(`  load ${loadavg().map(x => x.toFixed(1)).join(' ')}`);
    for (const r of results) {
      console.log(`  ${r.name}: ${r.samples} samples on ${r.triangles} triangles, ${r.differ} masks differ, worst share |Δ| ${r.worst.toExponential(2)}, CPU ${r.cpuMs.toFixed(1)} ms, GPU ${r.gpuMs.toFixed(1)} ms`);
      assert.ok(r.differ <= Math.ceil(r.samples / 10000), `${r.name}: ${r.differ} masks differ`);
      assert.ok(r.worst <= 1e-3, `${r.name}: share ${r.worst}`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.close(); }
});
