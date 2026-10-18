// The viewer's CPU side: matrices and reversed depth, camera clip/fit/rays, orbit/pan/zoom, frustum
// culling, geometry preparation and ray picking, and the frame block layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { identity, invert, lookAt, multiply, orthographicReversed, perspectiveReversed, rotation, transformPoint, translation } from '../dist/viewer/math.js';
import { Camera } from '../dist/viewer/camera.js';
import { orbit, pan, zoom } from '../dist/viewer/controls.js';
import { boxInFrustum, frustumPlanes, screenRect, transformBox } from '../dist/viewer/bounds.js';
import { fillVertexColors, nearestSegment, prepareGeometry, rayTriangles, segmentInstances, vertexColors } from '../dist/viewer/geometry.js';
import { packFrame, packOutput, parseColor } from '../dist/viewer/lights.js';
import { FRAME_BYTES, MAX_DIRECTIONAL, MAX_POINT, surfaceWGSL } from '../dist/viewer/shaders.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));
const close = (a, b, eps = 1e-9) => a.every((x, i) => near(x, b[i], eps));
const clipZ = (m, p) => { const q = [0, 1, 2, 3].map(r => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]); return q[2] / q[3]; };

test('viewer math: reversed depth maps near to 1 and far toward 0; inverse and look-at agree', () => {
  const P = perspectiveReversed(Math.PI / 3, 1.5, 0.1);
  assert.ok(near(clipZ(P, [0, 0, -0.1]), 1));
  assert.ok(near(clipZ(P, [0, 0, -1e9]), 0, 1e-6));
  assert.ok(clipZ(P, [0, 0, -10]) > clipZ(P, [0, 0, -20]), 'nearer is larger');
  const O = orthographicReversed(2, 1, -5, 15);
  assert.ok(near(clipZ(O, [0, 0, 5]), 1) && near(clipZ(O, [0, 0, -15]), 0));
  const V = lookAt([3, -4, 5], [0, 0, 0], [0, 0, 1]);
  assert.ok(close(transformPoint(V, [0, 0, 0]), [0, 0, -Math.hypot(3, 4, 5)], 1e-12));
  const M = multiply(translation([1, 2, 3]), rotation([0, 0, 1], 0.7));
  assert.ok(close(multiply(M, invert(M)), identity(), 1e-12));
});

test('viewer camera: clip planes hug the scene; fit frames a box; rays pass through the pixel', () => {
  const cam = new Camera({ position: [0, -10, 0], target: [0, 0, 0], up: [0, 0, 1], fovY: 40 });
  cam.clip({ min: [-1, -1, -1], max: [1, 1, 1] });
  assert.ok(cam.near > 8 && cam.near < 9 && cam.far === Infinity, `${cam.near} ${cam.far}`);
  // Inside the box the near plane gets small but stays positive.
  cam.position = [0, 0, 0.5]; cam.target = [0, 0, 0]; cam.clip({ min: [-1, -1, -1], max: [1, 1, 1] });
  assert.ok(cam.near > 0 && cam.near < 1e-3);
  cam.position = [0, -10, 0]; cam.target = [0, 0, 0];
  cam.fit({ min: [10, 10, 10], max: [12, 14, 11] }, 1.5);
  assert.ok(close(cam.target, [11, 12, 10.5]));
  // Every corner of the box lands inside the view.
  const vp = cam.viewProjection(1.5);
  cam.clip({ min: [10, 10, 10], max: [12, 14, 11] });
  for (let i = 0; i < 8; i++) {
    const p = [i & 1 ? 12 : 10, i & 2 ? 14 : 10, i & 4 ? 11 : 10], q = [0, 1, 2, 3].map(r => vp[r] * p[0] + vp[4 + r] * p[1] + vp[8 + r] * p[2] + vp[12 + r]);
    assert.ok(Math.abs(q[0] / q[3]) <= 1 && Math.abs(q[1] / q[3]) <= 1, JSON.stringify(q));
  }
  // The ray through the centre runs down the view; one through a corner reaches that point.
  const r = cam.ray(0, 0, 1.5);
  assert.ok(close(r.direction, cam.basis().forward, 1e-9));
  const P = [11.5, 13, 10.8], v = cam.viewProjection(1.5), c = [0, 1, 3].map(k => v[k] * P[0] + v[4 + k] * P[1] + v[8 + k] * P[2] + v[12 + k]);
  const ray = cam.ray(c[0] / c[2], c[1] / c[2], 1.5), to = P.map((x, i) => x - ray.origin[i]), l = Math.hypot(...to);
  assert.ok(close(to.map(x => x / l), ray.direction, 1e-9));
  // Orthographic: parallel rays, and the same view height at the target as the perspective view.
  cam.projection = 'orthographic';
  const a = cam.ray(-0.5, 0.2, 1.5), b = cam.ray(0.7, -0.9, 1.5);
  assert.ok(close(a.direction, b.direction, 1e-9));
});

