// The viewer's CPU side: matrices and reversed depth, camera clip/fit/rays, orbit/pan/zoom, frustum
// culling, geometry preparation and ray picking, and the frame block layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { identity, invert, lookAt, multiply, orthographicReversed, perspectiveReversed, rotation, transformPoint, translation } from '../dist/viewer/math.js';
import { Camera } from '../dist/viewer/camera.js';
import { orbit, pan, zoom } from '../dist/viewer/controls.js';
import { boxInFrustum, frustumPlanes, screenRect, transformBox } from '../dist/viewer/bounds.js';
import { clippedRay, clippedRayFull, fillVertexColors, keptBy, localPlane, nearestSegment, prepareGeometry, prepareScalars, rayTriangles, regionEntry, segmentInstances, vertexColors } from '../dist/viewer/geometry.js';
import { packFrame, packOutput, parseColor, whiteBalance } from '../dist/viewer/lights.js';
import { FRAME_BYTES, MAX_CLIP_PLANES, MAX_DIRECTIONAL, MAX_POINT, surfaceWGSL } from '../dist/viewer/shaders.js';
import { clipBox, Viewer } from '../dist/viewer/viewer.js';
import { studioEnvironment, STUDIO_ENVIRONMENTS } from '../dist/viewer/studio-env.js';

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
  // (G13: none given, none kept — the viewer binds its shared zeros for them.)
  assert.equal(prepareGeometry({ positions: quad(0), indices: [0, 1, 2, 0, 2, 3] }).uvs, null);
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
  assert.equal(FRAME_BYTES, 1104);
  assert.match(surfaceWGSL(), new RegExp(`dirs: array<DirLight, ${MAX_DIRECTIONAL}>`));
  // A shader material: its declarations, aliases and expression; the default params struct unless it declares one.
  const custom = surfaceWGSL({ declarations: 'fn f(x: f32) -> f32 { return x; }\n', expression: 'vec3f(f(native_uv.x))', aliases: { native_uv: 'uv' } });
  assert.match(custom, /let native_uv = uv;\n {2}return vec3f\(f\(native_uv.x\)\);/);
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
  // G2, G19: the caps' colour (linear) and the number of planes, then the planes (normal, offset) last; none: zeros.
  const cf = packFrame(vp, cam, [], {}, null, [1, 1, 1], null, { normal: [0, 1, 0], offset: 2.5, cap: [1, 1, 1], planes: [{ normal: [0, 1, 0], offset: 2.5 }] });
  assert.ok(close([...cf.slice(248, 256)], [1, 1, 1, 1, 0, 1, 0, 2.5], 1e-6));
  const two = packFrame(vp, cam, [], {}, null, [1, 1, 1], null, { normal: [0, 1, 0], offset: 2.5, cap: [1, 1, 1], planes: [{ normal: [0, 1, 0], offset: 2.5 }, { normal: [-1, 0, 0], offset: -4 }] });
  assert.ok(close([...two.slice(248, 260)], [1, 1, 1, 2, 0, 1, 0, 2.5, -1, 0, 0, -4], 1e-6));
  assert.deepEqual([...packFrame(vp, cam, [], {}).slice(248, 276)], new Array(28).fill(0));
  assert.equal(FRAME_BYTES, 4 * (252 + 4 * MAX_CLIP_PLANES));
  assert.match(surfaceWGSL(), new RegExp(`clipColor: vec4f,\\n  clips: array<vec4f, ${MAX_CLIP_PLANES}>,\\n}`));
});

test('G15b studio environments: equirectangular RGBA, overhead brighter than below, the softbox room dark with its key the brightest; the cyclorama bright all round', () => {
  for (const kind of STUDIO_ENVIRONMENTS) {
    const e = studioEnvironment(kind, 256);
    assert.equal(e.width, 256); assert.equal(e.height, 128); assert.equal(e.data.length, 256 * 128 * 4);
    assert.ok(e.data.every((v, i) => i % 4 !== 3 || v === 255), `${kind}: opaque`);
  }
  const s = studioEnvironment('softbox', 256), at = (e, az, el) => { const x = Math.floor(((az + 180) / 360) * e.width), y = Math.floor(((90 - el) / 180) * e.height); return e.data[(y * e.width + x) * 4]; };
  assert.equal(at(s, -120, 50), 255, 'the key: full white');
  assert.ok(at(s, 60, 10) < 60 && at(s, 0, -45) < 50, 'the room dark between its panels');
  assert.ok(at(s, 90, 30) > 200, 'the strip behind');
  const c = studioEnvironment('cyclorama', 256);
  assert.ok(at(c, 45, 20) > 190 && at(c, 45, -20) > 140 && at(c, 45, -80) < at(c, 45, -10), 'the backdrop bright, the cove into the floor');
});

