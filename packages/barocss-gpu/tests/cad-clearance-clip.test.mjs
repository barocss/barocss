// Current-source pure drawing-clip contracts. Analytic areas/coverage; no renderer, worker, browser or kernel evaluation.
// node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-clearance-clip.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url)), temporary = await mkdtemp(join(tmpdir(), 'cad-clearance-clip-'));
let clipClearanceGeometry;
try {
  const outfile = join(temporary, 'clip.mjs');
  await build({ entryPoints: [resolve(root, 'apps/cad-studio/src/viewport/clearanceDisplay.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', alias: { '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') } });
  ({ clipClearanceGeometry } = await import(pathToFileURL(outfile).href));
} finally { await rm(temporary, { recursive: true, force: true }); }

const identity = () => Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const snapshot = value => JSON.stringify(value, (_key, v) => ArrayBuffer.isView(v) ? [...v] : v);
const x = { normal: [1, 0, 0], offset: 0 }, y = { normal: [0, 1, 0], offset: 0 };
function overlay(positions = [-2, -2, 0, 2, -2, 0, 0, 2, 0], changes = {}) {
  return { id: 'a|b|band-a', bodyKey: 'a/body', positions: Float32Array.from(positions), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]), colors: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), field: new Float32Array([0.1, 0.5, 2]), model: identity(), state: 'near', hatched: false, opacity: 0.65, ...changes };
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} expected ${expected}`);
const triangles = g => Array.from({ length: g.indices.length / 3 }, (_, t) => Array.from(g.indices.slice(t * 3, t * 3 + 3), v => Array.from(g.positions.slice(v * 3, v * 3 + 3))));
const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const area = g => triangles(g).reduce((sum, [a, b, c]) => { const u = sub(b, a), v = sub(c, a); return sum + Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; }, 0);
// Witnesses are strictly inside polygons and away from triangulation boundaries; count detects positive-area overdraw.
const coverage = (g, p) => triangles(g).filter(([a, b, c]) => {
  const u = sub(b, a), v = sub(c, a), w = sub(p, a), uu = dot(u, u), uv = dot(u, v), vv = dot(v, v), uw = dot(u, w), vw = dot(v, w), d = uu * vv - uv * uv;
  if (d <= 1e-12) return false;
  const s = (vv * uw - uv * vw) / d, t = (uu * vw - uv * uw) / d;
  return s > 1e-7 && t > 1e-7 && s + t < 1 - 1e-7;
}).length;
function checked(source, planes, cutout) {
  const before = snapshot(source), field = source.field, model = source.model, result = clipClearanceGeometry(source, { planes, cutout });
  assert.equal(snapshot(source), before); assert.equal(source.field, field); assert.equal(source.model, model);
  assert.equal(result.positions.length, result.normals.length); assert.equal(result.positions.length, result.colors.length); assert.equal(result.indices.length % 3, 0);
  assert.ok([...result.positions, ...result.normals, ...result.colors].every(Number.isFinite)); assert.ok([...result.indices].every(i => i < result.positions.length / 3));
  return result;
}

test('cutout emits a triangle coplanar with its first kept plane once, independent of later planes or plane order', () => {
  const source = overlay([0, -2, 0, 0, 2, 0, 0, 0, 2], { normals: new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0]) });
  for (const planes of [[x, y], [x, y, { normal: [0, 0, 1], offset: 0.5 }], [y, x]]) {
    const result = checked(source, planes, true); near(area(result), 4);
    for (const p of [[0, -1, 0.2], [0, 1, 0.2], [0, 0.25, 1.1]]) assert.equal(coverage(result, p), 1, `coplanar witness ${p} must have one layer`);
    if (planes[0] === x) assert.equal(result.indices.length, 3, 'an entirely kept coplanar triangle never enters the later remainder');
  }
});

test('wholly removed triangles stay empty and an earlier wholly kept piece is not emitted again', () => {
  const removed = overlay([-3, -3, 0, -1, -3, 0, -3, -1, 0]), kept = overlay([1, -3, 0, 3, -3, 0, 1, -1, 0]);
  for (const cutout of [false, true]) assert.equal(checked(removed, [x, y], cutout).indices.length, 0);
  const result = checked(kept, [x, y], true); near(area(result), 2); assert.equal(result.indices.length, 3); assert.equal(coverage(result, [1.5, -2.5, 0]), 1);
  assert.equal(checked(kept, [x, y], false).indices.length, 0);
});

test('crossing triangles distinguish union from intersection with analytic area, coverage and interpolated colours', () => {
  for (const [cutout, expected] of [[false, 1], [true, 5]]) {
    const result = checked(overlay(), [x, y], cutout); near(area(result), expected);
    assert.equal(coverage(result, [-0.5, -1, 0]), 0); assert.equal(coverage(result, [0.7, -1, 0]), cutout ? 1 : 0);
    assert.equal(coverage(result, [-0.2, 0.5, 0]), cutout ? 1 : 0); assert.equal(coverage(result, [0.2, 0.5, 0]), 1);
    for (let v = 0; v < result.positions.length / 3; v++) {
      const px = result.positions[v * 3], py = result.positions[v * 3 + 1], c = (py + 2) / 4, b = (px + 2 - 2 * c) / 4;
      near(result.colors[v * 3], 1 - b - c); near(result.colors[v * 3 + 1], b); near(result.colors[v * 3 + 2], c);
      assert.equal(result.positions[v * 3 + 2], 0); assert.equal(result.normals[v * 3 + 2], 1);
    }
  }
});

test('world planes under a rotated and translated model produce the same local clipped pieces without moving the exact field', () => {
  const source = overlay(undefined, { model: Float64Array.from([0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 7, -4, 3, 1]) });
  // World y >= -4 is local x >= 0; world x <= 7 is local y >= 0.
  const planes = [{ normal: [0, 1, 0], offset: -4 }, { normal: [-1, 0, 0], offset: -7 }];
  for (const cutout of [false, true]) {
    const transformed = checked(source, planes, cutout), local = checked(overlay(), [x, y], cutout);
    near(area(transformed), cutout ? 5 : 1); assert.deepEqual(transformed.positions, local.positions); assert.deepEqual(transformed.indices, local.indices); assert.deepEqual(transformed.colors, local.colors);
    for (let v = 0; v < transformed.positions.length; v += 3) assert.equal(transformed.positions[v + 2], 0, 'returned drawing coordinates remain local, not world z=3');
    assert.deepEqual(Array.from(source.field), Array.from(new Float32Array([0.1, 0.5, 2])));
  }
});

test('an absent or empty clip preserves source arrays and never rewrites exact fields or model provenance', () => {
  const source = overlay(), before = snapshot(source);
  for (const clip of [undefined, { planes: [], cutout: false }, { planes: [], cutout: true }]) {
    const result = clipClearanceGeometry(source, clip);
    for (const key of ['positions', 'normals', 'indices', 'colors']) assert.equal(result[key], source[key]);
    assert.equal(snapshot(source), before);
  }
});
