// Preparation checks only: source bundling, analytic fixtures, and synthetic pixel metrics. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url)), temporary = await mkdtemp(join(tmpdir(), 'g21-fixture-static-'));
let api;
try {
  const outfile = join(temporary, 'fixture.mjs');
  await build({ stdin: { contents: "export * from './packages/barocss-gpu/tests/fixtures/cad-display-browser.ts'; export {sectionedBodies,sectionedInstances} from './apps/cad-studio/src/viewport/sectionView.ts';", resolveDir: root, loader: 'ts' }, outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', alias: { '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src'), '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') } });
  api = await import(pathToFileURL(outfile).href);
} finally { await rm(temporary, { recursive: true, force: true }); }

test('fixture source imports without DOM or browser execution; contract has five modes and thirteen distinct checks', () => {
  assert.equal(api.MODES.length, 5); assert.equal(new Set(api.MODES).size, 5);
  assert.equal(api.REQUIRED_CHECKS.length, 13); assert.equal(new Set(api.REQUIRED_CHECKS).size, 13);
  assert.equal(typeof api.runG21Case, 'function');
  assert.equal(api.LIMITS.strongFraction, 0.001); assert.equal(api.LIMITS.capLeaks, 10);
});
test('optional instance fixture retains six controls and adds modes, opacity, curved silhouettes and isolation checks without changing the thirteen baseline checks', () => {
  assert.equal(api.REQUIRED_CHECKS.length, 13);
  assert.deepEqual(api.REQUIRED_INSTANCE_CHECKS, ['instances:placed-sharing', 'instances:depth-hidden', 'instances:pose-drag', 'instances:source-cap', 'instances:wide-face-id', 'instances:scope', 'instances:modes', 'instances:opacity', 'curves:silhouette', 'instances:isolate']);
});
test('instance fixture packets are world-placed once and retain placement only as sharing metadata', () => {
  const a = api.instancePacket('copy-A', [-22, 0, 0]), b = api.instancePacket('copy-B', [22, 0, 0], Math.PI / 2), different = api.instancePacket('different', [0, 0, 0], 0, [10, 8, 16]);
  assert.equal(a.id, 'copy-A'); assert.equal(a.placement[12], -22);
  assert.ok(Math.abs(a.bodies[0].mesh.bounds.min[0] + 26) < 1e-6);
  assert.ok(Math.abs(a.bodies[0].mesh.bounds.max[0] + 18) < 1e-6);
  assert.ok(Math.abs(b.bodies[0].mesh.bounds.min[0] - 16) < 1e-6);
  assert.ok(Math.abs(b.bodies[0].mesh.bounds.max[0] - 28) < 1e-6);
  assert.equal(a.bodies[0].mesh.indices.length, b.bodies[0].mesh.indices.length);
  assert.notEqual(api.volume(a.bodies[0].mesh), api.volume(different.bodies[0].mesh));
});
test('wide-face instance fixture has a used native face 4097 and no added geometry layers', () => {
  const ordinary = api.boxBody('ordinary'), wide = api.wideFaceBody();
  assert.equal(wide.mesh.faces.length, 4098); assert.equal(wide.mesh.faces[4097].index, 4097);
  assert.ok(Array.from(wide.mesh.faceOfVertex).includes(4097));
  assert.equal(wide.mesh.positions.length, ordinary.mesh.positions.length);
  assert.deepEqual(wide.mesh.indices, ordinary.mesh.indices);
  assert.equal(api.volume(wide.mesh), 8000);
});
test('instance section fixture filters body zero but keeps original body one and generated-cap authority', () => {
  const source = [{ id: 'section-instance', bodies: [api.boxBody('removed', [10, 10, 10], [-40, -40, 0]), api.boxBody('native-body')] }];
  for (const section of [{ mode: 'plane', planes: [{ normal: [0, 1, 0], offset: 0 }] }, api.sectionOf(2)]) {
    const [shown] = api.sectionedInstances(source, new Map(), section, false);
    assert.deepEqual(shown.sourceBodies, [1]);
    assert.ok(shown.bodies[0].mesh.faces.some(f => f.id === 'section-cap'));
    for (const f of shown.bodies[0].mesh.faces) if (f.id === 'section-cap') assert.equal(shown.sourceFaces[0][f.index], -1);
  }
});
test('fixture box carries twelve native edges and six native faces, with no triangle diagonals', () => {
  const b = api.boxBody('source'); assert.equal(api.volume(b.mesh), 8000);
  assert.equal(b.mesh.edges.length, 12); assert.equal(b.mesh.faces.length, 6);
  assert.equal(b.mesh.edgeLines.length, 72);
  for (const edge of b.mesh.edges) {
    assert.equal(edge.a.filter((v, k) => v !== edge.b[k]).length, 1);
    assert.equal(edge.faces.length, 2); assert.notEqual(edge.faces[0], edge.faces[1]);
  }
});
for (const count of [2, 3]) test(`${count}-plane cutout stays one source body and agrees with independent ${count === 2 ? 3 : 7}-box analytic volume`, () => {
  const source = api.boxBody('source'), clipped = api.sectionedBodies([source], api.sectionOf(count), false, 'g21-section'), oracle = api.keptBoxes(count), expected = count === 2 ? 6000 : 7000;
  assert.equal(clipped.length, 1); assert.equal(clipped[0].key, source.key);
  assert.equal(api.volume(clipped[0].mesh), expected);
  assert.equal(oracle.bodies.length, (1 << count) - 1);
  assert.equal(oracle.bodies.reduce((s, b) => s + api.volume(b.mesh), 0), expected);
  assert.ok(clipped[0].mesh.faces.some(f => f.id === 'section-cap'));
  assert.ok(oracle.bodies.every(b => b.mesh.edgeLines.length === 0));
});
for (const count of [2, 3]) test(`${count}-plane raster oracle contains only union boundary faces`, () => {
  const oracle = api.keptBoxes(count);
  assert.equal(oracle.selectedFaces.length, count);
  for (let body = 0; body < oracle.bodies.length; body++) {
    const cell = oracle.bodies[body], code = Number(cell.key.slice('oracle-'.length));
    const used = new Set(Array.from(cell.mesh.indices, i => cell.mesh.faceOfVertex[i]));
    for (let k = 0; k < count; k++) {
      const inward = 2 * k + (((code >> k) & 1) ? 1 : 0);
      assert.equal(used.has(inward), (code ^ (1 << k)) === 0);
    }
    for (const selected of oracle.selectedFaces.filter(x => x.body === body)) {
      assert.ok(used.has(selected.face));
      assert.equal(cell.mesh.faces[selected.face].centroid[Math.floor(selected.face / 2)], 0);
    }
  }
});
test('analytic ray oracle distinguishes original front, actual cap, kept-by-third-plane front, and background', () => {
  const min = [-10, -10, -10], max = [10, 10, 10];
  assert.equal(api.analyticBoundary([-60, 16.5, -2], [1, -0.3, 0], min, max, api.sectionOf(2)), 'front');
  assert.equal(api.analyticBoundary([-5, -20, -2], [0, 1, 0], min, max, api.sectionOf(2)), 'cap');
  assert.equal(api.analyticBoundary([-5, -20, -2], [0, 1, 0], min, max, api.sectionOf(3)), 'cap');
  assert.equal(api.analyticBoundary([-5, -20, 2], [0, 1, 0], min, max, api.sectionOf(3)), 'front');
  assert.equal(api.analyticBoundary([100, 100, 100], [1, 0, 0], min, max, api.sectionOf(3)), null);
});
function raster(dpr, draw) {
  const width = 640 * dpr, height = 160 * dpr, data = new Uint8ClampedArray(width * height * 4).fill(255);
  if (draw) for (let x = 20 * dpr; x < 220 * dpr; x++) if (draw((x + 0.5) / dpr - 20)) for (let y = 80 * dpr - 1; y <= 80 * dpr + 1; y++) { const i = (y * width + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
  return { width, height, data };
}
for (const dpr of [1, 2]) test(`synthetic DPR ${dpr} metrics accept 6/4 CSS dash and reject solid, absent and wrong-period controls`, () => {
  const control = raster(dpr), measure = predicate => api.lineCoverage(raster(dpr, predicate), control, [20, 80], [220, 80], dpr);
  const right = measure(s => s % 10 < 6), solid = measure(() => true), absent = measure(() => false), wrong = measure(s => s % 8 < 4);
  const accepts = x => x.onCoverage >= api.LIMITS.dashOnCoverage && x.offCoverage <= api.LIMITS.dashOffCoverage;
  assert.equal(accepts(right), true); assert.equal(accepts(solid), false); assert.equal(accepts(absent), false); assert.equal(accepts(wrong), false);
  assert.equal(solid.coverage, 1); assert.equal(absent.coverage, 0);
});
test('strong-pixel comparison rejects dimension mismatch and detects controlled nonzero differences', () => {
  const a = raster(1), b = raster(1, () => true);
  assert.deepEqual(api.difference(a, a), { pixels: 0, fraction: 0 });
  assert.ok(api.difference(a, b).pixels > 0);
  assert.throws(() => api.difference(a, raster(2)), /sizes differ/);
});
test('synthetic x-ray opacity witness accepts .25 and rejects opaque/empty/same-mode pseudo-controls', () => {
  const solid = rgb => { const image = raster(1); for (let i = 0; i < image.data.length; i += 4) for (let k = 0; k < 3; k++) image.data[i + k] = rgb[k]; return image; };
  const opaque = solid([200, 160, 120]), background = solid([40, 40, 40]), quarter = solid([80, 70, 60]);
  assert.equal(api.opacityWitness(opaque, quarter, background, 1).pass, true);
  assert.equal(api.opacityWitness(opaque, opaque, background, 1).pass, false);
  assert.equal(api.opacityWitness(opaque, background, background, 1).pass, false);
  assert.equal(api.opacityWitness(background, background, background, 1).pass, false, 'empty controls cannot establish opacity');
});
test('WebGL2 opacity probes isolate a real native/cap boundary face without far/internal colour layers', () => {
  const clipped = api.sectionedBodies([api.boxBody('source')], api.sectionOf(2), false, 'g21-section')[0];
  for (const cap of [false, true]) {
    const probe = api.singleOpacityFace(clipped, cap), faceIndices = new Set(Array.from(probe.mesh.indices, i => probe.mesh.faceOfVertex[i]));
    assert.equal(faceIndices.size, 1); assert.ok(probe.mesh.indices.length >= 3);
    const face = probe.mesh.faces[[...faceIndices][0]];
    assert.equal(face.id, cap ? 'section-cap' : 'native-1');
    if (cap) { assert.ok(face.normal[1] < -0.99); assert.ok(Math.abs(face.centroid[1]) < 1e-6); }
  }
});