test('viewer controls: orbit keeps the distance and stops at the poles; pan moves both; zoom keeps the cursor point', () => {
  const cam = new Camera({ position: [0, -10, 0], target: [1, 2, 3], up: [0, 0, 1] });
  cam.position = [1, -8, 3];
  const d = cam.distance;
  orbit(cam, 0.6, -0.3);
  assert.ok(near(cam.distance, d, 1e-12));
  orbit(cam, 0, 10); // drag down: over the top
  const o = cam.position.map((x, i) => x - cam.target[i]);
  assert.ok(o[2] / Math.hypot(...o) > 0.999 && o[2] / Math.hypot(...o) < 1, 'stops short of the pole');
  const before = [...cam.target];
  cam.position = [1, -8, 3];
  pan(cam, 100, 0, 500);
  assert.ok(near(cam.distance, 10, 1e-12) && cam.target[0] < before[0], 'drag right moves the view left');
  const cam2 = new Camera({ position: [0, -10, 0], target: [0, 0, 0], up: [0, 0, 1] });
  const P = [2, 0, 1], v = cam2.viewProjection(1), proj = p => { const q = [0, 1, 3].map(k => v[k] * p[0] + v[4 + k] * p[1] + v[8 + k] * p[2] + v[12 + k]); return [q[0] / q[2], q[1] / q[2]]; };
  const s0 = proj(P);
  zoom(cam2, 0.5, P);
  const v2 = cam2.viewProjection(1), q = [0, 1, 3].map(k => v2[k] * P[0] + v2[4 + k] * P[1] + v2[8 + k] * P[2] + v2[12 + k]);
  assert.ok(close([q[0] / q[2], q[1] / q[2]], s0, 1e-9), 'the point stays under the cursor');
  assert.ok(near(cam2.distance, 5, 1e-12));
});

test('viewer bounds: frustum keeps boxes in view and drops ones behind or aside', () => {
  const cam = new Camera({ position: [0, -10, 0], target: [0, 0, 0], up: [0, 0, 1], fovY: 40 });
  cam.clip({ min: [-50, -50, -50], max: [50, 50, 50] });
  const planes = frustumPlanes(cam.viewProjection(1));
  const box = c => ({ min: c.map(x => x - 0.5), max: c.map(x => x + 0.5) });
  assert.ok(boxInFrustum(planes, box([0, 0, 0])));
  assert.ok(boxInFrustum(planes, box([0, 1000, 0])), 'far away in front (infinite far plane)');
  assert.ok(!boxInFrustum(planes, box([0, -20, 0])), 'behind the camera');
  assert.ok(!boxInFrustum(planes, box([30, 0, 0])), 'off to the side');
  const t = transformBox(rotation([0, 0, 1], Math.PI / 4), { min: [-1, -1, 0], max: [1, 1, 1] });
  assert.ok(near(t.max[0], Math.SQRT2, 1e-12) && near(t.min[1], -Math.SQRT2, 1e-12));
});

