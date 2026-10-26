// The viewer's WGSL: surface (R2c: shaders.ts split by program, shaders.ts the facade).
import { common } from './common.js';
import { materialLayerWGSL } from './material-layer.js';

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
@group(2) @binding(3) var pbrNormalMap: texture_2d<f32>;
@group(2) @binding(4) var pbrNormalSampler: sampler;
@group(2) @binding(5) var pbrRoughnessMap: texture_2d<f32>;
@group(2) @binding(6) var pbrRoughnessSampler: sampler;
@group(2) @binding(7) var pbrMetallicMap: texture_2d<f32>;
@group(2) @binding(8) var pbrMetallicSampler: sampler;
struct PbrMapParams { normalScale: vec2f, flags: u32, _pad: u32 }
@group(2) @binding(9) var<uniform> pbrMaps: PbrMapParams;
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
// G15b: a Poisson disc of 16 taps (unit radius) for the soft shadows' blocker search and filter.
const DISC = array<vec2f, 16>(vec2f(-0.942, -0.399), vec2f(0.946, -0.769), vec2f(-0.094, -0.929), vec2f(0.345, 0.294),
  vec2f(-0.916, 0.458), vec2f(-0.815, -0.879), vec2f(-0.383, 0.277), vec2f(0.975, 0.756), vec2f(0.443, -0.975),
  vec2f(0.537, -0.474), vec2f(-0.265, -0.419), vec2f(0.792, 0.191), vec2f(-0.242, 0.997), vec2f(-0.814, 0.914),
  vec2f(0.200, 0.786), vec2f(0.144, -0.141));
/**
 * G15b's soft shadow (PCSS): the blockers' mean depth found round the point, the penumbra's width from how far behind them
 * it lies (shadow.params.w: uv per unit of depth, the light's angular size), then that wide a filter of 16 taps, the disc
 * turned per point so its pattern becomes noise.
 */
fn softShadowAt(uv: vec2f, z: f32, world: vec3f, light: u32) -> f32 {
  let params = frame.shadowLights[light].params;
  let texel = params.y;
  let size = vec2f(textureDimensions(shadowMap));
  let a = fract(sin(dot(world, vec3f(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2831853;
  let rot = mat2x2f(cos(a), sin(a), -sin(a), cos(a));
  let search = clamp(z * params.w, 2.0 * texel, 24.0 * texel);
  var blockers = 0.0;
  var count = 0.0;
  for (var i = 0; i < 16; i++) {
    let q = clamp(uv + rot * DISC[i] * search, vec2f(0.0), vec2f(1.0));
    let d = textureLoad(shadowMap, min(vec2i(q * size), vec2i(size) - 1), i32(light), 0);
    if (d < z) { blockers += d; count += 1.0; }
  }
  if (count == 0.0) { return 1.0; }
  let radius = clamp((z - blockers / count) * params.w, texel, 32.0 * texel);
  var lit = 0.0;
  for (var i = 0; i < 16; i++) { lit += textureSampleCompareLevel(shadowMap, shadowSampler, uv + rot * DISC[i] * radius, i32(light), z); }
  return lit / 16.0;
}
/** Lit share (0–1) of a point by the shadow map: 3×3 percentage-closer filtering, or soft (PCSS) when the light has a size. */
fn shadowAt(world: vec3f, n: vec3f, light: u32) -> f32 {
  let shadow = frame.shadowLights[light];
  let p = shadow.viewProj * vec4f(world + n * shadow.params.x, 1.0);
  let uv = vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0)) || p.z > 1.0) { return 1.0; }
  if (shadow.params.w > 0.0) { return softShadowAt(uv, p.z - shadow.params.z, world, light); }
  var lit = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      lit += textureSampleCompareLevel(shadowMap, shadowSampler, uv + vec2f(f32(x), f32(y)) * shadow.params.y, i32(light), p.z - shadow.params.z);
    }
  }
  return lit / 9.0;
}
fn schlick(f0: vec3f, voh: f32) -> vec3f { return f0 + (vec3f(1.0) - f0) * pow(1.0 - voh, 5.0); }

