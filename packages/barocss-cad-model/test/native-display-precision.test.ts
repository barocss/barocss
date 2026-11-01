import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { importStep, tessellateBrep, transformBrep, type Brep } from '@barocss/cad';
import { bodyMesh, triangleMesh, type DisplayMesh } from '../src/engine/mesh';
import { partBreps, placeBody, shareMeshes, type BodyResult, type EvalResult } from '../src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { MeshSender, MeshReceiver } from '../src/engine/meshWire';
import { meshesOf } from '../src/api/core';
import { StudioPart } from '../src/api/part';
import { studioBackend } from '../src/api/studio';

// Reuse the small literal STEP generator; no browser/native capture is committed.
const fixtureUrl = resolve(import.meta.dirname, '../../barocss-cad/test/brep-mass-translation-fixtures.mjs');
const { massTranslationSphereStep } = await import(fixtureUrl) as {
  massTranslationSphereStep(options?: { radius?: number; center?: number[] }): string;
};
const far = [999000, -998000, 997000], identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function bounds(P: ArrayLike<number>) {
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], P[i + k]); max[k] = Math.max(max[k], P[i + k]); }
  return { min, max };
}
function assertDistinct(mesh: Pick<DisplayMesh, 'positions' | 'indices' | 'bounds'>): void {
  assert.ok(mesh.bounds.max.every((x, k) => x > mesh.bounds.min[k]), 'genuine mesh bounds retain nonzero extents');
  const P = mesh.positions, I = mesh.indices;
  for (let t = 0; t < I.length; t += 3) {
    const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
    const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    assert.ok(Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) > 0, 'native display triangles remain nondegenerate');
  }
}
function nativeBox(): Brep {
  return transformBrep(partBreps(rectanglePart(.002, .003, .004))[0].brep, { matrix: identity as [number, number, number, number, number, number, number, number, number], offset: far as [number, number, number] });
}
function asBody(mesh: DisplayMesh): BodyResult { return { key: 'precision', family: 'curved', mesh, volume: null, mass: null }; }
function result(...meshes: DisplayMesh[]): EvalResult { return { ok: true, revision: 1, wallTime: 0, bodies: meshes.map(asBody) }; }

for (const [name, radius, center] of [
  ['far tiny', .001, far], ['centered tiny', .001, [0, 0, 0]], ['ordinary', 5, [0, 0, 0]],
] as const) test(`native ${name} display keeps original kernel world coordinates and genuine bounds`, () => {
  const b = importStep(massTranslationSphereStep({ radius, center: [...center] })), before = structuredClone(b), kernel = tessellateBrep(b), mesh = bodyMesh(b, 1);
  assertDistinct(mesh);
  assert.ok(mesh.positions instanceof Float64Array && mesh.edgeLines instanceof Float64Array);
  assert.deepEqual(Array.from(mesh.positions), Array.from(kernel.positions));
  assert.deepEqual(mesh.bounds, bounds(kernel.positions));
  assert.deepEqual(b, before);
});

test('native tiny far box retains every real edge-line coordinate at the kernel precision', () => {
  const b = nativeBox(), before = structuredClone(b), kernel = tessellateBrep(b), mesh = bodyMesh(b, 1), points = new Set<string>();
  for (const edge of kernel.edges) for (let i = 0; i < edge.points.length; i += 3) points.add(Array.from(edge.points.slice(i, i + 3)).join(','));
  assertDistinct(mesh);
  assert.ok(mesh.edgeLines instanceof Float64Array && mesh.edgeLines.length > 0);
  for (let i = 0; i < mesh.edgeLines.length; i += 6) {
    const a: number[] = Array.from(mesh.edgeLines.slice(i, i + 3)), c: number[] = Array.from(mesh.edgeLines.slice(i + 3, i + 6));
    assert.ok(points.has(a.join(',')) && points.has(c.join(',')), 'line endpoints are original world kernel samples');
    assert.notDeepEqual(a, c, 'native display edge segment stays distinct');
  }
  assert.deepEqual(mesh.bounds, bounds(mesh.positions)); assert.deepEqual(b, before);
});

