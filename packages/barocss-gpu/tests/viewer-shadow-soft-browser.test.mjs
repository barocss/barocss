// G15b in a real browser's WebGPU: soft shadows (PCSS — a tall post's shadow on the ground, sharp at its foot and wider
// toward its tip as the light's size grows) and contact shadows (the crease under a box darkened with the shadow map off).
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --test tests/viewer-shadow-soft-browser.test.mjs
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

test('soft shadows and contact shadows (G15b)', { timeout: 120000 }, async t => {
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
      const box = (sx, sy, sz, at) => {
        const P = [], N = [], I = [];
        for (const [axis, s] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
          const u = (axis + 1) % 3, v = (axis + 2) % 3, base = P.length / 3, h = [sx / 2, sy / 2, sz / 2];
          for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = [0, 0, 0]; q[axis] = s * h[axis]; q[u] = a * h[u]; q[v] = b * h[v] * s; P.push(q[0] + at[0], q[1] + at[1], q[2] + at[2]); const n = [0, 0, 0]; n[axis] = s; N.push(...n); }
          I.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
        return { positions: P, normals: N, indices: I };
      };
      // A ground, a thin tall post on it (its shadow falls along +X), looked at from straight above.
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#000000', camera: { position: [4, 0, 30], target: [4, 0, 0], up: [0, 1, 0] },
        lights: [{ kind: 'directional', direction: [1, 0, -1], intensity: 2, castShadow: true }], environment: { ambient: 0.15, toneMapping: 'none' } });
      viewer.add({ positions: [-6, -6, 0, 14, -6, 0, 14, 6, 0, -6, 6, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3] }, { material: { color: '#ffffff', roughness: 1 } });
      const post = viewer.add(box(0.6, 0.6, 8, [0, 0, 4]), { material: { color: '#ffffff', roughness: 1 } });
      viewer.fit({ min: [-6, -6, 0], max: [14, 6, 0] });
      const grab = async () => { await viewer.frame(); return viewer.capture(); };
      const screen = (q) => { const m = viewer.camera.viewProjection(viewer.aspect), c = [0, 1, 3].map(k => m[k] * q[0] + m[4 + k] * q[1] + m[8 + k] * q[2] + m[12 + k]); return [(c[0] / c[2] * 0.5 + 0.5) * canvas.width, (0.5 - c[1] / c[2] * 0.5) * canvas.height]; };
      const lum = (img, x, y) => img.data[(Math.round(y) * img.width + Math.round(x)) * 4];
      // (Across the shadow at a distance x along it: how many pixels it takes from 10% to 90% of the way from lit to shaded.)
      const edge = (img, x) => {
        const [sx, sy] = screen([x, 0, 0]), [, top] = screen([x, 2, 0]), half = Math.abs(sy - top), col = [];
        for (let y = sy - half; y <= sy + half; y++) col.push(lum(img, sx, y));
        const lit = Math.max(...col), dark = Math.min(...col), lo = dark + 0.1 * (lit - dark), hi = dark + 0.9 * (lit - dark);
        let n = 0; for (let k = 0; k < col.length >> 1; k++) if (col[k] > lo && col[k] < hi) n++;
        return { width: n, lit, dark };
      };
      const hard = await grab(), out = { hard: { near: edge(hard, 1.5), far: edge(hard, 7.5) } };
      viewer.environment = { ...viewer.environment, softShadows: 6 };
      const soft = await grab(); out.soft = { near: edge(soft, 1.5), far: edge(soft, 7.5) };
      // Contact shadows: the post gone, a low box on the ground casting no shadow-map shadow, the light low from +X; the
      // ground just beside the box away from the light (its crease) with and without them.
      post.remove();
      viewer.add(box(3, 3, 1, [4, 0, 0.5]), { material: { color: '#ffffff', roughness: 1 }, castShadow: false });
      viewer.environment = { ambient: 0.4, toneMapping: 'none' };
      viewer.lights = [{ kind: 'directional', direction: [-1, 0, -0.35], intensity: 2, castShadow: true }];
      const crease = async () => { const img = await grab(), [x, y] = screen([2.35, 0, 0]); return lum(img, x, y); };
      out.crease = { without: await crease() };
      viewer.environment = { ...viewer.environment, contactShadows: { length: 0.6, strength: 0.7 } };
      out.crease.with = await crease();
      const [fx, fy] = screen([10, 3, 0]); out.crease.away = lum(await grab(), fx, fy);
      return out;
    });
    t.diagnostic(JSON.stringify(r));
    // Hard: a sharp edge along the whole shadow. Soft: still sharp at the post's foot, wider toward its tip.
    assert.ok(r.hard.near.lit - r.hard.near.dark > 60, `a shadow found: ${JSON.stringify(r.hard.near)}`);
    assert.ok(r.hard.far.width <= 4, `hard: a sharp edge far along it (${r.hard.far.width} px)`);
    // Soft (PCSS): wider than hard, and contact-hardening — dark at the post's foot, lighter toward its tip, where the
    // light's size spans more than the post's width (no umbra left); the hard shadow equally dark along its length.
    assert.ok(Math.abs(r.hard.far.dark - r.hard.near.dark) <= 10, `hard: as dark along it (${r.hard.near.dark}, ${r.hard.far.dark})`);
    assert.ok(r.soft.far.width >= r.hard.far.width + 2, `soft: a penumbra (${r.soft.far.width} px against ${r.hard.far.width})`);
    assert.ok(r.soft.near.dark <= r.hard.near.dark + 10 && r.soft.far.dark > r.soft.near.dark + 30, `soft: dark at the foot, lighter toward the tip (${r.soft.near.dark} → ${r.soft.far.dark})`);
    // Contact shadows: the crease darker, the open ground unchanged by them.
    assert.ok(r.crease.with < r.crease.without - 15, `the crease darkened: ${r.crease.without} → ${r.crease.with}`);
    assert.ok(r.crease.away > 100, `open ground lit: ${r.crease.away}`);
    assert.deepEqual(errors.filter(e => !/powerPreference/.test(e)), []);
  } finally {
    await browser.close(); await server.close();
  }
});
