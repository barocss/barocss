// R7.3a (api-conventions.md §6): every gpu refusal is one BarocssError — each error class of the package is one, keeping
// its own name; its code is upper-snake (tsc checks the union, core/error-codes.ts) and its message reads `[CODE] …`
// (batch 2). A diagnostic, which carries its code as a field, keeps the plain words.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as gpu from '../dist/index.js';

test('every exported error class is a BarocssError, its name kept, its message `[CODE] …`', () => {
  const classes = Object.entries(gpu).filter(([name, v]) => typeof v === 'function' && /Error$/.test(name) && name !== 'BarocssError');
  assert.ok(classes.length >= 25, `error classes exported: ${classes.length}`);
  for (const [name, C] of classes) assert.ok(C.prototype instanceof gpu.BarocssError, `${name} is a BarocssError`);
  // (Each shape of constructor: a code and a detail, a message alone, diagnostics.)
  const tri = new gpu.TriangleGeometryError('POSITIONS', 'three numbers a vertex');
  assert.ok(tri instanceof gpu.BarocssError && tri instanceof Error);
  assert.equal(tri.name, 'TriangleGeometryError'); assert.equal(tri.code, 'POSITIONS'); assert.equal(tri.message, '[POSITIONS] Triangle geometry: three numbers a vertex');
  const g = new gpu.GPUError('no device');
  assert.equal(g.code, 'GPU'); assert.equal(g.message, '[GPU] no device'); assert.equal(g.name, 'GPUError');
  const s = new gpu.SceneError([{ line: 2, column: 3, message: 'expected a number' }]);
  assert.ok(s instanceof gpu.BarocssError); assert.equal(s.code, 'SCENE'); assert.equal(s.message, '[SCENE] 2:3: expected a number');
  assert.equal(new gpu.SceneViewError([{ code: 'STATE', severity: 'error', message: 'disposed', range: null }]).message, '[SCENE_VIEW] STATE: disposed');
  const c = new gpu.EngineSceneError('LIMIT', 'too many meshes', new Error('inner'));
  assert.equal(c.cause.message, 'inner');
});

test('the classes that cap a refusal at 1024 characters cap the whole message, its code included', () => {
  const long = new gpu.EngineRaycastError('INPUT', 'x'.repeat(2000));
  assert.equal(long.message.length, 1024); assert.ok(long.message.startsWith('[INPUT] Engine raycast: xxx'));
  assert.equal(new gpu.EngineRaycastError('INPUT', 'short').message, '[INPUT] Engine raycast: short');
});

test('BarocssError itself: code, message, where and details as given; the prefix written once', () => {
  const e = new gpu.BarocssError('MESH_INVALID', '[MESH_INVALID] no positions', { where: 'facade', details: { key: 'a' } });
  assert.deepEqual([e.name, e.code, e.message, e.where, e.details], ['BarocssError', 'MESH_INVALID', '[MESH_INVALID] no positions', 'facade', { key: 'a' }]);
  assert.equal(new gpu.BarocssError('MESH_INVALID', 'no positions').message, '[MESH_INVALID] no positions');
  assert.equal(new gpu.BarocssError('X', 'm').where, undefined);
});

test('refusalText: the words without the refusal\'s own code; a diagnostic keeps them plain', () => {
  assert.equal(gpu.refusalText(new gpu.GPUError('no device')), 'no device');
  assert.equal(gpu.refusalText(new Error('[GPU] not ours')), '[GPU] not ours');
  const compiled = gpu.compileMeshMaterial('@material {');
  assert.equal(compiled.ok, false);
  for (const d of compiled.diagnostics) assert.doesNotMatch(d.message, /^\[[A-Z_]+\] /, JSON.stringify(d));
});

test('a cause given as undefined is kept as one; none given, none kept (the classes that record a thrown undefined)', () => {
  const given = new gpu.EngineUVTextureMaterialBindingsError('INPUT', 'x', undefined);
  assert.ok(Object.hasOwn(given, 'cause')); assert.equal(given.cause, undefined);
  assert.equal(Object.hasOwn(new gpu.EngineUVTextureMaterialBindingsError('INPUT', 'x'), 'cause'), false);
  assert.ok(Object.hasOwn(new gpu.NativePointLightsError('INPUT', 'x', undefined), 'cause'));
  assert.equal(Object.hasOwn(new gpu.NativePointLightsError('INPUT', 'x'), 'cause'), false);
  assert.equal(Object.hasOwn(new gpu.EngineRaycastError('INPUT', 'x', undefined), 'cause'), false);
});

test('batch 3: the viewer refuses a caller\'s input with a coded ViewerError, its words kept after the code', async () => {
  const v = await import('../dist/viewer/index.js');
  // (The viewer entry is unbundled and the main entry a bundle, each with its own copy of the classes: compared within one.)
  assert.throws(() => v.invert(new Float64Array(16)), e => e instanceof v.ViewerError && Object.getPrototypeOf(v.ViewerError.prototype).constructor.name === 'BarocssError'
    && e.code === 'MATRIX_SINGULAR' && e.message === '[MATRIX_SINGULAR] Matrix is not invertible');
});

test('batch 3: a public entry refuses with a coded GpuInputError, the plain refusal under it kept as its cause', () => {
  const bad = { version: 0, surfaceId: 's', revision: 0, lengthUnit: 'mm', coordinateSystem: 'right-handed-y-up', winding: 'ccw', positions: [], normals: [], indices: [], parameters: [], bounds: { min: [0, 0, 0], max: [0, 0, 0] } };
  assert.throws(() => gpu.validatePreviewPacket(bad), e => e instanceof gpu.GpuInputError && e instanceof gpu.BarocssError && e.code === 'MESH_PACKET_INVALID'
    && e.message.startsWith('[MESH_PACKET_INVALID] ') && e.cause instanceof RangeError && e.message === `[MESH_PACKET_INVALID] ${e.cause.message}`);
  assert.throws(() => gpu.parseScene('@scene x{version:0;sphere #s;}', { sourceVersion: 7 }), e => e.code === 'SCENE_INVALID' && e.cause instanceof Error);
  // (A coded refusal passes through unchanged.)
  assert.throws(() => gpu.parseScene('@scene x{version:0;sphere #s;}sphere{radius:x;}'), e => e instanceof gpu.SceneError && e.code === 'SCENE');
});

test('batch 3: the boolean buffers\' entries and the BVH depth refuse coded', () => {
  assert.throws(() => gpu.prepareCoplanarBooleanBuffers({}, { mmToSceneUnit: 1, translate: [0, 0, 0] }), e => e instanceof gpu.GpuInputError && e.code === 'BOOLEAN_BUFFERS_INVALID' && e.cause instanceof RangeError);
  assert.throws(() => gpu.prepareBooleanShellBuffers({}, { mmToSceneUnit: 1, translate: [0, 0, 0] }), e => e instanceof gpu.GpuInputError && e.code === 'BOOLEAN_BUFFERS_INVALID');
});
