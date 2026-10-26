import test from 'node:test';
import assert from 'node:assert/strict';
import { traceDataMapPixels, traceScene } from '../dist/viewer/path-trace-scene.js';
import { Geometry, ImageTexture, Mesh } from '../dist/viewer/scene.js';
import { prepareGeometry } from '../dist/viewer/geometry.js';

const owner = { requestRender() {}, sceneMoved() {} };
const mesh = material => new Mesh(new Geometry(prepareGeometry({
  positions: [0, 0, 0, 2, 0, 0, 0, 2, 0], uvs: [0, 0, 1, 0, 0, 1],
}), owner), owner, 1, { material });
const texture = (data, options = {}) => new ImageTexture({ width: data.length / 4, height: 1, data: Uint8Array.from(data) },
  { srgb: false, mipmaps: false, wrap: 'clamp', filter: 'linear', ...options }, owner);

test('progressive data map layers deduplicate by identity while colour and data roles stay separate', () => {
  const shared = texture([128, 64, 192, 255], { wrap: 'repeat', filter: 'nearest' });
  const rough = texture([255, 96, 0, 255]);
  const base = { map: shared, color: '#808080', roughness: 0.75, metallic: 0.5 };
  const mapped = mesh({ ...base, normalMap: shared, roughnessMap: rough, metallicMap: shared, normalScale: [-2, 0.5] });
  const legacy = traceScene([mesh(base)]);
  const scene = traceScene([mapped, mapped]);
  assert.deepEqual(scene.maps, [shared], 'colour layer numbering is independent');
  assert.deepEqual(scene.dataMaps, [shared, rough], 'one raw layer serves multiple data roles and meshes');
  assert.equal(scene.materials.length, 96, 'two materials use the 48-float stride');
  assert.deepEqual([...scene.materials.slice(0, 40)], [...legacy.materials.slice(0, 40)], 'all prior material fields stay in place');
  assert.deepEqual([...scene.materials.slice(40, 48)], [1, 2, 1, 51, -2, 0.5, 0, 0], 'normal flags occupy bits 0–1; rough bits 2–3; metal bits 4–5');
  assert.deepEqual([...scene.materials.slice(88, 96)], [1, 2, 1, 51, -2, 0.5, 0, 0]);
  assert.equal(scene.attributes.length, 64, 'triangle attributes keep their 32-float stride');
  assert.deepEqual([scene.attributes[3], scene.attributes[35]], [0, 1], 'attribute material indices use the extended stride');
});

test('progressive material snapshots keep default and signed normal scales after source changes', () => {
  assert.deepEqual([...traceScene([mesh({})]).materials.slice(40)], [0, 0, 0, 0, 1, 1, 0, 0]);
  const map = texture([255, 128, 255, 255]), scale = [-2, 0];
  const m = mesh({ normalMap: map, normalScale: scale });
  const scene = traceScene([m]), packed = [...scene.materials];
  scale[0] = 9;
  m.material = { normalScale: [3, 4], normalMap: null };
  map.dispose();
  assert.deepEqual([...scene.materials], packed, 'packed values do not alias caller arrays or later material updates');
  assert.deepEqual([...scene.materials.slice(44, 46)], [-2, 0]);
  assert.deepEqual([...traceScene([mesh({ normalScale: [Math.fround(3.4028234663852886e38), -1] })]).materials.slice(44, 46)],
    [Math.fround(3.4028234663852886e38), -1], 'finite f32 limits are retained without clamping');
});

test('progressive scene creation rejects a data texture disposed after material assignment', () => {
  for (const key of ['normalMap', 'roughnessMap', 'metallicMap']) {
    const map = texture([128, 128, 255, 255]), m = mesh({ [key]: map });
    map.dispose();
    assert.throws(() => traceScene([m]), { code: 'TEXTURE_INVALID' }, key);
  }
});

test('progressive raw data copies preserve linear channels and RGB beneath zero alpha', () => {
  const bytes = [128, 64, 192, 0, 255, 127, 1, 255];
  const nearest = texture(bytes, { filter: 'nearest' });
  const same = traceDataMapPixels(nearest, 2, 1);
  assert.deepEqual([...same], bytes, 'data bytes must not receive the linear-to-sRGB colour encoding');
  assert.notEqual(same.buffer, nearest.source.data.buffer, 'the still owns independent pixels');
  assert.deepEqual([...traceDataMapPixels(nearest, 4, 1)], [...bytes.slice(0, 4), ...bytes.slice(0, 4), ...bytes.slice(4), ...bytes.slice(4)]);
  const linear = texture(bytes);
  assert.deepEqual([...traceDataMapPixels(linear, 1, 1)], [192, 96, 97, 128], 'raw channels interpolate independently of alpha and colour transfer');
  nearest.source.data.fill(0); nearest.dispose();
  assert.deepEqual([...same], bytes, 'source edits and disposal cannot alter copied data');
});

test('progressive data atlas enlargement keeps each map repeat or clamp edge addressing', () => {
  const bytes = [0, 20, 255, 0, 255, 220, 55, 255];
  const clamp = texture(bytes), repeat = texture(bytes, { wrap: 'repeat' });
  assert.deepEqual([...traceDataMapPixels(clamp, 4, 1)], [
    0, 20, 255, 0, 64, 70, 205, 64, 191, 170, 105, 191, 255, 220, 55, 255,
  ], 'clamp holds the first and last source texel at the outer samples');
  assert.deepEqual([...traceDataMapPixels(repeat, 4, 1)], [
    64, 70, 205, 64, 64, 70, 205, 64, 191, 170, 105, 191, 191, 170, 105, 191,
  ], 'repeat blends the opposite source edge, independently for all RGBA channels');
});
