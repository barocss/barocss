// The viewer in a real browser's WebGPU: lit, unlit, line and transparent meshes in one frame; picking;
// orbit and wheel zoom from real pointer events; resize; orthographic view; device-loss recovery; a
// scene of thousands of meshes with frustum culling; disposal.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --test tests/viewer-browser.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/viewer');
const page = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}canvas{display:block;width:320px;height:240px}</style><canvas id="c"></canvas>`;

async function serve() {
  // Exact routes: the viewer's built modules and one page.
  const files = new Map((await readdir(dist)).filter(f => f.endsWith('.js')).map(f => [`/viewer/${f}`, path.join(dist, f)]));
  const server = createServer(async (req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
    const file = files.get(req.url ?? '');
    if (!file) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

test('viewer renders, picks, orbits, resizes and recovers in WebGPU', { timeout: 180000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR are required'); return; }
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: (process.env.VIEWER_ADAPTER === 'swiftshader' ? ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'] : ['--enable-unsafe-webgpu']) });
  const errors = [];
  try {
    const p = await browser.newPage({ viewport: { width: 800, height: 600 } });
    p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(server.url + '/');
    const adapter = await p.evaluate(async () => { const a = await navigator.gpu?.requestAdapter(); return a ? `${a.info?.vendor} ${a.info?.architecture}` : null; });
    if (!adapter) { t.skip('no WebGPU adapter'); return; }
    t.diagnostic(`adapter: ${adapter}`);

    const first = await p.evaluate(async () => {
      const api = await import('/viewer/index.js');
      const box = (sx, sy, sz) => {
        // 24 vertices: flat normals per side.
        const P = [], N = [], I = [];
        const sides = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];
        for (const [axis, s] of sides) {
          const u = (axis + 1) % 3, v = (axis + 2) % 3, base = P.length / 3, h = [sx / 2, sy / 2, sz / 2];
          for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            const q = [0, 0, 0]; q[axis] = s * h[axis]; q[u] = a * h[u]; q[v] = b * h[v] * s;
            P.push(...q); const n = [0, 0, 0]; n[axis] = s; N.push(...n);
          }
          I.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
        return { positions: P, normals: N, indices: I };
      };
      const canvas = document.getElementById('c');
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#202020', camera: { position: [6, -9, 6], target: [0, 0, 0], up: [0, 0, 1] } });
      const red = viewer.add({ ...box(2, 2, 2), faces: Array.from({ length: 12 }, (_, i) => 10 + Math.floor(i / 2)) }, { name: 'red', material: { color: '#d03020', roughness: 0.5 } });
      const blue = viewer.add(box(1.5, 1.5, 1.5), { name: 'blue', material: { color: '#0000ff', unlit: true }, transform: api.translation([3.5, 0, 0]) });
      const glass = viewer.add({ positions: [-3, -1, -1, -1.5, -1, -1, -1.5, -1, 1, -3, -1, 1], indices: [0, 1, 2, 0, 2, 3] }, { name: 'glass', material: { color: '#00ff00', opacity: 0.5, unlit: true, doubleSided: true } });
      const edges = viewer.add({ positions: [-1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1], indices: [0, 1, 1, 2, 2, 3, 3, 0], topology: 'lines', edges: [100, 101, 102, 103] }, { name: 'edges', material: { color: '#ffffff', unlit: true } });
      viewer.fit();
      await viewer.frame();
      window.t = { api, viewer, red, blue, glass, edges, box };
      // Where a world point lands on the canvas (CSS pixels).
      window.screen = p => { const m = viewer.camera.viewProjection(viewer.aspect), q = [0, 1, 3].map(k => m[k] * p[0] + m[4 + k] * p[1] + m[8 + k] * p[2] + m[12 + k]); return [(q[0] / q[2] * 0.5 + 0.5) * canvas.clientWidth, (0.5 - q[1] / q[2] * 0.5) * canvas.clientHeight]; };
      window.bright = (img, [x, y]) => { let best = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = ((Math.round(y) + dy) * img.width + Math.round(x) + dx) * 4; best = Math.max(best, Math.min(img.data[i], img.data[i + 1], img.data[i + 2])); } return best; };
      window.pixel = (img, [x, y]) => { const i = (Math.round(y) * img.width + Math.round(x)) * 4; return [...img.data.slice(i, i + 4)]; };
      const img = await viewer.capture();
      window.shot = img;
      return {
        size: [img.width, img.height], stats: { ...viewer.stats },
        corner: pixel(img, [2, 2]), blue: pixel(img, screen([3.5, -0.75, 0])), redTop: pixel(img, screen([0, 0, 1])), redFront: pixel(img, screen([0.3, -1, 0])),
        glass: pixel(img, screen([-2.25, -1, 0])), edge: bright(img, screen([0, -1, 1])),
      };
    });
    t.diagnostic(JSON.stringify(first));
    if (process.env.VIEWER_SHOTS) await p.locator('canvas').screenshot({ path: path.join(process.env.VIEWER_SHOTS, 'viewer-first.png') });
    assert.deepEqual(first.size, [320, 240]);
    assert.equal(first.stats.drawCalls, 4);
    // Background and unlit colours come back exactly (sRGB view in and out).
    assert.deepEqual(first.corner, [32, 32, 32, 255]);
    assert.ok(first.blue[2] >= 250 && first.blue[0] <= 3 && first.blue[1] <= 3, `unlit blue ${first.blue}`);
    // Lit red: red dominant, top and front shaded differently.
    for (const c of [first.redTop, first.redFront]) assert.ok(c[0] > c[1] + 40 && c[0] > c[2] + 40, `lit red ${c}`);
    assert.ok(Math.abs(first.redTop[0] - first.redFront[0]) > 8, 'faces facing different ways are shaded differently');
    // Half-transparent green over the dark background.
    assert.ok(first.glass[1] > 120 && first.glass[1] < 230 && first.glass[0] < 60, `glass ${first.glass}`);
    // The top edge line drawn over the red box.
    assert.ok(first.edge > 200, `edge ${first.edge}`);

    const picks = await p.evaluate(async () => {
      const { viewer } = window.t;
      const top = await viewer.pick(...screen([0.2, 0.3, 1]));
      const side = await viewer.pick(...screen([3.5, -0.75, 0.2]));
      const empty = await viewer.pick(2, 2);
      // The nearest edge segment within a few pixels: its id and the point on it.
      const [ex, ey] = screen([0.3, -1, 1]);
      const line = viewer.pickLine(ex + 2, ey + 3, 6), none = viewer.pickLine(ex + 30, ey + 30, 6);
      // Several at once queue on one read buffer.
      const many = await Promise.all([0, 1, 2, 3].map(() => viewer.pick(...screen([0, 0, 1]))));
      return { top: top && { name: top.mesh.name, point: top.point, tri: top.triangle, face: top.face }, side: side?.mesh.name, empty, line: line && { name: line.mesh.name, edge: line.edge, point: line.point, distance: line.distance }, none, many: many.map(h => h?.mesh.name) };
    });
    t.diagnostic(JSON.stringify(picks));
    assert.equal(picks.top.name, 'red');
    assert.ok(Math.abs(picks.top.point[2] - 1) < 0.02 && Math.abs(picks.top.point[0] - 0.2) < 0.05, `point ${picks.top.point}`);
    assert.ok(picks.top.tri === 8 || picks.top.tri === 9, `triangle ${picks.top.tri} on the top side`);
    assert.equal(picks.top.face, 14, 'the face id of the top side');

    // A face recoloured through its vertex colours; an outline around the visible part of a mesh.
    const marked = await p.evaluate(async () => {
      const { viewer, red, blue } = window.t;
      // A wide edge line.
      window.t.edges.material = { lineWidth: 5 };
      // Vertex colours multiply the material colour: a white material shows them as they are.
      const colors = Array.from({ length: 24 }, (_, v) => v >= 16 && v < 20 ? [1, 0.85, 0] : [0.82, 0.19, 0.13]).flat();
      red.material = { color: '#ffffff' };
      red.geometry.setColors(colors);
      red.outline = '#00e0ff';
      await viewer.frame();
      const img = await viewer.capture();
      // Walk right from the front of the red box to its silhouette (background lies between it and blue).
      const [cx, cy] = screen([0, -1, 0]).map(Math.round), reddish = c => c[0] > 100 && c[0] > c[1] + 40;
      let x = cx; while (x < img.width - 1 && reddish(pixel(img, [x + 1, cy]))) x++;
      const out = pixel(img, [x + 2, cy]), far = pixel(img, [x + 9, cy]);
      // Under the blue box (in front of nothing) no outline; blue keeps its colour.
      const blueMid = pixel(img, screen([3.5, -0.75, 0]));
      window.marked = img;
      red.geometry.setColors(null); red.outline = null; red.material = { color: '#d03020' };
      // Two pixels beside the front top edge: inside the 5 px line.
      const [lx, ly] = screen([-0.5, -1, 1]), wide = bright(img, [lx, ly + 2]);
      window.t.edges.material = { lineWidth: 1 };
      return { top: pixel(img, screen([0, 0, 1])), out, far, blueMid, wide };
    });
    t.diagnostic(JSON.stringify(marked));
    if (process.env.VIEWER_SHOTS) {
      // The marked frame, as a PNG made in the page.
      const png = await p.evaluate(() => { const c = document.createElement('canvas'), img = window.marked; c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0); return c.toDataURL('image/png'); });
      (await import('node:fs')).writeFileSync(path.join(process.env.VIEWER_SHOTS, 'viewer-marked.png'), Buffer.from(png.split(',')[1], 'base64'));
    }
    assert.ok(marked.top[0] > 200 && marked.top[1] > 150 && marked.top[2] < 60, `yellow top ${marked.top}`);
    assert.ok(marked.out[2] > 120 && marked.out[1] > 100 && marked.out[0] < 80, `outline just outside ${marked.out}`);
    assert.deepEqual(marked.far, [32, 32, 32, 255], 'background beyond the outline');
    assert.deepEqual(marked.blueMid.slice(0, 3), [0, 0, 255]);
    assert.ok(marked.wide > 200, `wide line ${marked.wide}`);
    assert.equal(picks.side, 'blue');
    assert.equal(picks.empty, null);
    assert.equal(picks.line.name, 'edges'); assert.equal(picks.line.edge, 100);
    assert.ok(Math.abs(picks.line.point[0] - 0.3) < 0.15 && Math.abs(picks.line.point[1] + 1) < 1e-9 && Math.abs(picks.line.point[2] - 1) < 1e-9 && picks.line.distance <= 6, JSON.stringify(picks.line));
    assert.equal(picks.none, null);
    assert.deepEqual(picks.many, ['red', 'red', 'red', 'red']);

    // Orbit with a real drag, zoom with the wheel.
    const before = await p.evaluate(() => ({ pos: window.t.viewer.camera.position, d: window.t.viewer.camera.distance }));
    const box = await p.locator('canvas').boundingBox();
    await p.mouse.move(box.x + 160, box.y + 120); await p.mouse.down(); await p.mouse.move(box.x + 220, box.y + 140, { steps: 5 }); await p.mouse.up();
    const orbited = await p.evaluate(() => ({ pos: window.t.viewer.camera.position, d: window.t.viewer.camera.distance }));
    assert.ok(Math.abs(orbited.d - before.d) < 1e-6 * before.d && Math.hypot(...orbited.pos.map((x, i) => x - before.pos[i])) > 0.5, JSON.stringify({ before, orbited }));
    const anchor = await p.evaluate(async () => { const h = await window.t.viewer.pick(...screen([0, 0, 1])); return { at: screen([0, 0, 1]), point: h.point }; });
    await p.mouse.move(box.x + anchor.at[0], box.y + anchor.at[1]); await p.mouse.wheel(0, -200);
    await p.waitForFunction(d => window.t.viewer.camera.distance < d * 0.9, orbited.d);
    const zoomed = await p.evaluate(a => ({ d: window.t.viewer.camera.distance, at: screen(a) }), anchor.point);
    assert.ok(Math.hypot(zoomed.at[0] - anchor.at[0], zoomed.at[1] - anchor.at[1]) < 1.5, `the point under the cursor stays put: ${JSON.stringify([anchor.at, zoomed.at])}`);

    // Resize follows the CSS size; orthographic renders the same scene.
    const resized = await p.evaluate(async () => {
      const { viewer } = window.t;
      viewer.canvas.style.width = '400px'; viewer.canvas.style.height = '300px';
      await new Promise(r => setTimeout(r, 100)); await viewer.frame();
      viewer.camera.projection = 'orthographic'; viewer.fit();
      const img = await viewer.capture(), red = pixel(img, screen([0, 0, 1]).map(v => v * 1));
      const hit = await viewer.pick(...screen([0, 0, 1]));
      viewer.camera.projection = 'perspective';
      return { size: [viewer.canvas.width, viewer.canvas.height], red, hit: hit?.mesh.name };
    });
    assert.deepEqual(resized.size, [400, 300]);
    assert.ok(resized.red[0] > resized.red[1] + 40, `ortho red ${resized.red}`);
    assert.equal(resized.hit, 'red');

    // Device loss: the viewer replaces the device and re-uploads the scene.
    const lost = await p.evaluate(async () => {
      const { viewer } = window.t;
      let recovered = false; viewer.onRecover = () => { recovered = true; };
      viewer.loseDeviceForTesting();
      for (let i = 0; i < 100 && !recovered; i++) await new Promise(r => setTimeout(r, 50));
      await viewer.frame();
      viewer.fit();
      const img = await viewer.capture();
      return { recovered, losses: viewer.stats.deviceLosses, red: pixel(img, screen([0, 0, 1])), hit: (await viewer.pick(...screen([0, 0, 1])))?.mesh.name };
    });
    assert.ok(lost.recovered && lost.losses === 1, JSON.stringify(lost));
    assert.ok(lost.red[0] > lost.red[1] + 40, `red after recovery ${lost.red}`);
    assert.equal(lost.hit, 'red');

    // Many meshes sharing one geometry: one frame, culled when out of view.
    const many = await p.evaluate(async () => {
      const { viewer, api, box } = window.t;
      viewer.clear();
      const g = viewer.createGeometry(box(0.8, 0.8, 0.8));
      for (let i = 0; i < 4000; i++) viewer.add(g, { material: { color: [((i * 37) % 255) / 255, 0.5, 0.6] }, transform: api.translation([(i % 64) - 32, Math.floor(i / 64) - 32, 0]) });
      viewer.camera.position = [0, -80, 60]; viewer.camera.target = [0, 0, 0]; viewer.fit();
      await viewer.frame();
      const t0 = performance.now();
      for (let i = 0; i < 10; i++) { viewer.camera.position = [Math.sin(i / 3) * 80, -80, 60]; await viewer.frame(); }
      const ms = (performance.now() - t0) / 10, all = { ...viewer.stats };
      viewer.camera.position = [0, -2, 1.5]; viewer.camera.target = [0, 0, 0];
      await viewer.frame();
      return { ms, all, close: { ...viewer.stats } };
    });
    t.diagnostic(`4000 meshes: ${many.ms.toFixed(1)} ms/frame, cpu ${many.all.cpuMs.toFixed(1)} ms, close-up draws ${many.close.drawCalls}, culled ${many.close.culled}`);
    assert.equal(many.all.drawCalls, 4000);
    assert.ok(many.close.culled > 3000 && many.close.drawCalls + many.close.culled === 4000);
    // (A software rasteriser draws thousands of meshes slowly; the bound is for a hardware adapter.)
    if (!/swiftshader/.test(adapter)) assert.ok(many.ms < 200, `${many.ms} ms per frame`);

    // A shadow on the ground from a light that casts one; none when the box casts none or the ground receives none.
    const shadow = await p.evaluate(async () => {
      const { viewer, box } = window.t;
      viewer.clear();
      viewer.lights = [{ kind: 'directional', direction: [0.3, -0.8, -1], intensity: 1.5, castShadow: true }];
      const ground = viewer.add({ positions: [-20, -20, -1, 20, -20, -1, 20, 20, -1, -20, 20, -1], indices: [0, 1, 2, 0, 2, 3] }, { material: { color: '#c0c0c0' } });
      const cube = viewer.add(box(2, 2, 2), { material: { color: '#4060d0' } });
      viewer.camera.position = [6, -9, 6]; viewer.camera.target = [0, 0, 0]; viewer.camera.projection = 'perspective';
      viewer.fit({ min: [-3, -4, -1], max: [3, 2, 1] });
      const sample = async () => { const img = await viewer.capture(); return { inside: pixel(img, screen([0.5, -1.8, -1])), outside: pixel(img, screen([0.5, -3.5, -1])) }; };
      const on = await sample();
      cube.castShadow = false; viewer.requestRender();
      const noCaster = await sample();
      cube.castShadow = true; ground.receiveShadow = false;
      const noReceiver = await sample();
      ground.receiveShadow = true;
      // Ambient occlusion darkens the ground where it meets the cube, not the open ground; a gradient behind.
      // (A light that leaves the ground below white, so darkening shows.)
      viewer.lights = [{ kind: 'directional', direction: [0.3, -0.8, -1], intensity: 0.7 }];
      const foot = screen([0.2, -1.08, -1]), open = screen([-3, 1.5, -1]);
      const plain = await viewer.capture();
      viewer.environment = { ambientOcclusion: { radius: 0.6, strength: 1 } };
      viewer.setBackground({ top: '#102040', bottom: '#405060' });
      const ao = await viewer.capture();
      const occluded = { foot: [pixel(plain, foot), pixel(ao, foot)], open: [pixel(plain, open), pixel(ao, open)], top: pixel(ao, [2, 1]), bottom: pixel(ao, [2, ao.height - 1]) };
      viewer.lights = [{ kind: 'directional', direction: [0.3, -0.8, -1], intensity: 1.5, castShadow: true }];
      window.shadowShot = ao;
      return { on, noCaster, noReceiver, occluded };
    });
    t.diagnostic(`shadow ${JSON.stringify(shadow)}`);
    if (process.env.VIEWER_SHOTS) {
      const png = await p.evaluate(() => { const c = document.createElement('canvas'), img = window.shadowShot; c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0); return c.toDataURL('image/png'); });
      (await import('node:fs')).writeFileSync(path.join(process.env.VIEWER_SHOTS, 'viewer-shadow.png'), Buffer.from(png.split(',')[1], 'base64'));
    }
    assert.ok(shadow.on.inside[0] < shadow.on.outside[0] * 0.6, `shadowed ground darker: ${shadow.on.inside} vs ${shadow.on.outside}`);
    const o = shadow.occluded;
    assert.ok(o.foot[1][0] < o.foot[0][0] - 15, `occlusion at the foot: ${o.foot}`);
    assert.ok(Math.abs(o.open[1][0] - o.open[0][0]) <= 3, `no occlusion on open ground: ${o.open}`);
    // (The ground covers the bottom of the view; the top row is the gradient's top colour.)
    assert.ok(Math.abs(o.top[0] - 0x10) <= 2 && Math.abs(o.top[1] - 0x20) <= 2 && Math.abs(o.top[2] - 0x40) <= 2, `gradient top ${o.top}`);
    for (const k of ['noCaster', 'noReceiver']) assert.ok(Math.abs(shadow[k].inside[0] - shadow[k].outside[0]) < 12, `${k}: ${shadow[k].inside} vs ${shadow[k].outside}`);

    // The ground grid: lines on the plane, coloured axes, empty cells show the background, a box hides it.
    const grid = await p.evaluate(async () => {
      const { viewer, box, api } = window.t;
      viewer.clear(); viewer.environment = {}; viewer.setBackground('#202020');
      viewer.grid = { visible: true, cell: 1, opacity: 1, color: '#a0a0a0' };
      viewer.camera.position = [4, -8, 7]; viewer.camera.target = [1, 1, 0];
      const empty = await viewer.capture();
      // (A minor line near the camera, below the scene box: the near plane must not cut the grid.)
      const out = { near: bright(empty, screen([1, -3, 0])), line: bright(empty, screen([2, 0.5, 0])), cell: pixel(empty, screen([2.5, 0.5, 0])), xAxis: pixel(empty, screen([2.5, 0, 0])), yAxis: pixel(empty, screen([0, 2.5, 0])) };
      viewer.add(box(1, 1, 1), { material: { color: '#3050c0', unlit: true }, transform: api.translation([2, 0.5, 0.5]) });
      const covered = await viewer.capture();
      out.hidden = pixel(covered, screen([2, 0.5, 0.02]));
      window.gridShot = covered;
      viewer.grid = { visible: false };
      return out;
    });
    t.diagnostic(`grid ${JSON.stringify(grid)}`);
    if (process.env.VIEWER_SHOTS) {
      const png = await p.evaluate(() => { const c = document.createElement('canvas'), img = window.gridShot; c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0); return c.toDataURL('image/png'); });
      (await import('node:fs')).writeFileSync(path.join(process.env.VIEWER_SHOTS, 'viewer-grid.png'), Buffer.from(png.split(',')[1], 'base64'));
    }
    assert.ok(grid.line > 70, `grid line ${grid.line}`);
    assert.ok(grid.near > 60, `the grid reaches the bottom of the view: ${grid.near}`);
    assert.deepEqual(grid.cell, [32, 32, 32, 255], 'inside a cell: the background');
    assert.ok(grid.xAxis[0] > grid.xAxis[1] + 40, `x axis red ${grid.xAxis}`);
    assert.ok(grid.yAxis[1] > grid.yAxis[0] + 30, `y axis green ${grid.yAxis}`);
    assert.deepEqual(grid.hidden.slice(0, 3), [0x30, 0x50, 0xc0], 'the box hides the grid');

    const disposed = await p.evaluate(() => {
      const { viewer } = window.t;
      viewer.dispose(); viewer.dispose();
      try { viewer.add(window.t.box(1, 1, 1)); return 'added'; } catch (e) { return e.code; }
    });
    assert.equal(disposed, 'disposed');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