test('G2 the clip plane on the CPU: a ray finds the nearest hit on the kept side, a back face through the cut; a segment only its kept part', () => {
  // A 2 × 2 × 2 box at the origin (outward faces), a ray down −z from above at (0.3, 0.2).
  const P = [], I = [];
  for (const [axis, s] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3, base = P.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = [0, 0, 0]; q[axis] = s; q[u] = a; q[v] = b * s; P.push(...q); }
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = prepareGeometry({ positions: P, indices: I }), o = [0.3, 0.2, 5], d = [0, 0, -1];
  const plain = rayTriangles(g, o, d);
  assert.ok(near(plain.t, 4) && !plain.back, 'the top, from outside');
  // Kept below z = 0.5 (n = −z, d = −0.5): the top is cut away; the ray meets the bottom from inside.
  const cut = rayTriangles(g, o, d, [0, 0, -1, -0.5]);
  assert.ok(near(cut.t, 6) && cut.back, JSON.stringify(cut));
  // Kept above z = 0.5: the top as before. Kept beyond the box: nothing.
  assert.ok(near(rayTriangles(g, o, d, [0, 0, 1, 0.5]).t, 4));
  assert.equal(rayTriangles(g, o, d, [0, 0, 1, 2]), null);
  // On a large mesh (through its hierarchy) the plane gives what every triangle tested against it gives.
  const n = 60, LP = [], LI = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) LP.push(i / n * 10 - 5, j / n * 10 - 5, Math.sin(i * 0.4) * Math.cos(j * 0.3));
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; LI.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1); }
  const big = prepareGeometry({ positions: LP, indices: LI });
  let seed = 3; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // (Each triangle on its own, prepared once: its three corners.)
  const ones = Array.from({ length: LI.length / 3 }, (_, t) => prepareGeometry({ positions: LI.slice(3 * t, 3 * t + 3).flatMap(v => LP.slice(3 * v, 3 * v + 3)) }));
  for (let k = 0; k < 60; k++) {
    const ro = [rand() * 12 - 6, rand() * 12 - 6, 3], rd = [rand() - 0.5, rand() - 0.5, -1], pl = [rand() - 0.5, rand() - 0.5, rand() - 0.5, rand() - 0.5];
    const got = rayTriangles(big, ro, rd, pl);
    let want = null;
    for (let t = 0; t < ones.length; t++) {
      const h = rayTriangles(ones[t], ro, rd);
      if (!h) continue;
      const p = ro.map((x, c) => x + rd[c] * h.t);
      if (pl[0] * p[0] + pl[1] * p[1] + pl[2] * p[2] < pl[3]) continue;
      if (!want || h.t < want.t) want = { t: h.t, triangle: t };
    }
    assert.equal(got?.triangle ?? null, want?.triangle ?? null, `ray ${k}`);
  }
  // A segment across the plane: found only on its kept part, its parameter where the nearest kept point is.
  const seg = prepareGeometry({ positions: [-1, 0, 0, 1, 0, 0], topology: 'lines' }), M = orthographicReversed(1, 1, -10, 10);
  // (Screen: x −1…1 maps to 0…100 px; the pointer at x = −0.5 world, 25 px.)
  const whole = nearestSegment(seg, M, 25, 50, 100, 100, 6);
  assert.ok(whole && near(whole.s, 0.25, 1e-9), JSON.stringify(whole));
  assert.equal(nearestSegment(seg, M, 25, 50, 100, 100, 6, Infinity, [1, 0, 0, 0]), null, 'the pointer over the cut-away half');
  const kept = nearestSegment(seg, M, 52, 50, 100, 100, 6, Infinity, [1, 0, 0, 0]);
  assert.ok(kept && near(kept.s, 0.52, 1e-9) && near(kept.distance, 0, 1e-9), JSON.stringify(kept));
  // Without a plane, the same answer as before the plane existed (a null plane is no plane).
  assert.deepEqual(nearestSegment(seg, M, 25, 50, 100, 100, 6, Infinity, null), whole);
  // A box cut by an axis plane (as clipMesh's clipped copy's box), wholly cut away, and left for another plane.
  const B = { min: [0, 0, 0], max: [10, 4, 2] };
  assert.deepEqual(clipBox(B, { normal: [0, 1, 0], offset: 1 }), { min: [0, 1, 0], max: [10, 4, 2] });
  assert.deepEqual(clipBox(B, { normal: [-1, 0, 0], offset: -3 }), { min: [0, 0, 0], max: [3, 4, 2] });
  assert.equal(clipBox(B, { normal: [0, 0, 1], offset: 5 }), null);
  assert.equal(clipBox(B, { normal: [Math.SQRT1_2, Math.SQRT1_2, 0], offset: 1 }), B);
});

