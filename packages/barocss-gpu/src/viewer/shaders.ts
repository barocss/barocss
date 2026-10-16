// WGSL for the viewer: one frame block (camera and lights), one object block per draw (dynamic offset),
// a metal–roughness surface shader, an unlit one, lines, the id/depth pick pass and the output pass.
// The scene is drawn in linear light into a half-float target (blending in linear light); the output
// pass applies exposure and tone mapping and encodes sRGB for the canvas.

export const MAX_DIRECTIONAL = 4, MAX_POINT = 8, MAX_SPOT = 4;
/** Byte sizes and offsets of the uniform blocks (kept with the WGSL below and packFrame in lights.ts). */
export const FRAME_BYTES = 160 + MAX_DIRECTIONAL * 32 + MAX_POINT * 32 + MAX_SPOT * 64 + 80;
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
  // The shadow-casting directional light (counts.w: its index + 1; 0 none): its view-projection and
  // normal offset, texel size and depth bias.
  shadowViewProj: mat4x4f,
  shadow: vec4f,
}
struct Object {
  model: mat4x4f,
  normalMatrix: mat4x4f,
  color: vec4f,
  params: vec4f,
  pick: vec4u,
}
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;
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
/** Lit share (0–1) of a point by the shadow map: 3×3 percentage-closer filtering. */
fn shadowAt(world: vec3f, n: vec3f) -> f32 {
  let p = frame.shadowViewProj * vec4f(world + n * frame.shadow.x, 1.0);
  let uv = vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0)) || p.z > 1.0) { return 1.0; }
  var lit = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      lit += textureSampleCompareLevel(shadowMap, shadowSampler, uv + vec2f(f32(x), f32(y)) * frame.shadow.y, p.z - frame.shadow.z);
    }
  }
  return lit / 9.0;
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
    var lit = 1.0;
    if (frame.counts.w == i + 1u && object.pick.z == 1u) { lit = shadowAt(in.world, n); }
    c += brdf(n, v, normalize(-d.direction.xyz), base, metallic, a) * d.color.rgb * d.color.w * PI * lit;
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
// The outline mask: which outline (1-based; 0 none) covers each visible pixel.
@fragment fn fsMask(in: POut) -> @location(0) u32 { return object.pick.y; }
`;

/** Exposure, tone mapping, selection outlines and sRGB encoding of the (premultiplied, linear) scene. */
export const MAX_OUTLINES = 8;
export const OUTPUT_BYTES = 16 + MAX_OUTLINES * 16;
export const outputWGSL = /* wgsl */ `
struct Output { exposure: f32, toneMapping: u32, outlineWidth: f32, outlines: u32, colors: array<vec4f, ${MAX_OUTLINES}> }
@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var<uniform> output: Output;
@group(0) @binding(2) var mask: texture_2d<u32>;
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
  let p = vec2i(at.xy);
  let s = textureLoad(scene, p, 0);
  var c = vec3f(0.0);
  var a = s.a;
  if (s.a > 0.0) {
    c = s.rgb / s.a * output.exposure;
    if (output.toneMapping == 1u) { c = aces(c); }
    c = encode(c);
  }
  if (output.outlines > 0u) {
    // Outside an outlined region, within the outline width of it: full colour, fading over the last pixel.
    let here = textureLoad(mask, p, 0).r;
    let size = vec2i(textureDimensions(mask));
    let r = i32(ceil(output.outlineWidth + 0.5));
    var nearest = 1e9;
    var which = 0u;
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        let d = length(vec2f(f32(dx), f32(dy)));
        if (d >= nearest) { continue; }
        let q = clamp(p + vec2i(dx, dy), vec2i(0), size - 1);
        let m = textureLoad(mask, q, 0).r;
        if (m != 0u && m != here) { nearest = d; which = m; }
      }
    }
    if (which != 0u) {
      let o = output.colors[which - 1u];
      // (Outline colours are sRGB already.)
      let k = clamp(output.outlineWidth + 0.5 - nearest, 0.0, 1.0) * o.a;
      if (s.a > 0.0) { c = mix(c, o.rgb, k); a = max(a, k); } else { c = o.rgb; a = k; }
    }
  }
  // (c is sRGB, not premultiplied; the canvas takes premultiplied alpha.)
  return vec4f(c * a, a);
}
`;
