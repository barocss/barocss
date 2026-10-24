import test from 'node:test';
import assert from 'node:assert/strict';
import { finishOf } from '../src/viewport/finish';

test('G15a: a look\'s finish as the viewer takes it — centred on its mesh, Z when no axis; none clears finish, coat and film', () => {
  const none = { finish: null, clearcoat: 0, film: 0 };
  assert.deepEqual(finishOf(null, null), none);
  assert.deepEqual(finishOf({ color: '#ffffff', metallic: 1, roughness: 0.3, opacity: 1 }, [0, 0, 0]), none);
  const positions = new Float32Array([10, 20, 0, 30, 40, 10]);
  assert.deepEqual(finishOf({ color: '#ffffff', metallic: 1, roughness: 0.3, opacity: 1, finish: { kind: 'turned', scale: 0.3, strength: 0.6 } }, positions),
    { finish: { kind: 'turned', scale: 0.3, strength: 0.6, axis: [0, 0, 1], origin: [20, 30, 5] }, clearcoat: 0, film: 0 });
  assert.deepEqual(finishOf({ color: '#a8161a', metallic: 0, roughness: 0.5, opacity: 1, clearcoat: 1 }, positions), { finish: null, clearcoat: 1, film: 0 });
});
