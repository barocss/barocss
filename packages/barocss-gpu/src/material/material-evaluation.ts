import { BarocssError, refusalText } from '../core/barocss-error.js';
import {
  MeshMaterialError, validateMeshMaterialBinding,
  validateEngineUVMaterialBinding, validateEngineUVRepeatingMaterialBinding, validateDiscreteMeshMaterialIR,
} from './mesh-material.js';
import type {
  MeshMaterialIR, EngineUVMaterialIR, EngineUVRepeatingMaterialIR,
  EngineUVRepeatingMaterialExpression, DiscreteMeshMaterialExpression, DiscreteMeshMaterialIR,
} from './mesh-material.js';

export const AuthoredMaterialEvaluationDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', BUDGET: 'BUDGET', PROFILE: 'PROFILE', MATERIAL: 'MATERIAL',
  UNIFORM: 'UNIFORM', UV: 'UV', NUMERICAL: 'NUMERICAL',
} as const);
export type AuthoredMaterialEvaluationDiagnosticCode =
  typeof AuthoredMaterialEvaluationDiagnosticCode[keyof typeof AuthoredMaterialEvaluationDiagnosticCode];
export class AuthoredMaterialEvaluationError extends BarocssError {
  constructor(readonly code: AuthoredMaterialEvaluationDiagnosticCode, message: string, readonly cause?: unknown) {
    super(code, message, { maxLength: 1024 }); this.name = 'AuthoredMaterialEvaluationError';
  }
}
type Material = MeshMaterialIR | EngineUVMaterialIR | EngineUVRepeatingMaterialIR;
type Frozen<T> = T extends object ? { readonly [K in keyof T]: Frozen<T[K]> } : T;
export type AuthoredMaterialRequest =
  | { material: MeshMaterialIR; uniforms: Record<string, number>; uv?: never }
  | { material: EngineUVMaterialIR | EngineUVRepeatingMaterialIR; uniforms: Record<string, number>; uv: [number, number] };
