import test from 'node:test';
import assert from 'node:assert/strict';
import { anglesOf, appearanceOf, defaultRender, directionFrom, readRender } from '../src/engine/render';

test('render settings: read back with defaults for anything missing or out of range', () => {
  assert.deepEqual(readRender(undefined), defaultRender());
  const r = readRender({ appearances: { b1: { color: '#abc', metallic: 3, roughness: -1 }, b2: 'nonsense' }, lights: [
    { kind: 'directional', direction: [0, 0, -1], intensity: 2, castShadow: true },
    { kind: 'spot', position: [0, 0, 10], angle: 200 },
    { kind: 'laser' },
  ], environment: { toneMapping: 'none', grid: true, exposure: 99 }, camera: { target: [1, 2, 3], distance: 50, ortho: true } });
  assert.deepEqual(r.appearances.b1, { color: '#abc', metallic: 1, roughness: 0, opacity: 1 });
  assert.deepEqual(r.appearances.b2, r.defaultAppearance);
  assert.deepEqual(r.lights.map(l => l.kind), ['directional', 'spot']);
  assert.equal(r.lights[1].kind === 'spot' && r.lights[1].angle, 89);
  assert.equal(r.environment.toneMapping, 'none'); assert.equal(r.environment.grid, true); assert.equal(r.environment.exposure, 8);
  assert.deepEqual(r.camera?.target, [1, 2, 3]); assert.equal(r.camera?.ortho, true);
  assert.equal(appearanceOf(r, 'b9'), r.defaultAppearance);
});

test('render settings: light angles round-trip through directions', () => {
  for (const [az, el] of [[0, 45], [-120, 30], [90, 80]] as const) {
    const d = directionFrom(az, el);
    assert.deepEqual(anglesOf(d), [az, el]);
    assert.ok(d[2] < 0, 'light comes from above, travelling down');
  }
});