test('viewer geometry: checks its input, computes normals, picks the nearest triangle', () => {
  assert.throws(() => prepareGeometry({ positions: [0, 0, 0, 1, 0] }), /three numbers/);
  assert.throws(() => prepareGeometry({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 3] }), /not a vertex/);
  assert.throws(() => prepareGeometry({ positions: [0, 0, 0, 1, 0, 0], topology: 'lines', indices: [0, 1, 1] }), /multiple of 2/);
  assert.throws(() => prepareGeometry({ positions: [0, 0, NaN] }), /finite/);
  // Two stacked squares; normals point up; a ray from above hits the upper one.
  const quad = z => [0, 0, z, 1, 0, z, 1, 1, z, 0, 1, z];
  const g = prepareGeometry({ positions: [...quad(0), ...quad(1)], indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7], colors: Array(8 * 3).fill(0.5) });
  assert.ok(g.indices instanceof Uint16Array && g.normals[2] === 1 && g.normals[23] === 1);
  assert.equal(g.colors[0], Math.round(((0.5 + 0.055) / 1.055) ** 2.4 * 255), 'colours stored linear');
  const hit = rayTriangles(g, [0.7, 0.2, 5], [0, 0, -1]);
  assert.ok(hit && hit.triangle === 2 && near(hit.t, 4), JSON.stringify(hit));
  assert.equal(rayTriangles(g, [5, 5, 5], [0, 0, -1]), null);
  assert.deepEqual(g.bounds, { min: [0, 0, 0], max: [1, 1, 1] });
  // Texture coordinates: two per vertex, zeros when left out.
  assert.throws(() => prepareGeometry({ positions: quad(0), indices: [0, 1, 2, 0, 2, 3], uvs: [0, 0, 1] }), /two numbers per vertex/);
  assert.deepEqual([...prepareGeometry({ positions: quad(0), indices: [0, 1, 2, 0, 2, 3] }).uvs], [0, 0, 0, 0, 0, 0, 0, 0]);
  // A face id per triangle.
  assert.throws(() => prepareGeometry({ positions: quad(0), indices: [0, 1, 2, 0, 2, 3], faces: [7] }), /one id per triangle/);
  assert.deepEqual([...prepareGeometry({ positions: quad(0), indices: [0, 1, 2, 0, 2, 3], faces: [7, 7] }).faces], [7, 7]);
  // Lines: an id per segment; segment instances hold both ends and their colours.
  assert.throws(() => prepareGeometry({ positions: quad(0), indices: [0, 1, 1, 2], topology: 'lines', edges: [1] }), /one id per segment/);
  const lines = prepareGeometry({ positions: quad(0), indices: [0, 1, 2, 3], topology: 'lines', edges: [4, 5], colors: [1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1] });
  const inst = segmentInstances(lines), f = new Float32Array(inst), u8 = new Uint8Array(inst);
  assert.deepEqual([...f.slice(8, 14)], [1, 1, 0, 0, 1, 0]);
  assert.deepEqual([...u8.slice(24, 32)], [255, 0, 0, 255, 0, 255, 0, 255]);
  assert.deepEqual([...lines.edges], [4, 5]);
});

