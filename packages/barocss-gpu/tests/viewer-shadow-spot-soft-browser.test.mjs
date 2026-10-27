// CHROME=/path/to/chrome PW_DIR=/path/to/playwright node --test tests/viewer-shadow-spot-soft-browser.test.mjs
// GPU_SHADOW_SPOT_SOFT_EVIDENCE_DIR retains a fresh result/error directory and visible captured GPU images.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/', import.meta.url));

test('spot disk radius gives contact-hardening penumbrae independently of the cone fade', { timeout: 120000 }, async t => {
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
    if (process.env.GPU_SHADOW_SPOT_SOFT_EVIDENCE_DIR) {
      await mkdir(process.env.GPU_SHADOW_SPOT_SOFT_EVIDENCE_DIR, { recursive: true });
      evidence = await mkdtemp(join(process.env.GPU_SHADOW_SPOT_SOFT_EVIDENCE_DIR, 'spot-soft-shadows-'));
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
      const api = await import('/viewer/index.js'), canvas = document.getElementById('c');
      const red = { kind: 'directional', direction: [0, 0, -1], color: '#ff0000', intensity: 0.25, castShadow: true };
      const green = { kind: 'spot', position: [10, 0, 10], direction: [-15, 0, -10], color: '#00ff00', intensity: 150, angle: 30, penumbra: 0.2, range: 40, castShadow: true };
      const viewer = await api.createViewer(canvas, {
        controls: false, autoResize: false, antialias: false, pixelRatio: 1, background: '#000000',
        camera: { position: [-5, 0, 30], target: [-5, 0, 0], up: [0, 1, 0], projection: 'orthographic' },
        lights: [red, green], environment: { ambient: 0, toneMapping: 'none', softShadows: 0 },
      });
      let disposed = false;
      try {
        viewer.resize(1); viewer.camera.fovY = 2 * Math.atan(6 / 30) * 180 / Math.PI; viewer.shadowMapSize = 1024;
        const box = (sx, sy, sz, at) => {
          const positions = [], normals = [], indices = [];
          for (const [axis, sign] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
            const u = (axis + 1) % 3, v = (axis + 2) % 3, base = positions.length / 3, half = [sx / 2, sy / 2, sz / 2];
            for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
              const q = [0, 0, 0], n = [0, 0, 0]; q[axis] = sign * half[axis]; q[u] = a * half[u]; q[v] = b * half[v] * sign; n[axis] = sign;
              positions.push(...q.map((value, k) => value + at[k])); normals.push(...n);
            }
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
          return { positions, normals, indices };
        };
        viewer.add({ positions: [-13, -5.8, 0, 3, -5.8, 0, 3, 5.8, 0, -13, 5.8, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3] },
          { material: { color: '#ffffff', roughness: 1 }, castShadow: false, clipped: false });
        const post = viewer.add(box(0.4, 0.4, 6, [0, 0, 3]), { material: { color: '#ffffff', roughness: 1 }, cap: true });
        const project = q => {
          const m = viewer.camera.viewProjection(viewer.aspect), c = [0, 1, 3].map(k => m[k] * q[0] + m[4 + k] * q[1] + m[8 + k] * q[2] + m[12 + k]);
          return [(c[0] / c[2] * 0.5 + 0.5) * canvas.width, (0.5 - c[1] / c[2] * 0.5) * canvas.height];
        };
        const capture = async name => {
          viewer.requestRender(); await viewer.frame(); const frame = await viewer.capture();
          const figure = document.createElement('figure'), label = document.createElement('figcaption'), proof = document.createElement('canvas');
          label.textContent = name; proof.width = frame.width; proof.height = frame.height;
          proof.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
          figure.append(label, proof); document.getElementById('images').append(figure); return frame;
        };
        const changed = (a, b) => { let count = 0; for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) count++; return count; };
        const linear = value => { const x = value / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
        post.castShadow = false; const clear = await capture('unshadowed beam'); post.castShadow = true;
        const hard = await capture('PCF: radius omitted');
        viewer.lights = [red, { ...green, shadowRadius: 0 }]; const zero = await capture('PCF: radius zero');
        viewer.lights = [red, { ...green, shadowRadius: 0.35 }]; const small = await capture('PCSS: disk radius 0.35');
        const softLight = { ...green, shadowRadius: 0.8 };
        viewer.lights = [red, softLight]; const large = await capture('PCSS: disk radius 0.8');
        const dark = { ...softLight, intensity: 0, castShadow: false };
        viewer.lights = [red, dark, dark, dark, softLight]; const fourth = await capture('PCSS: fourth spot');
        viewer.lights = [{ ...red, castShadow: false }, dark, dark, dark, softLight]; const compact = await capture('PCSS: preceding directional shadow off');
        viewer.lights = [red, softLight]; post.castShadow = false; const clearSoft = await capture('unshadowed beam: disk radius 0.8'); post.castShadow = true;
        viewer.lights = [red, { ...softLight, range: 8 }]; const cutoff = await capture('PCSS: receiver beyond range');
        viewer.lights = [red, dark, dark, dark, softLight];
        // Interior post: original faces x±.2/y±.2/z0/6 are all discarded, leaving cap faces alone.
        viewer.clipPlanes = [
          { normal: [1, 0, 0], offset: -0.1, cap: '#ffffff' }, { normal: [-1, 0, 0], offset: -0.1 },
          { normal: [0, 1, 0], offset: -0.1 }, { normal: [0, -1, 0], offset: -0.1 },
          { normal: [0, 0, 1], offset: 1 }, { normal: [0, 0, -1], offset: -5 },
        ]; const caps = await capture('PCSS: cap-only interior post');
        post.visible = false; viewer.clipPlanes = null;
        viewer.add(box(0.2, 0.2, 4, [0, 0, 3]), { material: { color: '#ffffff', roughness: 1 } }); const literal = await capture('PCSS: literal interior post');
        const beforeLoss = viewer.stats.deviceLosses;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => { viewer.onRecover = null; reject(new Error('Device recovery exceeded 10 seconds')); }, 10000);
          viewer.onRecover = () => { clearTimeout(timeout); viewer.onRecover = null; resolve(); }; viewer.loseDeviceForTesting();
        });
        const recovered = await capture('PCSS: recovered interior post');
        // One fixed positive-Y scanline at each declared X, averaged over three adjacent columns.
        // Decode sRGB and divide by the same unshadowed pixels so cone falloff and inverse-square lighting do not impersonate softness.
        const profile = (image, x, halfWidth = 0.2) => {
          const [sx, sy] = project([x, 0, 0]).map(Math.round), raw = [], clearValues = [], redValues = [];
          for (let step = 0; step <= 40; step++) {
            let share = 0, reference = 0, redValue = 0;
            for (let column = sx - 1; column <= sx + 1; column++) {
              const at = ((sy - step) * image.width + column) * 4;
              share += linear(image.data[at + 1]) / Math.max(linear(clear.data[at + 1]), 1e-8);
              reference += clear.data[at + 1]; redValue += image.data[at];
            }
            raw.push(share / 3); clearValues.push(reference / 3); redValues.push(redValue / 3);
          }
          const values = raw.map((_, i) => { const window = raw.slice(Math.max(0, i - 2), Math.min(raw.length, i + 3)); return window.reduce((sum, value) => sum + value, 0) / window.length; });
          const projectedHalfWidth = halfWidth * (1 + Math.abs(x) / 10) * canvas.height / (2 * viewer.camera.halfHeight);
          const minimum = Math.min(...values.slice(0, Math.ceil(projectedHalfWidth) + 3));
          const start = values.indexOf(minimum), low = minimum + 0.1 * (1 - minimum), high = minimum + 0.9 * (1 - minimum);
          const first = values.findIndex((value, i) => i >= start && value >= low), last = values.findIndex((value, i) => i >= start && value >= high);
          return { x, blockerHeight: 10 * Math.abs(x) / (10 + Math.abs(x)), projectedHalfWidth, minimum, widthPixels: first >= 0 && last >= first ? last - first : -1, end: values.at(-1), minClearGreen: Math.min(...clearValues), red: redValues[0], values };
        };
        const pair = image => ({ near: profile(image, -1.5), far: profile(image, -10) });
        const profiles = { hard: pair(hard), zero: pair(zero), small: pair(small), large: pair(large), fourth: pair(fourth), compact: pair(compact) };
        const capProfiles = { caps: profile(caps, -5, 0.1), literal: profile(literal, -5, 0.1), recovered: profile(recovered, -5, 0.1) };
        const [cx, cy] = project([-1.5, 0, 0]).map(Math.round), cutoffGreen = cutoff.data[(cy * cutoff.width + cx) * 4 + 1];
        const recoveryLosses = viewer.stats.deviceLosses - beforeLoss;
        viewer.dispose(); disposed = viewer.computeDevice === null;
        return { size: [canvas.width, canvas.height], profiles, capProfiles, omittedZeroChangedBytes: changed(hard, zero), unshadowedRadiusChangedBytes: changed(clear, clearSoft), cutoffGreen, recoveryLosses, disposed };
      } finally { if (!disposed) viewer.dispose(); }
    });
    t.diagnostic(JSON.stringify({ result, errors }));
    if (evidence) {
      await writeFile(join(evidence, 'result.json'), JSON.stringify({ result, errors }, null, 2), { flag: 'wx' });
      await page.screenshot({ path: join(evidence, 'images.png'), fullPage: true });
    }
    assert.deepEqual(result.size, [320, 240]);
    assert.equal(result.omittedZeroChangedBytes, 0, 'omitted and zero disk radii preserve every PCF byte');
    assert.equal(result.unshadowedRadiusChangedBytes, 0, 'disk radius does not alter the unshadowed beam cone or intensity');
    const p = result.profiles;
    for (const pair of Object.values(p)) for (const profile of Object.values(pair)) {
      assert.ok(profile.minClearGreen > 40 && profile.widthPixels >= 0 && profile.end > 0.9, `a complete fixed scanline crosses the shadow into the independently lit beam: ${JSON.stringify(profile)}`);
    }
    assert.ok(p.hard.near.minimum < 0.25 && p.hard.far.minimum < 0.25, 'PCF gives a real shadow at both declared projected depths');
    assert.ok(p.large.near.minimum < 0.45 && p.large.far.minimum < 0.9, 'the disk retains a dark contact region and a visible distant shadow');
    assert.ok(p.large.far.widthPixels >= p.large.near.widthPixels + 3, `receiver/blocker separation widens the penumbra: ${p.large.near.widthPixels} -> ${p.large.far.widthPixels}`);
    assert.ok(p.large.far.widthPixels >= p.small.far.widthPixels + 3, `increasing disk radius widens the same distant edge: ${p.small.far.widthPixels} -> ${p.large.far.widthPixels}`);
    assert.ok(p.large.far.widthPixels >= p.hard.far.widthPixels + 3, 'the distant soft edge is wider than the original PCF edge');
    for (const name of ['fourth', 'compact']) for (const side of ['near', 'far']) {
      assert.ok(Math.abs(p[name][side].widthPixels - p.large[side].widthPixels) <= 1, `${name}: metadata slot and compact depth layer keep the measured penumbra`);
      assert.ok(Math.abs(p[name][side].minimum - p.large[side].minimum) <= 0.03, `${name}: shadow strength is preserved`);
    }
    assert.ok(Math.abs(p.large.near.red - p.hard.near.red) <= 2 && Math.abs(p.large.far.red - p.hard.far.red) <= 2, 'spot softness leaves the red directional light unchanged');
    assert.equal(result.cutoffGreen, 0, 'a soft shadow does not bypass the light range');
    const cap = result.capProfiles;
    assert.ok(cap.caps.minimum < 0.95 && cap.literal.minimum < 0.95, 'caps alone and the literal post both cast a soft shadow');
    assert.ok(Math.abs(cap.caps.widthPixels - cap.literal.widthPixels) <= 2 && Math.abs(cap.caps.minimum - cap.literal.minimum) <= 0.08, 'cap depth gives the same penumbra as independent literal geometry');
    assert.ok(Math.abs(cap.recovered.widthPixels - cap.literal.widthPixels) <= 1 && Math.abs(cap.recovered.minimum - cap.literal.minimum) <= 0.03, 'device recovery preserves the soft shadow profile');
    assert.equal(result.recoveryLosses, 1); assert.equal(result.disposed, true); assert.deepEqual(errors, []);
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
