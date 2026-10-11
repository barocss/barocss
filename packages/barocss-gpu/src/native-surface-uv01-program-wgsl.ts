import { MeshMaterialError } from './mesh-material.js';
import { lowerNativeSurfaceUV01MaterialWGSL } from './native-surface-uv01-material-wgsl.js';
import type { LoweredNativeSurfaceUV01MaterialWGSL } from './native-surface-uv01-material-wgsl.js';
import { copyGpuData, freezeGpuData } from './gpu-data.js';

/** Trusted complete source/ABI only. Original native correspondence remains caller-owned. */
export interface LoweredNativeSurfaceUV01ProgramWGSL {
  readonly format: 'barocss-gpu-native-surface-uv01-program-wgsl';
  readonly version: 0;
  readonly profile: 'native-surface-opaque-uv01-program-wgsl-v0';
  readonly lowered: LoweredNativeSurfaceUV01MaterialWGSL;
  readonly code: string;
  readonly entryPoints: { vertex: 'native_surface_uv01_vertex'; fragment: 'native_surface_uv01_fragment' };
  readonly vertexLayout: {
    slot: number; shaderLocation: number; format: 'float32x3' | 'float32x2'; arrayStride: number; stepMode: 'vertex';
  }[];
  readonly abi: {
    frame: {
      group: 0; binding: 0; byteLength: 160;
      fields: {
        view: { byteOffset: 0; type: 'mat4x4<f32>' };
        projection: { byteOffset: 64; type: 'mat4x4<f32>' };
        light: { byteOffset: 128; type: 'vec4<f32>' };
        style: { byteOffset: 144; type: 'vec4<f32>' };
      };
    };
    material: { group: 0; binding: 1; byteLength: 64 };
    draw: {
      group: 0; binding: 2; byteLength: 16;
      identity: { byteOffset: 0; type: 'u32'; background: 0; minimum: 1; maximum: 4294967295 };
    };
    interpolation: {
      normal: { location: 0; type: 'vec3<f32>'; mode: 'perspective'; sampling: 'center'; domain: 'world-scene-normal' };
      nativeUV01: { location: 1; type: 'vec2<f32>'; mode: 'perspective'; sampling: 'center'; domain: 'native-surface-normalized-uv01' };
    };
    conventions: {
      positions: 'once-prepared-world-scene-units';
      normals: 'once-prepared-world-inverse-transpose-normalized';
      clip: 'opengl-to-webgpu-z-once';
      nativeUV01: 'original-surface-uv01-derived-in-matching-native-vertex-order';
      color: 'native-gamma-2.2-lit-opaque';
    };
  };
  readonly targets: { location: number; format: 'rgba8unorm' | 'r32uint'; type: 'vec4<f32>' | 'u32' }[];
}

const VERTEX = `struct FrameParams {
  view: mat4x4<f32>,
  projection: mat4x4<f32>,
  light: vec4<f32>,
  style: vec4<f32>,
}
struct DrawParams {
  identity: vec4<u32>,
}
@group(0) @binding(0) var<uniform> frameParams: FrameParams;
@group(0) @binding(1) var<uniform> materialParams: MaterialParams;
@group(0) @binding(2) var<uniform> drawParams: DrawParams;
struct NativeSurfaceUV01VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(perspective, center) normal: vec3<f32>,
  @location(1) @interpolate(perspective, center) uv01: vec2<f32>,
}
@vertex fn native_surface_uv01_vertex(
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv01: vec2<f32>,
) -> NativeSurfaceUV01VertexOutput {
  var output: NativeSurfaceUV01VertexOutput;
  let clip = frameParams.projection * frameParams.view * vec4<f32>(position, 1.0);
  output.position = vec4<f32>(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
  output.normal = normal;
  output.uv01 = uv01;
  return output;
}
fn material_mix(a: vec3<f32>, b: vec3<f32>, ratio: f32) -> vec3<f32> {
  let t = clamp(ratio, 0.0, 1.0);
  return a * (1.0 - t) + b * t;
}
struct NativeSurfaceUV01FragmentOutput {
  @location(0) color: vec4<f32>,
  @location(1) identity: u32,
}
`;

function budget(detail: string): never { throw new MeshMaterialError('BUDGET', detail.slice(0, 1024)); }

