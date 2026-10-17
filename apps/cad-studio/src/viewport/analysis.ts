// Surface analysis looks for the viewport, as the viewer's shader materials (WGSL, drawn unlit):
// zebra stripes — a striped environment's reflection, where a stripe that bends sharply or breaks shows a
// joint that is not smooth — and a curvature map — how fast the normal turns across the surface (from the
// pixel's own derivatives), flat blue through green to red.
import type { ShaderMaterial } from '@barocss/gpu/viewer';

export type Analysis = 'zebra' | 'curvature';

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