test('viewer lights: the frame block matches the WGSL layout', () => {
  assert.equal(FRAME_BYTES, 992);
  assert.match(surfaceWGSL(), new RegExp(`dirs: array<DirLight, ${MAX_DIRECTIONAL}>`));
  // A shader material: its declarations, aliases and expression; the default params struct unless it declares one.
  const custom = surfaceWGSL({ declarations: 'fn f(x: f32) -> f32 { return x; }\n', expression: 'vec3f(f(native_uv.x))', aliases: { native_uv: 'uv' } });
  assert.match(custom, /let native_uv = uv;\n  return vec3f\(f\(native_uv.x\)\);/);
  assert.equal((custom.match(/struct MaterialParams/g) ?? []).length, 1);
  assert.equal((surfaceWGSL({ declarations: 'struct MaterialParams {\n  slot: array<vec4<f32>, 4>,\n}\n', expression: 'vec3f(1.0)' }).match(/struct MaterialParams/g) ?? []).length, 1);
  const cam = new Camera({ position: [0, -10, 0], target: [0, 0, 0], up: [0, 0, 1] });
  const f = packFrame(cam.viewProjection(1), cam, [
    { kind: 'directional', direction: [0, 0, -2], intensity: 3, color: '#ffffff' },
    { kind: 'point', position: [1, 2, 3], range: 9, color: [1, 0, 0] },
    { kind: 'spot', position: [0, 0, 5], direction: [0, 0, -1], angle: 30, penumbra: 0 },
  ], { exposure: 1.5, toneMapping: 'aces' });
  const u = new Uint32Array(f.buffer);
  assert.deepEqual([...u.slice(36, 40)], [1, 1, 1, 0]);
  assert.ok(close([...f.slice(40, 48)], [0, 0, -1, 0, 1, 1, 1, 3], 1e-6));
  const p = 40 + MAX_DIRECTIONAL * 8, s = p + MAX_POINT * 8;
  assert.ok(close([...f.slice(p, p + 8)], [1, 2, 3, 9, 1, 0, 0, 1], 1e-6));
  assert.ok(f[s + 12] > f[s + 13], 'inner cone cosine above the outer');
  assert.ok(f[16 + 3] === 1, 'perspective flag');
  const out = packOutput({ exposure: 1.5, toneMapping: 'aces' });
  assert.ok(new Float32Array(out, 0, 1)[0] === 1.5 && new Uint32Array(out, 4, 1)[0] === 1);
  // The shadow-casting light: its index + 1 in counts.w and its view-projection after the spots.
  const vp = cam.viewProjection(1), sh = packFrame(vp, cam, [{ kind: 'directional', direction: [0, 0, -1] }, { kind: 'directional', direction: [1, 0, -1], castShadow: true }], {}, { viewProjection: vp, normalOffset: 0.1, texel: 1 / 1024, bias: 0.001 });
  assert.equal(new Uint32Array(sh.buffer)[39], 2);
  assert.ok(close([...sh.slice(200, 216)], [...vp], 1e-6) && near(sh[216], 0.1, 1e-6));
  assert.equal(new Uint32Array(packFrame(vp, cam, [{ kind: 'directional', direction: [0, 0, -1], castShadow: true }], {}).buffer)[39], 0, 'no shadow frame, no shadow');
  // The grid: the inverse view-projection, then cell, major, fade, height and colour after the viewport.
  const gf = packFrame(vp, cam, [], {}, null, [640, 480, 2], { cell: 1, major: 10, fade: 60, height: 0, color: [1, 1, 1], opacity: 0.5 });
  assert.ok(close([...gf.slice(220, 224)], [640, 480, 2, 0]));
  assert.ok(close([...gf.slice(240, 248)], [1, 10, 60, 0, 1, 1, 1, 0.5], 1e-6));
  assert.deepEqual(parseColor('#f80'), [1, 0x88 / 255, 0]);
  assert.throws(() => parseColor('red'), /hex/);
});

test('ray picking on a large mesh (through its hierarchy) finds what a test of every triangle finds', () => {
  // A wavy 60 × 60 sheet (7200 triangles) and rays from every side.
  const N = 60, P = [], I = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) P.push(i, j, 3 * Math.sin(i * 0.3) * Math.cos(j * 0.25));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; I.push(a, a + 1, a + N + 2, a, a + N + 2, a + N + 1); }
  const g = prepareGeometry({ positions: P, indices: I });
  const brute = (o, d) => {
    let best = null;
    for (let t = 0; t < I.length / 3; t++) {
      const v = k => [P[3 * I[3 * t + k]], P[3 * I[3 * t + k] + 1], P[3 * I[3 * t + k] + 2]], [a, b, c] = [v(0), v(1), v(2)];
      const e1 = b.map((x, k) => x - a[k]), e2 = c.map((x, k) => x - a[k]), cr = (x, y) => [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]], dt = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
      const p = cr(d, e2), det = dt(e1, p); if (Math.abs(det) < 1e-20) continue;
      const s = o.map((x, k) => x - a[k]), u = dt(s, p) / det; if (u < -1e-7 || u > 1 + 1e-7) continue;
      const q = cr(s, e1), w = dt(d, q) / det; if (w < -1e-7 || u + w > 1 + 1e-7) continue;
      const dist = dt(e2, q) / det; if (dist > 0 && (!best || dist < best.t)) best = { triangle: t, t: dist };
    }
    return best;
  };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 200; k++) {
    const o = [rnd() * 80 - 10, rnd() * 80 - 10, rnd() < 0.5 ? 20 : -20], target = [rnd() * N, rnd() * N, 0], d = target.map((x, i) => x - o[i]);
    const got = rayTriangles(g, o, d), want = brute(o, d);
    assert.equal(got?.triangle ?? null, want?.triangle ?? null, `ray ${k}`);
    if (want) assert.ok(Math.abs(got.t - want.t) < 1e-4, `${got.t} vs ${want.t}`); // (the geometry holds float32 positions)
  }
  // Along an axis (zero direction components), and missing the sheet's box altogether.
  assert.equal(rayTriangles(g, [10.3, 20.6, 50], [0, 0, -1])?.triangle, brute([10.3, 20.6, 50], [0, 0, -1])?.triangle);
  assert.equal(rayTriangles(g, [100, 100, 50], [0, 0, -1]), null);
});