/** Count all ordinary paths, signed Numbers and escaped text before the final copy. */
function resultBudget(result: LoweredNativeSurfaceUV01ProgramWGSL): void {
  const encoder = new TextEncoder();
  let utf16 = 0, utf8 = 0;
  const append = (chunk: string): void => {
    utf16 += chunk.length;
    if (utf16 > 2097152) budget('Complete native UV01 program result exceeds2MiB UTF16');
    utf8 += encoder.encode(chunk).length;
    if (utf8 > 2097152) budget('Complete native UV01 program result exceeds2MiB UTF8');
  };
  const visit = (value: unknown): void => {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) budget('Owned native UV01 program result requires finite Number data');
      append(Object.is(value, -0) ? '-0' : JSON.stringify(value)); return;
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') { append(JSON.stringify(value)); return; }
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) budget('Owned native UV01 program result requires ordinary data');
    if (Array.isArray(value)) {
      append('['); value.forEach((child, index) => { if (index) append(','); visit(child); }); append(']'); return;
    }
    append('{'); Object.entries(value).forEach(([name, child], index) => {
      if (index) append(','); append(JSON.stringify(name)); append(':'); visit(child);
    }); append('}');
  };
  visit(result);
}

/** Reconstruct native UV01 source once; emit no pose, domain normalization or frame. */
export function lowerNativeSurfaceUV01ProgramWGSL(input: unknown): LoweredNativeSurfaceUV01ProgramWGSL {
  const lowered = lowerNativeSurfaceUV01MaterialWGSL(input);
  const code = lowered.declarations + VERTEX + `@fragment fn native_surface_uv01_fragment(input: NativeSurfaceUV01VertexOutput) -> NativeSurfaceUV01FragmentOutput {
  let native_surface_uv01 = input.uv01;
  let base = ${lowered.expression};
  let light = frameParams.style.w + frameParams.light.w * max(dot(normalize(input.normal), frameParams.light.xyz), 0.0);
  var output: NativeSurfaceUV01FragmentOutput;
  output.color = vec4<f32>(pow(base * light, vec3<f32>(1.0 / 2.2)), 1.0);
  output.identity = drawParams.identity.x;
  return output;
}
`;
  if (code.length > 65536 || new TextEncoder().encode(code).length > 65536)
    budget('Complete native Surface UV01 WGSL program exceeds64KiB UTF16 or UTF8');
  const result: LoweredNativeSurfaceUV01ProgramWGSL = {
    format: 'barocss-gpu-native-surface-uv01-program-wgsl', version: 0,
    profile: 'native-surface-opaque-uv01-program-wgsl-v0', lowered, code,
    entryPoints: { vertex: 'native_surface_uv01_vertex', fragment: 'native_surface_uv01_fragment' },
    vertexLayout: [
      { slot: 0, shaderLocation: 0, format: 'float32x3', arrayStride: 12, stepMode: 'vertex' },
      { slot: 1, shaderLocation: 1, format: 'float32x3', arrayStride: 12, stepMode: 'vertex' },
      { slot: 2, shaderLocation: 2, format: 'float32x2', arrayStride: 8, stepMode: 'vertex' },
    ],
    abi: {
      frame: { group: 0, binding: 0, byteLength: 160, fields: {
        view: { byteOffset: 0, type: 'mat4x4<f32>' }, projection: { byteOffset: 64, type: 'mat4x4<f32>' },
        light: { byteOffset: 128, type: 'vec4<f32>' }, style: { byteOffset: 144, type: 'vec4<f32>' },
      } },
      material: { group: 0, binding: 1, byteLength: 64 },
      draw: { group: 0, binding: 2, byteLength: 16, identity: { byteOffset: 0, type: 'u32', background: 0, minimum: 1, maximum: 4294967295 } },
      interpolation: {
        normal: { location: 0, type: 'vec3<f32>', mode: 'perspective', sampling: 'center', domain: 'world-scene-normal' },
        nativeUV01: { location: 1, type: 'vec2<f32>', mode: 'perspective', sampling: 'center', domain: 'native-surface-normalized-uv01' },
      },
      conventions: { positions: 'once-prepared-world-scene-units', normals: 'once-prepared-world-inverse-transpose-normalized',
        clip: 'opengl-to-webgpu-z-once', nativeUV01: 'original-surface-uv01-derived-in-matching-native-vertex-order', color: 'native-gamma-2.2-lit-opaque' },
    },
    targets: [ { location: 0, format: 'rgba8unorm', type: 'vec4<f32>' }, { location: 1, format: 'r32uint', type: 'u32' } ],
  };
  resultBudget(result);
  return freezeGpuData(copyGpuData(result));
}
