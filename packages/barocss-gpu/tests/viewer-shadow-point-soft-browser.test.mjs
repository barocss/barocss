// CHROME=/path/to/chrome PW_DIR=/path/to/playwright node --test tests/viewer-shadow-point-soft-browser.test.mjs
// GPU_SHADOW_POINT_SOFT_EVIDENCE_DIR retains a fresh result/error directory and visible captured GPU images.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/', import.meta.url));

test('point disk approximation softens six cube faces and their seam without changing zero-radius PCF', { timeout: 120000 }, async t => {
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
    if (process.env.GPU_SHADOW_POINT_SOFT_EVIDENCE_DIR) {
      await mkdir(process.env.GPU_SHADOW_POINT_SOFT_EVIDENCE_DIR, { recursive: true });
      evidence = await mkdtemp(join(process.env.GPU_SHADOW_POINT_SOFT_EVIDENCE_DIR, 'point-soft-shadows-'));
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
      const viewer = await api.createViewer(canvas, {
        controls: false, autoResize: false, antialias: false, pixelRatio: 1, background: '#000000',
        camera: { position: [-5, 0, 30], target: [-5, 0, 0], up: [0, 1, 0], projection: 'orthographic' },
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
        const floor = (x0, x1, y) => ({ positions: [x0, -y, 0, x1, -y, 0, x1, y, 0, x0, y, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3] });
        const triples = (values, map) => values.flatMap((_, i) => i % 3 ? [] : map(values.slice(i, i + 3)));
        const geometry = (input, world, rotate) => ({ ...input, positions: triples(input.positions, world), normals: triples(input.normals, rotate) });
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
        // Fixed positive-Y scan strips, independent of depth textures. Normalize in linear light against a caster-off image.
        const profile = (image, reference, x, world, options = {}) => {
          const unit = canvas.height / (2 * viewer.camera.halfHeight), maxY = options.maxY ?? 2;
          const projectedHalfWidth = (options.projectedHalfWidth ?? (options.halfWidth ?? 0.2) * (1 + Math.abs(x) / 10)) * unit;
          const [sx, sy] = project(world([x, 0, 0])).map(Math.round), raw = [], clearValues = [], redValues = [];
          for (let step = 0; step <= Math.floor(maxY * unit); step++) {
            let share = 0, clearValue = 0, redValue = 0;
            for (let column = sx - 1; column <= sx + 1; column++) {
              const at = ((sy - step) * image.width + column) * 4;
              share += linear(image.data[at + 1]) / Math.max(linear(reference.data[at + 1]), 1e-8);
              clearValue += reference.data[at + 1]; redValue += image.data[at];
            }
            raw.push(share / 3); clearValues.push(clearValue / 3); redValues.push(redValue / 3);
          }
          const values = raw.map((_, i) => { const window = raw.slice(Math.max(0, i - 2), Math.min(raw.length, i + 3)); return window.reduce((sum, value) => sum + value, 0) / window.length; });
          const minimum = Math.min(...values.slice(0, Math.ceil(projectedHalfWidth) + 3)), start = values.indexOf(minimum);
          const low = minimum + 0.1 * (1 - minimum), high = minimum + 0.9 * (1 - minimum);
          const first = values.findIndex((value, i) => i >= start && value >= low), last = values.findIndex((value, i) => i >= start && value >= high);
          // Centre-axis or declared seam-plane geometry only; this does not reconstruct the shader's mean blocker depth.
          const receiverRadial = Math.hypot(10 - x, 10), geometryBlockerRadial = receiverRadial * (options.blockerFraction ?? 1 / (1 + Math.abs(x) / 10));
          return { x, projectedHalfWidth, receiverRadial, geometryBlockerRadial, radialGapRatio: receiverRadial / geometryBlockerRadial - 1,
            minimum, widthPixels: first >= 0 && last >= first ? last - first : -1, end: values.at(-1), minClearGreen: Math.min(...clearValues), red: redValues[0], values };
        };
        const pair = (image, reference, world) => ({ near: profile(image, reference, -1.5, world), far: profile(image, reference, -10, world) });
        // Base receiver vectors have dominant -X. These determinant+1 rotations cover every cube face.
        const rotations = [
          ['+X', ([x, y, z]) => [-x, y, -z]], ['+Y', ([x, y, z]) => [y, -x, z]],
          ['-Y', ([x, y, z]) => [-y, x, z]], ['+Z', ([x, y, z]) => [z, y, -x]],
          ['-Z', ([x, y, z]) => [-z, y, x]], ['-X', ([x, y, z]) => [x, y, z]],
        ];
        const faces = [];
        let context;
        for (const [name, rotate] of rotations) {
          viewer.clear(); viewer.clipPlanes = null;
          const world = q => rotate([q[0] - 10, q[1], q[2] - 10]);
          viewer.camera.position = world([-5, 0, 30]); viewer.camera.target = world([-5, 0, 0]); viewer.camera.up = rotate([0, 1, 0]);
          viewer.camera.fovY = 2 * Math.atan(6 / 30) * 180 / Math.PI;
          const red = { kind: 'directional', direction: rotate([0, 0, -1]), color: '#ff0000', intensity: 0.25, castShadow: true };
          const green = { kind: 'point', position: [0, 0, 0], color: '#00ff00', intensity: 150, range: 40, castShadow: true };
          viewer.lights = [red, green];
          viewer.add(geometry(floor(-13, 3, 5.8), world, rotate), { material: { color: '#ffffff', roughness: 1 }, castShadow: false, clipped: false });
          const post = viewer.add(geometry(box(0.4, 0.4, 6, [0, 0, 3]), world, rotate), { material: { color: '#ffffff', roughness: 1 }, cap: true });
          post.castShadow = false; const clear = await capture(`${name}: caster-off reference`); post.castShadow = true;
          const hard = await capture(`${name}: radius omitted PCF`);
          const softLight = { ...green, shadowRadius: 0.8 }; viewer.lights = [red, softLight]; const large = await capture(`${name}: disk radius 0.8`);
          faces.push({ name, nearReceiver: world([-1.5, 0, 0]), farReceiver: world([-10, 0, 0]), hard: pair(hard, clear, world), large: pair(large, clear, world) });
          context = { world, rotate, red, green, softLight, post, clear, hard, large };
        }
        const { world, rotate, red, green, softLight, post, clear, hard, large } = context;
        // Plain Light[] assignment is not rolled back. A rejected synchronous render must not complete a frame.
        const validLights = viewer.lights, framesBefore = viewer.stats.frames;
        const invalidLights = [red, { ...softLight, shadowRadius: -1 }]; viewer.lights = invalidLights;
        let invalidError = null;
        try { viewer.render(); } catch (error) { invalidError = { code: error.code, message: error.message }; }
        const framesAfter = viewer.stats.frames, plainReferenceKept = viewer.lights === invalidLights;
        viewer.lights = validLights; const repaired = await capture('valid lights restored after invalid radius');
        viewer.lights = [red, { ...green, shadowRadius: 0 }]; const zero = await capture('explicit zero radius PCF');
        viewer.lights = [red, { ...green, shadowRadius: 0.35 }]; const small = await capture('disk radius 0.35');
        const dark = { ...softLight, intensity: 0, castShadow: false };
        viewer.lights = [red, ...Array(7).fill(dark), softLight]; const eighth = await capture('soft eighth point');
        viewer.lights = [{ ...red, castShadow: false }, ...Array(7).fill(dark), softLight]; const compact = await capture('soft point with preceding shadow off');
        viewer.lights = [red, softLight]; post.castShadow = false; const clearSoft = await capture('caster-off radius 0.8'); post.castShadow = true;
        viewer.lights = [red, { ...softLight, range: 8 }]; const cutoff = await capture('soft point beyond range');
        viewer.lights = [red, ...Array(7).fill(dark), softLight];
        // Interior local post x/y±.1,z1..5, translated by -S; all six original faces are discarded.
        viewer.clipPlanes = [
          { normal: [1, 0, 0], offset: -10.1, cap: '#ffffff' }, { normal: [-1, 0, 0], offset: 9.9 },
          { normal: [0, 1, 0], offset: -0.1 }, { normal: [0, -1, 0], offset: -0.1 },
          { normal: [0, 0, 1], offset: -9 }, { normal: [0, 0, -1], offset: 5 },
        ]; const caps = await capture('soft cap-only interior post');
        post.visible = false; viewer.clipPlanes = null;
        viewer.add(geometry(box(0.2, 0.2, 4, [0, 0, 3]), world, rotate), { material: { color: '#ffffff', roughness: 1 } }); const literal = await capture('soft literal interior post');
        const capProfiles = { caps: profile(caps, clear, -5, world, { halfWidth: 0.1 }), literal: profile(literal, clear, -5, world, { halfWidth: 0.1 }) };
        const finalProfiles = { small: pair(small, clear, world), eighth: pair(eighth, clear, world), compact: pair(compact, clear, world) };
        const [cutX, cutY] = project(world([-1.5, 0, 0])).map(Math.round), cutoffGreen = cutoff.data[(cutY * cutoff.width + cutX) * 4 + 1];
        // The soft footprint spans a -X/-Z boundary. This is a bounded continuity/width case, not an exact tap calibration.
        viewer.clear(); viewer.clipPlanes = null;
        const seamWorld = q => [q[0] - 10, q[1], q[2] - 10], identity = q => q;
        viewer.camera.position = seamWorld([0, 0, 20]); viewer.camera.target = seamWorld([0, 0, 0]); viewer.camera.up = [0, 1, 0];
        viewer.camera.fovY = 2 * Math.atan(2 / 20) * 180 / Math.PI;
        const seamPoint = { ...green, range: 30 }, seamSoft = { ...seamPoint, shadowRadius: 0.8 };
        viewer.lights = [red, seamPoint];
        viewer.add(geometry(floor(-2.6, 2.6, 1.95), seamWorld, identity), { material: { color: '#ffffff', roughness: 1 }, castShadow: false, clipped: false });
        const seamBox = viewer.add(geometry(box(1, 1, 1, [5, 0, 5]), seamWorld, identity), { material: { color: '#ffffff', roughness: 1 } });
        seamBox.castShadow = false; const seamClear = await capture('seam caster-off reference'); seamBox.castShadow = true;
        const seamHard = await capture('seam radius omitted PCF');
        viewer.lights = [red, seamSoft]; const seamLarge = await capture('seam disk radius 0.8');
        const seamOptions = { maxY: 1.85, projectedHalfWidth: 10 * 0.5 / 4.5, blockerFraction: 0.5 };
        const seam = [-0.15, 0.15].map(x => ({ x, hard: profile(seamHard, seamClear, x, seamWorld, seamOptions), large: profile(seamLarge, seamClear, x, seamWorld, seamOptions) }));
        const beforeLoss = viewer.stats.deviceLosses;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => { viewer.onRecover = null; reject(new Error('Device recovery exceeded 10 seconds')); }, 10000);
          viewer.onRecover = () => { clearTimeout(timeout); viewer.onRecover = null; resolve(); }; viewer.loseDeviceForTesting();
        });
        const recovered = await capture('soft seam after device recovery');
        const recoveredSeam = [-0.15, 0.15].map(x => profile(recovered, seamClear, x, seamWorld, seamOptions));
        const recoveryLosses = viewer.stats.deviceLosses - beforeLoss;
        viewer.dispose(); disposed = viewer.computeDevice === null;
        return { size: [canvas.width, canvas.height], faces, finalProfiles, capProfiles, seam, recoveredSeam,
          invalidError, framesBefore, framesAfter, plainReferenceKept, repairedChangedBytes: changed(large, repaired),
          omittedZeroChangedBytes: changed(hard, zero), clearRadiusChangedBytes: changed(clear, clearSoft), cutoffGreen, recoveryLosses, disposed };
      } finally { if (!disposed) viewer.dispose(); }
    });
    t.diagnostic(JSON.stringify({ result, errors }));
    if (evidence) {
      await writeFile(join(evidence, 'result.json'), JSON.stringify({ result, errors }, null, 2), { flag: 'wx' });
      await page.screenshot({ path: join(evidence, 'images.png'), fullPage: true });
    }
    assert.deepEqual(result.size, [320, 240]);
    assert.deepEqual(result.faces.map(row => row.name), ['+X', '+Y', '-Y', '+Z', '-Z', '-X']);
    for (const face of result.faces) {
      for (const pair of [face.hard, face.large]) for (const p of Object.values(pair)) assert.ok(p.minClearGreen > 40 && p.widthPixels >= 0 && p.end > 0.9, `${face.name}: complete independently normalized scanline`);
      assert.ok(face.hard.near.minimum < 0.25 && face.hard.far.minimum < 0.25, `${face.name}: original PCF shadows both depths`);
      assert.ok(face.large.near.minimum < 0.45 && face.large.far.minimum < 0.9, `${face.name}: soft shadows retain the contact region`);
      assert.ok(face.large.far.widthPixels >= face.large.near.widthPixels + 3, `${face.name}: increasing radial receiver/blocker gap widens the penumbra`);
      assert.ok(face.large.far.widthPixels >= face.hard.far.widthPixels + 3, `${face.name}: world disk radius widens the original PCF edge`);
      assert.ok(Math.abs(face.large.near.red - face.hard.near.red) <= 2 && Math.abs(face.large.far.red - face.hard.far.red) <= 2, `${face.name}: the red directional illumination stays unchanged`);
    }
    const base = result.faces.at(-1).large, p = result.finalProfiles;
    assert.ok(base.far.widthPixels >= p.small.far.widthPixels + 3, 'increasing world radius from 0.35 to 0.8 widens the same far edge');
    for (const name of ['eighth', 'compact']) for (const side of ['near', 'far']) {
      assert.ok(Math.abs(p[name][side].widthPixels - base[side].widthPixels) <= 1 && Math.abs(p[name][side].minimum - base[side].minimum) <= 0.03, `${name}: point selection and depth-layer compaction preserve the measured profile`);
    }
    assert.equal(result.omittedZeroChangedBytes, 0, 'zero and omitted world radius preserve every original PCF byte');
    assert.equal(result.clearRadiusChangedBytes, 0, 'radius does not change unshadowed intensity');
    assert.equal(result.invalidError?.code, 'LIGHT_INVALID'); assert.equal(result.framesBefore, result.framesAfter, 'invalid radius does not complete a frame');
    assert.equal(result.plainReferenceKept, true, 'plain caller Light[] is not silently rolled back');
    assert.equal(result.repairedChangedBytes, 0, 'explicit valid-light restoration reproduces the last completed soft image');
    assert.equal(result.cutoffGreen, 0, 'softness does not bypass range');
    const cap = result.capProfiles;
    assert.ok(cap.caps.minimum < 0.95 && cap.literal.minimum < 0.95, 'cap faces alone cast a soft shadow');
    assert.ok(Math.abs(cap.caps.widthPixels - cap.literal.widthPixels) <= 2 && Math.abs(cap.caps.minimum - cap.literal.minimum) <= 0.08, 'cap-only and independent literal geometry give the same soft profile');
    for (const row of result.seam) {
      assert.ok(row.large.widthPixels >= row.hard.widthPixels + 3 && row.large.end > 0.9 && row.large.minimum < 0.45, `x=${row.x}: the soft transition is maintained across the cube boundary`);
    }
    for (let i = 0; i < result.seam.length; i++) assert.ok(Math.abs(result.recoveredSeam[i].widthPixels - result.seam[i].large.widthPixels) <= 1 && Math.abs(result.recoveredSeam[i].minimum - result.seam[i].large.minimum) <= 0.03, 'device recovery restores the soft seam profile');
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