test('G19 several clip planes on the CPU: the kept region is their intersection — rays, caps where the ray came into it, segments, boxes', () => {
  // A 2 × 2 × 2 box at the origin (outward faces).
  const P = [], I = [];
  for (const [axis, s] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3, base = P.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = [0, 0, 0]; q[axis] = s; q[u] = a; q[v] = b * s; P.push(...q); }
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = prepareGeometry({ positions: P, indices: I }), M = identity();
  let seed = 11; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const unit = v => { const l = Math.hypot(...v); return v.map(x => x / l); }, dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // The oracle: the box and the region are convex, so along a ray the solid kept is the overlap of their intervals —
  // its first point is max(box entry, region entry), a cap when the region's entry is the later one.
  const interval = (planes, o, d) => { let lo = -Infinity, hi = Infinity; for (const p of planes) { const den = dt(p.normal, d), f = dt(p.normal, o) - p.offset; if (Math.abs(den) < 1e-15) { if (f < 0) return null; continue; } const t = -f / den; if (den > 0) lo = Math.max(lo, t); else hi = Math.min(hi, t); } return [lo, hi]; };
  const boxPlanes = [0, 1, 2].flatMap(k => [1, -1].map(sg => { const n = [0, 0, 0]; n[k] = -sg; return { normal: n, offset: -1 }; }));
  let hits = 0, caps = 0;
  for (let k = 0; k < 400; k++) {
    const count = 1 + (k % 3), planes = Array.from({ length: count }, () => ({ normal: unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]), offset: (rand() - 0.5) * 1.2 }));
    const o = unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]).map(x => x * 6), d = unit([rand() * 0.6 - 0.3 - o[0] / 6, rand() * 0.6 - 0.3 - o[1] / 6, rand() * 0.6 - 0.3 - o[2] / 6]);
    const clip = { normal: planes[0].normal, offset: planes[0].offset, planes };
    const got = clippedRay(g, M, o, d, clip, true, true), box = interval(boxPlanes, o, d), reg = interval(planes, o, d);
    let want = null;
    if (box && reg) { const t0 = Math.max(box[0], reg[0]), t1 = Math.min(box[1], reg[1]); if (t0 < t1 && t0 > 0) want = { t: t0, cap: reg[0] > box[0] }; }
    // (A ray grazing an edge within rounding is left out.)
    if (want && box && reg && Math.abs(reg[0] - box[0]) < 1e-7) continue;
    assert.equal(!!got, !!want, `ray ${k} ${JSON.stringify({ got, want })}`);
    if (!want) continue;
    hits++; if (want.cap) caps++;
    assert.ok(near(got.t, want.t, 1e-9) && got.cap === want.cap, `ray ${k} ${JSON.stringify({ got, want })}`);
    if (got.cap) { const e = regionEntry(clip, o, d); assert.equal(got.plane, e.plane); assert.ok(near(dt(planes[e.plane].normal, o.map((x, c) => x + d[c] * got.t)), planes[e.plane].offset, 1e-9)); }
  }
  assert.ok(hits > 100 && caps > 30, `${hits} hits, ${caps} on caps`);
  // The planes through a transform, packed 4 a plane: the same sides of the same points.
  const T = multiply(translation([3, -2, 1]), rotation([0.3, 0.8, 0.5], 0.7)), two = [{ normal: unit([1, 2, 0]), offset: 0.4 }, { normal: [0, 0, -1], offset: -0.5 }], L = localPlane(T, { ...two[0], planes: two });
  assert.equal(L.length, 8);
  for (let k = 0; k < 50; k++) {
    const x = [rand() * 4 - 2, rand() * 4 - 2, rand() * 4 - 2], w = transformPoint(T, x);
    for (let i = 0; i < 2; i++) assert.equal(L[4 * i] * x[0] + L[4 * i + 1] * x[1] + L[4 * i + 2] * x[2] >= L[4 * i + 3], dt(two[i].normal, w) >= two[i].offset);
  }
  // A ray through the hierarchy with three planes: what every triangle tested against them gives.
  const n = 40, LP = [], LI = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) LP.push(i / n * 10 - 5, j / n * 10 - 5, Math.sin(i * 0.4) * Math.cos(j * 0.3));
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; LI.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1); }
  const big = prepareGeometry({ positions: LP, indices: LI }), ones = Array.from({ length: LI.length / 3 }, (_, t) => prepareGeometry({ positions: LI.slice(3 * t, 3 * t + 3).flatMap(v => LP.slice(3 * v, 3 * v + 3)) }));
  for (let k = 0; k < 40; k++) {
    const ro = [rand() * 12 - 6, rand() * 12 - 6, 3], rd = [rand() - 0.5, rand() - 0.5, -1], pl = Array.from({ length: 12 }, () => rand() - 0.5);
    const got = rayTriangles(big, ro, rd, pl);
    let want = null;
    for (let t = 0; t < ones.length; t++) {
      const h = rayTriangles(ones[t], ro, rd); if (!h) continue;
      const q = ro.map((x, c) => x + rd[c] * h.t);
      if ([0, 4, 8].some(i => pl[i] * q[0] + pl[i + 1] * q[1] + pl[i + 2] * q[2] < pl[i + 3])) continue;
      if (!want || h.t < want.t) want = { t: h.t, triangle: t };
    }
    assert.equal(got?.triangle ?? null, want?.triangle ?? null, `three planes, ray ${k}`);
  }
  // A segment between two planes (x ≥ −0.5, x ≤ 0.5): found only there, its parameter where the pointer is.
  const seg = prepareGeometry({ positions: [-1, 0, 0, 1, 0, 0], topology: 'lines' }), O = orthographicReversed(1, 1, -10, 10), both = [1, 0, 0, -0.5, -1, 0, 0, -0.5];
  assert.equal(nearestSegment(seg, O, 10, 50, 100, 100, 6, Infinity, both), null, 'left of both');
  assert.equal(nearestSegment(seg, O, 90, 50, 100, 100, 6, Infinity, both), null, 'right of both');
  const mid = nearestSegment(seg, O, 60, 50, 100, 100, 6, Infinity, both);
  assert.ok(mid && near(mid.s, 0.6, 1e-9) && near(mid.distance, 0, 1e-9), JSON.stringify(mid));
  // One plane packed is the plane as before.
  assert.deepEqual(nearestSegment(seg, O, 52, 50, 100, 100, 6, Infinity, [1, 0, 0, 0]), nearestSegment(seg, O, 52, 50, 100, 100, 6, Infinity, Float64Array.from([1, 0, 0, 0])));
  // A box section's six planes cut a box; an oblique one among them leaves it be.
  const B = { min: [0, 0, 0], max: [10, 4, 2] }, sect = [{ normal: [1, 0, 0], offset: 2 }, { normal: [-1, 0, 0], offset: -8 }, { normal: [0, 1, 0], offset: 1 }, { normal: [0, -1, 0], offset: -3 }, { normal: [0, 0, 1], offset: 0.5 }, { normal: [Math.SQRT1_2, 0, Math.SQRT1_2], offset: 9 }];
  assert.deepEqual(clipBox(B, { ...sect[0], planes: sect }), { min: [2, 1, 0.5], max: [8, 3, 2] });
  assert.equal(clipBox(B, { ...sect[0], planes: [...sect, { normal: [0, 0, -1], offset: -0.2 }] }), null);
});

