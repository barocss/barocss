// Source-only instance geometry/provenance regressions. No browser, server or kernel evaluation.
// node --test --test-concurrency=1 packages/barocss-gpu/tests/instance-provenance.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url)), temp = await mkdtemp(join(tmpdir(), 'instance-provenance-'));
let api;
try {
  const outfile = join(temp, 'source.mjs');
  await build({ stdin: { contents: "export {topologyKey,movedCopy} from './apps/cad-studio/src/viewport/instanceGeometry.ts'; export {sectionedInstances} from './apps/cad-studio/src/viewport/sectionView.ts'; export {motionOf} from './apps/cad-studio/src/viewport/instancePose.ts'; export {posedBody} from './packages/barocss-cad-model/src/robot/preview.ts'; export {boxBody,sectionOf} from './packages/barocss-gpu/tests/fixtures/cad-display-browser.ts';", resolveDir: root, loader: 'ts' }, outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', alias: { '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src'), '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') } });
  api = await import(pathToFileURL(outfile).href);
} finally { await rm(temp, { recursive: true, force: true }); }
const identity = () => Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const cpu = (items, poses = new Map(), section = api.sectionOf(2)) => api.sectionedInstances(items, poses, section, false);
const snapshot = value => JSON.stringify(value, (_key, v) => ArrayBuffer.isView(v) ? [...v] : v);

test('extracted sharing helpers retain topology and rigid-copy checks for positions, normals and native edge lines', () => {
  const body = api.boxBody('copy'), T = Float64Array.from([0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 30, -7, 4, 1]);
  const before = snapshot(body), moved = api.posedBody(body, api.motionOf(T));
  assert.equal(api.topologyKey(moved.mesh), api.topologyKey(body.mesh));
  assert.equal(api.movedCopy(body.mesh, moved.mesh, T), true);
  assert.equal(api.movedCopy(body.mesh, moved.mesh, identity()), false);
  const changed = { ...moved.mesh, indices: moved.mesh.indices.slice() }; changed.indices[0] = changed.indices[1];
  assert.equal(api.movedCopy(body.mesh, changed, T), false);
  const differentNormal = { ...moved.mesh, normals: moved.mesh.normals.slice() }; differentNormal.normals[0] += 0.1;
  assert.equal(api.movedCopy(body.mesh, differentNormal, T), false);
  assert.equal(snapshot(body), before);
});

test('CPU cutout body filtering retains original ordinals and stable instance/body identities without mutating source', () => {
  const items = [{ id: 'part-A', bodies: [api.boxBody('removed', [10, 10, 10], [-30, -30, 0]), api.boxBody('kept')] }], before = snapshot(items);
  const [shown] = cpu(items);
  assert.equal(shown.id, 'part-A'); assert.equal(shown.bodies.length, 1); assert.equal(shown.bodies[0].key, 'kept');
  assert.deepEqual(shown.sourceBodies, [1]);
  assert.equal(shown.sourceFaces.length, 1); assert.equal(shown.sourceEdges.length, 1);
  assert.equal(snapshot(items), before);
});

test('cutout duplicate native faces and edges map to original indices; all generated caps have no native face authority', () => {
  const source = api.boxBody('source'), [shown] = cpu([{ id: 'copy', bodies: [source] }]);
  const mesh = shown.bodies[0].mesh, faces = shown.sourceFaces[0], edges = shown.sourceEdges[0];
  assert.ok(mesh.faces.length > source.mesh.faces.length);
  const duplicates = mesh.faces.filter(f => f.id === 'native-0'); assert.ok(duplicates.length >= 2);
  for (const f of duplicates) assert.equal(faces[f.index], 0);
  const caps = mesh.faces.filter(f => f.id === 'section-cap'); assert.ok(caps.length);
  for (const f of caps) assert.equal(faces[f.index], -1);
  for (const edge of mesh.edges) {
    const expected = source.mesh.edges.find(e => JSON.stringify([...e.names].sort()) === JSON.stringify([...edge.names].sort()));
    assert.equal(edges[edge.index], expected.index);
  }
  assert.equal(Object.keys(faces).length, faces.length, 'face map is dense');
  assert.equal(Object.keys(edges).length, edges.length, 'edge map is dense');
});

test('existing packet provenance composes through another CPU section without adopting displayed ordinals', () => {
  const body = api.boxBody('source'), items = [{ id: 'composed', bodies: [body], sourceBodies: [9], sourceFaces: [body.mesh.faces.map(f => f.index + 100)], sourceEdges: [body.mesh.edges.map(e => e.index + 200)] }];
  const [shown] = cpu(items);
  assert.deepEqual(shown.sourceBodies, [9]);
  for (const f of shown.bodies[0].mesh.faces) assert.equal(shown.sourceFaces[0][f.index], f.id === 'section-cap' ? -1 : 100 + Number(f.id.slice(7)));
  assert.ok(shown.sourceEdges[0].every(i => i >= 200));
  const [again] = cpu([shown]); assert.deepEqual(again.sourceBodies, [9]);
  for (const f of again.bodies[0].mesh.faces) assert.equal(again.sourceFaces[0][f.index], f.id === 'section-cap' ? -1 : 100 + Number(f.id.slice(7)));
});

test('ambiguous native edge names and face identity produce -1 rather than a plausible original index', () => {
  const body = api.boxBody('ambiguous'), first = body.mesh.edges[0];
  body.mesh = { ...body.mesh, edges: [...body.mesh.edges, { ...first, index: body.mesh.edges.length }] };
  const [shown] = cpu([{ id: 'copy', bodies: [body] }]);
  for (const edge of shown.bodies[0].mesh.edges) if (JSON.stringify(edge.names) === JSON.stringify(first.names)) assert.equal(shown.sourceEdges[0][edge.index], -1);
  const duplicatedFace = api.boxBody('face-ambiguous');
  duplicatedFace.mesh = { ...duplicatedFace.mesh, faces: [...duplicatedFace.mesh.faces, { ...duplicatedFace.mesh.faces[0], index: duplicatedFace.mesh.faces.length }] };
  const [faceShown] = cpu([{ id: 'copy', bodies: [duplicatedFace] }]);
  for (const face of faceShown.bodies[0].mesh.faces) if (face.id === 'native-0') assert.equal(faceShown.sourceFaces[0][face.index], -1);
});

test('full edge-name tokens stay distinct and generated cap adjacency never becomes a native edge', () => {
  const body = api.boxBody('names'), first = body.mesh.edges[0], capFace = { ...body.mesh.faces[0], index: body.mesh.faces.length, id: 'section-cap', name: 'section' };
  body.mesh = { ...body.mesh, faces: [...body.mesh.faces, capFace], edges: [{ ...first, names: ['a,b', 'c'] }, ...body.mesh.edges.slice(1), { ...first, index: 12, names: ['a', 'b,c'] }, { ...first, index: 13, faces: [first.faces[0], capFace.index], names: ['cap-edge'] }] };
  const [shown] = cpu([{ id: 'copy', bodies: [body] }]);
  for (const edge of shown.bodies[0].mesh.edges) {
    if (JSON.stringify(edge.names) === '["a,b","c"]') assert.equal(shown.sourceEdges[0][edge.index], 0);
    if (JSON.stringify(edge.names) === '["a","b,c"]') assert.equal(shown.sourceEdges[0][edge.index], 12);
    if (edge.names[0] === 'cap-edge') assert.equal(shown.sourceEdges[0][edge.index], -1);
  }
});

test('pose copies keep source arrays unchanged and GPU path returns the original packet without adding provenance', () => {
  const source = api.boxBody('posed', [10, 10, 10], [-30, -30, 0]), items = [{ id: 'moved', bodies: [source] }], before = snapshot(items), T = identity();
  T[12] = 30; T[13] = 30;
  const poses = new Map([['moved', T]]), [shown] = cpu(items, poses);
  assert.equal(shown.bodies.length, 1); assert.equal(shown.bodies[0].key, 'posed'); assert.deepEqual(shown.sourceBodies, [0]);
  assert.equal(snapshot(items), before);
  assert.equal(api.sectionedInstances(items, poses, api.sectionOf(2), true), items);
  assert.equal('sourceBodies' in items[0], false);
});
