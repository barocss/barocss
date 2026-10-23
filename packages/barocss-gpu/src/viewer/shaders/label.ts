// The viewer's WGSL: label (R2c: shaders.ts split by program, shaders.ts the facade).
import { common } from './common.js';

/**
 * Text labels (G15): one quad an instance — a glyph from the distance-field atlas, or a label's rounded box (its fill,
 * or with uv.x < 0 its 1-pixel border). A screen label's rectangle is in CSS pixels about its anchor's projection (y
 * down); a plane label's in world units along its plane's right and up. Glyph edges are cut at the field's middle, a
 * device pixel wide whatever the size (fwidth); boxes by their distance in device pixels. fsHidden at object.params.w.
 */
export const labelWGSL = common + /* wgsl */ `
@group(2) @binding(0) var atlas: texture_2d<f32>;
@group(2) @binding(1) var atlasSampler: sampler;
struct LOut {
  @builtin(position) clip: vec4f, @location(0) color: vec4f, @location(1) world: vec3f, @location(2) uv: vec2f,
  @location(3) @interpolate(linear) local: vec2f, @location(4) @interpolate(flat) rect: vec4f, @location(5) @interpolate(flat) info: vec4f,
}
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) at: vec3f, @location(1) c: vec4f, @location(2) rect: vec4f, @location(3) uv: vec4f, @location(4) right: vec4f, @location(5) up: vec4f) -> LOut {
  var o: LOut;
  var corners = array<vec2f, 6>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 1.0));
  let k = corners[vi];
  let x = mix(rect.x, rect.z, k.x);
  let y = mix(rect.y, rect.w, k.y);
  let plane = right.w >= 1.5;
  var world: vec3f;
  if (plane) {
    world = (object.model * vec4f(at + right.xyz * x + up.xyz * y, 1.0)).xyz;
    o.clip = frame.viewProj * vec4f(world, 1.0);
  } else {
    world = (object.model * vec4f(at, 1.0)).xyz;
    let q = frame.viewProj * vec4f(world, 1.0);
    if (q.w < 1e-6) { o.clip = vec4f(0.0, 0.0, -1.0, 1.0); return o; }
    o.clip = vec4f(q.xy + vec2f(x, -y) * frame.viewport.z / (frame.viewport.xy * 0.5) * q.w, q.zw);
  }
  o.color = c * object.color;
  o.world = world;
  o.uv = vec2f(mix(uv.x, uv.z, k.x), mix(uv.y, uv.w, k.y));
  o.local = vec2f(x, y);
  o.rect = rect;
  o.info = vec4f(right.w - select(0.0, 2.0, plane), up.w, select(0.0, 1.0, uv.x < 0.0), 0.0);
  return o;
}
fn labelColor(in: LOut) -> vec4f {
  // (Sampled and differentiated first, in uniform control flow.)
  let s = textureSample(atlas, atlasSampler, in.uv).r;
  let w = max(fwidth(s), 1e-4) * 0.75;
  let unit = max(fwidth(in.local.x), 1e-6);
  var cover: f32;
  if (in.info.x < 0.5) {
    cover = smoothstep(0.502 - w, 0.502 + w, s);
  } else {
    let c = (in.rect.xy + in.rect.zw) * 0.5;
    let h = abs(in.rect.zw - in.rect.xy) * 0.5;
    let r = min(in.info.y, min(h.x, h.y));
    let q = abs(in.local - c) - h + vec2f(r);
    let d = (length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r) / unit;
    let bw = frame.viewport.z;
    cover = select(clamp(0.5 - d, 0.0, 1.0), clamp(bw * 0.5 + 0.5 - abs(d + bw * 0.5), 0.0, 1.0), in.info.z > 0.5);
  }
  cover = select(cover, 0.0, clippedAway(in.world));
  let a = in.color.a * cover;
  return vec4f(in.color.rgb * a, a);
}
@fragment fn fs(in: LOut) -> @location(0) vec4f { return labelColor(in); }
@fragment fn fsHidden(in: LOut) -> @location(0) vec4f { return labelColor(in) * object.params.w; }
`;
