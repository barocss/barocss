import { prepareEngineScene } from './engine-scene.js';
import { prepareCamera } from './camera.js';
import type { EngineSceneV0 } from './engine-scene.js';

/** Common WebGPU-ready uniforms for the existing opaque unlit EngineScene profile. */
export const engineSceneWGSL = `struct Camera { view: mat4x4<f32>, projection: mat4x4<f32> }
struct Draw { world: mat4x4<f32>, color: vec4<f32> }
@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> draw: Draw;
struct VertexOut { @builtin(position) position: vec4<f32> }
@vertex fn vertexMain(@location(0) position: vec3<f32>) -> VertexOut {
  var out: VertexOut;
  out.position = camera.projection * camera.view * draw.world * vec4<f32>(position, 1.0);
  return out;
}
fn encodeSRGB(color: vec3<f32>) -> vec3<f32> {
  let low = 12.92 * color;
  let high = 1.055 * pow(color, vec3<f32>(1.0 / 2.4)) - 0.055;
  return select(high, low, color <= vec3<f32>(0.0031308));
}
@fragment fn fragmentMain() -> @location(0) vec4<f32> {
  return vec4<f32>(encodeSRGB(draw.color.xyz), 1.0);
}`;

export interface EngineWebGPUFrameDraw {
  readonly id: string;
  readonly geometryId: string;
  readonly materialId: string;
  readonly uniformBytes: Float32Array;
}
export interface PreparedEngineWebGPUFrame {
  readonly format: 'barocss-gpu-engine-webgpu-frame';
  readonly version: 0;
  readonly wgsl: string;
  readonly cameraBytes: Float32Array;
  readonly draws: readonly EngineWebGPUFrameDraw[];
  readonly indexFormats: Readonly<Record<string, 'uint16' | 'uint32'>>;
  readonly geometryBufferBytes: number;
  readonly uniformBufferBytes: number;
}

/** CPU-only; accepts the original authored scene instead of trusting derived frames. */
export function prepareEngineWebGPUFrame(input: EngineSceneV0, width: number, height: number): PreparedEngineWebGPUFrame {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 2048 || height > 2048)
    throw new RangeError('WebGPU engine frame dimensions must be integers in 1..2048');
  const prepared = prepareEngineScene(input);
  const camera = prepareCamera(prepared.scene.camera, width / height);
  const cameraBytes = new Float32Array(32);
  cameraBytes.set(camera.view, 0);
  cameraBytes.set(camera.projection, 16);
  const indexFormats: Record<string, 'uint16' | 'uint32'> = Object.create(null);
  for (const geometry of prepared.geometries) indexFormats[geometry.geometry.id] = geometry.indexType;
  const draws = prepared.draws.map(draw => {
    const uniformBytes = new Float32Array(20);
    uniformBytes.set(draw.node.worldMatrixF32, 0);
    uniformBytes.set(draw.material.color, 16);
    uniformBytes[19] = 1;
    return Object.freeze({ id: draw.id, geometryId: draw.geometryId, materialId: draw.materialId, uniformBytes });
  });
  return Object.freeze({
    format: 'barocss-gpu-engine-webgpu-frame' as const, version: 0 as const,
    wgsl: engineSceneWGSL,
    cameraBytes, draws: Object.freeze(draws),
    indexFormats: Object.freeze(indexFormats),
    geometryBufferBytes: prepared.bufferBytes,
    uniformBufferBytes: cameraBytes.byteLength + draws.length * 256,
  });
}
