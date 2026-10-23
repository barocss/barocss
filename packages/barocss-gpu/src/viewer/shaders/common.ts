// The viewer's WGSL: common (R2c: shaders.ts split by program, shaders.ts the facade).

export const MAX_DIRECTIONAL = 4, MAX_POINT = 8, MAX_SPOT = 4;
/** Byte sizes and offsets of the uniform blocks (kept with the WGSL below and packFrame in lights.ts). */
/** Clip planes at most (G19: a box section's six). */
export const MAX_CLIP_PLANES = 6;
export const FRAME_BYTES = 160 + MAX_DIRECTIONAL * 32 + MAX_POINT * 32 + MAX_SPOT * 64 + 80 + 16 + 96 + 16 + MAX_CLIP_PLANES * 16;
export const OBJECT_BYTES = 208, OBJECT_STRIDE = 256;

/** The WGSL every program starts with (internal: its frame and object blocks, its helpers). */
export const common = /* wgsl */ `
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
// Scene caps use the same sample locations as the scene. Picks, masks and light probes retain binding 5. Each sample holds
// the key of the triangle the probe found there when a back face (probeKey; 0: none or a front face) — G9: 2 bytes a sample.
@group(0) @binding(6) var capFrontSamples: texture_multisampled_2d<u32>;
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
/**
 * A triangle's key in the caps' samples (G9, in place of its depth's 32 bits): its mesh's slot (object.pick.z's high half),
 * its first vertex and its instance, hashed to 16 bits, never 0. The probe and the caps draw the same triangle at a sample,
 * so its key there is the same: the caps of the triangle the probe found, and no other face of that mesh behind it (a
 * ghost's cap is added once). Two triangles on one ray share a key 1 time in 65 535.
 */
fn probeKey(vi: u32, ii: u32) -> u32 {
  var h = ((object.pick.z >> 16u) * 0x9E3779B1u) ^ (vi * 0x85EBCA77u) ^ (ii * 0xC2B2AE3Du);
  h = (h ^ (h >> 15u)) * 0x2C1B3C6Du;
  h = (h ^ (h >> 12u)) * 0x297A2D39u;
  let k = (h ^ (h >> 15u)) & 0xFFFFu;
  return select(k, 1u, k == 0u);
}
/** A world point's depth (reversed): the probe's per sample, at the sample's own interpolated point. */
fn capSampleDepth(world: vec3f) -> f32 {
  let clip = frame.viewProj * vec4f(world, 1.0);
  return clip.z / clip.w;
}
fn capFirstSample(pos: vec4f, key: u32, sample: u32) -> bool {
  return textureLoad(capFrontSamples, vec2i(pos.xy), i32(sample)).x == key;
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
