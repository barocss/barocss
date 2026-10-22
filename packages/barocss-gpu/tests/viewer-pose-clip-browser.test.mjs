// The viewer in a real browser's WebGPU, G1: meshes moved by their transform alone, frame after frame — nothing made
// or uploaded but their object blocks, and the GPU pick, the CPU ray, the line pick and the selection outline where the
// mesh now is.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --test tests/viewer-pose-clip-browser.test.mjs
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
  const files = new Map((await readdir(dist)).filter(f => f.endsWith('.js')).map(f => [`/viewer/${f}`, path.join(dist, f)]));
  const server = createServer(async (req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
    const file = files.get(req.url ?? '');
    if (!file) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(file));
  });
  await new Promise(r => server.listen(Number(process.env.GPU_TEST_PORT ?? 0), '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

/** A browser page with the viewer's helpers: a box, where a world point lands, a pixel of a capture. */
async function open(t) {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR are required'); return null; }
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
  const errors = [], p = await browser.newPage({ viewport: { width: 800, height: 600 } });
  p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(server.url + '/');
  const adapter = await p.evaluate(async () => { const a = await navigator.gpu?.requestAdapter(); return a ? `${a.info?.vendor} ${a.info?.architecture}` : null; });
  if (!adapter) { await browser.close(); await server.close(); t.skip('no WebGPU adapter'); return null; }
  await p.evaluate(async () => {
    // (Buffers made, counted from here.)
    window.made = 0; const make = GPUDevice.prototype.createBuffer; GPUDevice.prototype.createBuffer = function (d) { window.made++; return make.call(this, d); };
    window.api = await import('/viewer/index.js');
    window.box = (sx, sy, sz) => {
      const P = [], N = [], I = [], E = [];
      for (const [axis, s] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
        const u = (axis + 1) % 3, v = (axis + 2) % 3, base = P.length / 3, h = [sx / 2, sy / 2, sz / 2];
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = [0, 0, 0]; q[axis] = s * h[axis]; q[u] = a * h[u]; q[v] = b * h[v] * s; P.push(...q); const n = [0, 0, 0]; n[axis] = s; N.push(...n); }
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
        for (let k = 0; k < 4; k++) E.push(...P.slice(3 * (base + k), 3 * (base + k) + 3), ...P.slice(3 * (base + (k + 1) % 4), 3 * (base + (k + 1) % 4) + 3));
      }
      return { surface: { positions: P, normals: N, indices: I, faces: Array.from({ length: 12 }, (_, i) => Math.floor(i / 2)) }, edges: { positions: E, topology: 'lines', edges: Array.from({ length: 24 }, (_, i) => i) } };
    };
    window.screen = (viewer, p) => { const m = viewer.camera.viewProjection(viewer.aspect), c = viewer.canvas, q = [0, 1, 3].map(k => m[k] * p[0] + m[4 + k] * p[1] + m[8 + k] * p[2] + m[12 + k]); return [(q[0] / q[2] * 0.5 + 0.5) * c.clientWidth, (0.5 - q[1] / q[2] * 0.5) * c.clientHeight]; };
    window.tp = (M, p) => [0, 1, 2].map(r => M[r] * p[0] + M[4 + r] * p[1] + M[8 + r] * p[2] + M[12 + r]);
    window.pixel = (img, [x, y]) => { const i = (Math.round(y) * img.width + Math.round(x)) * 4; return [...img.data.slice(i, i + 4)]; };
  });
  return { p, errors, adapter, close: async () => { await browser.close(); await server.close(); } };
}

test('G1 a mesh moved by its transform, 30 times: nothing made, and pick, ray, line pick and outline where it now is', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    t.diagnostic(`adapter: ${s.adapter}`);
    const r = await s.p.evaluate(async () => {
      const { api, box, screen, pixel, tp } = window, canvas = document.getElementById('c');
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#202020', camera: { position: [0, -12, 9], target: [0, 0, 0], up: [0, 0, 1] } });
      const b = box(2, 2, 2), surface = viewer.add(b.surface, { name: 'link', material: { color: '#d03020' } }), edges = viewer.add(b.edges, { name: 'link edges', material: { color: '#ffffff', unlit: true } });
      surface.outline = '#00e0ff';
      viewer.camera.fit({ min: [-5, -5, -2], max: [5, 5, 2] }, viewer.aspect);
      // (The first capture and pick make their read buffers.)
      await viewer.frame(); await viewer.capture(); await viewer.pick(1, 1);
      const made = window.made, out = [];
      let captures = 0;
      for (let k = 0; k < 30; k++) {
        // A link swinging about z through the origin at radius 3, turned with it.
        const a = (k / 30) * 2 * Math.PI, M = api.multiply(api.translation([3 * Math.cos(a), 3 * Math.sin(a), 0]), api.rotation([0, 0, 1], a)), inv = api.invert(M);
        surface.transform = M; edges.transform = M;
        await viewer.frame();
        if (k % 6) continue;
        const top = tp(M, [0.3, 0.2, 1]), [x, y] = screen(viewer, top);
        const ray = viewer.raycast(x, y), gpu = await viewer.pick(x, y);
        // Near the top side's front edge: the segment found lies on the moved box's edges (two of its own coordinates ±1).
        const [ex, ey] = screen(viewer, tp(M, [0.1, -1, 1])), line = viewer.pickLine(ex + 2, ey + 1, 6), local = line && tp(inv, line.point);
        // The outline: the pixels it changes, around the moved box on screen.
        const lit = await viewer.capture(); surface.outline = null; const plain = await viewer.capture(); surface.outline = '#00e0ff'; captures += 2;
        let n = 0, sx = 0, sy = 0, cyan = 0;
        for (let i = 0; i < lit.data.length; i += 4) {
          if (Math.abs(lit.data[i] - plain.data[i]) + Math.abs(lit.data[i + 1] - plain.data[i + 1]) + Math.abs(lit.data[i + 2] - plain.data[i + 2]) < 60) continue;
          n++; sx += (i / 4) % lit.width; sy += Math.floor(i / 4 / lit.width);
          if (lit.data[i + 2] > 150 && lit.data[i + 1] > 150 && lit.data[i] < 90) cyan++;
        }
        const [cx, cy] = screen(viewer, tp(M, [0, 0, 0]));
        out.push({ k, ray: ray && { name: ray.mesh.name, face: ray.face, d: Math.hypot(...ray.point.map((v, i) => v - top[i])) }, gpu: gpu && { name: gpu.mesh.name, d: Math.hypot(...gpu.point.map((v, i) => v - top[i])) },
          line: line && { name: line.mesh.name, onEdge: local.filter(v => Math.abs(Math.abs(v) - 1) < 1e-3).length, inside: local.every(v => Math.abs(v) <= 1 + 1e-3) },
          outline: { n, cyan, off: n ? Math.hypot(sx / n - cx, sy / n - cy) : null } });
      }
      viewer.dispose();
      return { out, made: window.made - made - captures };
    });
    t.diagnostic(JSON.stringify(r));
    assert.equal(r.made, 0, 'no buffer made while the mesh moves');
    for (const o of r.out) {
      assert.equal(o.ray?.name, 'link', JSON.stringify(o)); assert.equal(o.ray.face, 4, 'the top side'); assert.ok(o.ray.d < 1e-4, JSON.stringify(o));
      assert.equal(o.gpu?.name, 'link', JSON.stringify(o)); assert.ok(o.gpu.d < 0.1, JSON.stringify(o));
      assert.equal(o.line?.name, 'link edges', JSON.stringify(o)); assert.ok(o.line.onEdge >= 2 && o.line.inside, JSON.stringify(o));
      // (A ring a couple of pixels wide round a box some 50 px across, centred on it.)
      assert.ok(o.outline.cyan > 100 && o.outline.off < 12, `the outline round the moved box ${JSON.stringify(o)}`);
    }
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G2: the clip plane. Shapes cut across y = 0 (kept y ≥ 0), seen along +y from the cut-away side in an orthographic view
// (a world unit is canvas height / (2 × half height) pixels): each cap's pixels against the section's closed form — the
// same polygon clipMesh triangulates — within one pixel along its outline; a hole in a cap left open; a turned copy's cap
// turned with it; a mesh without a cap hollow, one the plane does not clip whole. Then the picks through the removed half
// (the CPU ray and the GPU pick on the cap, the line pick on the kept edges only), the outline round a cut mesh, a
// perspective view, and the eye on the kept side (no cap).
test('G2 the clip plane: caps of a box, a cylinder, a holed tube and a turned copy at their closed-form areas; picks and lines only on the kept side; the outline round the cut', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box, screen, tp } = window, canvas = document.getElementById('c');
      canvas.style.width = '800px'; canvas.style.height = '400px';
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, antialias: false, background: '#000000', camera: { position: [0, -30, 0], target: [0, 0, 0], up: [0, 0, 1], projection: 'orthographic' }, lights: [] });
      // (Unlit bodies in grey, the caps in magenta: a cap's pixels are the magenta ones.)
      const body = { color: '#404040', unlit: true }, CAP = [255, 0, 255];
      /** A closed prism along y (−h…h) of a polygon in (x, z) with holes, outward faces: its sides, and its ends as fans of quads between rings. */
      const quad = (P, I, a, b, c, d, out) => {
        // (Newell's normal: right for a quad with two corners at one point, a triangle.)
        const pts = [a, b, c, d], n = [0, 0, 0];
        for (let i = 0; i < 4; i++) { const p = pts[i], q = pts[(i + 1) % 4]; n[0] += (p[1] - q[1]) * (p[2] + q[2]); n[1] += (p[2] - q[2]) * (p[0] + q[0]); n[2] += (p[0] - q[0]) * (p[1] + q[1]); }
        const q = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] >= 0 ? [a, b, c, d] : [a, d, c, b], base = P.length / 3;
        for (const p of q) P.push(...p);
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      };
      const ring = (r, n, cx, cz) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cz + r * Math.sin(2 * Math.PI * i / n)]);
      /** A tube along y between an outer and an inner ring of the same count (inner null: a solid prism, its ends fans to the centre). */
      const prism = (outer, inner, h) => {
        const P = [], I = [], n = outer.length, cx = outer.reduce((s, p) => s + p[0], 0) / n, cz = outer.reduce((s, p) => s + p[1], 0) / n;
        const at = (p, y) => [p[0], y, p[1]];
        for (let i = 0; i < n; i++) {
          const a = outer[i], b = outer[(i + 1) % n], mid = [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz];
          quad(P, I, at(a, -h), at(b, -h), at(b, h), at(a, h), mid);
          if (inner) { const c = inner[i], d = inner[(i + 1) % n]; quad(P, I, at(c, -h), at(d, -h), at(d, h), at(c, h), [-mid[0], 0, -mid[2]]); }
          for (const [y, sy] of [[-h, -1], [h, 1]]) { const c = inner ? inner[i] : [cx, cz], d = inner ? inner[(i + 1) % n] : [cx, cz]; quad(P, I, at(a, y), at(b, y), at(d, y), at(c, y), [0, sy, 0]); }
        }
        return { positions: P, indices: I };
      };
      const area = poly => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
      const perim = poly => poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);
      const square = (cx, cz, h) => [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]];
      // The shapes, apart along x: a box, a cylinder (64 sides), a square tube with a round hole (32 sides), a turned box, an uncapped box, an unclipped box.
      const disc = ring(1.5, 64, 0, 0), tubeOut = ring(2, 32, 0, 0).map(([x, z]) => [Math.sign(x) * Math.min(Math.abs(x) * 10, 2), Math.sign(z) * Math.min(Math.abs(z) * 10, 2)]), tubeIn = ring(1, 32, 0, 0);
      const shapes = [
        { name: 'box', mesh: box(4, 4, 4).surface, at: -15, poly: square(0, 0, 2), holes: [] },
        { name: 'cylinder', mesh: prism(disc, null, 2), at: -9, poly: disc, holes: [] },
        { name: 'tube', mesh: prism(tubeOut, tubeIn, 2), at: -3, poly: tubeOut, holes: [tubeIn] },
        { name: 'turned', mesh: box(4, 4, 4).surface, at: 3, turn: 0.5, poly: square(0, 0, 2), holes: [] },
        { name: 'uncapped', mesh: box(4, 4, 4).surface, at: 9, cap: false, poly: square(0, 0, 2), holes: [] },
        { name: 'unclipped', mesh: box(4, 4, 4).surface, at: 15, clipped: false, poly: square(0, 0, 2), holes: [] },
      ];
      const meshes = shapes.map(sh => viewer.add(sh.mesh, { name: sh.name, material: body, cap: sh.cap ?? true, clipped: sh.clipped ?? true, transform: api.multiply(api.translation([sh.at, 0, 0]), api.rotation([0, 1, 0], sh.turn ?? 0)) }));
      const edges = viewer.add(box(4, 4, 4).edges, { name: 'box edges', material: { color: '#00ff00', unlit: true }, transform: api.translation([-15, 0, 0]) });
      viewer.camera.fit({ min: [-18, -3, -3], max: [18, 3, 3] }, viewer.aspect);
      viewer.clipPlane = { normal: [0, 1, 0], offset: 0, cap: '#ff00ff' };
      const img = await viewer.capture(), unit = img.height / (2 * viewer.camera.halfHeight);
      const isCap = i => img.data[i] > 200 && img.data[i + 1] < 60 && img.data[i + 2] > 200;
      const count = sh => {
        const [x0] = screen(viewer, [sh.at - 3, 0, 0]), [x1] = screen(viewer, [sh.at + 3, 0, 0]);
        let n = 0;
        for (let y = 0; y < img.height; y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(img.width, Math.ceil(x1)); x++) if (isCap((y * img.width + x) * 4)) n++;
        return n;
      };
      const caps = shapes.map(sh => ({ name: sh.name, pixels: count(sh), want: (area(sh.poly) - sh.holes.reduce((a, h) => a + area(h), 0)) * unit * unit, outline: (perim(sh.poly) + sh.holes.reduce((a, h) => a + perim(h), 0)) * unit }));
      const px = p => { const [x, y] = screen(viewer, p), i = (Math.round(y) * img.width + Math.round(x)) * 4; return [...img.data.slice(i, i + 3)]; };
      const colours = { holeMiddle: px([-3, 0, 0]), unclippedFront: px([15, 0, 0]), uncappedMiddle: px([9, 0, 0]) };
      // Picks through the removed half: the box's middle, the tube's hole, the uncapped box (its far wall from inside).
      const ray = p => { const h = viewer.raycast(...screen(viewer, p)); return h && { name: h.mesh.name, cap: !!h.cap, point: h.point, triangle: h.triangle }; };
      const gpu = async p => { const h = await viewer.pick(...screen(viewer, p)); return h && { name: h.mesh.name, cap: !!h.cap, point: h.point }; };
      const picks = { box: ray([-15, 0, 0.5]), boxGpu: await gpu([-15, 0, 0.5]), hole: ray([-3, 0, 0]), holeGpu: await gpu([-3, 0, 0]), uncapped: ray([9, 0, 0.5]), unclipped: ray([15, 0, 0.5]) };
      // The outline round the cut box (its cap in the mask): pixels it changes, centred on the box.
      meshes[0].outline = '#00e0ff'; const lit = await viewer.capture(); meshes[0].outline = null; const plain = await viewer.capture();
      let on = 0, sx = 0;
      for (let i = 0; i < lit.data.length; i += 4) if (Math.abs(lit.data[i + 2] - plain.data[i + 2]) + Math.abs(lit.data[i + 1] - plain.data[i + 1]) > 60) { on++; sx += (i / 4) % lit.width; }
      const outline = { pixels: on, off: on ? Math.abs(sx / on - screen(viewer, [-15, 0, 0])[0]) : null };
      // Perspective, from the cut-away side: the box's cap at its middle; then from the kept side: no cap anywhere.
      Object.assign(viewer.camera, { projection: 'perspective', position: [-15, -25, 3], target: [-15, 0, 0] });
      // (Seen a little from above: the kept top face is in front of the far bottom's back face, whose ray crossed the plane
      // outside the box — the body there, not the cap.)
      Object.assign(viewer.camera, { projection: 'perspective', position: [-15, -25, 9], target: [-15, 0, 0] });
      const above = await viewer.capture(), [tx, ty] = screen(viewer, [-15, 1.2, 2]), ti = (Math.round(ty) * above.width + Math.round(tx)) * 4;
      const keptTop = [...above.data.slice(ti, ti + 3)];
      Object.assign(viewer.camera, { projection: 'perspective', position: [-15, -25, 3], target: [-15, 0, 0] });
      const persp = await viewer.capture(), [mx, my] = screen(viewer, [-15, 0, 0.5]), pi = (Math.round(my) * persp.width + Math.round(mx)) * 4;
      // The box's top front edge (y −2, cut away) under the pointer: not found with the plane, found without it.
      const [ex, ey] = screen(viewer, [-15.3, -2, 2]), line = viewer.pickLine(ex, ey, 3);
      viewer.clipPlane = null;
      const lineWithout = viewer.pickLine(ex, ey, 3);
      viewer.clipPlane = { normal: [0, 1, 0], offset: 0, cap: '#ff00ff' };
      const perspective = { middle: [...persp.data.slice(pi, pi + 3)], ray: ray([-15, 0, 0.5]), keptTop };
      Object.assign(viewer.camera, { position: [-15, 25, 3], target: [-15, 0, 0] });
      const kept = await viewer.capture();
      let keptCaps = 0; for (let i = 0; i < kept.data.length; i += 4) if (kept.data[i] > 200 && kept.data[i + 1] < 60 && kept.data[i + 2] > 200) keptCaps++;
      const stats = { ...viewer.stats };
      viewer.dispose();
      return { caps, colours, picks, line: line && { name: line.mesh.name, y: line.point[1] }, lineWithout: lineWithout && { name: lineWithout.mesh.name, y: lineWithout.point[1] }, outline, perspective, keptCaps, stats, CAP };
    });
    t.diagnostic(JSON.stringify(r));
    // Each cap within one pixel along its outline (and holes) of the closed form; none for the uncapped and unclipped boxes.
    for (const c of r.caps.slice(0, 4)) assert.ok(Math.abs(c.pixels - c.want) <= c.outline, `${c.name}: ${c.pixels} px against ${c.want.toFixed(0)} ± ${c.outline.toFixed(0)}`);
    assert.equal(r.caps[4].pixels, 0, 'no cap on a mesh without one');
    assert.equal(r.caps[5].pixels, 0, 'no cap on a mesh the plane does not clip');
    assert.deepEqual(r.colours.holeMiddle, [0, 0, 0], 'the hole in the tube\'s cap open to the background');
    assert.deepEqual(r.colours.unclippedFront, [0x40, 0x40, 0x40], 'the unclipped box whole');
    assert.deepEqual(r.colours.uncappedMiddle, [0, 0, 0], 'the uncapped box cut open, seen through: its walls single-sided');
    // Picks: the cap (on the plane), the hole empty, the far wall of the uncapped box from inside, the unclipped box's front.
    assert.ok(r.picks.box?.name === 'box' && r.picks.box.cap && r.picks.box.triangle === null && Math.abs(r.picks.box.point[1]) < 1e-6, JSON.stringify(r.picks.box));
    assert.ok(r.picks.boxGpu?.name === 'box' && r.picks.boxGpu.cap && Math.abs(r.picks.boxGpu.point[1]) < 0.05, JSON.stringify(r.picks.boxGpu));
    assert.equal(r.picks.hole, null); assert.equal(r.picks.holeGpu, null);
    assert.equal(r.picks.uncapped, null, 'nor picked through: the ray as the draw');
    assert.ok(r.picks.unclipped?.name === 'unclipped' && Math.abs(r.picks.unclipped.point[1] + 2) < 1e-6, JSON.stringify(r.picks.unclipped));
    assert.ok(!r.line || r.line.y >= 0, `nothing on the cut-away side: ${JSON.stringify(r.line)}`);
    assert.ok(r.lineWithout?.name === 'box edges' && Math.abs(r.lineWithout.y + 2) < 1e-6, `without the plane the front edge: ${JSON.stringify(r.lineWithout)}`);
    assert.ok(r.outline.pixels > 100 && r.outline.off < 6, `the outline round the cut box ${JSON.stringify(r.outline)}`);
    assert.deepEqual(r.perspective.middle, r.CAP, 'the cap in perspective');
    assert.deepEqual(r.perspective.keptTop, [0x40, 0x40, 0x40], 'a kept face in front of the cut: the body, not the cap');
    assert.ok(r.perspective.ray?.cap && Math.abs(r.perspective.ray.point[1]) < 1e-6, JSON.stringify(r.perspective.ray));
    assert.equal(r.keptCaps, 0, 'no cap seen from the kept side');
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G19: several clip planes, the kept region their intersection. A box section wholly inside a larger solid (each ray enters
// the region through one plane and leaves it through another inside the solid — no surface between: G2's back-face cap
// drew nothing there), seen obliquely in an orthographic view: the caps cover the kept cube's silhouette, whose area is
// a²(|vx| + |vy| + |vz|); two planes on a box (a quarter kept), seen along one plane's normal: the cap at its closed form;
// GPU picks and CPU rays the same mesh and cap over random pixels of both and of a cylinder under three oblique planes;
// a line pick finds nothing cut away.
test('G19 several clip planes: a box section inside a solid capped on the kept cube\'s faces; two planes at the closed form; GPU picks equal to CPU rays', { timeout: 180000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box, screen } = window, canvas = document.getElementById('c');
      canvas.style.width = '800px'; canvas.style.height = '400px';
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, antialias: false, background: '#000000', camera: { position: [0, -30, 0], target: [0, 0, 0], up: [0, 0, 1], projection: 'orthographic' }, lights: [] });
      const body = { color: '#404040', unlit: true }, isCap = (d, i) => d[i] > 200 && d[i + 1] < 60 && d[i + 2] > 200;
      const capPixels = img => { let n = 0; for (let i = 0; i < img.data.length; i += 4) if (isCap(img.data, i)) n++; return n; };
      // A. A 10 × 10 × 10 solid, a box section of side 3 in it (six planes).
      const big = viewer.add(box(10, 10, 10).surface, { name: 'big', material: body, cap: true });
      const edges = viewer.add(box(10, 10, 10).edges, { name: 'big edges', material: { color: '#00ff00', unlit: true } });
      const h = 1.5, boxPlanes = [0, 1, 2].flatMap(k => [1, -1].map(sg => { const n = [0, 0, 0]; n[k] = sg; return { normal: n, offset: -h, cap: '#ff00ff' }; }));
      const v = [0.62, -0.55, 0.56], l = Math.hypot(...v), vn = v.map(x => x / l);
      Object.assign(viewer.camera, { projection: 'orthographic', position: vn.map(x => x * 40), target: [0, 0, 0], up: [0, 0, 1] });
      viewer.camera.fit({ min: [-3, -3, -3], max: [3, 3, 3] }, viewer.aspect);
      viewer.clipPlanes = boxPlanes;
      const imgA = await viewer.capture(), unit = imgA.height / (2 * viewer.camera.halfHeight);
      const cube = { pixels: capPixels(imgA), want: 9 * (Math.abs(vn[0]) + Math.abs(vn[1]) + Math.abs(vn[2])) * unit * unit, outline: 6 * 3 * unit };
      // (Its line pick: the solid's edges all cut away — none found anywhere along its front edge.)
      const [ex, ey] = screen(viewer, [5, -5, 0]), linePick = viewer.pickLine(ex, ey, 4);
      // Picks over the section.
      const picks = [];
      let seed = 5; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      // (Pointers over the screen box of what is kept, so most land on it.)
      const compare = async (n, scene, lo, hi) => {
        const q = [0, 1, 2, 3, 4, 5, 6, 7].map(i => screen(viewer, [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]]));
        const x0 = Math.min(...q.map(p => p[0])), x1 = Math.max(...q.map(p => p[0])), y0 = Math.min(...q.map(p => p[1])), y1 = Math.max(...q.map(p => p[1]));
        for (let k = 0; k < n; k++) {
          // (Pixel centres: the GPU reads a pixel, the CPU's ray goes through the point.)
          const x = Math.floor(x0 + rand() * (x1 - x0)) + 0.5, y = Math.floor(y0 + rand() * (y1 - y0)) + 0.5, c = viewer.raycast(x, y), g = await viewer.pick(x, y);
          picks.push({ scene, x, y, cpu: c && { name: c.mesh.name, cap: !!c.cap, plane: c.capPlane ?? null, point: c.point }, gpu: g && { name: g.mesh.name, cap: !!g.cap, plane: g.capPlane ?? null, point: g.point } });
        }
      };
      await compare(100, 'box section', [-h, -h, -h], [h, h, h]);
      // B. A 4 × 4 × 4 box, kept where y ≥ 0 and x ≥ 0, seen along +y: the cap on y = 0 for x 0…2, z −2…2 (8 units²).
      big.visible = false; edges.visible = false;
      const quarter = viewer.add(box(4, 4, 4).surface, { name: 'quarter', material: body, cap: true });
      Object.assign(viewer.camera, { projection: 'orthographic', position: [0, -30, 0], target: [0, 0, 0], up: [0, 0, 1] });
      viewer.camera.fit({ min: [-3, -3, -3], max: [3, 3, 3] }, viewer.aspect);
      viewer.clipPlanes = [{ normal: [0, 1, 0], offset: 0, cap: '#ff00ff' }, { normal: [1, 0, 0], offset: 0 }];
      const imgB = await viewer.capture(), unitB = imgB.height / (2 * viewer.camera.halfHeight);
      const two = { pixels: capPixels(imgB), want: 8 * unitB * unitB, outline: 12 * unitB };
      // (A 64-sided cylinder along y under the same two planes, seen the same way: half its 64-gon.)
      quarter.visible = false;
      const P = [], I = [], N = 64;
      for (let i = 0; i < N; i++) { const a = 2 * Math.PI * i / N; P.push(2 * Math.cos(a), -3, 2 * Math.sin(a), 2 * Math.cos(a), 3, 2 * Math.sin(a)); }
      P.push(0, -3, 0, 0, 3, 0);
      for (let i = 0; i < N; i++) { const j = (i + 1) % N, a = 2 * i, b = 2 * i + 1, c = 2 * j, d = 2 * j + 1; I.push(a, d, c, a, b, d, 2 * N, a, c, 2 * N + 1, d, b); }
      const cyl = viewer.add({ positions: P, indices: I }, { name: 'cylinder', material: body, cap: true });
      const imgH = await viewer.capture();
      const half = { pixels: capPixels(imgH), want: 0.5 * N * 4 * Math.sin(2 * Math.PI / N) / 2 * unitB * unitB, outline: (2 + Math.PI * 2 + 2) * unitB };
      cyl.visible = false; quarter.visible = true;
      Object.assign(viewer.camera, { position: [12, -20, 9] });
      await compare(100, 'two planes', [0, 0, -2], [2, 2, 2]);
      // C. The cylinder under three oblique planes.
      quarter.visible = false; cyl.visible = true;
      const unitV = w => { const q = Math.hypot(...w); return w.map(x => x / q); };
      viewer.clipPlanes = [{ normal: unitV([0.3, 1, 0.2]), offset: -0.5, cap: '#ff00ff' }, { normal: unitV([1, -0.2, 0.5]), offset: -0.8 }, { normal: unitV([-0.4, 0.3, -1]), offset: -1.1 }];
      viewer.camera.fit({ min: [-3, -4, -3], max: [3, 4, 3] }, viewer.aspect);
      await compare(100, 'three oblique planes', [-2, -3, -2], [2, 3, 2]);
      const planes = viewer.clipPlanes.length;
      viewer.dispose();
      return { cube, two, half, linePick: linePick && linePick.mesh.name, picks, planes };
    });
    t.diagnostic(JSON.stringify({ cube: r.cube, two: r.two, half: r.half, linePick: r.linePick }));
    assert.ok(Math.abs(r.half.pixels - r.half.want) <= r.half.outline, `two planes on a cylinder: ${r.half.pixels} cap px against ${r.half.want.toFixed(0)} ± ${r.half.outline.toFixed(0)}`);
    assert.ok(Math.abs(r.cube.pixels - r.cube.want) <= r.cube.outline, `box section inside a solid: ${r.cube.pixels} cap px against ${r.cube.want.toFixed(0)} ± ${r.cube.outline.toFixed(0)}`);
    assert.ok(Math.abs(r.two.pixels - r.two.want) <= r.two.outline, `two planes: ${r.two.pixels} cap px against ${r.two.want.toFixed(0)} ± ${r.two.outline.toFixed(0)}`);
    assert.equal(r.linePick, null, 'the solid\'s edges cut away: no line found');
    assert.equal(r.planes, 3);
    // GPU picks the CPU's: the same mesh and cap (and plane); points within a few hundredths, the GPU's from its depth.
    let differ = 0, caps = 0, far = 0;
    for (const k of r.picks) {
      if ((k.cpu?.name ?? null) !== (k.gpu?.name ?? null) || (k.cpu?.cap ?? false) !== (k.gpu?.cap ?? false) || (k.cpu?.plane ?? null) !== (k.gpu?.plane ?? null)) { differ++; continue; }
      if (k.cpu?.cap) caps++;
      if (k.cpu && Math.hypot(...k.cpu.point.map((x, i) => x - k.gpu.point[i])) > 0.05) far++;
    }
    t.diagnostic(JSON.stringify({ picks: r.picks.length, differ, caps, far }));
    assert.ok(differ <= 2, `GPU picks against CPU rays: ${differ} of ${r.picks.length} differ (pixel-edge rounding allowed 2) ${JSON.stringify(r.picks.filter(k => (k.cpu?.name ?? null) !== (k.gpu?.name ?? null) || (k.cpu?.cap ?? false) !== (k.gpu?.cap ?? false)).slice(0, 3))}`);
    assert.ok(caps > 100, `${caps} picks on caps`);
    assert.equal(far, 0);
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G19's known limit, pinned (so a fix shows as a changed expectation): a solid wholly inside another and wholly kept. Past
// the plane the first surface after the ray's entry is the inner solid's front face — not a back face — so the outer one's
// cap is missing over the inner one's outline: its front face shows through the hole, on the GPU and in the CPU's ray; the
// outer cap is drawn round it. (In a valid part or assembly that is an overlap, which an interference check flags.)
test('G19 the known limit: a solid wholly inside another, wholly kept, shows through the outer one\'s cap (pinned)', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box, screen, pixel } = window, canvas = document.getElementById('c');
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, antialias: false, background: '#000000', camera: { position: [0, -30, 0], target: [0, 0, 0], up: [0, 0, 1], projection: 'orthographic' }, lights: [] });
      viewer.add(box(10, 10, 10).surface, { name: 'outer', material: { color: '#ffffff', unlit: true }, cap: true, capColor: '#ff00ff' });
      viewer.add(box(2, 2, 2).surface, { name: 'inner', material: { color: '#00ff00', unlit: true }, cap: true, capColor: '#0000ff', transform: api.translation([0, 2, 0]) });
      viewer.camera.fit({ min: [-6, -6, -6], max: [6, 6, 6] }, viewer.aspect);
      // (Kept y ≥ 0: the inner box, y 1 … 3, wholly kept.)
      viewer.clipPlane = { normal: [0, 1, 0], offset: 0 };
      const img = await viewer.capture(), at = p => screen(viewer, p);
      const [cx, cy] = at([0, 0, 0]), [ox, oy] = at([3, 0, 3]);
      const c = viewer.raycast(cx, cy), g = await viewer.pick(cx, cy), o = viewer.raycast(ox, oy);
      const out = { centre: pixel(img, [cx, cy]).slice(0, 3), outside: pixel(img, [ox, oy]).slice(0, 3), cpu: c && { name: c.mesh.name, cap: !!c.cap }, gpu: g && { name: g.mesh.name, cap: !!g.cap }, beside: o && { name: o.mesh.name, cap: !!o.cap } };
      viewer.dispose();
      return out;
    });
    t.diagnostic(JSON.stringify(r));
    // The limit: over the inner box its green front face, no cap (the outer's magenta cap would be right).
    assert.deepEqual(r.centre, [0, 255, 0]); assert.deepEqual(r.cpu, { name: 'inner', cap: false }); assert.deepEqual(r.gpu, { name: 'inner', cap: false });
    // Beside it the outer one's cap.
    assert.deepEqual(r.outside, [255, 0, 255]); assert.deepEqual(r.beside, { name: 'outer', cap: true });
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G20: a cut-out — the clip planes keep what is on any plane's kept side, the corner where their cut-away sides meet
// removed. A 4 mm cube with the quarter x > 0, y > 0 cut out, seen obliquely (orthographic): its caps are the notch's two
// faces, 2 × 4 each, whose screen area is 8(|vx| + |vy|); with the octant (z > 0 too) three 2 × 2 faces, 4(|vx| + |vy| +
// |vz|). GPU picks equal to the CPU's rays over the notch; an edge in the removed corner not found, the rest of it found.
// Shadows: the octant cut-out shadows the ground as the seven 2 mm cubes it is made of do.
test('G20 cut-outs: a quarter and an octant cut from a cube, the notch\'s caps at the closed form; GPU picks equal to CPU rays; lines in the removed corner not found; the shadow of the seven cubes', { timeout: 180000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box, screen } = window, canvas = document.getElementById('c');
      canvas.style.width = '800px'; canvas.style.height = '400px';
      const v = [0.7, 0.55, 0.45], l = Math.hypot(...v), vn = v.map(x => x / l);
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, antialias: false, background: '#000000', camera: { position: vn.map(x => x * 40), target: [0, 0, 0], up: [0, 0, 1], projection: 'orthographic' }, lights: [] });
      const isCap = (d, i) => d[i] > 200 && d[i + 1] < 60 && d[i + 2] > 200;
      const capPixels = img => { let n = 0; for (let i = 0; i < img.data.length; i += 4) if (isCap(img.data, i)) n++; return n; };
      const cube = viewer.add(box(4, 4, 4).surface, { name: 'cube', material: { color: '#404040', unlit: true }, cap: true });
      const edges = viewer.add(box(4, 4, 4).edges, { name: 'edges', material: { color: '#00ff00', unlit: true } });
      viewer.camera.fit({ min: [-3, -3, -3], max: [3, 3, 3] }, viewer.aspect);
      const quarter = [{ normal: [-1, 0, 0], offset: 0, cap: '#ff00ff' }, { normal: [0, -1, 0], offset: 0 }];
      viewer.clipCutout = true; viewer.clipPlanes = quarter;
      const unit = () => { return 400 / (2 * viewer.camera.halfHeight); };
      const imgQ = await viewer.capture(), u = unit();
      const q = { pixels: capPixels(imgQ), want: 8 * (Math.abs(vn[0]) + Math.abs(vn[1])) * u * u, outline: (4 + 4 + 4) * 2 * u };
      // (The edge along x at y = 2, z = 2: its +x half in the removed quarter, its −x half kept.)
      const [ax, ay] = screen(viewer, [1, 2, 2]), [bx, by] = screen(viewer, [-1, 2, 2]);
      const lines = { cut: viewer.pickLine(ax, ay, 3)?.mesh.name ?? null, kept: viewer.pickLine(bx, by, 3)?.mesh.name ?? null };
      // Picks over the notch.
      let seed = 9; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const picks = [];
      const compare = async (n, name) => {
        const c = [0, 1, 2, 3, 4, 5, 6, 7].map(i => screen(viewer, [i & 1 ? 2 : -2, i & 2 ? 2 : -2, i & 4 ? 2 : -2]));
        const x0 = Math.min(...c.map(p => p[0])), x1 = Math.max(...c.map(p => p[0])), y0 = Math.min(...c.map(p => p[1])), y1 = Math.max(...c.map(p => p[1]));
        for (let k = 0; k < n; k++) {
          const x = Math.floor(x0 + rand() * (x1 - x0)) + 0.5, y = Math.floor(y0 + rand() * (y1 - y0)) + 0.5, cr = viewer.raycast(x, y), g = await viewer.pick(x, y);
          picks.push({ name, cpu: cr && { name: cr.mesh.name, cap: !!cr.cap, plane: cr.capPlane ?? null }, gpu: g && { name: g.mesh.name, cap: !!g.cap, plane: g.capPlane ?? null } });
        }
      };
      await compare(150, 'quarter');
      // The octant.
      viewer.clipPlanes = [...quarter, { normal: [0, 0, -1], offset: 0 }];
      const imgO = await viewer.capture();
      const o = { pixels: capPixels(imgO), want: 4 * (Math.abs(vn[0]) + Math.abs(vn[1]) + Math.abs(vn[2])) * u * u, outline: (2 + 2 + 2) * 2 * 2 * u };
      await compare(150, 'octant');
      edges.visible = false;
      viewer.dispose();
      // Shadows: the octant cut-out and its seven cubes, lit from above on a ground.
      const sh = await api.createViewer(canvas, { pixelRatio: 1, antialias: false, background: '#000000', camera: { position: [0, -0.01, 40], target: [0, 0, 0], up: [0, 1, 0], projection: 'orthographic' }, lights: [{ kind: 'directional', direction: [0.5, 0.3, -1], intensity: 2.5, castShadow: true }], environment: { ambient: 0.25 } });
      sh.add({ positions: [-30, -30, -6, 30, -30, -6, 30, 30, -6, -30, 30, -6], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3] }, { name: 'ground', material: { color: '#ffffff', roughness: 1 }, clipped: false, castShadow: false });
      const red = { color: '#ff0000', roughness: 1 };
      sh.camera.fit({ min: [-12, -12, -6], max: [12, 12, 3] }, sh.aspect);
      const count = img => { let dark = 0; for (let i = 0; i < img.data.length; i += 4) { const [R, G, B] = [img.data[i], img.data[i + 1], img.data[i + 2]]; if (Math.abs(R - G) > 12 || Math.abs(G - B) > 12 || R === 0) continue; if (G < 120) dark++; } return dark; };
      const whole = sh.add(box(4, 4, 4).surface, { name: 'cube', material: red, cap: true, capColor: '#ff0000' });
      sh.clipCutout = true; sh.clipPlanes = [{ normal: [-1, 0, 0], offset: 0 }, { normal: [0, -1, 0], offset: 0 }, { normal: [0, 0, -1], offset: 0 }];
      const cut = count(await sh.capture());
      whole.visible = false; sh.clipPlanes = null;
      for (let i = 0; i < 8; i++) if (i !== 7) sh.add(box(2, 2, 2).surface, { material: red, transform: api.translation([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]) });
      const seven = count(await sh.capture()), su = 400 / (2 * sh.camera.halfHeight);
      sh.dispose();
      return { q, o, lines, picks, shadow: { cut, seven, outline: 4 * 4 * 2 * su } };
    });
    t.diagnostic(JSON.stringify({ q: r.q, o: r.o, lines: r.lines, shadow: r.shadow }));
    assert.ok(Math.abs(r.q.pixels - r.q.want) <= r.q.outline, `the quarter's caps: ${r.q.pixels} px against ${r.q.want.toFixed(0)} ± ${r.q.outline.toFixed(0)}`);
    assert.ok(Math.abs(r.o.pixels - r.o.want) <= r.o.outline, `the octant's caps: ${r.o.pixels} px against ${r.o.want.toFixed(0)} ± ${r.o.outline.toFixed(0)}`);
    assert.deepEqual(r.lines, { cut: null, kept: 'edges' });
    let differ = 0, caps = 0;
    for (const k of r.picks) {
      if ((k.cpu?.name ?? null) !== (k.gpu?.name ?? null) || (k.cpu?.cap ?? false) !== (k.gpu?.cap ?? false) || (k.cpu?.plane ?? null) !== (k.gpu?.plane ?? null)) { differ++; continue; }
      if (k.cpu?.cap) caps++;
    }
    t.diagnostic(JSON.stringify({ picks: r.picks.length, differ, caps }));
    assert.ok(differ <= 2, `GPU picks against CPU rays: ${differ} of ${r.picks.length} differ ${JSON.stringify(r.picks.filter(k => (k.cpu?.name ?? null) !== (k.gpu?.name ?? null) || (k.cpu?.cap ?? false) !== (k.gpu?.cap ?? false)).slice(0, 3))}`);
    assert.ok(caps > 30, `${caps} picks on caps`);
    assert.ok(r.shadow.seven > 300 && Math.abs(r.shadow.cut - r.shadow.seven) <= r.shadow.outline, `the octant's shadow ${r.shadow.cut} against the seven cubes' ${r.shadow.seven} ± ${r.shadow.outline.toFixed(0)}`);
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G20.2: the caps' probe gave a back face a fixed lead in depth (4e-7) to win a tie; far from the eye in the reversed
// depth that is more than the gap between a front face and the back face just behind it near an edge, so the back face
// won there and a cap leaked over the front face along the part's far edges (the studio's cut-out flow: a band a pixel or
// two wide). Now its lead is a share of the depth. The studio's view of a 40 × 20 × 10 plate under a cut-out with a
// shadow catcher widening the depth range: every cap pixel a cap in the CPU's ray, but for pixels on an edge.
test('G20.2 no cap leaks over a front face\'s far edges: a cut-out plate seen from near, its fully covered cap pixels the CPU\'s caps, its edge antialiased', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box } = window, canvas = document.getElementById('c');
      canvas.style.width = '800px'; canvas.style.height = '400px';
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, antialias: true, background: '#000000', camera: { position: [61.44, -55.3, 61.19], target: [20, 10, 5], up: [0, 0, 1], projection: 'perspective', fovY: 32 }, lights: [{ kind: 'directional', direction: [0.3, 0.4, -1], castShadow: true }] });
      const g = box(40, 20, 10).surface; g.positions = g.positions.map((v, i) => v + [20, 10, 5][i % 3]);
      viewer.add(g, { name: 'plate', material: { color: '#404040', unlit: true }, cap: true });
      viewer.add({ positions: [-60, -60, -0.02, 100, -60, -0.02, 100, 80, -0.02, -60, 80, -0.02], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3] }, { material: { shadowOnly: true, opacity: 0.55 }, pickable: false, castShadow: false, clipped: false });
      viewer.clipCutout = true;
      viewer.clipPlanes = [{ normal: [-1, 0, 0], offset: -20, cap: '#ff00ff' }, { normal: [0, 1, 0], offset: 10 }];
      const img = await viewer.capture();
      // (Antialiased caps, G7: a pixel on the cap's edge is cap on some of its samples, a mixed colour. It counts as edge only
      // beside (8-neighbourhood) a pixel the CPU's ray finds a cap at; a leak is any other cap-coloured pixel the CPU's centre
      // ray misses — the pure cap colour, every sample cap, or a mixed one away from the cap.)
      const W = img.width, H = img.height, cpu = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = viewer.raycast(x + 0.5, y + 0.5); if (h && h.cap) cpu[y * W + x] = 1; }
      const beside = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && cpu[yy * W + xx]) return true; } return false; };
      let caps = 0, leaks = 0, fringe = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (!(img.data[i] > 150 && img.data[i + 2] > 150 && img.data[i + 1] < 80)) continue;
        caps++; if (cpu[y * W + x]) continue;
        const pure = img.data[i] >= 245 && img.data[i + 2] >= 245 && img.data[i + 1] <= 10;
        if (!pure && beside(x, y)) fringe++; else leaks++;
      }
      viewer.dispose();
      return { caps, leaks, fringe };
    });
    t.diagnostic(JSON.stringify(r));
    // (Before: 660 of 11 660.)
    assert.ok(r.caps > 8000, `${r.caps} cap pixels`);
    assert.ok(r.leaks <= 10, `${r.leaks} cap pixels where the CPU's ray meets no cap (pixel-edge rounding allowed 10)`);
    // (And the edge is antialiased: some partly covered cap pixels just past the CPU's cap.)
    assert.ok(r.fringe > 0, 'no partly covered cap pixels: the cap edge is aliased');
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G2b: a mesh's own cap colour, times its material colour; none: the plane's.
test('G2b each mesh\'s cap in its own colour times its material colour; without one, the plane\'s', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box, screen } = window, canvas = document.getElementById('c');
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, antialias: false, background: '#000000', camera: { position: [0, -30, 0], target: [0, 0, 0], up: [0, 0, 1], projection: 'orthographic' }, lights: [] });
      viewer.add(box(4, 4, 4).surface, { material: { color: '#ffffff', unlit: true }, cap: true, capColor: '#00ff00', transform: api.translation([-6, 0, 0]) });
      viewer.add(box(4, 4, 4).surface, { material: { color: '#ff0000', unlit: true }, cap: true, capColor: '#ffffff', transform: api.translation([0, 0, 0]) });
      const plain = viewer.add(box(4, 4, 4).surface, { material: { color: '#ffffff', unlit: true }, cap: true, transform: api.translation([6, 0, 0]) });
      viewer.camera.fit({ min: [-9, -3, -3], max: [9, 3, 3] }, viewer.aspect);
      viewer.clipPlane = { normal: [0, 1, 0], offset: 0, cap: '#0000ff' };
      const px = (img, p) => { const [x, y] = screen(viewer, p), i = (Math.round(y) * img.width + Math.round(x)) * 4; return [...img.data.slice(i, i + 3)]; };
      const a = await viewer.capture(), out = { own: px(a, [-6, 0, 0]), timesMaterial: px(a, [0, 0, 0]), plane: px(a, [6, 0, 0]) };
      plain.capColor = '#ff00ff'; const b = await viewer.capture(); out.changed = px(b, [6, 0, 0]);
      plain.capColor = null; const c = await viewer.capture(); out.back = px(c, [6, 0, 0]);
      viewer.dispose();
      return out;
    });
    t.diagnostic(JSON.stringify(r));
    assert.deepEqual(r.own, [0, 255, 0]); assert.deepEqual(r.timesMaterial, [255, 0, 0]); assert.deepEqual(r.plane, [0, 0, 255]);
    assert.deepEqual(r.changed, [255, 0, 255]); assert.deepEqual(r.back, [0, 0, 255]);
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G19.3: hatch lines on caps, fixed in the world. Two boxes cut by a plane, each cap hatched at its own angle; the lines'
// darkening read back per pixel (α: how much of the cap colour × 0.45 a pixel is): its mean over a cap is 1 pixel over
// the spacing in pixels (a line 1 pixel wide), and of the angles every 5°, the lines of the mesh's own angle and spacing
// through the world's origin lie where α is (its own phase, the axes capHatchAxes gives); the same after the camera moves;
// an oblique plane the same; off, no lines.
test('G19.3 hatch on caps: a line a pixel wide over the spacing, at each mesh\'s angle in capHatchAxes\'s axes, fixed in the world as the camera moves; an oblique plane; off', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box } = window, canvas = document.getElementById('c');
      canvas.style.width = '800px'; canvas.style.height = '400px';
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, antialias: false, background: '#000000', camera: { position: [0, -30, 0], target: [0, 0, 0], up: [0, 0, 1], projection: 'orthographic' }, lights: [] });
      const white = { color: '#ffffff', unlit: true };
      const a = viewer.add(box(6, 6, 6).surface, { name: 'a', material: white, cap: true, capColor: '#ffffff', capHatch: { angle: 45, spacing: 0.4 }, transform: api.translation([-4, 0, 0]) });
      const b = viewer.add(box(6, 6, 6).surface, { name: 'b', material: white, cap: true, capColor: '#ffffff', capHatch: { angle: 120, spacing: 0.6 }, transform: api.translation([4, 0, 0]) });
      viewer.camera.fit({ min: [-8, -4, -4], max: [8, 4, 4] }, viewer.aspect);
      const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      // Per pixel of the capture: its ray onto the plane, the point, and α; the pixels on a mesh's cap (from the pick).
      const read = async (plane, meshes) => {
        const img = await viewer.capture(), W = img.width, H = img.height, rows = Object.fromEntries(meshes.map(m => [m.name, []]));
        for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
          const i = (y * W + x) * 4, g = img.data[i + 1];
          if (img.data[i] !== g || img.data[i + 2] !== g || g === 0) continue;
          const ray = viewer.camera.ray(((x + 0.5) / W) * 2 - 1, 1 - ((y + 0.5) / H) * 2, viewer.aspect);
          const den = ray.direction.reduce((s, d, k) => s + d * plane.normal[k], 0), tt = (plane.offset - ray.origin.reduce((s, o, k) => s + o * plane.normal[k], 0)) / den;
          const p = ray.origin.map((o, k) => o + ray.direction[k] * tt);
          // (Inside a cap less a pixel's margin round its edge: which box by x along the boxes' row.)
          const m = meshes.find(m => m.inside(p));
          if (m) rows[m.name].push([p, (1 - lin(g)) / 0.55]);
        }
        return { rows, unit: H / (2 * viewer.camera.halfHeight) };
      };
      // The angle (of 0, 5, … 175°) whose lines, `spacing` apart through the origin in the plane's axes, lie where α is:
      // the mean α of the pixels within 0.3 pixel of one.
      const best = (rows, plane, spacing, unit) => {
        const near = 0.3 / (spacing * unit);
        const { u, v } = api.capHatchAxes(plane.normal);
        let top = null;
        for (let deg = 0; deg < 180; deg += 5) {
          const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180), across = u.map((uk, k) => c * v[k] - s * uk);
          let on = 0, n = 0;
          for (const [p, al] of rows) { const h = p.reduce((q, x, k) => q + x * across[k], 0) / spacing, d = Math.abs(h - Math.round(h)); if (d < near) { on += al; n++; } }
          const score = n ? on / n : 0;
          if (!top || score > top.score) top = { deg, score };
        }
        return top;
      };
      const mean = rows => rows.reduce((q, [, al]) => q + al, 0) / rows.length;
      const y0 = { normal: [0, 1, 0], offset: 0 };
      viewer.clipPlane = { ...y0, cap: '#ffffff' };
      const inA = { name: 'a', inside: p => Math.abs(p[0] + 4) < 2.8 && Math.abs(p[2]) < 2.8 }, inB = { name: 'b', inside: p => Math.abs(p[0] - 4) < 2.8 && Math.abs(p[2]) < 2.8 };
      const out = {};
      const one = (R, name, plane, spacing) => ({ n: R.rows[name].length, mean: mean(R.rows[name]), want: 1 / (spacing * R.unit), best: best(R.rows[name], plane, spacing, R.unit) });
      let R = await read(y0, [inA, inB]);
      out.first = { a: one(R, 'a', y0, 0.4), b: one(R, 'b', y0, 0.6) };
      // Moved: panned and zoomed — the lines where they were in the world.
      Object.assign(viewer.camera, { position: [1.3, -30, 0.7], target: [1.3, 0, 0.7] });
      viewer.camera.fit({ min: [-7, -3, -3], max: [9, 3, 3] }, viewer.aspect);
      R = await read(y0, [inA, inB]);
      out.moved = { a: one(R, 'a', y0, 0.4), b: one(R, 'b', y0, 0.6) };
      // An oblique plane through both, seen along its normal.
      const nq = [0.3, 0.9, -0.3], l = Math.hypot(...nq), ob = { normal: nq.map(x => x / l), offset: 0.2 };
      viewer.clipPlane = { ...ob, cap: '#ffffff' };
      Object.assign(viewer.camera, { position: ob.normal.map((x, k) => -30 * x), target: [0, 0, 0], up: [0, 0, 1] });
      viewer.camera.fit({ min: [-8, -4, -4], max: [8, 4, 4] }, viewer.aspect);
      const inside = c => p => Math.abs(p[0] - c) < 2.6 && Math.abs(p[1]) < 2.6 && Math.abs(p[2]) < 2.6;
      R = await read(ob, [{ name: 'a', inside: inside(-4) }, { name: 'b', inside: inside(4) }]);
      out.oblique = { a: one(R, 'a', ob, 0.4), b: one(R, 'b', ob, 0.6) };
      // Off: the cap plain.
      a.capHatch = null; b.capHatch = null;
      R = await read(ob, [{ name: 'a', inside: inside(-4) }, { name: 'b', inside: inside(4) }]);
      out.off = { a: mean(R.rows.a), b: mean(R.rows.b), n: R.rows.a.length };
      out.hatch = [a.capHatch, b.capHatch];
      viewer.dispose();
      return out;
    });
    t.diagnostic(JSON.stringify(r));
    for (const k of ['first', 'moved', 'oblique']) for (const [m, deg] of [['a', 45], ['b', 120]]) {
      const x = r[k][m];
      assert.ok(x.n > 2000, `${k} ${m}: ${x.n} cap pixels`);
      assert.ok(Math.abs(x.mean - x.want) < 0.15 * x.want, `${k} ${m}: mean darkening ${x.mean.toFixed(4)} against a pixel over the spacing ${x.want.toFixed(4)}`);
      assert.equal(x.best.deg, deg, `${k} ${m}: the lines at ${x.best.deg}° (score ${x.best.score.toFixed(3)}), set at ${deg}°`);
      assert.ok(x.best.score > 0.6, `${k} ${m}: on the lines darkened ${x.best.score.toFixed(3)}`);
    }
    assert.ok(r.off.n > 2000 && r.off.a < 0.01 && r.off.b < 0.01, `off: ${JSON.stringify(r.off)}`);
    assert.deepEqual(r.hatch, [null, null]);
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G19.4: the caps cast shadows. A box section wholly inside a solid leaves nothing of the solid's own surface — before,
// a block with no shadow; now its caps are drawn into the shadow map from the light (its own probe: the entry into the
// kept region along the light's rays, inside the solid). Oracle: the same kept cube as a plain mesh, unclipped — the
// ground's shadow the same pixels within its outline; and the probe's rule from the light: a cube kept whole under the
// planes (a solid inside the region, not cut) casts its own shadow once, not a cap's.
test('G19.4 caps cast shadows: a box section\'s kept cube shadows the ground as the same cube unclipped does; a whole kept solid as before', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box } = window, canvas = document.getElementById('c');
      canvas.style.width = '800px'; canvas.style.height = '400px';
      const light = { kind: 'directional', direction: [0.45, 0.25, -1], intensity: 2.5, castShadow: true };
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, antialias: false, background: '#000000', camera: { position: [0, -0.01, 40], target: [0, 0, 0], up: [0, 1, 0], projection: 'orthographic' }, lights: [light], environment: { ambient: 0.25 } });
      const ground = viewer.add({ positions: [-30, -30, -6, 30, -30, -6, 30, 30, -6, -30, 30, -6], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3] }, { name: 'ground', material: { color: '#ffffff', roughness: 1 }, clipped: false, castShadow: false });
      const red = { color: '#ff0000', roughness: 1 };
      const big = viewer.add(box(10, 10, 10).surface, { name: 'big', material: red, cap: true, capColor: '#ffffff' });
      viewer.camera.fit({ min: [-14, -14, -6], max: [14, 14, 5] }, viewer.aspect);
      const h = 1.5, planes = [0, 1, 2].flatMap(k => [1, -1].map(sg => { const n = [0, 0, 0]; n[k] = sg; return { normal: n, offset: -h }; }));
      // (The ground's pixels: grey — lit, or shadowed below the midway; the red block and its caps apart.)
      const count = img => { let lit = 0, dark = 0; for (let i = 0; i < img.data.length; i += 4) { const [R, G, B] = [img.data[i], img.data[i + 1], img.data[i + 2]]; if (Math.abs(R - G) > 12 || Math.abs(G - B) > 12 || R === 0) continue; if (G < 120) dark++; else lit++; } return { lit, dark }; };
      const out = {};
      viewer.clipPlanes = null; out.whole = count(await viewer.capture());
      viewer.clipPlanes = planes; out.section = count(await viewer.capture());
      // The oracle: the kept cube as a mesh, nothing clipped.
      big.visible = false; viewer.clipPlanes = null;
      const cube = viewer.add(box(3, 3, 3).surface, { name: 'cube', material: red });
      out.cube = count(await viewer.capture());
      // A cube kept whole inside the region (planes round it, cutting nothing): its shadow as without the planes.
      cube.cap = true; viewer.clipPlanes = [0, 1, 2].flatMap(k => [1, -1].map(sg => { const n = [0, 0, 0]; n[k] = sg; return { normal: n, offset: -4 }; }));
      out.inside = count(await viewer.capture());
      const unit = viewer.canvas.height / (2 * viewer.camera.halfHeight);
      out.outline = 4 * 3 * 2 * unit;
      viewer.dispose();
      return out;
    });
    t.diagnostic(JSON.stringify(r));
    assert.ok(r.whole.dark > 1000, `the whole solid shadows the ground: ${r.whole.dark}`);
    assert.ok(r.cube.dark > 200, `the cube's shadow: ${r.cube.dark}`);
    assert.ok(Math.abs(r.section.dark - r.cube.dark) <= r.outline, `the box section's shadow ${r.section.dark} against the cube's ${r.cube.dark} ± ${r.outline.toFixed(0)}`);
    assert.ok(Math.abs(r.inside.dark - r.cube.dark) <= r.outline * 0.25, `a cube kept whole: ${r.inside.dark} against ${r.cube.dark}`);
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G19.4: a see-through (ghosted) mesh's caps, in the order-independent pass at its opacity. Oracle: the same solid
// clipped on the CPU — its kept half a plain mesh whose cut is a real face, the same see-through material — through the
// same viewer: the frames the same but along their outlines. The overlap limit, measured and pinned: two see-through
// solids overlapping where the plane cuts both — the probe keeps one surface a pixel, so there only one of the two caps
// is drawn (the CPU's copies show two layers): the frames differ over the overlap's cap and nowhere else. GPU picks and
// CPU rays agree over the ghost section (a see-through cap is drawn, not picked).
test('G19.4 ghost caps: a see-through solid\'s cap as the CPU-clipped copy\'s face; the overlap limit pinned (one cap where two overlap); picks as the CPU\'s', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box } = window, canvas = document.getElementById('c');
      canvas.style.width = '800px'; canvas.style.height = '400px';
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, antialias: false, background: '#000000', camera: { position: [3, -30, 2], target: [0, 0, 0], up: [0, 0, 1], projection: 'orthographic' }, lights: [] });
      const ghost = c => ({ color: c, unlit: true, opacity: 0.35 });
      const fit = () => viewer.camera.fit({ min: [-6, -3, -3], max: [6, 3, 3] }, viewer.aspect);
      const diff = (a, b, pred) => { let n = 0; for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) { const i = (y * a.width + x) * 4; if (pred && !pred(x, y)) continue; if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 24) n++; } return n; };
      const lit = img => { let n = 0; for (let i = 0; i < img.data.length; i += 4) if (img.data[i] + img.data[i + 1] + img.data[i + 2] > 0) n++; return n; };
      // (The kept half y ≥ 0 of a w × 2d × 4 box at x0: a plain mesh, its y = 0 face the cut.)
      const half = (w, x0, d = 2) => { const g = box(w, d, 4).surface; return { ...g, positions: g.positions.map((v, i) => i % 3 === 0 ? v + x0 : i % 3 === 1 ? v + d / 2 : v) }; };
      const plane = { normal: [0, 1, 0], offset: 0, cap: '#ffffff' };
      fit();
      // A. One ghost box, GPU-capped, against its CPU-clipped half.
      const a = viewer.add(box(4, 4, 4).surface, { name: 'ghost', material: ghost('#ff8000'), cap: true, capColor: '#ffffff' });
      viewer.clipPlane = plane; const gpu = await viewer.capture();
      a.visible = false; viewer.clipPlane = null;
      const c = viewer.add(half(4, 0), { name: 'half', material: ghost('#ff8000') });
      const cpu = await viewer.capture();
      const unit = gpu.height / (2 * viewer.camera.halfHeight), out = { one: { differ: diff(gpu, cpu), lit: lit(gpu), outline: 4 * 4 * 2 * unit } };
      c.visible = false;
      // B. Two ghost boxes overlapping over x −1 … 1, q the shallower (y −1.5 … 1.5): past the plane its back face is the
      // first surface over the overlap, so there only q's cap is drawn. (Equally deep, their back faces tie and both are.)
      const p = viewer.add(box(4, 4, 4).surface, { name: 'p', material: ghost('#ff0000'), cap: true, capColor: '#ffffff', transform: api.translation([-1, 0, 0]) });
      const q = viewer.add(box(4, 3, 4).surface, { name: 'q', material: ghost('#0000ff'), cap: true, capColor: '#ffffff', transform: api.translation([1, 0, 0]) });
      viewer.clipPlane = plane; const gpu2 = await viewer.capture();
      // (Picks over it: GPU against CPU.)
      let differ = 0, n = 0; const [x0, x1, y0, y1] = [200, 600, 60, 340];
      for (let k = 0; k < 120; k++) {
        const x = x0 + ((k * 37) % (x1 - x0)) + 0.5, y = y0 + ((k * 53) % (y1 - y0)) + 0.5, cr = viewer.raycast(x, y), g = await viewer.pick(x, y);
        n++; if ((cr?.mesh.name ?? null) !== (g?.mesh.name ?? null) || !!cr?.cap !== !!g?.cap) differ++;
      }
      p.visible = false; q.visible = false; viewer.clipPlane = null;
      viewer.add(half(4, -1), { name: 'hp', material: ghost('#ff0000') }); viewer.add(half(4, 1, 1.5), { name: 'hq', material: ghost('#0000ff') });
      const cpu2 = await viewer.capture();
      // (The cap's overlap on screen: x −1 … 1, z −2 … 2 at y = 0; the rest of the frame.)
      const at = w => window.screen(viewer, w), [ox0, oy0] = at([-1, 0, 2]), [ox1, oy1] = at([1, 0, -2]);
      const inOverlap = (x, y) => x > ox0 + 2 && x < ox1 - 2 && y > oy0 + 2 && y < oy1 - 2;
      out.two = { overlap: diff(gpu2, cpu2, inOverlap), area: (ox1 - ox0 - 4) * (oy1 - oy0 - 4), elsewhere: diff(gpu2, cpu2, (x, y) => !(x > ox0 - 3 && x < ox1 + 3 && y > oy0 - 3 && y < oy1 + 3)), outline: 4 * 8 * 2 * unit, picks: n, differ };
      viewer.dispose();
      return out;
    });
    t.diagnostic(JSON.stringify(r));
    assert.ok(r.one.lit > 5000, `drawn: ${r.one.lit}`);
    assert.ok(r.one.differ <= r.one.outline, `the ghost's cap against the CPU-clipped face: ${r.one.differ} pixels differ (± ${r.one.outline.toFixed(0)} along the outlines)`);
    // The limit: over the overlap one cap, not two — nearly every pixel there differs; nowhere else but outlines.
    assert.ok(r.two.overlap >= 0.9 * r.two.area, `the overlap: ${r.two.overlap} of ${r.two.area.toFixed(0)} differ (one cap of two, pinned)`);
    assert.ok(r.two.elsewhere <= r.two.outline, `elsewhere ${r.two.elsewhere} (± ${r.two.outline.toFixed(0)})`);
    assert.ok(r.two.differ <= 2, `picks: ${r.two.differ} of ${r.two.picks} differ`);
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G3: a line pick passes over a segment a surface hides — the GPU's depth at its pixel is the oracle: nothing found lies
// behind a surface, and every segment found through surfaces that the GPU shows is found (or a nearer one); the clip
// plane's cut-away faces hide nothing, its cap does; another mesh hides too.
test('G3 depth-aware line picks: nothing behind a surface, everything the GPU shows; other meshes and the clip plane', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box, screen, tp } = window, canvas = document.getElementById('c');
      canvas.style.width = '640px'; canvas.style.height = '480px';
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#202020', camera: { position: [7, -9, 6], target: [0, 0, 0], up: [0, 0, 1] } });
      const b = box(2, 2, 2), body = viewer.add(b.surface, { name: 'body', material: { color: '#a0a0a0' }, cap: true }), edges = viewer.add(b.edges, { name: 'edges', material: { color: '#ffffff', unlit: true } });
      // A second box in front of part of the first, seen from here: it hides some of its edges too (in the samples).
      const other = viewer.add(box(1, 1, 3).surface, { name: 'other', material: { color: '#406080' }, transform: api.translation([0.2, -2.2, 0]) });
      viewer.fit(); await viewer.frame();
      const eye = viewer.camera.position, dist = p => Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]);
      const pixelAt = p => 2 * Math.tan(viewer.camera.fovY * Math.PI / 360) * dist(p) / canvas.clientHeight;
      /** Whether the GPU shows a world point: the surface at its pixel is not nearer than it, by more than two pixels. */
      const shown = async p => { const [x, y] = screen(viewer, p), h = await viewer.pick(x, y); return !h || dist(p) <= dist(h.point) + 2 * pixelAt(p); };
      let seed = 9; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const [x0, y0] = screen(viewer, [-1.5, 1.5, 1.5]), [x1, y1] = screen(viewer, [1.5, -1.5, -1.5]);
      const stats = { tries: 0, found: 0, behind: 0, missed: 0, hiddenThrough: 0 };
      const run = async () => {
        for (let k = 0; k < 300; k++) {
          const x = Math.min(x0, x1) - 10 + rand() * (Math.abs(x1 - x0) + 20), y = Math.min(y0, y1) - 10 + rand() * (Math.abs(y1 - y0) + 20);
          const aware = viewer.pickLine(x, y, 6), through = viewer.pickLine(x, y, 6, { throughSurfaces: true });
          stats.tries++;
          if (aware) { stats.found++; if (!(await shown(aware.point))) stats.behind++; }
          if (through) {
            const vis = await shown(through.point);
            if (!vis) stats.hiddenThrough++;
            else if (!aware || aware.distance > through.distance + 1e-9) stats.missed++;
          }
        }
      };
      await run();
      const plain = { ...stats };
      // The back vertical edge (x −1, y +1), behind the box: not found on its own; through surfaces it is.
      const [bx, by] = screen(viewer, [-1, 1, 0]), backAware = viewer.pickLine(bx, by, 2), backThrough = viewer.pickLine(bx, by, 2, { throughSurfaces: true });
      // Cut open, the front faces away (no cap): the back edge shows; capped, the cap hides it.
      body.cap = false; viewer.clipPlane = { normal: [-0.6, 0.8, 0], offset: 0 }; await viewer.frame();
      const cutOpen = viewer.pickLine(bx, by, 2);
      body.cap = true; await viewer.frame();
      const cutCapped = viewer.pickLine(bx, by, 2);
      Object.assign(stats, { tries: 0, found: 0, behind: 0, missed: 0, hiddenThrough: 0 });
      body.cap = false; await run(); const clipped = { ...stats };
      viewer.dispose();
      return { plain, clipped, back: { aware: backAware && { edge: backAware.edge, point: backAware.point }, through: backThrough && { edge: backThrough.edge, point: backThrough.point } }, cutOpen: cutOpen && cutOpen.point, cutCapped: cutCapped && cutCapped.point };
    });
    t.diagnostic(JSON.stringify(r));
    for (const st of [r.plain, r.clipped]) {
      assert.equal(st.behind, 0, `nothing found behind a surface ${JSON.stringify(st)}`);
      assert.equal(st.missed, 0, `everything shown found ${JSON.stringify(st)}`);
      assert.ok(st.found > 30 && st.hiddenThrough > 3, `the scene picks and hides some ${JSON.stringify(st)}`);
    }
    assert.ok(!r.back.aware || Math.hypot(r.back.aware.point[0] + 1, r.back.aware.point[1] - 1) > 1e-3, `the back edge not found ${JSON.stringify(r.back)}`);
    assert.ok(r.back.through && Math.hypot(r.back.through.point[0] + 1, r.back.through.point[1] - 1) < 1e-3, `through surfaces it is ${JSON.stringify(r.back)}`);
    assert.ok(r.cutOpen && Math.hypot(r.cutOpen[0] + 1, r.cutOpen[1] - 1) < 1e-3, `cut open, the back edge shows ${JSON.stringify(r.cutOpen)}`);
    assert.ok(!r.cutCapped || Math.hypot(r.cutCapped[0] + 1, r.cutCapped[1] - 1) > 1e-3, `capped, the cap hides it ${JSON.stringify(r.cutCapped)}`);
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G6: a scalar field and its colour map — per vertex (interpolated) and per triangle (flat), none, below and above, bands,
// back to the material; under the clip plane the cap in its cap colour; picks read the field; nothing made per frame.
test('G6 colour maps of scalar fields: per vertex and per triangle, missing, below, above, bands; the cap under a plane; picks read the value', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box, screen } = window, canvas = document.getElementById('c');
      canvas.style.width = '640px'; canvas.style.height = '480px';
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, antialias: false, background: '#000000', camera: { position: [0, -30, 0], target: [0, 0, 0], up: [0, 0, 1], projection: 'orthographic' }, lights: [] });
      const unlit = { color: '#808080', unlit: true };
      // A: per vertex, the field z (−2 … 2 across a 4 mm box): blue at −2, red at 2.
      const A = viewer.add(box(4, 4, 4).surface, { name: 'A', material: unlit, cap: true, capColor: '#00ff00', transform: api.translation([-6, 0, 0]) });
      const zs = []; for (let v = 0; v < A.geometry.data.vertexCount; v++) zs.push(A.geometry.data.positions[3 * v + 2]);
      A.geometry.setScalars(zs, 'vertex');
      const ramp = { stops: [[-2, '#0000ff'], [2, '#ff0000']] };
      A.colorMap = ramp;
      // B: per triangle, its index (12): 0 … 11 in 4 bands of grey; its front face's two triangles: 6 none, 7 the top band.
      const B = viewer.add(box(4, 4, 4).surface, { name: 'B', material: unlit });
      B.geometry.setScalars(Array.from({ length: 12 }, (_, k) => k === 6 ? NaN : k === 7 ? 11 : k), 'triangle');
      B.colorMap = { stops: [[0, '#000000'], [11, '#ffffff']], missing: '#ff00ff', bands: 4 };
      // C: per vertex 0 … 10 by x, its range 2 … 8: below teal, above orange.
      const C = viewer.add(box(4, 4, 4).surface, { name: 'C', material: unlit, transform: api.translation([6, 0, 0]) });
      C.geometry.setScalars(Array.from({ length: C.geometry.data.vertexCount }, (_, v) => (C.geometry.data.positions[3 * v] + 2) * 2.5), 'vertex');
      C.colorMap = { stops: [[2, '#000000'], [8, '#ffffff']], below: '#00ffff', above: '#ff8000' };
      viewer.camera.fit({ min: [-9, -3, -3], max: [9, 3, 3] }, viewer.aspect);
      await viewer.frame(); await viewer.capture(); await viewer.pick(1, 1);
      const made0 = window.made;
      const img = await viewer.capture();
      const px = (p, M) => { const [x, y] = screen(viewer, p), i = (Math.round(y) * img.width + Math.round(x)) * 4; return [...img.data.slice(i, i + 3)]; };
      // (Front faces at y −2: A's at z ±1.5 and 0; B's two front triangles; C's left, middle and right.)
      const out = {
        aTop: px([-6, -2, 1.9]), aBottom: px([-6, -2, -1.9]), aMiddle: px([-6, -2, 0]),
        bLeft: px([-1, -2, 0.6]), bRight: px([1, -2, -0.6]),
        cLeft: px([4.3, -2, 0]), cMiddle: px([6, -2, 0]), cRight: px([7.7, -2, 0]),
      };
      // The expected sRGB bytes of A's samples: the ramp's texels at their values (linear light).
      const texel = v => { const i = Math.round((v + 2) / 4 * 255); return [...api.packColorMap(ramp).ramp.slice(4 * i, 4 * i + 3)]; };
      out.want = { top: texel(1.9), bottom: texel(-1.9), middle: texel(0) };
      // Picks: the field at the hit (A at z 1, z −0.5; B's triangle; C at x −1 → 2.5).
      const ray = p => viewer.raycast(...screen(viewer, p)), gpu = async p => (await viewer.pick(...screen(viewer, p)));
      out.picks = { aTop: ray([-6, -2, 1])?.scalar, aLow: ray([-6, -2, -0.5])?.scalar, aGpu: (await gpu([-6, -2, 1]))?.scalar, b6: ray([1, -2, -0.6]), b7: ray([-1, -2, 0.6]), c: ray([5, -2, 0])?.scalar };
      out.picks.b6 = out.picks.b6 && { triangle: out.picks.b6.triangle, none: Number.isNaN(out.picks.b6.scalar) };
      out.picks.b7 = out.picks.b7 && { triangle: out.picks.b7.triangle, scalar: out.picks.b7.scalar };
      // Ten frames turning the camera: nothing made.
      for (let k = 0; k < 10; k++) { viewer.camera.position = [Math.sin(k / 10) * 30, -30 * Math.cos(k / 10), 2]; await viewer.frame(); }
      out.made = window.made - made0 - 1;
      viewer.camera.position = [0, -30, 0];
      // Cut across y = 0 (kept y ≥ 0), seen from the cut-away side: A's cap in its cap colour, not its map.
      viewer.clipPlane = { normal: [0, 1, 0], offset: 0 };
      const cut = await viewer.capture(), [kx, ky] = screen(viewer, [-6, 0, 0]), ki = (Math.round(ky) * cut.width + Math.round(kx)) * 4;
      out.cap = [...cut.data.slice(ki, ki + 3)];
      viewer.clipPlane = null;
      // Back to the material: colorMap null.
      A.colorMap = null; const back = await viewer.capture(), [bx, by] = screen(viewer, [-6, -2, 1.5]), bi = (Math.round(by) * back.width + Math.round(bx)) * 4;
      out.material = [...back.data.slice(bi, bi + 3)];
      viewer.dispose();
      return out;
    });
    t.diagnostic(JSON.stringify(r));
    const near = (a, b, d = 3) => a.every((x, i) => Math.abs(x - b[i]) <= d);
    // (Per vertex, interpolated: each sample the ramp's colour at its value, within 0.02 in linear light — a pixel's step in
    // the field moves a dark channel's sRGB byte by about five.)
    const lin = c => c.map(x => { const v = x / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    const nearLinear = (a, b) => lin(a).every((x, i) => Math.abs(x - lin(b)[i]) <= 0.02);
    assert.ok(nearLinear(r.aTop, r.want.top) && nearLinear(r.aBottom, r.want.bottom) && nearLinear(r.aMiddle, r.want.middle), `A on its ramp ${JSON.stringify([r.aTop, r.aBottom, r.aMiddle, r.want])}`);
    assert.deepEqual(r.bRight, [255, 0, 255], 'B\'s triangle 6: none, the missing colour'); assert.deepEqual(r.bLeft, [255, 255, 255], 'B\'s triangle 7: the top band');
    assert.deepEqual(r.cLeft, [0, 255, 255], 'C below its range'); assert.deepEqual(r.cRight, [255, 128, 0], 'C above its range'); assert.ok(r.cMiddle[0] === r.cMiddle[2] && r.cMiddle[0] > 60 && r.cMiddle[0] < 200, `C's middle grey ${r.cMiddle}`);
    assert.ok(Math.abs(r.picks.aTop - 1) < 1e-5 && Math.abs(r.picks.aLow + 0.5) < 1e-5 && Math.abs(r.picks.aGpu - 1) < 0.05, JSON.stringify(r.picks));
    assert.ok(r.picks.b6?.triangle === 6 && r.picks.b6.none && r.picks.b7?.triangle === 7 && r.picks.b7.scalar === 11, `B's picks: none on 6, 11 on 7 ${JSON.stringify(r.picks)}`);
    assert.ok(Math.abs(r.picks.c - 2.5) < 1e-5, JSON.stringify(r.picks));
    assert.equal(r.made, 0, 'nothing made while the camera turns');
    assert.deepEqual(r.cap, [0, 128, 0], 'the cap in its cap colour times the material\'s (G2b), not the map');
    assert.deepEqual(r.material, [128, 128, 128], 'the material again');
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G7: overlay lines — dashed from each segment's start, over the scene or depth-tested, and left out of the scene's bounds.
test('G7 overlay lines: depth-tested ones hidden by a surface (or their hidden parts faint), ones over the scene not (drawn and picked); dashes at their lengths; unbounded meshes not in the scene bounds', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box, screen, pixel } = window, canvas = document.getElementById('c');
      canvas.style.width = '640px'; canvas.style.height = '480px';
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#000000', camera: { position: [0, 0, 20], target: [0, 0, 0], up: [0, 1, 0] } });
      viewer.add(box(4, 4, 2).surface, { name: 'body', material: { color: '#808080' } });
      const line = (y, z, color, material = {}, options = {}) => viewer.add({ positions: [-6, y, z, 6, y, z], topology: 'lines' }, { material: { color, unlit: true, lineWidth: 3, ...material }, castShadow: false, ...options });
      // Under the box: red depth-tested, green over the scene; above it: blue dashed 6 on, 6 off; a long one left out of the bounds.
      line(0, -3, '#ff0000');
      line(1, -3, '#00ff00', { lineOver: true });
      line(-1, 2, '#0000ff', { lineDash: [6, 6] });
      // Magenta depth-tested with its hidden part at half its opacity.
      line(0.5, -3, '#ff00ff', { lineHidden: 0.5 });
      viewer.add({ positions: [-1000, -1.5, 0, 1000, -1.5, 0], topology: 'lines' }, { material: { color: '#ffffff', unlit: true }, bounded: false });
      await viewer.frame();
      const img = await viewer.capture();
      const isRed = c => c[0] > 120 && c[1] < 80 && c[2] < 80, isGreen = c => c[1] > 120 && c[0] < 80 && c[2] < 80, isBlue = c => c[2] > 120 && c[0] < 80 && c[1] < 80;
      const red = { over: isRed(pixel(img, screen(viewer, [0, 0, -3]))), outside: isRed(pixel(img, screen(viewer, [4, 0, -3]))) };
      const green = { over: isGreen(pixel(img, screen(viewer, [0, 1, -3]))), outside: isGreen(pixel(img, screen(viewer, [4, 1, -3]))) };
      const mag = { over: pixel(img, screen(viewer, [0, 0.5, -3])), outside: pixel(img, screen(viewer, [4, 0.5, -3])), body: pixel(img, screen(viewer, [0, -0.25, -3])) };
      // The dashed line's runs along its pixels.
      const [ax, ay] = screen(viewer, [-6, -1, 2]), [bx] = screen(viewer, [6, -1, 2]), runs = [];
      let cur = null, len = 0;
      for (let x = Math.ceil(ax) + 1; x < Math.floor(bx) - 1; x++) { const on = isBlue(pixel(img, [x, ay])); if (on === cur) len++; else { if (cur !== null) runs.push([cur, len]); cur = on; len = 1; } }
      runs.push([cur, len]);
      const inner = runs.slice(1, -1), ons = inner.filter(q => q[0]).map(q => q[1]), offs = inner.filter(q => !q[0]).map(q => q[1]);
      // Picks: the depth-tested line over the box is hidden; the one over the scene is found there.
      const [rx, ry] = screen(viewer, [0, 0, -3]), [gx, gy] = screen(viewer, [0, 1, -3]);
      const pickRed = viewer.pickLine(rx, ry, 2), pickGreen = viewer.pickLine(gx, gy, 2);
      const bounds = viewer.sceneBounds();
      viewer.dispose();
      return { red, green, mag, ons, offs, runs: runs.length, pickRed: pickRed && pickRed.point, pickGreen: pickGreen && pickGreen.point, bounds };
    });
    t.diagnostic(JSON.stringify(r));
    assert.deepEqual(r.red, { over: false, outside: true }, 'the depth-tested line hidden under the box, shown beside it');
    assert.deepEqual(r.green, { over: true, outside: true }, 'the line over the scene shown everywhere');
    // (Its hidden part half way between the body's grey and its own magenta.)
    const [m, o, b] = [r.mag.over, r.mag.outside, r.mag.body];
    assert.ok(o[0] > 200 && o[1] < 60 && o[2] > 200, `the hidden-drawn line in full beside the box ${JSON.stringify(r.mag)}`);
    assert.ok(m[0] - b[0] > 25 && m[2] - b[2] > 25 && m[1] < b[1] && m[0] < o[0] - 25, `its hidden part faint over the box ${JSON.stringify(r.mag)}`);
    assert.ok(r.ons.length >= 8 && r.offs.length >= 8, `dashes along the line ${JSON.stringify(r)}`);
    for (const n of [...r.ons, ...r.offs]) assert.ok(Math.abs(n - 6) <= 1.5, `each dash and gap about 6 pixels ${JSON.stringify(r)}`);
    assert.equal(r.pickRed, null, 'the hidden line is not picked');
    assert.ok(r.pickGreen && Math.abs(r.pickGreen[1] - 1) < 1e-6 && Math.abs(r.pickGreen[2] + 3) < 1e-6, `the line over the scene is picked ${JSON.stringify(r.pickGreen)}`);
    assert.ok(r.bounds && r.bounds.max[0] <= 6 + 1e-9 && r.bounds.min[0] >= -6 - 1e-9, `the unbounded line not in the bounds ${JSON.stringify(r.bounds)}`);
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G8: points as screen-space sprites — discs, squares, rings; depth-tested, over the scene, hidden parts faint; picked by index.
test('G8 points: discs and squares at their size, a ring by its border; hidden under a surface, over it, or faint; pickPoint gives the index (with and without indices), hidden ones passed over; 100 000 points drawn and picked', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box, screen, pixel } = window, canvas = document.getElementById('c');
      canvas.style.width = '640px'; canvas.style.height = '480px';
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#000000', camera: { position: [0, 0, 20], target: [0, 0, 0], up: [0, 1, 0] } });
      viewer.add(box(4, 4, 2).surface, { name: 'body', material: { color: '#808080' } });
      const pts = (positions, color, material = {}, extra = {}) => viewer.add({ positions, topology: 'points', colors: positions.flatMap((_, i) => i % 3 ? [] : color), ...extra }, { material: { color: '#ffffff', unlit: true, ...material }, castShadow: false });
      // Red: one above the box, one under it, one beside it (depth-tested, discs of 12).
      const red = pts([0, 0, 2, 0.8, 0, -3, 4, 0, -3], [1, 0, 0], { pointSize: 12 });
      // Green over the scene, under the box; magenta faint where hidden, under it.
      pts([-0.8, 0, -3], [0, 1, 0], { pointSize: 12, lineOver: true });
      pts([0, 0.8, -3], [1, 0, 1], { pointSize: 12, lineHidden: 0.5 });
      // A square and a disc of 16, beside the box; a ring (no fill, a 2-pixel white border) of 16.
      pts([-4, 1.5, 0], [0, 0, 1], { pointSize: 16, pointShape: 'square' });
      pts([-4, -1.5, 0], [0, 0, 1], { pointSize: 16 });
      const ring = viewer.add({ positions: [4, 1.5, 0], topology: 'points', colors: [1, 1, 0, 0] }, { material: { color: '#ffffff', unlit: true, pointSize: 16, pointBorder: { width: 2, color: '#ffffff' } } });
      // Through indices: elements 3 and 1 of four vertices.
      const indexed = viewer.add({ positions: [-6, 3, 0, -5, 3, 0, -4, 3, 0, -3, 3, 0], indices: [3, 1], topology: 'points' }, { material: { color: '#00ffff', unlit: true, pointSize: 8 } });
      await viewer.frame();
      const img = await viewer.capture(), at = p => pixel(img, screen(viewer, p)), off = (p, dx, dy) => { const [x, y] = screen(viewer, p); return pixel(img, [x + dx, y + dy]); };
      const isRed = c => c[0] > 150 && c[1] < 80 && c[2] < 80;
      const look = {
        redAbove: isRed(at([0, 0, 2])), redUnder: isRed(at([0.8, 0, -3])), redBeside: isRed(at([4, 0, -3])),
        greenOver: at([-0.8, 0, -3]), magentaFaint: at([0, 0.8, -3]), body: at([0.5, -0.8, 1]),
        squareCorner: off([-4, 1.5, 0], 6, 6), discCorner: off([-4, -1.5, 0], 6, 6), discCentre: at([-4, -1.5, 0]),
        ringCentre: at([4, 1.5, 0]), ringEdge: off([4, 1.5, 0], 7, 0), ringOut: off([4, 1.5, 0], 10, 0),
      };
      const pk = p => { const [x, y] = screen(viewer, p); return [x, y]; };
      const pick = (p, o) => { const h = viewer.pickPoint(...pk(p), 3, o); return h && { mesh: h.mesh === red ? 'red' : h.mesh === indexed ? 'indexed' : h.mesh === ring ? 'ring' : h.mesh.material.lineOver ? 'over' : 'other', index: h.index, point: h.point.map(v => Math.round(v * 1000) / 1000) }; };
      const picks = {
        above: pick([0, 0, 2]), beside: pick([4, 0, -3]), under: pick([0.8, 0, -3]), underThrough: pick([0.8, 0, -3], { throughSurfaces: true }),
        over: pick([-0.8, 0, -3]), indexed3: pick([-3, 3, 0]), indexed1: pick([-5, 3, 0]), unindexedVertex: pick([-4, 3, 0]), ring: pick([4.3, 1.5, 0]), none: pick([2.9, -2.9, 0.5]),
      };
      // 100 000 points in a 40-unit cube around the scene: drawn (stats) and picked, timed.
      const N = 100000, P = new Float32Array(3 * N), C = new Float32Array(3 * N);
      let seed = 3; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < N; i++) { P[3 * i] = rand() * 40 - 20; P[3 * i + 1] = rand() * 40 - 20; P[3 * i + 2] = rand() * 10 - 15; C[3 * i] = rand(); C[3 * i + 1] = 0.5; C[3 * i + 2] = 1 - C[3 * i]; }
      const t0 = performance.now(), cloud = viewer.add({ positions: P, colors: C, topology: 'points' }, { material: { pointSize: 3, unlit: true }, bounded: false }), tMake = performance.now() - t0;
      await viewer.frame();
      const tf = performance.now(); for (let k = 0; k < 10; k++) await viewer.frame(); const tFrame = (performance.now() - tf) / 10;
      const stats = { ...viewer.stats };
      let found = 0; const tp = performance.now();
      for (let k = 0; k < 20; k++) { const h = viewer.pickPoint(20 + k * 30, 240, 4); if (h && h.mesh === cloud) found++; }
      const tPick = (performance.now() - tp) / 20;
      viewer.dispose();
      return { look, picks, cloud: { points: stats.points, tMake, tFrame, tPick, found } };
    });
    t.diagnostic(JSON.stringify(r));
    const L = r.look;
    assert.deepEqual([L.redAbove, L.redUnder, L.redBeside], [true, false, true], 'depth-tested: above and beside shown, under the box hidden');
    assert.ok(L.greenOver[1] > 200 && L.greenOver[0] < 60, `over the scene: shown on the box ${JSON.stringify(L.greenOver)}`);
    assert.ok(L.magentaFaint[0] - L.body[0] > 25 && L.magentaFaint[2] - L.body[2] > 25 && L.magentaFaint[1] < L.body[1], `hidden part faint ${JSON.stringify([L.magentaFaint, L.body])}`);
    assert.ok(L.squareCorner[2] > 200, `a square fills its corner ${JSON.stringify(L.squareCorner)}`);
    assert.ok(L.discCorner[2] < 40 && L.discCentre[2] > 200, `a disc does not ${JSON.stringify([L.discCorner, L.discCentre])}`);
    assert.ok(L.ringCentre.slice(0, 3).every(v => v < 30) && L.ringEdge.slice(0, 3).every(v => v > 200) && L.ringOut.slice(0, 3).every(v => v < 30), `a ring: empty, its border, then nothing ${JSON.stringify([L.ringCentre, L.ringEdge, L.ringOut])}`);
    const P = r.picks;
    assert.deepEqual(P.above, { mesh: 'red', index: 0, point: [0, 0, 2] });
    assert.deepEqual(P.beside, { mesh: 'red', index: 2, point: [4, 0, -3] });
    assert.equal(P.under?.mesh === 'red' && P.under.index === 1 ? 'found' : 'passed over', 'passed over', `a hidden point is not picked ${JSON.stringify(P.under)}`);
    assert.deepEqual(P.underThrough, { mesh: 'red', index: 1, point: [0.8, 0, -3] });
    assert.equal(P.over?.mesh, 'over');
    assert.deepEqual(P.indexed3, { mesh: 'indexed', index: 0, point: [-3, 3, 0] }, 'an indexed point by its element');
    assert.deepEqual(P.indexed1, { mesh: 'indexed', index: 1, point: [-5, 3, 0] });
    assert.ok(!P.unindexedVertex || P.unindexedVertex.mesh !== 'indexed', `a vertex no index names is no point ${JSON.stringify(P.unindexedVertex)}`);
    assert.deepEqual(P.ring, { mesh: 'ring', index: 0, point: [4, 1.5, 0] }, 'a ring picked within its half size');
    assert.equal(P.none, null);
    assert.ok(r.cloud.points >= 100000, `the cloud drawn ${JSON.stringify(r.cloud)}`);
    assert.ok(r.cloud.found >= 10, `and picked ${JSON.stringify(r.cloud)}`);
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G9: the scene trees — the same picks as the linear walks (the viewer's `accelerate` off), faster.
test('G9 scene trees: raycast, pickLine and pickPoint through them equal the linear walks over 500 random pointers (plain, clipped, after moves), and are timed', { timeout: 180000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box } = window, canvas = document.getElementById('c');
      canvas.style.width = '640px'; canvas.style.height = '480px';
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#000000', camera: { position: [60, -80, 70], target: [20, 20, 0], up: [0, 0, 1] } });
      let seed = 11; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const turn = (a, x, y, z) => { const c = Math.cos(a), sn = Math.sin(a); return [c, sn, 0, 0, -sn, c, 0, 0, 0, 0, 1, 0, x, y, z, 1]; };
      const names = new Map(); const named = (m, n) => { names.set(m, n); return m; };
      const b = box(4, 2, 1.5), meshes = [];
      // 150 boxes, each its surface and edges, turned and placed at random.
      for (let k = 0; k < 150; k++) {
        const T = turn(rand() * 6.28, rand() * 50 - 5, rand() * 50 - 5, rand() * 6);
        meshes.push(named(viewer.add(b.surface, { material: { color: '#a0a0a0' }, transform: T, cap: true }), 's' + k), named(viewer.add(b.edges, { material: { color: '#ffffff', unlit: true }, transform: T }), 'e' + k));
      }
      // One mesh of 60 instances, a two-sided open quad, a see-through box (hides nothing).
      named(viewer.add(box(2, 2, 2).surface, { instances: { transforms: Array.from({ length: 60 }, () => turn(rand() * 6.28, rand() * 50 - 5, rand() * 50 - 5, rand() * 6)).flat() }, cap: true }), 'inst');
      named(viewer.add({ positions: [0, 0, 8, 30, 0, 8, 30, 30, 8, 0, 30, 8], indices: [0, 1, 2, 0, 2, 3] }, { material: { doubleSided: true } }), 'quad');
      named(viewer.add(box(10, 10, 10).surface, { material: { opacity: 0.4 }, transform: turn(0, 20, 20, 3) }), 'glass');
      // Points: 100 000 through the scene, 50 small ones, 20 over the scene.
      const N = 100000, P = new Float32Array(3 * N); for (let i = 0; i < 3 * N; i += 3) { P[i] = rand() * 60 - 10; P[i + 1] = rand() * 60 - 10; P[i + 2] = rand() * 12; }
      named(viewer.add({ positions: P, topology: 'points' }, { material: { pointSize: 3, unlit: true } }), 'cloud');
      named(viewer.add({ positions: Array.from({ length: 150 }, () => rand() * 40), topology: 'points' }, { material: { pointSize: 8 } }), 'few');
      named(viewer.add({ positions: Array.from({ length: 60 }, () => rand() * 40), topology: 'points' }, { material: { pointSize: 6, lineOver: true } }), 'over');
      await viewer.frame();
      const pointers = Array.from({ length: 500 }, () => [rand() * 640, rand() * 480]);
      const key = h => h && { mesh: names.get(h.mesh), instance: h.instance ?? null, triangle: h.triangle ?? null, face: h.face ?? null, cap: h.cap ?? null, segment: h.segment ?? null, index: h.index ?? null, distance: h.distance ?? null };
      const run = () => {
        const out = { ray: [], line: [], point: [], ms: { ray: 0, line: 0, point: 0 } };
        let t0 = performance.now(); for (const [x, y] of pointers) out.ray.push(viewer.raycast(x, y)); out.ms.ray = performance.now() - t0;
        t0 = performance.now(); for (const [x, y] of pointers) out.line.push(viewer.pickLine(x, y, 6)); out.ms.line = performance.now() - t0;
        t0 = performance.now(); for (const [x, y] of pointers) out.point.push(viewer.pickPoint(x, y, 4)); out.ms.point = performance.now() - t0;
        return out;
      };
      const compare = (A, B) => {
        let diff = 0, hits = { ray: 0, line: 0, point: 0 }, worst = 0, first = null;
        for (const k of ['ray', 'line', 'point']) for (let i = 0; i < pointers.length; i++) {
          const a = A[k][i], b = B[k][i];
          if (a) hits[k]++;
          const same = JSON.stringify(key(a)) === JSON.stringify(key(b));
          const d = a && b ? Math.hypot(a.point[0] - b.point[0], a.point[1] - b.point[1], a.point[2] - b.point[2]) : 0;
          worst = Math.max(worst, d);
          if (!same || d > 1e-9) { diff++; first ??= { k, i, a: key(a), b: key(b), d }; }
        }
        return { diff, hits, worst, first };
      };
      const both = () => { viewer.accelerate = false; run(); const lin = run(); viewer.accelerate = true; run(); const acc = run(); return { cmp: compare(acc, lin), lin: lin.ms, acc: acc.ms }; };
      const plain = both();
      viewer.clipPlane = { normal: [0.6, 0.8, 0], offset: 25 }; await viewer.frame();
      const clipped = both();
      viewer.clipPlane = null;
      // Moved: every other box turned again, the instances replaced — the trees made again.
      for (let k = 0; k < meshes.length; k += 4) { const T = turn(rand() * 6.28, rand() * 50 - 5, rand() * 50 - 5, rand() * 6); meshes[k].transform = T; meshes[k + 1].transform = T; }
      await viewer.frame();
      const moved = both();
      viewer.dispose();
      return { plain, clipped, moved };
    });
    t.diagnostic(JSON.stringify(r));
    for (const [name, c] of Object.entries(r)) {
      assert.equal(c.cmp.diff, 0, `${name}: the trees' picks equal the walks' ${JSON.stringify(c.cmp.first)}`);
      assert.ok(c.cmp.hits.ray > 15 && c.cmp.hits.line > 25 && c.cmp.hits.point > 80, `${name}: the pointers find things ${JSON.stringify(c.cmp.hits)}`);
      assert.ok(c.cmp.worst <= 1e-9);
    }
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G11: see-through surfaces through the order-independent pass — the same frame whatever the order they are drawn in.
test('G11 order-independent transparency: two interpenetrating see-through boxes the same in either order (the sorted path not); one layer, outlined, over a capped cut, as the sorted path drew it; see-through lines over it', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box } = window, canvas = document.getElementById('c');
      canvas.style.width = '640px'; canvas.style.height = '480px';
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#101010', camera: { position: [6, -9, 7], target: [0, 0, 0], up: [0, 0, 1] } });
      const diff = (a, b) => { let n = 0, max = 0; for (let i = 0; i < a.data.length; i += 4) { const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]); if (d > 3) n++; if (d > max) max = d; } return { n, max }; };
      viewer.add(box(8, 8, 0.5).surface, { name: 'floor', material: { color: '#808080' }, transform: api.translation([0, 0, -2]) });
      // Two boxes through each other, the same centre (so the sort keeps the order they were added in), see-through.
      const A = () => viewer.add(box(5, 1.2, 1.2).surface, { name: 'A', material: { color: '#ff3020', opacity: 0.5 } });
      const B = () => viewer.add(box(1.2, 5, 1.2).surface, { name: 'B', material: { color: '#2060ff', opacity: 0.45 } });
      const shots = async () => {
        let a = A(), b = B(); await viewer.frame(); const ab = await viewer.capture(); viewer.remove(a); viewer.remove(b);
        b = B(); a = A(); await viewer.frame(); const ba = await viewer.capture(); viewer.remove(a); viewer.remove(b);
        return diff(ab, ba);
      };
      const oit = await shots();
      viewer.orderIndependent = false; const sorted = await shots(); viewer.orderIndependent = true;
      // One see-through layer, outlined, in front of an opaque box cut and capped by the clip plane; a see-through line over all.
      const solid = viewer.add(box(2, 2, 2).surface, { name: 'solid', material: { color: '#c0a060' }, cap: true, transform: api.translation([0, 2, 0]) });
      const glass = viewer.add(box(4, 0.4, 3).surface, { name: 'glass', material: { color: '#60c0ff', opacity: 0.35 }, transform: api.translation([0, -1.5, 0]) });
      glass.outline = '#ffcc00';
      viewer.add({ positions: [-3, -3, 1, 3, -3, 1], topology: 'lines' }, { material: { color: '#ffffff', unlit: true, lineWidth: 2, opacity: 0.8 } });
      viewer.clipPlane = { normal: [1, 0, 0], offset: 0.3 };
      await viewer.frame(); const one = await viewer.capture(), statsOit = { ...viewer.stats };
      viewer.orderIndependent = false; await viewer.frame(); const oneSorted = await viewer.capture(); viewer.orderIndependent = true;
      void solid;
      viewer.dispose();
      return { oit, sorted, single: diff(one, oneSorted), drawCalls: statsOit.drawCalls };
    });
    t.diagnostic(JSON.stringify(r));
    assert.equal(r.oit.n, 0, `either order the same frame ${JSON.stringify(r.oit)}`);
    assert.ok(r.sorted.n > 500, `the sorted path does depend on it (the test can tell) ${JSON.stringify(r.sorted)}`);
    assert.ok(r.single.n <= 50 && r.single.max <= 12, `one layer, its outline, the cap and a line over it as the sorted path drew them ${JSON.stringify(r.single)}`);
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// G15: text labels from a distance-field atlas — a chip at a screen size whatever the zoom, a plane label at a world size,
// edges a pixel wide when magnified, the depth rules of points; glyphs drawn once; a new font lays them out again.
test('G15 labels: a chip the same size at any zoom; a plane label scaling with it, its edges a pixel wide magnified; hidden, faint, over; each glyph drawn once; a font change', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    const r = await s.p.evaluate(async () => {
      const { api, box, screen, pixel } = window, canvas = document.getElementById('c');
      canvas.style.width = '640px'; canvas.style.height = '480px';
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#000000', camera: { position: [0, 0, 20], target: [0, 0, 0], up: [0, 1, 0] } });
      viewer.add(box(4, 4, 2).surface, { name: 'body', material: { color: '#606060' } });
      const bright = c => c[0] > 180 && c[1] > 180 && c[2] > 180;
      /** The bright pixels' box within a window round a screen point. */
      const extent = (img, [cx, cy], rw, rh) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0; for (let y = Math.max(0, Math.round(cy - rh)); y < Math.min(img.height, Math.round(cy + rh)); y++) for (let x = Math.max(0, Math.round(cx - rw)); x < Math.min(img.width, Math.round(cx + rw)); x++) if (bright(pixel(img, [x, y]))) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { n, w: x1 - x0 + 1, h: y1 - y0 + 1, x0, y0 }; };
      // A chip beside the box, 16 px text, a dark box with a gold border.
      // (Clear of the box at either distance: a screen label is depth-tested at its anchor, so a surface in front of the
      // anchor hides what of the label it covers.)
      const chip = viewer.addLabels([{ text: 'W 12.5 mm', at: [7, 0, 0], size: 16, color: '#ffffff', background: { color: '#121315', border: '#e8c25a', padding: 5 } }]);
      await viewer.frame();
      let img = await viewer.capture(); const at = screen(viewer, [7, 0, 0]);
      const near = extent(img, at, 70, 16);
      // (The chip's fill just inside its left edge, and its border: the text's left minus the padding.)
      const fill = pixel(img, [near.x0 - 3, at[1]]);
      let border = [0, 0, 0, 0]; for (let x = near.x0 - 9; x < near.x0 - 1; x++) { const c = pixel(img, [x, at[1]]); if (c[0] - c[2] > border[0] - border[2]) border = c; }
      // Three times as far: the chip the same size on screen.
      viewer.camera.position = [0, 0, 60]; await viewer.frame(); img = await viewer.capture();
      const far = extent(img, screen(viewer, [7, 0, 0]), 70, 16);
      // A plane label on the box's top, 1 unit high: its size follows the zoom.
      chip.visible = false;
      const plate = viewer.addLabels([{ text: 'PLATE', at: [0, 0, 1.01], size: 1, color: '#ffffff', plane: { right: [1, 0, 0], up: [0, 1, 0] } }]);
      viewer.camera.position = [0, 0, 20]; await viewer.frame(); img = await viewer.capture();
      const p20 = extent(img, screen(viewer, [0, 0, 1]), 160, 60);
      viewer.camera.position = [0, 0, 10]; await viewer.frame(); img = await viewer.capture();
      const p10 = extent(img, screen(viewer, [0, 0, 1]), 300, 120);
      // Magnified (the camera close to one on the black beside the box): across the row through the letters' middle, how
      // many pixels each edge takes.
      const big = viewer.addLabels([{ text: 'HI', at: [8, 8, 0], size: 1, color: '#ffffff', plane: { right: [1, 0, 0], up: [0, 1, 0] } }]);
      viewer.camera.position = [8, 8, 2]; viewer.camera.target = [8, 8, 0]; await viewer.frame(); img = await viewer.capture();
      const mid = screen(viewer, [8, 8, 0]); let edges = 0, soft = 0, run = 0;
      for (let x = 0; x < img.width; x++) { const v = pixel(img, [x, mid[1]])[0]; if (v > 40 && v < 215) run++; else { if (run) { edges++; soft = Math.max(soft, run); } run = 0; } }
      viewer.camera.position = [0, 0, 20]; viewer.camera.target = [0, 0, 0]; big.visible = false;
      // Under the box: hidden; faint where hidden; over the scene — against the box alone.
      plate.visible = false;
      await viewer.frame(); img = await viewer.capture();
      let bodyPeak = 0; for (let y = -8; y <= 8; y++) for (let x = -40; x <= 40; x++) bodyPeak = Math.max(bodyPeak, pixel(img, [screen(viewer, [0, 0, -3])[0] + x, screen(viewer, [0, 0, -3])[1] + y])[0]);
      const under = (o) => viewer.addLabels([{ text: 'HIDDEN', at: [0, 0, -3], size: 18, color: '#ffffff' }], { material: o });
      const tests = {};
      for (const [name, mat] of [['hidden', {}], ['faint', { lineHidden: 0.5 }], ['over', { lineOver: true }]]) {
        const m = under(mat); await viewer.frame(); img = await viewer.capture();
        const e = extent(img, screen(viewer, [0, 0, -3]), 60, 14); let peak = 0;
        for (let y = -8; y <= 8; y++) for (let x = -40; x <= 40; x++) { const c = pixel(img, [screen(viewer, [0, 0, -3])[0] + x, screen(viewer, [0, 0, -3])[1] + y]); peak = Math.max(peak, c[0]); }
        tests[name] = { bright: e.n, peak }; m.remove();
      }
      // Glyphs drawn once each: 'W 12.5 mm', 'PLATE', 'HIDDEN' — their distinct characters.
      const glyphs = viewer.atlas.fields.length, distinct = new Set('W 12.5 mmPLATEHIHIDDEN').size;
      // A new font: every label laid out again.
      viewer.labelFont = "bold serif"; chip.visible = true; await viewer.frame(); img = await viewer.capture();
      const refont = extent(img, screen(viewer, [7, 0, 0]), 70, 16);
      viewer.dispose();
      return { near, far, fill, border, p20, p10, edges, soft, tests, bodyPeak, glyphs, distinct, refont };
    });
    t.diagnostic(JSON.stringify(r));
    assert.ok(r.near.n > 80 && r.near.h >= 9 && r.near.h <= 16, `the chip's text at 16 px ${JSON.stringify(r.near)}`);
    assert.ok(Math.abs(r.far.w - r.near.w) <= 2 && Math.abs(r.far.h - r.near.h) <= 2, `the same size three times as far ${JSON.stringify([r.near, r.far])}`);
    assert.ok(r.fill.slice(0, 3).every(v => v < 40), `the chip's fill dark ${JSON.stringify(r.fill)}`);
    assert.ok(r.border[0] > 120 && r.border[1] > 90 && r.border[2] < 90, `its border gold ${JSON.stringify(r.border)}`);
    assert.ok(Math.abs(r.p10.w / r.p20.w - 2) < 0.25, `a plane label twice as wide twice as near ${JSON.stringify([r.p20, r.p10])}`);
    assert.ok(r.edges >= 3 && r.soft <= 2, `magnified about 20 times, each edge at most 2 pixels soft ${JSON.stringify([r.edges, r.soft])}`);
    assert.ok(r.tests.hidden.bright === 0 && r.tests.hidden.peak <= r.bodyPeak + 2, `under the box: hidden ${JSON.stringify([r.tests, r.bodyPeak])}`);
    assert.ok(r.tests.faint.peak > r.bodyPeak + 30 && r.tests.faint.peak < r.tests.over.peak - 20, `faint where hidden ${JSON.stringify([r.tests, r.bodyPeak])}`);
    assert.ok(r.tests.over.bright > 40, `over the scene ${JSON.stringify(r.tests)}`);
    assert.equal(r.glyphs, r.distinct, 'each character drawn once');
    assert.ok(r.refont.n > 80, `a new font, laid out again ${JSON.stringify(r.refont)}`);
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});

