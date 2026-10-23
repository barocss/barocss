// WGSL for the viewer: one frame block (camera and lights), one object block per draw (dynamic offset),
// a metal–roughness surface shader, an unlit one, lines, the id/depth pick pass and the output pass.
// The scene is drawn in linear light into a half-float target (blending in linear light); the output
// pass applies exposure and tone mapping and encodes sRGB for the canvas.

export const MAX_DIRECTIONAL = 4, MAX_POINT = 8, MAX_SPOT = 4;
/** Byte sizes and offsets of the uniform blocks (kept with the WGSL below and packFrame in lights.ts). */
/** Clip planes at most (G19: a box section's six). */
export const MAX_CLIP_PLANES = 6;
export const FRAME_BYTES = 160 + MAX_DIRECTIONAL * 32 + MAX_POINT * 32 + MAX_SPOT * 64 + 80 + 16 + 96 + 16 + MAX_CLIP_PLANES * 16;
export const OBJECT_BYTES = 208, OBJECT_STRIDE = 256;

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
  // The ground grid: the inverse view-projection; cell size, cells per major line, fade distance, height
  // along the up axis; colour (linear) and opacity (0: no grid).
  invViewProj: mat4x4f,
  grid: vec4f,
  gridColor: vec4f,
  // The clip planes (G2, G19): what is drawn of a mesh they clip is where dot(clips[i].xyz, world) >= clips[i].w for
  // every plane — the intersection of their kept sides — or, w negative, for any plane (a cut-out, G20); the caps'
  // colour (linear), |w| the number of planes (0: none).
  clipColor: vec4f,
  clips: array<vec4f, ${MAX_CLIP_PLANES}>,
}
struct Object {
  model: mat4x4f,
  normalMatrix: mat4x4f,
  color: vec4f,
  params: vec4f,
  pick: vec4u,
  // Its cap's colour (linear; w 1 when set, else the frame's), times its material colour (G2b).
  cap: vec4f,
  // Its cap's hatch (G19.3): the lines' angle (cos, sin) in the cap plane's axes (hatchAcross), their spacing in world
  // units; w 1 when on.
  hatch: vec4f,
}
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;
@group(0) @binding(3) var envMap: texture_2d<f32>;
@group(0) @binding(4) var envSampler: sampler;
// The caps' probe per pixel (G19): the nearest capped surface beyond the ray's entry into the kept region — its depth,
// and 1 when a back face (drawn first while the planes cap something; 0, 0 none).
@group(0) @binding(5) var capFront: texture_2d<f32>;
// Scene caps use the same sample locations as the scene. Picks, masks and light probes retain binding 5.
@group(0) @binding(6) var capFrontSamples: texture_multisampled_2d<f32>;
/** The environment map (equirectangular, Z up) in a direction, at a mip level. */
fn envAt(d: vec3f, lod: f32) -> vec3f {
  let u = atan2(d.y, d.x) / 6.2831853 + 0.5;
  let v = acos(clamp(d.z, -1.0, 1.0)) / 3.14159265;
  return textureSampleLevel(envMap, envSampler, vec2f(u, v), lod).rgb;
}
@group(1) @binding(0) var<uniform> object: Object;
/** Every surface draw is instanced (a plain mesh: one identity instance): a transform and colour each. */
struct Instance { @location(3) c0: vec4f, @location(4) c1: vec4f, @location(5) c2: vec4f, @location(6) c3: vec4f, @location(7) color: vec4f }
fn instanceMatrix(i: Instance) -> mat4x4f { return mat4x4f(i.c0, i.c1, i.c2, i.c3); }
/** The number of clip planes (frame.clipColor.w: negative for a cut-out, G20). */
fn clipCount() -> u32 { return u32(abs(frame.clipColor.w) + 0.5); }
/**
 * Whether the planes cut out a corner (G20): kept on any plane's kept side, the removed region R the intersection of
 * their cut-away sides (convex); else (G19) kept on every plane's kept side.
 */
fn clipCutout() -> bool { return frame.clipColor.w < -0.5; }
/** Whether a world point is where the clip planes cut away, for a mesh they clip (object.pick.z bit 1). */
fn clippedAway(world: vec3f) -> bool {
  let n = clipCount();
  if (n == 0u || (object.pick.z & 2u) == 0u) { return false; }
  if (clipCutout()) {
    for (var i = 0u; i < n; i++) { let p = frame.clips[i]; if (dot(p.xyz, world) >= p.w) { return false; } }
    return true;
  }
  for (var i = 0u; i < n; i++) { let p = frame.clips[i]; if (dot(p.xyz, world) < p.w) { return true; } }
  return false;
}
/**
 * Where the eye's ray through a world point comes into what is kept past the cut (G19, G20): the ray as world + t·dir
 * (dir from the eye toward it, so the point is at t = 0 and, in perspective, the eye at −1). x: the parameter of that
 * point C; y: where the kept stretch after it ends (C is none when that is not past it); z: the plane C is on (−1: none).
 * G19 — the kept region, convex: C its entry. G20 — a cut-out: C where the ray leaves the removed region R (convex, one
 * stretch of the ray), after which it stays kept.
 */
