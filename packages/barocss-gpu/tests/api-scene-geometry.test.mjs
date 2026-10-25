// Source-only regression cases for Scene's geometry admission and show() ordering. No GPU/device is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, show, Scene, BarocssError } from '../dist/api/index.js';

const triangle = () => ({ positions: [0, 0, 0, 2, 0, 0, 0, 3, 0], indices: [0, 1, 2] });
const invalidMesh = where => error => error instanceof BarocssError && error.code === 'MESH_INVALID' && error.where === where;

function viewerStand() {
  const calls = [];
  return {
    calls,
    clear() { calls.push('clear'); },
    set lights(_value) { calls.push('lights'); },
    setBackground() { calls.push('background'); },
    add(geometry) { calls.push(['add', geometry]); },
    fit() { calls.push('fit'); },
  };
}

test('Scene accepts three-vertex contour triangles and preserves their source arrays', () => {
  const positions = triangle().positions, normals = [0, 0, 1, 0, 0, 1, 0, 0, 1];
  const view = scene().add({ positions, normals, topology: 'lines', contour: true });
  assert.equal(view.data.meshes[0].positions, positions);
  assert.equal(view.data.meshes[0].normals, normals);
  const viewer = viewerStand();
  show(viewer, view);
  assert.deepEqual(viewer.calls.map(call => Array.isArray(call) ? call[0] : call), ['clear', 'add', 'fit']);
  assert.equal(viewer.calls[1][1].positions, positions);
});

test('Scene labels use their anchors with empty positions, including an empty label collection', () => {
  for (const labels of [[], [{ text: 'Origin', at: [4, 5, 6] }]]) {
    const positions = [], view = scene().add({ positions, topology: 'labels', labels });
    assert.equal(view.data.meshes[0].positions, positions);
    assert.equal(view.data.meshes[0].labels, labels);
    const viewer = viewerStand();
    show(viewer, view);
    assert.equal(viewer.calls[1][1].labels, labels);
  }
});

test('Scene keeps rejecting empty non-label geometry', () => {
  for (const topology of ['triangles', 'lines', 'points']) {
    assert.throws(() => scene().add({ positions: [], topology }), invalidMesh('facade'));
  }
});

for (const index of [0.5, -1, 3, 2 ** 32, NaN, Infinity, -Infinity]) {
  test(`Scene refuses malformed triangle index ${String(index)} before presentation`, () => {
    const mesh = { ...triangle(), indices: [0, 1, index] };
    assert.throws(() => scene().add(mesh), invalidMesh('facade'));
    const viewer = viewerStand();
    assert.throws(() => show(viewer, new Scene({ frame: 'z-up', meshes: [triangle(), mesh] })), invalidMesh('show'));
    assert.deepEqual(viewer.calls, []);
  });
}

test('Scene uses the Viewer rules for geometry cardinality and contour admission', () => {
  const bad = [
    { positions: [0, 0] },
    { positions: [0, 0, 0, 1, 0, 0] }, // An incomplete unindexed triangle.
    { ...triangle(), indices: [0, 1] },
    { positions: triangle().positions, topology: 'lines' }, // Three is not a segment pair.
    { ...triangle(), normals: [0, 0, 1] },
    { ...triangle(), uvs: [0, 0] },
    { ...triangle(), colors: [1, 0, 0] },
    { ...triangle(), faces: [1, 2] },
    { ...triangle(), topology: 'lines', contour: true }, // Missing contour normals.
    { ...triangle(), contour: true, normals: Array(9).fill(1) }, // Contours require line topology.
    { ...triangle(), topology: 'lines', contour: true, normals: Array(9).fill(1), edges: [0] },
    { ...triangle(), positions: [0, 0, 0, 2, 0, 0, 0, Infinity, 0] },
    { positions: [], topology: 'labels', labels: [{ text: 'Bad anchor', at: [0, NaN, 0] }] },
  ];
  for (const mesh of bad) assert.throws(() => scene().add(mesh), invalidMesh('facade'));
});

test('show rechecks shared-array mutations before clear, lights, background, or the first add', () => {
  const mesh = triangle(), view = scene().add([triangle(), mesh])
    .light({ kind: 'directional', direction: [0, 0, -1] }).background('#123456');
  mesh.indices[2] = 0.5;
  const viewer = viewerStand();
  assert.throws(() => show(viewer, view), invalidMesh('show'));
  assert.deepEqual(viewer.calls, []);
});

test('Scene rethrows unexpected input exceptions without converting them to MESH_INVALID', () => {
  const sentinel = new Error('caller position getter');
  const positions = { length: 9, get 0() { throw sentinel; } };
  assert.throws(() => scene().add({ positions }), error => error === sentinel);
  const viewer = viewerStand();
  assert.throws(() => show(viewer, new Scene({ frame: 'z-up', meshes: [{ positions }] })), error => error === sentinel);
  assert.deepEqual(viewer.calls, []);
});

test('valid triangles, segment pairs and points retain original arrays through add and show', () => {
  const meshes = [triangle(), { positions: [0, 0, 0, 1, 2, 3], topology: 'lines' }, { positions: [1, 2, 3], topology: 'points' }];
  const view = scene().add(meshes), viewer = viewerStand();
  show(viewer, view);
  const added = viewer.calls.filter(Array.isArray);
  assert.equal(added.length, meshes.length);
  meshes.forEach((mesh, i) => {
    assert.equal(view.data.meshes[i].positions, mesh.positions);
    assert.equal(added[i][1].positions, mesh.positions);
    if (mesh.indices) assert.equal(added[i][1].indices, mesh.indices);
  });
});

test('indexed contour triangles retain their indices through Scene and show', () => {
  const mesh = { ...triangle(), topology: 'lines', contour: true, normals: [0, 0, 1, 0, 0, 1, 0, 0, 1] };
  const view = scene().add(mesh), viewer = viewerStand();
  show(viewer, view);
  assert.equal(view.data.meshes[0].indices, mesh.indices);
  const geometry = viewer.calls.find(Array.isArray)[1];
  assert.equal(geometry.indices, mesh.indices);
  assert.equal(geometry.contour, true);
});

test('Scene refuses finite positions that overflow the Viewer Float32 representation', () => {
  const mesh = triangle();
  mesh.positions[0] = Number.MAX_VALUE;
  assert.equal(Number.isFinite(mesh.positions[0]), true, 'the original JavaScript coordinate is finite');
  assert.throws(() => scene().add(mesh), invalidMesh('facade'));
  const viewer = viewerStand();
  assert.throws(() => show(viewer, new Scene({ frame: 'z-up', meshes: [triangle(), mesh] })), invalidMesh('show'));
  assert.deepEqual(viewer.calls, []);
});

test('show rechecks shared label anchors before touching the Viewer', () => {
  const labels = [{ text: 'Origin', at: [4, 5, 6] }];
  const view = scene().add([triangle(), { positions: [], topology: 'labels', labels }])
    .light({ kind: 'directional', direction: [0, 0, -1] }).background('#123456');
  labels[0].at[1] = NaN;
  const viewer = viewerStand();
  assert.throws(() => show(viewer, view), invalidMesh('show'));
  assert.deepEqual(viewer.calls, []);
});
