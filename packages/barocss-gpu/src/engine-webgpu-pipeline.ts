import { engineSceneWGSL } from './engine-webgpu-frame.js';
import { EngineWebGPUWaitBudget } from './engine-webgpu-wait-budget.js';
import type { GPUDeviceHandle, GPUPipelineHandle } from './webgpu-platform.js';

/** Private WebGPU pipeline, independent of the CAD/native geometry kernel. */
export interface EngineWebGPUPipeline {
  readonly pipeline: GPUPipelineHandle;
  readonly groupLayout: object;
  readonly format: 'rgba8unorm' | 'bgra8unorm';
}

/** One opaque, shared-depth pipeline for generic EngineScene triangle geometry.
 * Actual adapter/device acquisition and renderer-owned resource lifetime are separate.
 */
export async function createEngineWebGPUPipeline(
  device: GPUDeviceHandle, format: 'rgba8unorm' | 'bgra8unorm', budget?: EngineWebGPUWaitBudget,
): Promise<EngineWebGPUPipeline> {
  if (format !== 'rgba8unorm' && format !== 'bgra8unorm')
    throw new TypeError('Engine WebGPU requires an opaque unorm color target');
  const waits = budget ?? new EngineWebGPUWaitBudget();
  waits.check('shader module');
  const module = device.createShaderModule({ code: engineSceneWGSL });
  const info = await waits.wait(module.getCompilationInfo(), 'shader compilation');
  const errors = info.messages.filter(message => message.type === 'error');
  if (errors.length) throw new Error('Engine WebGPU shader compilation refused: ' +
    errors.map(message => message.message).join('; ').slice(0, 768));
  waits.check('pipeline layout');
  const groupLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: 1, buffer: { type: 'uniform', minBindingSize: 128 } },
    { binding: 1, visibility: 3, buffer: { type: 'uniform', minBindingSize: 80 } },
  ] });
  const pipeline = await waits.wait(device.createRenderPipelineAsync({
    layout: device.createPipelineLayout({ bindGroupLayouts: [groupLayout] }),
    vertex: { module, entryPoint: 'vertexMain', buffers: [{
      arrayStride: 12, stepMode: 'vertex',
      attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }],
    }] },
    fragment: { module, entryPoint: 'fragmentMain', targets: [{ format }] },
    primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    multisample: { count: 1 },
  }), 'pipeline creation');
  return Object.freeze({ pipeline, groupLayout, format });
}
