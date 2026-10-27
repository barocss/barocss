// CHROME=/path/to/chrome PW_DIR=/path/to/playwright node --test tests/viewer-glb-texture-browser.test.mjs
// GPU_GLB_TEXTURE_EVIDENCE_DIR preserves the raw result, PNG and first failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/', import.meta.url));
const fixture = fileURLToPath(new URL('../examples/glb-texture-sample.js', import.meta.url));

test('embedded PNG and JPEG base colour: UV, colour, rejection and texture cleanup', { timeout: 180000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR required'); return; }
  const server = createServer(async (req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><style>body{background:#222;color:white;font:16px sans-serif}canvas{width:256px;height:256px;image-rendering:pixelated}#frames{display:flex;gap:1em}figure{margin:0}</style><canvas id="view" width="96" height="96"></canvas><div id="frames"></div>'); return;
    }
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/glb-texture-sample.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(fixture)); return; }
    const base = req.url?.startsWith('/cad/') ? cad : dist;
    const file = resolve(base, '.' + (base === cad ? req.url.slice(4) : (req.url ?? '')));
    if (!file.startsWith(base)) { res.writeHead(404); res.end(); return; }
    try { res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(file)); }
    catch { res.writeHead(404); res.end(); }
  });
  let browser, page, evidence;
  const errors = [];
  try {
    if (process.env.GPU_GLB_TEXTURE_EVIDENCE_DIR) {
      await mkdir(process.env.GPU_GLB_TEXTURE_EVIDENCE_DIR, { recursive: true });
      evidence = await mkdtemp(join(process.env.GPU_GLB_TEXTURE_EVIDENCE_DIR, 'glb-texture-'));
      t.diagnostic(`evidence: ${evidence}`);
    }
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    if (!await page.evaluate(async () => !!await navigator.gpu?.requestAdapter())) { t.skip('no WebGPU adapter'); return; }
    const result = await page.evaluate(async () => {
      const api = await import('/viewer/index.js'), { textureSample, packTexturedGlb } = await import('/glb-texture-sample.js');
      const reports = [], groups = [];
      const viewer = await api.createViewer(document.getElementById('view'), { controls: false, autoResize: false, antialias: false, pixelRatio: 1,
        background: '#000000', lights: [], camera: { position: [0,0,5], target: [0,0,0], up: [0,1,0], projection: 'orthographic', fovY: 2 * Math.atan(2 / 5) * 180 / Math.PI },
        environment: { sky: '#000000', ground: '#000000', ambient: 0, toneMapping: 'none' }, onRequestRender: () => {}, onError: message => reports.push(message) });
      const device = viewer.computeDevice; device.pushErrorScope('validation');
      const keep = (label, frame) => { const figure = document.createElement('figure'), caption = document.createElement('figcaption'), image = document.createElement('canvas');
        image.width = frame.width; image.height = frame.height; caption.textContent = label;
        image.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
        figure.append(caption,image); document.getElementById('frames').append(figure); };
      const pixel = (frame,x,y) => [...frame.data.slice((y*frame.width+x)*4,(y*frame.width+x)*4+4)];
      const samplePixels = frame => [[24,24],[72,24],[24,72],[72,72]].map(([x,y]) => pixel(frame,x,y));
      const failSync = action => { try { action(); return null; } catch (e) { return { code: e.code ?? null, name: e.name, message: e.message }; } };
      const failAsync = async action => { try { const group = await action(); group?.dispose(); return null; } catch (e) { return { code: e.code ?? null, name: e.name, message: e.message }; } };
      const mutate = (sample, change) => { const json = structuredClone(sample.json); change(json); return packTexturedGlb(json, sample.bin); };
      try {
        const samples = {};
        for (const mime of ['image/png','image/jpeg']) {
          const fixture = await textureSample(mime), prepared = api.prepareTexturedGlb(fixture.bytes), group = await api.materializeGlbTextures(viewer, prepared); groups.push(group);
          const row = group.primitives[0], map = row.material.map;
          const geometry = viewer.createGeometry(row.geometry), mesh = viewer.add(geometry, { material: { ...row.material, unlit: true }, transform: row.transform });
          const frame = await viewer.capture(); keep(mime,frame);
          mesh.remove(); geometry.dispose();
          group.dispose(); group.dispose();
          samples[mime] = { primitives: prepared.primitives.length, textures: prepared.textures.length, mime: prepared.textures[0].mimeType,
            uv: [...prepared.primitives[0].geometry.uvs], baseColorTexture: prepared.primitives[0].baseColorTexture,
            options: prepared.textures[0].options, opacity: row.material.opacity, pixels: samplePixels(frame), disposed: map.disposed };
        }
        const fixture = await textureSample('image/png');
        const parserFailures = [
          mutate(fixture,j => { delete j.meshes[0].primitives[0].attributes.TEXCOORD_0; }),
          mutate(fixture,j => { j.accessors[3].type = 'VEC3'; }),
          mutate(fixture,j => { j.samplers[0].wrapS = 10497; }),
          mutate(fixture,j => { j.samplers[0].wrapS = j.samplers[0].wrapT = 33648; }),
          mutate(fixture,j => { j.samplers[0].magFilter = 9729; }),
          mutate(fixture,j => { j.images[0].uri = 'outside.png'; delete j.images[0].bufferView; }),
          mutate(fixture,j => { j.images[0].mimeType = 'image/webp'; }),
          mutate(fixture,j => { j.materials[0].pbrMetallicRoughness.baseColorTexture.texCoord = 1; })
        ].map(bytes => failSync(() => api.prepareTexturedGlb(bytes)));
        const alphaIgnored = api.prepareTexturedGlb(mutate(fixture,j => { j.materials[0].pbrMetallicRoughness.baseColorFactor[3] = 0.25; })).primitives[0].material.opacity;
        const sharedPrepared = api.prepareTexturedGlb(mutate(fixture,j => { j.meshes[0].primitives.push(structuredClone(j.meshes[0].primitives[0])); }));
        const sharedGroup = await api.materializeGlbTextures(viewer,sharedPrepared); groups.push(sharedGroup);
        const sharedMap = sharedGroup.primitives[0].material.map;
        const sharing = { primitiveCount: sharedGroup.primitives.length, textureCount: sharedPrepared.textures.length,
          sameMap: sharedMap === sharedGroup.primitives[1].material.map };
        sharedGroup.dispose(); sharedGroup.dispose(); sharing.disposed = sharedMap.disposed;
        // materialize is async: changes made immediately after the call must not alter the accepted input.
        const pendingBytes = mutate(fixture,j => {
          j.textures.push({ source: 0, sampler: 0 });
          const second = structuredClone(j.materials[0]); second.pbrMetallicRoughness.baseColorTexture.index = 1; j.materials.push(second);
          const primitive = structuredClone(j.meshes[0].primitives[0]); primitive.material = 1; j.meshes[0].primitives.push(primitive);
        });
        const pendingInput = api.prepareTexturedGlb(pendingBytes);
        const pending = api.materializeGlbTextures(viewer,pendingInput);
        pendingInput.textures[0].bytes.fill(0); pendingInput.textures[0].options.filter = 'linear';
        pendingInput.textures[1].bytes.fill(0); pendingInput.textures[1].options.filter = 'linear';
        pendingInput.primitives[0].baseColorTexture = null; pendingInput.primitives[0].material.color = [0,0,0];
        pendingInput.primitives[0].geometry.uvs.fill(0); pendingInput.primitives[0].transform[12] = 42;
        pendingInput.primitives[1].baseColorTexture = null; pendingInput.primitives[1].material.color = [0,0,0];
        pendingInput.primitives[1].geometry.uvs.fill(0); pendingInput.primitives[1].transform[12] = 42;
        const snapshotGroup = await pending; groups.push(snapshotGroup);
        const snapshotRow = snapshotGroup.primitives[0], snapshotMap = snapshotRow.material.map;
        const snapshotGeometry = viewer.createGeometry(snapshotRow.geometry);
        const snapshotMesh = viewer.add(snapshotGeometry, { material: { ...snapshotRow.material, unlit: true }, transform: snapshotRow.transform });
        const snapshotFrame = await viewer.capture();
        const snapshot = { uv: [...snapshotRow.geometry.uvs], transformX: snapshotRow.transform[12],
          color: [...snapshotRow.material.color], filter: snapshotMap.options.filter, pixels: samplePixels(snapshotFrame),
          second: { uv: [...snapshotGroup.primitives[1].geometry.uvs], transformX: snapshotGroup.primitives[1].transform[12],
            color: [...snapshotGroup.primitives[1].material.color], filter: snapshotGroup.primitives[1].material.map.options.filter } };
        snapshotMesh.remove(); snapshotGeometry.dispose(); snapshotGroup.dispose();
        const invalidImage = await textureSample('image/png',{ corruptImage: true });
        const transparent = await textureSample('image/png',{ transparent: true });
        const decodeFailure = await failAsync(() => api.materializeGlbTextures(viewer,api.prepareTexturedGlb(invalidImage.bytes)));
        const alphaFailure = await failAsync(() => api.materializeGlbTextures(viewer,api.prepareTexturedGlb(transparent.bytes)));
        const brokenImage = invalidImage.bin.slice(140), secondOffset = Math.ceil(fixture.bin.length / 4) * 4, bin = new Uint8Array(secondOffset + brokenImage.length);
        bin.set(fixture.bin); bin.set(brokenImage, secondOffset);
        const j = structuredClone(fixture.json); j.buffers[0].byteLength = bin.length;
        j.bufferViews.push({ buffer: 0, byteOffset: secondOffset, byteLength: brokenImage.length });
        j.images.push({ bufferView: j.bufferViews.length - 1, mimeType: 'image/png' }); j.textures.push({ source: 1, sampler: 0 });
        const secondMaterial = structuredClone(j.materials[0]); secondMaterial.pbrMetallicRoughness.baseColorTexture.index = 1; j.materials.push(secondMaterial);
        const secondPrimitive = structuredClone(j.meshes[0].primitives[0]); secondPrimitive.material = 1; j.meshes[0].primitives.push(secondPrimitive);
        const nativeCreateTexture = viewer.createTexture, allocated = [];
        viewer.createTexture = function (...args) { const texture = Reflect.apply(nativeCreateTexture, this, args); allocated.push(texture); return texture; };
        let partialFailure;
        try { partialFailure = await failAsync(() => api.materializeGlbTextures(viewer,api.prepareTexturedGlb(packTexturedGlb(j,bin)))); }
        finally { delete viewer.createTexture; }
        const partialCleanup = { count: allocated.length, allDisposed: allocated.every(texture => texture.disposed) };
        const validation = (await device.popErrorScope())?.message ?? null;
        return { samples, parserFailures, alphaIgnored, sharing, snapshot, decodeFailure, alphaFailure, partialFailure, partialCleanup, validation, reports };
      } finally { for (const group of groups) group.dispose(); viewer.dispose(); }
    });
    result.errors = errors; t.diagnostic(JSON.stringify(result));
    if (evidence) { await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2)+'\n'); await page.screenshot({ path: join(evidence,'images.png'), fullPage: true }); }
    const expected = [[240,48,32,255],[24,208,72,255],[32,80,240,255],[128,128,128,255]];
    for (const mime of ['image/png','image/jpeg']) {
      const item = result.samples[mime], tolerance = mime === 'image/png' ? 3 : 12;
      assert.equal(item.primitives,1); assert.equal(item.textures,1); assert.equal(item.mime,mime); assert.equal(item.baseColorTexture,0);
      assert.deepEqual(item.uv,[0,1,1,1,1,0,0,0]); assert.equal(item.opacity,1); assert.equal(item.disposed,true);
      assert.deepEqual(item.options,{ srgb: true, mipmaps: false, wrap: 'clamp', filter: 'nearest' });
      item.pixels.forEach((p,i) => p.forEach((v,c) => assert.ok(Math.abs(v-expected[i][c]) <= tolerance, `${mime} pixel ${i} channel ${c}: ${v} != ${expected[i][c]}`)));
    }
    assert.equal(result.alphaIgnored,1); assert.ok(result.parserFailures.every(e => e?.code === 'GEOMETRY_INVALID'),JSON.stringify(result.parserFailures));
    assert.deepEqual(result.sharing,{ primitiveCount: 2, textureCount: 1, sameMap: true, disposed: true });
    assert.deepEqual(result.snapshot.uv,[0,1,1,1,1,0,0,0]); assert.equal(result.snapshot.transformX,0);
    assert.deepEqual(result.snapshot.color,[1,1,1]); assert.equal(result.snapshot.filter,'nearest');
    assert.deepEqual(result.snapshot.second,{ uv: [0,1,1,1,1,0,0,0], transformX: 0, color: [1,1,1], filter: 'nearest' });
    result.snapshot.pixels.forEach((p,i) => p.forEach((v,c) => assert.ok(Math.abs(v-expected[i][c]) <= 3, `snapshot pixel ${i} channel ${c}: ${v} != ${expected[i][c]}`)));
    assert.equal(result.decodeFailure?.code,'TEXTURE_INVALID'); assert.equal(result.alphaFailure?.code,'TEXTURE_INVALID');
    assert.equal(result.partialFailure?.code,'TEXTURE_INVALID'); assert.equal(result.partialCleanup.count,1,JSON.stringify(result.partialCleanup));
    assert.equal(result.partialCleanup.allDisposed,true,JSON.stringify(result.partialCleanup));
    assert.equal(result.validation,null); assert.deepEqual(result.reports,[]); assert.deepEqual(errors,[]);
  } catch (error) {
    if (evidence) {
      await writeFile(join(evidence,'first-error.json'),JSON.stringify({ name: error.name, message: error.message, stack: error.stack, errors },null,2)+'\n');
      if (page && !page.isClosed()) await page.screenshot({ path: join(evidence,'failure.png'), fullPage: true }).catch(() => {});
    }
    throw error;
  } finally { if (browser) await browser.close(); if (server.listening) await new Promise(r => server.close(r)); }
});
