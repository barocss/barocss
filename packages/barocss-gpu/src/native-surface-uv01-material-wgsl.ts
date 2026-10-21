import { MeshMaterialError, validateNativeSurfaceUV01MaterialIR } from './mesh-material.js';
import type { MeshMaterialUniform, NativeSurfaceUV01MaterialIR } from './mesh-material.js';
import { copyGpuData, freezeGpuData } from './gpu-data.js';
import { lowerNativeSurfaceUV01WGSLBody } from './native-surface-uv01-wgsl-body.js';

export interface LoweredNativeSurfaceUV01MaterialWGSL {
  readonly format: 'barocss-gpu-native-surface-uv01-material-wgsl';
  readonly version: 0;
  readonly profile: 'native-surface-opaque-uv01-fragment-wgsl-v0';
  readonly material: NativeSurfaceUV01MaterialIR;
  readonly expression: string;
  readonly declarations: string;
  readonly uniformLayout: (MeshMaterialUniform & { index: number; byteOffset: number; access: string })[];
  readonly uniformByteLength: 64;
  readonly input: {
    name: 'native_surface_uv01'; type: 'vec2<f32>'; domain: 'native-surface-normalized-uv01';
  };
}

/** Count the complete signed finite representation before its final owned copy. */
function resultBudget(result: LoweredNativeSurfaceUV01MaterialWGSL): void {
  const encoder = new TextEncoder();
  let utf16 = 0, utf8 = 0;
  const append = (text: string): void => {
    utf16 += text.length;
    if (utf16 > 2097152) throw new MeshMaterialError('BUDGET', 'Complete native UV01 WGSL result exceeds2MiB UTF16');
    utf8 += encoder.encode(text).length;
    if (utf8 > 2097152) throw new MeshMaterialError('BUDGET', 'Complete native UV01 WGSL result exceeds2MiB UTF8');
  };
  const visit = (value: unknown): void => {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new MeshMaterialError('BUDGET', 'Complete native UV01 result requires finite Number data');
      append(Object.is(value, -0) ? '-0' : JSON.stringify(value)); return;
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
      append(JSON.stringify(value)); return;
    }
    if (typeof value !== 'object') throw new MeshMaterialError('BUDGET', 'Complete native UV01 result requires plain data');
    if (Array.isArray(value)) {
      append('['); value.forEach((child, index) => { if (index) append(','); visit(child); }); append(']'); return;
    }
    append('{'); Object.entries(value).forEach(([key, child], index) => {
      if (index) append(','); append(JSON.stringify(key)); append(':'); visit(child);
    }); append('}');
  };
  visit(result);
}

/** Reconstruct the original native UV01 source once; no frame or device work. */
export function lowerNativeSurfaceUV01MaterialWGSL(input: unknown, options: { srgb?: boolean } = {}): LoweredNativeSurfaceUV01MaterialWGSL {
  const material = validateNativeSurfaceUV01MaterialIR(input);
  // (`srgb`: colour literals by the exact sRGB decode, for the viewer: lowerMeshMaterialWGSL's option.)
  const lowered = lowerNativeSurfaceUV01WGSLBody(material, options.srgb === true);
  const result: LoweredNativeSurfaceUV01MaterialWGSL = {
    format: 'barocss-gpu-native-surface-uv01-material-wgsl', version: 0,
    profile: 'native-surface-opaque-uv01-fragment-wgsl-v0', material, ...lowered,
    input: { name: 'native_surface_uv01', type: 'vec2<f32>', domain: 'native-surface-normalized-uv01' },
  };
  resultBudget(result);
  return freezeGpuData(copyGpuData(result));
}