test('G20 a cut-out on the CPU: kept on any plane\'s kept side, the removed corner the intersection of their cut-away sides — rays and caps where the ray leaves it, packed planes, segments in two pieces, boxes', () => {
  // A 2 × 2 × 2 box at the origin (outward faces).
  const P = [], I = [];
  for (const [axis, s] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3, base = P.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = [0, 0, 0]; q[axis] = s; q[u] = a; q[v] = b * s; P.push(...q); }
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = prepareGeometry({ positions: P, indices: I }), M = identity();
  let seed = 23; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const unit = v => { const l = Math.hypot(...v); return v.map(x => x / l); }, dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // The oracle: the box B and the removed corner R are convex, so along a ray each is one stretch; what is kept of the
  // solid is B's stretch less R's. Its first point is B's entry unless that is inside R — then R's exit, a cap, when that
  // is still inside B.
  const interval = (planes, o, d) => { let lo = -Infinity, hi = Infinity; for (const p of planes) { const den = dt(p.normal, d), f = dt(p.normal, o) - p.offset; if (Math.abs(den) < 1e-15) { if (f < 0) return null; continue; } const t = -f / den; if (den > 0) lo = Math.max(lo, t); else hi = Math.min(hi, t); } return lo < hi ? [lo, hi] : null; };
  const boxPlanes = [0, 1, 2].flatMap(k => [1, -1].map(sg => { const n = [0, 0, 0]; n[k] = -sg; return { normal: n, offset: -1 }; }));
  let hits = 0, caps = 0;
  for (let k = 0; k < 800; k++) {
    const count = 2 + (k % 2), planes = Array.from({ length: count }, () => ({ normal: unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]), offset: (rand() - 0.5) * 0.8 }));
    const o = unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]).map(x => x * 6), d = unit([rand() * 0.6 - 0.3 - o[0] / 6, rand() * 0.6 - 0.3 - o[1] / 6, rand() * 0.6 - 0.3 - o[2] / 6]);
    const clip = { normal: planes[0].normal, offset: planes[0].offset, planes, cutout: true };
    const got = clippedRay(g, M, o, d, clip, true, true), box = interval(boxPlanes, o, d), R = interval(planes.map(p => ({ normal: p.normal.map(x => -x), offset: -p.offset })), o, d);
    let want = null;
    if (box && box[0] > 0) {
      if (!R || box[0] < R[0] || box[0] >= R[1]) want = { t: box[0], cap: false };
      else if (R[1] < box[1]) want = { t: R[1], cap: true };
    }
    // (A ray grazing an edge within rounding is left out.)
    if (box && R && (Math.abs(box[0] - R[0]) < 1e-7 || Math.abs(box[0] - R[1]) < 1e-7 || Math.abs(box[1] - R[1]) < 1e-7)) continue;
    assert.equal(!!got, !!want, `ray ${k} ${JSON.stringify({ got, want })}`);
    if (!want) continue;
    hits++; if (want.cap) caps++;
    assert.ok(near(got.t, want.t, 1e-9) && got.cap === want.cap, `ray ${k} ${JSON.stringify({ got, want })}`);
    if (got.cap) { const e = regionEntry(clip, o, d); assert.ok(near(e.t, R[1], 1e-9)); assert.ok(near(dt(planes[e.plane].normal, o.map((x, c) => x + d[c] * got.t)), planes[e.plane].offset, 1e-9), 'on the plane it leaves R through'); }
  }
  assert.ok(hits > 300 && caps > 40, `${hits} hits, ${caps} on caps`);
  // Packed, the flag last: kept on any plane's kept side.
  const two = [{ normal: [-1, 0, 0], offset: 0 }, { normal: [0, -1, 0], offset: 0 }], L = localPlane(identity(), { ...two[0], planes: two, cutout: true });
  assert.equal(L.length, 9); assert.equal(L[8], 1);
  assert.equal(keptBy(L, 0.5, 0.5, 0), false, 'in the corner x > 0, y > 0'); assert.equal(keptBy(L, -0.5, 0.5, 0), true); assert.equal(keptBy(L, 0.5, -0.5, 0), true);
  assert.equal(keptBy(L.subarray(0, 8), -0.5, 0.5, 0), false, 'without the flag: both sides (G19)');
  // A segment across a removed slab (−0.5 < x < 0.5, kept x ≤ −0.5 or x ≥ 0.5): found on either piece, not between.
  const seg = prepareGeometry({ positions: [-1, 0, 0, 1, 0, 0], topology: 'lines' }), O = orthographicReversed(1, 1, -10, 10), slab = [-1, 0, 0, 0.5, 1, 0, 0, 0.5, 1];
  const left = nearestSegment(seg, O, 10, 50, 100, 100, 6, Infinity, slab), right = nearestSegment(seg, O, 90, 50, 100, 100, 6, Infinity, slab);
  assert.ok(left && near(left.s, 0.1, 1e-9) && near(left.distance, 0, 1e-9), JSON.stringify(left));
  assert.ok(right && near(right.s, 0.9, 1e-9) && near(right.distance, 0, 1e-9), JSON.stringify(right));
  assert.equal(nearestSegment(seg, O, 50, 50, 100, 100, 6, Infinity, slab), null, 'the removed middle');
  // The nearest of the two pieces' ends from just inside the slab.
  const edge = nearestSegment(seg, O, 30, 50, 100, 100, 6, Infinity, slab);
  assert.ok(edge && near(edge.s, 0.25, 1e-9) && near(edge.distance, 5, 1e-9), JSON.stringify(edge));
  // A box: kept whole with a corner off; none when the removed corner holds it all.
  const B = { min: [0, 0, 0], max: [10, 4, 2] };
  assert.deepEqual(clipBox(B, { ...two[0], planes: two, cutout: true }), B);
  assert.equal(clipBox(B, { normal: [-1, 0, 0], offset: 1, planes: [{ normal: [-1, 0, 0], offset: 1 }, { normal: [0, -1, 0], offset: 1 }], cutout: true }), null);
  // The frame block: the plane count negative for a cut-out.
  const cam = new Camera(), f = packFrame(identity(), cam, [], {}, null, [1, 1, 1, 0], null, { normal: two[0].normal, offset: 0, cap: [1, 0, 0], planes: two, cutout: true });
  const o = (FRAME_BYTES / 4) - 4 * MAX_CLIP_PLANES - 4;
  assert.equal(f[o + 3], -2);
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
  // G15d.1: AgX is tone map 2; the grading (balance and contrast, lift and saturation, gamma and on, gain) and the
  // vignette (amount, clear radius, fade end) just before the outline box; off, all zeros.
  assert.equal(new Uint32Array(packOutput({ toneMapping: 'agx' }), 4, 1)[0], 2);
  const g = new Float32Array(packOutput({ grading: { temperature: 0.5, contrast: 1.2, saturation: 0.8, lift: [0.1, 0, 0], gamma: [1, 1.1, 1], gain: [1, 1, 0.9] }, vignette: { amount: 0.4, size: 0.2, softness: 0.5 } })).slice(-24, -4);
  const wb = whiteBalance(0.5, 0);
  assert.ok(close([...g], [...wb, 1.2, 0.1, 0, 0, 0.8, 1, 1.1, 1, 1, 1, 1, 0.9, 0, 0.4, 0.2, 0.7, 0], 1e-6));
  assert.ok(Math.abs(0.2126 * wb[0] + 0.7152 * wb[1] + 0.0722 * wb[2] - 1) < 1e-9 && wb[0] > wb[2], 'warm: red over blue, luminance kept');
  assert.ok([...new Float32Array(packOutput({})).slice(-24, -4)].every(x => x === 0), 'no post: zeros');
  assert.ok([...new Float32Array(packOutput({ vignette: { amount: 0 } })).slice(-8, -4)].every(x => x === 0), 'amount 0: no vignette');
  // G15b: the contact shadows' projection, direction and length, strength and thickness, before the grading; none: zeros.
  const proj = Array.from({ length: 16 }, (_, i) => i + 1);
  const ct = new Float32Array(packOutput({}, [], 2, null, null, null, null, { projection: proj, inverseProjection: proj, direction: [0, 0.6, 0.8], length: 2, strength: 0.5, thickness: 1.2 })).slice(-48, -24);
  assert.ok(close([...ct], [...proj, 0, 0.6, 0.8, 2, 0.5, 1.2, 0, 0], 1e-6));
  assert.ok([...new Float32Array(packOutput({})).slice(-48, -24)].every(x => x === 0), 'no contact shadows: zeros');
});

