import { MeshMaterialError } from './mesh-material.js';
import { lowerEngineUVTextureMaterialWGSL } from './engine-uv-texture-material-wgsl.js';
import type { LoweredEngineUVTextureMaterialWGSL } from './engine-uv-texture-material-wgsl.js';
import { freezeGpuData } from './gpu-data.js';

/** Complete trusted source and its ABI; no GPU resource or pipeline ownership. */
export interface LoweredEngineUVTextureProgramWGSL {
  readonly format: 'barocss-gpu-engine-uv-texture-program-wgsl';
  readonly version: 0;
  readonly profile: 'engine-opaque-unlit-uv-texture-program-wgsl-v0';
  readonly lowered: LoweredEngineUVTextureMaterialWGSL;
  readonly code: string;
  readonly entryPoints: { vertex: 'engine_uv_vertex'; fragment: 'engine_uv_fragment' };
  readonly vertexLayout: {
    slot: number; location: number; stride: number;
    format: 'float32x3' | 'float32x2'; semantic: 'position' | 'uv'; stepMode: 'vertex';
  }[];
  readonly abi: {
    frame: { group: 0; binding: 0; byteLength: 128; viewByteOffset: 0;
      projectionByteOffset: 64; matrixOrder: 'column-major' };
    material: { group: 0; binding: 1; byteLength: 64 };
    draw: { group: 2; binding: 0; byteLength: 80; worldByteOffset: 0;
      identityByteOffset: 64; matrixOrder: 'column-major' };
    clipDepth: 'gl-to-webgpu-z-half';
    uvTransform: 'none';
    outputTransfer: 'linear-to-srgb-piecewise';
    identity: { location: 1; format: 'r32uint'; zeroMeaning: 'background'; min: 1; max: 4294967295 };
  };
  readonly targets: { location: number; format: 'rgba8unorm' | 'r32uint'; blend: false }[];
}

const VERTEX = `struct EngineUVFrame {
  view: mat4x4<f32>,
  projection: mat4x4<f32>,
}
struct EngineUVDraw {
  world: mat4x4<f32>,
  identity: vec4<u32>,
}
@group(0) @binding(0) var<uniform> engine_uv_frame: EngineUVFrame;
@group(2) @binding(0) var<uniform> engine_uv_draw: EngineUVDraw;
struct EngineUVVertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}
@vertex fn engine_uv_vertex(
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
) -> EngineUVVertexOutput {
  let world_position = engine_uv_draw.world * vec4<f32>(position, 1.0);
  let clip = engine_uv_frame.projection * engine_uv_frame.view * world_position;
  var output: EngineUVVertexOutput;
  output.position = vec4<f32>(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
  output.uv = uv;
  return output;
}
`;

const FRAGMENT = `fn engine_uv_encode(linearColor: vec3<f32>) -> vec3<f32> {
  let linear = clamp(linearColor, vec3<f32>(0.0), vec3<f32>(1.0));
  let low = linear * vec3<f32>(12.92);
  let high = vec3<f32>(1.055) * pow(linear, vec3<f32>(1.0 / 2.4)) - vec3<f32>(0.055);
  return select(high, low, linear <= vec3<f32>(0.0031308));
}
struct EngineUVFragmentOutput {
  @location(0) color: vec4<f32>,
  @location(1) identity: u32,
}
`;

function budget(message: string): never {
  throw new MeshMaterialError('BUDGET', message);
}

/** Count ordinary signed data without allocating a complete serialized result. */
function resultBudget(value: LoweredEngineUVTextureProgramWGSL): void {
  const encoder = new TextEncoder();
  let utf16 = 0, utf8 = 0;
  const append = (text: string): void => {
    utf16 += text.length;
    if (utf16 > 2097152) budget('Complete texture program result exceeds2MiB UTF16');
    utf8 += encoder.encode(text).length;
    if (utf8 > 2097152) budget('Complete texture program result exceeds2MiB UTF8');
  };
  const visit = (item: unknown): void => {
    if (typeof item === 'number') { append(Object.is(item, -0) ? '-0' : JSON.stringify(item)); return; }
    if (item === null || typeof item !== 'object') { append(JSON.stringify(item)); return; }
    if (Array.isArray(item)) {
      append('['); item.forEach((child, index) => { if (index) append(','); visit(child); }); append(']'); return;
    }
    append('{'); Object.entries(item).forEach(([key, child], index) => {
      if (index) append(','); append(JSON.stringify(key)); append(':'); visit(child);
    }); append('}');
  };
  visit(value);
}

/** Reconstruct original authored source once; never splice caller shader text. */
export function lowerEngineUVTextureProgramWGSL(input: unknown): LoweredEngineUVTextureProgramWGSL {
  const lowered = lowerEngineUVTextureMaterialWGSL(input);
  const code = lowered.declarations + VERTEX + FRAGMENT + `@fragment fn engine_uv_fragment(input: EngineUVVertexOutput) -> EngineUVFragmentOutput {
  let material_uv = input.uv;
  let linear_color = ${lowered.expression};
  var output: EngineUVFragmentOutput;
  output.color = vec4<f32>(engine_uv_encode(linear_color), 1.0);
  output.identity = engine_uv_draw.identity.x;
  return output;
}
`;
  if (code.length > 65536 || new TextEncoder().encode(code).length > 65536)
    budget('Complete texture program WGSL exceeds64KiB UTF16 or UTF8');
  const result: LoweredEngineUVTextureProgramWGSL = {
    format: 'barocss-gpu-engine-uv-texture-program-wgsl', version: 0,
    profile: 'engine-opaque-unlit-uv-texture-program-wgsl-v0', lowered, code,
    entryPoints: { vertex: 'engine_uv_vertex', fragment: 'engine_uv_fragment' },
    vertexLayout: [
      { slot: 0, location: 0, stride: 12, format: 'float32x3', semantic: 'position', stepMode: 'vertex' },
      { slot: 1, location: 1, stride: 8, format: 'float32x2', semantic: 'uv', stepMode: 'vertex' },
    ],
    abi: {
      frame: { group: 0, binding: 0, byteLength: 128, viewByteOffset: 0, projectionByteOffset: 64, matrixOrder: 'column-major' },
      material: { group: 0, binding: 1, byteLength: 64 },
      draw: { group: 2, binding: 0, byteLength: 80, worldByteOffset: 0, identityByteOffset: 64, matrixOrder: 'column-major' },
      clipDepth: 'gl-to-webgpu-z-half', uvTransform: 'none', outputTransfer: 'linear-to-srgb-piecewise',
      identity: { location: 1, format: 'r32uint', zeroMeaning: 'background', min: 1, max: 4294967295 },
    },
    targets: [
      { location: 0, format: 'rgba8unorm', blend: false },
      { location: 1, format: 'r32uint', blend: false },
    ],
  };
  resultBudget(result);
  // The provider already owns its independently frozen original/lowered data.
  // All remaining records are created here and are never shared across calls.
  return freezeGpuData(result);
}