// The review ray sees the cube's original front at t=5, before the same mesh's cap at t=6.
// Read actual WebGPU id/depth/instance targets, including the triangle, face and scalar reconstruction.
test('G20 pick readback: a kept quarter-cutout front wins over its own rear cap, with and without instances', { timeout: 120000 }, async t => {
  const s = await open(t); if (!s) return;
  try {
    t.diagnostic(`adapter: ${s.adapter}`);
    const rows = await s.p.evaluate(async () => {
      const { api, box, screen } = window, canvas = document.getElementById('c');
      canvas.style.width = '321px'; canvas.style.height = '241px';
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, antialias: false, camera: { position: [-6, 1.65, 0], target: [0, -0.15, 0], up: [0, 0, 1], projection: 'perspective', fovY: 32 } });
      const mesh = viewer.add(box(2, 2, 2).surface, { cap: true });
      mesh.geometry.setScalars(Array(mesh.geometry.data.vertexCount).fill(7), 'vertex');
      const rows = [];
      for (const instanced of [false, true]) {
        const shift = instanced ? 3 : 0;
        mesh.setInstances(instanced ? { transforms: [...api.translation([30, 0, 0]), ...api.translation([shift, 0, 0])] } : null);
        viewer.camera.position = [-6 + shift, 1.65, 0]; viewer.camera.target = [shift, -0.15, 0];
        viewer.clipCutout = true;
        viewer.clipPlanes = [{ normal: [1, 0, 0], offset: shift }, { normal: [0, 1, 0], offset: 0 }];
        await viewer.frame();
        for (const [name, target] of [['front', [-1 + shift, 0.15, 0]], ['cap', [shift, -0.5, 0]]]) {
          const [x, y] = screen(viewer, target), px = Math.floor(x) + 0.5, py = Math.floor(y) + 0.5;
          const cpu = viewer.raycast(px, py), gpu = await viewer.pick(px, py);
          const fields = h => h && ({ cap: h.cap, plane: h.capPlane, triangle: h.triangle, face: h.face, scalar: h.scalar, instance: h.instance, point: h.point });
          rows.push({ name, instanced, cpu: fields(cpu), gpu: fields(gpu) });
        }
      }
      viewer.dispose(); return rows;
    });
    t.diagnostic(JSON.stringify(rows));
    for (const row of rows) {
      assert.ok(row.cpu && row.gpu, JSON.stringify(row));
      assert.equal(row.gpu.instance, row.instanced ? 1 : null);
      for (const field of ['cap', 'plane', 'triangle', 'face']) assert.equal(row.gpu[field], row.cpu[field], `${row.name} ${field}`);
      assert.ok(Math.hypot(...row.gpu.point.map((v, i) => v - row.cpu.point[i])) < 1e-4, JSON.stringify(row));
      assert.equal(row.gpu.cap, row.name === 'cap');
      if (row.name === 'front') { assert.equal(row.gpu.triangle, 2); assert.equal(row.gpu.face, 1); assert.ok(Math.abs(row.gpu.scalar - 7) < 1e-5); }
      else { assert.equal(row.gpu.triangle, null); assert.equal(row.gpu.scalar, undefined); }
    }
    assert.deepEqual(s.errors, []);
  } finally { await s.close(); }
});
