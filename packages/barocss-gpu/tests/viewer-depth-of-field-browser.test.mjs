import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
async function open(t) {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR required'); return null; }
  const server = createServer(async (req, res) => {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<canvas id="c" style="width:320px;height:240px"></canvas>'); return; }
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const f = resolve(dist, '.' + (req.url ?? ''));
    if (!f.startsWith(dist)) { res.writeHead(404); res.end(); return; }
    try { res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(f)); } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  if (!await page.evaluate(async () => !!await navigator.gpu?.requestAdapter())) { await browser.close(); server.close(); t.skip('no WebGPU adapter'); return null; }
  return { page, errors, close: async () => { await browser.close(); await new Promise(r => server.close(r)); } };
}

for (const projection of ['orthographic', 'perspective']) for (const pixelRatio of [1, 2]) for (const antialias of [false, true]) test(`depth of field ${projection} DPR ${pixelRatio} AA ${antialias}: sharp focus, blurred depth planes, exact off restoration and resize`, { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const result = await s.page.evaluate(async ({ antialias, projection, pixelRatio }) => {
      const api = await import('/viewer/index.js'), canvas = document.getElementById('c');
      const v = await api.createViewer(canvas, { pixelRatio, antialias, background: '#000000', lights: [], camera: { position: [0, 0, 30], target: [0, 0, 0], up: [0, 1, 0], projection } });
      const geometry = (x, z) => {
        const positions = [], colors = [];
        for (let y = 0; y < 16; y++) for (let j = 0; j < 16; j++) {
          const x0 = x - 2 + j / 4, y0 = -2 + y / 4, c = (j + y) % 2 ? 0.95 : 0.02;
          for (const [u, w] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) { positions.push(x0 + u / 4, y0 + w / 4, z); colors.push(c, c, c); }
        }
        return { positions, colors };
      };
      for (const [x, z] of [[-6, 0], [0, 10], [6, -10]]) v.add(geometry(x, z), { material: { color: '#ffffff', unlit: true, twoSided: true } });
      v.camera.fit({ min: [-10, -4, -10], max: [10, 4, 10] }, v.aspect);
      const planes = [{ x: -6, z: 0 }, { x: 0, z: 10 }, { x: 6, z: -10 }];
      const view = v.camera.view(), focus = -view[14];
      const original = await v.capture();
      // Project the actual plane depth, including the perspective homogeneous divide.
      // ROI size is one world unit either side of its centre, safely inside the 4×4 checkerboard.
      const screen = (x, y, z) => {
        const m = v.camera.viewProjection(v.aspect), w = m[3] * x + m[7] * y + m[11] * z + m[15];
        return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5,
          0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5];
      };
      const variation = (img, { x, z }) => {
        const center = screen(x, 0, z), alongX = screen(x + 1, 0, z), alongY = screen(x, 1, z);
        const mid = Math.round(center[0] * img.width), middleY = Math.round(center[1] * img.height);
        const reachX = Math.max(2, Math.floor(Math.abs(alongX[0] - center[0]) * img.width));
        const reachY = Math.max(2, Math.floor(Math.abs(alongY[1] - center[1]) * img.height));
        let sum = 0, count = 0;
        for (let y = middleY - reachY; y < middleY + reachY; y++) for (let k = mid - reachX; k < mid + reachX; k++) {
          const i = (y * img.width + k) * 4; sum += Math.abs(img.data[i] - img.data[i + 4]); count++;
        }
        return sum / count;
      };
      v.environment = { depthOfField: { focus, blur: 24 } };
      const blurred = await v.capture(), size = [v.focusPass.color.width, v.focusPass.color.height];
      const contrasts = planes.map(plane => ({ ...plane, before: variation(original, plane), after: variation(blurred, plane) }));
      v.environment = { depthOfField: { focus, blur: 0 } };
      const restored = await v.capture();
      let different = 0; for (let i = 0; i < original.data.length; i++) if (restored.data[i] !== original.data[i]) different++;
      const released = v.focusPass === null;
      canvas.style.width = '321px'; canvas.style.height = '241px';
      v.resize();
      v.environment = { depthOfField: { focus, blur: 8 }, bloom: { strength: 0.1, threshold: 0.8 } };
      await v.capture();
      const resized = [v.canvas.width, v.canvas.height, v.focusPass.color.width, v.focusPass.color.height];
      v.dispose();
      return { projection, pixelRatio, antialias, focus, backing: [original.width, original.height], size, contrasts, different, released, resized };
    }, { antialias, projection, pixelRatio });
    t.diagnostic(JSON.stringify(result));
    assert.equal(result.different, 0, 'zero blur restores every original pixel');
    assert.equal(result.released, true);
    assert.deepEqual(result.backing, [320 * pixelRatio, 240 * pixelRatio]);
    assert.deepEqual(result.size, [Math.ceil(320 * pixelRatio / 2), Math.ceil(240 * pixelRatio / 2)]);
    assert.ok(Math.abs(result.contrasts[0].after - result.contrasts[0].before) <= 1, 'focus plane contrast stays sharp');
    for (const row of result.contrasts.slice(1)) assert.ok(row.before > 10 && row.after < row.before * 0.8, JSON.stringify(row));
    assert.deepEqual(result.resized, [321 * pixelRatio, 241 * pixelRatio, Math.ceil(321 * pixelRatio / 2), Math.ceil(241 * pixelRatio / 2)]);
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});
