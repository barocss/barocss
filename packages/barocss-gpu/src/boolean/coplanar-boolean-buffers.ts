import { validateCoplanarFaceBooleanMesh } from '@barocss/cad';
import type { CoplanarFaceBooleanMeshResult } from '@barocss/cad';
import { freezeGpuData } from '../mesh/gpu-data.js';
import { requireValue, snapshotNativeMesh, nativeMeshBufferOptions, nativeMeshGeometryBuffers, requireDistinctBufferPoints } from '../mesh/native-mesh-buffers.js';

export interface CoplanarBooleanBufferOptions {
  mmToSceneUnit: number;
  translate: [number, number, number];
}
/** CPU preparation only. Original native data and mutable display buffers have separate ownership. */
export interface PreparedCoplanarBooleanBuffers {
  schema: 'barocss-gpu-coplanar-boolean-buffers';
  version: 0;
  coordinateSystem: 'right-handed-authored-xyz';
  native: CoplanarFaceBooleanMeshResult;
  options: CoplanarBooleanBufferOptions;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
  boundaryIndices: Uint16Array;
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
}
/** Validate the complete native region/mesh, then convert raw XYZ once; never fabricate packet0/Surface identity. */
export function prepareCoplanarBooleanBuffers(input: unknown, optionsInput: CoplanarBooleanBufferOptions): PreparedCoplanarBooleanBuffers {
  const settings = nativeMeshBufferOptions(optionsInput);
  const native = snapshotNativeMesh(input) as CoplanarFaceBooleanMeshResult;
  try { validateCoplanarFaceBooleanMesh(native); }
  catch (cause) { throw new RangeError('Boolean buffers: complete native mesh validation refused', { cause }); }
  const mesh = native.mesh;
  requireValue(mesh.positionsMM.length <= 64 * 3 && mesh.indices.length <= 80 * 3 && native.boundaryPaths.length <= 64,
    'native mesh exceeds GPU CPU profile capacity');
  // Native validation precedes all GPU typed-array allocation.
  const {positions, normals, indices, bounds} = nativeMeshGeometryBuffers(mesh, settings);
  const boundaryIndices = new Uint16Array(native.boundaryPaths.length * 2);
  for (let i = 0; i < native.boundaryPaths.length; i++) {
    const [a, b] = native.boundaryPaths[i].vertexIndices;
    requireDistinctBufferPoints(positions, a, b);
    boundaryIndices.set([a, b], i * 2);
  }
  return Object.freeze({ schema: 'barocss-gpu-coplanar-boolean-buffers', version: 0,
    coordinateSystem: 'right-handed-authored-xyz', native: freezeGpuData(native), options: settings,
    positions, normals, indices, boundaryIndices, bounds });
}
