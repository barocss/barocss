import { validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import type { CoplanarFaceBooleanExtrusionMeshResult } from '@barocss/cad';
import type { CoplanarBooleanBufferOptions } from './coplanar-boolean-buffers.js';
import { freezeGpuData } from '../mesh/gpu-data.js';
import { requireValue, snapshotNativeMesh, nativeMeshBufferOptions, nativeMeshGeometryBuffers,
  nativeXYZBuffers, nativeBufferBounds, requireDistinctBufferPoints } from '../mesh/native-mesh-buffers.js';
import type { NativeBufferBounds } from '../mesh/native-mesh-buffers.js';

/** CPU staging profile only; hard-normal face vertices and actual Curve paths are not welded. */
export interface PreparedBooleanShellBuffers {
  schema: 'barocss-gpu-boolean-shell-buffers'; version: 0; coordinateSystem: 'right-handed-authored-xyz';
  native: CoplanarFaceBooleanExtrusionMeshResult; options: CoplanarBooleanBufferOptions;
  positions: Float32Array; normals: Float32Array; indices: Uint16Array;
  edgePositions: Float32Array; edgeIndices: Uint16Array;
  bounds: NativeBufferBounds; edgeBounds: NativeBufferBounds;
}
/** Complete native rebuild precedes typed-array allocation. True edges use original native Curve samples. */
export function prepareBooleanShellBuffers(input: unknown, optionsInput: CoplanarBooleanBufferOptions): PreparedBooleanShellBuffers {
  const settings = nativeMeshBufferOptions(optionsInput);
  const native = snapshotNativeMesh(input) as CoplanarFaceBooleanExtrusionMeshResult;
  try { validateCoplanarFaceBooleanExtrusionMesh(native); }
  catch (cause) { throw new RangeError('Shell buffers: complete native mesh validation refused', { cause }); }
  requireValue(native.mesh.positionsMM.length <= 384 * 3 && native.mesh.indices.length <= 288 * 3 && native.edgePaths.length <= 192,
    'native Shell exceeds GPU CPU profile capacity');
  requireValue(native.edgePaths.every(path => path.samples.length === 3), 'three actual Curve samples per true edge required');
  const {positions, normals, indices, bounds} = nativeMeshGeometryBuffers(native.mesh, settings);
  const rawEdges = native.edgePaths.flatMap(path => path.samples.flatMap(sample => sample.curveD1.point));
  const edgePositions = nativeXYZBuffers(rawEdges, settings);
  const edgeIndices = new Uint16Array(native.edgePaths.length * 4);
  for (let i = 0; i < native.edgePaths.length; i++) {
    const start = i * 3;
    requireDistinctBufferPoints(edgePositions, start, start + 1);
    requireDistinctBufferPoints(edgePositions, start + 1, start + 2);
    edgeIndices.set([start, start + 1, start + 1, start + 2], i * 4);
  }
  return Object.freeze({schema: 'barocss-gpu-boolean-shell-buffers', version: 0,
    coordinateSystem: 'right-handed-authored-xyz', native: freezeGpuData(native), options: settings,
    positions, normals, indices, edgePositions, edgeIndices, bounds, edgeBounds: nativeBufferBounds(edgePositions)});
}
