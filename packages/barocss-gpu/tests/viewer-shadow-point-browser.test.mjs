// CHROME=/path/to/chrome PW_DIR=/path/to/playwright node --test tests/viewer-shadow-point-browser.test.mjs
// GPU_SHADOW_POINT_EVIDENCE_DIR retains a fresh result/error directory and visible captured GPU images.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/', import.meta.url));

test('point cube shadows cover six faces and their seam, preserve caps and recover their device', { timeout: 120000 }, async t => {
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
    if (process.env.GPU_SHADOW_POINT_EVIDENCE_DIR) {
      await mkdir(process.env.GPU_SHADOW_POINT_EVIDENCE_DIR, { recursive: true });
      evidence = await mkdtemp(join(process.env.GPU_SHADOW_POINT_EVIDENCE_DIR, 'point-shadows-'));
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
      const viewer = await api.createViewer(canvas, {
        controls: false, autoResize: false, antialias: false, pixelRatio: 1, background: '#000000',
        camera: { position: [0, 0, 20], target: [0, 0, 0], up: [0, 1, 0], projection: 'orthographic' },
        environment: { ambient: 0, toneMapping: 'none', softShadows: 0 },
      });
      let disposed = false;
      try {
        viewer.resize(1); viewer.shadowMapSize = 1024;
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
        const floor = (x, y) => ({ positions: [-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3] });
        const triples = (values, map) => values.flatMap((_, i) => i % 3 ? [] : map(values.slice(i, i + 3)));
        const sceneGeometry = (input, world, rotate) => ({ ...input, positions: triples(input.positions, world), normals: triples(input.normals, rotate) });
        const project = q => {
          const m = viewer.camera.viewProjection(viewer.aspect), c = [0, 1, 3].map(k => m[k] * q[0] + m[4 + k] * q[1] + m[8 + k] * q[2] + m[12 + k]);
          return [(c[0] / c[2] * 0.5 + 0.5) * canvas.width, (0.5 - c[1] / c[2] * 0.5) * canvas.height];
        };
        const retain = (name, frame) => {
          const figure = document.createElement('figure'), label = document.createElement('figcaption'), proof = document.createElement('canvas');
          label.textContent = name; proof.width = frame.width; proof.height = frame.height;
          proof.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
          figure.append(label, proof); document.getElementById('images').append(figure); return frame;
        };
        const capture = async name => { viewer.requestRender(); await viewer.frame(); return retain(name, await viewer.capture()); };
        const patch = (image, point) => {
          const [x, y] = project(point).map(Math.round), sum = [0, 0, 0];
          for (let j = y - 3; j <= y + 3; j++) for (let i = x - 3; i <= x + 3; i++) for (let c = 0; c < 3; c++) sum[c] += image.data[(j * image.width + i) * 4 + c];
          return sum.map(value => value / 49);
        };
        const difference = (a, b) => { let count = 0; for (let i = 0; i < a.data.length; i += 4) if ([0, 1, 2].some(c => Math.abs(a.data[i + c] - b.data[i + c]) > 2)) count++; return count; };
        // These determinant+1 signed permutations are independent of the renderer's cube bases.
        const rotations = [
          ['+X', ([x, y, z]) => [-z, y, x]], ['-X', ([x, y, z]) => [z, y, -x]],
          ['+Y', ([x, y, z]) => [x, -z, y]], ['-Y', ([x, y, z]) => [x, z, -y]],
          ['+Z', ([x, y, z]) => [-x, y, -z]], ['-Z', ([x, y, z]) => [x, y, z]],
        ];
        const faces = [];
        let context;
        for (const [name, rotate] of rotations) {
          viewer.clear(); viewer.clipPlanes = null;
          const world = q => rotate([q[0] - 6, q[1], q[2] - 10]);
          viewer.camera.position = world([0, 0, 20]); viewer.camera.target = world([0, 0, 0]); viewer.camera.up = rotate([0, 1, 0]);
          viewer.camera.fovY = 2 * Math.atan(1.25 / 20) * 180 / Math.PI;
          const red = { kind: 'directional', direction: rotate([0, 0, -1]), color: '#ff0000', intensity: 0.5, castShadow: true };
          const green = { kind: 'point', position: [0, 0, 0], color: '#00ff00', intensity: 100, range: 20, castShadow: true };
          viewer.lights = [red, green];
          const receiver = viewer.add(sceneGeometry(floor(1.6, 1.2), world, rotate), { material: { color: '#ffffff', roughness: 1 }, castShadow: false, clipped: false });
          const blocker = viewer.add(sceneGeometry(box(1, 1, 1, [3, 0, 5]), world, rotate), { material: { color: '#ffffff', roughness: 1 }, cap: true });
          const offCamera = [2.5, 3.5].flatMap(x => [-0.5, 0.5].flatMap(y => [4.5, 5.5].map(z => project(world([x, y, z])))));
          const blocked = await capture(`${name}: point shadow`);
          viewer.lights = [red, { ...green, castShadow: false }]; const clear = await capture(`${name}: no point shadow`);
          faces.push({ name, offCamera, receiverVector: world([0, 0, 0]), blocked: patch(blocked, world([0, 0, 0])), clear: patch(clear, world([0, 0, 0])) });
          context = { world, rotate, red, green, receiver, blocker, blocked, clear };
        }
        // The final rotation is identity; the source is world zero and the receiver centre is (-6,0,-10).
        const { world, rotate, red, green, receiver, blocker, blocked, clear } = context;
        const samples = {}, frames = {};
        const record = async name => { const frame = await capture(name); frames[name] = frame; samples[name] = patch(frame, world([0, 0, 0])); return frame; };
        viewer.lights = [red, green]; await record('restored');
        receiver.receiveShadow = false; await record('receiver off'); receiver.receiveShadow = true;
        blocker.castShadow = false; await record('caster off'); blocker.castShadow = true;
        viewer.lights = [red, { ...green, position: [-12, 0, 0] }]; await record('moved point');
        viewer.lights = [red, { ...green, range: 8 }]; await record('range cutoff');
        viewer.lights = [{ ...red, castShadow: false }, green]; await record('prior shadow off');
        viewer.lights = [red, green]; await record('prior shadow restored');
        blocker.transform = api.translation([6, 0, 10]); await record('behind source');
        blocker.transform = api.translation([-6, 0, -10]); await record('behind receiver');
        blocker.transform = api.identity();
        // Interior cube in world coordinates: x[-3.25,-2.75], y±.25, z[-5.25,-4.75]. Every original face is discarded.
        viewer.clipPlanes = [
          { normal: [1, 0, 0], offset: -3.25, cap: '#ffffff' }, { normal: [-1, 0, 0], offset: 2.75 },
          { normal: [0, 1, 0], offset: -0.25 }, { normal: [0, -1, 0], offset: -0.25 },
          { normal: [0, 0, 1], offset: -5.25 }, { normal: [0, 0, -1], offset: 4.75 },
        ]; await record('caps only');
        blocker.visible = false; viewer.clipPlanes = null;
        viewer.add(sceneGeometry(box(0.5, 0.5, 0.5, [3, 0, 5]), world, rotate), { material: { color: '#ffffff', roughness: 1 } }); await record('literal interior cube');
        const projectedCorners = [2.75, 3.25].flatMap(x => [-0.25, 0.25].flatMap(y => [4.75, 5.25].map(z => [(10 * x - 6 * z) / (10 - z), 10 * y / (10 - z)])));
        const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const sorted = projectedCorners.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const half = points => { const out = []; for (const point of points) { while (out.length > 1 && cross(out.at(-2), out.at(-1), point) <= 0) out.pop(); out.push(point); } return out.slice(0, -1); };
        const hull = [...half(sorted), ...half(sorted.slice().reverse())];
        const perimeter = hull.reduce((sum, point, i) => sum + Math.hypot(point[0] - hull[(i + 1) % hull.length][0], point[1] - hull[(i + 1) % hull.length][1]), 0);
        const capBoundaryBudget = Math.ceil(2 * perimeter * canvas.height / (2 * viewer.camera.halfHeight));
        let capMaskDifference = 0, capShadowPixels = 0;
        for (let i = 0; i < clear.data.length; i += 4) {
          if (clear.data[i] < 20 || clear.data[i + 1] <= 40) continue;
          const a = frames['caps only'].data[i + 1] < clear.data[i + 1] * 0.6, b = frames['literal interior cube'].data[i + 1] < clear.data[i + 1] * 0.6;
          if (a !== b) capMaskDifference++; if (a) capShadowPixels++;
        }
        const capChangedPixels = difference(frames['caps only'], blocked);
        // A bounded seam case, not an exact nine-tap calibration. At 1024, normal bias still leaves the patches on -X and -Z.
        viewer.clear(); viewer.clipPlanes = null; viewer.shadowMapSize = 1024;
        const seamWorld = q => [q[0] - 10, q[1], q[2] - 10], identity = q => q;
        viewer.camera.position = seamWorld([0, 0, 20]); viewer.camera.target = seamWorld([0, 0, 0]); viewer.camera.up = [0, 1, 0];
        viewer.camera.fovY = 2 * Math.atan(2 / 20) * 180 / Math.PI;
        const seamGreen = { ...green, intensity: 150, range: 30 };
        viewer.lights = [red, seamGreen];
        viewer.add(sceneGeometry(floor(2.6, 1.95), seamWorld, identity), { material: { color: '#ffffff', roughness: 1 }, castShadow: false, clipped: false });
        viewer.add(sceneGeometry(box(1, 1, 1, [5, 0, 5]), seamWorld, identity), { material: { color: '#ffffff', roughness: 1 } });
        const seamBlocked = await capture('face seam: shadow');
        viewer.lights = [red, { ...seamGreen, castShadow: false }]; const seamClear = await capture('face seam: no shadow');
        const seamPoints = [[-0.15, 0, 0], [0.15, 0, 0], [0, 1.75, 0]];
        const seam = seamPoints.map((point, i) => ({ name: ['-X interior', '-Z interior', 'clear outside'][i], point, blocked: patch(seamBlocked, seamWorld(point)), clear: patch(seamClear, seamWorld(point)) }));
        viewer.lights = [red, seamGreen];
        const beforeLoss = viewer.stats.deviceLosses;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => { viewer.onRecover = null; reject(new Error('Device recovery exceeded 10 seconds')); }, 10000);
          viewer.onRecover = () => { clearTimeout(timeout); viewer.onRecover = null; resolve(); }; viewer.loseDeviceForTesting();
        });
        const recovered = await capture('point seam: recovered');
        const recoveredSeam = seamPoints.map(point => patch(recovered, seamWorld(point)));
        const recoveryLosses = viewer.stats.deviceLosses - beforeLoss;
        viewer.dispose(); disposed = viewer.computeDevice === null;
        return { size: [canvas.width, canvas.height], faces, samples, seam, recoveredSeam, recoveryLosses, disposed, capBoundaryBudget, capMaskDifference, capShadowPixels, capChangedPixels, capHull: hull };
      } finally { if (!disposed) viewer.dispose(); }
    });
    t.diagnostic(JSON.stringify({ result, errors }));
    if (evidence) {
      await writeFile(join(evidence, 'result.json'), JSON.stringify({ result, errors }, null, 2), { flag: 'wx' });
      await page.screenshot({ path: join(evidence, 'images.png'), fullPage: true });
    }
    const delta = (a, b) => Math.max(...a.map((value, i) => Math.abs(value - b[i])));
    assert.deepEqual(result.size, [320, 240]);
    assert.deepEqual(result.faces.map(row => row.name), ['+X', '-X', '+Y', '-Y', '+Z', '-Z']);
    for (const row of result.faces) {
      assert.ok(row.offCamera.every(([x]) => x > 320), `${row.name}: every caster corner stays outside the camera`);
      assert.ok(row.clear[1] > 40 && row.blocked[1] < row.clear[1] * 0.45, `${row.name}: its point cube face shadows the green light: ${JSON.stringify(row)}`);
      assert.ok(Math.abs(row.blocked[0] - row.clear[0]) <= 2, `${row.name}: the point shadow leaves the red directional light unchanged`);
    }
    const base = result.faces.at(-1), samples = result.samples;
    for (const name of ['receiver off', 'caster off', 'moved point', 'behind source', 'behind receiver']) assert.ok(delta(samples[name], base.clear) <= 2, `${name}: point visibility is restored`);
    for (const name of ['restored', 'prior shadow off', 'prior shadow restored']) assert.ok(delta(samples[name], base.blocked) <= 2, `${name}: cube layer reassignment preserves the point shadow`);
    assert.ok(samples['range cutoff'][1] <= 2 && Math.abs(samples['range cutoff'][0] - base.clear[0]) <= 2, 'range ends only the point illumination');
    assert.ok(delta(samples['caps only'], samples['literal interior cube']) <= 2, 'caps alone cast the same point shadow as a literal interior cube');
    assert.ok(result.capShadowPixels > 200 && result.capChangedPixels > 20, 'the cap-only cube casts a visible, smaller floor shadow');
    assert.ok(result.capMaskDifference <= result.capBoundaryBudget, `cap shadow stays within the independent two-pixel hull budget: ${result.capMaskDifference}/${result.capBoundaryBudget}`);
    for (const row of result.seam.slice(0, 2)) {
      assert.ok(row.clear[1] > 40 && row.blocked[1] < row.clear[1] * 0.45, `${row.name}: the known box shadow continues across the cube face boundary`);
      assert.ok(Math.abs(row.blocked[0] - row.clear[0]) <= 2, `${row.name}: red illumination stays independent`);
    }
    assert.ok(delta(result.seam[2].blocked, result.seam[2].clear) <= 2, 'the known outside point stays lit beside the seam');
    assert.equal(result.recoveryLosses, 1);
    for (let i = 0; i < result.seam.length; i++) assert.ok(delta(result.recoveredSeam[i], result.seam[i].blocked) <= 2, `${result.seam[i].name}: recovery restores the cube shadow`);
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
