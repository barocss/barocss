// G15d.3: depth-derived circle of confusion; one gather per half-resolution pixel.
export const depthOfFieldWGSL = (multisampled: boolean): string => /* wgsl */ `
struct Focus { inverseProjection: mat4x4f, settings: vec4f }
@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var depth: ${multisampled ? 'texture_depth_multisampled_2d' : 'texture_depth_2d'};
@group(0) @binding(2) var<uniform> focus: Focus;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
fn pixel(p: vec2f) -> vec2i { return clamp(vec2i(p), vec2i(0), vec2i(textureDimensions(scene)) - 1); }
fn distanceAt(p: vec2i) -> f32 {
  let d = textureLoad(depth, p, 0);
  if (d <= 0.0) { return 1e20; }
  let size = vec2f(textureDimensions(scene));
  let ndc = vec2f((f32(p.x) + 0.5) / size.x * 2.0 - 1.0, 1.0 - (f32(p.y) + 0.5) / size.y * 2.0);
  let v = focus.inverseProjection * vec4f(ndc, d, 1.0);
  return max(-v.z / v.w, 1e-6);
}
fn circle(z: f32) -> f32 { return clamp(1.0 - focus.settings.x / z, -1.0, 1.0) * focus.settings.y; }
@fragment fn fs(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let size = vec2f(textureDimensions(scene));
  let halfSize = ceil(size * 0.5);
  let center = at.xy * size / halfSize;
  let p = pixel(center);
  let z = distanceAt(p);
  let radius = abs(circle(z));
  var color = textureLoad(scene, p, 0);
  var weight = 1.0;
  for (var i = 0u; i < 16u; i++) {
    let r = sqrt((f32(i) + 0.5) / 16.0) * radius;
    let angle = f32(i) * 2.39996323;
    let q = pixel(center + vec2f(cos(angle), sin(angle)) * r);
    let other = distanceAt(q);
    // A sharp foreground surface does not bleed across its silhouette into a blurred background.
    if (other < z && abs(circle(other)) < r) { continue; }
    color += textureLoad(scene, q, 0);
    weight += 1.0;
  }
  return color / weight;
}
`;
