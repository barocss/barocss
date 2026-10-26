// G15a material evaluation shared by the raster surface and the G15c path tracer.
// The caller provides PI, ggx, smith, schlick and its per-hit object (model and finish vectors).
export const materialLayerWGSL = /* wgsl */ `
struct Layer { n: vec3f, rough: f32, along: vec3f, aniso: f32, coatN: vec3f, coat: f32, coatRough: f32, film: f32 }
fn plainLayer(n: vec3f, rough: f32) -> Layer { return Layer(n, rough, vec3f(0.0), 0.0, n, 0.0, 0.0, 0.0); }
/** The mesh's linear part (rotation and a uniform scale) and the world point in its frame. */
fn meshAxes() -> mat3x3f { return mat3x3f(object.model[0].xyz, object.model[1].xyz, object.model[2].xyz); }
fn meshPoint(world: vec3f) -> vec3f {
  let r = meshAxes();
  return transpose(r) * (world - object.model[3].xyz) / max(dot(r[0], r[0]), 1e-30);
}
fn hash3(p: vec3i) -> f32 {
  let h = bitcast<vec3u>(p) * vec3u(1597334673u, 3812015801u, 2798796415u);
  let k = (h.x ^ h.y ^ h.z) * 1597334673u;
  return f32(k >> 8u) / 16777216.0;
}
/** Value noise, 0–1, smooth between the lattice's points. */
fn vnoise(q: vec3f) -> f32 {
  let i = vec3i(floor(q));
  let f = fract(q);
  let u = f * f * (3.0 - 2.0 * f);
  let x0 = mix(mix(hash3(i), hash3(i + vec3i(1, 0, 0)), u.x), mix(hash3(i + vec3i(0, 1, 0)), hash3(i + vec3i(1, 1, 0)), u.x), u.y);
  let x1 = mix(mix(hash3(i + vec3i(0, 0, 1)), hash3(i + vec3i(1, 0, 1)), u.x), mix(hash3(i + vec3i(0, 1, 1)), hash3(i + vec3i(1, 1, 1)), u.x), u.y);
  return mix(x0, x1, u.z);
}
/** How much of a detail f times finer than the marks a pixel can still show, fp the pixel's footprint in marks:
 *  details nearing two to a pixel fade out (so fine marks become roughness, never sparkle). */
fn band(f: f32, fp: f32) -> f32 { return 1.0 - smoothstep(0.3, 0.8, fp * f); }
fn fbm(q: vec3f, octaves: i32, fp: f32) -> f32 {
  var s = 0.0;
  var a = 0.5;
  var f = 1.0;
  var p = q;
  for (var i = 0; i < octaves; i++) { s += a * vnoise(p) * band(f, fp); p = p * 2.03 + vec3f(17.1, 3.7, 9.2); a *= 0.5; f *= 2.03; }
  return s;
}
/** A unit direction square to a (the knurl's and the brush's frame across the axis). */
fn crossAxis(a: vec3f) -> vec3f { return normalize(select(cross(a, vec3f(1.0, 0.0, 0.0)), cross(a, vec3f(0.0, 1.0, 0.0)), abs(a.x) > 0.7)); }
/** The finish's relief at a point of the mesh's frame (nl its normal there), in units of its scale (0–1 about); fp the
 *  pixel's footprint in the same units. */
fn relief(kind: u32, p: vec3f, nl: vec3f, a: vec3f, o: vec3f, s: f32, fp: f32) -> f32 {
  let q = p / s;
  let rel = p - o;
  let along = dot(rel, a) / s;
  let radial = rel - dot(rel, a) * a;
  let b1 = band(1.0, fp);
  switch kind {
    case 1u: { return fbm(q, 3, fp); }
    case 2u: { return fbm(q, 4, fp) + 0.35 * smoothstep(0.62, 0.8, vnoise(q * 0.7 + vec3f(5.0))) * band(0.7, fp); }
    case 3u: { return 0.5 + 0.35 * cos(6.2831853 * along) * b1 + 0.15 * vnoise(q * 3.0) * band(3.0, fp); }
    case 4u: { return 0.5 + 0.4 * cos(6.2831853 * (length(radial) / s + along)) * b1 + 0.1 * vnoise(q * 4.0) * band(4.0, fp); }
    case 5u: {
      let b = crossAxis(a);
      return (vnoise(vec3f(along * 0.03, dot(rel, b) / s, dot(rel, cross(a, b)) / s)) * 0.7 * b1 + 0.3 * vnoise(q * vec3f(0.2, 2.0, 2.0)) * band(2.0, fp));
    }
    case 6u: {
      // (Two helical grooves at ±45° round the axis: the arc length round it against the length along it.)
      let b = crossAxis(a);
      let arc = atan2(dot(radial, cross(a, b)), dot(radial, b)) * length(radial) / s;
      let g1 = abs(fract(along + arc) - 0.5);
      let g2 = abs(fract(along - arc) - 0.5);
      // (A knurl is rolled into the round surface: none on faces square to its axis, where its lines would meet.)
      let side = 1.0 - smoothstep(0.5, 0.9, abs(dot(nl, a)));
      return mix(0.5, min(g1, g2) * 2.0, band(2.0, fp) * side);
    }
    case 7u: { return vnoise(q) * 0.7 * b1 + 0.3 * vnoise(q * 2.7) * band(2.7, fp); }
    default: { return 0.0; }
  }
}
/** Each kind's depth (the relief's slope into the normal at strength 1), roughness added, and anisotropy. */
fn finishLook(kind: u32) -> vec3f {
  switch kind {
    case 1u: { return vec3f(0.35, 0.10, 0.0); }
    case 2u: { return vec3f(0.9, 0.22, 0.0); }
    case 3u: { return vec3f(0.3, 0.02, 0.45); }
    case 4u: { return vec3f(0.18, 0.02, 0.6); }
    case 5u: { return vec3f(0.08, 0.04, 0.75); }
    case 6u: { return vec3f(1.2, 0.05, 0.0); }
    case 7u: { return vec3f(0.3, 0.25, 0.0); }
    default: { return vec3f(0.0); }
  }
}
fn finishLayer(local: vec3f, n: vec3f, rough0: f32, footprint: f32) -> Layer {
  var layer = plainLayer(n, rough0);
  layer.coat = object.finish.w;
  layer.coatRough = object.finishAxis.w;
  layer.film = object.finishOrigin.w;
  let kind = u32(object.finish.x + 0.5);
  if (kind == 0u) { return layer; }
  let s = max(object.finish.y, 1e-6);
  let a = normalize(object.finishAxis.xyz);
  let o = object.finishOrigin.xyz;
  let look = finishLook(kind);
  let k = object.finish.z;
  // (Marks finer than a pixel can't be drawn: their relief fades into roughness as the footprint nears a mark's size.)
  let fp = footprint / s;
  let fade = band(1.0, fp);
  let r = meshAxes();
  let nl = normalize(transpose(r) * n);
  if (fade > 0.0) {
    let e = 0.12 * s;
    let h0 = relief(kind, local, nl, a, o, s, fp);
    let g = vec3f(relief(kind, local + vec3f(e, 0.0, 0.0), nl, a, o, s, fp) - h0, relief(kind, local + vec3f(0.0, e, 0.0), nl, a, o, s, fp) - h0, relief(kind, local + vec3f(0.0, 0.0, e), nl, a, o, s, fp) - h0) / 0.12;
    let gt = g - dot(g, nl) * nl;
    layer.n = normalize(r * normalize(nl - look.x * k * fade * gt));
    if (dot(layer.n, n) < 0.05) { layer.n = n; }
  }
  layer.rough = clamp(rough0 + look.y * k + (1.0 - fade) * look.x * k * 0.25, 0.04, 1.0);
  if (look.z > 0.0) {
    // (The marks' direction on the surface: machined lines run across the axis, a turned groove round it, a brush along it.)
    var dirl = a;
    if (kind == 3u) { dirl = cross(nl, a); }
    if (kind == 4u) { let rel = local - o; dirl = cross(a, rel - dot(rel, a) * a); }
    let d = r * (dirl - dot(dirl, nl) * nl);
    if (dot(d, d) > 1e-12) { layer.along = normalize(d); layer.aniso = look.z; }
  }
  return layer;
}
/** Anisotropic GGX (Burley): rougher across the marks than along them. */
fn ggxAniso(n: vec3f, h: vec3f, t: vec3f, a: f32, k: f32) -> f32 {
  let b = cross(n, t);
  let at = max(a * (1.0 - k), 0.002);
  let ab = max(a * (1.0 + k), 0.002);
  let x = dot(t, h) / at;
  let y = dot(b, h) / ab;
  let z = dot(n, h);
  let d = x * x + y * y + z * z;
  return 1.0 / (PI * at * ab * d * d);
}
/** The oil film's tint (thin-film interference, cheap): colours cycling with the view angle and the film's thickness. */
fn filmTint(nov: f32, film: f32, world: vec3f) -> vec3f {
  let thick = 1.2 + 0.8 * vnoise(meshPoint(world) * 0.05);
  let t = 0.5 + 0.5 * cos(6.2831853 * (thick * (1.0 - 0.6 * nov) + vec3f(0.0, 0.33, 0.67)));
  // (A film tints what it reflects, most at grazing angles: a sheen of colours, not a paint.)
  return mix(vec3f(1.0), 0.75 + 0.5 * t, film * (0.35 + 0.65 * pow(1.0 - nov, 2.0)));
}
fn brdfLayered(v: vec3f, l: vec3f, base: vec3f, metallic: f32, a: f32, layer: Layer, tint: vec3f) -> vec3f {
  let n = layer.n;
  let h = normalize(v + l);
  let nol = max(dot(n, l), 0.0);
  let nov = max(dot(n, v), 1e-4);
  let f0 = mix(vec3f(0.04), base, metallic) * tint;
  let f = schlick(f0, max(dot(v, h), 0.0));
  var dist = ggx(max(dot(n, h), 0.0), a);
  if (layer.aniso > 0.0) { dist = ggxAniso(n, h, layer.along, a, layer.aniso); }
  let spec = dist * smith(nov, nol, a) * f;
  let diffuse = (vec3f(1.0) - f) * (1.0 - metallic) * base / PI;
  var c = (diffuse + spec) * nol;
  if (layer.coat > 0.0) {
    // (The coat: a smooth dielectric over everything, on the surface's own normal; what it reflects the base doesn't get.)
    let cn = layer.coatN;
    let cnol = max(dot(cn, l), 0.0);
    let ca = layer.coatRough * layer.coatRough;
    let fc = schlick(vec3f(0.04), max(dot(v, h), 0.0)).x * layer.coat;
    c = c * (1.0 - fc) + vec3f(ggx(max(dot(cn, h), 0.0), ca) * smith(max(dot(cn, v), 1e-4), cnol, ca) * fc * cnol);
  }
  return c;
}
`;