for (const sharing of [false, true]) for (const [name, matrix] of [
  ['identity', identity], ['cardinal turn', [0, -1, 0, 1, 0, 0, 0, 0, 1]], ['reflection', [-1, 0, 0, 0, 1, 0, 0, 0, 1]],
] as const) test(`native placement ${name}, sharing ${sharing}, retains doubles without changing storage ownership`, () => {
  const b = importStep(massTranslationSphereStep({ center: [0, 0, 0] })), mesh = bodyMesh(b, 1), before = structuredClone(mesh), body = asBody(mesh);
  shareMeshes(sharing);
  let placed: BodyResult;
  try { placed = placeBody(body, matrix, far); } finally { shareMeshes(false); }
  const P = placed.mesh.positions;
  assertDistinct(placed.mesh); assert.ok(P instanceof Float64Array && placed.mesh.edgeLines instanceof Float64Array);
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) assert.equal(P[i + k], matrix[3 * k] * before.positions[i] + matrix[3 * k + 1] * before.positions[i + 1] + matrix[3 * k + 2] * before.positions[i + 2] + far[k]);
  assert.deepEqual(placed.mesh.bounds, bounds(P));
  assert.equal(P === mesh.positions, !sharing);
  if (sharing) assert.deepEqual(mesh, before);
});

test('native placed edge lines retain the direct Number transform of their original stored coordinates', () => {
  const mesh = bodyMesh(nativeBox(), 1), before = structuredClone(mesh), t = [-.0002, .0003, -.0004], placed = placeBody(asBody(mesh), identity, t);
  assert.ok(placed.mesh.edgeLines instanceof Float64Array);
  for (let i = 0; i < placed.mesh.edgeLines.length; i++) assert.equal(placed.mesh.edgeLines[i], before.edgeLines[i] + t[i % 3]);
  assert.deepEqual(placed.mesh.bounds, bounds(placed.mesh.positions));
});

test('mixed native doubles and legacy floats keep class, independent buffers and exact values through Wire transfer and token reuse', () => {
  const native = bodyMesh(nativeBox(), 1), before = structuredClone(native), legacy = triangleMesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2], null, 'legacy');
  assert.ok(legacy.positions instanceof Float32Array && legacy.edgeLines instanceof Float32Array);
  const sender = new MeshSender(), receiver = new MeshReceiver(), first = sender.pack('precision', result(native, legacy));
  assert.equal(first.transfer.length, 12);
  const transferred = structuredClone(first.result, { transfer: first.transfer }), received = receiver.unpack('precision', transferred);
  assert.ok(received.ok);
  const own = received.bodies[0].mesh;
  assert.ok(own.positions instanceof Float64Array && own.edgeLines instanceof Float64Array);
  assert.ok(received.bodies[1].mesh.positions instanceof Float32Array);
  assert.deepEqual(own, native); assert.notEqual(own.positions.buffer, native.positions.buffer); assert.notEqual(own.edgeLines.buffer, native.edgeLines.buffer);
  assert.deepEqual(native, before, 'transfer does not detach or mutate the worker-kept mesh');
  const second = sender.pack('precision', result(native, legacy)); assert.equal(second.transfer.length, 0);
  const reused = receiver.unpack('precision', structuredClone(second.result)); assert.ok(reused.ok);
  assert.equal(reused.bodies[0].mesh, own); assert.equal(reused.bodies[1].mesh, received.bodies[1].mesh);
});

test('Model mesh facade returns native world doubles while the legacy triangle generator retains its Float32 profile', () => {
  const doc: StudioDoc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [{ kind: 'import', name: 'far sphere', step: massTranslationSphereStep(), id: 'n0', solids: 1 }], outputs: {} };
  const before = structuredClone(doc), mesh = meshesOf(doc)[0];
  assert.ok(mesh.positions instanceof Float64Array && mesh.lines instanceof Float64Array);
  const inherited = new StudioPart(studioBackend, 'precision', doc).meshes()[0];
  assert.ok(inherited.positions instanceof Float64Array && inherited.lines instanceof Float64Array, 'shared Part backend preserves the same native world coordinate profile');
  assert.deepEqual(inherited.positions, mesh.positions); assert.deepEqual(inherited.lines, mesh.lines);
  assert.deepEqual(doc, before);
  const legacy = triangleMesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2], null, 'legacy');
  assert.ok(legacy.positions instanceof Float32Array && legacy.edgeLines instanceof Float32Array);
});

test('legacy Float32 placement keeps its existing storage profile', () => {
  const mesh = triangleMesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2], null, 'legacy'), source = mesh.positions.slice();
  const placed = placeBody(asBody(mesh), identity, [.1, .2, .3]);
  assert.ok(placed.mesh.positions instanceof Float32Array && placed.mesh.edgeLines instanceof Float32Array);
  for (let i = 0; i < source.length; i++) assert.equal(placed.mesh.positions[i], Math.fround(source[i] + [.1, .2, .3][i % 3]));
  assert.deepEqual(placed.mesh.bounds, bounds(placed.mesh.positions));
});
