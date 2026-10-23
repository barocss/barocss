// The viewer's WGSL: line (R2c: shaders.ts split by program, shaders.ts the facade).
import { common } from './common.js';

/**
 * Lines as screen-space quads, one instance per segment: width in device pixels (object.params.x); dashed when
 * object.params.y (on) and .z (off, device pixels) are set, from each segment's start; fsHidden draws the parts behind
 * surfaces at object.params.w of their opacity (G7).
 */
export const lineWGSL = common + /* wgsl */ `
struct LOut { @builtin(position) clip: vec4f, @location(0) color: vec4f, @location(1) world: vec3f, @location(2) @interpolate(linear) along: f32 }
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) a: vec3f, @location(1) b: vec3f, @location(2) ca: vec4f, @location(3) cb: vec4f) -> LOut {
  return lineVertex(vi, a, b, ca, cb);
}
/** Off screen: a corner that draws nothing. */
fn lineNone() -> LOut { var o: LOut; o.clip = vec4f(0.0, 0.0, -1.0, 1.0); return o; }
/** A contour vertex's facing (G8): its normal against the eye's direction, both normalised; 0 within 1e-7; 2: none. */
fn facingAt(p: vec3f, n: vec3f) -> f32 {
  let w = (object.model * vec4f(p, 1.0)).xyz;
  let a = (object.model * vec4f(n, 0.0)).xyz;
  let v = select(-frame.forward.xyz, frame.eye.xyz - w, frame.eye.w > 0.5);
  let l = length(a) * length(v);
  if (!(l > 0.0)) { return 2.0; }
  let d = dot(a, v) / l;
  return select(d, 0.0, abs(d) <= 1e-7);
}
/**
 * A contour's segment across one triangle (G8, as the studio's silhouetteLines finds it on the CPU): where the facing,
 * linear between the vertices, is zero — the edge between two vertices at zero, or a vertex at zero and a crossing, or
 * two crossings; none when every vertex is at zero or the two points meet.
 */
@vertex fn vsContour(@builtin(vertex_index) vi: u32, @location(0) a: vec3f, @location(1) b: vec3f, @location(2) c: vec3f, @location(3) na: vec3f, @location(4) nb: vec3f, @location(5) nc: vec3f) -> LOut {
  var p = array<vec3f, 3>(a, b, c);
  var f = array<f32, 3>(facingAt(a, na), facingAt(b, nb), facingAt(c, nc));
  if (max(max(f[0], f[1]), f[2]) > 1.5) { return lineNone(); }
  var q = array<vec3f, 2>(a, a);
  var n = 0u;
  for (var i = 0u; i < 3u; i++) { if (f[i] == 0.0) { if (n < 2u) { q[n] = p[i]; } n++; } }
  if (n == 3u) { return lineNone(); }
  if (n < 2u) {
    for (var e = 0u; e < 3u; e++) {
      let j = (e + 1u) % 3u;
      if (f[e] * f[j] >= 0.0) { continue; }
      if (n < 2u) { q[n] = mix(p[e], p[j], f[e] / (f[e] - f[j])); }
      n++;
    }
    let scale = max(max(length(b - a), length(c - a)), length(c - b));
    if (n != 2u || !(length(q[0] - q[1]) > scale * 1e-10)) { return lineNone(); }
  }
  return lineVertex(vi, q[0], q[1], vec4f(1.0), vec4f(1.0));
}
fn lineVertex(vi: u32, a: vec3f, b: vec3f, ca: vec4f, cb: vec4f) -> LOut {
  var o: LOut;
  let wa = object.model * vec4f(a, 1.0);
  let wb = object.model * vec4f(b, 1.0);
  var pa = frame.viewProj * wa;
  var pb = frame.viewProj * wb;
  // Clip to the space in front of the eye before dividing.
  let eps = 1e-6;
  if (pa.w < eps && pb.w < eps) { o.clip = vec4f(0.0, 0.0, -1.0, 1.0); return o; }
  if (pa.w < eps) { pa = mix(pa, pb, (eps - pa.w) / (pb.w - pa.w)); }
  if (pb.w < eps) { pb = mix(pb, pa, (eps - pb.w) / (pa.w - pb.w)); }
  let half = frame.viewport.xy * 0.5;
  let sa = pa.xy / pa.w * half;
  let sb = pb.xy / pb.w * half;
  let d = sb - sa;
  let l = length(d);
  let dir = select(vec2f(1.0, 0.0), d / l, l > 1e-6);
  let nrm = vec2f(-dir.y, dir.x);
  var corners = array<vec2f, 6>(vec2f(0.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0), vec2f(0.0, -1.0), vec2f(1.0, 1.0), vec2f(0.0, 1.0));
  let c = corners[vi];
  let p = select(pa, pb, c.x > 0.5);
  let w = max(object.params.x, 1.0) * 0.5;
  // Square caps: each end reaches half a width past its point.
  let off = (nrm * c.y + dir * (c.x * 2.0 - 1.0)) * w / half * p.w;
  o.clip = vec4f(p.xy + off, p.zw);
  o.color = select(ca, cb, c.x > 0.5) * object.color;
  o.world = select(wa.xyz, wb.xyz, c.x > 0.5);
  o.along = c.x * l;
  return o;
}
fn lineColor(in: LOut, dash: vec2f) -> vec4f {
  if (clippedAway(in.world)) { discard; }
  let period = dash.x + dash.y;
  if (dash.x > 0.0 && dash.y > 0.0 && in.along % period > dash.x) { discard; }
  return vec4f(in.color.rgb * in.color.a, in.color.a);
}
@fragment fn fs(in: LOut) -> @location(0) vec4f { return lineColor(in, object.params.yz); }
@fragment fn fsHidden(in: LOut) -> @location(0) vec4f { return lineColor(in, object.hatch.xy) * object.params.w; }
`;