// Tangent-space normals from the geometry's UVs, including mirrored UVs and a non-uniform model transform.
// Called before any discard. The first branch reads only a uniform; all derivatives and sampling precede per-pixel branches.
fn mappedNormal(in: VOut, n: vec3f) -> vec3f {
  if ((pbrMaps.flags & 1u) == 0u || all(pbrMaps.normalScale == vec2f(0.0))) { return n; }
  let qx = dpdx(in.world); let qy = dpdy(in.world);
  let ux = dpdx(in.uv); let uy = dpdy(in.uv);
  var encoded = textureSample(pbrNormalMap, pbrNormalSampler, in.uv).xyz * 2.0 - 1.0;
  encoded = vec3f(encoded.xy * pbrMaps.normalScale, encoded.z);
  let encodedMagnitude = max(max(abs(encoded.x), abs(encoded.y)), abs(encoded.z));
  if (!(encodedMagnitude > 0.0)) { return n; }
  // A common binary exponent avoids a huge divisor whose reciprocal can flush to zero on the GPU.
  let exponent = frexp(encodedMagnitude).exp;
  encoded = ldexp(encoded, vec3i(-exponent));
  let det = ux.x * uy.y - ux.y * uy.x;
  if (!(abs(det) > 1e-20 && abs(det) < 1e20)) { return n; }
  let rawT = (qx * uy.y - qy * ux.y) / det;
  let rawB = (qy * ux.x - qx * uy.x) / det;
  let tangent = rawT - n * dot(n, rawT);
  let tangentLength = dot(tangent, tangent);
  if (!(tangentLength > 1e-12 && tangentLength < 1e30)) { return n; }
  let t = tangent * inverseSqrt(tangentLength);
  let across = cross(n, t);
  let handed = dot(across, rawB);
  if (!(abs(handed) > 1e-20 && abs(handed) < 1e30)) { return n; }
  let b = across * select(-1.0, 1.0, handed > 0.0);
  let result = t * encoded.x + b * encoded.y + n * encoded.z;
  let resultLength = dot(result, result);
  if (!(resultLength > 1e-12 && resultLength < 1e30)) { return n; }
  return result * inverseSqrt(resultLength);
}

fn litColor(in: VOut, front: bool) -> vec4f {
  let texel = textureSample(map, mapSampler, in.uv);
  let alpha = in.color.a * texel.a;
  var n = normalize(in.normal);
  if (!front) { n = -n; }
  n = mappedNormal(in, n);
  var roughness = object.params.y;
  var metallic = object.params.x;
  if ((pbrMaps.flags & 2u) != 0u) { roughness *= textureSample(pbrRoughnessMap, pbrRoughnessSampler, in.uv).g; }
  if ((pbrMaps.flags & 4u) != 0u) { metallic *= textureSample(pbrMetallicMap, pbrMetallicSampler, in.uv).b; }
  // (G15a: the point in the mesh's own frame and its change per pixel, before any fragment is discarded.)
  let local = meshPoint(in.world);
  let footprint = length(fwidth(local));
  if (clippedAway(in.world)) { discard; }
  // Alpha cutout (pick.w: the cutoff × 1000; 0 off).
  if (object.pick.w > 0u && alpha < f32(object.pick.w) / 1000.0) { discard; }
  let base = in.color.rgb * texel.rgb * shaderColor(in.uv, in.world, n);
  var layer = plainLayer(n, roughness);
  if (object.finish.x > 0.5 || object.finish.w > 0.0 || object.finishOrigin.w > 0.0) { layer = finishLayer(local, n, roughness, footprint); }
  let c = shadeLayered(in.world, base, metallic, object.params.z, (object.pick.z & 1u) == 1u, layer);
  return vec4f(c * alpha, alpha);
}

// ---- G15a: surface finishes, a clear coat, an oil film ----------------------------------------------------------------
/** What a point's shading takes beyond its colour: its (finished) normal and roughness, the direction its marks run and how
 *  much they stretch the highlights (0 none), the clear coat (amount, roughness, over the unfinished normal) and the film. */
` + materialLayerWGSL + /* wgsl */ `
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
  if (frame.up.w > 0.0) { ambient = envDiffuse(n) * frame.up.w; }
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
  var fresnel = f0 + (max(vec3f(1.0 - rough), f0) - f0) * pow(1.0 - nov, 5.0);
  if (frame.up.w > 0.0) {
    // (G15b, under an environment: its reflection prefiltered for this roughness, weighted by the split sum's table.)
    reflected = envReflect(mirrored, rough) * frame.up.w;
    let ab = brdfScaleBias(nov, rough);
    fresnel = f0 * ab.x + ab.y;
  }
  var c = ambient * base * (1.0 - metallic) + reflected * fresnel + emissive * base;
  if (layer.coat > 0.0) {
    // (The coat's own reflection, sharp, on the surface's unfinished normal; it takes its share from what lies under it.)
    let cn = layer.coatN;
    let cm = reflect(-v, cn);
    var cr = mix(frame.ground.rgb * frame.ground.w, frame.sky.rgb * frame.sky.w, smoothstep(-0.3, 0.3, dot(cm, frame.up.xyz)));
    if (frame.up.w > 0.0) { cr = envReflect(cm, layer.coatRough) * frame.up.w; }
    let fc = (0.04 + 0.96 * pow(1.0 - max(dot(cn, v), 0.0), 5.0)) * layer.coat;
    c = c * (1.0 - fc) + cr * fc;
  }
  for (var i = 0u; i < frame.counts.x; i++) {
    let d = frame.dirs[i];
    var lit = 1.0;
    if ((frame.shadowActive.x & (1u << i)) != 0u && receive) { lit = shadowAt(world, layer.coatN, i); }
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
  for (var i = 0u; i < frame.counts.x; i++) {
    if ((frame.shadowActive.x & (1u << i)) != 0u) { lit = min(lit, shadowAt(in.world, normalize(in.normal), i)); }
  }
  let a = (1.0 - lit) * in.color.a;
  return vec4f(in.color.rgb * a, a);
}
`;
