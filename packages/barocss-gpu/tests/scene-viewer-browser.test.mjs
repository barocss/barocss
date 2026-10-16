// The CSS-shaped scene language on the viewer, in Chrome's WebGPU: objects become meshes with their
// placement and colour; updates move them; a source with errors leaves the scene and returns diagnostics.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --test tests/scene-viewer-browser.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const bundle = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/index.js');
const page = `<!doctype html><meta charset="utf-8"><style>body{margin:0}canvas{display:block;width:320px;height:240px}</style><canvas id="c"></canvas>`;

test('CSS scenes show on the viewer', { timeout: 120000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR are required'); return; }
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = createServer(async (req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
    if (req.url === '/gpu.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(bundle)); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: process.env.VIEWER_ADAPTER === 'swiftshader' ? ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'] : ['--enable-unsafe-webgpu'] });
  const errors = [];
  try {
    const p = await browser.newPage();
    p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(`http://127.0.0.1:${server.address().port}/`);
    if (!await p.evaluate(async () => !!(await navigator.gpu?.requestAdapter()))) { t.skip('no WebGPU adapter'); return; }
    const r = await p.evaluate(async () => {
      const gpu = await import('/gpu.js');
      const viewer = await gpu.createViewer(document.getElementById('c'), { pixelRatio: 1, controls: false });
      const screen = q => { const m = viewer.camera.viewProjection(viewer.aspect), c = [0, 1, 3].map(k => m[k] * q[0] + m[4 + k] * q[1] + m[8 + k] * q[2] + m[12 + k]); return [(c[0] / c[2] * 0.5 + 0.5) * 320, (0.5 - c[1] / c[2] * 0.5) * 240]; };
      const pixel = (img, [x, y]) => { const i = (Math.round(y) * img.width + Math.round(x)) * 4; return [...img.data.slice(i, i + 3)]; };
      const view = gpu.showScene(viewer, `@scene demo { version: 0; background: #102030; sphere #ball; box #cube; }
        sphere { radius: 1; color: #e08040; }
        #ball { translate: -1.5 0 0; }
        #cube { size: 1 2 1; translate: 1.5 0 0; color: #4090e0; }`);
      const img = await viewer.capture();
      const first = { ids: [...view.meshes.keys()], up: viewer.camera.up, ball: pixel(img, screen([-1.5, 0, 0])), cube: pixel(img, screen([1.5, 0, 0])), corner: pixel(img, [1, 1]),
        cubeBounds: view.meshes.get('cube').bounds, hit: (await viewer.pick(...screen([1.5, 0, 0])))?.mesh.name };
      const moved = view.update(`@scene demo { version: 0; background: #102030; sphere #ball; box #cube; }
        sphere { radius: 1; color: #e08040; } #ball { translate: -1.5 0 0; } #cube { size: 1 2 1; translate: 1.5 1 0; color: #4090e0; }`);
      const after = { ok: moved.ok, cubeBounds: view.meshes.get('cube').bounds };
      const bad = view.update('@scene demo { version: 0; box #cube; } #cube { size: -1 2 1; }');
      const kept = [...view.meshes.keys()];
      // Source 1: rotation, cylinder, capsule, rounded box, torus.
      view.update(`@scene parts { version: 1; box #block; cylinder #can; capsule #pill; rounded-box #soft; torus #ring; }
        #block { size: 2 1 1; rotate-z: 90deg; translate: -3 0 0; }
        #can { radius: .5; height: 2; translate: 0 0 0; }
        #pill { start: 0 -1 0; end: 0 1 0; radius: .4; rotate-z: -90deg; translate: 3 0 0; }
        #soft { size: 1 1 1; radius: .2; translate: 0 2.5 0; }
        #ring { major-radius: 1; minor-radius: .25; translate: 0 -2.5 0; color: #7cd8ca; }`);
      const parts = Object.fromEntries([...view.meshes].map(([id, m]) => [id, m.bounds]));
      viewer.fit();
      const img2 = await viewer.capture();
      const ring = pixel(img2, screen([1, -2.5, 0]));
      view.dispose();
      const disposed = viewer.meshList.length;
      // Authored materials on the viewer: a uniform mix, and a ramp along the geometry's u.
      viewer.setBackground('#000000');
      const quad = { positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], uvs: [0, 0, 1, 0, 1, 1, 0, 1], indices: [0, 1, 2, 0, 2, 3] };
      const paint = gpu.materialShader('@shader #paint { @uniform amount:float(0,1,.25); @fragment { color:mix(#ff0000,#0000ff,amount); } }', { amount: 0 });
      const ramp = gpu.materialShader('@shader #ramp { @fragment { color:mix(#000000,#ffffff,surface_u01); } }');
      const badMaterial = gpu.materialShader('@shader #bad { @fragment { color: nope; } }');
      viewer.add(quad, { material: { unlit: true, color: '#ffffff', doubleSided: true, shader: paint.shader }, transform: gpu.translation([-1.2, 0, 0]) });
      viewer.add(quad, { material: { unlit: true, color: '#ffffff', doubleSided: true, shader: ramp.shader }, transform: gpu.translation([1.2, 0, 0]) });
      Object.assign(viewer.camera, { position: [0, 0, 8], target: [0, 0, 0], up: [0, 1, 0] });
      const img3 = await viewer.capture();
      const materials = { usesUV: [paint.usesUV, ramp.usesUV], bad: badMaterial.ok ? null : badMaterial.diagnostics[0].code, red: pixel(img3, screen([-1.2, 0, 0])), dark: pixel(img3, screen([0.35, 0, 0])), bright: pixel(img3, screen([2.05, 0, 0])) };
      // A scene inside a Z-up world, ten units to the scene unit, on the viewer's own background.
      viewer.clear();
      const zUp = gpu.multiply(gpu.rotation([1, 0, 0], Math.PI / 2), [10, 0, 0, 0, 0, 10, 0, 0, 0, 0, 10, 0, 0, 0, 0, 1]);
      const inner = gpu.showScene(viewer, '@scene s { version: 0; box #tall; } #tall { size: 1 2 1; }', { fit: false, background: false, transform: zUp });
      const tall = inner.meshes.get('tall').bounds;
      const bg = pixel(await viewer.capture(), [1, 1]);
      viewer.dispose();
      return { first, after, bad: { ok: bad.ok, codes: bad.diagnostics?.map(d => d.code) }, kept, parts, ring, disposed, materials, tall, bg };
    });
    t.diagnostic(JSON.stringify(r));
    assert.deepEqual(r.first.ids, ['ball', 'cube']);
    assert.deepEqual(r.first.up, [0, 1, 0]);
    assert.deepEqual(r.first.corner, [0x10, 0x20, 0x30], 'the scene background');
    assert.ok(r.first.ball[0] > r.first.ball[2] + 40, `orange ball ${r.first.ball}`);
    assert.ok(r.first.cube[2] > r.first.cube[0] + 40, `blue cube ${r.first.cube}`);
    const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-5);
    assert.ok(near(r.first.cubeBounds.min, [1, -1, -0.5]) && near(r.first.cubeBounds.max, [2, 1, 0.5]), JSON.stringify(r.first.cubeBounds));
    assert.equal(r.first.hit, 'cube');
    assert.ok(r.after.ok && near(r.after.cubeBounds.min, [1, 0, -0.5]), 'the update moved the cube');
    assert.equal(r.bad.ok, false); assert.ok(r.bad.codes.length > 0);
    assert.deepEqual(r.kept, ['ball', 'cube'], 'a refused source keeps the scene');
    // Rotated 90° about Z, the 2 × 1 block stands 1 × 2; the capsule from y −1..1 turned −90° about Z lies along x.
    assert.ok(near(r.parts.block.min, [-3.5, -1, -0.5]) && near(r.parts.block.max, [-2.5, 1, 0.5]), JSON.stringify(r.parts.block));
    assert.ok(Math.abs(r.parts.pill.max[0] - 4.4) < 1e-3 && Math.abs(r.parts.pill.min[0] - 1.6) < 1e-3 && Math.abs(r.parts.pill.max[1] - 0.4) < 1e-3, JSON.stringify(r.parts.pill));
    assert.ok(Math.abs(r.parts.ring.max[0] - 1.25) < 1e-3 && Math.abs(r.parts.ring.max[1] + 2.25) < 1e-3, JSON.stringify(r.parts.ring));
    assert.ok(Math.abs(r.parts.can.max[1] - 1) < 1e-6 && Math.abs(r.parts.can.max[0] - 0.5) < 1e-3);
    assert.ok(r.ring[1] > r.ring[0] + 30, `teal ring ${r.ring}`);
    assert.equal(r.disposed, 0);
    assert.deepEqual(r.materials.usesUV, [false, true]); assert.equal(r.materials.bad, 'TYPE');
    assert.deepEqual(r.materials.red, [255, 0, 0], 'the uniform material at amount 0');
    assert.ok(r.materials.dark[0] < 80 && r.materials.bright[0] > 200, `the ramp along u: ${r.materials.dark} → ${r.materials.bright}`);
    // The 2-unit Y height of the box stands along Z, ten times larger; the scene's background stays out.
    assert.ok(Math.abs(r.tall.max[2] - 10) < 1e-6 && Math.abs(r.tall.min[2] + 10) < 1e-6 && Math.abs(r.tall.max[0] - 5) < 1e-6, JSON.stringify(r.tall));
    assert.deepEqual(r.bg, [0, 0, 0]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise(res => server.close(res)); }
});
