import type { LoweredMeshMaterialWGSL } from '../../material/mesh-material-wgsl.js';

/** Private emitter: its only inputs are the admitted count and actual trusted lowerer. */
export function pointLightProgramWGSLBody(count: number, material: LoweredMeshMaterialWGSL | null): string {
  const terms = Array.from({ length: count }, (_, index) =>
    `  light += pointContribution(input.worldPosition, normalizedWorldNormal, lightParams.slot[${index}]);`).join('\n');
  return `${material?.declarations ?? 'struct MaterialParams {\n  slot: array<vec4<f32>, 4>,\n}\n'}struct FrameParams {
  view: mat4x4<f32>,
  projection: mat4x4<f32>,
  color: vec4<f32>,
}
struct LightSlot {
  positionRange: vec4<f32>,
  colorIntensity: vec4<f32>,
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
  @location(1) worldPosition: vec3<f32>,
}
@vertex fn vertexMain(
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
) -> VertexOutput {
  var output: VertexOutput;
  let clip = frameParams.projection * frameParams.view * vec4<f32>(position, 1.0);
  output.position = vec4<f32>(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
  output.worldNormal = normal;
  output.worldPosition = position;
  return output;
}
fn material_mix(a: vec3<f32>, b: vec3<f32>, ratio: f32) -> vec3<f32> {
  let t = clamp(ratio, 0.0, 1.0);
  return a * (1.0 - t) + b * t;
}
// Artistic finite-range law. Future frame admission bounds world positions and normal components to +/-1e6.
// Scaling avoids squaring subnormal or very large deltas; coincidence has no diffuse direction.
fn safeWorldNormal(normal: vec3<f32>) -> vec3<f32> {
  let normalScale = max(max(abs(normal.x), abs(normal.y)), abs(normal.z));
  if (normalScale < 1.1754943508222875e-38) { return vec3<f32>(0.0); }
  let scaled = normal / normalScale;
  return scaled / sqrt(dot(scaled, scaled));
}
fn pointContribution(worldPosition: vec3<f32>, normal: vec3<f32>, slot: LightSlot) -> vec3<f32> {
  let delta = slot.positionRange.xyz - worldPosition;
  let m = max(max(abs(delta.x), abs(delta.y)), abs(delta.z));
  if (m < 1.1754943508222875e-38) { return vec3<f32>(0.0); }
  let q = delta / m;
  let s = sqrt(dot(q, q));
  let d = m * s;
  if (d >= slot.positionRange.w) { return vec3<f32>(0.0); }
  let direction = q / s;
  let window = max(1.0 - d / slot.positionRange.w, 0.0);
  let weight = window * window;
  let diffuse = max(dot(normal, direction), 0.0);
  return slot.colorIntensity.xyz * slot.colorIntensity.w * diffuse * weight;
}
struct FragmentOutput {
  @location(0) color: vec4<f32>,
  @location(1) identity: u32,
}
@fragment fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  let normalizedWorldNormal = safeWorldNormal(input.worldNormal);
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
