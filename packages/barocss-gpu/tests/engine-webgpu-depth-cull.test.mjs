/** G1/G2: the EngineScene WGSL maps OpenGL clip depth into WebGPU's 0..w and culls like the WebGL path. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { engineSceneWGSL } from '../dist/engine-webgpu-frame.js';
import { createEngineWebGPUPipeline } from '../dist/engine-webgpu-pipeline.js';
import { prepareCamera } from '../dist/camera.js';

const mul = (m, v) => [0, 1, 2, 3].map(r => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);

test('vertex output depth is (z + w) / 2, matching every other WGSL path', () => {
  assert.match(engineSceneWGSL, /out\.position = vec4<f32>\(clip\.xy, \(clip\.z \+ clip\.w\) \* 0\.5, clip\.w\);/);
  // The shared projection is OpenGL-style: a point just beyond the near plane has clip z/w near −1,
  // which WebGPU (0 ≤ z ≤ w) would clip away without the remap. After it, depth is inside 0..1.
  const { projection } = prepareCamera(undefined, 1);
  for (const viewZ of [-0.11, -1, -10, -90]) {
    // A view-space point straight ahead at distance −viewZ.
    const clip = mul(projection, [0, 0, viewZ, 1]), gl = clip[2] / clip[3], webgpu = (clip[2] + clip[3]) * 0.5 / clip[3];
    if (gl < -1 || gl > 1) continue; // outside the frustum on both APIs
    assert.ok(webgpu >= 0 && webgpu <= 1, JSON.stringify({ viewZ, gl, webgpu }));
  }
});

test('EngineScene WebGPU pipeline culls back faces (counter-clockwise front), like WebGL', async () => {
  const calls = [];
  const device = {
    createShaderModule() { return { getCompilationInfo: async () => ({ messages: [] }) }; },
    createBindGroupLayout() { return {}; }, createPipelineLayout() { return {}; },
    async createRenderPipelineAsync(descriptor) { calls.push(descriptor); return {}; },
  };
  await createEngineWebGPUPipeline(device, 'bgra8unorm');
  assert.deepEqual(calls[0].primitive, { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'back' });
});
