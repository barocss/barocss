// CHROME=/path/to/chrome PW_DIR=/path/to/playwright node --test tests/viewer-shadow-multi-browser.test.mjs
// GPU_SHADOW_MULTI_EVIDENCE_DIR retains a fresh result/error directory and visible captured GPU images.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/', import.meta.url));

test('each directional shadow layer occludes its own light, including off-camera caps and device recovery', { timeout: 120000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR required'); return; }
  const server = createServer(async (req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><style>body{margin:0;background:#222;color:white;font:12px sans-serif}#c{width:320px;height:240px}#images{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0}figure canvas{display:block;width:320px;height:240px}</style><canvas id="c"></canvas><div id="images"></div>');
      return;
    }
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const base = req.url?.startsWith('/cad/') ? cad : dist;
    const file = resolve(base, '.' + (base === cad ? req.url.slice(4) : (req.url ?? '')));
    if (!file.startsWith(base)) { res.writeHead(404); res.end(); return; }
    try { res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(file)); } catch { res.writeHead(404); res.end(); }
  });
  let browser, page, evidence;
  const errors = [];
  try {
    if (process.env.GPU_SHADOW_MULTI_EVIDENCE_DIR) {
      await mkdir(process.env.GPU_SHADOW_MULTI_EVIDENCE_DIR, { recursive: true });
      evidence = await mkdtemp(join(process.env.GPU_SHADOW_MULTI_EVIDENCE_DIR, 'directional-shadows-'));
      t.diagnostic(`evidence: ${evidence}`);
    }
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    if (!await page.evaluate(async () => !!await navigator.gpu?.requestAdapter())) { t.skip('no WebGPU adapter'); return; }
    const result = await page.evaluate(async () => {
      const api = await import('/viewer/index.js');
      const canvas = document.getElementById('c');
      const red = { kind: 'directional', direction: [0, 0, -1], color: '#ff0000', intensity: 0.5, castShadow: true };
      const green = { kind: 'directional', direction: [-1.25, 0, -1], color: '#00ff00', intensity: 0.7, castShadow: true };
      const viewer = await api.createViewer(canvas, {
        controls: false, autoResize: false, antialias: false, pixelRatio: 1, background: '#000000',
        camera: { position: [0, 0, 20], target: [0, 0, 0], up: [0, 1, 0], projection: 'orthographic' },
        lights: [red, green], environment: { ambient: 0, toneMapping: 'none', softShadows: 0 },
      });
      let disposed = false;
      try {
        viewer.resize(1); viewer.camera.halfHeight = 2.5; viewer.shadowMapSize = 1024;
        const box = (sx, sy, sz, at) => {
          const positions = [], normals = [], indices = [];
          for (const [axis, sign] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
            const u = (axis + 1) % 3, v = (axis + 2) % 3, base = positions.length / 3, half = [sx / 2, sy / 2, sz / 2];
            for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
              const p = [0, 0, 0], n = [0, 0, 0]; p[axis] = sign * half[axis]; p[u] = a * half[u]; p[v] = b * half[v] * sign; n[axis] = sign;
              positions.push(...p.map((value, k) => value + at[k])); normals.push(...n);
            }
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
          return { positions, normals, indices };
        };
        const receiver = viewer.add({ positions: [-3.3, -2.4, 0, 3.3, -2.4, 0, 3.3, 2.4, 0, -3.3, 2.4, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3] },
          { material: { color: '#ffffff', roughness: 1 }, castShadow: false, clipped: false });
        const blocker = viewer.add(box(1, 1, 1, [5, 0, 4]), { material: { color: '#ffffff', roughness: 1 }, cap: true });
        const project = q => {
          const matrix = viewer.camera.viewProjection(viewer.aspect);
          const clip = [0, 1, 3].map(k => matrix[k] * q[0] + matrix[4 + k] * q[1] + matrix[8 + k] * q[2] + matrix[12 + k]);
          return [(clip[0] / clip[2] * 0.5 + 0.5) * canvas.width, (0.5 - clip[1] / clip[2] * 0.5) * canvas.height];
        };
        const offCamera = [4.5, 5.5].flatMap(x => [-0.5, 0.5].flatMap(y => [3.5, 4.5].map(z => project([x, y, z]))));
        const retain = (name, frame) => {
          const figure = document.createElement('figure'), label = document.createElement('figcaption'), proof = document.createElement('canvas');
          label.textContent = name; proof.width = frame.width; proof.height = frame.height;
          proof.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
          figure.append(label, proof); document.getElementById('images').append(figure); return frame;
        };
        const capture = async name => { viewer.requestRender(); await viewer.frame(); return retain(name, await viewer.capture()); };
        const patch = image => {
          const [x, y] = project([0, 0, 0]).map(Math.round), sum = [0, 0, 0];
          for (let j = y - 3; j <= y + 3; j++) for (let i = x - 3; i <= x + 3; i++) for (let c = 0; c < 3; c++) sum[c] += image.data[(j * image.width + i) * 4 + c];
          return sum.map(value => value / 49);
        };
        const difference = (a, b) => {
          let pixels = 0;
          for (let i = 0; i < a.data.length; i += 4) if ([0, 1, 2].some(c => Math.abs(a.data[i + c] - b.data[i + c]) > 2)) pixels++;
          return pixels;
        };
        const frames = {}, samples = {};
        const record = async name => { const frame = await capture(name); frames[name] = frame; samples[name] = patch(frame); return frame; };
        await record('both');
        viewer.lights = [{ ...red, castShadow: false }, { ...green, castShadow: false }]; await record('zero');
        viewer.lights = [red, { ...green, castShadow: false }]; await record('first only');
        viewer.lights = [{ ...red, castShadow: false }, green]; await record('second only');
        viewer.lights = [red, green]; blocker.castShadow = false; await record('caster off'); blocker.castShadow = true;
        receiver.receiveShadow = false; await record('receiver off'); receiver.receiveShadow = true;
        await record('restored');
        viewer.lights = [green, red]; await record('reordered');
        const dark = { ...red, intensity: 0, castShadow: false };
        viewer.lights = [red, dark, dark, green]; await record('fourth layer');
        viewer.environment = { ambient: 0, toneMapping: 'none', softShadows: 6 }; await record('soft six degrees');
        viewer.environment = { ambient: 0, toneMapping: 'none', softShadows: 0 };
        // Keep z <= 4. The new top at z=4 is a cap, facing the green light. Compare its shadow with a literal half-box.
        viewer.clipPlane = { normal: [0, 0, -1], offset: -4, cap: '#ffffff' }; await record('clipped cap');
        blocker.visible = false; viewer.clipPlane = null;
        viewer.add(box(1, 1, 0.5, [5, 0, 3.75]), { material: { color: '#ffffff', roughness: 1 } }); await record('literal half box');
        const threshold = samples.zero[1] * 0.6;
        let capMaskDifference = 0, capShadowPixels = 0;
        for (let i = 0; i < frames['clipped cap'].data.length; i += 4) {
          // Ignore background; the red channel identifies the receiver independently of the green shadow.
          if (frames.zero.data[i] < 20) continue;
          const a = frames['clipped cap'].data[i + 1] < threshold, b = frames['literal half box'].data[i + 1] < threshold;
          if (a !== b) capMaskDifference++;
          if (a) capShadowPixels++;
        }
        const capBoundaryBudget = Math.ceil(4 * (1 + 1.625) * canvas.height / (2 * viewer.camera.halfHeight));
        const beforeLoss = viewer.stats.deviceLosses;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => { viewer.onRecover = null; reject(new Error('Device recovery exceeded 10 seconds')); }, 10000);
          viewer.onRecover = () => { clearTimeout(timeout); viewer.onRecover = null; resolve(); };
          viewer.loseDeviceForTesting();
        });
        await record('recovered');
        const recoveryLosses = viewer.stats.deviceLosses - beforeLoss;
        viewer.dispose(); disposed = viewer.computeDevice === null;
        return { size: [canvas.width, canvas.height], offCamera, samples,
          softChangedPixels: difference(frames['soft six degrees'], frames['fourth layer']),
          capMaskDifference, capBoundaryBudget, capShadowPixels,
          clipChangedPixels: difference(frames['clipped cap'], frames['fourth layer']), recoveryLosses, disposed };
      } finally { if (!disposed) viewer.dispose(); }
    });
    t.diagnostic(JSON.stringify({ result, errors }));
    if (evidence) {
      await writeFile(join(evidence, 'result.json'), JSON.stringify({ result, errors }, null, 2), { flag: 'wx' });
      await page.screenshot({ path: join(evidence, 'images.png'), fullPage: true });
    }
    const delta = (a, b) => Math.max(...a.map((value, i) => Math.abs(value - b[i])));
    const samples = result.samples;
    assert.deepEqual(result.size, [320, 240]);
    assert.ok(result.offCamera.every(([x]) => x > result.size[0]), 'every blocker corner lies outside the camera on the right');
    assert.ok(samples.zero[1] > 40, `the independent unshadowed green channel is lit: ${samples.zero}`);
    assert.ok(samples.both[1] < samples.zero[1] * 0.45, `the second directional light casts its own shadow: ${JSON.stringify(samples)}`);
    assert.ok(Math.abs(samples.both[0] - samples.zero[0]) <= 2, 'the second light shadow must not dim the first red light');
    for (const name of ['first only', 'caster off', 'receiver off']) assert.ok(delta(samples[name], samples.zero) <= 2, `${name}: the green light is independently unblocked`);
    for (const name of ['second only', 'restored', 'reordered', 'fourth layer']) assert.ok(delta(samples[name], samples.both) <= 2, `${name}: light index changes preserve the expected shadow`);
    assert.ok(samples['soft six degrees'][1] < samples.zero[1] * 0.6, 'PCSS keeps the interior of the second-light shadow');
    assert.ok(Math.abs(samples['soft six degrees'][0] - samples.zero[0]) <= 2, 'PCSS of the green light leaves the red channel unchanged');
    assert.ok(result.softChangedPixels > 20, 'nonzero angular size changes the visible penumbra');
    assert.ok(delta(samples['clipped cap'], samples['literal half box']) <= 2, 'the cap and literal kept solid cast the same interior shadow');
    assert.ok(result.capShadowPixels > 200 && result.clipChangedPixels > 20, 'the cap has a visible shadow and clipping changes its footprint');
    assert.ok(result.capMaskDifference <= result.capBoundaryBudget, `cap shadow differs only within the fixed two-pixel outline budget: ${result.capMaskDifference}/${result.capBoundaryBudget}`);
    assert.equal(result.recoveryLosses, 1);
    assert.ok(delta(samples.recovered, samples['literal half box']) <= 2, 'device recovery restores the fourth light shadow layer');
    assert.equal(result.disposed, true); assert.deepEqual(errors, []);
  } catch (error) {
    if (evidence) {
      await writeFile(join(evidence, 'first-error.txt'), String(error?.stack ?? error), { flag: 'wx' });
      if (page) await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true });
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(r => server.close(r));
  }
});
