// The viewer's CPU side: matrices and reversed depth, camera clip/fit/rays, orbit/pan/zoom, frustum
// culling, geometry preparation and ray picking, and the frame block layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { identity, invert, lookAt, multiply, orthographicReversed, perspectiveReversed, rotation, transformPoint, translation } from '../dist/viewer/math.js';
import { Camera } from '../dist/viewer/camera.js';
import { orbit, pan, zoom } from '../dist/viewer/controls.js';
import { boxInFrustum, frustumPlanes, transformBox } from '../dist/viewer/bounds.js';
import { prepareGeometry, rayTriangles, segmentInstances } from '../dist/viewer/geometry.js';
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
