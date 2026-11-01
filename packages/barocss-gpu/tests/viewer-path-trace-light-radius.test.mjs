// CPU light-storage and admission contracts; no GPU shader, visibility or image claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { traceLights } from '../dist/viewer/path-trace-lights.js';
import { ViewerError } from '../dist/viewer/viewer-error.js';

const point = overrides => ({ kind: 'point', position: [3, -4, 5], color: '#00f', intensity: 0.75, range: 12, ...overrides });
const spot = overrides => ({ kind: 'spot', position: [-3, 2, 9], direction: [0, 0, -2], color: '#f00', intensity: 3, range: 20, angle: 60, penumbra: 0.5, ...overrides });
const lightError = error => error instanceof ViewerError && error.code === 'LIGHT_INVALID';

test('empty path-trace light input retains one zero-filled 16-float storage record', () => {
  const packed = traceLights([]);
  assert.ok(packed instanceof Float32Array); assert.equal(packed.length, 16);
  assert.deepEqual([...packed], new Array(16).fill(0));
});

test('path-trace light storage preserves the original 16-float layout, linear colour, normalized direction and spot cone', () => {
  const directional = { kind: 'directional', direction: [2, 0, 0], color: [0.5, 1, 0], intensity: 2 };
  const packed = traceLights([directional, point(), spot()]);
  assert.equal(packed.length, 48);
  assert.deepEqual(packed, Float32Array.from([
    0, 0, 0, 0, 1, 0, 0, 0, 0.21404114048223255, 1, 0, 2, 0, 0, 0, 0,
    3, -4, 5, 1, 0, 0, 0, 12, 0, 0, 1, 0.75, 0, 0, 0, 0,
    -3, 2, 9, 2, 0, 0, -1, 20, 1, 0, 0, 3, Math.sqrt(3) / 2, 0.5, 0, 0,
  ]));
  const defaults = traceLights([{ kind: 'point', position: [0, 0, 0] }, { kind: 'spot', position: [0, 0, 0], direction: [0, 0, -1] }]);
  assert.deepEqual([...defaults.slice(8, 12)], [1, 1, 1, 1]);
  assert.equal(defaults[7], 0); assert.equal(defaults[23], 0);
});

test('enabled point and spot radii occupy only cone z while directional radius is ignored', () => {
  const lights = [{ kind: 'directional', direction: [0, 0, -1], castShadow: true, shadowRadius: NaN }, point({ castShadow: true, shadowRadius: 0.25 }), spot({ castShadow: true, shadowRadius: 0.5 })];
  const packed = traceLights(lights), delta = traceLights(lights.map(light => ({ ...light, shadowRadius: 0 })));
  assert.equal(packed[14], 0); assert.equal(packed[30], 0.25); assert.equal(packed[46], 0.5);
  assert.equal(packed[15], 0); assert.equal(packed[31], 0); assert.equal(packed[47], 0);
  for (let i = 0; i < packed.length; i++) if (i !== 30 && i !== 46) assert.equal(packed[i], delta[i], `original light component ${i}`);
  assert.deepEqual([...packed.slice(44, 46)], [...Float32Array.from([Math.sqrt(3) / 2, 0.5])]);
});

test('disabled or omitted shadow casting ignores malformed radius without reading it', () => {
  for (const make of [point, spot]) for (const castShadow of [false, undefined]) {
    const light = make({ castShadow });
    Object.defineProperty(light, 'shadowRadius', { enumerable: true, get() { throw new Error('Disabled radius must not be read'); } });
    assert.equal(traceLights([light])[14], 0);
  }
  for (const shadowRadius of [-1, NaN, Infinity, Number.MAX_VALUE, Number.MIN_VALUE, null, '1']) {
    assert.equal(traceLights([point({ shadowRadius })])[14], 0);
    assert.equal(traceLights([spot({ castShadow: false, shadowRadius })])[14], 0);
  }
});

test('enabled path-trace radii reject invalid values even when light intensity is zero', () => {
  for (const make of [point, spot]) for (const intensity of [0, 1]) for (const shadowRadius of [-1, NaN, Infinity, -Infinity, Number.MAX_VALUE, 2 ** 128, Number.MIN_VALUE, 2 ** -151, null, '1']) {
    assert.throws(() => traceLights([make({ castShadow: true, shadowRadius, intensity })]), lightError);
  }
  const dark = traceLights([point({ castShadow: true, shadowRadius: 0.25, intensity: 0 }), spot({ castShadow: true, shadowRadius: 0.5, intensity: 0 })]);
  assert.equal(dark[11], 0); assert.equal(dark[27], 0); assert.equal(dark[14], 0.25); assert.equal(dark[30], 0.5);
});

test('path-trace radius f32 boundaries, omitted radius and signed zero have explicit storage values', () => {
  for (const make of [point, spot]) for (const shadowRadius of [0, -0, undefined, 0.1, 2 ** -149, 3.4028234663852886e38]) {
    const actual = traceLights([make({ castShadow: true, shadowRadius })])[14];
    assert.ok(Number.isFinite(actual)); assert.equal(actual, Math.fround(shadowRadius || 0));
    if (!shadowRadius) assert.equal(Object.is(actual, -0), false);
  }
});

test('path tracing packs every light and validates radii beyond raster caster budgets', () => {
  const lights = [
    ...Array.from({ length: 6 }, (_, i) => ({ kind: 'directional', direction: [0, 0, -1], intensity: i + 1 })),
    ...Array.from({ length: 9 }, (_, i) => point({ position: [i, 0, 0], castShadow: true, shadowRadius: 0.25 })),
    ...Array.from({ length: 5 }, (_, i) => spot({ position: [0, i, 0], castShadow: true, shadowRadius: 0.5 })),
  ];
  const packed = traceLights(lights); assert.equal(packed.length, 20 * 16);
  for (let i = 0; i < 9; i++) { assert.equal(packed[(6 + i) * 16], i); assert.equal(packed[(6 + i) * 16 + 14], 0.25); }
  for (let i = 0; i < 5; i++) { assert.equal(packed[(15 + i) * 16 + 1], i); assert.equal(packed[(15 + i) * 16 + 14], 0.5); }
  lights[14].shadowRadius = -1; assert.throws(() => traceLights(lights), lightError);
  lights[14].shadowRadius = 0.25; lights[19].shadowRadius = NaN; assert.throws(() => traceLights(lights), lightError);
});

test('light packing preserves caller input and captures independent bytes for a frozen still', () => {
  const lights = [point({ castShadow: true, shadowRadius: 0.25 }), spot({ castShadow: true, shadowRadius: 0.5 })], before = structuredClone(lights);
  const captured = traceLights(lights), capturedBefore = captured.slice(); assert.deepEqual(lights, before);
  lights[0].position[0] = 99; lights[0].shadowRadius = 2; lights[1].direction[2] = 5; lights[1].angle = 20; lights[1].shadowRadius = 3;
  assert.deepEqual(captured, capturedBefore);
  const later = traceLights(lights); assert.equal(later[0], 99); assert.equal(later[14], 2); assert.equal(later[30], 3);
  const frozen = Object.freeze([Object.freeze({ kind: 'point', position: Object.freeze([1, 2, 3]), castShadow: true, shadowRadius: 0.125 })]);
  assert.equal(traceLights(frozen)[14], 0.125);
});
