/** Software structural WebGPU call verification, not an actual GPU/driver pass. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngineWebGPUPipeline } from '../dist/engine-webgpu-pipeline.js';
import { engineSceneWGSL } from '../dist/engine-webgpu-frame.js';

function fakeDevice(messages = []) {
  const calls = [];
  const pipeline = { tag: 'pipeline' }, groupLayout = { tag: 'layout' };
  const device = {
    createShaderModule(descriptor) { calls.push(['shader', descriptor]); return {
      getCompilationInfo: async () => ({ messages }),
    }; },
    createBindGroupLayout(descriptor) { calls.push(['group', descriptor]); return groupLayout; },
    createPipelineLayout(descriptor) { calls.push(['pipelineLayout', descriptor]); return {}; },
    async createRenderPipelineAsync(descriptor) { calls.push(['renderPipeline', descriptor]); return pipeline; },
  };
  return { calls, device, pipeline, groupLayout };
}

test('generic EngineScene pipeline uses correct shader, uniform ABI and depth', async () => {
  const { calls, device, pipeline, groupLayout } = fakeDevice();
  const result = await createEngineWebGPUPipeline(device, 'rgba8unorm');
  assert.equal(result.pipeline, pipeline);
  assert.equal(result.groupLayout, groupLayout);
  assert.equal(result.format, 'rgba8unorm');
  assert.equal(calls.length, 4);
  assert.equal(calls[0][1].code, engineSceneWGSL);
  assert.deepEqual(calls[1][1].entries.map(x => x.buffer.minBindingSize), [128, 80]);
  const descriptor = calls[3][1];
  assert.equal(descriptor.vertex.buffers[0].arrayStride, 12);
  assert.equal(descriptor.vertex.buffers[0].attributes[0].format, 'float32x3');
  assert.equal(descriptor.fragment.targets[0].format, 'rgba8unorm');
  assert.deepEqual(descriptor.depthStencil, {
    format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less',
  });
  assert.equal(Object.isFrozen(result), true);
});

test('alternate unorm format is admitted and bogus formats refused before device operations', async () => {
  const { calls, device } = fakeDevice();
  assert.equal((await createEngineWebGPUPipeline(device, 'bgra8unorm')).format, 'bgra8unorm');
  calls.length = 0;
  await assert.rejects(createEngineWebGPUPipeline(device, 'rgba16float'), TypeError);
  assert.equal(calls.length, 0);
});

test('WGSL compilation failure blocks pipeline creation', async () => {
  const { calls, device } = fakeDevice([{ type: 'error', message: 'synthetic compile failure' }]);
  await assert.rejects(createEngineWebGPUPipeline(device, 'rgba8unorm'), /compile failure/);
  assert.deepEqual(calls.map(x => x[0]), ['shader']);
});
