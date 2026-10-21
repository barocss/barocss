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
  await new Promise(r => server.listen(0, '127.0.0.1', r));
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
