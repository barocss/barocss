// CHROME=/path/to/chrome PW_DIR=/path/to/playwright node --test tests/viewer-shadow-spot-browser.test.mjs
// GPU_SHADOW_SPOT_EVIDENCE_DIR retains a fresh result/error directory and visible captured GPU images.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/', import.meta.url));

test('spot shadows follow position, cone and range, preserve clipped caps and recover their device', { timeout: 120000 }, async t => {
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
    if (process.env.GPU_SHADOW_SPOT_EVIDENCE_DIR) {
      await mkdir(process.env.GPU_SHADOW_SPOT_EVIDENCE_DIR, { recursive: true });
      evidence = await mkdtemp(join(process.env.GPU_SHADOW_SPOT_EVIDENCE_DIR, 'spot-shadows-'));
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
      const green = { kind: 'spot', position: [10, 0, 8], direction: [-10, 0, -8], color: '#00ff00', intensity: 100, angle: 30, penumbra: 0.2, range: 20, castShadow: true };
      const viewer = await api.createViewer(canvas, {
        controls: false, autoResize: false, antialias: false, pixelRatio: 1, background: '#000000',
        camera: { position: [0, 0, 20], target: [0, 0, 0], up: [0, 1, 0], projection: 'orthographic' },
        lights: [red, green], environment: { ambient: 0, toneMapping: 'none', softShadows: 0 },
      });
      let disposed = false;
      try {
        viewer.resize(1); viewer.camera.fovY = 2 * Math.atan(2.5 / 20) * 180 / Math.PI; viewer.shadowMapSize = 1024;
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
        const patch = (image, point = [0, 0, 0]) => {
          const [x, y] = project(point).map(Math.round), sum = [0, 0, 0];
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
        viewer.lights = [red, { ...green, castShadow: false }]; await record('zero');
        viewer.lights = [red, green]; blocker.castShadow = false; await record('caster off'); blocker.castShadow = true;
        receiver.receiveShadow = false; await record('receiver off'); receiver.receiveShadow = true;
        await record('restored');
        viewer.lights = [{ ...red, castShadow: false }, green]; await record('directional slot off');
        viewer.lights = [green, red]; await record('reordered');
        const dark = { ...green, intensity: 0, castShadow: false };
        viewer.lights = [red, dark, dark, dark, green]; await record('fourth spot');
        viewer.lights = [red, { ...dark, castShadow: true }, dark, dark, green]; await record('earlier spot on');
        viewer.lights = [red, dark, dark, dark, green]; await record('earlier spot off');
        // PCSS belongs to directional lights. The spot keeps its fixed PCF footprint.
        viewer.environment = { ambient: 0, toneMapping: 'none', softShadows: 6 }; await record('directional soft setting');
        viewer.environment = { ambient: 0, toneMapping: 'none', softShadows: 0 };
        viewer.lights = [red, { ...green, position: [-10, 0, 8], direction: [10, 0, -8] }]; await record('moved light');
        blocker.castShadow = false;
        viewer.lights = [red, { ...green, angle: 5 }]; const cone = await record('narrow cone');
        const coneOutside = patch(cone, [0, 2, 0]);
        viewer.lights = [red, { ...green, angle: 5, direction: [-10, -8, -8] }]; await record('turned cone');
        viewer.lights = [red, { ...green, range: 8 }]; await record('range cutoff');
        blocker.castShadow = true; viewer.lights = [red, green];
        // Geometry behind the source, then behind the receiver, cannot occlude the source-to-receiver segment.
        blocker.transform = api.translation([10, 0, 8]); await record('behind light');
        blocker.transform = api.translation([-10, 0, -8]); await record('behind receiver');
        blocker.transform = api.identity(); viewer.lights = [red, dark, dark, dark, green];
        // dot(normal,p) >= offset keeps an interior cube. All six original box faces are discarded: only caps can shadow.
        viewer.clipPlanes = [
          { normal: [1, 0, 0], offset: 4.75, cap: '#ffffff' }, { normal: [-1, 0, 0], offset: -5.25 },
          { normal: [0, 1, 0], offset: -0.25 }, { normal: [0, -1, 0], offset: -0.25 },
          { normal: [0, 0, 1], offset: 3.75 }, { normal: [0, 0, -1], offset: -4.25 },
        ]; await record('clipped cap');
        blocker.visible = false; viewer.clipPlanes = null;
        const keptBox = viewer.add(box(0.5, 0.5, 0.5, [5, 0, 4]), { material: { color: '#ffffff', roughness: 1 } }); await record('literal interior cube');
        // Independent point-source projection from S=(10,0,8) onto z=0; no renderer shadow matrix is read.
        const lightProjection = (x, y, z) => [(8 * x - 10 * z) / (8 - z), 8 * y / (8 - z)];
        const projectedCorners = [4.75, 5.25].flatMap(x => [-0.25, 0.25].flatMap(y => [3.75, 4.25].map(z => lightProjection(x, y, z))));
        const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const sorted = projectedCorners.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const hullHalf = points => { const out = []; for (const point of points) { while (out.length > 1 && cross(out.at(-2), out.at(-1), point) <= 0) out.pop(); out.push(point); } return out.slice(0, -1); };
        const hull = [...hullHalf(sorted), ...hullHalf(sorted.slice().reverse())];
        const perimeter = hull.reduce((sum, point, i) => sum + Math.hypot(point[0] - hull[(i + 1) % hull.length][0], point[1] - hull[(i + 1) % hull.length][1]), 0);
        const capBoundaryBudget = Math.ceil(2 * perimeter * canvas.height / (2 * viewer.camera.halfHeight));
        let capMaskDifference = 0, capShadowPixels = 0;
        for (let i = 0; i < frames['clipped cap'].data.length; i += 4) {
          if (frames.zero.data[i] < 20 || frames.zero.data[i + 1] <= 40) continue;
          const threshold = frames.zero.data[i + 1] * 0.6;
          const a = frames['clipped cap'].data[i + 1] < threshold, b = frames['literal interior cube'].data[i + 1] < threshold;
          if (a !== b) capMaskDifference++;
          if (a) capShadowPixels++;
        }
        const beforeLoss = viewer.stats.deviceLosses;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => { viewer.onRecover = null; reject(new Error('Device recovery exceeded 10 seconds')); }, 10000);
          viewer.onRecover = () => { clearTimeout(timeout); viewer.onRecover = null; resolve(); };
          viewer.loseDeviceForTesting();
        });
        await record('recovered');
        const recoveryLosses = viewer.stats.deviceLosses - beforeLoss;
        // A larger, still off-camera box blocks the square-projection diagonal. That point is outside the circular cone.
        keptBox.visible = false;
        viewer.add(box(2, 2, 1, [5, 0, 4]), { material: { color: '#ffffff', roughness: 1 } });
        receiver.material = { shadowOnly: true, opacity: 1, color: '#000000' }; viewer.setBackground('#808080');
        viewer.lights = [red, { ...green, angle: 5 }];
        const catcherCone = await record('catcher cone');
        const catcherOutside = patch(catcherCone, [1.3, 0.9, 0]);
        viewer.lights = [red, { ...green, range: 8 }]; await record('catcher range');
        viewer.dispose(); disposed = viewer.computeDevice === null;
        return { size: [canvas.width, canvas.height], offCamera, samples,
          coneOutside, catcherOutside, projectedCorners, capHull: hull,
          spotSoftChangedPixels: difference(frames['directional soft setting'], frames['fourth spot']),
          capMaskDifference, capBoundaryBudget, capShadowPixels,
          clipChangedPixels: difference(frames['clipped cap'], frames['fourth spot']), recoveryLosses, disposed };
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
    assert.ok(samples.both[1] < samples.zero[1] * 0.45, `the off-camera blocker occludes the spot: ${JSON.stringify(samples)}`);
    assert.ok(Math.abs(samples.both[0] - samples.zero[0]) <= 2, 'the spot shadow must not dim the red directional light');
    for (const name of ['caster off', 'receiver off', 'moved light', 'behind light', 'behind receiver']) assert.ok(delta(samples[name], samples.zero) <= 2, `${name}: source-to-receiver visibility is restored`);
    for (const name of ['restored', 'directional slot off', 'reordered', 'fourth spot', 'earlier spot on', 'earlier spot off']) assert.ok(delta(samples[name], samples.both) <= 2, `${name}: spot metadata and physical depth layer agree`);
    assert.equal(result.spotSoftChangedPixels, 0, 'directional softShadows must not change a PCF-only spot');
    assert.ok(samples['narrow cone'][1] > 40 && result.coneOutside[1] <= 2, 'the fixed axis is lit and the independent outside-cone point is dark');
    for (const name of ['turned cone', 'range cutoff']) assert.ok(samples[name][1] <= 2 && Math.abs(samples[name][0] - samples.zero[0]) <= 2, `${name}: only the spot illumination ends`);
    assert.ok(delta(samples['clipped cap'], samples['literal interior cube']) <= 2, 'the spot sees caps alone as the literal interior cube');
    assert.ok(result.capShadowPixels > 200 && result.clipChangedPixels > 20, 'the cap shadows the floor and clipping changes the footprint');
    assert.ok(result.capMaskDifference <= result.capBoundaryBudget, `cap shadow stays inside the independent two-pixel hull budget: ${result.capMaskDifference}/${result.capBoundaryBudget}`);
    assert.equal(result.recoveryLosses, 1);
    assert.ok(delta(samples.recovered, samples['literal interior cube']) <= 2, 'device recovery restores the fourth spot shadow');
    assert.ok(samples['catcher cone'][0] < 80, 'the catcher has a real shadow inside the spot cone');
    assert.ok(delta(result.catcherOutside, [128, 128, 128]) <= 2, 'the catcher is transparent outside the circular cone, even inside its projection square');
    assert.ok(delta(samples['catcher range'], [128, 128, 128]) <= 2, 'the catcher is transparent beyond the spot range');
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
