// The viewer's WGSL: the environment's lighting, made once per environment map (G15b) — its reflections prefiltered by
// GGX for each roughness (a mip level each), its diffuse light (a cosine-weighted convolution), and the split-sum BRDF
// table every lit surface reads. Full-screen triangles into each target; equirectangular, Z up, as envUv in common.

/** The prefiltered reflections' mip levels at most: roughness 0, 1/6 … 1. */
export const ENV_LEVELS = 7;
/** The diffuse light's size (equirectangular) and the BRDF table's. */
export const IRRADIANCE_SIZE = [64, 32] as const, BRDF_LUT_SIZE = 64;

export const envWGSL = /* wgsl */ `
struct Prefilter { roughness: f32, sourceWidth: f32, sourceLevels: f32, samples: f32 }
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var<uniform> pre: Prefilter;
struct V { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: V;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}
const PI = 3.14159265359;
/** The direction an equirectangular uv looks along (as envUv reads it). */
fn dirOf(uv: vec2f) -> vec3f {
  let phi = (uv.x - 0.5) * 2.0 * PI;
  let theta = uv.y * PI;
  return vec3f(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
}
fn sampleEnv(d: vec3f, lod: f32) -> vec3f {
  let u = atan2(d.y, d.x) / (2.0 * PI) + 0.5;
  let v = acos(clamp(d.z, -1.0, 1.0)) / PI;
  return textureSampleLevel(src, samp, vec2f(u, v), lod).rgb;
}
fn hammersley(i: u32, n: u32) -> vec2f { return vec2f(f32(i) / f32(n), f32(reverseBits(i)) * 2.3283064365386963e-10); }
/** A frame round n: two directions square to it and to each other. */
fn basis(n: vec3f) -> mat3x3f {
  let up = select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0), abs(n.z) < 0.999);
  let t = normalize(cross(up, n));
  return mat3x3f(t, cross(n, t), n);
}
/** A half vector drawn from GGX of roughness² a round n. */
fn ggxHalf(xi: vec2f, a: f32) -> vec3f {
  let phi = 2.0 * PI * xi.x;
  let c = sqrt((1.0 - xi.y) / (1.0 + (a * a - 1.0) * xi.y));
  let s = sqrt(1.0 - c * c);
  return vec3f(s * cos(phi), s * sin(phi), c);
}
// Reflections at a roughness: GGX importance samples round the direction (normal = view = reflection, as the split sum
// takes it), each read from the source's level whose texels match its share of the sphere (filtered importance sampling).
@fragment fn fsSpecular(in: V) -> @location(0) vec4f {
  let n = dirOf(in.uv);
  if (pre.roughness <= 0.0) { return vec4f(sampleEnv(n, 0.0), 1.0); }
  let a = pre.roughness * pre.roughness;
  let frame = basis(n);
  let count = u32(pre.samples);
  // (A source texel's solid angle at the equator: the sphere over its texels.)
  let texel = 4.0 * PI / (pre.sourceWidth * pre.sourceWidth * 0.5);
  var sum = vec3f(0.0);
  var weight = 0.0;
  for (var i = 0u; i < count; i++) {
    let h = frame * ggxHalf(hammersley(i, count), a);
    let l = 2.0 * dot(n, h) * h - n;
    let nol = dot(n, l);
    if (nol <= 0.0) { continue; }
    let noh = max(dot(n, h), 1e-4);
    let a2 = a * a;
    let f = noh * noh * (a2 - 1.0) + 1.0;
    let pdf = a2 / (PI * f * f) / 4.0;
    let lod = clamp(0.5 * log2(1.0 / (f32(count) * pdf * texel)) + 1.0, 0.0, pre.sourceLevels - 1.0);
    sum += sampleEnv(l, lod) * nol;
    weight += nol;
  }
  return vec4f(sum / max(weight, 1e-6), 1.0);
}
// Diffuse light: the cosine-weighted mean of the radiance round a normal (irradiance / π), from a blurred level.
@fragment fn fsIrradiance(in: V) -> @location(0) vec4f {
  let n = dirOf(in.uv);
  let frame = basis(n);
  let count = u32(pre.samples);
  let lod = max(pre.sourceLevels - 6.0, 0.0);
  var sum = vec3f(0.0);
  for (var i = 0u; i < count; i++) {
    let xi = hammersley(i, count);
    let r = sqrt(xi.y);
    let phi = 2.0 * PI * xi.x;
    let l = frame * vec3f(r * cos(phi), r * sin(phi), sqrt(max(0.0, 1.0 - xi.y)));
    sum += sampleEnv(l, lod);
  }
  return vec4f(sum / f32(count), 1.0);
}
// The split sum's BRDF table (Karis): over n·v (x) and roughness (y), the scale and bias to f0 of the specular
// reflection's integral, Smith's G with k = a/2 as for image lighting.
fn gSchlick(nov: f32, k: f32) -> f32 { return nov / (nov * (1.0 - k) + k); }
@fragment fn fsLut(in: V) -> @location(0) vec4f {
  let nov = max(in.uv.x, 1e-3);
  let rough = max(in.uv.y, 0.02);
  let a = rough * rough;
  let v = vec3f(sqrt(1.0 - nov * nov), 0.0, nov);
  let count = 256u;
  var s = vec2f(0.0);
  for (var i = 0u; i < count; i++) {
    let h = ggxHalf(hammersley(i, count), a);
    let l = 2.0 * dot(v, h) * h - v;
    let nol = max(l.z, 0.0);
    let noh = max(h.z, 0.0);
    let voh = max(dot(v, h), 0.0);
    if (nol <= 0.0) { continue; }
    let k = a / 2.0;
    let gv = gSchlick(nov, k) * gSchlick(nol, k) * voh / max(noh * nov, 1e-5);
    let fc = pow(1.0 - voh, 5.0);
    s += vec2f((1.0 - fc) * gv, fc * gv);
  }
  return vec4f(s / f32(count), 0.0, 1.0);
}
`;
