// The viewer's WGSL: bloom (G15d.2) — the scene's light above a threshold glowing past its edges, as a lens and an eye
// see bright highlights. A half-resolution prefilter (a soft knee, a 13-tap filter against fireflies), then the dual
// filter: down a chain of halves (5 taps each) and back up (8 taps each, added into the level above). The output pass
// adds the chain's top level to the scene before the tone map.

/** The chain's levels at most (each half the one before, from half the canvas). */
// (Five: the prefilter, four steps down and four up — nine passes, within a frame's sixteen timed ones.)
export const BLOOM_LEVELS = 5;

export const bloomWGSL = /* wgsl */ `
struct Bloom { texel: vec2f, threshold: f32, knee: f32 }
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var<uniform> bloom: Bloom;
struct V { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: V;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}
fn at(uv: vec2f) -> vec3f { return textureSampleLevel(src, samp, uv, 0.0).rgb; }
/** The light a colour gives the bloom: what lies above the threshold, eased in over the knee (no hard edge). */
fn bright(c: vec3f) -> vec3f {
  let b = max(c.r, max(c.g, c.b));
  let soft = clamp(b - bloom.threshold + bloom.knee, 0.0, 2.0 * bloom.knee);
  let w = max(soft * soft / (4.0 * bloom.knee + 1e-5), b - bloom.threshold) / max(b, 1e-5);
  return c * max(w, 0.0);
}
// The prefilter (the scene, premultiplied linear, into the chain's first level): a 13-tap filter (Jimenez), its five
// groups each weighted down by its brightness so a lone bright pixel cannot flicker.
fn karis(c: vec3f) -> f32 { return 1.0 / (1.0 + max(c.r, max(c.g, c.b))); }
@fragment fn fsPrefilter(in: V) -> @location(0) vec4f {
  let t = bloom.texel;
  let a = at(in.uv + t * vec2f(-2.0, -2.0)); let b = at(in.uv + t * vec2f(0.0, -2.0)); let c = at(in.uv + t * vec2f(2.0, -2.0));
  let d = at(in.uv + t * vec2f(-1.0, -1.0)); let e = at(in.uv + t * vec2f(1.0, -1.0));
  let f = at(in.uv + t * vec2f(-2.0, 0.0)); let g = at(in.uv); let h = at(in.uv + t * vec2f(2.0, 0.0));
  let i = at(in.uv + t * vec2f(-1.0, 1.0)); let j = at(in.uv + t * vec2f(1.0, 1.0));
  let k = at(in.uv + t * vec2f(-2.0, 2.0)); let l = at(in.uv + t * vec2f(0.0, 2.0)); let m = at(in.uv + t * vec2f(2.0, 2.0));
  let g0 = (d + e + i + j) * 0.25; let g1 = (a + b + f + g) * 0.25; let g2 = (b + c + g + h) * 0.25; let g3 = (f + g + k + l) * 0.25; let g4 = (g + h + l + m) * 0.25;
  let w0 = karis(g0) * 0.5; let w1 = karis(g1) * 0.125; let w2 = karis(g2) * 0.125; let w3 = karis(g3) * 0.125; let w4 = karis(g4) * 0.125;
  let s = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  return vec4f(bright(s), 1.0);
}
// Down the chain: the centre and four diagonal taps half a texel out (the dual filter's down step).
@fragment fn fsDown(in: V) -> @location(0) vec4f {
  let t = bloom.texel * 0.5;
  let s = at(in.uv) * 4.0 + at(in.uv + vec2f(-t.x, -t.y)) + at(in.uv + vec2f(t.x, -t.y)) + at(in.uv + vec2f(-t.x, t.y)) + at(in.uv + vec2f(t.x, t.y));
  return vec4f(s / 8.0, 1.0);
}
// Back up: eight taps round the point (the dual filter's up step), added into the level above (blended one + one).
@fragment fn fsUp(in: V) -> @location(0) vec4f {
  let t = bloom.texel * 0.5;
  var s = at(in.uv + vec2f(-2.0 * t.x, 0.0)) + at(in.uv + vec2f(2.0 * t.x, 0.0)) + at(in.uv + vec2f(0.0, -2.0 * t.y)) + at(in.uv + vec2f(0.0, 2.0 * t.y));
  s += (at(in.uv + vec2f(-t.x, t.y)) + at(in.uv + vec2f(t.x, t.y)) + at(in.uv + vec2f(-t.x, -t.y)) + at(in.uv + vec2f(t.x, -t.y))) * 2.0;
  return vec4f(s / 12.0, 1.0);
}
`;
