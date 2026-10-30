// CHROME=/path/to/chrome PW_DIR=/path/to/playwright node --test tests/viewer-glb-u32-browser.test.mjs
// Synthetic 04.1 fixture only; GPU_GLB_U32_EVIDENCE_DIR preserves first failure and PNG.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/',import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/',import.meta.url));
const examples = fileURLToPath(new URL('../examples/',import.meta.url));

test('04.1 u32 65535 and 65536 draw, pick, mirrored winding and textured materialize', { timeout: 180000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR required'); return; }
  const server = createServer(async (req,res) => {
    if (req.url === '/') { res.setHeader('Content-Type','text/html'); res.end('<script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><style>body{background:#222;color:white;font:16px sans-serif}#view{width:96px;height:96px}#frames{display:flex;gap:12px}figure{margin:0}figure canvas{width:256px;height:256px;image-rendering:pixelated}</style><canvas id="view" width="96" height="96"></canvas><div id="frames"></div>'); return; }
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const example = req.url === '/glb-u32-sample.js' || req.url === '/glb-texture-sample.js';
    const base = example ? examples : req.url?.startsWith('/cad/') ? cad : dist;
    const rel = base === cad ? req.url.slice(4) : (req.url ?? '');
    const file = resolve(base,'.'+rel);
    if (!file.startsWith(base)) { res.writeHead(404); res.end(); return; }
    try { res.setHeader('Content-Type','text/javascript'); res.end(await readFile(file)); }
    catch { res.writeHead(404); res.end(); }
  });
  let browser,page,evidence; const errors = [];
  try {
    if (process.env.GPU_GLB_U32_EVIDENCE_DIR) { await mkdir(process.env.GPU_GLB_U32_EVIDENCE_DIR,{ recursive: true }); evidence = await mkdtemp(join(process.env.GPU_GLB_U32_EVIDENCE_DIR,'glb-u32-')); t.diagnostic(`evidence: ${evidence}`); }
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const { chromium } = createRequire(join(process.env.PW_DIR,'package.json'))('playwright');
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
    page.on('pageerror',error => errors.push(String(error))); page.on('console',message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    if (!await page.evaluate(async () => !!await navigator.gpu?.requestAdapter())) { t.skip('no WebGPU adapter'); return; }
    const result = await page.evaluate(async () => {
      const api = await import('/viewer/index.js'), { u32Sample } = await import('/glb-u32-sample.js'), { textureSample } = await import('/glb-texture-sample.js');
      const reports = [], viewer = await api.createViewer(document.getElementById('view'), { controls: false, autoResize: false, antialias: false, pixelRatio: 1,
        background: '#000000', lights: [], camera: { position: [0,0,5], target: [0,0,0], up: [0,1,0], projection: 'orthographic', fovY: 2 * Math.atan(2 / 5) * 180 / Math.PI },
        environment: { sky: '#000000', ground: '#000000', ambient: 0, toneMapping: 'none' }, onRequestRender: () => {}, onError: message => reports.push(message) });
      const device = viewer.computeDevice; device.pushErrorScope('validation');
      const pixel = (frame,x,y) => [...frame.data.slice((y*frame.width+x)*4,(y*frame.width+x)*4+4)];
      const keep = (label,frame) => { const figure = document.createElement('figure'), caption = document.createElement('figcaption'), image = document.createElement('canvas'); image.width = frame.width; image.height = frame.height; caption.textContent = label; image.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data),frame.width,frame.height),0,0); figure.append(caption,image); document.getElementById('frames').append(figure); };
      const draw = async (row,label,material) => {
        const geometry = viewer.createGeometry(row.geometry), mesh = viewer.add(geometry,{ material: { ...row.material, ...material, unlit: true }, transform: row.transform });
        try {
          const frame = await viewer.capture(), hit = await viewer.pick(48,48); keep(label,frame);
          return { parserType: row.geometry.indices.constructor.name, gpuGeometryType: geometry.data.indices.constructor.name,
            indices: [...geometry.data.indices], center: pixel(frame,48,48), hit: hit?.mesh === mesh, triangle: hit?.triangle ?? null, point: hit?.point ?? null,
            samples: [[44,42],[52,42],[40,60],[56,60]].map(([x,y]) => pixel(frame,x,y)) };
        } finally { mesh.remove(); geometry.dispose(); }
      };
      try {
        const normal = await draw(api.prepareGlb(u32Sample().bytes)[0],'u32 original',{ color: '#ff0000' });
        const mirror = await draw(api.prepareGlb(u32Sample({ mirrored: true }).bytes)[0],'u32 reflected',{ color: '#ff0000' });
        const sample = await textureSample('image/png'), prepared = api.prepareTexturedGlb(u32Sample({ imageBytes: sample.bin.slice(140) }).bytes);
        const group = await api.materializeGlbTextures(viewer,prepared);
        let textured, disposed;
        try { const map = group.primitives[0].material.map; textured = await draw(group.primitives[0],'u32 textured PNG',{}); group.dispose(); disposed = map.disposed; }
        finally { group.dispose(); }
        const validation = (await device.popErrorScope())?.message ?? null;
        return { normal,mirror,textured,disposed,validation,reports };
      } finally { viewer.dispose(); }
    });
    result.errors = errors; t.diagnostic(JSON.stringify(result));
    if (evidence) { await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2)+'\n'); await page.screenshot({ path: join(evidence,'images.png'), fullPage: true }); }
    for (const [name,expected] of [['normal',[0,65535,65536]],['mirror',[0,65536,65535]],['textured',[0,65535,65536]]]) {
      const row = result[name]; assert.equal(row.parserType,'Uint32Array'); assert.equal(row.gpuGeometryType,'Uint32Array'); assert.deepEqual(row.indices,expected); assert.equal(row.hit,true,`${name} pick`);
      assert.equal(row.triangle,0,`${name} picked triangle`); assert.equal(row.point?.length,3,`${name} picked point`);
      assert.ok(Math.abs(row.point[0]) < 0.05 && Math.abs(row.point[1]) < 0.05 && Math.abs(row.point[2]) < 0.01,`${name} picked point: ${row.point}`);
    }
    for (const name of ['normal','mirror']) assert.ok(result[name].center[0] > 245 && result[name].center[1] < 5 && result[name].center[2] < 5,`${name}: ${result[name].center}`);
    const expected = [[240,48,32,255],[24,208,72,255],[32,80,240,255],[128,128,128,255]];
    assert.equal(result.textured.samples.length,4); result.textured.samples.forEach((sample,i) => {
      assert.equal(sample.length,4); sample.forEach((v,c) => assert.ok(Math.abs(v-expected[i][c]) <= 4,`texture pixel ${i} channel ${c}: ${v} != ${expected[i][c]}`));
    });
    assert.equal(result.disposed,true); assert.equal(result.validation,null); assert.deepEqual(result.reports,[]); assert.deepEqual(errors,[]);
  } catch (error) {
    if (evidence) { await writeFile(join(evidence,'first-error.json'),JSON.stringify({ name: error.name, message: error.message, stack: error.stack, errors },null,2)+'\n'); if (page && !page.isClosed()) await page.screenshot({ path: join(evidence,'failure.png'), fullPage: true }).catch(() => {}); }
    throw error;
  } finally { if (browser) await browser.close(); if (server.listening) await new Promise(resolve => server.close(resolve)); }
});
