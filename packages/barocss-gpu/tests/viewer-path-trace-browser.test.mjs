import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/', import.meta.url));
async function open(t) {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR required'); return null; }
  const server = createServer(async (req, res) => {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><canvas id="c" style="width:320px;height:240px"></canvas>'); return; }
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const base = req.url?.startsWith('/cad/') ? cad : dist;
    const f = resolve(base, '.' + (base === cad ? req.url.slice(4) : (req.url ?? '')));
    if (!f.startsWith(base)) { res.writeHead(404); res.end(); return; }
    try { res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(f)); } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  if (!await page.evaluate(async () => !!await navigator.gpu?.requestAdapter())) { await browser.close(); server.close(); t.skip('no WebGPU adapter'); return null; }
  return { page, errors, close: async () => { await browser.close(); await new Promise(r => server.close(r)); } };
}


for (const projection of ['orthographic', 'perspective']) test(`path trace ${projection}: convergence, denoising, stop, frozen capture and raster independence`, { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const result = await s.page.evaluate(async projection => {
      const api = await import('/viewer/index.js'), canvas = document.getElementById('c');
      const v = await api.createViewer(canvas, { controls: false, pixelRatio: 1, antialias: false, camera: { position: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0], projection }, background: '#000000', lights: [], environment: { sky: '#ffffff', ground: '#333333', ambient: 1, toneMapping: 'none' } });
      const m = v.add({ positions: [-5, -5, 0, 5, -5, 0, 5, 5, 0, -5, -5, 0, 5, 5, 0, -5, 5, 0] }, { material: { color: '#888888', roughness: 0.8 } });
      const trace = await v.createPathTrace({ width: 48, height: 32, bounces: 4 });
      await trace.sample(1); const one = await trace.capture(false);
      await trace.sample(7); const eight = await trace.capture(false), denoised = await trace.capture(true);
      await trace.sample(64); await trace.sample(56); const reference = await trace.capture(false);
      const mse = frame => { let sum = 0; for (let i = 0; i < frame.data.length; i += 4) sum += (frame.data[i] - reference.data[i]) ** 2; return sum / (frame.data.length / 4); };
      const errors = { one: mse(one), eight: mse(eight), denoised: mse(denoised) };
      const before = [...reference.data]; v.camera.position = [4, 0, 4]; m.material = { color: '#00ff00' };
      const raster = await v.capture(); const frozen = await trace.capture(false);
      let difference = 0; for (let i = 0; i < before.length; i++) difference += before[i] !== frozen.data[i] ? 1 : 0;
      const count = trace.samples; let callbacks = 0;
      await trace.start(() => { callbacks++; if (callbacks === 3) trace.stop(); });
      const final = trace.samples, stopped = !trace.running;
      const frameSamples = { one: one.samples, eight: eight.samples, denoised: denoised.samples, reference: reference.samples, frozen: frozen.samples };
      trace.dispose(); let disposed = false; try { await trace.capture(); } catch (e) { disposed = e.code === 'DISPOSED'; }
      const sessions = v.pathTraces.size; v.dispose();
      return { errors, difference, count, final, stopped, callbacks, disposed, sessions, frameSamples, raster: [raster.width, raster.height] };
    }, projection);
    t.diagnostic(JSON.stringify(result));
    assert.ok(result.errors.eight < result.errors.one * 0.5, 'eight samples reduce reference error');
    assert.ok(result.errors.denoised < result.errors.eight, 'our geometry-aware denoiser reduces low-sample noise');
    assert.equal(result.difference, 0, 'snapshot remains byte-identical after live camera/material edits and raster rendering');
    assert.deepEqual(result.frameSamples, { one: 1, eight: 8, denoised: 8, reference: 128, frozen: 128 }, 'captured sample counts remain fixed after later sampling');
    assert.equal(result.frameSamples.eight, result.frameSamples.denoised, 'raw and denoised captures describe the same sampled image');
    assert.equal(result.final, result.count + 3); assert.equal(result.callbacks, 3); assert.equal(result.stopped, true); assert.equal(result.disposed, true); assert.equal(result.sessions, 0);
    assert.deepEqual(result.raster, [320, 240]); assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

test('path trace G15a finishes, colour map, coat/film, instances, direct shadows and explicit refusals', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const result = await s.page.evaluate(async () => {
      const api = await import('/viewer/index.js'), v = await api.createViewer(document.getElementById('c'), { controls: false, camera: { position: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0] }, background: '#000000', lights: [{kind: 'directional', direction: [-0.5, 0, -1], intensity: 2}], environment: { ambient: 0.4, sky: '#ffffff', ground: '#333333', toneMapping: 'aces' } });
      const geom = { positions: [-3, -3, 0, 3, -3, 0, 3, 3, 0, -3, -3, 0, 3, 3, 0, -3, 3, 0], uvs: [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1] };
      const map = v.createTexture({ width: 2, height: 2, data: new Uint8Array([255,0,0,255, 0,255,0,255, 255,0,0,255, 0,255,0,255]) }, { filter: 'nearest', mipmaps: false });
      const m = v.add(geom, { material: { color: '#ffffff', map, metallic: 0.7, roughness: 0.4, clearcoat: 0.5, film: 0.6, doubleSided: true }, instances: { transforms: [...api.translation([0,0,0])] } });
      const sums = [], frameSamples = [];
      for (const kind of [null, ...api.SURFACE_FINISHES]) {
        m.material = { finish: kind ? { kind, scale: 0.3, strength: 0.8 } : null };
        const tr = await v.createPathTrace({ width: 32, height: 24, bounces: 3 }); await tr.sample(8); const image = await tr.capture(false);
        frameSamples.push(image.samples);
        let sum = 0; for (let i=0;i<image.data.length;i+=4) sum += image.data[i] + image.data[i+1] + image.data[i+2]; sums.push(sum); tr.dispose();
      }
      m.material = { finish: null, unlit: true, metallic: 0 };
      const tr = await v.createPathTrace({ width: 33, height: 25 }); await tr.sample(4); const image = await tr.capture(false);
      const at = (x,y) => [...image.data.slice((y * image.width + x)*4,(y * image.width + x)*4+4)];
      const left=at(12,12), right=at(21,12); tr.dispose();
      const refused = [];
      for (const options of [{width:0}, {bounces:0}]) { try { await v.createPathTrace(options); } catch(e) { refused.push(e.code); } }
      v.clipPlane = { normal: [1,0,0], offset: 0 }; try { await v.createPathTrace(); } catch(e) { refused.push(e.code); }
      v.clipPlane = null; m.material = { shader: {expression:'vec3f(1.0)'} }; try { await v.createPathTrace(); } catch(e) { refused.push(e.code); }
      const sessions = v.pathTraces.size; v.dispose(); return { sums, left, right, refused, sessions, frameSamples, colourMapSamples: image.samples };
    });
    t.diagnostic(JSON.stringify(result)); assert.ok(result.sums.every(x=>x>0)); assert.ok(new Set(result.sums).size >= 6, 'shared G15a finishes alter transport');
    assert.deepEqual(result.frameSamples, result.sums.map(() => 8), 'each finish capture records eight samples');
    assert.equal(result.colourMapSamples, 4, 'colour map capture records four samples');
    assert.ok(result.left[0]>200 && result.left[1]<10); assert.ok(result.right[1]>200 && result.right[0]<10);
    assert.deepEqual(result.refused, ['SIZE_INVALID','PATH_TRACE_UNSUPPORTED','PATH_TRACE_UNSUPPORTED','PATH_TRACE_UNSUPPORTED']); assert.equal(result.sessions,0); assert.deepEqual(s.errors,[]);
  } finally { await s.close(); }
});