export interface AuthoredMaterialSample {
  readonly format: 'barocss-gpu-authored-material-sample';
  readonly version: 0;
  readonly profile: 'binary64-linear-rgb-v0';
  readonly colorSpace: 'linear-rgb';
  readonly uvUnit: 'dimensionless';
  readonly source: string;
  readonly material: Frozen<Material>;
  readonly uniforms: Readonly<Record<string, number>>;
  readonly uv: readonly [number, number] | null;
  readonly linearRGB: readonly [number, number, number];
}
const CODE = AuthoredMaterialEvaluationDiagnosticCode;
function check(condition: unknown, code: AuthoredMaterialEvaluationDiagnosticCode, message: string): asserts condition {
  if (!condition) throw new AuthoredMaterialEvaluationError(code, message);
}
function reflection<T>(read: () => T): T {
  try { return read(); } catch (cause) {
    if (cause instanceof AuthoredMaterialEvaluationError) throw cause;
    throw new AuthoredMaterialEvaluationError(CODE.INPUT, 'Material request own-data reflection refused', cause);
  }
}
function request(input: unknown): Record<string, unknown> {
  return reflection(() => {
    check(input !== null && typeof input === 'object'
      && [Object.prototype, null].includes(Object.getPrototypeOf(input)), CODE.INPUT, 'Material request requires plain own data');
    const keys = Reflect.ownKeys(input), descriptors = Object.getOwnPropertyDescriptors(input);
    check(keys.length >= 2 && keys.length <= 3 && keys.every(key => key === 'material' || key === 'uniforms' || key === 'uv')
      && Object.hasOwn(descriptors, 'material') && Object.hasOwn(descriptors, 'uniforms'), CODE.INPUT, 'Material request requires material/uniforms and optional uv only');
    const data: Record<string, unknown> = {};
    for (const key of keys as string[]) {
      const descriptor = descriptors[key];
      check('value' in descriptor && descriptor.enumerable, CODE.INPUT, 'Material request refuses accessors or hidden data');
      data[key] = descriptor.value;
    }
    return data;
  });
}
function profile(input: unknown): 'mesh' | 'uv' | 'repeating' {
  return reflection(() => {
    check(input !== null && typeof input === 'object'
      && [Object.prototype, null].includes(Object.getPrototypeOf(input)), CODE.INPUT, 'Material requires a plain own header');
    const values = ['format', 'version', 'profile'].map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      check(descriptor && 'value' in descriptor && descriptor.enumerable, CODE.INPUT, 'Material header requires enumerable data');
      return descriptor.value;
    });
    check(values[1] === 0, CODE.PROFILE, 'Unsupported material version');
    if (values[0] === 'barocss-gpu-mesh-material' && values[2] === 'mesh-opaque-fragment-v0') return 'mesh';
    if (values[0] === 'barocss-gpu-engine-uv-material' && values[2] === 'engine-opaque-uv-fragment-v0') return 'uv';
    if (values[0] === 'barocss-gpu-engine-uv-repeating-material' && values[2] === 'engine-opaque-uv-repeating-fragment-v0') return 'repeating';
    throw new AuthoredMaterialEvaluationError(CODE.PROFILE, 'Unsupported material format/profile');
  });
}
function inspectUV(input: unknown): [number, number] {
  return reflection(() => {
    check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype, CODE.UV, 'UV requires a current-realm dense tuple');
    const length = Object.getOwnPropertyDescriptor(input, 'length');
    check(length && 'value' in length && length.value === 2, CODE.UV, 'UV requires exactly two values');
    const keys = Reflect.ownKeys(input);
    check(keys.length === 3 && keys.every(key => key === '0' || key === '1' || key === 'length'), CODE.UV, 'UV refuses extra, hidden or symbol fields');
    return [0, 1].map(index => {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      check(descriptor && 'value' in descriptor && descriptor.enumerable, CODE.UV, 'UV refuses holes or accessors');
      const value = descriptor.value;
      check(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1000, CODE.UV, 'UV must be finite within -1000..1000');
      return value;
    }) as [number, number];
  });
}
type EvaluationExpression = EngineUVRepeatingMaterialExpression | DiscreteMeshMaterialExpression;
type Value = number | [number, number, number];
function finite(value: number): number {
  check(Number.isFinite(value) && Math.abs(value) <= 1e6, CODE.NUMERICAL, 'Material intermediate exceeds its finite range');
  return value;
}
function scalar(value: Value): number {
  check(typeof value === 'number', CODE.NUMERICAL, 'Canonical scalar expression required');
  return finite(value);
}
function color(value: Value): [number, number, number] {
  check(Array.isArray(value) && value.length === 3, CODE.NUMERICAL, 'Canonical color expression required');
  return value.map(finite) as [number, number, number];
}
function evaluate(expression: EvaluationExpression, uniforms: Record<string, number>, uv: [number, number] | null): [number, number, number] {
  let visits = 0;
  function visit(node: EvaluationExpression, depth: number): Value {
    check(++visits <= 256 && depth <= 16, CODE.BUDGET, 'Canonical expression traversal exceeds limits');
    switch (node.kind) {
      case 'float': return finite(node.value);
      case 'color': return color([...node.linear]);
      case 'uniform':
        check(Object.hasOwn(uniforms, node.name), CODE.UNIFORM, 'Resolved uniform is missing');
        return finite(uniforms[node.name]);
      case 'input':
        check(uv !== null, CODE.UV, 'Canonical UV input requires explicit UV');
        return finite(uv[node.name === 'uv_u' ? 0 : 1]);
      case 'select': {
        const value = scalar(visit(node.value, depth + 1));
        const threshold = scalar(visit(node.threshold, depth + 1));
        // Both branches were admitted during source reconstruction. Only the
        // chosen branch executes, preserving its original Number coefficients.
        return visit(value < threshold ? node.below : node.otherwise, depth + 1);
      }
      case 'unary': {
        const value = scalar(visit(node.value, depth + 1));
        return finite(node.operator === '-' ? -value : +value);
      }
      case 'binary': {
        const left = scalar(visit(node.left, depth + 1)), right = scalar(visit(node.right, depth + 1));
        return finite(node.operator === '+' ? left + right : node.operator === '-' ? left - right : left * right);
      }
      case 'call': {
        // Source expansions remain canonical nodes; do not reinterpret spellings.
        const args = node.args.map(arg => visit(arg, depth + 1));
        if (node.name === 'sin') return finite(Math.sin(scalar(args[0])));
        if (node.name === 'cos') return finite(Math.cos(scalar(args[0])));
        if (node.name === 'fract') {
          const value = scalar(args[0]); return finite(value - Math.floor(value));
        }
        if (node.name === 'clamp') return finite(Math.min(Math.max(scalar(args[0]), scalar(args[1])), scalar(args[2])));
        if (node.name === 'mix') {
          const a = color(args[0]), b = color(args[1]), ratio = Math.min(Math.max(scalar(args[2]), 0), 1);
          return a.map((value, index) => finite(finite(value * (1 - ratio)) + finite(b[index] * ratio))) as [number, number, number];
        }
        throw new AuthoredMaterialEvaluationError(CODE.NUMERICAL, 'Unsupported canonical call');
      }
    }
  }
  return color(visit(expression, 1)).map(value => {
    const clamped = Math.min(Math.max(value, 0), 1); return clamped === 0 ? 0 : clamped;
  }) as [number, number, number];
}
function freeze<T>(value: T): Frozen<T> {
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value as Frozen<T>;
}
/** CPU binary64 authored color only; no lighting, gamma, texture or rendered pixels. */
export function evaluateAuthoredMaterial(input: unknown): AuthoredMaterialSample {
  const data = request(input), kind = profile(data.material);
  const uv = kind === 'mesh' ? null : inspectUV(data.uv);
  check(kind !== 'mesh' || !Object.hasOwn(data, 'uv'), CODE.UV, 'Legacy material forbids UV');
  reflection(() => {
    if (data.uniforms !== null && (typeof data.uniforms === 'object' || typeof data.uniforms === 'function')) {
      check(!Object.getOwnPropertyDescriptor(data.uniforms, '__proto__'), CODE.UNIFORM, 'Unsafe uniform override name');
    }
  });
  let binding: { material: Material; uniforms: Record<string, number> };
  try {
    const candidate = { material: data.material, uniforms: data.uniforms };
    binding = kind === 'mesh' ? validateMeshMaterialBinding(candidate)
      : kind === 'uv' ? validateEngineUVMaterialBinding(candidate) : validateEngineUVRepeatingMaterialBinding(candidate);
  } catch (cause) {
    const code = cause instanceof MeshMaterialError && cause.code === 'UNIFORM' ? CODE.UNIFORM
      : cause instanceof MeshMaterialError && cause.code === 'BUDGET' ? CODE.BUDGET : CODE.MATERIAL;
    throw new AuthoredMaterialEvaluationError(code, cause instanceof Error ? refusalText(cause) : 'Material reconstruction refused', cause);
  }
  for (const uniform of binding.material.uniforms) {
    check(uniform.name !== '__proto__' && Object.hasOwn(binding.uniforms, uniform.name)
      && typeof binding.uniforms[uniform.name] === 'number' && Number.isFinite(binding.uniforms[uniform.name]), CODE.UNIFORM, 'Resolved uniforms require safe own finite values');
  }
  const linearRGB = evaluate(binding.material.expression, binding.uniforms, uv);
  return freeze({ format: 'barocss-gpu-authored-material-sample' as const, version: 0 as const,
    profile: 'binary64-linear-rgb-v0' as const, colorSpace: 'linear-rgb' as const, uvUnit: 'dimensionless' as const,
    source: binding.material.source, material: binding.material, uniforms: binding.uniforms, uv, linearRGB }) as AuthoredMaterialSample;
}


