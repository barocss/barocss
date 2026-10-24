// G15a in a real browser's WebGPU: the surface finishes (cast, sand-cast, machined, turned, brushed, knurled, blasted), the
// brushed highlight stretched across its marks, a clear coat's sharp highlight over a rough base, an oil film's colours,
// the marks fading into roughness when finer than a pixel, and a finish that stays on its mesh as the mesh moves.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --test tests/viewer-finish-browser.test.mjs
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

test('surface finishes, a clear coat and an oil film (G15a)', { timeout: 120000 }, async t => {
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
      // A square 4 across, looked at from straight above; a point light just above the eye, so its highlight is in the middle.
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#000000', camera: { position: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0] },
        lights: [{ kind: 'point', position: [0, 0, 5], intensity: 4 }], environment: { ambient: 0.2, toneMapping: 'none' } });
      const square = viewer.add({ positions: [-2, -2, 0, 2, -2, 0, 2, 2, 0, -2, 2, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3] }, { material: { color: '#b8b8b8', metallic: 1, roughness: 0.35 } });
      viewer.fit({ min: [-2, -2, 0], max: [2, 2, 0] });
      const grab = async () => { await viewer.frame(); return viewer.capture(); };
      const lum = (img, x, y) => { const i = (y * img.width + x) * 4; return (img.data[i] * 0.2126 + img.data[i + 1] * 0.7152 + img.data[i + 2] * 0.0722); };
      // (The middle 120 px: the luminance's spread, the brightest, the mean chroma; the highlight's extent along x and y.)
      const stats = img => {
        const cx = img.width >> 1, cy = img.height >> 1, v = [];
        let chroma = 0, peak = 0;
        for (let y = cy - 60; y < cy + 60; y++) for (let x = cx - 60; x < cx + 60; x++) {
          const l = lum(img, x, y), i = (y * img.width + x) * 4; v.push(l); peak = Math.max(peak, l);
          chroma += Math.max(img.data[i], img.data[i + 1], img.data[i + 2]) - Math.min(img.data[i], img.data[i + 1], img.data[i + 2]);
        }
        const mean = v.reduce((a, b) => a + b, 0) / v.length;
        // (The marks: how much a pixel differs from its neighbours — the highlight's slow fall-off barely counts.)
        let spread = 0; for (let y = 0; y < 119; y++) for (let x = 0; x < 119; x++) spread += Math.abs(v[y * 120 + x + 1] - v[y * 120 + x]) + Math.abs(v[(y + 1) * 120 + x] - v[y * 120 + x]);
        spread /= 119 * 119;
        // (The highlight's half-peak width through the middle, on blurred rows and columns so the marks don't break it.)
        const half = (f) => { let n = 0; for (let k = -150; k <= 150; k++) { let s = 0; for (let j = -4; j <= 4; j++) s += f(k, j); if (s / 9 > peak * 0.5) n++; } return n; };
        return { spread, peak, mean, chroma: chroma / v.length, wx: half((k, j) => lum(img, cx + k, cy + j)), wy: half((k, j) => lum(img, cx + j, cy + k)) };
      };
      const out = { plain: stats(await grab()) };
      for (const kind of api.SURFACE_FINISHES) { square.material = { finish: { kind, scale: 0.25, strength: 1, axis: [1, 0, 0] } }; out[kind] = stats(await grab()); }
      // A rough red plastic, then the same under a clear coat.
      square.material = { finish: null, color: '#a02020', metallic: 0, roughness: 0.9 }; out.rough = stats(await grab());
      square.material = { clearcoat: 1 }; out.coat = stats(await grab());
      square.material = { clearcoat: 0, color: '#b8b8b8', metallic: 1, roughness: 0.3, film: 1 }; out.film = stats(await grab());
      // Marks a hundredth of a pixel wide: the relief gone, only roughness.
      square.material = { film: 0, finish: { kind: 'cast', scale: 0.0004, strength: 1 } }; out.fine = stats(await grab());
      // The finish stays on the mesh: moved, and the camera with it, the picture is the same.
      square.material = { finish: { kind: 'sand-cast', scale: 0.4, strength: 1 } };
      viewer.lights = [{ kind: 'directional', direction: [0.3, 0.2, -1], intensity: 2 }];
      // (The camera set as it will be moved — fit() framed the square at the start.)
      viewer.camera.position = [0, 0, 6]; viewer.camera.target = [0, 0, 0];
      const a = await grab();
      square.transform = api.translation([0.37, -0.21, 0]);
      viewer.camera.position = [0.37, -0.21, 6]; viewer.camera.target = [0.37, -0.21, 0];
      const b = await grab();
      // (The mean difference: a pixel's sample point moves by float rounding as the camera does.)
      let diff = 0; for (let i = 0; i < a.data.length; i += 4) diff += Math.abs(a.data[i] - b.data[i]); diff /= a.data.length / 4;
      out.moved = { diff };
      return out;
    });
    t.diagnostic(JSON.stringify(r, (k, v) => typeof v === 'number' ? Math.round(v * 10) / 10 : v));
    // Every finish draws, and draws differently from a plain surface: marks give the middle a spread of luminance.
    for (const kind of ['cast', 'sand-cast', 'machined', 'turned', 'brushed', 'knurled', 'blasted']) {
      assert.ok(r[kind].peak > 20, `${kind}: lit`);
      assert.ok(r[kind].spread > r.plain.spread + 1.5, `${kind}: its marks (spread ${r[kind].spread.toFixed(1)} against ${r.plain.spread.toFixed(1)})`);
    }
    assert.ok(r['sand-cast'].peak < r.cast.peak - 20, `sand-cast rougher than cast: its highlight dimmer (${r['sand-cast'].peak.toFixed(0)} against ${r.cast.peak.toFixed(0)})`);
    // Brushed along x: the highlight stretched across the marks (along y), against a round one with no finish.
    assert.ok(Math.abs(r.plain.wx - r.plain.wy) <= 3, `plain: a round highlight (${r.plain.wx} × ${r.plain.wy})`);
    assert.ok(r.brushed.wy > 1.3 * r.brushed.wx, `brushed: stretched across its marks (${r.brushed.wx} × ${r.brushed.wy})`);
    // The clear coat: a sharp highlight over the rough base.
    assert.ok(r.coat.peak > r.rough.peak + 25, `clear coat: ${r.rough.peak.toFixed(0)} → ${r.coat.peak.toFixed(0)}`);
    // The oil film: colours on a grey metal.
    assert.ok(r.film.chroma > r.plain.chroma + 4, `oil film: chroma ${r.plain.chroma.toFixed(1)} → ${r.film.chroma.toFixed(1)}`);
    // Too fine to draw: no more spread than plain (the relief faded into roughness), and a wider, dimmer highlight.
    assert.ok(r.fine.spread < r.cast.spread && r.fine.peak < r.plain.peak, `fine marks: spread ${r.fine.spread.toFixed(1)}, peak ${r.fine.peak.toFixed(0)}`);
    assert.ok(r.moved.diff < 1, `the finish moves with its mesh: ${r.moved.diff.toFixed(2)} a pixel`);
    assert.deepEqual(errors.filter(e => !/powerPreference/.test(e)), []);
  } finally {
    await browser.close(); await server.close();
  }
});
