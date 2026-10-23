// The viewer's WGSL: mip (R2c: shaders.ts split by program, shaders.ts the facade).

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
