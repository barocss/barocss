// The viewer's WGSL: grid (R2c: shaders.ts split by program, shaders.ts the facade).
import { common } from './common.js';

/** The ground grid: the plane through the up axis at the grid height, ray-cast per pixel. */
export const gridWGSL = common + /* wgsl */ `
struct GOut { @builtin(position) pos: vec4f, @location(0) ndc: vec2f }
@vertex fn vs(@builtin(vertex_index) i: u32) -> GOut {
  var o: GOut;
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  o.pos = vec4f(p, 0.0, 1.0);
  o.ndc = p;
  return o;
}
struct GFrag { @location(0) color: vec4f, @builtin(frag_depth) depth: f32 }
/** Coverage of lines every size along both plane axes, about one pixel wide. */
fn lines(uv: vec2f, size: f32) -> f32 {
  let c = uv / size;
  let g = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), vec2f(1e-6));
  return 1.0 - min(min(g.x, g.y), 1.0);
}
fn axisLine(x: f32) -> f32 { return 1.0 - min(abs(x) / max(fwidth(x), 1e-6) / 1.5, 1.0); }
@fragment fn fs(in: GOut) -> GFrag {
  let a = frame.invViewProj * vec4f(in.ndc, 1.0, 1.0);
  let b = frame.invViewProj * vec4f(in.ndc, 0.5, 1.0);
  let p0 = a.xyz / a.w;
  let dir = b.xyz / b.w - p0;
  let up = normalize(frame.up.xyz);
  let den = dot(dir, up);
  let t = (frame.grid.w - dot(p0, up)) / select(den, 1e-12, abs(den) < 1e-12);
  let hit = p0 + dir * t;
  // Plane axes: x and y for a z-up world.
  let e2 = normalize(select(cross(up, vec3f(1.0, 0.0, 0.0)), cross(up, vec3f(0.0, 1.0, 0.0)), abs(up.x) > 0.9));
  let e1 = cross(e2, up);
  let uv = vec2f(dot(hit, e1), dot(hit, e2));
  let minor = lines(uv, frame.grid.x);
  let major = lines(uv, frame.grid.x * frame.grid.y);
  let ax = axisLine(uv.y);
  let ay = axisLine(uv.x);
  // Fade with distance and at grazing angles (where lines would alias).
  let dist = length(hit - select(p0, frame.eye.xyz, frame.eye.w > 0.5));
  let fade = (1.0 - smoothstep(frame.grid.z * 0.4, frame.grid.z, dist)) * smoothstep(0.02, 0.25, abs(dot(normalize(dir), up)));
  var color = frame.gridColor.rgb;
  var k = max(minor * 0.45, major) * frame.gridColor.a;
  // Axes a little stronger than the grid's major lines.
  let axisAlpha = clamp(frame.gridColor.a * 2.0, 0.0, 0.9);
  if (ax > 0.0) { color = mix(color, vec3f(0.75, 0.12, 0.10), ax); k = max(k, ax * axisAlpha); }
  if (ay > 0.0) { color = mix(color, vec3f(0.15, 0.55, 0.12), ay); k = max(k, ay * axisAlpha); }
  k *= fade;
  let clip = frame.viewProj * vec4f(hit, 1.0);
  var o: GFrag;
  o.color = vec4f(color * k, k);
  o.depth = clamp(clip.z / clip.w, 0.0, 1.0);
  if (t <= 0.0 || k <= 0.002 || clip.w <= 0.0) { discard; }
  return o;
}
`;