// Exercise pickNow's real readback-to-metadata path. Only the GPU transport is mocked: the cap and triangle
// intersections, transforms, camera projection and scalar interpolation use the production implementation.
test('G20 pickNow keeps a nearer cut-out front face and identifies real caps from readback depth', async t => {
  const positions = [], indices = [];
  for (const [axis, sign] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3, base = positions.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = [0, 0, 0]; p[axis] = sign; p[u] = a; p[v] = b * sign; positions.push(...p); }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const data = prepareGeometry({ positions, indices, faces: Array.from({ length: 12 }, (_, i) => 100 + i) });
  data.scalars = prepareScalars(data, Array(data.vertexCount).fill(7), 'vertex');
  const quarter = [{ normal: [1, 0, 0], offset: 0 }, { normal: [0, 1, 0], offset: 0 }];
  const slab = [{ normal: [-1, 0, 0], offset: 0.5 }, { normal: [1, 0, 0], offset: 0.5 }];
  const cases = [
    { name: 'quarter front', planes: quarter, cutout: true, origin: [-6, 1.65, 0], direction: [1, -0.3, 0], point: [-1, 0.15, 0], triangle: 2 },
    { name: 'slab front', planes: slab, cutout: true, origin: [-6, 0.15, 0], direction: [1, 0, 0], point: [-1, 0.15, 0], triangle: 2 },
    { name: 'quarter cap', planes: quarter, cutout: true, origin: [-0.5, -2, 0], direction: [0, 1, 0], point: [-0.5, 0, 0], plane: 1 },
    { name: 'slab cap', planes: slab, cutout: true, origin: [0, 0.15, 0], direction: [1, 0, 0], point: [0.5, 0.15, 0], plane: 1 },
    { name: 'single cap tie on front', planes: [{ normal: [1, 0, 0], offset: -1 }], cutout: false, origin: [-6, 0.15, 0], direction: [1, 0, 0], point: [-1, 0.15, 0], plane: 0 },
    { name: 'single cap', planes: [quarter[1]], cutout: false, origin: [0.5, -2, 0], direction: [0, 1, 0], point: [0.5, 0, 0], plane: 0 },
    { name: 'multi-plane cap', planes: quarter, cutout: false, origin: [0.5, -2, 0], direction: [0, 1, 0], point: [0.5, 0, 0], plane: 1 },
  ];
  for (const fixture of cases) for (const instanced of [false, true]) await t.test(`${fixture.name}, ${instanced ? 'instance 1' : 'mesh'}`, async () => {
    const shift = instanced ? [3, 0, 0] : [0, 0, 0], move = p => p.map((v, i) => v + shift[i]);
    const origin = move(fixture.origin), point = move(fixture.point), direction = fixture.direction;
    const planes = fixture.planes.map(p => ({ ...p, offset: p.offset + p.normal.reduce((s, v, i) => s + v * shift[i], 0) }));
    const clip = { ...planes[0], planes, cutout: fixture.cutout };
    const camera = new Camera({ position: origin, target: origin.map((v, i) => v + direction[i]), up: [0, 0, 1], projection: 'orthographic' });
    camera.clip({ min: [-20, -20, -20], max: [20, 20, 20] });
    // The exact review ray, including its non-unit direction. unproject still reads the real float32 GPU depth.
    camera.ray = () => ({ origin, direction });
    const vp = camera.viewProjection(1), depth = Math.fround(clipZ(vp, point));
    const mesh = { id: 17, visible: true, pickable: true, clipped: true, cap: true, transparent: false, material: {}, transform: identity(),
      geometry: { data, disposed: false, topology: 'triangles' }, instanceCount: instanced ? 2 : 1,
      instances: instanced ? { matrices: [translation([30, 0, 0]), translation(shift)] } : null };
    const viewer = Object.create(Viewer.prototype);
    const pass = { setScissorRect() {}, setBindGroup() {}, end() {} };
    const read = { async mapAsync() {}, unmap() {}, getMappedRange(offset) { return offset === 256 ? Float32Array.of(depth).buffer : Uint32Array.of(offset === 512 ? (instanced ? 1 : 0) : mesh.id).buffer; } };
    Object.assign(viewer, { canvas: { width: 1, height: 1, clientWidth: 1, clientHeight: 1 }, camera, meshes: [mesh], clip,
      device: { queue: { submit() {} }, createCommandEncoder: () => ({ beginRenderPass: () => pass, copyTextureToBuffer() {}, finish() {} }) },
      alive() {}, prepareCamera: () => vp, visibleMeshes: () => ({ opaque: [mesh], transparent: [] }), writeUniforms() {},
      drawCapFront() {}, drawMesh() {}, drawCaps() {}, ensurePickTargets: () => ({ views: {}, read }) });
    const cap = viewer.capHit(origin, direction);
    assert.ok(cap, 'a cap exists on the same mesh and instance');
    assert.equal(cap.instance, instanced ? 1 : null);
    if (fixture.name === 'quarter front') {
      const full = clippedRayFull(data, translation(shift), origin, direction, clip, true, true);
      assert.equal(full.hit.triangle, 2); assert.ok(near(full.hit.t, 5)); assert.equal(full.hit.cap, false);
      assert.ok(near(cap.t, 6), 'the same mesh cap is behind the original front');
    }
    const hit = await viewer.pickNow(0, 0);
    assert.equal(hit.mesh, mesh); assert.equal(hit.instance, instanced ? 1 : null); assert.equal(hit.depth, depth);
    assert.ok(close(hit.point, point, 1e-5), JSON.stringify(hit.point));
    assert.equal(hit.cap, fixture.plane !== undefined);
    assert.equal(hit.triangle, fixture.triangle ?? null); assert.equal(hit.face, fixture.triangle === undefined ? null : 100 + fixture.triangle);
    assert.equal(hit.capPlane, fixture.plane);
    if (fixture.triangle !== undefined) assert.ok(near(hit.scalar, 7, 1e-5), 'front-face scalar survives');
    else assert.equal(hit.scalar, undefined, 'caps have no triangle scalar');
  });
});

