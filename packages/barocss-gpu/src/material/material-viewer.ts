// Authored material sources (`@shader #name { @uniform …; @fragment { color: … } }`) as the viewer's
// shader materials: compiled by the package's material compiler, lowered to WGSL, with the helper the
// lowering calls and the uniforms' defaults as params. A source with surface_u01/surface_v01 reads the
// geometry's uvs; one with uv_u/uv_v (and fract: the repeating UV profile, G18.2) reads them as engine_uv.
import { refusalText } from '../core/barocss-error.js';
import { MeshMaterialError, compileEngineUVRepeatingMaterial, compileMeshMaterial, compileNativeSurfaceUV01Material, type MeshMaterialBinding, type MeshMaterialDiagnostic } from './mesh-material.js';
import { lowerEngineUVRepeatingMaterialWGSL } from './engine-uv-repeating-material-wgsl.js';
import { lowerMeshMaterialWGSL } from './mesh-material-wgsl.js';
import { lowerNativeSurfaceUV01MaterialWGSL } from '../native/uv01/native-surface-uv01-material-wgsl.js';
import type { ShaderMaterial } from '../viewer/viewer.js';

export interface MaterialUniform { name: string; min: number; max: number; default: number; index: number }
export type MaterialShaderResult =
  | { ok: true; shader: ShaderMaterial; uniforms: MaterialUniform[]; usesUV: boolean }
  | { ok: false; diagnostics: MeshMaterialDiagnostic[] };

/** The uv inputs' names in the lowerings (UV01's and the repeating profile's), both the geometry's uvs. */
const UV_ALIASES = { native_surface_uv01: 'uv', engine_uv: 'uv' } as const;
/** The lowering's mix, with its ratio clamped. */
const HELPERS = 'fn material_mix(a: vec3<f32>, b: vec3<f32>, ratio: f32) -> vec3<f32> {\n  let t = clamp(ratio, 0.0, 1.0);\n  return a * (1.0 - t) + b * t;\n}\n';

/** Compile a material source for Material.shader; params override uniforms by name. */
export function materialShader(source: string, params: Readonly<Record<string, number>> = {}): MaterialShaderResult {
  const mesh = compileMeshMaterial(source);
  let lowered: { declarations: string; expression: string; uniformLayout: readonly { name: string; min: number; max: number; default: number; index: number }[] }, usesUV = false;
  // (The viewer encodes sRGB exactly: colour literals by the exact decode, G5. A lowering's refusal is a diagnostic, not a
  // throw: the studio compiles its render materials as they are typed.)
  try {
    if (mesh.ok) lowered = lowerMeshMaterialWGSL(mesh.material, { srgb: true });
    else {
      const repeating = compileEngineUVRepeatingMaterial(source), uv = repeating.ok ? null : compileNativeSurfaceUV01Material(source);
      if (repeating.ok) { lowered = lowerEngineUVRepeatingMaterialWGSL(repeating.material, { srgb: true }); usesUV = true; }
      else if (uv?.ok) { lowered = lowerNativeSurfaceUV01MaterialWGSL(uv.material, { srgb: true }); usesUV = true; }
      // (Refused by all: the diagnostics of the profile whose inputs it reads — a uv_u source's RANGE, not the mesh profile's TYPE.)
      else return { ok: false, diagnostics: /\buv_[uv]\b/.test(source) ? repeating.diagnostics : /\bsurface_[uv]01\b/.test(source) && uv ? uv.diagnostics : mesh.diagnostics };
    }
  } catch (e) {
    if (!(e instanceof MeshMaterialError)) throw e;
    return { ok: false, diagnostics: [{ code: e.code, message: refusalText(e), start: 0, end: source.length }] };
  }
  const uniforms = lowered.uniformLayout.map(u => ({ name: u.name, min: u.min, max: u.max, default: u.default, index: u.index }));
  const values = new Array(16).fill(0);
  for (const u of uniforms) values[u.index] = Math.min(u.max, Math.max(u.min, params[u.name] ?? u.default));
  return { ok: true, usesUV, uniforms, shader: { declarations: lowered.declarations + HELPERS, expression: lowered.expression, aliases: UV_ALIASES, params: values } };
}

/** A compiled material and its uniform values (MeshMaterialBinding) as a shader material. */
export function bindingShader(binding: MeshMaterialBinding): ShaderMaterial {
  const lowered = lowerMeshMaterialWGSL(binding.material, { srgb: true }), values = new Array(16).fill(0);
  for (const u of lowered.uniformLayout) values[u.index] = binding.uniforms[u.name] ?? u.default;
  return { declarations: lowered.declarations + HELPERS, expression: lowered.expression, params: values };
}

/**
 * A compiled repeating UV material (uv_u/uv_v from the geometry's uvs, G18.2) and its uniform values. `srgb` false: its
 * colour literals by the material language's gamma-2.2 decode, as its GLSL lowering has (an oracle's parity, not the viewer's look).
 */
export function uvRepeatingShader(material: unknown, uniforms: Readonly<Record<string, number>>, options: { srgb?: boolean } = {}): ShaderMaterial {
  const lowered = lowerEngineUVRepeatingMaterialWGSL(material, { srgb: options.srgb !== false }), values = new Array(16).fill(0);
  for (const u of lowered.uniformLayout) values[u.index] = Math.min(u.max, Math.max(u.min, uniforms[u.name] ?? u.default));
  return { declarations: lowered.declarations + HELPERS, expression: lowered.expression, aliases: UV_ALIASES, params: values };
}

/** A compiled UV01 surface material (surface_u01/surface_v01 from the geometry's uvs) and its uniform values. */
export function uv01Shader(material: unknown, uniforms: Readonly<Record<string, number>>): ShaderMaterial {
  const lowered = lowerNativeSurfaceUV01MaterialWGSL(material, { srgb: true }), values = new Array(16).fill(0);
  for (const u of lowered.uniformLayout) values[u.index] = uniforms[u.name] ?? u.default;
  return { declarations: lowered.declarations + HELPERS, expression: lowered.expression, aliases: { native_surface_uv01: 'uv' }, params: values };
}
