// The viewer's WGSL: oit (R2c: shaders.ts split by program, shaders.ts the facade).

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