// Reuse G20's cube and transport shape, with production camera rays/unprojection and a held readback.
test('pickNow returns null when camera translation changes during readback, without changing an accepted hit', async () => {
  const positions = [], indices = [];
  for (const [axis, sign] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3, base = positions.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = [0, 0, 0]; p[axis] = sign; p[u] = a; p[v] = b * sign; positions.push(...p); }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const data = prepareGeometry({ positions, indices, faces: Array.from({ length: 12 }, (_, i) => 100 + i) });
  data.scalars = prepareScalars(data, Array(data.vertexCount).fill(7), 'vertex');
  const camera = new Camera({ position: [-6, 0.15, 0], target: [0, 0.15, 0], up: [0, 0, 1], projection: 'orthographic' });
  camera.clip({ min: [-20, -20, -20], max: [20, 20, 20] });
  const point = [-1, 0.15, 0], depth = Math.fround(clipZ(camera.viewProjection(1), point));
  const mesh = { id: 17, visible: true, pickable: true, clipped: true, cap: true, transparent: false, material: {}, transform: identity(),
    geometry: { data, disposed: false, topology: 'triangles' }, instanceCount: 1, instances: null };
  const viewer = Object.create(Viewer.prototype), pass = { setScissorRect() {}, setBindGroup() {}, end() {} };
  let held = false, entered, release, unmaps = 0;
  const read = {
    mapAsync() { return held ? new Promise(resolve => { release = resolve; entered(); }) : Promise.resolve(); },
    unmap() { unmaps++; },
    getMappedRange(offset) { return offset === 256 ? Float32Array.of(depth).buffer : Uint32Array.of(offset === 512 ? 0 : mesh.id).buffer; },
  };
  Object.assign(viewer, { canvas: { width: 1, height: 1, clientWidth: 1, clientHeight: 1 }, camera, meshes: [mesh], clip: null,
    device: { queue: { submit() {} }, createCommandEncoder: () => ({ beginRenderPass: () => pass, copyTextureToBuffer() {}, finish() {} }) },
    alive() {}, prepareCamera: () => camera.viewProjection(1), visibleMeshes: () => ({ opaque: [mesh], transparent: [] }), writeUniforms() {},
    drawCapFront() {}, drawMesh() {}, drawCaps() {}, ensurePickTargets: () => ({ views: {}, read }) });
  const accepted = await viewer.pickNow(0, 0);
  assert.equal(accepted.mesh, mesh); assert.equal(accepted.face, 102); assert.equal(accepted.triangle, 2);
  assert.equal(accepted.cap, false); assert.equal(accepted.instance, null);
  assert.ok(close(accepted.point, point, 1e-5), JSON.stringify(accepted.point));
  assert.ok(near(accepted.scalar, 7, 1e-5));
  const acceptedPoint = [...accepted.point];
  held = true;
  const mappingEntered = new Promise(resolve => { entered = resolve; }), pending = viewer.pickNow(0, 0);
  await mappingEntered;
  // The view direction is unchanged; the old center depth would unproject four units away in Y.
  camera.position = [-6, 4.15, 0]; camera.target = [0, 4.15, 0];
  release();
  assert.equal(await pending, null, 'a readback from the previous camera state must not be reinterpreted with the new camera');
  assert.deepEqual(accepted.point, acceptedPoint, 'the accepted hit must keep its original point');
  assert.equal(accepted.face, 102); assert.ok(near(accepted.scalar, 7, 1e-5));
  assert.equal(unmaps, 2, 'both mapped buffers must be unmapped, including the refused stale read');
});

