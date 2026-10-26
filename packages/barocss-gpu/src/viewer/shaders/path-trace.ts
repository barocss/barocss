import { BVH_WGSL } from '../../compute/bvhWgsl.js';
import { materialLayerWGSL } from './material-layer.js';
import { outputStructWGSL, outputColorWGSL } from './output-color.js';

// The BVH uses the existing bounded traversal and packed source ids. Hit attributes are retained for shading.
const hitWGSL = /* wgsl */ `
struct Hit { t: f32, index: u32, uv: vec2f }
fn closest(o: vec3f, d: vec3f, minT: f32) -> Hit {
  var stack: array<i32, 64>; stack[0] = 0; var top = 1;
  var best = Hit(INF, 0xffffffffu, vec2f(0.0));
  loop {
    if (top == 0) { break; } top--;
    let n = nodes[stack[top]];
    var lo = -INF; var hi = INF; var outside = false;
    for (var k = 0; k < 3; k++) {
      if (d[k] == 0.0) { if (o[k] < n.lo[k] || o[k] > n.hi[k]) { outside = true; } }
      else { let a = (n.lo[k] - o[k]) / d[k]; let b = (n.hi[k] - o[k]) / d[k]; lo = max(lo, min(a, b)); hi = min(hi, max(a, b)); }
    }
    if (outside || hi < max(lo, minT) || lo > best.t) { continue; }
    if (n.link >= 0) { stack[top] = n.link; stack[top + 1] = n.link + 1; top += 2; continue; }
    let start = -1 - n.link;
    for (var i = start; i < start + n.count; i++) {
      let tr = tris[i]; let e1 = tr.b - tr.a; let e2 = tr.c - tr.a;
      let h = cross(d, e2); let det = dot(e1, h);
      if (abs(det) < DET_TOL) { continue; }
      let s = o - tr.a; let u = dot(s, h) / det;
      if (u < 0.0 || u > 1.0) { continue; }
      let q = cross(s, e1); let v = dot(d, q) / det;
      if (v < 0.0 || u + v > 1.0) { continue; }
      let t = dot(e2, q) / det;
      if (t > minT && t < best.t) { best = Hit(t, u32(i), vec2f(u, v)); }
    }
  }
  return best;
}
`;
const dataWGSL = /* wgsl */ `
struct TraceMaterial { model: mat4x4f, color: vec4f, params: vec4f, finish: vec4f, finishAxis: vec4f, finishOrigin: vec4f, tex: vec4f, pbrMaps: vec4f, normalScale: vec4f }
struct Attribute { n0: vec4f, n1: vec4f, n2: vec4f, c0: vec4f, c1: vec4f, c2: vec4f, uv01: vec4f, uv2: vec4f }
struct Light { position: vec4f, direction: vec4f, color: vec4f, cone: vec4f }
struct Params { eye: vec4f, right: vec4f, up: vec4f, forward: vec4f, sky: vec4f, ground: vec4f, size: vec4u, env: vec4f, upAxis: vec4f }
@group(0) @binding(2) var<storage, read> attrs: array<Attribute>;
@group(0) @binding(3) var<storage, read> materials: array<TraceMaterial>;
@group(0) @binding(4) var<storage, read_write> accumulation: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> guides: array<vec4f>;
@group(0) @binding(6) var<uniform> params: Params;
@group(0) @binding(7) var<storage, read> lights: array<Light>;
@group(0) @binding(8) var atlas: texture_2d_array<f32>;
@group(0) @binding(9) var dataAtlas: texture_2d_array<f32>;
var<private> object: TraceMaterial;
var<private> rng: u32;
const PI = 3.14159265359;
fn random() -> f32 { rng ^= rng << 13u; rng ^= rng >> 17u; rng ^= rng << 5u; return f32(rng >> 8u) / 16777216.0; }
fn ggx(noh: f32, a: f32) -> f32 { let a2 = a * a; let f = (noh * a2 - noh) * noh + 1.0; return a2 / (PI * f * f); }
fn smith(nov: f32, nol: f32, a: f32) -> f32 { let a2 = a * a; return 0.5 / max(nol * sqrt(nov * nov * (1.0 - a2) + a2) + nov * sqrt(nol * nol * (1.0 - a2) + a2), 1e-5); }
fn schlick(f0: vec3f, voh: f32) -> vec3f { return f0 + (1.0 - f0) * pow(1.0 - voh, 5.0); }
fn address(p: vec2i, size: vec2i, repeat: bool) -> vec2i {
  if (repeat) { return (p % size + size) % size; } return clamp(p, vec2i(0), size - 1);
}
fn texel(uv: vec2f, layer: i32, flags: u32) -> vec4f {
  let size = vec2i(textureDimensions(atlas)); let repeat = (flags & 1u) != 0u;
  let p = uv * vec2f(size) - 0.5;
  if ((flags & 2u) != 0u) { return textureLoad(atlas, address(vec2i(floor(p + 0.5)), size, repeat), layer, 0); }
  let a = vec2i(floor(p)); let t = fract(p);
  return mix(mix(textureLoad(atlas, address(a, size, repeat), layer, 0), textureLoad(atlas, address(a + vec2i(1, 0), size, repeat), layer, 0), t.x),
    mix(textureLoad(atlas, address(a + vec2i(0, 1), size, repeat), layer, 0), textureLoad(atlas, address(a + vec2i(1), size, repeat), layer, 0), t.x), t.y);
}
fn dataTexel(uv: vec2f, layer: i32, flags: u32) -> vec4f {
  let size = vec2i(textureDimensions(dataAtlas)); let repeat = (flags & 1u) != 0u;
  let p = uv * vec2f(size) - 0.5;
  if ((flags & 2u) != 0u) { return textureLoad(dataAtlas, address(vec2i(floor(p + 0.5)), size, repeat), layer, 0); }
  let a = vec2i(floor(p)); let t = fract(p);
  return mix(mix(textureLoad(dataAtlas, address(a, size, repeat), layer, 0), textureLoad(dataAtlas, address(a + vec2i(1, 0), size, repeat), layer, 0), t.x),
    mix(textureLoad(dataAtlas, address(a + vec2i(0, 1), size, repeat), layer, 0), textureLoad(dataAtlas, address(a + vec2i(1), size, repeat), layer, 0), t.x), t.y);
}
fn mappedNormal(h: Hit, n: vec3f, uv: vec2f) -> vec3f {
  if (object.pbrMaps.x == 0.0 || all(object.normalScale.xy == vec2f(0.0))) { return n; }
  let tr = tris[h.index]; let a = attrs[tr.id];
  let duv1 = a.uv01.zw - a.uv01.xy; let duv2 = a.uv2.xy - a.uv01.xy;
  let det = duv1.x * duv2.y - duv1.y * duv2.x;
  if (!(abs(det) > 1e-20 && abs(det) < 1e20)) { return n; }
  let e1 = tr.b - tr.a; let e2 = tr.c - tr.a;
  let rawT = (e1 * duv2.y - e2 * duv1.y) / det;
  let rawB = (e2 * duv1.x - e1 * duv2.x) / det;
  let tangent = rawT - n * dot(n, rawT); let tangentLength = dot(tangent, tangent);
  if (!(tangentLength > 1e-12 && tangentLength < 1e30)) { return n; }
  let t = tangent * inverseSqrt(tangentLength); let crossNT = cross(n, t);
  let handed = dot(crossNT, rawB);
  if (!(abs(handed) > 1e-20 && abs(handed) < 1e30)) { return n; }
  let b = normalize(crossNT) * sign(handed);
  var mapped = dataTexel(uv, i32(object.pbrMaps.x), u32(object.pbrMaps.w) & 3u).rgb * 2.0 - 1.0;
  mapped = vec3f(mapped.xy * object.normalScale.xy, mapped.z);
  // Rescale the exponent before squaring; dividing by a near-max f32 can flush its reciprocal to zero.
  let largest = max(max(abs(mapped.x), abs(mapped.y)), abs(mapped.z));
  if (!(largest > 0.0)) { return n; }
  let exponent = frexp(largest).exp;
  mapped = normalize(ldexp(mapped, vec3i(-exponent)));
  let world = t * mapped.x + b * mapped.y + n * mapped.z;
  let worldLength = dot(world, world);
  if (!(worldLength > 1e-12 && worldLength < 1e30)) { return n; }
  return world * inverseSqrt(worldLength);
}
fn baseAt(h: Hit) -> vec4f {
  let a = attrs[tris[h.index].id]; let b = vec3f(1.0 - h.uv.x - h.uv.y, h.uv);
  let uv = a.uv01.xy * b.x + a.uv01.zw * b.y + a.uv2.xy * b.z;
  return (a.c0 * b.x + a.c1 * b.y + a.c2 * b.z) * object.color * texel(uv, i32(object.tex.x), u32(object.tex.w));
}
// Alpha is coverage (stochastic straight-through); this is not dielectric refraction.
fn surface(o: vec3f, d: vec3f) -> Hit {
  var minT = 0.0;
  for (var layer = 0; layer < 128; layer++) {
    let h = closest(o, d, minT); if (h.index == 0xffffffffu) { return h; }
    let tr = tris[h.index]; object = materials[u32(attrs[tr.id].n0.w)];
    let base = baseAt(h); let back = dot(cross(tr.b - tr.a, tr.c - tr.a), d) >= 0.0;
    if ((!back || object.tex.y > 0.5) && base.a >= object.tex.z && random() < base.a) { return h; }
    minT = h.t + max(1e-7, abs(h.t) * 2e-7);
  }
  return Hit(INF, 0xffffffffu, vec2f(0.0));
}
fn environment(d: vec3f) -> vec3f {
  if (params.env.x > 0.0) { let uv = vec2f(atan2(d.y, d.x) / (2.0 * PI) + 0.5, acos(clamp(d.z, -1.0, 1.0)) / PI); return texel(uv, i32(params.env.x), 1u).rgb * params.env.y; }
  return mix(params.ground.rgb, params.sky.rgb, clamp(dot(d, params.upAxis.xyz) * 0.5 + 0.5, 0.0, 1.0)) * params.sky.w;
}
fn basis(n: vec3f) -> mat3x3f { let t = normalize(select(cross(n, vec3f(1, 0, 0)), cross(n, vec3f(0, 1, 0)), abs(n.x) > 0.7)); return mat3x3f(t, cross(n, t), n); }
fn halfSample(n: vec3f, along: vec3f, a: f32, k: f32) -> vec3f {
  var frame = basis(n); if (k > 0.0) { frame = mat3x3f(along, cross(n, along), n); }
  let phi = random() * 2.0 * PI; let r = random(); let slope = sqrt(r / max(1.0 - r, 1e-7));
  let at = select(a, max(a * (1.0 - k), 0.002), k > 0.0); let ab = select(a, max(a * (1.0 + k), 0.002), k > 0.0);
  return normalize(frame * vec3f(at * slope * cos(phi), ab * slope * sin(phi), 1.0));
}
fn weights(metal: f32, coat: f32) -> vec3f { let c = 0.25 * coat; let s = (0.25 + 0.5 * metal) * (1.0 - c); return vec3f(1.0 - c - s, s, c); }
fn pdf(v: vec3f, l: vec3f, layer: Layer, w: vec3f) -> f32 {
  let h = normalize(v + l); let noh = max(dot(layer.n, h), 0.0); let voh = max(dot(v, h), 1e-7);
  let a = layer.rough * layer.rough;
  var dist = ggx(noh, a); if (layer.aniso > 0.0) { dist = ggxAniso(layer.n, h, layer.along, a, layer.aniso); }
  let spec = dist * noh / (4.0 * voh);
  let coat = ggx(max(dot(layer.coatN, h), 0.0), layer.coatRough * layer.coatRough) * max(dot(layer.coatN, h), 0.0) / (4.0 * voh);
  return w.x * max(dot(layer.n, l), 0.0) / PI + w.y * spec + w.z * coat;
}
fn primary(pixel: vec2f) -> vec3f {
  let q = pixel / vec2f(params.size.xy) * 2.0 - 1.0;
  return params.right.xyz * q.x * params.right.w - params.up.xyz * q.y * params.up.w;
}
@compute @workgroup_size(8, 8) fn trace(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= params.size.xy)) { return; }
  let index = id.y * params.size.x + id.x;
  rng = ((index + 1u) * 747796405u) ^ ((params.size.z + 1u) * 2891336453u); if (rng == 0u) { rng = 1u; }
  let offset = primary(vec2f(id.xy) + vec2f(random(), random()));
  var o = params.eye.xyz; var d = normalize(params.forward.xyz + offset);
  if (params.eye.w == 0.0) { o += offset; d = params.forward.xyz; }
  // Stable central geometry guides: no temporal mixing across moving silhouettes.
  if (params.size.z == 0u) {
    let center = primary(vec2f(id.xy) + 0.5);
    let co = select(params.eye.xyz + center, params.eye.xyz, params.eye.w > 0.0);
    let cd = select(params.forward.xyz, normalize(params.forward.xyz + center), params.eye.w > 0.0);
    let h = closest(co, cd, 0.0);
    var guide = vec4f(0.0);
    if (h.index != 0xffffffffu) { let tr = tris[h.index]; guide = vec4f(normalize(cross(tr.b - tr.a, tr.c - tr.a)), h.t); }
    guides[index] = guide;
  }
  var throughput = vec3f(1.0); var radiance = vec3f(0.0); var alpha = 0.0;
  for (var bounce = 0u; bounce < params.size.w; bounce++) {
    let h = surface(o, d);
    if (h.index == 0xffffffffu) { if (bounce > 0u) { radiance += throughput * environment(d); } break; }
    if (bounce == 0u) { alpha = 1.0; }
    let tr = tris[h.index]; let attr = attrs[tr.id]; object = materials[u32(attr.n0.w)];
    let bary = vec3f(1.0 - h.uv.x - h.uv.y, h.uv);
    let world = o + d * h.t; var gn = normalize(cross(tr.b - tr.a, tr.c - tr.a)); if (dot(gn, d) > 0.0) { gn = -gn; }
    var n = normalize(attr.n0.xyz * bary.x + attr.n1.xyz * bary.y + attr.n2.xyz * bary.z); if (dot(n, gn) < 0.0) { n = -n; }
    let base = baseAt(h).rgb;
    if (object.params.w > 0.5) { radiance += throughput * base; break; }
    radiance += throughput * base * object.params.z;
    let uv = attr.uv01.xy * bary.x + attr.uv01.zw * bary.y + attr.uv2.xy * bary.z;
    n = mappedNormal(h, n, uv);
    let mapFlags = u32(object.pbrMaps.w);
    var rough = object.params.y; var metal = object.params.x;
    if (object.pbrMaps.y > 0.0) { rough *= dataTexel(uv, i32(object.pbrMaps.y), (mapFlags >> 2u) & 3u).g; }
    if (object.pbrMaps.z > 0.0) { metal *= dataTexel(uv, i32(object.pbrMaps.z), (mapFlags >> 4u) & 3u).b; }
    let footprint = 2.0 * params.up.w / f32(params.size.y) * select(1.0, h.t, params.eye.w > 0.0);
    let layer = finishLayer(meshPoint(world), n, clamp(rough, 0.04, 1.0), footprint);
    metal = clamp(metal, 0.0, 1.0); let v = -d;
    let tint = filmTint(max(dot(n, v), 0.0), layer.film, world);
    let epsilon = max(1e-6, max(max(abs(world.x), abs(world.y)), abs(world.z)) * 4e-7);
    let origin = world + gn * epsilon;
    // Next-event estimation of all delta lights, with BVH shadows. Save the private per-hit material across traversal.
    let own = object;
    for (var li = 0u; li < u32(params.env.z); li++) {
      let light = lights[li]; var l = -light.direction.xyz; var distance = INF; var fall = 1.0;
      if (light.position.w > 0.5) {
        let to = light.position.xyz - world; distance = length(to); l = to / max(distance, 1e-6); fall = 1.0 / max(distance * distance, 1e-4);
        if (light.direction.w > 0.0) { let q = clamp(1.0 - pow(distance / light.direction.w, 4.0), 0.0, 1.0); fall *= q * q; }
        if (light.position.w > 1.5) { fall *= smoothstep(light.cone.y, light.cone.x, dot(-l, light.direction.xyz)); }
      }
      if (dot(gn, l) > 0.0 && surface(origin, l).t >= distance - epsilon) { object = own; radiance += throughput * brdfLayered(v, l, base, metal, layer.rough * layer.rough, layer, tint) * light.color.rgb * light.color.w * fall * PI; }
      object = own;
    }
    let w = weights(metal, layer.coat); let pick = random();
    var next: vec3f;
    if (pick < w.x) { let r = sqrt(random()); let phi = random() * 2.0 * PI; next = basis(layer.n) * vec3f(r * cos(phi), r * sin(phi), sqrt(max(0.0, 1.0 - r * r))); }
    else if (pick < w.x + w.y) { next = reflect(d, halfSample(layer.n, layer.along, layer.rough * layer.rough, layer.aniso)); }
    else { next = reflect(d, halfSample(layer.coatN, vec3f(0.0), layer.coatRough * layer.coatRough, 0.0)); }
    if (dot(gn, next) <= 0.0) { break; }
    let probability = pdf(v, next, layer, w); if (probability <= 1e-10) { break; }
    throughput *= brdfLayered(v, next, base, metal, layer.rough * layer.rough, layer, tint) / probability;
    if (bounce >= 2u) { let survive = clamp(max(max(throughput.x, throughput.y), throughput.z), 0.05, 0.95); if (random() > survive) { break; } throughput /= survive; }
    o = origin; d = normalize(next);
  }
  // f32 running mean avoids unbounded HDR sums. No radiance clamp or image-changing outlier rejection.
  let sample = vec4f(radiance, alpha);
  let previous = accumulation[index]; accumulation[index] = previous + (sample - previous) / f32(params.size.z + 1u);
}
`;
export const pathTraceWGSL = BVH_WGSL + hitWGSL + dataWGSL + materialLayerWGSL;

