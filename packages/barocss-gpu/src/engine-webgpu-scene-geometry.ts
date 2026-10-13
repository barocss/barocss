import { prepareEngineScene } from './engine-scene.js';
import { uploadEngineWebGPUGeometry } from './engine-webgpu-geometry.js';
import type { EngineSceneV0 } from './engine-scene.js';
import type { EngineWebGPUGeometryBuffers } from './engine-webgpu-geometry.js';
import type { GPUDeviceHandle } from './webgpu-platform.js';

export interface EngineWebGPUSceneGeometry {
  readonly geometries: ReadonlyMap<string, EngineWebGPUGeometryBuffers>;
  readonly drawGeometryIds: readonly string[];
  readonly uploadedBytes: number;
  dispose(): void;
}

/** Upload every referenced geometry once; preserve authored draw order.
 * All original data is admitted before GPU allocation, and failure rolls back.
 */
export function uploadEngineWebGPUSceneGeometry(
  device: GPUDeviceHandle, input: EngineSceneV0,
): EngineWebGPUSceneGeometry {
  const scene = prepareEngineScene(input);
  const references = new Set(scene.draws.map(draw => draw.geometryId));
  const geometries = new Map<string, EngineWebGPUGeometryBuffers>();
  try {
    for (const prepared of scene.geometries) {
      if (!references.has(prepared.geometry.id)) continue;
      geometries.set(prepared.geometry.id, uploadEngineWebGPUGeometry(device, prepared.geometry));
    }
    const drawGeometryIds = Object.freeze(scene.draws.map(draw => draw.geometryId));
    const uploadedBytes = [...geometries.values()].reduce((bytes, entry) => bytes + entry.byteLength, 0);
    let disposed = false;
    return Object.freeze({
      geometries: geometries as ReadonlyMap<string, EngineWebGPUGeometryBuffers>,
      drawGeometryIds, uploadedBytes,
      dispose(): void {
        if (disposed) return;
        disposed = true;
        for (const resource of geometries.values()) resource.dispose();
        geometries.clear();
      },
    });
  } catch (cause) {
    for (const resource of geometries.values()) resource.dispose();
    geometries.clear();
    throw cause;
  }
}
