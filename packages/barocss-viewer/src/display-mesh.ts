/** Proposed Viewer boundary. Render-only copied triangles; no native surface/UV authority. */
export interface ViewerDisplayMeshInputV0 {
  version: 0;
  sourceFrame: 'right-handed-z-up';
  sourceUnit: 'mm';
  revision: number;
  bodies: readonly {
    bodyId: string;
    positions: Float32Array | Float64Array;
    normals: Float32Array;
    indices: Uint32Array;
  }[];
}
export interface ViewerDisplayMeshBody {
  bodyId: string;
  positions: number[];
  normals: number[];
  indices: number[];
}
export interface ViewerDisplayMeshStateV0 {
  version: 0;
  revision: number;
  authority: 'approximate-display-only';
  sourceFrame: 'right-handed-z-up';
  displayFrame: 'right-handed-y-up';
  bodies: ViewerDisplayMeshBody[];
  boundsScene: { min: [number, number, number]; max: [number, number, number] };
}
export const DISPLAY_MESH_LIMITS = Object.freeze({ bodies: 4, vertices: 4096, indices: 24576 });
function requireValue(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function ownData(value: unknown, keys: string[], label: string): void {
  requireValue(value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype, `${label} must be plain data`);
  requireValue(Reflect.ownKeys(value).length === keys.length && keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable && 'value' in descriptor;
  }), `${label} requires exact own data fields`);
}
export function prepareViewerDisplayMeshes(input: ViewerDisplayMeshInputV0, scale: number): ViewerDisplayMeshStateV0 {
  ownData(input, ['version', 'sourceFrame', 'sourceUnit', 'revision', 'bodies'], 'Display input');
  requireValue(input?.version === 0 && input.sourceFrame === 'right-handed-z-up' && input.sourceUnit === 'mm', 'Unsupported display-mesh profile');
  requireValue(Number.isSafeInteger(input.revision) && input.revision >= 0, 'Invalid display revision');
  requireValue(Number.isFinite(scale) && scale > 0, 'Invalid display scale');
  requireValue(Array.isArray(input.bodies) && input.bodies.length > 0 && input.bodies.length <= DISPLAY_MESH_LIMITS.bodies, 'Display body count exceeds profile');
  requireValue(Object.getPrototypeOf(input.bodies) === Array.prototype
    && Reflect.ownKeys(input.bodies).length === input.bodies.length + 1
    && Array.from({ length: input.bodies.length }, (_, index) => Object.getOwnPropertyDescriptor(input.bodies, String(index)))
      .every(descriptor => descriptor?.enumerable && 'value' in descriptor), 'Display bodies must be dense own data');
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const ids = new Set<string>(); let vertices = 0, indices = 0;
  const bodies = input.bodies.map((body: ViewerDisplayMeshInputV0['bodies'][number]) => {
    ownData(body, ['bodyId', 'positions', 'normals', 'indices'], 'Display body');
    requireValue(typeof body.bodyId === 'string' && body.bodyId.length > 0 && body.bodyId.length <= 256 && !ids.has(body.bodyId), 'Invalid/duplicate display body ID');
    ids.add(body.bodyId);
    requireValue(((body.positions instanceof Float32Array && Object.getPrototypeOf(body.positions) === Float32Array.prototype)
      || (body.positions instanceof Float64Array && Object.getPrototypeOf(body.positions) === Float64Array.prototype))
      && body.normals instanceof Float32Array && Object.getPrototypeOf(body.normals) === Float32Array.prototype
      && body.indices instanceof Uint32Array && Object.getPrototypeOf(body.indices) === Uint32Array.prototype,
    'Display mesh requires exact typed-array prototypes');
    requireValue([body.positions, body.normals, body.indices].every(array => !Object.hasOwn(array, 'length')
      && !Object.hasOwn(array, 'buffer') && !Object.hasOwn(array, Symbol.iterator)),
    'Display mesh rejects own typed-array metadata/iterator');
    requireValue([body.positions, body.normals, body.indices].every(array => array.buffer instanceof ArrayBuffer), 'Shared display buffers are unsupported');
    const count = body.positions.length / 3;
    requireValue(Number.isInteger(count) && count >= 3 && body.normals.length === body.positions.length && body.indices.length >= 3 && body.indices.length % 3 === 0, 'Invalid display array lengths');
    vertices += count; indices += body.indices.length;
    requireValue(vertices <= DISPLAY_MESH_LIMITS.vertices && indices <= DISPLAY_MESH_LIMITS.indices, 'Display mesh exceeds separate profile budget');
    const positions: number[] = [], normals: number[] = [];
    for (let i = 0; i < body.positions.length; i += 3) {
      // Proper rotation: native X,Y,Z -> Viewer X,Z,-Y. No native data mutation.
      const p = [body.positions[i], body.positions[i + 2], -body.positions[i + 1]];
      const n = [body.normals[i], body.normals[i + 2], -body.normals[i + 1]];
      requireValue(p.every(Number.isFinite) && n.every(Number.isFinite) && Math.abs(Math.hypot(...n) - 1) < 1e-3, 'Invalid display vertex/normal');
      for (let axis = 0; axis < 3; axis++) {
        const value = p[axis] * scale;
        requireValue(Math.abs(value) <= 1000, 'Display vertex exceeds Viewer scene bounds');
        min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
      }
      positions.push(...p); normals.push(...n);
    }
    const copiedIndices = Array.from(body.indices);
    requireValue(copiedIndices.every(index => index < count), 'Invalid display triangle index');
    return { bodyId: body.bodyId, positions, normals, indices: copiedIndices };
  });
  return { version: 0, revision: input.revision, authority: 'approximate-display-only', sourceFrame: input.sourceFrame,
    displayFrame: 'right-handed-y-up', bodies, boundsScene: { min, max } };
}
