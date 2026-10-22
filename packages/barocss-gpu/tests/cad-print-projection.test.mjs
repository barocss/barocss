// Current-source print display geometry contracts. No renderer, worker, browser or kernel solid evaluation.
// node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-print-projection.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url)), temporary = await mkdtemp(join(tmpdir(), 'cad-print-projection-'));
let api;
try {
  const outfile = join(temporary, 'print.mjs');
  await build({ stdin: { contents: 'export * from "./apps/cad-studio/src/viewport/printProjection.ts"; export * from "./apps/cad-studio/src/viewport/printSupport.ts"; export {clipMeshSection} from "./apps/cad-studio/src/viewport/sectionView.ts"; export {boxBody} from "./packages/barocss-gpu/tests/fixtures/cad-display-browser.ts"; export {printLayers} from "./packages/barocss-cad-model/src/print/layers.ts";', resolveDir: root }, outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', alias: { '@barocss/gpu/viewer': resolve(root, 'packages/barocss-gpu/src/viewer/index.ts'), '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src'), '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') } });
  api = await import(pathToFileURL(outfile).href);
} finally { await rm(temporary, { recursive: true, force: true }); }

const snapshot = value => JSON.stringify(value, (_key, v) => ArrayBuffer.isView(v) ? [...v] : v);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} expected ${expected}`);
const close = (actual, expected) => { assert.equal(actual.length, expected.length); actual.forEach((v, i) => near(v, expected[i])); };
const used = mesh => [...new Set(mesh.indices)].map(i => Array.from(mesh.positions.slice(i * 3, i * 3 + 3)));
function display(bodies, { direction, layerMM = 0.5, k = 0, printed = false } = {}) {
  const model = api.printLayers(bodies.map(b => b.mesh), { layerMM, ...(direction ? { direction } : {}) });
  const { layer, ...summary } = model;
  return { request: 1, summaryKey: 1, summary, layer: layer(k), supportMesh: api.extrudePrintSupport(summary.supportColumns), topMM: Math.min(summary.heightMM, (k + 1) * summary.layerMM.mm), supports: true, printed };
}
function volume(mesh) {
  let sum = 0;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const p = [0, 1, 2].map(k => Array.from(mesh.positions.slice(mesh.indices[t + k] * 3, mesh.indices[t + k] * 3 + 3))), [a, b, c] = p;
    sum += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return sum;
}

test('actual Model +X bed transform is applied once without changing shared source arrays or geometric metadata', () => {
  const body = api.boxBody('native', [2, 4, 6], [3, 7, 11]); body.centroid = [3, 7, 11]; body.inertia = [[1, 0, 0], [0, 2, 0], [0, 0, 3]];
  const face = body.mesh.faces[0]; face.exact = { kind: 'plane', o: [...face.centroid], n: [...face.normal] };
  const source = snapshot(body), nativeArrays = [body.mesh.positions, body.mesh.normals, body.mesh.edgeLines], d = display([body], { direction: [1, 0, 0] }), projected = api.projectPrintBodies([body], d), shown = projected.bodies[0];
  close(shown.mesh.bounds.min, [5, 8, 0]); close(shown.mesh.bounds.max, [9, 14, 2]); close(shown.centroid, [7, 11, 1]);
  close(shown.mesh.faces[0].normal, [0, 0, 1]); close(shown.mesh.faces[0].centroid, [7, 11, 2]); close(shown.mesh.faces[0].exact.n, [0, 0, 1]); close(shown.mesh.faces[0].exact.o, [7, 11, 2]);
  assert.deepEqual(shown.inertia, [[2, 0, 0], [0, 3, 0], [0, 0, 1]]);
  assert.deepEqual(projected.faceSources[0], body.mesh.faces.map(f => f.index)); assert.deepEqual(projected.edgeSources[0], body.mesh.edges.map(e => e.index));
  for (let v = 0; v < body.mesh.positions.length; v += 3) close(api.printPointToModel(Array.from(shown.mesh.positions.slice(v, v + 3)), d.summary.modelToBed), Array.from(body.mesh.positions.slice(v, v + 3)));
  for (const key of ['positions', 'normals', 'edgeLines']) assert.notEqual(shown.mesh[key], body.mesh[key]);
  assert.equal(body.mesh.positions, nativeArrays[0]); assert.equal(body.mesh.normals, nativeArrays[1]); assert.equal(body.mesh.edgeLines, nativeArrays[2]); assert.equal(snapshot(body), source);
  const again = api.projectPrintBodies([body], d); assert.deepEqual(again.bodies[0].mesh.positions, shown.mesh.positions, 'repeated projection of source geometry does not accumulate the bed transform');
});

test('printed top uses layer upper boundary, preserves removed-body ordinals and gives cap triangles no native authority', () => {
  const bodies = [api.boxBody('removed', [2, 2, 2], [0, 0, 10]), api.boxBody('kept', [2, 2, 2], [-10, 0, 1]), api.boxBody('cut', [4, 4, 4], [10, 0, 2])], before = snapshot(bodies);
  const d = display(bodies, { k: 4, printed: true }); near(d.layer.z, 2.25); near(d.topMM, 2.5);
  const out = api.projectPrintBodies(bodies, d); assert.equal(out.bodies.length, 3); assert.deepEqual(out.bodies.map(b => b.key), ['removed', 'kept', 'cut']);
  assert.equal(out.bodies[0].mesh.indices.length, 0); assert.equal(out.bodies[0].mesh.positions.length, 0); assert.deepEqual(out.faceSources[0], []); assert.deepEqual(out.edgeSources[0], []);
  assert.ok(out.bodies[1].mesh.indices.length > 0); close(out.bodies[1].mesh.bounds.max, [-9, 1, 2]);
  const cut = out.bodies[2].mesh, cap = cut.faces.find(f => f.id === 'section-cap'); assert.ok(cap); assert.equal(out.faceSources[2][cap.index], -1);
  const capPoints = Array.from(cut.indices).filter(i => cut.faceOfVertex[i] === cap.index).map(i => cut.positions[i * 3 + 2]); assert.ok(capPoints.length >= 3); capPoints.forEach(z => near(z, 2.5));
  assert.ok(used(cut).every(p => p[2] <= 2.5 + 1e-6));
  for (const f of cut.faces) if (f.id !== 'section-cap') assert.equal(out.faceSources[2][f.index], f.index);
  for (const edge of cut.edges) assert.equal(out.edgeSources[2][edge.index], edge.index);
  const restored = api.projectPrintBodies(bodies, { ...d, printed: false }); assert.ok(restored.bodies[0].mesh.indices.length > 0); assert.equal(restored.bodies[2].mesh.faces.some(f => f.id === 'section-cap'), false); assert.equal(snapshot(bodies), before);
});

test('camera bounds cover the full bed-frame source across layer changes and omit hidden or empty bodies', () => {
  const visible = api.boxBody('tall', [100, 2, 4], [60, 8, 0]), hidden = api.boxBody('hidden', [2, 2, 2], [-200, -100, 100]), empty = api.boxBody('empty', [2000, 2000, 2000]);
  empty.mesh = { ...empty.mesh, indices: new Uint32Array() };
  const bodies = [visible, hidden, empty], before = snapshot(bodies), low = display([visible], { direction: [1, 0, 0], printed: true, k: 0 }), high = display([visible], { direction: [1, 0, 0], printed: true, k: 99 });
  assert.notDeepEqual(api.projectPrintBodies([visible], low).bodies[0].mesh.bounds, api.projectPrintBodies([visible], high).bodies[0].mesh.bounds, 'the printed portion changes');
  const a = api.printSceneBounds(bodies, low.summary.modelToBed, new Set([1])), b = api.printSceneBounds(bodies, high.summary.modelToBed, new Set([1]));
  assert.deepEqual(a, { min: [7, -2, 0], max: [9, 2, 100] }); assert.deepEqual(a, b, 'camera fitting does not follow the growing printed portion');
  assert.ok(api.printSceneBounds(bodies, low.summary.modelToBed).min[2] < 0, 'hidden-body exclusion is explicit');
  assert.equal(api.printSceneBounds(bodies, low.summary.modelToBed, new Set([0, 1])), null); assert.equal(api.printSceneBounds([], low.summary.modelToBed), null);
  assert.equal(snapshot(bodies), before);
});

test('preserved ordinals disambiguate alias names while conflicting metadata and existing caps retain no invented identity', () => {
  const aliased = api.boxBody('aliases'); aliased.mesh.faces[1] = { ...aliased.mesh.faces[1], id: aliased.mesh.faces[0].id, name: aliased.mesh.faces[0].name };
  aliased.mesh.edges[0].names = ['a,b', 'c']; aliased.mesh.edges[1].names = ['a', 'b,c'];
  const d = display([aliased]); const out = api.projectPrintBodies([aliased], d);
  assert.equal(out.faceSources[0][0], 0); assert.equal(out.faceSources[0][1], 1); assert.equal(out.edgeSources[0][0], 0); assert.equal(out.edgeSources[0][1], 1);
  const ambiguous = api.boxBody('ambiguous'); ambiguous.mesh.faces.push({ ...ambiguous.mesh.faces[0], name: 'conflicting face metadata' }); ambiguous.mesh.edges.push({ ...ambiguous.mesh.edges[0], names: ['conflicting edge metadata'] });
  const denied = api.projectPrintBodies([ambiguous], display([ambiguous])); assert.equal(denied.faceSources[0][0], -1); assert.equal(denied.edgeSources[0][0], -1);
  const capBody = api.boxBody('prior-cap'), capMesh = api.clipMeshSection(capBody.mesh, { mode: 'plane', planes: [{ normal: [0, 0, -1], offset: 0 }] }, 'Earlier section'); assert.ok(capMesh);
  const cap = capMesh.faces.find(f => f.id === 'section-cap'); assert.ok(cap);
  capMesh.edges = [...capMesh.edges, { index: capMesh.edges.length, faces: [0, cap.index], names: ['display-cap-boundary'], a: [0, 0, 0], b: [1, 0, 0], straight: true, axis: 'x' }];
  const prior = { ...capBody, mesh: capMesh }, mapped = api.projectPrintBodies([prior], display([prior]));
  assert.equal(mapped.faceSources[0][cap.index], -1); assert.equal(mapped.edgeSources[0][capMesh.edges.length - 1], -1);
});

test('support prisms use actual footprint/z ranges with outward winding and no native face or edge IDs', () => {
  const columns = [{ footprint: new Float64Array([1, 2, 4, 2, 1, 4]), z0: 3, z1: 8 }, { footprint: new Float64Array([-2, -2, -2, 0, 0, 0, 0, -2, -2, -2]), z0: 1, z1: 3 }], before = snapshot(columns);
  const mesh = api.extrudePrintSupport(columns); near(volume(mesh), 3 * 5 + 4 * 2); close(mesh.bounds.min, [-2, -2, 1]); close(mesh.bounds.max, [4, 4, 8]);
  assert.equal(mesh.faces.length, 0); assert.equal(mesh.edges.length, 0); assert.equal(mesh.edgeLines.length, 0); assert.ok(mesh.faceOfVertex.every(f => f === -1));
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const ids = Array.from(mesh.indices.slice(t, t + 3)), [a, b, c] = ids.map(i => Array.from(mesh.positions.slice(i * 3, i * 3 + 3))), u = b.map((n, k) => n - a[k]), v = c.map((n, k) => n - a[k]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], n = Array.from(mesh.normals.slice(ids[0] * 3, ids[0] * 3 + 3));
    assert.ok(cross.reduce((sum, x, k) => sum + x * n[k], 0) > 0, 'triangle winding agrees with its outward flat normal'); near(Math.hypot(...n), 1);
  }
  const clipped = api.clipMeshSection(mesh, { mode: 'plane', planes: [{ normal: [0, 0, -1], offset: -4 }] }, 'Support printed top'); assert.ok(clipped); near(volume(clipped), 3 * 1 + 4 * 2);
  assert.equal(snapshot(columns), before);
});

test('support handles concave polygons, empty/zero-height output and rejects malformed ranges without mutating columns', () => {
  const columns = [{ footprint: new Float64Array([0, 0, 2, 0, 2, 1, 1, 1, 1, 2, 0, 2]), z0: 0, z1: 2 }]; near(volume(api.extrudePrintSupport(columns)), 6);
  assert.equal(api.extrudePrintSupport([]).indices.length, 0); assert.equal(api.extrudePrintSupport([{ ...columns[0], z1: 0 }]).indices.length, 0);
  assert.throws(() => api.extrudePrintSupport([{ ...columns[0], z1: -1 }]), /z range/); assert.throws(() => api.extrudePrintSupport([{ ...columns[0], footprint: new Float64Array([0, 0, 1]) }]), /footprint/);
});
