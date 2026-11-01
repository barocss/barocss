// CHROME=/path/to/chrome PW_DIR=/path/to/playwright node --test tests/viewer-path-trace-soft-shadows-browser.test.mjs
// GPU_PATH_TRACE_SOFT_SHADOWS_EVIDENCE_DIR retains fresh results, first failures and visible actual GPU images.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/', import.meta.url));

test('path-traced point and spot radii widen geometric shadow profiles while preserving hard defaults and frozen stills', { timeout: 180000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR required'); return; }
  const server = createServer(async (req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><style>body{margin:0;background:#222;color:white;font:12px sans-serif}#c{width:320px;height:240px}#images{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0}figure canvas{display:block;width:256px;height:192px}</style><canvas id="c"></canvas><div id="images"></div>');
      return;
    }
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const base = req.url?.startsWith('/cad/') ? cad : dist;
    const file = resolve(base, '.' + (base === cad ? req.url.slice(4) : (req.url ?? '')));
    if (!file.startsWith(base)) { res.writeHead(404); res.end(); return; }
    try { res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(file)); }
    catch { res.writeHead(404); res.end(); }
  });
  let browser, page, evidence;
  const errors = [];
  try {
    if (process.env.GPU_PATH_TRACE_SOFT_SHADOWS_EVIDENCE_DIR) {
      await mkdir(process.env.GPU_PATH_TRACE_SOFT_SHADOWS_EVIDENCE_DIR, { recursive: true });
      evidence = await mkdtemp(join(process.env.GPU_PATH_TRACE_SOFT_SHADOWS_EVIDENCE_DIR, 'path-trace-soft-shadows-'));
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
      const { createViewer } = await import('/viewer/index.js');
      const width = 128, height = 96, samples = 96, halfHeight = 2.5;
      const viewer = await createViewer(document.getElementById('c'), {
        controls: false, autoResize: false, antialias: false, pixelRatio: 1, background: '#000000',
        camera: { position: [3, 0, 10], target: [3, 0, 0], up: [0, 1, 0], projection: 'orthographic', fovY: 2 * Math.atan(halfHeight / 10) * 180 / Math.PI },
        lights: [], environment: { sky: '#000000', ground: '#000000', ambient: 0, toneMapping: 'none' },
      });
      const quad = (x0, x1, y0, y1, z) => ({ positions: [x0,y0,z,x1,y0,z,x1,y1,z,x0,y1,z], normals: [0,0,1,0,0,1,0,0,1,0,0,1], indices: [0,1,2,0,2,3] });
      viewer.add(quad(-4, 9, -4, 4, 0), { material: { color: '#cccccc', roughness: 1, metallic: 0 } });
      // Pre-execution geometry correction (runtime NOT RUN): x ±0.8 contains the R0.8 disk's
      // z=3 intersections [-0.625,0.517], isolating the y edge without changing its visibility thresholds.
      const blocker = viewer.add(quad(-0.8, 0.8, -0.5, 0.5, 3), { material: { color: '#777777', roughness: 1, doubleSided: true } });
      const keep = (name, frame) => {
        const figure = document.createElement('figure'), caption = document.createElement('figcaption'), canvas = document.createElement('canvas');
        canvas.width = frame.width; canvas.height = frame.height; caption.textContent = `${name} · ${frame.samples} samples`;
        canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
        figure.append(caption, canvas); document.getElementById('images').append(figure); return frame;
      };
      const image = async name => {
        const session = await viewer.createPathTrace({ width, height, bounces: 1 });
        try { await session.sample(64); await session.sample(32); return keep(name, await session.capture(false)); }
        finally { session.dispose(); }
      };
      const difference = (a, b) => {
        let changedBytes = 0, maxByteDelta = 0;
        for (let i = 0; i < a.data.length; i++) { if (a.data[i] !== b.data[i]) changedBytes++; maxByteDelta = Math.max(maxByteDelta, Math.abs(a.data[i] - b.data[i])); }
        return { changedBytes, maxByteDelta };
      };
      const decode = byte => { const x = byte / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
      // Independent central-point projection: Pxy = 2 * blocker.xy - source.xy.
      // Thus the hard footprint is x=[1.4,4.6], y=[-1,1]. At x=3 the positive-y edge is y=1.
      // Camera is top-down with a fixed five-world-unit image height; no shader projection formula is copied.
      const profile = (frame, clear) => {
        const values = [], x = Math.floor(width / 2), pixelsPerWorld = height / (2 * halfHeight);
        let minClearByte = 255;
        for (let step = 0; step <= Math.floor(2.2 * pixelsPerWorld); step++) {
          const row = Math.floor(height / 2) - step; let lit = 0, reference = 0;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) {
            const i = ((row + dy) * width + x + dx) * 4 + 1;
            lit += decode(frame.data[i]); reference += decode(clear.data[i]); minClearByte = Math.min(minClearByte, clear.data[i]);
          }
          values.push({ y: step / pixelsPerWorld, visibility: reference ? lit / reference : 0 });
        }
        const low = values.findIndex(p => p.visibility >= 0.1), high = values.findIndex(p => p.visibility >= 0.9);
        return { widthPixels: low >= 0 && high >= low ? high - low : -1, lowY: values[low]?.y ?? null, highY: values[high]?.y ?? null, center: values[0].visibility, outside: values.at(-1).visibility, minClearByte, values };
      };
      const lightFor = (kind, fields) => ({ kind, position: [-3,0,6], color: '#ffffff', intensity: 18, range: 0, ...(kind === 'spot' ? { direction: [6,0,-6], angle: 50, penumbra: 0 } : {}), ...fields });
      const rows = [];
      try {
        for (const kind of ['point', 'spot']) {
          const use = fields => { viewer.lights = [lightFor(kind, fields)]; };
          blocker.visible = false; use({ castShadow: true }); const clear = await image(`${kind}: clear`);
          use({ castShadow: true, shadowRadius: 0.8 }); const clearSoft = await image(`${kind}: clear radius 0.8`);
          blocker.visible = true; use({ castShadow: true }); const omitted = await image(`${kind}: hard omitted`);
          use({ castShadow: true, shadowRadius: 0 }); const zero = await image(`${kind}: hard zero`);
          use({ castShadow: true, shadowRadius: 0.8 }); const soft = await image(`${kind}: soft radius 0.8`);
          use({ castShadow: false, shadowRadius: -1 }); const disabled = await image(`${kind}: disabled radius ignored, hard occlusion`);
          use({ shadowRadius: 0.8 }); const omittedCast = await image(`${kind}: omitted cast, hard occlusion`);
          use({ castShadow: true, shadowRadius: 0.8 });
          const frozenSession = await viewer.createPathTrace({ width, height, bounces: 1 });
          let frozen;
          try {
            // Mutate live input before the first dispatch, rather than only re-reading an already sampled image.
            viewer.lights[0].shadowRadius = 0;
            const liveRadiusBeforeFirstSample = viewer.lights[0].shadowRadius;
            await frozenSession.sample(64); await frozenSession.sample(32);
            const frame = keep(`${kind}: frozen radius 0.8 sampled after live radius zero`, await frozenSession.capture(false));
            frozen = { delta: difference(soft, frame), referenceSamples: soft.samples, frozenSamples: frame.samples, liveRadiusBeforeFirstSample };
          } finally { frozenSession.dispose(); }
          let extreme = null;
          if (kind === 'point') {
            use({ castShadow: true, shadowRadius: 3.4028234663852886e38 });
            const frame = await image('point: maximum finite radius');
            // At x=3 the source disk is perpendicular to [-6,0,6]. In the infinite-radius limit,
            // half its endpoints are above z=0 and point away from the offset blocker. Half are below.
            // Check only this bounded visibility control: BVH rays still use their existing 1e38 distance cap.
            extreme = { radius: 3.4028234663852886e38, centerVisibility: profile(frame, clear).center, samples: frame.samples, bvhDistanceCap: 1e38 };
          }
          use({ castShadow: true, shadowRadius: -1 });
          let invalidError = null, unexpectedSession = false;
          try { const invalid = await viewer.createPathTrace({ width, height, bounces: 1 }); unexpectedSession = true; invalid.dispose(); }
          catch (error) { invalidError = { code: error.code, message: error.message }; }
          rows.push({ kind, hard: profile(omitted, clear), soft: profile(soft, clear), zero: difference(omitted, zero), clearRadius: difference(clear, clearSoft), disabled: difference(omitted, disabled), omittedCast: difference(omitted, omittedCast), frozen, extreme, invalidError, unexpectedSession, frameSamples: [clear, clearSoft, omitted, zero, soft, disabled, omittedCast].map(frame => frame.samples) });
        }
      } finally { viewer.dispose(); }
      return { size: [width,height], samples, geometry: { source: [-3,0,6], blocker: { x: [-0.8,0.8], y: [-0.5,0.5], z: 3 }, receiverZ: 0, hardFootprint: { x: [1.4,4.6], y: [-1,1] }, scanX: 3 }, rows, disposed: viewer.computeDevice === null };
    });
    result.errors = errors;
    t.diagnostic(JSON.stringify(result));
    if (evidence) {
      await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2) + '\n');
      await page.screenshot({ path: join(evidence, 'images.png'), fullPage: true });
    }
    assert.deepEqual(result.size, [128, 96]); assert.equal(result.samples, 96); assert.equal(result.rows.length, 2);
    for (const row of result.rows) {
      assert.ok(row.hard.minClearByte > 35, `${row.kind}: independent clear reference is lit`);
      assert.ok(row.hard.center < 0.05 && row.hard.outside > 0.95, `${row.kind}: geometric shadow interior and clear exterior exist`);
      assert.ok(row.hard.lowY >= 0.7 && row.hard.highY <= 1.3, `${row.kind}: hard transition brackets the independent projected edge y=1`);
      assert.ok(row.hard.widthPixels >= 0 && row.soft.widthPixels >= row.hard.widthPixels + 3, `${row.kind}: positive world radius widens the fixed 10–90% shadow transition`);
      assert.ok(row.soft.center < 0.15 && row.soft.outside > 0.9, `${row.kind}: soft radius retains the shadow centre and unoccluded exterior`);
      for (const key of ['zero', 'clearRadius', 'disabled', 'omittedCast']) assert.equal(row[key].changedBytes, 0, `${row.kind}: ${key} preserves original hard-light pixels/RNG`);
      assert.equal(row.frozen.delta.changedBytes, 0, `${row.kind}: samples use the frozen radius after live radius changes before the first dispatch`);
      assert.deepEqual([row.frozen.referenceSamples, row.frozen.frozenSamples], [96,96]);
      assert.equal(row.frozen.liveRadiusBeforeFirstSample, 0);
      if (row.kind === 'point') {
        assert.equal(row.extreme.samples, 96);
        assert.ok(row.extreme.centerVisibility >= 0.25 && row.extreme.centerVisibility <= 0.75, 'maximum finite radius retains the independent half-visible horizon control; not a full-range precision oracle');
      }
      assert.equal(row.invalidError?.code, 'LIGHT_INVALID', `${row.kind}: enabled invalid radius refuses`); assert.equal(row.unexpectedSession, false);
      assert.deepEqual(row.frameSamples, new Array(7).fill(96));
    }
    assert.equal(result.disposed, true); assert.deepEqual(errors, []);
  } catch (error) {
    if (evidence) {
      await writeFile(join(evidence, 'first-error.json'), JSON.stringify({ name: error.name, message: error.message, stack: error.stack, errors }, null, 2) + '\n');
      if (page && !page.isClosed()) await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {});
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(r => server.close(r));
  }
});
