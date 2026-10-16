// Authored material sources (`@shader #name { @uniform …; @fragment { color: … } }`) as the viewer's
// shader materials: compiled by the package's material compiler, lowered to WGSL, with the helper the
// lowering calls and the uniforms' defaults as params. A source with surface_u01/surface_v01 reads the
// geometry's uvs.
import { compileMeshMaterial, compileNativeSurfaceUV01Material, type MeshMaterialBinding, type MeshMaterialDiagnostic } from './mesh-material.js';
import { lowerMeshMaterialWGSL } from './mesh-material-wgsl.js';
import { lowerNativeSurfaceUV01MaterialWGSL } from './native-surface-uv01-material-wgsl.js';
import type { ShaderMaterial } from './viewer/viewer.js';

export interface MaterialUniform { name: string; min: number; max: number; default: number; index: number }
export type MaterialShaderResult =
  | { ok: true; shader: ShaderMaterial; uniforms: MaterialUniform[]; usesUV: boolean }
  | { ok: false; diagnostics: MeshMaterialDiagnostic[] };

/** The lowering's mix, with its ratio clamped. */
const HELPERS = 'fn material_mix(a: vec3<f32>, b: vec3<f32>, ratio: f32) -> vec3<f32> {\n  let t = clamp(ratio, 0.0, 1.0);\n  return a * (1.0 - t) + b * t;\n}\n';

/** Compile a material source for Material.shader; params override uniforms by name. */
export function materialShader(source: string, params: Readonly<Record<string, number>> = {}): MaterialShaderResult {
  const mesh = compileMeshMaterial(source);
  let lowered: { declarations: string; expression: string; uniformLayout: readonly { name: string; min: number; max: number; default: number; index: number }[] }, usesUV = false;
  if (mesh.ok) lowered = lowerMeshMaterialWGSL(mesh.material);
  else {
    const uv = compileNativeSurfaceUV01Material(source);
    if (!uv.ok) return { ok: false, diagnostics: mesh.diagnostics };
    lowered = lowerNativeSurfaceUV01MaterialWGSL(uv.material); usesUV = true;
  }
  const uniforms = lowered.uniformLayout.map(u => ({ name: u.name, min: u.min, max: u.max, default: u.default, index: u.index }));
  const values = new Array(16).fill(0);
  for (const u of uniforms) values[u.index] = Math.min(u.max, Math.max(u.min, params[u.name] ?? u.default));
  return { ok: true, usesUV, uniforms, shader: { declarations: lowered.declarations + HELPERS, expression: lowered.expression, aliases: { native_surface_uv01: 'uv' }, params: values } };
}

/** A compiled material and its uniform values (MeshMaterialBinding) as a shader material. */
export function bindingShader(binding: MeshMaterialBinding): ShaderMaterial {
  const lowered = lowerMeshMaterialWGSL(binding.material), values = new Array(16).fill(0);
  for (const u of lowered.uniformLayout) values[u.index] = binding.uniforms[u.name] ?? u.default;
  return { declarations: lowered.declarations + HELPERS, expression: lowered.expression, params: values };
}

/** A compiled UV01 surface material (surface_u01/surface_v01 from the geometry's uvs) and its uniform values. */
export function uv01Shader(material: unknown, uniforms: Readonly<Record<string, number>>): ShaderMaterial {
  const lowered = lowerNativeSurfaceUV01MaterialWGSL(material), values = new Array(16).fill(0);
  for (const u of lowered.uniformLayout) values[u.index] = uniforms[u.name] ?? u.default;
  return { declarations: lowered.declarations + HELPERS, expression: lowered.expression, aliases: { native_surface_uv01: 'uv' }, params: values };
}
