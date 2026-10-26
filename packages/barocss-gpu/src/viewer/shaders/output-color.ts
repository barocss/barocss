// Identical tone mapping, grading and encoding for raster frames and progressive stills.
export const outputStructWGSL = /* wgsl */ `
struct Output {
  exposure: f32, toneMapping: u32, outlineWidth: f32, outlines: u32,
  colors: array<vec4f, 8>,
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
`;
export const outputColorWGSL = /* wgsl */ `
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
`;
