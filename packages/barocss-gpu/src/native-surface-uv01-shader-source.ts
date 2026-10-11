import { prepareNativeSurfaceUV01MaterialBinding, NativeSurfaceUV01BindingError } from './native-surface-uv01-binding.js';
import type { NativeSurfaceUV01BindingRequest, PreparedNativeSurfaceUV01Binding } from './native-surface-uv01-binding.js';
import { validateMeshLighting } from './mesh-lighting.js';
import type { MeshLighting } from './mesh-lighting.js';
import { meshLightingShaders } from './mesh-shaders.js';
import type { SceneShaders } from './compiler.js';

export type NativeSurfaceUV01ShaderSourceCode = 'INPUT' | 'LIGHTING' | 'BINDING' | 'SHADER';
export class NativeSurfaceUV01ShaderSourceError extends Error {
 constructor(readonly code: NativeSurfaceUV01ShaderSourceCode, message: string, readonly start = 0, readonly end = 0, cause?: unknown) {
  super(message.slice(0, 1024), cause === undefined ? undefined : { cause });
  this.name = 'NativeSurfaceUV01ShaderSourceError';
 }
}
export interface NativeSurfaceUV01ShaderSourceRequest {
 format: 'barocss-gpu-native-surface-uv01-shader-request'; version: 0;
 binding: NativeSurfaceUV01BindingRequest; lighting: MeshLighting | null;
}
export interface PreparedNativeSurfaceUV01ShaderSource {
 format: 'barocss-gpu-native-surface-uv01-shader-source'; version: 0;
 profile: 'source0-native-opaque-uv01-shader-source-v0';
 request: NativeSurfaceUV01ShaderSourceRequest;
 binding: PreparedNativeSurfaceUV01Binding; shaders: SceneShaders;
}
function fail(code: NativeSurfaceUV01ShaderSourceCode, message: string): never {
 throw new NativeSurfaceUV01ShaderSourceError(code, message);
}
function inputRecord(input: unknown): Record<string, unknown> {
 if (!input || typeof input !== 'object') fail('INPUT', 'Native UV01 shader request requires own plain data');
 let array: boolean, prototype: object | null, keys: (string | symbol)[], descriptors: PropertyDescriptor[];
 const reflected = (cause: unknown): never => { throw new NativeSurfaceUV01ShaderSourceError('INPUT', 'Native UV01 shader request reflection refused', 0, 0, cause); };
 try { array = Array.isArray(input); prototype = Object.getPrototypeOf(input); } catch (cause) { return reflected(cause); }
 if (array || prototype !== Object.prototype) fail('INPUT', 'Native UV01 shader request requires own plain data');
 try { keys = Reflect.ownKeys(input); } catch (cause) { return reflected(cause); }
 const names = ['format', 'version', 'binding', 'lighting'];
 if (keys.length !== 4 || keys.some(key => typeof key !== 'string' || !names.includes(key)))
  fail('INPUT', 'Native UV01 shader request requires exactly four fields');
 try { descriptors = names.map(name => Object.getOwnPropertyDescriptor(input, name)!); } catch (cause) { return reflected(cause); }
 if (descriptors.some(d => !d || !d.enumerable || !('value' in d))) fail('INPUT', 'Native UV01 shader request refuses accessors or hidden data');
 return Object.fromEntries(names.map((name, index) => [name, descriptors[index].value]));
}
function replaceOnce(source: string, anchor: string, replacement: string): string {
 const at = source.indexOf(anchor);
 if (at < 0 || source.indexOf(anchor, at + anchor.length) !== -1) fail('SHADER', 'Trusted native mesh shader anchor must occur exactly once');
 return source.slice(0, at) + replacement + source.slice(at + anchor.length);
}
function bounded(source: string): string {
 if (source.length > 65536 || new TextEncoder().encode(source).length > 65536)
  fail('SHADER', 'Complete native UV01 shader source exceeds 64KiB');
 return source;
}
/** Trusted source construction only: no attribute upload, linked program, frame or graphics acceptance. */
export function prepareNativeSurfaceUV01ShaderSource(input: unknown): PreparedNativeSurfaceUV01ShaderSource {
 const data = inputRecord(input);
 if (data.format !== 'barocss-gpu-native-surface-uv01-shader-request' || data.version !== 0)
  fail('INPUT', 'Native UV01 shader request requires format/version0');
 let lighting: MeshLighting | null = null;
 if (data.lighting !== null) {
  try { lighting = validateMeshLighting(data.lighting); }
  catch (cause) { throw new NativeSurfaceUV01ShaderSourceError('LIGHTING', 'Actual native mesh lighting refused', 0, 0, cause); }
 }
 let binding: PreparedNativeSurfaceUV01Binding;
 try { binding = prepareNativeSurfaceUV01MaterialBinding(data.binding); }
 catch (cause) {
  throw new NativeSurfaceUV01ShaderSourceError('BINDING', 'Actual native UV01 source binding refused',
   cause instanceof NativeSurfaceUV01BindingError ? cause.start : 0, cause instanceof NativeSurfaceUV01BindingError ? cause.end : 0, cause);
 }
 const base = meshLightingShaders(lighting ?? undefined), lowered = binding.lowered;
 let vertex = replaceOnce(base.vertex, 'layout(location=1) in vec3 normal;',
  'layout(location=1) in vec3 normal;\nlayout(location=2) in vec2 native_surface_uv01;');
 vertex = replaceOnce(vertex, 'out vec3 worldNormal;', 'out vec3 worldNormal;\nout vec2 v_native_surface_uv01;');
 vertex = replaceOnce(vertex, 'worldNormal=normal;', 'worldNormal=normal;\n v_native_surface_uv01=native_surface_uv01;');
 let fragment = replaceOnce(base.fragment, 'in vec3 worldNormal;', 'in vec3 worldNormal;\n' + lowered.inputDeclarations);
 fragment = replaceOnce(fragment, 'uniform vec3 color;', 'uniform vec3 color;\n' + lowered.uniformDeclarations);
 fragment = replaceOnce(fragment, 'pow(color,vec3(2.2))', '(' + lowered.expression + ')');
 const shaders = Object.freeze({ vertex: bounded(vertex), fragment: bounded(fragment) });
 const effectiveBinding: NativeSurfaceUV01BindingRequest = Object.freeze({
  format: 'barocss-gpu-native-surface-uv01-binding-request', version: 0,
  geometry: binding.geometry.request, material: binding.material, uniforms: binding.uniforms,
 });
 const request: NativeSurfaceUV01ShaderSourceRequest = Object.freeze({
  format: 'barocss-gpu-native-surface-uv01-shader-request', version: 0, binding: effectiveBinding, lighting,
 });
 return Object.freeze({ format: 'barocss-gpu-native-surface-uv01-shader-source', version: 0,
  profile: 'source0-native-opaque-uv01-shader-source-v0', request, binding, shaders });
}
