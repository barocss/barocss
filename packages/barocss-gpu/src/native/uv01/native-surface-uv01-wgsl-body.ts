import { MeshMaterialError } from '../../material/mesh-material.js';
import type { NativeSurfaceUV01MaterialExpression, NativeSurfaceUV01MaterialIR, MeshMaterialUniform } from '../../material/mesh-material.js';
import { colorLiteralLinear } from '../../material/mesh-material-wgsl.js';

const DECLARATIONS = 'struct MaterialParams {\n  slot: array<vec4<f32>, 4>,\n}\n';
function fail(code: 'RANGE' | 'BUDGET' | 'IR', detail: string): never {
  throw new MeshMaterialError(code, detail.slice(0, 1024));
}
/** Keep original Number coefficients in the validated IR; emit execution-only f32. */
function executed(value: number): number {
  const derived = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(derived) || value !== 0 && derived === 0)
    fail('RANGE', 'Native Surface coefficient must remain finite and nonzero when executed as f32');
  return derived;
}
function literal(value: number): string {
  const derived = executed(value);
  return (Object.is(derived, -0) ? '-0.00000000e+0' : derived.toExponential(8)) + 'f';
}
function textBudget(value: string): void {
  if (value.length > 65536 || new TextEncoder().encode(value).length > 65536)
    fail('BUDGET', 'Complete native Surface WGSL text exceeds64KiB UTF16 or UTF8');
}

/** Internal typed emitter. Only the public owner's already reconstructed native IR enters. */
export function lowerNativeSurfaceUV01WGSLBody(material: NativeSurfaceUV01MaterialIR, srgb = false): {
  expression: string;
  declarations: string;
  uniformLayout: (MeshMaterialUniform & { index: number; byteOffset: number; access: string })[];
  uniformByteLength: 64;
} {
  const uniformLayout = material.uniforms.map((uniform, index) => {
    executed(uniform.min); executed(uniform.max); executed(uniform.default);
    return { ...uniform, index, byteOffset: 4 * index,
      access: 'materialParams.slot[' + Math.floor(index / 4) + '].' + 'xyzw'[index % 4] };
  });
  const uniforms = new Map(uniformLayout.map(uniform => [uniform.name, uniform.access]));
  let visits = 0;
  const lower = (node: NativeSurfaceUV01MaterialExpression, depth: number): string => {
    if (++visits > 256 || depth > 16) fail('BUDGET', 'Native Surface WGSL tree exceeds256 nodes or depth16');
    switch (node.kind) {
      case 'float': return literal(node.value);
      case 'color': return 'vec3<f32>(' + colorLiteralLinear(node, srgb).map(literal).join(',') + ')';
      case 'uniform': {
        const access = uniforms.get(node.name);
        if (access === undefined) fail('IR', 'Reconstructed native Surface uniform layout is missing');
        return access;
      }
      case 'input': {
        switch (node.name) {
          case 'surface_u01': return 'native_surface_uv01.x';
          case 'surface_v01': return 'native_surface_uv01.y';
          default: return fail('IR', 'Reconstructed native Surface input domain is unsupported');
        }
      }
      case 'unary': {
        const child = lower(node.value, depth + 1);
        return node.operator === '+' ? child : '(-' + child + ')';
      }
      case 'binary': return '(' + lower(node.left, depth + 1) + node.operator + lower(node.right, depth + 1) + ')';
      case 'call': {
        const args = node.args.map(argument => lower(argument, depth + 1));
        // The containing program supplies material_mix with one ratio clamp.
        return (node.name === 'mix' ? 'material_mix' : node.name) + '(' + args.join(',') + ')';
      }
    }
  };
  const expression = 'clamp(' + lower(material.expression, 1) + ',vec3<f32>(0.0),vec3<f32>(1.0))';
  textBudget(expression); textBudget(DECLARATIONS);
  return { expression, declarations: DECLARATIONS, uniformLayout, uniformByteLength: 64 };
}
