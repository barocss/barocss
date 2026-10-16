// The native viewers in a real browser's WebGPU, from the examples' original CAD documents: authored
// directional and point lights and UV01 materials drawn and picked by surface, a replacement with the
// lights off, a resize, and the Viewer's native appearance with a material.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --test tests/viewer-native-browser.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}canvas{display:block;width:160px;height:120px}</style><canvas id="c"></canvas>`;

async function serve() {
  const bundle = await build({ entryPoints: [path.join(here, 'fixtures/native-entry.ts')], bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022' });
  const server = createServer((req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
    if (req.url === '/native.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(bundle.outputFiles[0].contents); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

test('native light and UV01 viewers and the native appearance draw on WebGPU', { timeout: 180000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR are required'); return; }
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true,
    args: process.env.VIEWER_ADAPTER === 'swiftshader' ? ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'] : ['--enable-unsafe-webgpu'] });
  const errors = [];
  try {
    const p = await browser.newPage();
    p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(server.url + '/');
    if (!await p.evaluate(async () => !!(await navigator.gpu?.requestAdapter()))) { t.skip('no WebGPU adapter'); return; }

    const r = await p.evaluate(async () => {
      const api = await import('/native.js');
      const size = { width: 160, height: 120 };
      // Lit pixels (away from the background) and their mean colour.
      const lit = (data, bg) => {
        let n = 0; const sum = [0, 0, 0];
        for (let i = 0; i < data.length; i += 4) {
          if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) <= 12) continue;
          n++; for (let k = 0; k < 3; k++) sum[k] += data[i + k];
        }
        return { n, mean: sum.map(v => Math.round(v / Math.max(1, n))) };
      };
      const firstHit = async v => {
        for (let y = 4; y < 120; y += 6) for (let x = 4; x < 160; x += 6) { const h = await v.pick(x, y); if (h.ref) return h; }
        return null;
      };
      const out = {};
      const seed = api.directionalSeed(), bgOf = s => s.context.background.map(c => Math.round(c * 255));

      const fresh = () => { const c = document.createElement('canvas'); document.body.append(c); return c; };
      const dir = await api.createNativeDirectionalLightWebGPUViewer(fresh(), seed, size);
      const d0 = await dir.readPixels();
      out.directional = { length: d0.length, ...lit(d0, bgOf(seed)), status: dir.status.state };
      const hit = await firstHit(dir);
      out.directionalPick = hit && hit.ref;
      const dark = structuredClone(seed); dark.lights.lights.forEach(l => { l.enabled = false; });
      out.replaced = await dir.replace(dark);
      out.dark = lit(await dir.readPixels(), bgOf(seed));
      out.resized = await dir.resize(80, 60);
      out.resizedLength = (await dir.readPixels()).length;
      dir.dispose();

      const point = { ...structuredClone(seed), format: 'barocss-viewer-native-point-light-input', lights: {
        format: 'barocss-gpu-native-point-lights', version: 0, profile: 'native-world-point-linear-v0', sourceId: 'two-surface-light-study',
        revision: -0, ambientStrength: 0.1, lights: [{ nodeId: 'lamp', label: 'Lamp', enabled: true, positionScene: [0, 2, 8], colorLinearRGB: [1, 1, 1], intensity: 3, rangeScene: 40 }] } };
      const pt = await api.createNativePointLightWebGPUViewer(fresh(), point, size);
      out.point = lit(await pt.readPixels(), bgOf(seed));
      out.pointPick = (await firstHit(pt))?.ref ?? null;
      pt.dispose();

      const uvSeed = api.uv01Seed();
      const uv = await api.createNativeSurfaceUV01WebGPUViewer(fresh(), uvSeed, size);
      const u0 = await uv.readPixels();
      out.uv01 = lit(u0, uvSeed.context.background.map(c => Math.round(c * 255)));
      const colors = new Set(); for (let i = 0; i < u0.length; i += 4) colors.add(`${u0[i] >> 4},${u0[i + 1] >> 4},${u0[i + 2] >> 4}`);
      out.uv01Colors = colors.size;
      out.uv01Pick = (await firstHit(uv))?.ref ?? null;
      uv.dispose();

      // The Viewer's native appearance: the same document with its material, lit by a MeshLighting.
      const canvas = fresh(); canvas.width = 160; canvas.height = 120;
      const viewer = await api.createViewer(canvas, { mmToSceneUnit: 1, background: seed.context.background });
      viewer.loadNativeSceneAppearance({ version: 1, source: seed.source, display: seed.display,
        appearance: { lighting: { ambientStrength: 0.3, directionalStrength: 0.7, direction: [0, 0.5, 1] }, materials: seed.materials } });
      out.appearance = lit(await viewer.readPixels(), bgOf(seed));
      out.appearanceState = viewer.getState().surfaceMaterials.length;
      viewer.dispose();
      return out;
    });
    t.diagnostic(JSON.stringify(r));
    assert.equal(r.directional.length, 160 * 120 * 4);
    assert.equal(r.directional.status, 'ready');
    assert.ok(r.directional.n > 500, 'the lit surfaces cover the view');
    // The surfaces face +Z, away from the red +X light: the blue +Z light shows.
    assert.ok(r.directional.mean[2] > r.dark.mean[2] + 20 && r.directional.mean[2] > r.directional.mean[0], 'the blue authored light');
    assert.ok(r.directionalPick && r.directionalPick.kind === 'surface', 'a pick finds an accepted surface');
    assert.deepEqual(r.replaced, { ok: true });
    assert.ok(r.dark.mean.reduce((a, b) => a + b) < r.directional.mean.reduce((a, b) => a + b), 'lights off is darker');
    assert.deepEqual(r.resized, { ok: true });
    assert.equal(r.resizedLength, 80 * 60 * 4);
    assert.ok(r.point.n > 500 && r.pointPick, 'point-lit surfaces drawn and picked');
    assert.ok(r.point.mean.reduce((a, b) => a + b) > r.dark.mean.reduce((a, b) => a + b) + 30, 'the point light lights them');
    assert.ok(r.uv01.n > 500 && r.uv01Colors > 20 && r.uv01Pick, 'UV01 materials vary over the surfaces');
    assert.ok(r.appearance.n > 500);
    assert.equal(r.appearanceState, 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
