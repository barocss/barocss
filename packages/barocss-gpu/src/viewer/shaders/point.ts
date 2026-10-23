// The viewer's WGSL: point (R2c: shaders.ts split by program, shaders.ts the facade).
import { common } from './common.js';

/**
 * Points as screen-space sprites, one instance each (G8): size in device pixels (object.params.x), a border inside the
 * edge (.y pixels, colour object.cap.rgb), a disc (.z 1) or a square (.z 0); edges by coverage, blended. fsHidden draws
 * the parts behind surfaces at object.params.w of their opacity.
 */
export const pointWGSL = common + /* wgsl */ `
struct POut { @builtin(position) clip: vec4f, @location(0) color: vec4f, @location(1) world: vec3f, @location(2) @interpolate(linear) local: vec2f }
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) p: vec3f, @location(1) c: vec4f) -> POut {
  var o: POut;
  let w = object.model * vec4f(p, 1.0);
  let q = frame.viewProj * w;
  if (q.w < 1e-6) { o.clip = vec4f(0.0, 0.0, -1.0, 1.0); return o; }
  var corners = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0));
  // (Half a pixel more than its half size each way: the coverage at its edge reaches no further (G14: a pixel more drew
  // 25 for a point of 3, now 16).)
  let r = max(object.params.x, 1.0) * 0.5 + 0.5;
  let k = corners[vi];
  o.clip = vec4f(q.xy + k * r / (frame.viewport.xy * 0.5) * q.w, q.zw);
  o.local = k * r;
  o.color = c * object.color;
  o.world = w.xyz;
  return o;
}
// (No discard, G14: a point writes no depth and always blends, so where it does not cover it returns nothing — and a
// pipeline without discard keeps the depth test ahead of the shader, which the hidden-parts pass leans on.)
fn pointColor(in: POut) -> vec4f {
  let half = max(object.params.x, 1.0) * 0.5;
  let d = select(max(abs(in.local.x), abs(in.local.y)), length(in.local), object.params.z > 0.5);
  let cover = select(clamp(half - d + 0.5, 0.0, 1.0), 0.0, clippedAway(in.world));
  var col = in.color;
  if (object.params.y > 0.0) { col = mix(col, vec4f(object.cap.rgb, object.color.a), clamp(d - (half - object.params.y) + 0.5, 0.0, 1.0)); }
  let a = col.a * cover;
  return vec4f(col.rgb * a, a);
}
@fragment fn fs(in: POut) -> @location(0) vec4f { return pointColor(in); }
@fragment fn fsHidden(in: POut) -> @location(0) vec4f { return pointColor(in) * object.params.w; }
`;
