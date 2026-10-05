import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePreviewPacket, validateMeshOptions, prepareMesh } from '../dist/mesh-packet.js';

const options = () => ({ mmToSceneUnit: 0.1, translate: [0, 0, 0], color: [1, 0.5, 0], background: [0.1, 0.2, 0.3] });
const patch = () => ({
  version: 0, surfaceId: 'asymmetric_patch', revision: 7, lengthUnit: 'mm',
  coordinateSystem: 'right-handed-y-up', winding: 'ccw',
  positions: [0, 0, 0, 0, 3, 0, 5, 0, 0, 5, 3, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  indices: [0, 2, 1, 2, 3, 1], parameters: [2, -1, 2, 4, 9, -1, 9, 4],
  bounds: { min: [0, 0, 0], max: [5, 3, 0] },
});
const rejectPacket = (change, pattern) => { const value = patch(); change(value); assert.throws(() => validatePreviewPacket(value), pattern); };

function cylinder(countU = 5, countV = 4) {
  const value = patch(); value.surfaceId = 'quarter-cylinder'; value.positions = []; value.normals = []; value.parameters = []; value.indices = [];
  for (let i = 0; i < countU; i++) for (let j = 0; j < countV; j++) {
    const u = i / (countU - 1), v = j / (countV - 1), theta = Math.PI * u / 2;
    value.positions.push(10 * Math.cos(theta), 10 * Math.sin(theta), 30 * v);
    value.normals.push(Math.cos(theta), Math.sin(theta), 0); value.parameters.push(u, v);
  }
  for (let i = 0; i < countU - 1; i++) for (let j = 0; j < countV - 1; j++) {
    const a = i * countV + j, b = (i + 1) * countV + j, c = a + 1, d = b + 1;
    value.indices.push(a, b, c, b, d, c);
  }
  value.bounds = { min: [10 * Math.cos(Math.PI / 2), 0, 0], max: [10, 10, 30] };
  return value;
}

test('literal asymmetric packet preserves domain and provenance, with explicit unit conversion', () => {
  const value = prepareMesh(patch(), options());
  assert.equal(value.packet.revision, 7);
  assert.deepEqual(value.packet.parameters, [2, -1, 2, 4, 9, -1, 9, 4]);
  assert.ok(value.positions instanceof Float32Array); assert.ok(value.normals instanceof Float32Array); assert.ok(value.indices instanceof Uint16Array);
  assert.equal(value.positions[6], 0.5);
  assert.equal(value.positions[4], Math.fround(0.3));
});

test('analytic quarter-cylinder accepts U-major rows and cross(partialU,partialV) normals', () => {
  const value = cylinder();
  assert.deepEqual(validatePreviewPacket(value), value);
  assert.equal(prepareMesh(value, options()).positions.length, 60);
  const maximum = cylinder(64, 64);
  assert.equal(maximum.positions.length / 3, 4096); assert.equal(maximum.indices.length / 3, 7938);
  assert.equal(validatePreviewPacket(maximum).indices.length, 7938 * 3);
});

test('accepted copies are deeply frozen while all caller data remains owned and mutable', () => {
  const input = patch(), inputOptions = options(), result = prepareMesh(input, inputOptions);
  for (const value of [result.packet, result.packet.positions, result.packet.normals, result.packet.parameters, result.packet.indices,
    result.packet.bounds, result.packet.bounds.min, result.packet.bounds.max, result.options, result.options.translate, result.options.color, result.options.background]) assert.ok(Object.isFrozen(value));
  input.positions[0] = 123; input.normals[2] = -1; input.indices[0] = 3; input.parameters[0] = 456; input.bounds.min[0] = -99;
  inputOptions.translate[0] = 10; inputOptions.color[0] = 0;
  assert.equal(result.packet.positions[0], 0); assert.equal(result.packet.normals[2], 1); assert.equal(result.packet.indices[0], 0);
  assert.equal(result.packet.parameters[0], 2); assert.equal(result.packet.bounds.min[0], 0); assert.equal(result.options.translate[0], 0); assert.equal(result.options.color[0], 1);
  assert.throws(() => { result.packet.positions[0] = 1; }, TypeError);
});

test('metadata rejects unsupported, missing and executable extensions', () => {
  for (const key of Object.keys(patch())) rejectPacket((p) => { delete p[key]; }, /fields/);
  rejectPacket((p) => { p.shader = 'void main() {}'; }, /fields/);
  rejectPacket((p) => { p.version = 1; }, /version/);
  for (const id of ['', '1bad', 'bad space', 'é', 'https://example.test']) rejectPacket((p) => { p.surfaceId = id; }, /identifier/);
  for (const revision of [-1, 2147483648, 0.5, NaN, Infinity, '7']) rejectPacket((p) => { p.revision = revision; }, /revision/);
  for (const key of ['lengthUnit', 'coordinateSystem', 'winding']) rejectPacket((p) => { p[key] = 'unsupported'; }, /units/);
  for (const revision of [0, 2147483647]) { const p = patch(); p.revision = revision; assert.equal(validatePreviewPacket(p).revision, revision); }
});

test('arrays reject mismatches, counts, typed inputs, sparse values and nonfinite numbers', () => {
  rejectPacket((p) => { p.positions = Array(3 * 4097).fill(0); }, /count/);
  rejectPacket((p) => { p.positions = p.positions.slice(0, 9); }, /count/);
  rejectPacket((p) => { p.positions.push(1); }, /XYZ/);
  rejectPacket((p) => { p.normals.pop(); }, /count/);
  rejectPacket((p) => { p.parameters.push(1); }, /count/);
  rejectPacket((p) => { p.indices = [0, 2, 1]; }, /count/);
  rejectPacket((p) => { p.indices = Array(7939 * 3).fill(0); }, /count/);
  rejectPacket((p) => { p.indices.push(0); }, /triples/);
  rejectPacket((p) => { p.positions = new Float32Array(p.positions); }, /plain array/);
  rejectPacket((p) => { delete p.positions[0]; }, /dense/);
  rejectPacket((p) => { p.positions.extra = 1; }, /dense/);
  for (const key of ['positions', 'normals', 'parameters', 'indices']) for (const n of [NaN, Infinity, -Infinity, '1', null]) rejectPacket((p) => { p[key][0] = n; }, /finite/);
});

test('all input objects and arrays reject getters, symbols and custom prototypes without invoking getters', () => {
  let calls = 0;
  const p = patch(); Object.defineProperty(p, 'positions', { enumerable: true, get() { calls++; throw Error('executed'); } });
  assert.throws(() => validatePreviewPacket(p), /JSON data/);
  const a = patch(); Object.defineProperty(a.positions, '0', { enumerable: true, get() { calls++; throw Error('executed'); } });
  assert.throws(() => validatePreviewPacket(a), /JSON data/); assert.equal(calls, 0);
  rejectPacket((p) => { p[Symbol('hidden')] = 1; }, /fields/);
  rejectPacket((p) => { Object.setPrototypeOf(p, { arbitrary: true }); }, /plain JSON/);
  rejectPacket((p) => { Object.setPrototypeOf(p.positions, {}); }, /plain array/);
  rejectPacket((p) => { p.bounds.max.hidden = 1; }, /dense/);
});

test('coordinates, normals, bounds and indices must describe exact valid geometry', () => {
  rejectPacket((p) => { p.positions[0] = 1e6 + 1; }, /1e6/);
  rejectPacket((p) => { p.normals[2] = 1.001; }, /unit length/);
  rejectPacket((p) => { p.normals[2] = 0; }, /unit length/);
  rejectPacket((p) => { p.bounds.max[0] += 1e-12; }, /extrema/);
  rejectPacket((p) => { p.bounds.min[0] = -1; }, /extrema/);
  rejectPacket((p) => { p.bounds.url = 'https://example.test'; }, /fields/);
  for (const index of [-1, 4, 0.5]) rejectPacket((p) => { p.indices[0] = index; }, /address/);
  rejectPacket((p) => { p.indices[0] = p.indices[1]; }, /repeats/);
  rejectPacket((p) => { p.positions[3] = 2; p.positions[4] = 0; }, /zero area/);
  rejectPacket((p) => { [p.indices[0], p.indices[1]] = [p.indices[1], p.indices[0]]; }, /winding/);
  rejectPacket((p) => { p.normals[2] = -1; }, /winding/);
  rejectPacket((p) => { p.normals[0] = 1; p.normals[2] = 0; }, /winding/);
});

test('host options require finite positive scale and bounded opaque RGB/translation', () => {
  for (const key of Object.keys(options())) { const o = options(); delete o[key]; assert.throws(() => validateMeshOptions(o), /fields/); }
  for (const scale of [0, -1, NaN, Infinity, '0.1']) { const o = options(); o.mmToSceneUnit = scale; assert.throws(() => validateMeshOptions(o), /positive/); }
  for (const key of ['color', 'background']) for (const n of [-0.01, 1.01]) { const o = options(); o[key][0] = n; assert.throws(() => validateMeshOptions(o), /bounds/); }
  const o = options(); o.translate[0] = 1001; assert.throws(() => validateMeshOptions(o), /bounds/);
  const unknown = options(); unknown.rotation = [0, 0, 0]; assert.throws(() => validateMeshOptions(unknown), /fields/);
  assert.deepEqual(validateMeshOptions(options()), options());
});

test('conversion rejects overflow, coordinate limits and float32 collapsed triangles', () => {
  for (const scale of [Number.MAX_VALUE, 201]) { const o = options(); o.mmToSceneUnit = scale; assert.throws(() => prepareMesh(patch(), o), /Converted GPU/); }
  const o = options(); o.translate = [1000, 0, 0]; assert.throws(() => prepareMesh(patch(), o), /Converted GPU/);
  const tinyScale = options(); tinyScale.mmToSceneUnit = Number.MIN_VALUE; assert.throws(() => prepareMesh(patch(), tinyScale), /Float32 GPU.*zero area/);
  const collapsed = options(); collapsed.mmToSceneUnit = 1e-9; collapsed.translate = [1, 1, 1]; assert.throws(() => prepareMesh(patch(), collapsed), /Float32 GPU.*zero area/);
  const boundary = options(); boundary.mmToSceneUnit = 200; assert.equal(prepareMesh(patch(), boundary).positions[6], 1000);
});