fn regionAlong(world: vec3f) -> vec3f {
  let dir = select(frame.forward.xyz, world - frame.eye.xyz, frame.eye.w > 0.5);
  let n = clipCount();
  var lo = -1e30; var hi = 1e30; var at = -1.0;
  if (clipCutout()) {
    // (R: n·p < d for every plane — entered past each crossing out of a kept side, left at the first crossing into one.)
    for (var i = 0u; i < n; i++) {
      let p = frame.clips[i]; let den = dot(p.xyz, dir); let f = dot(p.xyz, world) - p.w;
      if (abs(den) < 1e-20) { if (f >= 0.0) { lo = 1e30; } continue; }
      let t = -f / den;
      if (den < 0.0) { lo = max(lo, t); } else if (t < hi) { hi = t; at = f32(i); }
    }
    if (lo >= hi) { return vec3f(0.0, 0.0, -1.0); }
    return vec3f(hi, 1e30, at);
  }
  for (var i = 0u; i < n; i++) {
    let p = frame.clips[i]; let den = dot(p.xyz, dir); let f = dot(p.xyz, world) - p.w;
    if (abs(den) < 1e-20) { if (f < 0.0) { hi = -1e30; } continue; }
    let t = -f / den;
    if (den > 0.0) { if (t > lo) { lo = t; at = f32(i); } } else { hi = min(hi, t); }
  }
  return vec3f(lo, hi, at);
}
/**
 * Where the eye's ray through a world point comes into the kept region, when the point is beyond it (in the region, or
 * past where the ray leaves it) and it is in front of the eye: the cap's point there, w 1 + its plane's index; else w
 * 0 (G19: the cap is at the region's entry, inside a solid when the first surface after it is a back face).
 */
fn capPoint(world: vec3f) -> vec4f {
  let r = regionAlong(world);
  if (r.z < 0.0 || r.x > r.y || r.x > 0.0 || (frame.eye.w > 0.5 && r.x <= -1.0)) { return vec4f(0.0); }
  let dir = select(frame.forward.xyz, world - frame.eye.xyz, frame.eye.w > 0.5);
  return vec4f(world + dir * r.x, 1.0 + r.z);
}
/** The clip plane a cap point is on (capPoint's w). */
fn capPlane(q: vec4f) -> vec4f { return frame.clips[u32(q.w - 0.5)]; }
/**
 * Whether a back face's fragment is the first surface after its ray's entry into the kept region, among the capped
 * meshes (the probe: their faces unclipped, the nearest beyond the entry, a back face winning a tie): then the entry is
 * inside its solid, and its cap is there (reversed depth).
 */