test('vertex colours: a range filled in place is the bytes a whole conversion gives; a run of one colour converted once is the same as per vertex', () => {
  const n = 12, c = [];
  for (let v = 0; v < n; v++) c.push(...(v >= 4 && v < 9 ? [0.9, 0.3, 0.1] : [0.5, 0.5, 0.5]));
  const whole = vertexColors(c, n), part = vertexColors(Array(3 * n).fill(0.5), n);
  fillVertexColors(part, 4, 5, [0.9, 0.3, 0.1]);
  assert.deepEqual(part, whole);
  const lin = x => Math.round((x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)) * 255);
  assert.deepEqual([...whole.slice(16, 20)], [lin(0.9), lin(0.3), lin(0.1), 255]);
  fillVertexColors(part, 0, 1, [1, 1, 1, 0.5]); assert.equal(part[3], 128);
  assert.throws(() => fillVertexColors(part, 10, 3, [1, 1, 1]), /not within/);
  assert.throws(() => fillVertexColors(part, 0, 1, [1]), /three or four/);
});

test('nearest segment: the same segment, distance and parameter as the walk over every segment, on a small and a large geometry, with segments behind the eye; ties to the lowest', () => {
  // The walk the viewer's pickLine had (before the segment hierarchy), as the reference.
  const walk = (g, M, x, y, cw, ch, radius) => {
    const P = g.positions, I = g.indices, clip = i => { const px = P[3 * i], py = P[3 * i + 1], pz = P[3 * i + 2]; return [M[0] * px + M[4] * py + M[8] * pz + M[12], M[1] * px + M[5] * py + M[9] * pz + M[13], M[3] * px + M[7] * py + M[11] * pz + M[15]]; };
    let best = null;
    for (let sgm = 0; sgm < g.elementCount / 2; sgm++) {
      const ia = I ? I[2 * sgm] : 2 * sgm, ib = I ? I[2 * sgm + 1] : 2 * sgm + 1;
      let a = clip(ia), b = clip(ib), s0 = 0, s1 = 1; const eps = 1e-6;
      if (a[2] < eps && b[2] < eps) continue;
      if (a[2] < eps) { const k = (eps - a[2]) / (b[2] - a[2]); a = a.map((v, j) => v + (b[j] - v) * k); s0 = k; }
      if (b[2] < eps) { const k = (eps - b[2]) / (a[2] - b[2]); b = b.map((v, j) => v + (a[j] - v) * k); s1 = 1 - k; }
      const sx = c => (c[0] / c[2] * 0.5 + 0.5) * cw, sy = c => (0.5 - c[1] / c[2] * 0.5) * ch;
      const ax = sx(a), ay = sy(a), dx = sx(b) - ax, dy = sy(b) - ay, l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
      const dist = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
      if (dist > radius || (best && dist >= best.distance)) continue;
      const u = (t * a[2]) / ((1 - t) * b[2] + t * a[2] || 1);
      best = { segment: sgm, distance: dist, s: s0 + (s1 - s0) * u };
    }
    return best;
  };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // A grid of segments sharing end points (ties at every vertex), and loose random ones, some through the eye's plane.
  const pos = [], idx = [];
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) pos.push(i * 2 - 24, j * 2 - 24, Math.sin(i + j));
  for (let i = 0; i <= 24; i++) for (let j = 0; j < 24; j++) { idx.push(i * 25 + j, i * 25 + j + 1); idx.push(j * 25 + i, (j + 1) * 25 + i); }
  for (let k = 0; k < 200; k++) { const b = pos.length / 3; pos.push(rnd() * 60 - 30, rnd() * 60 - 30, rnd() * 140 - 70, rnd() * 60 - 30, rnd() * 60 - 30, rnd() * 140 - 70); idx.push(b, b + 1); }
  const big = prepareGeometry({ positions: pos, indices: idx, topology: 'lines' }), small = prepareGeometry({ positions: pos, indices: idx.slice(0, 2 * 40), topology: 'lines' });
  assert.ok(big.elementCount / 2 >= 256);
  const cw = 800, ch = 600; let hits = 0, behind = 0;
  for (const eye of [[0, -10, 60], [5, 3, 30], [0, 0, 2]]) {
    const M = multiply(perspectiveReversed(Math.PI / 3, cw / ch, 0.1), lookAt(eye, [0, 0, 0], [0, 1, 0]));
    for (const g of [big, small]) for (let q = 0; q < 400; q++) {
      // (Every fourth point on a projected grid vertex: exact ties between the segments that meet there.)
      let x = rnd() * cw, y = rnd() * ch;
      if (q % 4 === 0) { const v = Math.floor(rnd() * 625), p = transformPoint(M, [pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]]); x = (p[0] * 0.5 + 0.5) * cw; y = (0.5 - p[1] * 0.5) * ch; }
      const want = walk(g, M, x, y, cw, ch, 12), got = nearestSegment(g, M, x, y, cw, ch, 12);
      assert.deepEqual(got, want, `eye ${eye} at ${x}, ${y}`);
      if (want) { hits++; if (want.s > 0 && want.s < 1 && eye[2] === 2) behind++; }
      if (want) assert.equal(nearestSegment(g, M, x, y, cw, ch, 12, want.distance), null); // another mesh as near wins
    }
  }
  assert.ok(hits > 1000 && behind > 50, `${hits} hits, ${behind} with the eye among the segments`);
});

