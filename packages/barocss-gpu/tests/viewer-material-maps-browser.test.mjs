// CHROME=/path/to/chrome PW_DIR=/path/to/playwright node --test tests/viewer-material-maps-browser.test.mjs
// Optional GPU_MATERIAL_MAPS_EVIDENCE_DIR: a fresh child directory retains the raw result, first error and browser PNG.
// The visible 2D proof canvases retain captured GPU bytes after dispose, including for an IMAGE_PROOF_OUT close hook.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/', import.meta.url));

test('raster and progressive PBR data maps match independent normal and scalar references', { timeout: 120000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR required'); return; }
  const server = createServer(async (req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><style>body{margin:0;background:#222;color:white;font:12px sans-serif}#c{width:128px;height:96px}#images{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0}figure canvas{display:block}</style><canvas id="c"></canvas><div id="images"></div>');
      return;
    }
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const base = req.url?.startsWith('/cad/') ? cad : dist;
    const f = resolve(base, '.' + (base === cad ? req.url.slice(4) : (req.url ?? '')));
    if (!f.startsWith(base)) { res.writeHead(404); res.end(); return; }
    try { res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(f)); } catch { res.writeHead(404); res.end(); }
  });
  let browser, page, evidence;
  const errors = [];
  try {
    if (process.env.GPU_MATERIAL_MAPS_EVIDENCE_DIR) {
      await mkdir(process.env.GPU_MATERIAL_MAPS_EVIDENCE_DIR, { recursive: true });
      evidence = await mkdtemp(join(process.env.GPU_MATERIAL_MAPS_EVIDENCE_DIR, 'raster-maps-'));
      t.diagnostic(`evidence: ${evidence}`);
    }
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    if (!await page.evaluate(async () => !!await navigator.gpu?.requestAdapter())) { t.skip('no WebGPU adapter'); return; }
    const result = await page.evaluate(async () => {
      const api = await import('/viewer/index.js');
      const v = await api.createViewer(document.getElementById('c'), {
        controls: false, autoResize: false, antialias: false, pixelRatio: 1, background: '#000000',
        camera: { position: [0, 0, 8], target: [0, 0, 0], up: [0, 1, 0], projection: 'orthographic' },
        lights: [{ kind: 'directional', direction: [-0.8, -0.1, -1], intensity: 0.6 }],
        environment: { ambient: 0, toneMapping: 'none' },
      });
      v.resize(1);
      const positions = [-2, -1.5, 0, 2, -1.5, 0, 2, 1.5, 0, -2, 1.5, 0];
      const indices = [0, 1, 2, 0, 2, 3], uv = [0, 0, 1, 0, 1, 1, 0, 1];
      const objects = [], textures = [];
      const dataMap = bytes => { const map = v.createTexture({ width: 1, height: 1, data: new Uint8Array(bytes) }, { srgb: false, mipmaps: false, filter: 'nearest' }); textures.push(map); return map; };
      const normalMap = dataMap([204, 128, 230, 255]);
      const normal = [204 / 255 * 2 - 1, 128 / 255 * 2 - 1, 230 / 255 * 2 - 1];
      const mesh = (normals, uvs, scale = [1, 1, 1]) => {
        const transform = api.identity(); transform[0] = scale[0]; transform[5] = scale[1]; transform[10] = scale[2];
        const m = v.add({ positions, normals: Array.from({ length: 4 }, () => normals).flat(), ...(uvs ? { uvs } : {}), indices }, {
          transform, material: { color: '#999999', roughness: 0.9, metallic: 0, doubleSided: true },
        });
        objects.push(m); return m;
      };
      const hide = () => { for (const m of objects) m.visible = false; };
      const retain = (name, frame) => {
        const figure = document.createElement('figure'), label = document.createElement('figcaption'), canvas = document.createElement('canvas');
        label.textContent = name; canvas.width = frame.width; canvas.height = frame.height;
        canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
        figure.append(label, canvas); document.getElementById('images').append(figure);
        return frame;
      };
      const grab = async name => retain(name, await v.capture());
      const trace = async name => {
        const session = await v.createPathTrace({ width: 48, height: 32, bounces: 1 });
        try { await session.sample(8); return retain(name, await session.capture(false)); }
        finally { session.dispose(); }
      };
      const compare = (a, b) => {
        let max = 0, sum = 0, count = 0, different = 0;
        for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) different++;
        const cx = Math.floor(a.width / 2), cy = Math.floor(a.height / 2);
        for (let y = cy - 8; y < cy + 8; y++) for (let x = cx - 8; x < cx + 8; x++) for (let c = 0; c < 3; c++) {
          const i = (y * a.width + x) * 4 + c, delta = Math.abs(a.data[i] - b.data[i]);
          max = Math.max(max, delta); sum += delta; count++;
        }
        return { max, mean: sum / count, different };
      };
      const normals = [];
      for (const row of [
        { name: 'front', mirror: false, scale: [1, 1, 1], side: 1 },
        { name: 'mirrored', mirror: true, scale: [1, 1, 1], side: 1 },
        { name: 'scaled', mirror: false, scale: [1.7, 0.6, 1.3], side: 1 },
        { name: 'scaled-mirrored', mirror: true, scale: [1.7, 0.6, 1.3], side: 1 },
        { name: 'back', mirror: false, scale: [1.7, 0.6, 1.3], side: -1 },
        { name: 'max finite normalScale', mirror: false, scale: [1, 1, 1], side: 1, normalScale: [3.4028234663852886e38, -3.4028234663852886e38] },
      ]) {
        hide();
        v.camera.position = [0, 0, 8 * row.side];
        v.lights = [{ kind: 'directional', direction: [-0.8, -0.1, -row.side], intensity: 0.6 }];
        v.camera.fit({ min: [-4, -3, -1], max: [4, 3, 1] }, v.aspect);
        const m = mesh([0, 0, 1], row.mirror ? uv.map((value, i) => i % 2 ? value : 1 - value) : uv, row.scale);
        const plain = await grab(`${row.name}: geometric`);
        m.material = { normalMap, normalScale: row.normalScale ?? [1, 1] };
        const mapped = await grab(`${row.name}: normal map`);
        m.material = { normalScale: [0, 0] };
        const zero = await grab(`${row.name}: scale zero`);
        m.visible = false;
        // The quad's tangent is ±world X and bitangent world Y. Set literal vertex normals that
        // inverse-transpose(scale), then the back-face flip, turn into that independent world normal.
        const expected = [normal[0] * (row.mirror ? -1 : 1) * (row.normalScale?.[0] ?? 1), normal[1] * (row.normalScale?.[1] ?? 1), normal[2] * row.side];
        const length = Math.hypot(...expected);
        mesh(expected.map((value, i) => value / length * row.scale[i] * row.side), uv, row.scale);
        const reference = await grab(`${row.name}: literal normal`);
        normals.push({ name: row.name, reference: compare(mapped, reference), changed: compare(mapped, plain), zero: compare(zero, plain) });
      }
      hide(); v.camera.position = [0, 0, 8];
      v.lights = [{ kind: 'directional', direction: [-0.8, -0.1, -1], intensity: 0.6 }];
      const fallback = [];
      for (const [name, uvs] of [['zero UV', new Array(8).fill(0)], ['missing UV', null]]) {
        hide(); const m = mesh([0, 0, 1], uvs), plain = await grab(`${name}: geometric`);
        m.material = { normalMap }; fallback.push({ name, delta: compare(await grab(`${name}: mapped`), plain) });
      }
      hide();
      v.lights = [{ kind: 'directional', direction: [-0.4, -0.2, -1], intensity: 0.4 }];
      v.environment = { ambient: 0.15, sky: '#ffffff', ground: '#151515', toneMapping: 'none' };
      const m = mesh([0, 0, 1], uv), rough = dataMap([7, 128, 31, 255]), metal = dataMap([7, 31, 128, 255]), packed = dataMap([7, 128, 64, 255]);
      const base = { color: '#9f5533', roughness: 0.9, metallic: 0.65, normalMap: null, roughnessMap: null, metallicMap: null };
      const scalar = [];
      for (const row of [
        { name: 'roughness G128', maps: { roughnessMap: rough }, r: 128 / 255, m: 1 },
        { name: 'metallic B128', maps: { metallicMap: metal }, r: 1, m: 128 / 255 },
        { name: 'shared packed G128 B64', maps: { roughnessMap: packed, metallicMap: packed }, r: 128 / 255, m: 64 / 255 },
      ]) {
        m.material = { ...base, ...row.maps }; const mapped = await grab(`${row.name}: mapped`);
        m.material = { ...base, roughness: base.roughness * row.r, metallic: base.metallic * row.m };
        const reference = await grab(`${row.name}: literal linear factor`);
        const decode = x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        m.material = { ...base, roughness: base.roughness * decode(row.r), metallic: base.metallic * decode(row.m) };
        const wrong = await grab(`${row.name}: incorrect sRGB factor`);
        scalar.push({ name: row.name, reference: compare(mapped, reference), wrong: compare(mapped, wrong) });
      }
      m.material = base; const neutral = await grab('dispose: neutral');
      const disposable = dataMap([204, 128, 230, 255]); m.material = { normalMap: disposable };
      const before = await grab('dispose: live map'); disposable.dispose();
      const disposed = await grab('dispose: neutral fallback');
      const replacement = dataMap([204, 128, 230, 255]); m.material = { normalMap: replacement };
      const rebound = await grab('dispose: replacement');
      const lifecycle = { changed: compare(before, neutral), disposed: compare(disposed, neutral), rebound: compare(rebound, before) };
      hide(); v.camera.position = [0, 0, 8];
      v.lights = [{ kind: 'directional', direction: [-0.8, -0.1, -1], intensity: 0.6 }];
      v.environment = { ambient: 0, sky: '#000000', ground: '#000000', toneMapping: 'none' };
      const transport = [];
      for (const row of [
        { name: 'progressive front normal', mirror: false, scale: [1, 1, 1] },
        { name: 'progressive mirrored scaled normal', mirror: true, scale: [1.7, 0.6, 1.3] },
      ]) {
        hide();
        const mappedMesh = mesh([0, 0, 1], row.mirror ? uv.map((value, i) => i % 2 ? value : 1 - value) : uv, row.scale);
        mappedMesh.material = { normalMap };
        const mapped = await trace(`${row.name}: mapped`);
        mappedMesh.material = { normalMap: null }; const plain = await trace(`${row.name}: geometric`);
        mappedMesh.visible = false;
        const expected = [normal[0] * (row.mirror ? -1 : 1), normal[1], normal[2]];
        mesh(expected.map((value, i) => value * row.scale[i]), uv, row.scale);
        const reference = await trace(`${row.name}: literal normal`);
        transport.push({ name: row.name, samples: [mapped.samples, plain.samples, reference.samples], reference: compare(mapped, reference), changed: compare(mapped, plain) });
      }
      hide(); const tracedMaterial = mesh([0, 0, 1], uv);
      v.lights = [{ kind: 'directional', direction: [-0.4, -0.2, -1], intensity: 0.4 }];
      for (const row of [
        { name: 'progressive roughness G128', maps: { roughnessMap: rough }, r: 128 / 255, m: 1 },
        { name: 'progressive metallic B128', maps: { metallicMap: metal }, r: 1, m: 128 / 255 },
        { name: 'progressive shared packed G128 B64', maps: { roughnessMap: packed, metallicMap: packed }, r: 128 / 255, m: 64 / 255 },
      ]) {
        tracedMaterial.material = { ...base, ...row.maps }; const mapped = await trace(`${row.name}: mapped`);
        tracedMaterial.material = { ...base, roughness: base.roughness * row.r, metallic: base.metallic * row.m };
        const reference = await trace(`${row.name}: literal linear factor`);
        tracedMaterial.material = base; const plain = await trace(`${row.name}: scalar only`);
        transport.push({ name: row.name, samples: [mapped.samples, plain.samples, reference.samples], reference: compare(mapped, reference), changed: compare(mapped, plain) });
      }
      v.dispose();
      return { normals, fallback, scalar, lifecycle, transport, textureDisposed: textures.every(texture => texture.disposed) };
    });
    t.diagnostic(JSON.stringify({ result, errors }));
    if (evidence) { await writeFile(join(evidence, 'result.json'), JSON.stringify({ result, errors }, null, 2), { flag: 'wx' }); await page.screenshot({ path: join(evidence, 'images.png'), fullPage: true }); }
    for (const row of result.normals) {
      assert.ok(row.reference.max <= 1, `${row.name}: normal map agrees with literal geometry normal: ${JSON.stringify(row)}`);
      assert.ok(row.changed.mean > 3, `${row.name}: mapped normal changes lighting`);
      assert.equal(row.zero.different, 0, `${row.name}: scale zero restores every original byte`);
    }
    for (const row of result.fallback) assert.equal(row.delta.different, 0, `${row.name}: degenerate tangent frame keeps the original normal`);
    for (const row of result.scalar) {
      assert.ok(row.reference.max <= 1, `${row.name}: data map matches literal linear scalar: ${JSON.stringify(row)}`);
      assert.ok(row.wrong.mean > 3, `${row.name}: independent sRGB negative control differs`);
    }
    assert.ok(result.lifecycle.changed.mean > 3, 'a live normal map changes lighting');
    assert.equal(result.lifecycle.disposed.different, 0, 'disposed data map falls back to neutral');
    assert.equal(result.lifecycle.rebound.different, 0, 'replacement restores the mapped image');
    for (const row of result.transport) {
      assert.deepEqual(row.samples, [8, 8, 8], `${row.name}: each new map oracle owns its captured sample count`);
      assert.ok(row.reference.max <= 2, `${row.name}: progressive map agrees with its independent literal reference: ${JSON.stringify(row)}`);
      assert.ok(row.changed.mean > 3, `${row.name}: progressive map affects transport`);
    }
    assert.equal(result.textureDisposed, true); assert.deepEqual(errors, []);
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