// Reuse the camera-readback fixture; change only the public clip plane while its GPU result waits.
test('pickNow returns null when the clip plane changes during readback, without changing an accepted hit', async () => {
  const positions = [], indices = [];
  for (const [axis, sign] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3, base = positions.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = [0, 0, 0]; p[axis] = sign; p[u] = a; p[v] = b * sign; positions.push(...p); }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const data = prepareGeometry({ positions, indices, faces: Array.from({ length: 12 }, (_, i) => 100 + i) });
  data.scalars = prepareScalars(data, Array(data.vertexCount).fill(7), 'vertex');
  const camera = new Camera({ position: [-6, 0.15, 0], target: [0, 0.15, 0], up: [0, 0, 1], projection: 'orthographic' });
  camera.clip({ min: [-20, -20, -20], max: [20, 20, 20] });
  const point = [-1, 0.15, 0], depth = Math.fround(clipZ(camera.viewProjection(1), point));
  const mesh = { id: 17, visible: true, pickable: true, clipped: true, cap: true, transparent: false, material: {}, transform: identity(),
    geometry: { data, disposed: false, topology: 'triangles' }, instanceCount: 1, instances: null };
  const viewer = Object.create(Viewer.prototype), pass = { setScissorRect() {}, setBindGroup() {}, end() {} };
  let held = false, entered, release, unmaps = 0;
  const read = {
    mapAsync() { return held ? new Promise(resolve => { release = resolve; entered(); }) : Promise.resolve(); },
    unmap() { unmaps++; },
    getMappedRange(offset) { return offset === 256 ? Float32Array.of(depth).buffer : Uint32Array.of(offset === 512 ? 0 : mesh.id).buffer; },
  };
  Object.assign(viewer, { canvas: { width: 1, height: 1, clientWidth: 1, clientHeight: 1 }, camera, meshes: [mesh], clip: null,
    device: { queue: { submit() {} }, createCommandEncoder: () => ({ beginRenderPass: () => pass, copyTextureToBuffer() {}, finish() {} }) },
    alive() {}, prepareCamera: () => camera.viewProjection(1), visibleMeshes: () => ({ opaque: [mesh], transparent: [] }), writeUniforms() {},
    requestRender() {}, drawCapFront() {}, drawMesh() {}, drawCaps() {}, ensurePickTargets: () => ({ views: {}, read }) });
  const accepted = await viewer.pickNow(0, 0);
  assert.equal(accepted.mesh, mesh); assert.equal(accepted.face, 102); assert.equal(accepted.triangle, 2);
  assert.equal(accepted.cap, false); assert.equal(accepted.instance, null);
  assert.ok(close(accepted.point, point, 1e-5), JSON.stringify(accepted.point));
  assert.ok(near(accepted.scalar, 7, 1e-5));
  const acceptedPoint = [...accepted.point];
  held = true;
  const mappingEntered = new Promise(resolve => { entered = resolve; }), pending = viewer.pickNow(0, 0);
  await mappingEntered;
  assert.equal(viewer.clipPlane, null);
  const cameraBefore = { ...structuredClone(camera.state()), near: camera.near, far: camera.far };
  const sizeBefore = [viewer.canvas.width, viewer.canvas.height, viewer.canvas.clientWidth, viewer.canvas.clientHeight];
  const transformBefore = Array.from(mesh.transform);
  // Keep x >= 0: the previous front at x = -1 is removed and the new cap is at x = 0.
  viewer.clipPlane = { normal: [1, 0, 0], offset: 0 };
  assert.deepEqual(viewer.clipPlanes, [{ normal: [1, 0, 0], offset: 0 }]);
  assert.deepEqual({ ...camera.state(), near: camera.near, far: camera.far }, cameraBefore);
  assert.deepEqual([viewer.canvas.width, viewer.canvas.height, viewer.canvas.clientWidth, viewer.canvas.clientHeight], sizeBefore);
  assert.deepEqual(Array.from(mesh.transform), transformBefore);
  assert.equal(mesh.geometry.data, data);
  release();
  const stale = await pending;
  assert.equal(unmaps, 2, 'both mapped buffers must be unmapped, including the refused stale read');
  assert.equal(stale, null, `a readback from the previous clip state must be refused: ${JSON.stringify(stale && { point: stale.point, face: stale.face, triangle: stale.triangle, cap: stale.cap, capPlane: stale.capPlane })}`);
  assert.deepEqual(accepted.point, acceptedPoint, 'the accepted hit must keep its original point');
  assert.equal(accepted.face, 102); assert.ok(near(accepted.scalar, 7, 1e-5));
});