fn capFirst(pos: vec4f) -> bool {
  let p = textureLoad(capFront, vec2i(pos.xy), 0);
  return p.y > 0.5 && abs(p.x - pos.z) <= 1e-6;
}
// rgba16float supports MSAA without a feature request. Split a float32 depth's bits into exact
// half-float integers (11/11/10 bits); storing the depth directly in half-float loses the probe tolerance.
fn capProbeBits(z: f32, back: bool) -> vec4f {
  let bits = bitcast<u32>(z);
  return vec4f(f32(bits & 2047u), f32((bits >> 11u) & 2047u), f32(bits >> 22u), select(0.0, 1.0, back));
}
fn capSampleDepth(world: vec3f) -> f32 {
  let clip = frame.viewProj * vec4f(world, 1.0);
  return clip.z / clip.w;
}
fn capFirstSample(pos: vec4f, world: vec3f, sample: u32) -> bool {
  let p = textureLoad(capFrontSamples, vec2i(pos.xy), i32(sample));
  let z = bitcast<f32>(u32(p.x) | (u32(p.y) << 11u) | (u32(p.z) << 22u));
  return p.w > 0.5 && abs(z - capSampleDepth(world)) <= 1e-6;
}
/** The reversed depth of a cap point, or −1 when it is not in the view's depth range. */
fn capDepth(q: vec4f) -> f32 {
  if (q.w < 0.5) { return -1.0; }
  let c = frame.viewProj * vec4f(q.xyz, 1.0);
  if (c.w <= 0.0) { return -1.0; }
  let z = c.z / c.w;
  return select(-1.0, z, z >= 0.0 && z <= 1.0);
}
/** Normals through an instance transform: the cofactor of its 3×3 (any invertible transform). */
fn instanceNormal(i: Instance, n: vec3f) -> vec3f {
  let a = i.c0.xyz; let b = i.c1.xyz; let c = i.c2.xyz;
  return mat3x3f(cross(b, c), cross(c, a), cross(a, b)) * n;
}
`;

/**
 * A shader material's part of the surface shader: WGSL declarations, and an expression of the linear
 * base colour (vec3<f32>) with uv, world and normal (and any aliases of them) and materialParams in scope.
 */
export interface SurfaceShader { declarations?: string; expression: string; aliases?: Readonly<Record<string, 'uv' | 'world' | 'normal'>> }
const DEFAULT_PARAMS = 'struct MaterialParams {\n  slot: array<vec4<f32>, 4>,\n}\n';

/** The surface shader, with a shader material's colour when one is given. */
export const surfaceWGSL = (custom?: SurfaceShader, capSamples = false): string => common + (custom?.declarations ?? '') + (/struct\s+MaterialParams\b/.test(custom?.declarations ?? '') ? '' : DEFAULT_PARAMS) + /* wgsl */ `
// The material's colour map (a white texel when it has none), sRGB-decoded by its format, and the
// 64 bytes of a shader material's parameters.
@group(2) @binding(0) var map: texture_2d<f32>;
@group(2) @binding(1) var mapSampler: sampler;
@group(2) @binding(2) var<uniform> materialParams: MaterialParams;
fn shaderColor(uv: vec2f, world: vec3f, normal: vec3f) -> vec3f {
${Object.entries(custom?.aliases ?? {}).map(([name, from]) => `  let ${name} = ${from};
`).join('')}  return ${custom ? custom.expression : 'vec3f(1.0)'};
}
struct VOut {
  @builtin(position) clip: vec4f,
  @location(0) ${capSamples ? '@interpolate(perspective, sample) ' : ''}world: vec3f,
  @location(1) normal: vec3f,
  @location(2) color: vec4f,
  @location(3) uv: vec2f,
  // A colour map's scalar (G6; 0 elsewhere).
  @location(4) scalar: f32,
}
@vertex fn vs(@location(0) position: vec3f, @location(1) normal: vec3f, @location(2) color: vec4f, inst: Instance, @location(8) uv: vec2f) -> VOut {
  var o: VOut;
  let world = object.model * instanceMatrix(inst) * vec4f(position, 1.0);
  o.clip = frame.viewProj * world;
  o.world = world.xyz;
  o.normal = (object.normalMatrix * vec4f(instanceNormal(inst, normal), 0.0)).xyz;
  o.color = color * inst.color * object.color;
  o.uv = uv;
  o.scalar = 0.0;
  return o;
}
// A colour-mapped mesh (G6): position, normal, instance and its scalar; no vertex colour or uv.
@vertex fn vsMap(@location(0) position: vec3f, @location(1) normal: vec3f, inst: Instance, @location(9) scalar: f32) -> VOut {
  var o: VOut;
  let world = object.model * instanceMatrix(inst) * vec4f(position, 1.0);
  o.clip = frame.viewProj * world;
  o.world = world.xyz;
  o.normal = (object.normalMatrix * vec4f(instanceNormal(inst, normal), 0.0)).xyz;
  o.color = vec4f(1.0);
  o.uv = vec2f(0.0);
  o.scalar = scalar;
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

fn litColor(in: VOut, front: bool) -> vec4f {
  let texel = textureSample(map, mapSampler, in.uv);
  let alpha = in.color.a * texel.a;
  if (clippedAway(in.world)) { discard; }
  // Alpha cutout (pick.w: the cutoff × 1000; 0 off).
  if (object.pick.w > 0u && alpha < f32(object.pick.w) / 1000.0) { discard; }
  var n = normalize(in.normal);
  if (!front) { n = -n; }
  let base = in.color.rgb * texel.rgb * shaderColor(in.uv, in.world, n);
  let c = shade(in.world, n, base, object.params.x, object.params.y, object.params.z, (object.pick.z & 1u) == 1u);
  return vec4f(c * alpha, alpha);
}
@fragment fn fsLit(in: VOut, @builtin(front_facing) front: bool) -> @location(0) vec4f { return litColor(in, front); }
// Order-independent transparency (G11, weighted blended): the premultiplied colour weighted by nearness into the
// accumulation, its alpha into the revealage (what of the background still shows), summed in any order. The weight
// falls with the view depth over the scene's size (frame.viewport.w), so a nearer layer counts for more.
struct Oit { @location(0) accum: vec4f, @location(1) reveal: f32 }
fn oitOf(c: vec4f, world: vec3f) -> Oit {
  let d = max(dot(world - frame.eye.xyz, frame.forward.xyz), 0.0) / max(frame.viewport.w, 1e-6);
  let w = clamp(1.0 / (1e-3 + pow(d * 0.5, 3.0)), 1e-2, 3e3);
  var o: Oit;
  o.accum = c * w;
  o.reveal = c.a;
  return o;
}
@fragment fn fsLitOit(in: VOut, @builtin(front_facing) front: bool) -> Oit { return oitOf(litColor(in, front), in.world); }

/** Lit colour of a point: ambient (hemisphere or environment map), its reflection, emission, and every light. */
fn shade(world: vec3f, n: vec3f, base: vec3f, metallicIn: f32, roughIn: f32, emissive: f32, receive: bool) -> vec3f {
  // Perspective: toward the eye; orthographic: against the view direction.
  let v = select(-frame.forward.xyz, normalize(frame.eye.xyz - world), frame.eye.w > 0.5);
  let metallic = clamp(metallicIn, 0.0, 1.0);
  let rough = clamp(roughIn, 0.04, 1.0);
  let a = rough * rough;
  let hemi = dot(n, frame.up.xyz) * 0.5 + 0.5;
  var ambient = mix(frame.ground.rgb * frame.ground.w, frame.sky.rgb * frame.sky.w, hemi);
  // An environment map (up.w its intensity) lights instead: its most blurred level round the normal.
  if (frame.up.w > 0.0) { ambient = envAt(n, frame.forward.w) * frame.up.w; }
  // Ambient: diffuse from the hemisphere around the normal, and its reflection around the mirrored view
  // direction (blurred toward the diffuse one with roughness), weighted by Fresnel. Metals get their
  // colour from the reflection only.
  let f0 = mix(vec3f(0.04), base, metallic);
  let nov = max(dot(n, v), 0.0);
  let mirrored = reflect(-v, n);
  let skyward = smoothstep(-0.3, 0.3, dot(mirrored, frame.up.xyz));
  var reflected = mix(mix(frame.ground.rgb * frame.ground.w, frame.sky.rgb * frame.sky.w, skyward), ambient, rough);
  if (frame.up.w > 0.0) { reflected = envAt(mirrored, rough * frame.forward.w) * frame.up.w; }
  let fresnel = f0 + (max(vec3f(1.0 - rough), f0) - f0) * pow(1.0 - nov, 5.0);
  var c = ambient * base * (1.0 - metallic) + reflected * fresnel + emissive * base;
  for (var i = 0u; i < frame.counts.x; i++) {
    let d = frame.dirs[i];
    var lit = 1.0;
    if (frame.counts.w == i + 1u && receive) { lit = shadowAt(world, n); }
    c += brdf(n, v, normalize(-d.direction.xyz), base, metallic, a) * d.color.rgb * d.color.w * PI * lit;
  }
  for (var i = 0u; i < frame.counts.y; i++) {
    let p = frame.points[i];
    let to = p.position.xyz - world;
    let dist = length(to);
    var fall = 1.0 / max(dist * dist, 1e-4);
    if (p.position.w > 0.0) { let q = clamp(1.0 - pow(dist / p.position.w, 4.0), 0.0, 1.0); fall *= q * q; }
    c += brdf(n, v, to / max(dist, 1e-6), base, metallic, a) * p.color.rgb * p.color.w * fall * PI;
  }
  for (var i = 0u; i < frame.counts.z; i++) {
    let s = frame.spots[i];
    let to = s.position.xyz - world;
    let dist = length(to);
    let l = to / max(dist, 1e-6);
    let cone = smoothstep(s.cone.y, s.cone.x, dot(-l, normalize(s.direction.xyz)));
    var fall = cone / max(dist * dist, 1e-4);
    if (s.position.w > 0.0) { let q = clamp(1.0 - pow(dist / s.position.w, 4.0), 0.0, 1.0); fall *= q * q; }
    c += brdf(n, v, l, base, metallic, a) * s.color.rgb * s.color.w * fall * PI;
  }
  return c;
}

// The clip plane's cap (G2): a kept back face seen through the cut, drawn where the eye's ray crosses the plane, in the
// cap colour, lit as a face on the plane facing the cut-away side (the mesh's metal and roughness; flat when unlit).
struct CapOut { @location(0) color: vec4f, @builtin(frag_depth) depth: f32 }
/**
 * The direction across a cap's hatch lines (G19.3) on a plane of normal n0, its lines at (c, s) = (cos, sin) of their
 * angle from the plane's u axis toward its v: the normal turned so its largest component is positive (a plane and its
 * flip hatch alike); u the next world axis after that component's (x → y → z → x) into the plane, v = n × u. (As
 * capHatchAxes in geometry.ts.)
 */
fn hatchAcross(n0: vec3f, c: f32, s: f32) -> vec3f {
  let m = abs(n0);
  var k = 2u;
  if (m.x >= m.y && m.x >= m.z) { k = 0u; } else if (m.y >= m.z) { k = 1u; }
  let n = select(n0, -n0, n0[k] < 0.0);
  var a = vec3f(0.0); a[(k + 1u) % 3u] = 1.0;
  let u = normalize(a - n * dot(n, a));
  let v = cross(n, u);
  return c * v - s * u;
}
/** A cap's colour (lit, hatched; rgb) and its depth (w) at a back face's fragment — discarded where it is no cap. */
fn capShade(in: VOut, sample: u32) -> vec4f {
  let q = capPoint(in.world);
  // (The hatch's coordinate and its change per pixel — across the lines, so a line is 1 pixel wide at any angle —
  // before any fragment is discarded.)
  let across = hatchAcross(frame.clips[u32(max(q.w - 0.5, 0.0))].xyz, object.hatch.x, object.hatch.y);
  let h = dot(q.xyz, across) / max(object.hatch.z, 1e-12);
  let hw = length(vec2f(dpdx(h), dpdy(h)));
  if (!${capSamples ? 'capFirstSample(in.clip, in.world, sample)' : 'capFirst(in.clip)'}) { discard; }
  let z = capDepth(q);
  if (z < 0.0) { discard; }
  let n = -normalize(capPlane(q).xyz);
  let base = select(frame.clipColor.rgb, object.cap.rgb * object.color.rgb, object.cap.w > 0.5);
  var c = base;
  if (object.params.w < 0.5) { c = shade(q.xyz, n, base, object.params.x, object.params.y, 0.0, (object.pick.z & 1u) == 1u); }
  // (Lines 1 CSS pixel wide, antialiased: the cap's colour × 0.45 on them.)
  if (object.hatch.w > 0.5) {
    let d = abs(fract(h + 0.5) - 0.5) / max(hw, 1e-12);
    c = c * (1.0 - 0.55 * clamp(0.5 * frame.viewport.z + 0.5 - d, 0.0, 1.0));
  }
  return vec4f(c, z);
}
@fragment fn fsCap(in: VOut${capSamples ? ', @builtin(sample_index) sample: u32' : ''}) -> CapOut {
  let c = capShade(in, ${capSamples ? 'sample' : '0u'});
  var o: CapOut;
  o.color = vec4f(c.rgb, 1.0);
  o.depth = c.w;
  return o;
}
// A see-through mesh's cap (G19.4, a ghost's): into the order-independent pass at the mesh's opacity, at its depth.
struct CapOit { @location(0) accum: vec4f, @location(1) reveal: f32, @builtin(frag_depth) depth: f32 }
@fragment fn fsCapOit(in: VOut${capSamples ? ', @builtin(sample_index) sample: u32' : ''}) -> CapOit {
  let c = capShade(in, ${capSamples ? 'sample' : '0u'});
  let a = object.color.a;
  let w = oitOf(vec4f(c.rgb * a, a), capPoint(in.world).xyz);
  return CapOit(w.accum, w.reveal, c.w);
}

/**
 * A colour map's colour for a scalar (G6): the map's ramp (group 2's texture, 256 texels, sRGB-decoded) across the range in
 * materialParams.slot[0].xy, in .z bands when ≥ 1; the missing colour (slot 1) for none, the below and above colours
 * (slots 2, 3, w 1 when set) outside the range.
 */
fn mapColor(v: f32) -> vec3f {
  let p = materialParams.slot;
  if (v < -1e37) { return p[1].rgb; }
  if (v < p[0].x && p[2].w > 0.5) { return p[2].rgb; }
  if (v > p[0].y && p[3].w > 0.5) { return p[3].rgb; }
  var t = clamp((v - p[0].x) / max(p[0].y - p[0].x, 1e-30), 0.0, 1.0);
  if (p[0].z >= 1.0) { t = min(floor(t * p[0].z), p[0].z - 1.0) / max(p[0].z - 1.0, 1.0); }
  return textureSampleLevel(map, mapSampler, vec2f(t * (255.0 / 256.0) + 0.5 / 256.0, 0.5), 0.0).rgb;
}
@fragment fn fsMap(in: VOut, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  if (clippedAway(in.world)) { discard; }
  var n = normalize(in.normal);
  if (!front) { n = -n; }
  let base = mapColor(in.scalar);
  if (object.params.w > 0.5) { return vec4f(base, 1.0); }
  return vec4f(shade(in.world, n, base, object.params.x, object.params.y, 0.0, (object.pick.z & 1u) == 1u), 1.0);
}

fn unlitColor(in: VOut) -> vec4f {
  let texel = textureSample(map, mapSampler, in.uv);
  let a = in.color.a * texel.a;
  if (clippedAway(in.world)) { discard; }
  if (object.pick.w > 0u && a < f32(object.pick.w) / 1000.0) { discard; }
  return vec4f(in.color.rgb * texel.rgb * shaderColor(in.uv, in.world, normalize(in.normal)) * a, a);
}
@fragment fn fsUnlit(in: VOut) -> @location(0) vec4f { return unlitColor(in); }
@fragment fn fsUnlitOit(in: VOut) -> Oit { return oitOf(unlitColor(in), in.world); }
// A shadow catcher: only the shadow of the casting light, in the material colour, as dark as its opacity.
@fragment fn fsShadow(in: VOut) -> @location(0) vec4f {
  if (clippedAway(in.world)) { discard; }
  var lit = 1.0;
  if (frame.counts.w > 0u) { lit = shadowAt(in.world, normalize(in.normal)); }
  let a = (1.0 - lit) * in.color.a;
  return vec4f(in.color.rgb * a, a);
}
`;

/**
 * Lines as screen-space quads, one instance per segment: width in device pixels (object.params.x); dashed when
 * object.params.y (on) and .z (off, device pixels) are set, from each segment's start; fsHidden draws the parts behind
 * surfaces at object.params.w of their opacity (G7).
 */
export const lineWGSL = common + /* wgsl */ `
struct LOut { @builtin(position) clip: vec4f, @location(0) color: vec4f, @location(1) world: vec3f, @location(2) @interpolate(linear) along: f32 }
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) a: vec3f, @location(1) b: vec3f, @location(2) ca: vec4f, @location(3) cb: vec4f) -> LOut {
  return lineVertex(vi, a, b, ca, cb);
}
/** Off screen: a corner that draws nothing. */
fn lineNone() -> LOut { var o: LOut; o.clip = vec4f(0.0, 0.0, -1.0, 1.0); return o; }
/** A contour vertex's facing (G8): its normal against the eye's direction, both normalised; 0 within 1e-7; 2: none. */
fn facingAt(p: vec3f, n: vec3f) -> f32 {
  let w = (object.model * vec4f(p, 1.0)).xyz;
  let a = (object.model * vec4f(n, 0.0)).xyz;
  let v = select(-frame.forward.xyz, frame.eye.xyz - w, frame.eye.w > 0.5);
  let l = length(a) * length(v);
  if (!(l > 0.0)) { return 2.0; }
  let d = dot(a, v) / l;
  return select(d, 0.0, abs(d) <= 1e-7);
}
/**
 * A contour's segment across one triangle (G8, as the studio's silhouetteLines finds it on the CPU): where the facing,
 * linear between the vertices, is zero — the edge between two vertices at zero, or a vertex at zero and a crossing, or
 * two crossings; none when every vertex is at zero or the two points meet.
 */