test('path trace BVH shadows and secondary emissive transport have independent image oracles', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const result = await s.page.evaluate(async () => {
      const api = await import('/viewer/index.js');
      const v = await api.createViewer(document.getElementById('c'), { controls: false, camera: { position: [0,-5,6], target: [0,0,0], up: [0,0,1], projection:'orthographic' }, background:'#000000', lights:[{kind:'directional',direction:[-0.4,0,-1],intensity:1}], environment:{ambient:0,toneMapping:'none'} });
      const quad = (a,b,c,d) => ({positions:[...a,...b,...c,...a,...c,...d]});
      v.add(quad([-5,-5,0],[5,-5,0],[5,5,0],[-5,5,0]), { material:{color:'#888888',roughness:1} });
      const image = async (bounces,samples) => {const tr=await v.createPathTrace({width:64,height:48,bounces});await tr.sample(samples);const im=await tr.capture(false);tr.dispose();return im;};
      const point = (p) => {const m=v.camera.viewProjection(64/48);const q=[...p,1],c=[0,1,2,3].map(r=>q.reduce((sum,v,k)=>sum+m[k*4+r]*v,0));return [Math.round((c[0]/c[3]*.5+.5)*64),Math.round((.5-c[1]/c[3]*.5)*48)];};
      const mean = (im,p) => {const [x,y]=point(p);let sum=0,n=0;for(let j=y-1;j<=y+1;j++)for(let i=x-1;i<=x+1;i++){sum+=im.data[(j*64+i)*4];n++;}return sum/n;};
      const clear = await image(1,8);
      const blocker=v.add(quad([-.5,-.5,1],[.5,-.5,1],[.5,.5,1],[-.5,.5,1]),{material:{doubleSided:true,color:'#888888'}});
      const blocked = await image(1,8);
      const shadow = {clear:mean(clear,[-.4,0,0]),blocked:mean(blocked,[-.4,0,0])};
      blocker.visible=false;v.lights=[];
      v.add(quad([1.2,-1,0],[1.2,-1,2],[1.2,1,2],[1.2,1,0]),{material:{color:'#ff0000',emissive:2,doubleSided:true,roughness:1}});
      const direct=await image(1,8), indirect=await image(4,64);
      const transport={direct:mean(direct,[-.5,0,0]),indirect:mean(indirect,[-.5,0,0])};
      const frameSamples = { clear: clear.samples, blocked: blocked.samples, direct: direct.samples, indirect: indirect.samples };
      v.dispose();return {shadow,transport,frameSamples};
    });
    t.diagnostic(JSON.stringify(result));
    assert.deepEqual(result.frameSamples, { clear: 8, blocked: 8, direct: 8, indirect: 64 }, 'each image oracle retains its own sampled image count');
    assert.ok(result.shadow.clear > 50 && result.shadow.blocked < result.shadow.clear * 0.2,'occluder blocks the direct light along the BVH shadow ray');
    assert.equal(result.transport.direct,0); assert.ok(result.transport.indirect > 10,'secondary paths carry red emission onto the floor'); assert.deepEqual(s.errors,[]);
  } finally { await s.close(); }
});