test('outline reach: a box\'s screen rectangle holds every point of it the camera sees; a corner behind the eye leaves it unbounded; the output block carries it last', () => {
  const vp = multiply(perspectiveReversed(Math.PI / 3, 1.5, 0.1), lookAt([30, -40, 25], [0, 0, 0], [0, 0, 1])), w = 1200, h = 800;
  const box = { min: [-5, -3, 0], max: [8, 4, 6] }, r = screenRect(vp, [box], w, h);
  assert.ok(r && r[0] < r[2] && r[1] < r[3]);
  for (let i = 0; i < 200; i++) {
    const p = [0, 1, 2].map(k => box.min[k] + (box.max[k] - box.min[k]) * ((i * [0.618, 0.414, 0.732][k]) % 1)), c = [0, 1, 2, 3].map(q => vp[q] * p[0] + vp[4 + q] * p[1] + vp[8 + q] * p[2] + vp[12 + q]);
    const sx = (c[0] / c[3] * 0.5 + 0.5) * w, sy = (0.5 - c[1] / c[3] * 0.5) * h;
    assert.ok(sx >= r[0] - 1e-9 && sx <= r[2] + 1e-9 && sy >= r[1] - 1e-9 && sy <= r[3] + 1e-9, `point ${i}`);
  }
  // The eye inside the box: a corner behind it.
  assert.equal(screenRect(vp, [{ min: [20, -50, 0], max: [40, -30, 30] }], w, h), null);
  const u = new Float32Array(packOutput({}, [[1, 0, 0]], 2, null, null, [10, 20, 30, 40]));
  assert.deepEqual([...u.slice(-4)], [10, 20, 30, 40]);
  assert.deepEqual([...new Float32Array(packOutput({}, [[1, 0, 0]])).slice(-4)], [-1e9, -1e9, 1e9, 1e9]);
});
