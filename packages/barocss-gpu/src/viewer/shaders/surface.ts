// The viewer's WGSL: surface (R2c: shaders.ts split by program, shaders.ts the facade).
import { common } from './common.js';

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
  @location(4) scalar: f32,${capSamples ? `
  // The triangle's key in the caps' samples (probeKey).
  @location(5) @interpolate(flat) key: u32,` : ''}
}
@vertex fn vs(@location(0) position: vec3f, @location(1) normal: vec3f, @location(2) color: vec4f, inst: Instance, @location(8) uv: vec2f${capSamples ? ', @builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32' : ''}) -> VOut {
  var o: VOut;${capSamples ? `
  o.key = probeKey(vi, ii);` : ''}
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

fn litColor(in: VOut, front: bool) -> vec4f {
  let texel = textureSample(map, mapSampler, in.uv);
  let alpha = in.color.a * texel.a;
  // (G15a: the point in the mesh's own frame and its change per pixel, before any fragment is discarded.)
  let local = meshPoint(in.world);
  let footprint = length(fwidth(local));
  if (clippedAway(in.world)) { discard; }
  // Alpha cutout (pick.w: the cutoff × 1000; 0 off).
  if (object.pick.w > 0u && alpha < f32(object.pick.w) / 1000.0) { discard; }
  var n = normalize(in.normal);
  if (!front) { n = -n; }
  let base = in.color.rgb * texel.rgb * shaderColor(in.uv, in.world, n);
  var layer = plainLayer(n, object.params.y);
  if (object.finish.x > 0.5 || object.finish.w > 0.0 || object.finishOrigin.w > 0.0) { layer = finishLayer(local, n, object.params.y, footprint); }
  let c = shadeLayered(in.world, base, object.params.x, object.params.z, (object.pick.z & 1u) == 1u, layer);
  return vec4f(c * alpha, alpha);
}

// ---- G15a: surface finishes, a clear coat, an oil film ----------------------------------------------------------------
/** What a point's shading takes beyond its colour: its (finished) normal and roughness, the direction its marks run and how
 *  much they stretch the highlights (0 none), the clear coat (amount, roughness, over the unfinished normal) and the film. */
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
  return shadeLayered(world, base, metallicIn, emissive, receive, plainLayer(n, roughIn));
}
fn shadeLayered(world: vec3f, base: vec3f, metallicIn: f32, emissive: f32, receive: bool, layer: Layer) -> vec3f {
  let n = layer.n;
  // Perspective: toward the eye; orthographic: against the view direction.
  let v = select(-frame.forward.xyz, normalize(frame.eye.xyz - world), frame.eye.w > 0.5);
  let metallic = clamp(metallicIn, 0.0, 1.0);
  let rough = clamp(layer.rough, 0.04, 1.0);
  let a = rough * rough;
  let hemi = dot(n, frame.up.xyz) * 0.5 + 0.5;
  var ambient = mix(frame.ground.rgb * frame.ground.w, frame.sky.rgb * frame.sky.w, hemi);
  // An environment map (up.w its intensity) lights instead: its most blurred level round the normal.
  if (frame.up.w > 0.0) { ambient = envAt(n, frame.forward.w) * frame.up.w; }
  // Ambient: diffuse from the hemisphere around the normal, and its reflection around the mirrored view
  // direction (blurred toward the diffuse one with roughness), weighted by Fresnel. Metals get their
  // colour from the reflection only.
  let nov = max(dot(n, v), 0.0);
  let tint = select(vec3f(1.0), filmTint(nov, layer.film, world), layer.film > 0.0);
  let f0 = mix(vec3f(0.04), base, metallic) * tint;
  // (Anisotropic marks bend the reflection across them, as their highlight stretches — G15a.)
  var rn = n;
  if (layer.aniso > 0.0) {
    let b = cross(n, layer.along);
    let bent = cross(cross(b, v), b);
    if (dot(bent, bent) > 1e-8) { rn = normalize(mix(n, normalize(bent), layer.aniso * clamp(4.0 * rough, 0.0, 1.0) * 0.6)); }
  }
  let mirrored = reflect(-v, rn);
  let skyward = smoothstep(-0.3, 0.3, dot(mirrored, frame.up.xyz));
  var reflected = mix(mix(frame.ground.rgb * frame.ground.w, frame.sky.rgb * frame.sky.w, skyward), ambient, rough);
  if (frame.up.w > 0.0) { reflected = envAt(mirrored, rough * frame.forward.w) * frame.up.w; }
  let fresnel = f0 + (max(vec3f(1.0 - rough), f0) - f0) * pow(1.0 - nov, 5.0);
  var c = ambient * base * (1.0 - metallic) + reflected * fresnel + emissive * base;
  if (layer.coat > 0.0) {
    // (The coat's own reflection, sharp, on the surface's unfinished normal; it takes its share from what lies under it.)
    let cn = layer.coatN;
    let cm = reflect(-v, cn);
    var cr = mix(frame.ground.rgb * frame.ground.w, frame.sky.rgb * frame.sky.w, smoothstep(-0.3, 0.3, dot(cm, frame.up.xyz)));
    if (frame.up.w > 0.0) { cr = envAt(cm, layer.coatRough * frame.forward.w) * frame.up.w; }
    let fc = (0.04 + 0.96 * pow(1.0 - max(dot(cn, v), 0.0), 5.0)) * layer.coat;
    c = c * (1.0 - fc) + cr * fc;
  }
  for (var i = 0u; i < frame.counts.x; i++) {
    let d = frame.dirs[i];
    var lit = 1.0;
    if (frame.counts.w == i + 1u && receive) { lit = shadowAt(world, layer.coatN); }
    c += brdfLayered(v, normalize(-d.direction.xyz), base, metallic, a, layer, tint) * d.color.rgb * d.color.w * PI * lit;
  }
  for (var i = 0u; i < frame.counts.y; i++) {
    let p = frame.points[i];
    let to = p.position.xyz - world;
    let dist = length(to);
    var fall = 1.0 / max(dist * dist, 1e-4);
    if (p.position.w > 0.0) { let q = clamp(1.0 - pow(dist / p.position.w, 4.0), 0.0, 1.0); fall *= q * q; }
    c += brdfLayered(v, to / max(dist, 1e-6), base, metallic, a, layer, tint) * p.color.rgb * p.color.w * fall * PI;
  }
  for (var i = 0u; i < frame.counts.z; i++) {
    let s = frame.spots[i];
    let to = s.position.xyz - world;
    let dist = length(to);
    let l = to / max(dist, 1e-6);
    let cone = smoothstep(s.cone.y, s.cone.x, dot(-l, normalize(s.direction.xyz)));
    var fall = cone / max(dist * dist, 1e-4);
    if (s.position.w > 0.0) { let q = clamp(1.0 - pow(dist / s.position.w, 4.0), 0.0, 1.0); fall *= q * q; }
    c += brdfLayered(v, l, base, metallic, a, layer, tint) * s.color.rgb * s.color.w * fall * PI;
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
  if (!${capSamples ? 'capFirstSample(in.clip, in.key, sample)' : 'capFirst(in.clip)'}) { discard; }
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
