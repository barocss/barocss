// Surface analysis looks for the viewport, as the viewer's shader materials (WGSL, drawn unlit):
// zebra stripes — a striped environment's reflection, where a stripe that bends sharply or breaks shows a
// joint that is not smooth — and a curvature map — how fast the normal turns across the surface (from the
// pixel's own derivatives), flat blue through green to red.
import type { ShaderMaterial } from '@barocss/gpu/viewer';

/** Zebra, curvature, or the printing overhang map (AM2): faces leaning down past `sinLimit` (sin of the process's limit from the vertical) red, the bed at `bedZ` left out. */
export type Analysis = 'zebra' | 'curvature' | { readonly kind: 'overhang'; readonly sinLimit: number; readonly bedZ: number };

const VIEW = 'select(-frame.forward.xyz, normalize(frame.eye.xyz - world), frame.eye.w > 0.5)';

/** Stripes of a horizontal striped sky reflected in the surface (`stripes` across the sky), softened over a pixel. */
export const zebra = (stripes = 12): ShaderMaterial => ({
  declarations: /* wgsl */ `
fn zebraColor(world: vec3f, n: vec3f) -> vec3f {
  let v = ${VIEW};
  let r = reflect(-v, n);
  let t = acos(clamp(r.z, -1.0, 1.0)) / 3.14159265 * materialParams.slot[0].x;
  let w = max(fwidth(t), 1e-4);
  let s = smoothstep(0.5 - w, 0.5 + w, abs(fract(t) - 0.5) * 2.0);
  return mix(vec3f(0.04), vec3f(0.92), s);
}
`,
  expression: 'zebraColor(world, normal)',
  params: [stripes],
});

/** The normal's turn per mm (1 / radius) across the pixel, scaled so `full` (1/mm) is red. */
export const curvature = (full = 0.2): ShaderMaterial => ({
  declarations: /* wgsl */ `
fn curvatureColor(world: vec3f, n: vec3f) -> vec3f {
  let dn = length(dpdx(n)) + length(dpdy(n));
  let dp = max(length(dpdx(world)) + length(dpdy(world)), 1e-6);
  let k = clamp(dn / dp / materialParams.slot[0].x, 0.0, 1.0);
  let low = mix(vec3f(0.15, 0.3, 0.85), vec3f(0.2, 0.8, 0.35), clamp(k * 2.0, 0.0, 1.0));
  return mix(low, vec3f(0.9, 0.2, 0.15), clamp(k * 2.0 - 1.0, 0.0, 1.0));
}
`,
  expression: 'curvatureColor(world, normal)',
  params: [full],
});

/** AM2's overhang map along +Z: past the limit red, facing down on the bed grey, the rest pale. */
export const overhang = (sinLimit: number, bedZ: number): ShaderMaterial => ({
  declarations: /* wgsl */ `
fn overhangColor(world: vec3f, n: vec3f) -> vec3f {
  let down = -normalize(n).z;
  if (down > 0.999 && world.z < materialParams.slot[0].y + 1e-3) { return vec3f(0.45); }
  if (down > materialParams.slot[0].x) { return mix(vec3f(0.95, 0.55, 0.2), vec3f(0.85, 0.12, 0.1), clamp((down - materialParams.slot[0].x) * 4.0, 0.0, 1.0)); }
  return vec3f(0.82, 0.86, 0.8);
}
`,
  expression: 'overhangColor(world, normal)',
  params: [sinLimit, bedZ],
});

