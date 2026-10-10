import { GPUError } from './renderer.js';
import { prepareCompletePrimitiveFrameData } from './primitive-scene-renderer.js';
import type {
  PrimitiveSceneEntryV2, PrimitiveSceneFrameV0,
} from './primitive-scene-renderer.js';
import type { MeshMaterialBinding } from './mesh-material.js';
import type { MeshSceneBounds } from './mesh-scene-transform.js';
import type { Vec3 } from './scene.js';

export type PrimitiveSceneFrameProfile = 'qualified-v2' | 'viewport-v2';
export type PrimitiveSceneCpuFrameV0 = Omit<PrimitiveSceneFrameV0, 'particles'> & { particles: null };

/** Copied native authority and independently owned mutable execution views. */
export interface PreparedPrimitiveSceneFrameEntry {
  readonly entry: PrimitiveSceneEntryV2;
  readonly positions: Float32Array;
  readonly bounds: MeshSceneBounds;
  readonly normals?: Float32Array;
  readonly indices?: Uint16Array;
  readonly material?: MeshMaterialBinding;
}

/** CPU admission only. Future presentation must re-admit frame, never trust this wrapper. */
export interface PreparedPrimitiveSceneFrame {
  readonly format: 'barocss-gpu-primitive-frame-preflight';
  readonly version: 0;
  readonly profile: PrimitiveSceneFrameProfile;
  readonly frame: PrimitiveSceneCpuFrameV0;
  readonly primitives: readonly PreparedPrimitiveSceneFrameEntry[];
  readonly bounds: MeshSceneBounds | null;
  readonly bufferBytes: number;
}

const FRAME_FIELDS = ['version', 'scene', 'options', 'particles', 'materials'];
function check(value: unknown, message: string): asserts value {
  if (!value) throw new GPUError(message);
}

function frameRecord(input: unknown): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    'Primitive frame fields must be plain own data');
  const keys = Reflect.ownKeys(input), descriptors = Object.getOwnPropertyDescriptors(input);
  check(keys.length === FRAME_FIELDS.length && keys.every(key => typeof key === 'string'
    && FRAME_FIELDS.includes(key) && 'value' in descriptors[key] && descriptors[key].enumerable)
    && FRAME_FIELDS.every(key => Object.hasOwn(descriptors, key)),
  'Primitive frame fields are missing, unsupported or not own data');
  return Object.fromEntries(FRAME_FIELDS.map(key => [key, descriptors[key].value]));
}

// Admit length before enumerating or copying material entries. Pass this stable
// shallow array to the shared native/material provider, which owns deep admission.
function materialList(input: unknown): unknown[] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype,
    'Materials require plain dense array');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'length');
  check(descriptor && 'value' in descriptor && Number.isInteger(descriptor.value)
    && descriptor.value >= 0 && descriptor.value <= 4, 'Complete frame admits0..4 dense materials');
  const length = descriptor.value as number, keys = Reflect.ownKeys(input);
  check(keys.length === length + 1 && keys.every(key => key === 'length'
    || typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length),
  'Materials require dense own data without extra fields');
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const item = Object.getOwnPropertyDescriptor(input, String(index));
    check(item && 'value' in item && item.enumerable, 'Material entries must be own data');
    result.push(item.value);
  }
  return result;
}

function freezePlain<T>(value: T, visited = new WeakSet<object>()): T {
  if (value !== null && typeof value === 'object' && !ArrayBuffer.isView(value) && !visited.has(value)) {
    visited.add(value);
    for (const child of Object.values(value)) freezePlain(child, visited);
    Object.freeze(value);
  }
  return value;
}

/** Prepare one complete native frame without DOM, backend state or presentation. */
export function preparePrimitiveSceneFrame(
  input: unknown,
  profile: PrimitiveSceneFrameProfile = 'qualified-v2',
): PreparedPrimitiveSceneFrame {
  try {
    check(profile === 'qualified-v2' || profile === 'viewport-v2', 'Unsupported primitive frame profile');
    const data = frameRecord(input);
    check(data.version === 0, 'Only complete frame version0 is supported');
    check(data.particles === null, 'Primitive CPU preflight requires particles:null');
    const materials = materialList(data.materials);
    const admitted = prepareCompletePrimitiveFrameData({ ...data, materials }, profile === 'viewport-v2');
    const primitives: PreparedPrimitiveSceneFrameEntry[] = admitted.prepared.primitives.map(primitive => ({
      entry: primitive.entry as PrimitiveSceneEntryV2,
      positions: primitive.positions,
      bounds: primitive.bounds,
      ...(primitive.normals === undefined ? {} : { normals: primitive.normals }),
      ...(primitive.indices === undefined ? {} : { indices: primitive.indices }),
      ...(primitive.material === undefined ? {} : { material: primitive.material }),
    }));
    const frame: PrimitiveSceneCpuFrameV0 = {
      version: 0,
      scene: { version: 2, entries: primitives.map(primitive => primitive.entry) },
      options: admitted.prepared.options,
      particles: null,
      materials: admitted.materials,
    };
    let bounds: MeshSceneBounds | null = null, bufferBytes = 0;
    for (const primitive of primitives) {
      bufferBytes += primitive.positions.byteLength + (primitive.normals?.byteLength ?? 0)
        + (primitive.indices?.byteLength ?? 0);
      if (bounds === null) {
        bounds = { min: [...primitive.bounds.min] as Vec3, max: [...primitive.bounds.max] as Vec3 };
      } else {
        for (let axis = 0; axis < 3; axis++) {
          bounds.min[axis] = Math.min(bounds.min[axis], primitive.bounds.min[axis]);
          bounds.max[axis] = Math.max(bounds.max[axis], primitive.bounds.max[axis]);
        }
      }
    }
    return freezePlain({
      format: 'barocss-gpu-primitive-frame-preflight', version: 0, profile,
      frame, primitives, bounds, bufferBytes,
    } as PreparedPrimitiveSceneFrame);
  } catch (cause) {
    if (cause instanceof Error) throw cause;
    const error = new GPUError('Primitive frame preflight refused non-Error failure');
    Object.defineProperty(error, 'cause', { value: cause, enumerable: false });
    throw error;
  }
}