export const pathTraceDisplayWGSL = outputStructWGSL + outputColorWGSL + /* wgsl */ `
@group(0) @binding(0) var<storage, read> accumulation: array<vec4f>;
@group(0) @binding(1) var<storage, read> guides: array<vec4f>;
@group(0) @binding(2) var<uniform> output: Output;
@group(0) @binding(3) var imageOut: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(4) var<uniform> options: vec4u;
@compute @workgroup_size(8, 8) fn display(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(imageOut); if (any(id.xy >= size)) { return; }
  let index = id.y * size.x + id.x; let center = accumulation[index]; let guide = guides[index];
  var s = center;
  if (options.x != 0u && guide.w > 0.0 && center.a > 0.99) {
    // A 5x5 joint bilateral filter in linear light. Keep silhouettes, surface orientation and depth discontinuities.
    var sum = vec4f(0.0); var weight = 0.0;
    for (var y = -2; y <= 2; y++) { for (var x = -2; x <= 2; x++) {
      let p = vec2i(id.xy) + vec2i(x, y); if (any(p < vec2i(0)) || any(p >= vec2i(size))) { continue; }
      let k = u32(p.y) * size.x + u32(p.x); let g = guides[k]; let c = accumulation[k];
      if (g.w <= 0.0 || c.a < 0.99) { continue; }
      let spatial = exp(-f32(x * x + y * y) / 4.0); let normal = pow(max(dot(g.xyz, guide.xyz), 0.0), 32.0);
      let depth = exp(-abs(g.w - guide.w) / max(guide.w * 0.01, 1e-6));
      let color = exp(-length(c.rgb - center.rgb) / (0.25 + 0.5 * length(center.rgb)));
      let w = spatial * normal * depth * color; sum += c * w; weight += w;
    } }
    s = sum / max(weight, 1e-8);
  }
  var rgb = vec3f(0.0); if (s.a > 1e-8) { rgb = s.rgb / s.a * output.exposure; }
  if (output.toneMapping == 1u) { rgb = aces(rgb); } else if (output.toneMapping == 2u) { rgb = agx(rgb); }
  let uv = (vec2f(id.xy) + 0.5) / vec2f(size);
  let bg = mix(output.top, output.bottom, uv.y);
  let alpha = s.a + bg.a * (1.0 - s.a);
  let composite = encode(rgb) * s.a + bg.rgb * bg.a * (1.0 - s.a);
  var color = vec3f(0.0); if (alpha > 1e-8) { color = grade(composite / alpha, uv, vec2f(size)); }
  textureStore(imageOut, vec2i(id.xy), vec4f(color, alpha));
}
`;
