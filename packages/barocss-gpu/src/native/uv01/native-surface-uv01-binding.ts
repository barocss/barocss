import { BarocssError } from '../../core/barocss-error.js';
import { validateNativeSurfaceUV01MaterialIR, lowerNativeSurfaceUV01Material, MeshMaterialError } from '../../material/mesh-material.js';
import type { NativeSurfaceUV01MaterialIR, LoweredNativeSurfaceUV01Material } from '../../material/mesh-material.js';
import { prepareNativeSurfaceUV01Geometry, NativeSurfaceUV01GeometryError } from './native-surface-uv01-geometry.js';
import type { NativeSurfaceUV01GeometryRequest, PreparedNativeSurfaceUV01Geometry } from './native-surface-uv01-geometry.js';

export type NativeSurfaceUV01BindingCode = 'INPUT' | 'MATERIAL' | 'UNIFORM' | 'GEOMETRY';
export class NativeSurfaceUV01BindingError extends BarocssError {
 constructor(readonly code: NativeSurfaceUV01BindingCode, message: string, readonly start = 0, readonly end = 0, cause?: unknown) {
  super(code, message, cause === undefined ? { maxLength: 1024 } : { cause, maxLength: 1024 });
  this.name = 'NativeSurfaceUV01BindingError';
 }
}
export interface NativeSurfaceUV01BindingRequest {
 format: 'barocss-gpu-native-surface-uv01-binding-request'; version: 0;
 geometry: NativeSurfaceUV01GeometryRequest; material: NativeSurfaceUV01MaterialIR; uniforms: Record<string, number>;
}
export interface PreparedNativeSurfaceUV01Binding {
 format: 'barocss-gpu-native-surface-uv01-binding'; version: 0; profile: 'source0-surface-opaque-uv01-binding-v0';
 geometry: PreparedNativeSurfaceUV01Geometry; material: NativeSurfaceUV01MaterialIR;
 uniforms: Record<string, number>; lowered: LoweredNativeSurfaceUV01Material;
}
function reject(code: NativeSurfaceUV01BindingCode, message: string): never {
 throw new NativeSurfaceUV01BindingError(code, message);
}
/** Snapshot only a bounded own record; no caller value coercion or accessor invocation. */
function record(input: unknown, code: 'INPUT' | 'UNIFORM', names?: string[]): Record<string, unknown> {
 if (!input || typeof input !== 'object') reject(code, 'Native Surface UV01 binding requires an own plain record');
 let array: boolean, prototype: object | null, keys: (string | symbol)[], descriptors: PropertyDescriptor[];
 const reflected = (cause: unknown): never => { throw new NativeSurfaceUV01BindingError(code, 'Native Surface UV01 binding own-data reflection refused', 0, 0, cause); };
 try { array = Array.isArray(input); prototype = Object.getPrototypeOf(input); } catch (cause) { return reflected(cause); }
 if (array || prototype !== Object.prototype) reject(code, 'Native Surface UV01 binding requires an own plain record');
 try { keys = Reflect.ownKeys(input); } catch (cause) { return reflected(cause); }
 if (names ? keys.length !== names.length || keys.some(key => typeof key !== 'string' || !names.includes(key)) :
     keys.length > 16 || keys.some(key => typeof key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(key)))
  reject(code, names ? 'Native Surface UV01 binding requires exactly five fields' : 'Native Surface UV01 uniform record exceeds declared name limits');
 try { descriptors = keys.map(key => Object.getOwnPropertyDescriptor(input, key)!); } catch (cause) { return reflected(cause); }
 if (descriptors.some(d => !d || !d.enumerable || !('value' in d))) reject(code, 'Native Surface UV01 binding refuses accessors or hidden data');
 return Object.fromEntries(keys.map((key, index) => [key, descriptors[index].value]));
}
/** CPU association only; does not admit a frame, external namespace, native shader or GPU resource. */
export function prepareNativeSurfaceUV01MaterialBinding(input: unknown): PreparedNativeSurfaceUV01Binding {
 const data = record(input, 'INPUT', ['format', 'version', 'geometry', 'material', 'uniforms']);
 if (data.format !== 'barocss-gpu-native-surface-uv01-binding-request' || data.version !== 0)
  reject('INPUT', 'Native Surface UV01 binding requires format/version0');
 const supplied = record(data.uniforms, 'UNIFORM');
 for (const name of Object.keys(supplied)) {
  const value = supplied[name];
  if (typeof value !== 'number' || !Number.isFinite(value)) reject('UNIFORM', 'Native Surface UV01 uniform values must be finite numbers');
  supplied[name] = value === 0 ? 0 : value;
 }
 let material: NativeSurfaceUV01MaterialIR, lowered: LoweredNativeSurfaceUV01Material;
 try {
  material = validateNativeSurfaceUV01MaterialIR(data.material);
  // Public lowering intentionally reconstructs the fresh canonical IR again: TWO snapshots/compiles.
  lowered = lowerNativeSurfaceUV01Material(material);
 } catch (cause) {
  throw new NativeSurfaceUV01BindingError('MATERIAL', 'Native Surface UV01 material refused',
   cause instanceof MeshMaterialError ? cause.start : 0, cause instanceof MeshMaterialError ? cause.end : 0, cause);
 }
 if (Object.keys(supplied).some(name => !material.uniforms.some(uniform => uniform.name === name)))
  reject('UNIFORM', 'Native Surface UV01 binding has an undeclared uniform');
 const uniforms = Object.fromEntries(material.uniforms.map(uniform => {
  const value = Object.hasOwn(supplied, uniform.name) ? supplied[uniform.name] as number : uniform.default;
  if (value < uniform.min || value > uniform.max) reject('UNIFORM', 'Native Surface UV01 uniform ' + uniform.name + ' is outside its declared range');
  return [uniform.name, value === 0 ? 0 : value];
 }));
 let geometry: PreparedNativeSurfaceUV01Geometry;
 try { geometry = prepareNativeSurfaceUV01Geometry(data.geometry); }
 catch (cause) {
  throw new NativeSurfaceUV01BindingError('GEOMETRY', 'Native Surface UV01 geometry refused',
   cause instanceof NativeSurfaceUV01GeometryError ? cause.start : 0, cause instanceof NativeSurfaceUV01GeometryError ? cause.end : 0, cause);
 }
 return Object.freeze({ format: 'barocss-gpu-native-surface-uv01-binding', version: 0, profile: 'source0-surface-opaque-uv01-binding-v0',
  geometry, material, uniforms: Object.freeze(uniforms), lowered });
}
