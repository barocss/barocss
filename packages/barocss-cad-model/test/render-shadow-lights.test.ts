import test from 'node:test';
import assert from 'node:assert/strict';
import { readRender, defaultRender, validateRenderShadowLights } from '../src/engine/render';
import { isRefusal } from '../src/engine/refusal';
import { emptyDoc } from '../src/engine/doc';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';

// Studio positions, ranges and shadowRadius are mm; 1 mm is one CAD GPU world unit.
const F32_MAX = 3.4028234663852886e38, F32_MIN = 1.401298464324817e-45;
const point = (extra: Record<string, unknown> = {}) => ({ kind: 'point', position: [20, 30, 80], color: '#ffffff', intensity: 1, range: 200, ...extra });
const spot = (extra: Record<string, unknown> = {}) => ({ kind: 'spot', position: [20, 30, 80], direction: [0, 0, -1], color: '#ffffff', intensity: 1, range: 200, angle: 30, penumbra: 0.2, ...extra });
const rejected = (lights: readonly unknown[], detail: string) => {
  const before = structuredClone(lights), predicate = (error: unknown) => isRefusal(error, 'VALUE') && error.message === `[VALUE] ${detail}`;
  assert.throws(() => validateRenderShadowLights(lights), predicate);
  assert.deepEqual(lights, before);
  assert.throws(() => readRender({ lights }), predicate);
  assert.deepEqual(lights, before);
};

test('shadow lights: raw millimetres, false, zero and absence survive without changing legacy light defaults or twelve-light admission', () => {
  const lights = [point(), point({ castShadow: false, shadowRadius: 0 }), point({ shadowRadius: 2 }),
    point({ castShadow: true, shadowRadius: 1 / 3 }), spot({ castShadow: false, shadowRadius: 1e40 }),
    spot({ castShadow: false, shadowRadius: Number.MIN_VALUE })];
  const before = structuredClone(lights); validateRenderShadowLights(lights);
  const r = readRender({ lights }); assert.equal(r.lights.length, lights.length);
  assert.equal(Object.hasOwn(r.lights[0], 'castShadow'), false); assert.equal(Object.hasOwn(r.lights[0], 'shadowRadius'), false);
  const off = r.lights[1]; assert.ok(off.kind === 'point'); assert.equal(off.castShadow, false); assert.equal(off.shadowRadius, 0);
  const radiusOnly = r.lights[2]; assert.ok(radiusOnly.kind === 'point'); assert.equal(radiusOnly.shadowRadius, 2); assert.equal(Object.hasOwn(radiusOnly, 'castShadow'), false);
  const active = r.lights[3]; assert.ok(active.kind === 'point'); assert.equal(active.castShadow, true); assert.equal(active.shadowRadius, 1 / 3);
  assert.notEqual(active.shadowRadius, Math.fround(1 / 3), 'f32 validation must not round the authored value');
  for (let i = 0; i < r.lights.length; i++) {
    const light = r.lights[i], original = lights[i]; assert.ok(light.kind !== 'directional');
    assert.deepEqual(light.position, [20, 30, 80]); assert.equal(light.range, 200); assert.notEqual(light.position, original.position);
    if (light.kind === 'spot') { assert.ok('direction' in original); assert.deepEqual(light.direction, [0, 0, -1]); assert.notEqual(light.direction, original.direction); }
  }
  for (const [index, expected] of [[4, 1e40], [5, Number.MIN_VALUE]] as const) {
    const light = r.lights[index]; assert.ok(light.kind === 'spot'); assert.equal(light.shadowRadius, expected);
  }
  assert.deepEqual(lights, before);
  const legacy = readRender({ lights: [{ kind: 'directional', castShadow: 1 }, { kind: 'point', range: 2e6 }, { kind: 'spot' }] });
  assert.deepEqual(legacy.lights, [
    { kind: 'directional', direction: [0, 0, -1], color: '#ffffff', intensity: 1, castShadow: false },
    { kind: 'point', position: [0, 0, 100], color: '#ffffff', intensity: 1, range: 1e6 },
    { kind: 'spot', position: [0, 0, 100], direction: [0, 0, -1], color: '#ffffff', intensity: 1, range: 0, angle: 30, penumbra: 0.2 },
  ]);
  assert.deepEqual(readRender(undefined), defaultRender());
  const twelve = Array.from({ length: 12 }, () => point());
  assert.equal(readRender({ lights: [...twelve, point({ castShadow: true, shadowRadius: NaN })] }).lights.length, 12);
  // The pure helper validates its entire caller list; only readRender owns the legacy twelve-item slice.
  assert.throws(() => validateRenderShadowLights([...twelve, point({ shadowRadius: NaN })]), error => isRefusal(error, 'VALUE'));
});

