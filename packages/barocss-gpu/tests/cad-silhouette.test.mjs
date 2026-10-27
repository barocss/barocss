// Current-source smooth silhouette contracts. No renderer, browser, kernel or package build.
// node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-silhouette.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url)), temporary = await mkdtemp(join(tmpdir(), 'cad-silhouette-'));
let silhouetteLines;
try {
  const outfile = join(temporary, 'silhouette.mjs');
  await build({ entryPoints: [resolve(root, 'apps/cad-studio/src/viewport/silhouette.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  ({ silhouetteLines } = await import(pathToFileURL(outfile).href));
} finally { await rm(temporary, { recursive: true, force: true }); }

const identity = () => Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const face = (index = 0, changes = {}) => ({ index, id: 'curved-' + index, name: 'Curved', kind: 'curved', normal: [0, 0, 1], centroid: [0, 0, 0], areaMM2: 1, ...changes });
const mesh = (positions, normals, indices) => ({ positions: Float32Array.from(positions), normals: Float32Array.from(normals), indices: Uint32Array.from(indices), faceOfVertex: new Float32Array(positions.length / 3), faces: [face()], edgeLines: new Float32Array([9, 8, 7, 6, 5, 4]), edgeOfSegment: new Float32Array([17, 17]), edges: [{ index: 17, names: ['native-edge'] }], bounds: { min: [-1, -1, -2], max: [1, 1, 2] } });
const snapshot = value => JSON.stringify(value, (_key, v) => ArrayBuffer.isView(v) ? [...v] : v);
const points = lines => Array.from({ length: lines.length / 3 }, (_, i) => Array.from(lines.slice(i * 3, i * 3 + 3)));
const componentNear = (lines, axis, value, tolerance = 1e-6) => { assert.ok(lines.length >= 6); assert.equal(lines.length % 6, 0); for (const p of points(lines)) assert.ok(Math.abs(p[axis] - value) <= tolerance, `${p} axis ${axis} expected ${value}`); };

function cylinder(steps = 64) {
  const p = [], n = [], indices = [];
  for (const z of [-2, 2]) for (let i = 0; i < steps; i++) {
    const a = i * Math.PI * 2 / steps + 0.013, x = Math.cos(a), y = Math.sin(a);
    p.push(x, y, z); n.push(x, y, 0);
  }
  for (let i = 0; i < steps; i++) { const j = (i + 1) % steps; indices.push(i, j, i + steps, j, j + steps, i + steps); }
  return mesh(p, n, indices);
}

function sphere(steps = 64, rows = 32) {
  const p = [], indices = [];
  for (let row = 0; row <= rows; row++) {
    const lat = -Math.PI / 2 + row * Math.PI / rows;
    for (let i = 0; i < steps; i++) { const a = i * Math.PI * 2 / steps + 0.013; p.push(Math.cos(lat) * Math.cos(a), Math.cos(lat) * Math.sin(a), Math.sin(lat)); }
  }
  for (let row = 0; row < rows; row++) for (let i = 0; i < steps; i++) { const a = row * steps + i, b = row * steps + (i + 1) % steps; indices.push(a, b, a + steps, b, b + steps, a + steps); }
  return mesh(p, p, indices);
}

test('cylinder contours follow smooth normal facing rather than triangle edges or native edge lines', () => {
  const source = cylinder(), before = snapshot(source);
  const x = silhouetteLines(source, identity(), [5, 0, 0], [0, 0, 0], true);
  const y = silhouetteLines(source, identity(), [0, 5, 0], [0, 0, 0], true);
  componentNear(x, 0, 0); componentNear(y, 1, 0); assert.notDeepEqual(x, y);
  assert.ok(points(x).some(p => p[1] > 0.99)); assert.ok(points(x).some(p => p[1] < -0.99));
  assert.ok(points(x).some(p => p[2] === -2)); assert.ok(points(x).some(p => p[2] === 2));
  const vertexXs = new Set(Array.from(source.positions).filter((_n, i) => i % 3 === 0));
  assert.ok(points(x).every(p => !vertexXs.has(p[0])), 'endpoints interpolate through triangles instead of drawing their diagonals');
  assert.equal(snapshot(source), before, 'native IDs, native edges, normals and topology are read-only');
});

test('sphere contours change with view and perspective uses eye-to-world-position at each vertex', () => {
  const source = sphere(), x = silhouetteLines(source, identity(), [5, 0, 0], [0, 0, 0], true);
  const z = silhouetteLines(source, identity(), [0, 0, 5], [0, 0, 0], true);
  componentNear(x, 0, 0); componentNear(z, 2, 0); assert.notDeepEqual(x, z);
  for (const p of points(x)) assert.ok(Math.hypot(...p) > 0.99 && Math.hypot(...p) < 1.001);
  const perspective = silhouetteLines(source, identity(), [5, 0, 0], [0, 0, 0], false);
  componentNear(perspective, 0, 0.2, 0.01); assert.notDeepEqual(perspective, x);
  const away = silhouetteLines(source, identity(), [5, 0, 0], [0, 100, 0], false);
  assert.deepEqual(away, perspective, 'perspective facing does not substitute target direction');
});

test('rigid placement rotates normals and translates perspective points while output remains in source coordinates', () => {
  const source = cylinder(), model = Float64Array.from([0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 4, -3, 2, 1]);
  for (const ortho of [true, false]) {
    const original = silhouetteLines(source, identity(), [5, 0, 0], [0, 0, 0], ortho);
    const placed = silhouetteLines(source, model, [4, 2, 2], [4, -3, 2], ortho);
    assert.equal(placed.length, original.length);
    for (let i = 0; i < placed.length; i++) assert.ok(Math.abs(placed[i] - original[i]) < 1e-6);
    assert.ok(points(placed).every(p => Math.abs(p[0]) < 0.22 && Math.abs(p[1]) <= 1 && Math.abs(p[2]) <= 2));
  }
});

test('planar, faceted and mixed-face triangles cannot create smooth silhouettes', () => {
  const source = cylinder();
  for (const replacement of [face(0, { kind: 'plane' }), face(0, { facet: true })]) {
    assert.equal(silhouetteLines({ ...source, faces: [replacement] }, identity(), [5, 0, 0], [0, 0, 0], true).length, 0);
  }
  const mixed = mesh([-1, 0, 0, 1, 0, 0, 0, 1, 0], [-1, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
  mixed.faces.push(face(1)); mixed.faceOfVertex[2] = 1;
  assert.equal(silhouetteLines(mixed, identity(), [5, 0, 0], [0, 0, 0], true).length, 0);
});

test('zero contours keep exact tangent mesh edges once and suppress ambiguous tangent patches and degenerate inputs', () => {
  const source = mesh([0, 0, 0, 0, 1, 0, 1, 0, 0, -1, 0, 0], [0, 1, 0, 0, 1, 0, 1, 0, 0, -1, 0, 0], [0, 1, 2, 1, 0, 3]);
  assert.deepEqual(Array.from(silhouetteLines(source, identity(), [5, 0, 0], [0, 0, 0], true)), [0, 0, 0, 0, 1, 0]);
  const flatFacing = { ...source, normals: new Float32Array(source.normals.length) };
  for (let i = 1; i < flatFacing.normals.length; i += 3) flatFacing.normals[i] = 1;
  assert.equal(silhouetteLines(flatFacing, identity(), [5, 0, 0], [0, 0, 0], true).length, 0);
  const noisy = { ...flatFacing, normals: flatFacing.normals.slice() }; for (let i = 0; i < noisy.normals.length; i += 3) noisy.normals[i] = i % 2 ? 1e-9 : -1e-9;
  assert.equal(silhouetteLines(noisy, identity(), [5, 0, 0], [0, 0, 0], true).length, 0);
  for (const bad of [mesh([0, 0, 0, 1, 0, 0, 2, 0, 0], [-1, 0, 0, 1, 0, 0, 1, 0, 0], [0, 1, 2]), { ...source, normals: new Float32Array(source.normals.length) }, { ...source, indices: new Uint32Array([0, 1, 99]) }]) {
    assert.equal(silhouetteLines(bad, identity(), [5, 0, 0], [0, 0, 0], true).length, 0);
  }
  assert.equal(silhouetteLines(source, identity(), [0, 0, 0], [0, 0, 0], true).length, 0);
});
