import test from 'node:test';
import assert from 'node:assert/strict';
import { anglesOf, appearanceOf, defaultRender, directionFrom, offsetsAt, readRender, withKey } from '../src/engine/render';

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

test('render post (G15d.1): AgX kept, the post read in range; absent, none', () => {
  assert.equal(readRender({ environment: { toneMapping: 'agx' } }).environment.toneMapping, 'agx');
  assert.equal(readRender({ environment: { toneMapping: 'reinhard' } }).environment.toneMapping, 'aces');
  assert.equal(readRender({ environment: {} }).environment.post, undefined);
  assert.deepEqual(readRender({ environment: { post: { grade: 'warm', contrast: 9, saturation: -1, vignette: 0.3 } } }).environment.post, { grade: 'warm', contrast: 1.5, saturation: 0, vignette: 0.3 });
  assert.deepEqual(readRender({ environment: { post: { grade: 'sepia' } } }).environment.post, { grade: 'neutral', contrast: 1, saturation: 1, vignette: 0 });
  // (G15d.2: bloom, 0 – 1; none when 0 or absent.)
  assert.equal(readRender({ environment: { post: { grade: 'neutral', bloom: 4 } } }).environment.post?.bloom, 1);
  assert.ok(!('bloom' in readRender({ environment: { post: { grade: 'neutral', bloom: 0 } } }).environment.post!));
});

test('appearance finishes (G15a): a known kind read with its scale and strength in range and its axis; coat and film in range; else none', async () => {
  const { readAppearance, APPEARANCES } = await import('../src/engine/render');
  const base = defaultRender().defaultAppearance;
  assert.deepEqual(readAppearance({ ...base, finish: { kind: 'turned', scale: 500, strength: -2, axis: [0, 0, 2] } }, base).finish, { kind: 'turned', scale: 100, strength: 0, axis: [0, 0, 2] });
  assert.deepEqual(readAppearance({ ...base, finish: { kind: 'cast' } }, base).finish, { kind: 'cast', scale: 0.5, strength: 0.5 });
  assert.deepEqual(readAppearance({ ...base, finish: { kind: 'brushed', axis: [0, 0, 0] } }, base).finish, { kind: 'brushed', scale: 0.5, strength: 0.5 }, 'a zero axis: none');
  assert.equal(readAppearance({ ...base, finish: { kind: 'polished' } }, base).finish, undefined);
  const coat = readAppearance({ ...base, clearcoat: 3, film: 0.4 }, base);
  assert.equal(coat.clearcoat, 1); assert.equal(coat.film, 0.4);
  const none = readAppearance({ ...base, clearcoat: 0, film: -1 }, base);
  assert.ok(!('clearcoat' in none) && !('film' in none) && !('finish' in none));
  // Every preset reads back as itself.
  for (const p of APPEARANCES) assert.deepEqual(readAppearance(p.appearance, base), p.appearance, p.id);
});

test('render studio environments (G15b): a known kind kept with its strength in range; else none', () => {
  assert.deepEqual(readRender({ environment: { studio: { kind: 'cyclorama', intensity: 20 } } }).environment.studio, { kind: 'cyclorama', intensity: 8 });
  assert.deepEqual(readRender({ environment: { studio: { kind: 'softbox' } } }).environment.studio, { kind: 'softbox', intensity: 1 });
  assert.equal(readRender({ environment: { studio: { kind: 'garage' } } }).environment.studio, undefined);
  assert.equal(readRender({ environment: {} }).environment.studio, undefined);
});

test('render settings: light angles round-trip through directions', () => {
  for (const [az, el] of [[0, 45], [-120, 30], [90, 80]] as const) {
    const d = directionFrom(az, el);
    assert.deepEqual(anglesOf(d), [az, el]);
    assert.ok(d[2] < 0, 'light comes from above, travelling down');
  }
});

test('render animation: keys interpolate linearly and hold at the ends; keys at one time replace each other', () => {
  const keys = withKey(withKey(withKey([], { t: 2, offset: [10, 0, 0] }), { t: 0, offset: [0, 0, 0] }), { t: 2, offset: [20, 0, 4] });
  assert.deepEqual(keys.map(k => k.t), [0, 2]);
  const a = { duration: 4, tracks: { b1: keys }, turntable: false };
  assert.deepEqual(offsetsAt(a, 1).get('b1'), [10, 0, 2]);
  assert.deepEqual(offsetsAt(a, -1).get('b1'), [0, 0, 0]);
  assert.deepEqual(offsetsAt(a, 3).get('b1'), [20, 0, 4]);
  const r = readRender({ animation: { duration: 2, tracks: { b1: [{ t: 5, offset: [1, 2, 3] }, { t: 'x' }], b2: 'no' }, turntable: true } });
  assert.deepEqual(r.animation, { duration: 2, tracks: { b1: [{ t: 2, offset: [1, 2, 3] }] }, turntable: true });
});

test('a texture: kept from a saved document only as an image data URL, its repeat in range; tiled coordinates every repeat', async () => {
  const { readAppearance, tiledUVs } = await import('../src/engine/render');
  const base = defaultRender().defaultAppearance, png = 'data:image/png;base64,iVBORw0KGgo=';
  assert.deepEqual(readAppearance({ ...base, texture: { image: png, scale: 25 } }, base).texture, { image: png, scale: 25 });
  assert.equal(readAppearance({ ...base, texture: { image: 'https://example.com/a.png', scale: 25 } }, base).texture, undefined, 'no outside URLs');
  assert.equal(readAppearance({ ...base, texture: { image: png, scale: -3 } }, base).texture!.scale, 0.1);
  // A vertex on a face looking up Z maps by X and Y; one looking along X by Y and Z.
  const uv = tiledUVs([10, 20, 5, 4, 30, 50], [0, 0, 1, 1, 0, 0], 10);
  assert.deepEqual([...uv].map(x => Math.round(x * 1e6) / 1e6), [1, 2, 3, 5]);
});