test('shadow lights: each new field is read once, undefined is omitted and returned arrays do not alias inputs', () => {
  for (const [castShadow, shadowRadius] of [[false, 0], [true, 1 / 3], [undefined, undefined]] as const) {
    for (const consumer of ['read', 'helper'] as const) {
      let flags = 0, radii = 0;
      const raw = { ...point(), get castShadow() { flags++; return flags === 1 ? castShadow : 'second read'; },
        get shadowRadius() { radii++; return radii === 1 ? shadowRadius : NaN; } };
      if (consumer === 'helper') validateRenderShadowLights([raw]);
      else {
        const r = readRender({ lights: [raw] }), light = r.lights[0]; assert.ok(light.kind === 'point');
        assert.equal(light.castShadow, castShadow); assert.equal(light.shadowRadius, shadowRadius);
        assert.equal(Object.hasOwn(light, 'castShadow'), castShadow !== undefined);
        assert.equal(Object.hasOwn(light, 'shadowRadius'), shadowRadius !== undefined);
        assert.notEqual(light.position, raw.position); raw.position[0] = 999; assert.deepEqual(light.position, [20, 30, 80]);
      }
      assert.equal(flags, 1); assert.equal(radii, 1);
    }
  }
});

test('shadow lights: inactive unsafe JSON fields refuse instead of being clamped or automatically activated', () => {
  for (const make of [point, spot]) {
    for (const castShadow of [0, 1, 'true', null, {}]) rejected([make({ castShadow })], 'point and spot castShadow must be a boolean');
    for (const shadowRadius of [NaN, Infinity, -Infinity, -1, '2', null, {}, true]) {
      for (const flag of [{}, { castShadow: false }]) rejected([make({ ...flag, shadowRadius })], 'point and spot shadowRadius must be a finite nonnegative number of mm');
    }
    for (const shadowRadius of [1e40, Number.MIN_VALUE]) {
      const raw = [make({ shadowRadius })], before = structuredClone(raw); validateRenderShadowLights(raw);
      const light = readRender({ lights: raw }).lights[0]; assert.ok(light.kind === 'point' || light.kind === 'spot');
      assert.equal(light.shadowRadius, shadowRadius); assert.equal(Object.hasOwn(light, 'castShadow'), false); assert.deepEqual(raw, before);
    }
  }
});

test('shadow lights: active f32 radius boundaries and GPU point or spot budgets preserve authored values and caster limits', () => {
  const detail = 'active point and spot shadowRadius must remain finite and nonzero when positive in GPU f32';
  for (const make of [point, spot]) {
    for (const shadowRadius of [0, F32_MIN, F32_MAX, 1 / 3]) {
      const raw = [make({ castShadow: true, shadowRadius, intensity: 0 })], before = structuredClone(raw);
      validateRenderShadowLights(raw); const light = readRender({ lights: raw }).lights[0]; assert.ok(light.kind !== 'directional');
      assert.equal(light.castShadow, true); assert.equal(light.shadowRadius, shadowRadius); assert.deepEqual(raw, before);
    }
    for (const shadowRadius of [Number.MIN_VALUE, 1e40]) rejected([make({ castShadow: true, shadowRadius, intensity: 0 })], detail);
    const omitted = readRender({ lights: [make({ castShadow: true })] }).lights[0]; assert.ok(omitted.kind !== 'directional');
    assert.equal(omitted.castShadow, true); assert.equal(Object.hasOwn(omitted, 'shadowRadius'), false);
  }
  rejected([point({ castShadow: true, intensity: 0 }), point({ castShadow: true })], 'at most one of the first eight point lights may cast shadows');
  rejected([point({ castShadow: true }), ...Array.from({ length: 6 }, () => point()), point({ castShadow: true })], 'at most one of the first eight point lights may cast shadows');
  for (const [make, count] of [[point, 8], [spot, 4]] as const) {
    const outside = [...Array.from({ length: count }, () => make()), make({ castShadow: true, shadowRadius: 1e40 })];
    validateRenderShadowLights(outside); const lights = readRender({ lights: outside }).lights;
    const last = lights[count]; assert.ok(last.kind !== 'directional'); assert.equal(last.castShadow, true); assert.equal(last.shadowRadius, 1e40);
    const inside = Array.from({ length: count }, () => make()); inside[count - 1] = make({ castShadow: true, shadowRadius: 1e40 });
    rejected(inside, detail);
  }
  const ignoredCaster = [point({ castShadow: true }), ...Array.from({ length: 7 }, () => point()), point({ castShadow: true, shadowRadius: 1e40 })];
  validateRenderShadowLights(ignoredCaster); assert.equal(readRender({ lights: ignoredCaster }).lights.length, 9);
});

test('shadow lights: refusal preserves accepted settings and original input; codec preserves raw millimetres and optional fields', async () => {
  const raw = { lights: [point({ castShadow: false, shadowRadius: 1e40 }), spot({ castShadow: true, shadowRadius: 2 })] };
  const before = structuredClone(raw), accepted = readRender(raw), acceptedBefore = structuredClone(accepted);
  const invalid = structuredClone(raw); Reflect.set(invalid.lights[0], 'castShadow', true);
  rejected(invalid.lights, 'active point and spot shadowRadius must remain finite and nonzero when positive in GPU f32');
  assert.deepEqual(raw, before); assert.deepEqual(accepted, acceptedBefore);
  const doc = { ...emptyDoc(), render: accepted }, docBefore = structuredClone(doc);
  const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened, JSON.stringify(opened));
  assert.deepEqual(opened.doc.render, accepted); assert.deepEqual(readRender(opened.doc.render), accepted);
  assert.deepEqual(doc, docBefore); assert.deepEqual(raw, before); assert.deepEqual(accepted, acceptedBefore);
  // Pure Model admission and serialization only: no actual UI bridge, GPU shadow image or physical-light claim.
});
