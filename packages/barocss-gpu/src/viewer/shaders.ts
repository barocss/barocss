// WGSL for the viewer: one frame block (camera and lights), one object block per draw (dynamic offset),
// a metal–roughness surface shader, an unlit one, lines, the id/depth pick pass and the output pass.
// The scene is drawn in linear light into a half-float target (blending in linear light); the output
// pass applies exposure and tone mapping and encodes sRGB for the canvas.

export const MAX_DIRECTIONAL = 4, MAX_POINT = 8, MAX_SPOT = 4;
/** Byte sizes and offsets of the uniform blocks (kept with the WGSL below and packFrame in lights.ts). */
export const FRAME_BYTES = 160 + MAX_DIRECTIONAL * 32 + MAX_POINT * 32 + MAX_SPOT * 64;
export const OBJECT_BYTES = 176, OBJECT_STRIDE = 256;

const common = /* wgsl */ `
struct DirLight { direction: vec4f, color: vec4f }
struct PointLight { position: vec4f, color: vec4f }
struct SpotLight { position: vec4f, direction: vec4f, color: vec4f, cone: vec4f }
struct Frame {
  viewProj: mat4x4f,
  eye: vec4f,
  forward: vec4f,
  sky: vec4f,
  ground: vec4f,
  up: vec4f,
  counts: vec4u,
  dirs: array<DirLight, ${MAX_DIRECTIONAL}>,
  points: array<PointLight, ${MAX_POINT}>,
  spots: array<SpotLight, ${MAX_SPOT}>,
}
struct Object {
  model: mat4x4f,
  normalMatrix: mat4x4f,
  color: vec4f,
  params: vec4f,
  pick: vec4u,
}
@group(0) @binding(0) var<uniform> frame: Frame;
@group(1) @binding(0) var<uniform> object: Object;
`;

export const surfaceWGSL = common + /* wgsl */ `
struct VOut {
  @builtin(position) clip: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
  @location(2) color: vec4f,
}
@vertex fn vs(@location(0) position: vec3f, @location(1) normal: vec3f, @location(2) color: vec4f) -> VOut {
  var o: VOut;
  let world = object.model * vec4f(position, 1.0);
  o.clip = frame.viewProj * world;
  o.world = world.xyz;
  o.normal = (object.normalMatrix * vec4f(normal, 0.0)).xyz;
  o.color = color * object.color;
  return o;
}

const PI = 3.14159265359;
fn ggx(noh: f32, a: f32) -> f32 { let a2 = a * a; let f = (noh * a2 - noh) * noh + 1.0; return a2 / (PI * f * f); }
fn smith(nov: f32, nol: f32, a: f32) -> f32 {
  let a2 = a * a;
  let gv = nol * sqrt(nov * nov * (1.0 - a2) + a2);
  let gl = nov * sqrt(nol * nol * (1.0 - a2) + a2);
  return 0.5 / max(gv + gl, 1e-5);
}
fn schlick(f0: vec3f, voh: f32) -> vec3f { return f0 + (vec3f(1.0) - f0) * pow(1.0 - voh, 5.0); }
fn brdf(n: vec3f, v: vec3f, l: vec3f, base: vec3f, metallic: f32, a: f32) -> vec3f {
  let h = normalize(v + l);
  let nol = max(dot(n, l), 0.0);
  let nov = max(dot(n, v), 1e-4);
  let f0 = mix(vec3f(0.04), base, metallic);
  let f = schlick(f0, max(dot(v, h), 0.0));
  let spec = ggx(max(dot(n, h), 0.0), a) * smith(nov, nol, a) * f;
  let diffuse = (vec3f(1.0) - f) * (1.0 - metallic) * base / PI;
  return (diffuse + spec) * nol;
}

@fragment fn fsLit(in: VOut, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  var n = normalize(in.normal);
  if (!front) { n = -n; }
  // Perspective: toward the eye; orthographic: against the view direction.
  let v = select(-frame.forward.xyz, normalize(frame.eye.xyz - in.world), frame.eye.w > 0.5);
  let base = in.color.rgb;
  let metallic = clamp(object.params.x, 0.0, 1.0);
  let rough = clamp(object.params.y, 0.04, 1.0);
  let a = rough * rough;
  let hemi = dot(n, frame.up.xyz) * 0.5 + 0.5;
  let ambient = mix(frame.ground.rgb * frame.ground.w, frame.sky.rgb * frame.sky.w, hemi);
  var c = ambient * base * (1.0 - metallic * 0.5) + object.params.z * base;
  for (var i = 0u; i < frame.counts.x; i++) {
    let d = frame.dirs[i];
    c += brdf(n, v, normalize(-d.direction.xyz), base, metallic, a) * d.color.rgb * d.color.w * PI;
  }
  for (var i = 0u; i < frame.counts.y; i++) {
    let p = frame.points[i];
    let to = p.position.xyz - in.world;
    let dist = length(to);
    var fall = 1.0 / max(dist * dist, 1e-4);
    if (p.position.w > 0.0) { let q = clamp(1.0 - pow(dist / p.position.w, 4.0), 0.0, 1.0); fall *= q * q; }
    c += brdf(n, v, to / max(dist, 1e-6), base, metallic, a) * p.color.rgb * p.color.w * fall * PI;
  }
  for (var i = 0u; i < frame.counts.z; i++) {
    let s = frame.spots[i];
    let to = s.position.xyz - in.world;
    let dist = length(to);
    let l = to / max(dist, 1e-6);
    let cone = smoothstep(s.cone.y, s.cone.x, dot(-l, normalize(s.direction.xyz)));
    var fall = cone / max(dist * dist, 1e-4);
    if (s.position.w > 0.0) { let q = clamp(1.0 - pow(dist / s.position.w, 4.0), 0.0, 1.0); fall *= q * q; }
    c += brdf(n, v, l, base, metallic, a) * s.color.rgb * s.color.w * fall * PI;
  }
  return vec4f(c * in.color.a, in.color.a);
}

@fragment fn fsUnlit(in: VOut) -> @location(0) vec4f { return vec4f(in.color.rgb * in.color.a, in.color.a); }
`;

