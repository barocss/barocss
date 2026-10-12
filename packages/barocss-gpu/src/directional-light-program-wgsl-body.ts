import type { LoweredMeshMaterialWGSL } from './mesh-material-wgsl.js';

/** Private emitter: its only inputs are the admitted count and actual trusted lowerer. */
export function directionalLightProgramWGSLBody(count: number, material: LoweredMeshMaterialWGSL | null): string {
  const terms = Array.from({ length: count }, (_, index) =>
    `  light += lightParams.slot[${index}].color.xyz * lightParams.slot[${index}].directionIntensity.w * max(dot(normalizedWorldNormal, lightParams.slot[${index}].directionIntensity.xyz), 0.0);`).join('\n');
  return `${material?.declarations ?? 'struct MaterialParams {\n  slot: array<vec4<f32>, 4>,\n}\n'}struct FrameParams {
  view: mat4x4<f32>,
  projection: mat4x4<f32>,
  color: vec4<f32>,
}
struct LightSlot {
  directionIntensity: vec4<f32>,
  color: vec4<f32>,
}
struct LightParams {
  ambientStrength: f32,
  padding0: f32,
  padding1: f32,
  padding2: f32,
  slot: array<LightSlot, 4>,
}
struct DrawParams {
  identity: u32,
  padding0: u32,
  padding1: u32,
  padding2: u32,
}
@group(0) @binding(0) var<uniform> frameParams: FrameParams;
@group(0) @binding(1) var<uniform> materialParams: MaterialParams;
@group(0) @binding(2) var<uniform> lightParams: LightParams;
@group(0) @binding(3) var<uniform> drawParams: DrawParams;
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldNormal: vec3<f32>,
}
@vertex fn vertexMain(
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
) -> VertexOutput {
  var output: VertexOutput;
  let clip = frameParams.projection * frameParams.view * vec4<f32>(position, 1.0);
  output.position = vec4<f32>(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
  output.worldNormal = normal;
  return output;
}
fn material_mix(a: vec3<f32>, b: vec3<f32>, ratio: f32) -> vec3<f32> {
  let t = clamp(ratio, 0.0, 1.0);
  return a * (1.0 - t) + b * t;
}
struct FragmentOutput {
  @location(0) color: vec4<f32>,
  @location(1) identity: u32,
}
@fragment fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  let normalizedWorldNormal = normalize(input.worldNormal);
  var light = vec3<f32>(lightParams.ambientStrength);
${terms}
  let baseLinear = ${material?.expression ?? 'pow(frameParams.color.xyz, vec3<f32>(2.2))'};
  let linearRadiance = clamp(baseLinear * light, vec3<f32>(0.0), vec3<f32>(1.0));
  var output: FragmentOutput;
  output.color = vec4<f32>(pow(linearRadiance, vec3<f32>(1.0 / 2.2)), 1.0);
  output.identity = drawParams.identity;
  return output;
}
`;
}
