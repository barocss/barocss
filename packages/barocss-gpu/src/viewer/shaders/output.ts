// The viewer's WGSL: output (R2c: shaders.ts split by program, shaders.ts the facade).

/**
 * The output pass: ambient occlusion from the depth buffer, exposure and tone mapping (ACES or AgX) of the
 * (premultiplied, linear) scene, the background behind it (solid or a vertical gradient, sRGB), grading and a vignette
 * over both (G15d.1), selection outlines and sRGB encoding for the canvas.
 */
export const MAX_OUTLINES = 8;
export const OUTPUT_BYTES = 16 + MAX_OUTLINES * 16 + 32 + 64 + 16 + 16 + 96 + 80 + 16 + 16;
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
  // G15d.2's bloom: its strength (0: off).
  bloom: vec4f,
  // G15b's contact shadows: the camera's projection, the direction toward the shadow-casting light in view space and the
  // ray's length (world), the strength (0: off) and the thickness a blocker is taken to have.
  proj: mat4x4f,
  contact: vec4f,
  contactK: vec4f,
  // G15d.1's grading (white balance and contrast, lift and saturation, gamma and on, gain) and vignette (amount, the
  // clear radius and where the fade ends, as shares of the half-diagonal). Off: zeros.
  balance: vec4f, lift: vec4f, gamma: vec4f, gain: vec4f,
  vignette: vec4f,
  // Where an outline can be (pixels: x0, y0, x1, y1): the outlined meshes' screen box and the outline's reach.
  outlineRect: vec4f,
  // G15d.3: view-axis focus distance and maximum blur radius in backing pixels; zero radius disables it.
  focus: vec4f,
}
@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var<uniform> output: Output;
@group(0) @binding(2) var mask: texture_2d<u32>;
@group(0) @binding(3) var depth: ${multisampled ? 'texture_depth_multisampled_2d' : 'texture_depth_2d'};
// G15d.2: the bloom chain's top level (half the canvas; a black texel without bloom) and its sampler.
@group(0) @binding(4) var bloomTex: texture_2d<f32>;
@group(0) @binding(5) var bloomSampler: sampler;
@group(0) @binding(6) var focusTex: texture_2d<f32>;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
fn aces(x: vec3f) -> vec3f { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }
// AgX (Sobotka's, in the common fitted form): into the AgX space, log2 between −12.47 and +4.03 stops around mid
// grey, a polynomial fit of the sigmoid, back out; the result is display-encoded, hence the 2.2 back to linear.
fn agxCurve(x: vec3f) -> vec3f {
  let x2 = x * x;
  let x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
fn agx(c: vec3f) -> vec3f {
  let inset = mat3x3f(0.842479062253094, 0.0423282422610123, 0.0423756549057051, 0.0784335999999992, 0.878468636469772, 0.0784336, 0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  let outset = mat3x3f(1.19687900512017, -0.0528968517574562, -0.0529716355144438, -0.0980208811401368, 1.15190312990417, -0.0980434501171241, -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  let lo = -12.47393;
  let hi = 4.026069;
  let v = agxCurve((clamp(log2(max(inset * c, vec3f(1e-10))), vec3f(lo), vec3f(hi)) - lo) / (hi - lo));
  return clamp(pow(max(outset * v, vec3f(0.0)), vec3f(2.2)), vec3f(0.0), vec3f(1.0));
}
fn decode(c: vec3f) -> vec3f { return select(pow((c + 0.055) / 1.055, vec3f(2.4)), c / 12.92, c <= vec3f(0.04045)); }
/** G15d.1: the grading and the vignette on a pixel's colour (sRGB in, sRGB out); uv 0–1 across the canvas. */
fn grade(c: vec3f, uv: vec2f, size: vec2f) -> vec3f {
  var lin = decode(c);
  if (output.gamma.w > 0.0) {
    lin = lin * output.balance.rgb;
    lin = output.gain.rgb * lin + output.lift.rgb * (1.0 - lin);
    lin = pow(max(lin, vec3f(0.0)), 1.0 / output.gamma.rgb);
    let y = dot(lin, vec3f(0.2126, 0.7152, 0.0722));
    lin = max(mix(vec3f(y), lin, output.lift.w), vec3f(0.0));
  }
  if (output.vignette.x > 0.0) {
    // (Distance from the centre as a share of the half-diagonal, the frame's aspect kept: round, not oval.)
    let q = (uv - 0.5) * size;
    let d = length(q) / (0.5 * length(size));
    lin *= 1.0 - output.vignette.x * smoothstep(output.vignette.y, output.vignette.z, d);
  }
  var e = encode(lin);
  // (Contrast in the encoded image, around mid grey's 0.46: an even push either side, highlights kept below white.)
  if (output.gamma.w > 0.0) { e = clamp(0.46 + (e - 0.46) * output.balance.w, vec3f(0.0), vec3f(1.0)); }
  return e;
}
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
/** G15b: the share of direct light a pixel keeps along a short ray toward the light through the depth buffer — 0.0 to 1.0. */
fn contactShadow(p: vec2i, d: f32) -> f32 {
  let P = viewAt(p, d);
  let size = vec2f(textureDimensions(depth));
  let jitter = fract(52.9829189 * fract(0.06711056 * f32(p.x) + 0.00583715 * f32(p.y)));
  let N = 14;
  for (var i = 0; i < N; i++) {
    let Q = P + output.contact.xyz * output.contact.w * (f32(i) + jitter + 0.5) / f32(N);
    let c = output.proj * vec4f(Q, 1.0);
    let ndc = c.xy / c.w;
    if (any(abs(ndc) > vec2f(1.0))) { break; }
    let q = vec2i(vec2f((ndc.x * 0.5 + 0.5) * size.x, (0.5 - ndc.y * 0.5) * size.y));
    if (all(q == p)) { continue; }
    let dq = depthAt(q);
    if (dq <= 0.0) { continue; }
    // (A surface in front of the ray's point there, by less than a blocker's thickness: the light is blocked.)
    let s = viewAt(q, dq).z - Q.z;
    if (s > 1e-4 * output.contact.w && s < output.contactK.y) {
      // (Weaker toward the ray's end, so its reach shows as a soft fall-off.)
      return 1.0 - output.contactK.x * (1.0 - f32(i) / f32(N));
    }
  }
  return 1.0;
}
@fragment fn fs(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let p = vec2i(at.xy);
  var s = textureLoad(scene, p, 0);
  if (output.focus.y > 0.0) {
    let d = depthAt(p);
    var radius = output.focus.y;
    if (d > 0.0) { radius *= clamp(abs(1.0 - output.focus.x / max(-viewAt(p, d).z, 1e-6)), 0.0, 1.0); }
    let blurred = textureSampleLevel(focusTex, bloomSampler, at.xy / vec2f(textureDimensions(scene)), 0.0);
    s = mix(s, blurred, smoothstep(0.0, 1.0, radius));
  }
  let size = vec2f(textureDimensions(scene));
  // The background (sRGB, straight alpha) under the scene.
  let bg = mix(output.top, output.bottom, at.y / size.y);
  var c = bg.rgb;
  var a = bg.a;
  // (The bloom's light here, exposed: in the scene's light before its tone map; over the background, tone-mapped onto it.)
  var glow = vec3f(0.0);
  if (output.bloom.x > 0.0) { glow = textureSampleLevel(bloomTex, bloomSampler, at.xy / size, 0.0).rgb * output.bloom.x * output.exposure; }
  if (s.a < 1.0 && output.bloom.x > 0.0) {
    var g = glow * (1.0 - s.a);
    if (output.toneMapping == 1u) { g = aces(g); } else if (output.toneMapping == 2u) { g = agx(g) - agx(vec3f(0.0)); }
    c = encode(decode(c) + max(g, vec3f(0.0)));
    a = max(a, clamp(max(g.r, max(g.g, g.b)), 0.0, 1.0));
  }
  if (s.a > 0.0) {
    var lin = s.rgb / s.a * output.exposure + glow;
    let d = depthAt(p);
    if (output.ao.y > 0.0 && d > 0.0) { lin *= occlusion(p, d); }
    if (output.contactK.x > 0.0 && d > 0.0) { lin *= contactShadow(p, d); }
    if (output.toneMapping == 1u) { lin = aces(lin); } else if (output.toneMapping == 2u) { lin = agx(lin); }
    // Scene over background, in sRGB (the background colours are given in sRGB).
    let e = encode(lin);
    c = mix(c * a, e, s.a);
    a = s.a + a * (1.0 - s.a);
    c = select(vec3f(0.0), c / a, a > 0.0);
  }
  if ((output.gamma.w > 0.0 || output.vignette.x > 0.0) && a > 0.0) { c = grade(c, at.xy / size, size); }
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
