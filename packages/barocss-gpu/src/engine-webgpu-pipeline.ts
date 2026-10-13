import { engineSceneWGSL } from './engine-webgpu-frame.js';
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
  device: GPUDeviceHandle, format: 'rgba8unorm' | 'bgra8unorm',
): Promise<EngineWebGPUPipeline> {
  if (format !== 'rgba8unorm' && format !== 'bgra8unorm')
    throw new TypeError('Engine WebGPU requires an opaque unorm color target');
  const module = device.createShaderModule({ code: engineSceneWGSL });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter(message => message.type === 'error');
  if (errors.length) throw new Error('Engine WebGPU shader compilation refused: ' +
    errors.map(message => message.message).join('; ').slice(0, 768));
  const groupLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: 1, buffer: { type: 'uniform', minBindingSize: 128 } },
    { binding: 1, visibility: 3, buffer: { type: 'uniform', minBindingSize: 80 } },
  ] });
  const pipeline = await device.createRenderPipelineAsync({
    layout: device.createPipelineLayout({ bindGroupLayouts: [groupLayout] }),
    vertex: { module, entryPoint: 'vertexMain', buffers: [{
      arrayStride: 12, stepMode: 'vertex',
      attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }],
    }] },
    fragment: { module, entryPoint: 'fragmentMain', targets: [{ format }] },
    primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    multisample: { count: 1 },
  });
  return Object.freeze({ pipeline, groupLayout, format });
}
