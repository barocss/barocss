import { compileCadModel, surfaceDomain, tessellateSurface } from '@barocss/cad';
import type { Model, Surface, PreviewPacket, ApproximationReport } from '@barocss/cad';

export type NativeSurfaceUV01GeometryCode = 'INPUT' | 'BUDGET' | 'SOURCE' | 'SELECTOR' | 'NATIVE' | 'NORMALIZATION';
export class NativeSurfaceUV01GeometryError extends Error {
 constructor(readonly code: NativeSurfaceUV01GeometryCode, message: string, readonly start = 0, readonly end = 0, cause?: unknown) {
  super(message.slice(0, 1024), cause === undefined ? undefined : { cause });
  this.name = 'NativeSurfaceUV01GeometryError';
 }
}
export interface NativeSurfaceUV01GeometryRequest {
 format: 'barocss-gpu-native-surface-uv01-request'; version: 0; sourceVersion: 0;
 source: string; surfaceId: string; countU: number; countV: number; revision: number;
}
export interface PreparedNativeSurfaceUV01Geometry {
 format: 'barocss-gpu-native-surface-uv01-geometry'; version: 0; profile: 'source0-surface-d0-uv01-v0';
 request: NativeSurfaceUV01GeometryRequest; model: Model; selectedObjectIndex: number;
 domain: { u: [number, number]; v: [number, number] };
 preview: { packet: PreviewPacket; report: ApproximationReport };
 normalizedParameters: number[]; uv01: Float32Array;
}
function reject(code: NativeSurfaceUV01GeometryCode, message: string): never {
 throw new NativeSurfaceUV01GeometryError(code, message);
}
/** Called only on our scalar request and fresh trusted native outputs; typed views remain owned and mutable. */
function freeze<T>(value: T): T {
 if (value && typeof value === 'object' && !ArrayBuffer.isView(value) && !Object.isFrozen(value)) {
  Object.values(value).forEach(freeze); Object.freeze(value);
 }
 return value;
}
function request(input: unknown): NativeSurfaceUV01GeometryRequest {
 const names = ['format', 'version', 'sourceVersion', 'source', 'surfaceId', 'countU', 'countV', 'revision'];
 if (!input || typeof input !== 'object') reject('INPUT', 'Native Surface UV01 request requires an own plain record');
 let array: boolean, prototype: object | null, keys: (string | symbol)[], descriptors: Record<string, PropertyDescriptor>;
 const reflected = (cause: unknown): never => { throw new NativeSurfaceUV01GeometryError('INPUT', 'Native Surface UV01 request reflection refused', 0, 0, cause); };
 try { array = Array.isArray(input); prototype = Object.getPrototypeOf(input); } catch (cause) { return reflected(cause); }
 if (array || prototype !== Object.prototype) reject('INPUT', 'Native Surface UV01 request requires an own plain record');
 try { keys = Reflect.ownKeys(input); } catch (cause) { return reflected(cause); }
 if (keys.length !== names.length || keys.some(key => typeof key !== 'string' || !names.includes(key)))
  reject('INPUT', 'Native Surface UV01 request requires exactly eight fields');
 try { descriptors = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(input, name)!])); }
 catch (cause) { return reflected(cause); }
 if (names.some(name => !descriptors[name] || !descriptors[name].enumerable || !('value' in descriptors[name])))
  reject('INPUT', 'Native Surface UV01 request refuses accessors or hidden data');
 const data = Object.fromEntries(names.map(name => [name, descriptors[name].value]));
 if (data.format !== 'barocss-gpu-native-surface-uv01-request' || data.version !== 0 || data.sourceVersion !== 0)
  reject('INPUT', 'Native Surface UV01 request requires format/version/sourceVersion0');
 if (typeof data.source !== 'string') reject('INPUT', 'Native Surface UV01 source must be text');
 if (data.source.length > 65536 || new TextEncoder().encode(data.source).length > 65536)
  reject('BUDGET', 'Native Surface UV01 source exceeds 64KiB');
 if (typeof data.surfaceId !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(data.surfaceId))
  reject('INPUT', 'Native Surface UV01 selector requires ASCII1..64');
 if (!Number.isInteger(data.countU) || data.countU < 2 || data.countU > 64 ||
     !Number.isInteger(data.countV) || data.countV < 2 || data.countV > 64 ||
     !Number.isInteger(data.revision) || data.revision < 0 || data.revision > 2147483647)
  reject('INPUT', 'Native Surface UV01 counts require 2..64 and revision 0..2147483647 integers');
 return { format: 'barocss-gpu-native-surface-uv01-request', version: 0, sourceVersion: 0,
  source: data.source, surfaceId: data.surfaceId, countU: data.countU, countV: data.countV,
  revision: data.revision === 0 ? 0 : data.revision };
}
/** Reconstruct original source authority before deriving normalized display coordinates. No material/frame/GL admission. */
export function prepareNativeSurfaceUV01Geometry(input: unknown): PreparedNativeSurfaceUV01Geometry {
 const owned = request(input);
 let compiled: ReturnType<typeof compileCadModel>;
 try { compiled = compileCadModel(owned.source, { sourceVersion: 0 }); }
 catch (cause) { throw new NativeSurfaceUV01GeometryError('SOURCE', 'Native Surface source compilation failed', 0, 0, cause); }
 if (!compiled.ok) {
  const diagnostics = freeze(compiled.diagnostics), first = diagnostics[0];
  throw new NativeSurfaceUV01GeometryError('SOURCE', first?.message ?? 'Native Surface source compilation refused', first?.range.start ?? 0, first?.range.end ?? 0, diagnostics);
 }
 const model = compiled.model;
 if (model.objects.length < 1 || model.objects.length > 16) reject('BUDGET', 'Native Surface UV01 full Model requires 1..16 objects');
 const selectedObjectIndex = model.objects.findIndex(object => object.id === owned.surfaceId);
 if (selectedObjectIndex < 0 || model.objects[selectedObjectIndex].kind !== 'surface')
  reject('SELECTOR', 'Native Surface UV01 selector must name a Surface in the complete Model');
 const surface = model.objects[selectedObjectIndex] as Surface;
 if (surface.degreeU < 1 || surface.degreeU > 5 || surface.degreeV < 1 || surface.degreeV > 5 ||
     surface.controlPoints.length < 2 || surface.controlPoints.length > 16 ||
     surface.controlPoints.some(row => row.length < 2 || row.length > 16))
  reject('BUDGET', 'Native Surface UV01 selected degree requires 1..5 and grid 2..16 per axis');
 let domain: PreparedNativeSurfaceUV01Geometry['domain'];
 try { const native = surfaceDomain(surface); domain = { u: [...native.u], v: [...native.v] }; }
 catch (cause) { throw new NativeSurfaceUV01GeometryError('NATIVE', 'Native Surface domain refused', 0, 0, cause); }
 const widths = [domain.u[1] - domain.u[0], domain.v[1] - domain.v[0]];
 if (![...domain.u, ...domain.v].every(Number.isFinite) || widths.some(width => !Number.isFinite(width) || width <= 0))
  reject('NORMALIZATION', 'Native Surface UV01 domain requires finite positive represented widths');
 let preview: PreparedNativeSurfaceUV01Geometry['preview'];
 try { preview = tessellateSurface(surface, { countU: owned.countU, countV: owned.countV, revision: owned.revision }); }
 catch (cause) { throw new NativeSurfaceUV01GeometryError('NATIVE', 'Native Surface D0 preview refused', 0, 0, cause); }
 const vertexCount = owned.countU * owned.countV;
 if (preview.packet.parameters.length !== 2 * vertexCount)
  reject('NORMALIZATION', 'Native Surface UV01 parameter count does not match the sampled packet');
 const normalizedParameters = preview.packet.parameters.map((value, index) => {
  const axis = index % 2, endpoints = axis === 0 ? domain.u : domain.v;
  const normalized = (value - endpoints[0]) / widths[axis];
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1)
   reject('NORMALIZATION', 'Native Surface UV01 sampled parameter is outside its original domain');
  return normalized === 0 ? 0 : normalized;
 });
 // Normalize in Number first. This rounding may coalesce interior values or round them to endpoints.
 const uv01 = Float32Array.from(normalizedParameters);
 return freeze({ format: 'barocss-gpu-native-surface-uv01-geometry', version: 0, profile: 'source0-surface-d0-uv01-v0',
  request: owned, model, selectedObjectIndex, domain, preview, normalizedParameters, uv01 });
}
