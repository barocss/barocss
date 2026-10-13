/** #1512 CPU-only qualification. This is not WebGPU device, pixel, or screen evidence. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileMeshMaterial, prepareWebGPUPrimitiveFrame, PrimitiveBackendError,
} from '../dist/index.js';

const materialSource = '@shader #palette { @uniform amount:float(0,1,.25); @fragment { color:mix(#000000,#FFFFFF,amount); } }';
const compiled = compileMeshMaterial(materialSource);
assert.equal(compiled.ok, true, JSON.stringify(compiled));
const ref = { modelId: 'preflight_surface', geometryId: 'plain_panel' };
const packet = {
  version: 0, surfaceId: 'plain_panel', revision: 0, lengthUnit: 'mm',
  coordinateSystem: 'right-handed-y-up', winding: 'ccw',
  positions: [0, 0, 0, 0, 3, 0, 5, 0, 0, 5, 3, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  indices: [0, 2, 1, 2, 3, 1],
  parameters: [2, -1, 2, 4, 9, -1, 9, 4],
  bounds: { min: [0, 0, 0], max: [5, 3, 0] },
};
const frame = amount => ({
  version: 0,
  scene: {
    version: 2,
    entries: [{
      kind: 'surface', packet: structuredClone(packet), ref: structuredClone(ref),
      color: [0.6, 0.4, 0.8],
      transform: { translationMm: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1] },
    }],
  },
  options: {
    mmToSceneUnit: 0.1, translate: [0, 0, 0], background: [0.05, 0.07, 0.1],
    camera: { eye: [0, 1.5, 8], target: [0, 1.5, 0], up: [0, 1, 0],
      fovYDegrees: 45, near: 0.01, far: 100 },
  },
  particles: null,
  materials: [{
    ref: structuredClone(ref),
    binding: { material: structuredClone(compiled.material), uniforms: { amount } },
  }],
});

test('bounded amount update produces independent trusted WebGPU uniforms', () => {
  const initialInput = frame(0.25), updatedInput = frame(0.75);
  const beforeInitial = structuredClone(initialInput), beforeUpdated = structuredClone(updatedInput);
  const initial = prepareWebGPUPrimitiveFrame(initialInput, 320, 240);
  const updated = prepareWebGPUPrimitiveFrame(updatedInput, 320, 240);
  assert.equal(initial.profile, 'qualified-surface-v0');
  assert.equal(updated.profile, initial.profile);
  assert.equal(initial.materialUniforms[0], 0.25);
  assert.equal(updated.materialUniforms[0], 0.75);
  assert.deepEqual(initial.frame.frame.scene.entries[0].ref, ref);
  assert.deepEqual(updated.frame.frame.scene.entries[0].ref, ref);
  assert.equal(initial.wgsl, updated.wgsl, 'Uniform updates must not change trusted shader text');
  assert.deepEqual(initialInput, beforeInitial);
  assert.deepEqual(updatedInput, beforeUpdated);
  assert.notStrictEqual(initial.materialUniforms.buffer, updated.materialUniforms.buffer);
});

test('out-of-range amount refuses before any GPU device operation', () => {
  const acceptedInput = frame(0.75), before = JSON.stringify(acceptedInput);
  const accepted = prepareWebGPUPrimitiveFrame(acceptedInput, 320, 240);
  const acceptedBytes = Array.from(accepted.materialUniforms);
  const invalid = frame(1.5);
  assert.throws(
    () => prepareWebGPUPrimitiveFrame(invalid, 320, 240),
    error => error instanceof PrimitiveBackendError && error.code === 'INPUT',
  );
  assert.equal(JSON.stringify(acceptedInput), before);
  assert.deepEqual(Array.from(accepted.materialUniforms), acceptedBytes);
  // Actual viewport generation and retained pixels are NOT inferred from CPU preflight.
});
