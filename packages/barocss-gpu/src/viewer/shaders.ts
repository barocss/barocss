// WGSL for the viewer: one frame block (camera and lights), one object block per draw (dynamic offset),
// a metal–roughness surface shader, an unlit one, lines, the id/depth pick pass and the output pass.
// The scene is drawn in linear light into a half-float target (blending in linear light); the output
// pass applies exposure and tone mapping and encodes sRGB for the canvas.

export const MAX_DIRECTIONAL = 4, MAX_POINT = 8, MAX_SPOT = 4;
/** Byte sizes and offsets of the uniform blocks (kept with the WGSL below and packFrame in lights.ts). */
export const FRAME_BYTES = 160 + MAX_DIRECTIONAL * 32 + MAX_POINT * 32 + MAX_SPOT * 64 + 80 + 16;
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
  // The target in device pixels: width, height, device pixels per CSS pixel.
  viewport: vec4f,
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

/** Lines as screen-space quads, one instance per segment: width in device pixels (object.params.x). */
export const lineWGSL = common + /* wgsl */ `
struct LOut { @builtin(position) clip: vec4f, @location(0) color: vec4f }
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) a: vec3f, @location(1) b: vec3f, @location(2) ca: vec4f, @location(3) cb: vec4f) -> LOut {
  var o: LOut;
  var pa = frame.viewProj * object.model * vec4f(a, 1.0);
  var pb = frame.viewProj * object.model * vec4f(b, 1.0);
  // Clip to the space in front of the eye before dividing.
  let eps = 1e-6;
  if (pa.w < eps && pb.w < eps) { o.clip = vec4f(0.0, 0.0, -1.0, 1.0); return o; }
  if (pa.w < eps) { pa = mix(pa, pb, (eps - pa.w) / (pb.w - pa.w)); }
  if (pb.w < eps) { pb = mix(pb, pa, (eps - pb.w) / (pa.w - pb.w)); }
  let half = frame.viewport.xy * 0.5;
  let sa = pa.xy / pa.w * half;
  let sb = pb.xy / pb.w * half;
  let d = sb - sa;
  let l = length(d);
  let dir = select(vec2f(1.0, 0.0), d / l, l > 1e-6);
  let nrm = vec2f(-dir.y, dir.x);
  var corners = array<vec2f, 6>(vec2f(0.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0), vec2f(0.0, -1.0), vec2f(1.0, 1.0), vec2f(0.0, 1.0));
  let c = corners[vi];
  let p = select(pa, pb, c.x > 0.5);
  let w = max(object.params.x, 1.0) * 0.5;
  // Square caps: each end reaches half a width past its point.
  let off = (nrm * c.y + dir * (c.x * 2.0 - 1.0)) * w / half * p.w;
  o.clip = vec4f(p.xy + off, p.zw);
  o.color = select(ca, cb, c.x > 0.5) * object.color;
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

/**
 * The output pass: ambient occlusion from the depth buffer, exposure and tone mapping of the (premultiplied,
 * linear) scene, selection outlines, the background behind it (solid or a vertical gradient, sRGB) and
 * sRGB encoding for the canvas.
 */
export const MAX_OUTLINES = 8;
export const OUTPUT_BYTES = 16 + MAX_OUTLINES * 16 + 32 + 64 + 16;
export const outputWGSL = (multisampled: boolean): string => /* wgsl */ `
struct Output {
  exposure: f32, toneMapping: u32, outlineWidth: f32, outlines: u32,
  colors: array<vec4f, ${MAX_OUTLINES}>,
  // Background at the top and bottom of the canvas (sRGB, alpha 0: transparent).
  top: vec4f, bottom: vec4f,
  // Ambient occlusion: the inverse projection, then radius (world), strength, pixels per world unit at
  // unit view depth (perspective) or per world unit (orthographic, w < 0).
  invProj: mat4x4f,
  ao: vec4f,
}
@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var<uniform> output: Output;
@group(0) @binding(2) var mask: texture_2d<u32>;
@group(0) @binding(3) var depth: ${multisampled ? 'texture_depth_multisampled_2d' : 'texture_depth_2d'};
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
fn aces(x: vec3f) -> vec3f { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }
fn encode(c: vec3f) -> vec3f {
  let x = clamp(c, vec3f(0.0), vec3f(1.0));
  return select(1.055 * pow(x, vec3f(1.0 / 2.4)) - 0.055, x * 12.92, x <= vec3f(0.0031308));
}
fn depthAt(p: vec2i) -> f32 {
  let size = vec2i(textureDimensions(depth));
  return textureLoad(depth, clamp(p, vec2i(0), size - 1), 0);
}
/** View-space position of a pixel at a depth. */
fn viewAt(p: vec2i, d: f32) -> vec3f {
  let size = vec2f(textureDimensions(depth));
  let ndc = vec2f((f32(p.x) + 0.5) / size.x * 2.0 - 1.0, 1.0 - (f32(p.y) + 0.5) / size.y * 2.0);
  let v = output.invProj * vec4f(ndc, d, 1.0);
  return v.xyz / v.w;
}
/** Share of ambient light reaching a pixel: samples on a disc around it, against the normal from depth. */
fn occlusion(p: vec2i, d: f32) -> f32 {
  let P = viewAt(p, d);
  // The normal from the nearer neighbour on each axis (no smearing across silhouettes).
  let r = viewAt(p + vec2i(1, 0), depthAt(p + vec2i(1, 0))) - P;
  let l = P - viewAt(p - vec2i(1, 0), depthAt(p - vec2i(1, 0)));
  let u = viewAt(p + vec2i(0, 1), depthAt(p + vec2i(0, 1))) - P;
  let w = P - viewAt(p - vec2i(0, 1), depthAt(p - vec2i(0, 1)));
  let dx = select(l, r, dot(r, r) < dot(l, l));
  let dy = select(w, u, dot(u, u) < dot(w, w));
  var n = normalize(cross(dx, dy));
  if (dot(n, -P) < 0.0) { n = -n; }
  let radius = output.ao.x;
  let px = select(output.ao.z * radius / max(-P.z, 1e-6), output.ao.z * radius, output.ao.w < 0.0);
  if (px < 1.0) { return 1.0; }
  // Interleaved gradient noise turns the sample spiral per pixel.
  let turn = fract(52.9829189 * fract(0.06711056 * f32(p.x) + 0.00583715 * f32(p.y))) * 6.2831853;
  var occ = 0.0;
  let N = 12;
  for (var i = 0; i < N; i++) {
    let a = f32(i) * 2.39996 + turn;
    let k = sqrt((f32(i) + 0.5) / f32(N)) * min(px, 64.0);
    let q = p + vec2i(i32(round(cos(a) * k)), i32(round(sin(a) * k)));
    let dq = depthAt(q);
    if (dq <= 0.0) { continue; }
    let v = viewAt(q, dq) - P;
    let lv = length(v);
    if (lv < 1e-6) { continue; }
    // Full weight within the radius, fading beyond it (no dark halos from far surfaces).
    occ += max(0.0, dot(n, v / lv) - 0.15) * smoothstep(0.0, 1.0, radius / lv);
  }
  return clamp(1.0 - output.ao.y * occ / f32(N), 0.0, 1.0);
}
@fragment fn fs(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let p = vec2i(at.xy);
  let s = textureLoad(scene, p, 0);
  let size = vec2f(textureDimensions(scene));
  // The background (sRGB, straight alpha) under the scene.
  let bg = mix(output.top, output.bottom, at.y / size.y);
  var c = bg.rgb;
  var a = bg.a;
  if (s.a > 0.0) {
    var lin = s.rgb / s.a * output.exposure;
    let d = depthAt(p);
    if (output.ao.y > 0.0 && d > 0.0) { lin *= occlusion(p, d); }
    if (output.toneMapping == 1u) { lin = aces(lin); }
    // Scene over background, in sRGB (the background colours are given in sRGB).
    let e = encode(lin);
    c = mix(c * a, e, s.a);
    a = s.a + a * (1.0 - s.a);
    c = select(vec3f(0.0), c / a, a > 0.0);
  }
  if (output.outlines > 0u) {
    // Outside an outlined region, within the outline width of it: full colour, fading over the last pixel.
    let here = textureLoad(mask, p, 0).r;
    let msize = vec2i(textureDimensions(mask));
    let r = i32(ceil(output.outlineWidth + 0.5));
    var nearest = 1e9;
    var which = 0u;
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        let dd = length(vec2f(f32(dx), f32(dy)));
        if (dd >= nearest) { continue; }
        let q = clamp(p + vec2i(dx, dy), vec2i(0), msize - 1);
        let m = textureLoad(mask, q, 0).r;
        if (m != 0u && m != here) { nearest = dd; which = m; }
      }
    }
    if (which != 0u) {
      let o = output.colors[which - 1u];
      // (Outline colours are sRGB already.)
      let k = clamp(output.outlineWidth + 0.5 - nearest, 0.0, 1.0) * o.a;
      c = mix(c, o.rgb, k);
      a = max(a, k);
    }
  }
  // (c is sRGB, not premultiplied; the canvas takes premultiplied alpha.)
  return vec4f(c * a, a);
}
`;