export interface DiscreteAuthoredMaterialRequest {
  material: DiscreteMeshMaterialIR;
  uniforms: Record<string, number>;
}
export interface DiscreteAuthoredMaterialSample {
  readonly format: 'barocss-gpu-discrete-authored-material-sample';
  readonly version: 0;
  readonly profile: 'binary64-discrete-linear-rgb-v0';
  readonly colorSpace: 'linear-rgb';
  readonly source: string;
  readonly material: Frozen<DiscreteMeshMaterialIR>;
  readonly uniforms: Readonly<Record<string, number>>;
  readonly linearRGB: readonly [number, number, number];
}
/** Only actual reflection belongs in this catch; local checks stay outside. */
function discreteReflection<T>(read: () => T): T {
  try { return read(); }
  catch (cause) { throw new AuthoredMaterialEvaluationError(CODE.INPUT, 'Discrete material own-data reflection refused', cause); }
}
function discreteRecord(input: unknown, code: AuthoredMaterialEvaluationDiagnosticCode, maximum: number): Record<string, unknown> {
  check(input !== null && typeof input === 'object', code, 'Discrete material requires ordinary own data');
  const data = discreteReflection(() => ({
    array: Array.isArray(input), proto: Object.getPrototypeOf(input),
    keys: Reflect.ownKeys(input), descriptors: Object.getOwnPropertyDescriptors(input),
  }));
  check(!data.array && data.proto === Object.prototype, code, 'Discrete material requires current-realm ordinary records');
  check(data.keys.length <= maximum, code, 'Discrete material record exceeds its field limit');
  check(data.keys.every(key => typeof key === 'string' && Object.hasOwn(data.descriptors, key) && 'value' in data.descriptors[key] && data.descriptors[key].enumerable), code, 'Discrete material refuses accessors, hidden or symbol fields');
  return Object.fromEntries((data.keys as string[]).map(key => [key, data.descriptors[key].value]));
}
function discreteHeader(input: unknown): void {
  check(input !== null && typeof input === 'object', CODE.INPUT, 'Discrete material requires an ordinary header');
  const header = discreteReflection(() => ({
    array: Array.isArray(input), proto: Object.getPrototypeOf(input),
    descriptors: ['format', 'version', 'profile'].map(key => Object.getOwnPropertyDescriptor(input, key)),
  }));
  check(!header.array && header.proto === Object.prototype, CODE.INPUT, 'Discrete material requires a current-realm ordinary header');
  check(header.descriptors.every(descriptor => descriptor && 'value' in descriptor && descriptor.enumerable), CODE.INPUT, 'Discrete material header requires own enumerable data');
  const values = header.descriptors.map(descriptor => descriptor!.value);
  check(values[0] === 'barocss-gpu-discrete-mesh-material' && values[1] === 0 && values[2] === 'mesh-opaque-discrete-fragment-v0', CODE.PROFILE, 'Unsupported discrete material format/version/profile');
}
/** CPU binary64 palette sampling only; no binding, lighting, UV or GPU pixels. */
export function evaluateDiscreteAuthoredMaterial(input: unknown): DiscreteAuthoredMaterialSample {
  const data = discreteRecord(input, CODE.INPUT, 2);
  check(Object.keys(data).length === 2 && Object.hasOwn(data, 'material') && Object.hasOwn(data, 'uniforms'), CODE.INPUT, 'Discrete request requires exactly material/uniforms');
  discreteHeader(data.material);
  const overrides = discreteRecord(data.uniforms, CODE.UNIFORM, 16);
  for (const [name, value] of Object.entries(overrides)) {
    check(/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name) && name !== '__proto__', CODE.UNIFORM, 'Discrete uniform name is invalid or unsafe');
    check(typeof value === 'number' && Number.isFinite(value), CODE.UNIFORM, 'Discrete uniform override requires a finite Number');
  }
  let material: DiscreteMeshMaterialIR;
  try { material = validateDiscreteMeshMaterialIR(data.material); }
  catch (cause) {
    const code = cause instanceof MeshMaterialError && cause.code === 'BUDGET' ? CODE.BUDGET : CODE.MATERIAL;
    throw new AuthoredMaterialEvaluationError(code, cause instanceof MeshMaterialError ? refusalText(cause) : 'Discrete material reconstruction refused', cause);
  }
  check(Object.keys(overrides).every(name => material.uniforms.some(uniform => uniform.name === name)), CODE.UNIFORM, 'Unknown discrete uniform override');
  const uniforms = Object.fromEntries(material.uniforms.map(uniform => {
    check(uniform.name !== '__proto__', CODE.UNIFORM, 'Unsafe declared discrete uniform name');
    const value = Object.hasOwn(overrides, uniform.name) ? overrides[uniform.name] : uniform.default;
    check(typeof value === 'number' && Number.isFinite(value) && value >= uniform.min && value <= uniform.max, CODE.UNIFORM, 'Discrete uniform is outside its declared finite range');
    return [uniform.name, value === 0 ? 0 : value];
  }));
  const linearRGB = evaluate(material.expression, uniforms, null);
  const result: DiscreteAuthoredMaterialSample = { format: 'barocss-gpu-discrete-authored-material-sample', version: 0,
    profile: 'binary64-discrete-linear-rgb-v0', colorSpace: 'linear-rgb', source: material.source, material, uniforms, linearRGB };
  const text = JSON.stringify(result);
  check(text.length <= 2097152 && new TextEncoder().encode(text).length <= 2097152, CODE.BUDGET, 'Discrete material sample exceeds 2MiB');
  return freeze(result);
}
