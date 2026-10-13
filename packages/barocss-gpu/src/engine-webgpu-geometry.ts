import { prepareTriangleGeometry } from './triangle-geometry.js';
import type { TriangleGeometryV0 } from './triangle-geometry.js';
import type { GPUDeviceHandle, GPUBufferHandle } from './webgpu-platform.js';

const COPY_DST = 8, INDEX = 16, VERTEX = 32;
export interface EngineWebGPUGeometryBuffers {
  readonly id: string;
  readonly positions: GPUBufferHandle;
  readonly indices: GPUBufferHandle;
  readonly indexFormat: 'uint16' | 'uint32';
  readonly indexCount: number;
  readonly byteLength: number;
  dispose(): void;
}

/** Admit original geometry before allocating; upload only the consumed position/index attributes. */
export function uploadEngineWebGPUGeometry(device: GPUDeviceHandle, input: TriangleGeometryV0): EngineWebGPUGeometryBuffers {
  const geometry = prepareTriangleGeometry(input);
  const owned: GPUBufferHandle[] = [];
  try {
    const positions = device.createBuffer({ size: geometry.positions.byteLength, usage: VERTEX | COPY_DST });
    owned.push(positions);
    device.queue.writeBuffer(positions, 0, geometry.positions);
    const indices = device.createBuffer({ size: geometry.indices.byteLength, usage: INDEX | COPY_DST });
    owned.push(indices);
    device.queue.writeBuffer(indices, 0, geometry.indices);
    let disposed = false;
    return Object.freeze({
      id: geometry.geometry.id, positions, indices, indexFormat: geometry.indexType,
      indexCount: geometry.indices.length,
      byteLength: geometry.positions.byteLength + geometry.indices.byteLength,
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const buffer of owned) {
          try { buffer.destroy(); } catch { /* do not skip peer resource teardown */ }
        }
        owned.length = 0;
      },
    });
  } catch (cause) {
    for (const buffer of owned) {
      try { buffer.destroy(); } catch { /* preserve original admission/upload failure */ }
    }
    throw cause;
  }
}
