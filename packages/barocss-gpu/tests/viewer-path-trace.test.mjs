import test from 'node:test';
import assert from 'node:assert/strict';
import { traceScene, traceSize } from '../dist/viewer/path-trace-scene.js';
import { Geometry, Mesh } from '../dist/viewer/scene.js';
import { prepareGeometry } from '../dist/viewer/geometry.js';
import { translation } from '../dist/viewer/math.js';
import { packedRayHit } from '../dist/compute/bvhPack.js';
const owner = { requestRender() {}, sceneMoved() {} };
const mesh = options => new Mesh(new Geometry(prepareGeometry({ positions: [0, 0, 0, 2, 0, 0, 0, 2, 0], uvs: [0, 0, 1, 0, 0, 1] }), owner), owner, 1, options ?? {});
test('path trace packed source ids, material and instance attributes survive world transforms', () => {
  const m = mesh({ material: { color: '#ff0000', metallic: 0.75, roughness: 0.2, finish: { kind: 'brushed', scale: 2 }, clearcoat: 0.4, film: 0.5 }, transform: translation([3, 4, 0]), instances: { transforms: [...translation([0, 0, 5]), ...translation([10, 0, 0])], colors: [1, 0.5, 1, 0.25, 1, 1] } });
  const p = traceScene([m]);
  assert.equal(p.bvh.triangleCount, 2); assert.equal(p.attributes.length, 64); assert.equal(p.materials.length, 48);
  assert.deepEqual([...p.materials.slice(16, 21)], [1, 0, 0, 1, 0.75]);
  assert.equal(p.materials[24], 5); assert.equal(p.materials[25], 2); assert.equal(p.materials[35], 0.5);
  assert.equal(p.attributes[0], 0); assert.equal(p.attributes[2], 1); assert.equal(p.attributes[3], 0);
  assert.deepEqual([...p.attributes.slice(24, 30)], [0, 0, 1, 0, 0, 1]);
  assert.equal(packedRayHit(p.bvh, 3.5, 4.5, 10, 0, 0, -1), 5);
  assert.equal(packedRayHit(p.bvh, 13.5, 4.5, 10, 0, 0, -1), 10);
  const old = [...p.materials]; m.material = { roughness: 0.9 }; m.transform = translation([90, 0, 0]);
  assert.deepEqual([...p.materials], old); assert.equal(packedRayHit(p.bvh, 3.5, 4.5, 10, 0, 0, -1), 5);
});
test('path trace excludes invisible/unbounded overlays and refuses unsupported surfaces', () => {
  const a = mesh({ visible: false }), b = mesh({ bounded: false }), c = mesh();
  const catcher = mesh({ material: { shadowOnly: true } });
  assert.equal(traceScene([a, b, catcher, c]).bvh.triangleCount, 1);
  assert.throws(() => traceScene([a, b]), { code: 'PATH_TRACE_UNSUPPORTED' });
  c.material = { shader: { expression: 'vec3f(1.0)' } };
  assert.throws(() => traceScene([c]), { code: 'PATH_TRACE_UNSUPPORTED' });
});
test('path trace uses inverse transpose normals under an instance scale', () => {
  const m = mesh({ instances: { transforms: [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1] } });
  const p = traceScene([m]); assert.deepEqual([...p.attributes.slice(0, 3)], [0, 0, 1]);
});
test('path trace refuses invalid output sizes before allocation', () => {
  for (const pair of [[0, 1], [1.5, 2], [1, NaN], [4097, 1]]) assert.throws(() => traceSize(...pair, 4096), { code: 'SIZE_INVALID' });
  assert.doesNotThrow(() => traceSize(321, 241, 4096));
});