export const lineWGSL = common + /* wgsl */ `
struct LOut { @builtin(position) clip: vec4f, @location(0) color: vec4f }
@vertex fn vs(@location(0) position: vec3f, @location(2) color: vec4f) -> LOut {
  var o: LOut;
  o.clip = frame.viewProj * object.model * vec4f(position, 1.0);
  o.color = color * object.color;
  return o;
}
@fragment fn fs(in: LOut) -> @location(0) vec4f { return vec4f(in.color.rgb * in.color.a, in.color.a); }
`;

export const pickWGSL = common + /* wgsl */ `
struct POut { @builtin(position) clip: vec4f }
struct Ids { @location(0) id: u32, @location(1) depth: f32 }
@vertex fn vs(@location(0) position: vec3f) -> POut {
  var o: POut;
  o.clip = frame.viewProj * object.model * vec4f(position, 1.0);
  return o;
}
@fragment fn fs(in: POut) -> Ids { return Ids(object.pick.x, in.clip.z); }
`;

/** Exposure, tone mapping and sRGB encoding of the (premultiplied, linear) scene for the canvas. */
export const OUTPUT_BYTES = 16;
export const outputWGSL = /* wgsl */ `
struct Output { exposure: f32, toneMapping: u32, pad0: f32, pad1: f32 }
@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var<uniform> output: Output;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
fn aces(x: vec3f) -> vec3f { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }
fn encode(c: vec3f) -> vec3f {
  let x = clamp(c, vec3f(0.0), vec3f(1.0));
  return select(1.055 * pow(x, vec3f(1.0 / 2.4)) - 0.055, x * 12.92, x <= vec3f(0.0031308));
}
@fragment fn fs(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let s = textureLoad(scene, vec2i(at.xy), 0);
  if (s.a <= 0.0) { return vec4f(0.0); }
  var c = s.rgb / s.a * output.exposure;
  if (output.toneMapping == 1u) { c = aces(c); }
  return vec4f(encode(c) * s.a, s.a);
}
`;
