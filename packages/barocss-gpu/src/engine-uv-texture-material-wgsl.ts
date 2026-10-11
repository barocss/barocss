import { MeshMaterialError, validateEngineUVTextureMaterialIR } from './mesh-material.js';
import type { EngineMaterialSampler, EngineUVTextureMaterialExpression, EngineUVTextureMaterialIR, MeshMaterialUniform } from './mesh-material.js';
import { copyGpuData, freezeGpuData } from './gpu-data.js';

/** Source-qualified execution text. No resource, vertex or display ownership. */
export interface LoweredEngineUVTextureMaterialWGSL {
  readonly format: 'barocss-gpu-engine-uv-texture-material-wgsl';
  readonly version: 0;
  readonly profile: 'engine-opaque-uv-texture-fragment-wgsl-v0';
  readonly material: EngineUVTextureMaterialIR;
  readonly expression: string;
  readonly declarations: string;
  readonly uniformLayout: (MeshMaterialUniform & { index: number; byteOffset: number; access: string })[];
  readonly uniformByteLength: 64;
  readonly inputName: 'material_uv';
  readonly samplerLayout: (EngineMaterialSampler & {
    textureName: 'material_tex_0'; samplerName: 'material_sampler_0'; group: 1;
    textureBinding: 0; samplerBinding: 1; colorSpace: 'srgb'; rowOrigin: 'bottom-left';
    filter: 'nearest'; wrapS: 'clamp-to-edge'; wrapT: 'clamp-to-edge';
  })[];
}

// Always retain the declared resources, including an unused authored alias.
const DECLARATIONS = `struct MaterialParams {
  slot: array<vec4<f32>, 4>,
}
@group(0) @binding(1) var<uniform> materialParams: MaterialParams;
@group(1) @binding(0) var material_tex_0: texture_2d<f32>;
@group(1) @binding(1) var material_sampler_0: sampler;
fn engine_uv_decode(encodedColor: vec3<f32>) -> vec3<f32> {
  let encoded = clamp(encodedColor, vec3<f32>(0.0), vec3<f32>(1.0));
  let low = encoded / vec3<f32>(12.92);
  let high = pow((encoded + vec3<f32>(0.055)) / vec3<f32>(1.055), vec3<f32>(2.4));
  return select(high, low, encoded <= vec3<f32>(0.04045));
}
fn engine_uv_mix(fromColor: vec3<f32>, toColor: vec3<f32>, ratio: f32) -> vec3<f32> {
  return mix(fromColor, toColor, clamp(ratio, 0.0, 1.0));
}
`;

function fail(code: 'RANGE' | 'BUDGET' | 'IR', message: string): never {
  throw new MeshMaterialError(code, message.slice(0, 1024));
}
/** Keep original F64 values in material/layout; only execution uses f32. */
function executed(value: number): number {
  const result = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(result) || value !== 0 && result === 0)
    fail('RANGE', 'Texture material coefficient must remain finite and nonzero as f32');
  return result;
}
function literal(value: number): string {
  const result = executed(value);
  return (Object.is(result, -0) ? '-0.00000000e+0' : result.toExponential(8)) + 'f';
}
function textBudget(expression: string): void {
  if (expression.length + DECLARATIONS.length > 65536 ||
      new TextEncoder().encode(expression + DECLARATIONS).length > 65536)
    fail('BUDGET', 'Combined texture material WGSL text exceeds64KiB UTF16 or UTF8');
}
/** Bound signed complete data before allocating its final independent copy. */
function resultBudget(value: LoweredEngineUVTextureMaterialWGSL): void {
  const encoder = new TextEncoder();
  let utf16 = 0, utf8 = 0;
  const append = (text: string): void => {
    utf16 += text.length;
    if (utf16 > 2097152) fail('BUDGET', 'Complete texture WGSL result exceeds2MiB UTF16');
    utf8 += encoder.encode(text).length;
    if (utf8 > 2097152) fail('BUDGET', 'Complete texture WGSL result exceeds2MiB UTF8');
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

/** Reconstruct original EngineUV texture source once; lower only its typed tree. */
export function lowerEngineUVTextureMaterialWGSL(input: unknown): LoweredEngineUVTextureMaterialWGSL {
  const material = validateEngineUVTextureMaterialIR(input);
  const uniformLayout = material.uniforms.map((uniform, index) => {
    executed(uniform.min); executed(uniform.max); executed(uniform.default);
    return { ...uniform, index, byteOffset: 4 * index,
      access: 'materialParams.slot[' + Math.floor(index / 4) + '].' + 'xyzw'[index % 4] };
  });
  const uniforms = new Map(uniformLayout.map(uniform => [uniform.name, uniform.access]));
  const samplerLayout: LoweredEngineUVTextureMaterialWGSL['samplerLayout'] = material.samplers.map(sampler => ({
    ...sampler, textureName: 'material_tex_0', samplerName: 'material_sampler_0', group: 1,
    textureBinding: 0, samplerBinding: 1, colorSpace: 'srgb', rowOrigin: 'bottom-left',
    filter: 'nearest', wrapS: 'clamp-to-edge', wrapT: 'clamp-to-edge',
  }));
  let visits = 0;
  const lower = (node: EngineUVTextureMaterialExpression, depth: number): string => {
    if (++visits > 256 || depth > 16) fail('BUDGET', 'Texture WGSL tree exceeds256 nodes or depth16');
    switch (node.kind) {
      case 'float': return literal(node.value);
      case 'color': return 'vec3<f32>(' + node.linear.map(literal).join(',') + ')';
      case 'uniform': {
        const access = uniforms.get(node.name);
        if (access === undefined) fail('IR', 'Reconstructed texture material uniform layout is missing');
        return access;
      }
      case 'input': return node.name === 'uv_u' ? 'material_uv.x' : 'material_uv.y';
      case 'sample': {
        if (!samplerLayout.some(sampler => sampler.name === node.sampler))
          fail('IR', 'Reconstructed texture material sampler alias is missing');
        const u = lower(node.u, depth + 1), v = lower(node.v, depth + 1);
        // Unchanged original row order uses unchanged V; no transport flip here.
        return 'engine_uv_decode(textureSampleLevel(material_tex_0,material_sampler_0,clamp(vec2<f32>(' +
          u + ',' + v + '),vec2<f32>(0.0),vec2<f32>(1.0)),0.0).rgb)';
      }
      case 'unary': {
        const child = lower(node.value, depth + 1);
        return node.operator === '+' ? child : '(-' + child + ')';
      }
      case 'binary': return '(' + lower(node.left, depth + 1) + node.operator + lower(node.right, depth + 1) + ')';
      case 'call': return (node.name === 'mix' ? 'engine_uv_mix' : node.name) + '(' +
        node.args.map(argument => lower(argument, depth + 1)).join(',') + ')';
    }
  };
  const expression = 'clamp(' + lower(material.expression, 1) + ',vec3<f32>(0.0),vec3<f32>(1.0))';
  textBudget(expression);
  const result: LoweredEngineUVTextureMaterialWGSL = {
    format: 'barocss-gpu-engine-uv-texture-material-wgsl', version: 0,
    profile: 'engine-opaque-uv-texture-fragment-wgsl-v0', material, expression,
    declarations: DECLARATIONS, uniformLayout, uniformByteLength: 64,
    inputName: 'material_uv', samplerLayout,
  };
  resultBudget(result);
  return freezeGpuData(copyGpuData(result));
}