@vertex fn vsContour(@builtin(vertex_index) vi: u32, @location(0) a: vec3f, @location(1) b: vec3f, @location(2) c: vec3f, @location(3) na: vec3f, @location(4) nb: vec3f, @location(5) nc: vec3f) -> LOut {
  var p = array<vec3f, 3>(a, b, c);
  var f = array<f32, 3>(facingAt(a, na), facingAt(b, nb), facingAt(c, nc));
  if (max(max(f[0], f[1]), f[2]) > 1.5) { return lineNone(); }
  var q = array<vec3f, 2>(a, a);
  var n = 0u;
  for (var i = 0u; i < 3u; i++) { if (f[i] == 0.0) { if (n < 2u) { q[n] = p[i]; } n++; } }
  if (n == 3u) { return lineNone(); }
  if (n < 2u) {
    for (var e = 0u; e < 3u; e++) {
      let j = (e + 1u) % 3u;
      if (f[e] * f[j] >= 0.0) { continue; }
      if (n < 2u) { q[n] = mix(p[e], p[j], f[e] / (f[e] - f[j])); }
      n++;
    }
    let scale = max(max(length(b - a), length(c - a)), length(c - b));
    if (n != 2u || !(length(q[0] - q[1]) > scale * 1e-10)) { return lineNone(); }
  }
  return lineVertex(vi, q[0], q[1], vec4f(1.0), vec4f(1.0));
}
fn lineVertex(vi: u32, a: vec3f, b: vec3f, ca: vec4f, cb: vec4f) -> LOut {
  var o: LOut;
  let wa = object.model * vec4f(a, 1.0);
  let wb = object.model * vec4f(b, 1.0);
  var pa = frame.viewProj * wa;
  var pb = frame.viewProj * wb;
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
  o.world = select(wa.xyz, wb.xyz, c.x > 0.5);
  o.along = c.x * l;
  return o;
}
fn lineColor(in: LOut, dash: vec2f) -> vec4f {
  if (clippedAway(in.world)) { discard; }
  let period = dash.x + dash.y;
  if (dash.x > 0.0 && dash.y > 0.0 && in.along % period > dash.x) { discard; }
  return vec4f(in.color.rgb * in.color.a, in.color.a);
}
@fragment fn fs(in: LOut) -> @location(0) vec4f { return lineColor(in, object.params.yz); }
@fragment fn fsHidden(in: LOut) -> @location(0) vec4f { return lineColor(in, object.hatch.xy) * object.params.w; }
`;

/**
 * Points as screen-space sprites, one instance each (G8): size in device pixels (object.params.x), a border inside the
 * edge (.y pixels, colour object.cap.rgb), a disc (.z 1) or a square (.z 0); edges by coverage, blended. fsHidden draws
 * the parts behind surfaces at object.params.w of their opacity.
 */
export const pointWGSL = common + /* wgsl */ `
struct POut { @builtin(position) clip: vec4f, @location(0) color: vec4f, @location(1) world: vec3f, @location(2) @interpolate(linear) local: vec2f }
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) p: vec3f, @location(1) c: vec4f) -> POut {
  var o: POut;
  let w = object.model * vec4f(p, 1.0);
  let q = frame.viewProj * w;
  if (q.w < 1e-6) { o.clip = vec4f(0.0, 0.0, -1.0, 1.0); return o; }
  var corners = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0));
  // (Half a pixel more than its half size each way: the coverage at its edge reaches no further (G14: a pixel more drew
  // 25 for a point of 3, now 16).)
  let r = max(object.params.x, 1.0) * 0.5 + 0.5;
  let k = corners[vi];
  o.clip = vec4f(q.xy + k * r / (frame.viewport.xy * 0.5) * q.w, q.zw);
  o.local = k * r;
  o.color = c * object.color;
  o.world = w.xyz;
  return o;
}
// (No discard, G14: a point writes no depth and always blends, so where it does not cover it returns nothing — and a
// pipeline without discard keeps the depth test ahead of the shader, which the hidden-parts pass leans on.)
fn pointColor(in: POut) -> vec4f {
  let half = max(object.params.x, 1.0) * 0.5;
  let d = select(max(abs(in.local.x), abs(in.local.y)), length(in.local), object.params.z > 0.5);
  let cover = select(clamp(half - d + 0.5, 0.0, 1.0), 0.0, clippedAway(in.world));
  var col = in.color;
  if (object.params.y > 0.0) { col = mix(col, vec4f(object.cap.rgb, object.color.a), clamp(d - (half - object.params.y) + 0.5, 0.0, 1.0)); }
  let a = col.a * cover;
  return vec4f(col.rgb * a, a);
}
@fragment fn fs(in: POut) -> @location(0) vec4f { return pointColor(in); }
@fragment fn fsHidden(in: POut) -> @location(0) vec4f { return pointColor(in) * object.params.w; }
`;

/**
 * Text labels (G15): one quad an instance — a glyph from the distance-field atlas, or a label's rounded box (its fill,
 * or with uv.x < 0 its 1-pixel border). A screen label's rectangle is in CSS pixels about its anchor's projection (y
 * down); a plane label's in world units along its plane's right and up. Glyph edges are cut at the field's middle, a
 * device pixel wide whatever the size (fwidth); boxes by their distance in device pixels. fsHidden at object.params.w.
 */
export const labelWGSL = common + /* wgsl */ `
@group(2) @binding(0) var atlas: texture_2d<f32>;
@group(2) @binding(1) var atlasSampler: sampler;
struct LOut {
  @builtin(position) clip: vec4f, @location(0) color: vec4f, @location(1) world: vec3f, @location(2) uv: vec2f,
  @location(3) @interpolate(linear) local: vec2f, @location(4) @interpolate(flat) rect: vec4f, @location(5) @interpolate(flat) info: vec4f,
}
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) at: vec3f, @location(1) c: vec4f, @location(2) rect: vec4f, @location(3) uv: vec4f, @location(4) right: vec4f, @location(5) up: vec4f) -> LOut {
  var o: LOut;
  var corners = array<vec2f, 6>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 1.0));
  let k = corners[vi];
  let x = mix(rect.x, rect.z, k.x);
  let y = mix(rect.y, rect.w, k.y);
  let plane = right.w >= 1.5;
  var world: vec3f;
  if (plane) {
    world = (object.model * vec4f(at + right.xyz * x + up.xyz * y, 1.0)).xyz;
    o.clip = frame.viewProj * vec4f(world, 1.0);
  } else {
    world = (object.model * vec4f(at, 1.0)).xyz;
    let q = frame.viewProj * vec4f(world, 1.0);
    if (q.w < 1e-6) { o.clip = vec4f(0.0, 0.0, -1.0, 1.0); return o; }
    o.clip = vec4f(q.xy + vec2f(x, -y) * frame.viewport.z / (frame.viewport.xy * 0.5) * q.w, q.zw);
  }
  o.color = c * object.color;
  o.world = world;
  o.uv = vec2f(mix(uv.x, uv.z, k.x), mix(uv.y, uv.w, k.y));
  o.local = vec2f(x, y);
  o.rect = rect;
  o.info = vec4f(right.w - select(0.0, 2.0, plane), up.w, select(0.0, 1.0, uv.x < 0.0), 0.0);
  return o;
}
fn labelColor(in: LOut) -> vec4f {
  // (Sampled and differentiated first, in uniform control flow.)
  let s = textureSample(atlas, atlasSampler, in.uv).r;
  let w = max(fwidth(s), 1e-4) * 0.75;
  let unit = max(fwidth(in.local.x), 1e-6);
  var cover: f32;
  if (in.info.x < 0.5) {
    cover = smoothstep(0.502 - w, 0.502 + w, s);
  } else {
    let c = (in.rect.xy + in.rect.zw) * 0.5;
    let h = abs(in.rect.zw - in.rect.xy) * 0.5;
    let r = min(in.info.y, min(h.x, h.y));
    let q = abs(in.local - c) - h + vec2f(r);
    let d = (length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r) / unit;
    let bw = frame.viewport.z;
    cover = select(clamp(0.5 - d, 0.0, 1.0), clamp(bw * 0.5 + 0.5 - abs(d + bw * 0.5), 0.0, 1.0), in.info.z > 0.5);
  }
  cover = select(cover, 0.0, clippedAway(in.world));
  let a = in.color.a * cover;
  return vec4f(in.color.rgb * a, a);
}
@fragment fn fs(in: LOut) -> @location(0) vec4f { return labelColor(in); }
@fragment fn fsHidden(in: LOut) -> @location(0) vec4f { return labelColor(in) * object.params.w; }
`;

/**
 * The see-through surfaces composited over the scene (G11): their weighted average colour where the revealage leaves
 * room for it, premultiplied — blended as any surface over what is drawn (the accumulation and revealage resolved).
 */
export const oitWGSL = /* wgsl */ `
@group(0) @binding(0) var accum: texture_2d<f32>;
@group(0) @binding(1) var reveal: texture_2d<f32>;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  return vec4f(p, 0.0, 1.0);
}
@fragment fn fs(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let q = vec2i(at.xy);
  let r = textureLoad(reveal, q, 0).r;
  if (r >= 1.0) { discard; }
  let a = textureLoad(accum, q, 0);
  let k = 1.0 - r;
  return vec4f(a.rgb / max(a.a, 1e-5) * k, k);
}
`;

/** The ground grid: the plane through the up axis at the grid height, ray-cast per pixel. */
export const gridWGSL = common + /* wgsl */ `
struct GOut { @builtin(position) pos: vec4f, @location(0) ndc: vec2f }
@vertex fn vs(@builtin(vertex_index) i: u32) -> GOut {
  var o: GOut;
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  o.pos = vec4f(p, 0.0, 1.0);
  o.ndc = p;
  return o;
}
struct GFrag { @location(0) color: vec4f, @builtin(frag_depth) depth: f32 }
/** Coverage of lines every size along both plane axes, about one pixel wide. */
fn lines(uv: vec2f, size: f32) -> f32 {
  let c = uv / size;
  let g = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), vec2f(1e-6));
  return 1.0 - min(min(g.x, g.y), 1.0);
}
fn axisLine(x: f32) -> f32 { return 1.0 - min(abs(x) / max(fwidth(x), 1e-6) / 1.5, 1.0); }
@fragment fn fs(in: GOut) -> GFrag {
  let a = frame.invViewProj * vec4f(in.ndc, 1.0, 1.0);
  let b = frame.invViewProj * vec4f(in.ndc, 0.5, 1.0);
  let p0 = a.xyz / a.w;
  let dir = b.xyz / b.w - p0;
  let up = normalize(frame.up.xyz);
  let den = dot(dir, up);
  let t = (frame.grid.w - dot(p0, up)) / select(den, 1e-12, abs(den) < 1e-12);
  let hit = p0 + dir * t;
  // Plane axes: x and y for a z-up world.
  let e2 = normalize(select(cross(up, vec3f(1.0, 0.0, 0.0)), cross(up, vec3f(0.0, 1.0, 0.0)), abs(up.x) > 0.9));
  let e1 = cross(e2, up);
  let uv = vec2f(dot(hit, e1), dot(hit, e2));
  let minor = lines(uv, frame.grid.x);
  let major = lines(uv, frame.grid.x * frame.grid.y);
  let ax = axisLine(uv.y);
  let ay = axisLine(uv.x);
  // Fade with distance and at grazing angles (where lines would alias).
  let dist = length(hit - select(p0, frame.eye.xyz, frame.eye.w > 0.5));
  let fade = (1.0 - smoothstep(frame.grid.z * 0.4, frame.grid.z, dist)) * smoothstep(0.02, 0.25, abs(dot(normalize(dir), up)));
  var color = frame.gridColor.rgb;
  var k = max(minor * 0.45, major) * frame.gridColor.a;
  // Axes a little stronger than the grid's major lines.
  let axisAlpha = clamp(frame.gridColor.a * 2.0, 0.0, 0.9);
  if (ax > 0.0) { color = mix(color, vec3f(0.75, 0.12, 0.10), ax); k = max(k, ax * axisAlpha); }
  if (ay > 0.0) { color = mix(color, vec3f(0.15, 0.55, 0.12), ay); k = max(k, ay * axisAlpha); }
  k *= fade;
  let clip = frame.viewProj * vec4f(hit, 1.0);
  var o: GFrag;
  o.color = vec4f(color * k, k);
  o.depth = clamp(clip.z / clip.w, 0.0, 1.0);
  if (t <= 0.0 || k <= 0.002 || clip.w <= 0.0) { discard; }
  return o;
}
`;

const pickShader = (capSamples = false): string => common + /* wgsl */ `
struct POut { @builtin(position) clip: vec4f, @location(0) @interpolate(flat) instance: u32, @location(1) ${capSamples ? '@interpolate(perspective, sample) ' : ''}world: vec3f }
struct Ids { @location(0) id: u32, @location(1) depth: f32, @location(2) instance: u32 }
@vertex fn vs(@location(0) position: vec3f, inst: Instance, @builtin(instance_index) ii: u32) -> POut {
  var o: POut;
  let world = object.model * instanceMatrix(inst) * vec4f(position, 1.0);
  o.clip = frame.viewProj * world;
  o.instance = ii;
  o.world = world.xyz;
  return o;
}
@fragment fn fs(in: POut) -> Ids {
  if (clippedAway(in.world)) { discard; }
  return Ids(object.pick.x, in.clip.z, in.instance);
}
// The outline mask: which outline (1-based; 0 none) covers each visible pixel.
@fragment fn fsMask(in: POut) -> @location(0) u32 {
  if (clippedAway(in.world)) { discard; }
  return object.pick.y;
}
// The nearest kept front surface's depth (capFront, read by the caps).
// The caps' probe (G19): a capped mesh's face, unclipped, beyond its ray's entry into the kept region — its depth, and
// whether a back face; the nearest kept by the depth test, a back face drawn a little nearer so that it wins a tie (two
// solids touching: the cap is the first's).
struct Probe { @location(0) v: ${capSamples ? 'vec4f' : 'vec2f'}, @builtin(frag_depth) z: f32 }
// (Which way is nearer: +1 in the scene's reversed depth, −1 in the shadow map's — the light's probe, G19.4.)
override nearer: f32 = 1.0;
@fragment fn fsCapProbe(in: POut, @builtin(front_facing) front: bool${capSamples ? ', @builtin(sample_index) sample: u32' : ''}) -> Probe {
  if (capPoint(in.world).w < 0.5) { discard; }
  var o: Probe;
  let z = ${capSamples ? 'capSampleDepth(in.world)' : 'in.clip.z'};
  o.v = ${capSamples ? 'capProbeBits(z, !front)' : 'vec2f(z, select(1.0, 0.0, front))'};
  // (A back face's lead: enough to win a tie — two faces at one depth, to rounding — and no more. In the scene's reversed
  // depth, a share of it (G20.2: a fixed 4e-7 there, far from the eye, put a back face just behind a front one — near an
  // edge — ahead of it, a cap leaking over the edge); in the shadow map's, linear in distance, a fixed one.)
  let lead = select(4e-7, max(z, 1e-12) * 1e-5, nearer > 0.0);
  o.z = clamp(z + select(lead * nearer, 0.0, front), 0.0, 1.0);
  return o;
}
// The shadow map: depth only, less what the clip plane cuts away.
@fragment fn fsDepth(in: POut) { if (clippedAway(in.world)) { discard; } }
// The cap in the pick and the outline mask (G2): at the plane's depth, as fsCap draws it.
struct CapIds { @location(0) id: u32, @location(1) depth: f32, @location(2) instance: u32, @builtin(frag_depth) z: f32 }
@fragment fn fsCapPick(in: POut) -> CapIds {
  if (!capFirst(in.clip)) { discard; }
  let z = capDepth(capPoint(in.world));
  if (z < 0.0) { discard; }
  return CapIds(object.pick.x, z, in.instance, z);
}
// The caps in the shadow map (G19.4): as in the scene, from the light — its probe read, the cap at its entry's depth.
@fragment fn fsCapShadow(in: POut) -> @builtin(frag_depth) f32 {
  if (!capFirst(in.clip)) { discard; }
  let z = capDepth(capPoint(in.world));
  if (z < 0.0) { discard; }
  return z;
}
struct CapMask { @location(0) id: u32, @builtin(frag_depth) z: f32 }
@fragment fn fsCapMask(in: POut) -> CapMask {
  if (!capFirst(in.clip)) { discard; }
  let z = capDepth(capPoint(in.world));
  if (z < 0.0) { discard; }
  return CapMask(object.pick.y, z);
}
`;
export const pickWGSL = pickShader();
/** Scene-only probe; its interpolated world point and depth are evaluated at each MSAA sample. */
export const capProbeSamplesWGSL = pickShader(true);

/**
 * The output pass: ambient occlusion from the depth buffer, exposure and tone mapping of the (premultiplied,
 * linear) scene, selection outlines, the background behind it (solid or a vertical gradient, sRGB) and
 * sRGB encoding for the canvas.
 */
export const MAX_OUTLINES = 8;
export const OUTPUT_BYTES = 16 + MAX_OUTLINES * 16 + 32 + 64 + 16 + 16;
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
  // Where an outline can be (pixels: x0, y0, x1, y1): the outlined meshes' screen box and the outline's reach.
  outlineRect: vec4f,
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
  let fp = vec2f(f32(p.x), f32(p.y));
  if (output.outlines > 0u && all(fp >= output.outlineRect.xy) && all(fp <= output.outlineRect.zw)) {
    // Outside an outlined region, within the outline width of it: full colour, fading over the last pixel.
    // (Only near the outlined meshes: elsewhere no mask pixel is within reach, the search would find none.)
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

/** Each mip level of a texture from the one above it (a linear-filtered half-size copy). */
export const mipWGSL = /* wgsl */ `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
struct M { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@vertex fn vs(@builtin(vertex_index) i: u32) -> M {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: M;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}
@fragment fn fs(in: M) -> @location(0) vec4f { return textureSampleLevel(src, samp, in.uv, 0.0); }
`;
