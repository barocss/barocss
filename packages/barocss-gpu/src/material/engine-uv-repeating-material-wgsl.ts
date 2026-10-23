// G18.2: repeating UV materials (`uv_u`, `uv_v`, `fract`; profile engine-opaque-uv-repeating-fragment-v0) lowered to
// WGSL, for the viewer's shader materials — the WebGPU counterpart of lowerEngineUVRepeatingMaterial's GLSL. The input
// is reconstructed by validateEngineUVRepeatingMaterialIR (its source compiled again, as the GLSL lowering does); the
// tree is the same, the uv input is `engine_uv` (the viewer aliases it to its geometry's uvs), the uniforms sit in the
// 64-byte materialParams slot, `mix` is the viewer's material_mix (its ratio clamped once). A coefficient or uniform
// bound that is not representable as f32 (non-finite, or nonzero flushed to zero) is refused (RANGE), as G5's mesh
// lowering does.
import { MeshMaterialError, validateEngineUVRepeatingMaterialIR } from './mesh-material.js';
import type { EngineUVRepeatingMaterialExpression, EngineUVRepeatingMaterialIR, MeshMaterialUniform } from './mesh-material.js';
import { colorLiteralLinear } from './mesh-material-wgsl.js';
import { copyGpuData, freezeGpuData } from '../mesh/gpu-data.js';

export interface LoweredEngineUVRepeatingMaterialWGSL {
  readonly format: 'barocss-gpu-engine-uv-repeating-material-wgsl';
  readonly version: 0;
  readonly profile: 'engine-opaque-uv-repeating-fragment-wgsl-v0';
  readonly material: EngineUVRepeatingMaterialIR;
  /** A vec3<f32> of linear colour, with `engine_uv` (vec2<f32>), `materialParams` and material_mix in scope. */
  readonly expression: string;
  readonly declarations: string;
  readonly uniformLayout: (MeshMaterialUniform & { index: number; byteOffset: number; access: string })[];
  readonly uniformByteLength: 64;
  readonly input: { name: 'engine_uv'; type: 'vec2<f32>'; domain: 'engine-uv-repeating' };
}

const DECLARATIONS = 'struct MaterialParams {\n  slot: array<vec4<f32>, 4>,\n}\n';
function fail(code: 'RANGE' | 'BUDGET' | 'IR', message: string): never {
  throw new MeshMaterialError(code, message.slice(0, 1024));
}
/** The IR keeps its Number coefficients; this is the value executed. */
function executed(value: number): number {
  const result = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(result) || value !== 0 && result === 0)
    fail('RANGE', 'Repeating UV coefficient must remain finite and nonzero when executed as f32');
  return result;
}
function literal(value: number): string {
  const result = executed(value);
  return (Object.is(result, -0) ? '-0.00000000e+0' : result.toExponential(8)) + 'f';
}
function textBudget(text: string): void {
  if (text.length > 65536 || new TextEncoder().encode(text).length > 65536)
    fail('BUDGET', 'Complete repeating UV WGSL text exceeds64KiB UTF16 or UTF8');
}

/**
 * The repeating UV material's WGSL. `srgb`: colour literals by the exact sRGB decode, for a renderer that encodes sRGB
 * exactly (the viewer, G5); without it the material language's own gamma-2.2 decode, as its GLSL lowering has.
 */
export function lowerEngineUVRepeatingMaterialWGSL(input: unknown, options: { srgb?: boolean } = {}): LoweredEngineUVRepeatingMaterialWGSL {
  const material = validateEngineUVRepeatingMaterialIR(input), srgb = options.srgb === true;
  if (material.uniforms.length > 16) fail('BUDGET', 'A repeating UV material holds at most 16 uniforms (the 64-byte slot)');
  const uniformLayout = material.uniforms.map((uniform, index) => {
    executed(uniform.min); executed(uniform.max); executed(uniform.default);
    return { ...uniform, index, byteOffset: 4 * index, access: 'materialParams.slot[' + (index >> 2) + '].' + 'xyzw'[index & 3] };
  });
  const uniforms = new Map(uniformLayout.map(uniform => [uniform.name, uniform.access]));
  let visits = 0;
  const lower = (node: EngineUVRepeatingMaterialExpression, depth: number): string => {
    if (++visits > 256 || depth > 16) fail('BUDGET', 'Repeating UV WGSL tree exceeds256 nodes or depth16');
    switch (node.kind) {
      case 'float': return literal(node.value);
      case 'color': return 'vec3<f32>(' + colorLiteralLinear(node, srgb).map(literal).join(',') + ')';
      case 'uniform': {
        const access = uniforms.get(node.name);
        if (access === undefined) fail('IR', 'Reconstructed repeating UV uniform layout is missing');
        return access;
      }
      case 'input': {
        switch (node.name) {
          case 'uv_u': return 'engine_uv.x';
          case 'uv_v': return 'engine_uv.y';
          default: return fail('IR', 'Reconstructed repeating UV input is unsupported');
        }
      }
      // (WGSL has no unary plus.)
      case 'unary': { const child = lower(node.value, depth + 1); return node.operator === '+' ? child : '(-' + child + ')'; }
      case 'binary': return '(' + lower(node.left, depth + 1) + node.operator + lower(node.right, depth + 1) + ')';
      case 'call': {
        const args = node.args.map(argument => lower(argument, depth + 1));
        return (node.name === 'mix' ? 'material_mix' : node.name) + '(' + args.join(',') + ')';
      }
      default: return fail('IR', 'Reconstructed repeating UV expression is unsupported');
    }
  };
  const expression = 'clamp(' + lower(material.expression, 1) + ',vec3<f32>(0.0),vec3<f32>(1.0))';
  textBudget(expression); textBudget(DECLARATIONS);
  const result: LoweredEngineUVRepeatingMaterialWGSL = {
    format: 'barocss-gpu-engine-uv-repeating-material-wgsl', version: 0, profile: 'engine-opaque-uv-repeating-fragment-wgsl-v0',
    material, expression, declarations: DECLARATIONS, uniformLayout, uniformByteLength: 64,
    input: { name: 'engine_uv', type: 'vec2<f32>', domain: 'engine-uv-repeating' },
  };
  return freezeGpuData(copyGpuData(result));
}
