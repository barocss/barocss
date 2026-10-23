// The viewer's WGSL: output (R2c: shaders.ts split by program, shaders.ts the facade).

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
