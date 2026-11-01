import test from 'node:test';
import assert from 'node:assert/strict';
import { PRINT_LAYERS_VERSION } from '@barocss/cad-model/print/layers';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';
import { CLEARANCE_MAP_VERSION, type ClearanceMap, type PlacedBody } from '@barocss/cad-model/team/clearanceMap';
import { clearanceOverlays } from '../src/viewport/clearanceAnalysis';
import { PrintOverlayGeometry } from '../src/viewport/printOverlayGeometry';
import type { PrintDisplay } from '../src/viewport/printDisplay';

// Synthetic CPU meshes exercise actual draw adapters. No native geometry or GPU image proof.
function mesh(positions: Float32Array | Float64Array): DisplayMesh {
  return { positions, normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]),
    faceOfVertex: new Float32Array(3), faces: [], edgeLines: new Float32Array(), edgeOfSegment: new Float32Array(), edges: [], bounds: { min: [0, 0, 0], max: [1, 1, 0] } };
}
function clearance(m: DisplayMesh) {
  const body: PlacedBody = { key: 'a', mesh: m, brep: null, pose: { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] } };
  const map: ClearanceMap = { version: CLEARANCE_MAP_VERSION, revision: 'synthetic', near: { value: 1, source: 'input' }, pending: 0,
    timing: { pruneTime: 0, clearanceTime: 0, bandTime: 0 }, pairs: [{ a: 'a', b: 'b', state: 'overlap', minGap: 0, pose: 'identity',
      closest: { a: [0, 0, 0], b: [0, 0, 0], faceA: 'a', faceB: 'b' }, overlap: { volume: 1, mesh: m } }] };
  const result = clearanceOverlays(map, [body]); assert.equal(result.length, 1); return result[0];
}
function print(m: DisplayMesh) {
  const display: PrintDisplay = { request: 1, summaryKey: 1,
    summary: { version: PRINT_LAYERS_VERSION, direction: [0, 0, 1], directionSource: 'default', modelToBed: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], layerHeight: { value: .2, basis: 'set' }, overhangLimit: { value: 45, basis: 'set' }, count: 5, height: 1, supportColumns: [], supportVolume: 0, basis: 'display mesh' },
    layer: { k: 0, z: 0, contours: [], overhang: [], support: [] },
    supportMesh: m, top: 0, supports: true, printed: false };
  const result = new PrintOverlayGeometry().update(display).find(draw => draw.name === 'supports');
  assert.ok(result); return result;
}

test('clearance and print adapters copy double positions only for draw payloads and retain original canonical arrays and indices', () => {
  const positions = new Float64Array([999000, -998000, 997000, 999000.001, -998000, 997000, 999000, -997999.999, 997000]);
  const m = mesh(positions), before = positions.slice(), expected = new Float32Array(positions);
  const c = clearance(m), p = print(m);
  for (const draw of [c, p]) {
    assert.ok(draw.positions instanceof Float32Array); assert.deepEqual(draw.positions, expected);
    assert.equal(draw.positions.byteLength, positions.length * 4); assert.equal(draw.indices, m.indices);
    assert.notEqual(draw.positions.buffer, positions.buffer);
  }
  assert.equal(m.positions, positions); assert.deepEqual(positions, before);
  assert.deepEqual(c.normals, new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 'Normals use original double triangle before draw rounding collapses its vertices');
  assert.equal(p.normals, m.normals);
});

test('existing float draw payload identity and integer indices remain unchanged at both adapters', () => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), m = mesh(positions);
  for (const draw of [clearance(m), print(m)]) {
    assert.equal(draw.positions, positions); assert.equal(draw.indices, m.indices);
  }
});
