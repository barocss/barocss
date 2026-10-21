import { MeshMaterialError, validateMeshMaterialIR } from './mesh-material.js';
import type { MeshMaterialExpression, MeshMaterialIR, MeshMaterialUniform } from './mesh-material.js';
import { copyGpuData, freezeGpuData } from './gpu-data.js';

export interface LoweredMeshMaterialWGSL {
  readonly format: 'barocss-gpu-mesh-material-wgsl';
  readonly version: 0;
  readonly profile: 'mesh-opaque-fragment-wgsl-v0';
  readonly material: MeshMaterialIR;
  readonly expression: string;
  readonly declarations: string;
  readonly uniformLayout: (MeshMaterialUniform & { index: number; byteOffset: number; access: string })[];
  readonly uniformByteLength: 64;
}

const DECLARATIONS = 'struct MaterialParams {\n  slot: array<vec4<f32>, 4>,\n}\n';
function fail(code: 'RANGE' | 'BUDGET' | 'IR', message: string): never {
  throw new MeshMaterialError(code, message.slice(0, 1024));
}
/** Original coefficients remain in Material IR; this value is execution-only. */
function executed(value: number): number {
  const result = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(result) || value !== 0 && result === 0)
    fail('RANGE', 'Material coefficient must remain finite and nonzero when executed as f32');
  return result;
}
function literal(value: number): string {
  const result = executed(value);
  return (Object.is(result, -0) ? '-0.00000000e+0' : result.toExponential(8)) + 'f';
}
function textBudget(text: string): void {
  if (text.length > 65536 || new TextEncoder().encode(text).length > 65536)
    fail('BUDGET', 'Complete material WGSL text exceeds64KiB UTF16 or UTF8');
}
/** Count signed complete output before its final owned copy, without joining JSON. */
function resultBudget(value: LoweredMeshMaterialWGSL): void {
  const encoder = new TextEncoder();
  let utf16 = 0, utf8 = 0;
  const append = (text: string): void => {
    utf16 += text.length;
    if (utf16 > 2097152) fail('BUDGET', 'Complete material WGSL result exceeds2MiB UTF16');
    utf8 += encoder.encode(text).length;
    if (utf8 > 2097152) fail('BUDGET', 'Complete material WGSL result exceeds2MiB UTF8');
  };
  const visit = (item: unknown): void => {
    if (typeof item === 'number') { append(Object.is(item, -0) ? '-0' : JSON.stringify(item)); return; }
    if (item === null || typeof item !== 'object') { append(JSON.stringify(item)); return; }
    if (Array.isArray(item)) {
      append('['); item.forEach((child, index) => { if (index) append(','); visit(child); }); append(']'); return;
    }
    append('{'); Object.entries(item).forEach(([key, child], index) => {
      if (index) append(','); append(JSON.stringify(key)); append(':'); visit(child);
    }); append('}');
  };
  visit(value);
}

/** Reconstruct legacy opaque source once and lower its typed tree directly to WGSL. */
/**
 * A colour literal's linear value: the material language's own (its gamma-2.2 decode, which its GLSL and older WGSL
 * renderers encode back with 1/2.2), or with `srgb` the exact sRGB decode of its hex — for a renderer that encodes sRGB
 * exactly (the viewer), so an authored #808080 shows as #808080 there too (G5).
 */
export function colorLiteralLinear(node: { hex: string; linear: readonly number[] }, srgb: boolean): readonly number[] {
  if (!srgb) return node.linear;
  return [1, 3, 5].map(i => { const c = parseInt(node.hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
}

export function lowerMeshMaterialWGSL(input: unknown, options: { srgb?: boolean } = {}): LoweredMeshMaterialWGSL {
  const material = validateMeshMaterialIR(input), srgb = options.srgb === true;
  const uniformLayout = material.uniforms.map((uniform, index) => {
    executed(uniform.min); executed(uniform.max); executed(uniform.default);
    return { ...uniform, index, byteOffset: 4 * index,
      access: 'materialParams.slot[' + Math.floor(index / 4) + '].' + 'xyzw'[index % 4] };
  });
  const uniforms = new Map(uniformLayout.map(uniform => [uniform.name, uniform.access]));
  let visits = 0;
  const lower = (node: MeshMaterialExpression, depth: number): string => {
    if (++visits > 256 || depth > 16) fail('BUDGET', 'Material WGSL tree exceeds256 nodes or depth16');
    switch (node.kind) {
      case 'float': return literal(node.value);
      case 'color': return 'vec3<f32>(' + colorLiteralLinear(node, srgb).map(literal).join(',') + ')';
      case 'uniform': {
        const access = uniforms.get(node.name);
        if (access === undefined) fail('IR', 'Reconstructed material uniform layout is missing');
        return access;
      }
      case 'unary': {
        const child = lower(node.value, depth + 1);
        return node.operator === '+' ? child : '(-' + child + ')';
      }
      case 'binary': return '(' + lower(node.left, depth + 1) + node.operator + lower(node.right, depth + 1) + ')';
      case 'call': {
        const args = node.args.map(argument => lower(argument, depth + 1));
        // The viewport owns this trusted helper; it clamps its ratio once.
        return (node.name === 'mix' ? 'material_mix' : node.name) + '(' + args.join(',') + ')';
      }
    }
  };
  const expression = 'clamp(' + lower(material.expression, 1) + ',vec3<f32>(0.0),vec3<f32>(1.0))';
  textBudget(expression); textBudget(DECLARATIONS);
  const result: LoweredMeshMaterialWGSL = {
    format: 'barocss-gpu-mesh-material-wgsl', version: 0, profile: 'mesh-opaque-fragment-wgsl-v0',
    material, expression, declarations: DECLARATIONS, uniformLayout, uniformByteLength: 64,
  };
  resultBudget(result);
  return freezeGpuData(copyGpuData(result));
}
