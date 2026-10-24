// R7.3a (api-conventions.md §6): every gpu refusal is one BarocssError — each error class of the package is one, keeping
// its own name, code and message (the codes' spellings and the messages' bracketed prefix are R7.3a's second step).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as gpu from '../dist/index.js';

test('every exported error class is a BarocssError, its name, code and message kept', () => {
  const classes = Object.entries(gpu).filter(([name, v]) => typeof v === 'function' && /Error$/.test(name) && name !== 'BarocssError');
  assert.ok(classes.length >= 25, `error classes exported: ${classes.length}`);
  for (const [name, C] of classes) assert.ok(C.prototype instanceof gpu.BarocssError, `${name} is a BarocssError`);
  // (Each shape of constructor: a code and a detail, a message alone, diagnostics.)
  const tri = new gpu.TriangleGeometryError('POSITIONS', 'three numbers a vertex');
  assert.ok(tri instanceof gpu.BarocssError && tri instanceof Error);
  assert.equal(tri.name, 'TriangleGeometryError'); assert.equal(tri.code, 'POSITIONS'); assert.equal(tri.message, 'Triangle geometry: three numbers a vertex');
  const g = new gpu.GPUError('no device');
  assert.equal(g.code, 'gpu'); assert.equal(g.message, 'no device'); assert.equal(g.name, 'GPUError');
  const s = new gpu.SceneError([{ line: 2, column: 3, message: 'expected a number' }]);
  assert.ok(s instanceof gpu.BarocssError); assert.equal(s.code, 'scene'); assert.equal(s.message, '2:3: expected a number');
  const c = new gpu.EngineSceneError('LIMIT', 'too many meshes', new Error('inner'));
  assert.equal(c.cause.message, 'inner');
});

test('BarocssError itself: code, message, where and details as given', () => {
  const e = new gpu.BarocssError('MESH_INVALID', '[MESH_INVALID] no positions', { where: 'facade', details: { key: 'a' } });
  assert.deepEqual([e.name, e.code, e.message, e.where, e.details], ['BarocssError', 'MESH_INVALID', '[MESH_INVALID] no positions', 'facade', { key: 'a' }]);
  assert.equal(new gpu.BarocssError('X', 'm').where, undefined);
});
