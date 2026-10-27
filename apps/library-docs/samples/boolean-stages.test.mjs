// Numerical oracles for the fixed 3D teaching cases, independent of native mass integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CASES } from '../scripts/boolean-scenes-source.mjs';
const data = JSON.parse(readFileSync(resolve(import.meta.dirname, '../docs/.vitepress/components/boolean-scenes.json'), 'utf8'));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);

test('3D scenes: independent box, circle-segment, two-hole and tilted-bore volumes', () => {
  const volumes = {
    boxes: [1000, 1000, 280],
    cylinder: [1000, Math.PI * 9 * 14, (Math.PI * 9 - 9 * Math.acos(2 / 3) + 2 * Math.sqrt(5)) * 10],
    holes: [20 * 16 * 8, 2 * Math.PI * 9 * 12, 2 * Math.PI * 9 * 8],
    oblique: [12 * 12 * 8, Math.PI * 4 * 24, Math.PI * 4 * 8 / Math.cos(Math.PI / 6)],
  };
  // Integrate cross-sectional rectangles after y = 2.5 sin(t); smooth integrand, independent of B-rep quadrature.
  const steps = 4096, h = Math.PI / steps;
  const f = t => 4 * Math.sqrt(16 - 6.25 * Math.sin(t) ** 2) * 6.25 * Math.cos(t) ** 2;
  let sum = f(-Math.PI / 2) + f(Math.PI / 2);
  for (let i = 1; i < steps; i++) sum += (i % 2 ? 4 : 2) * f(-Math.PI / 2 + i * h);
  volumes.crossed = [Math.PI * 16 * 12, Math.PI * 6.25 * 12, sum * h / 3];
  for (const scene of data.cases) {
    const [a, b, common] = volumes[scene.id];
    near(scene.results.intersect.volume, common);
    near(scene.results.difference.volume, a - common);
    near(scene.results.union.volume, a + b - common);
  }
  assert.equal(data.cases.find(c => c.id === 'holes').results.intersect.bodies, 2);
});

test('3D display data: valid triangle indices, complete face partitions, finite normals and cuts on both boundaries', () => {
  assert.equal(data.cases.length, 5);
  for (const scene of data.cases) {
    const source = CASES.find(c => c.id === scene.id);
    assert.ok(scene.cuts.length > 0);
    for (const line of scene.cuts) for (let i = 0; i < line.length; i += 3) {
      const p = line.slice(i, i + 3);
      // This checks rounded display storage only. Native tolerances are not changed.
      near(source.fieldA(p), 0); near(source.fieldB(p), 0);
    }
    for (const mesh of [...scene.inputs, ...Object.values(scene.results).map(r => r.mesh)]) {
      assert.equal(mesh.positions.length, mesh.normals.length);
      assert.equal(mesh.positions.length % 3, 0); assert.equal(mesh.indices.length % 3, 0);
      assert.ok(mesh.positions.every(Number.isFinite) && mesh.normals.every(Number.isFinite));
      assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && 3 * i < mesh.positions.length));
      let end = 0;
      for (const p of mesh.patches) { assert.equal(p.start, end); assert.equal(p.count % 3, 0); end += p.count; }
      assert.equal(end, mesh.indices.length);
    }
  }
});
