import { copyCadPreviewPacket, numbers, record } from './packet.js';
import type { CadPreviewPacket } from './packet.js';

export interface NativeFaceBinding {
  faceToken: string;
  nativeFaceId: string;
  faceOrientation: 'forward' | 'reversed';
  normalSource: 'own-tessellation' | 'native-surface-evaluation' | 'mesh-computed';
  vertexRange: [number, number];
  indexRange: [number, number];
}

export interface PreparedNativeFaceMesh {
  packet: CadPreviewPacket;
  context: Record<'documentId' | 'bodyId' | 'documentRevision' | 'kernelResultRevision' |
    'topologyRevision' | 'taskToken', string>;
  faces: NativeFaceBinding[];
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError(`Invalid native face mesh: ${message}`);
}

function ascii(value: unknown, maximum: number, label: string): string {
  check(typeof value === 'string' && value.length >= 1 && value.length <= maximum
    && /^[\x21-\x7e]+$/.test(value), `${label} must be bounded printable ASCII`);
  return value;
}

function items(input: unknown): unknown[] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype
    && input.length >= 1 && input.length <= 64, 'chunks must be a plain array of 1..64 faces');
  check(Reflect.ownKeys(input).length === input.length + 1, 'chunks must be dense');
  return Array.from({ length: input.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    check(descriptor && 'value' in descriptor && descriptor.enumerable, 'chunk must be data');
    return descriptor.value;
  });
}

/** Convert the CAD part-XYZ face mesh to the shared right-handed Y-up preview packet. */
export function prepareOwnNativeFaceMesh(input: unknown, displayId: string, packetRevision: number): PreparedNativeFaceMesh {
  check(/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(displayId), 'displayId must be an ASCII identifier');
  check(Number.isInteger(packetRevision) && packetRevision >= 0 && packetRevision <= 2147483647,
    'packetRevision is out of range');
  const value = record(input, ['format', 'version', 'lengthUnit', 'nativeFrame', 'context', 'chunks'], 'native mesh');
  check(value.format === 'barocss-native-face-mesh' && value.version === 0
    && value.lengthUnit === 'mm' && value.nativeFrame === 'part-xyz', 'unsupported native mesh format');
  const contextInput = record(value.context, ['documentId', 'bodyId', 'documentRevision',
    'kernelResultRevision', 'topologyRevision', 'taskToken'], 'context');
  const context = Object.fromEntries(Object.entries(contextInput).map(([key, item]) =>
    [key, ascii(item, 48, key)])) as PreparedNativeFaceMesh['context'];
  const positions: number[] = [], normals: number[] = [], parameters: number[] = [], indices: number[] = [];
  const faces: NativeFaceBinding[] = [];
  const tokens = new Set<string>();
  for (const item of items(value.chunks)) {
    const chunk = record(item, ['faceToken', 'nativeFaceId', 'faceOrientation', 'normalSource',
      'positionsMM', 'normals', 'parametersUV', 'indices'], 'chunk');
    const faceToken = ascii(chunk.faceToken, 48, 'faceToken');
    const nativeFaceId = ascii(chunk.nativeFaceId, 128, 'nativeFaceId');
    check(!tokens.has(faceToken), 'duplicate faceToken');
    tokens.add(faceToken);
    check(chunk.faceOrientation === 'forward' || chunk.faceOrientation === 'reversed', 'unsupported face orientation');
    check(chunk.normalSource === 'own-tessellation' || chunk.normalSource === 'native-surface-evaluation'
      || chunk.normalSource === 'mesh-computed', 'unsupported normal source');
    const xyz = numbers(chunk.positionsMM, 9, 12288, 3, 'positionsMM');
    const vertexCount = xyz.length / 3;
    const faceNormals = numbers(chunk.normals, xyz.length, xyz.length, 3, 'normals');
    const uv = numbers(chunk.parametersUV, vertexCount * 2, vertexCount * 2, 2, 'parametersUV');
    const triangles = numbers(chunk.indices, 3, 23814, 3, 'indices');
    const vertexStart = positions.length / 3, indexStart = indices.length;
    check(vertexStart + vertexCount <= 4096 && indices.length + triangles.length <= 23814,
      'aggregate display budget exceeded');
    for (let index = 0; index < xyz.length; index += 3) {
      // Proper 90-degree X rotation: (X,Y,Z) -> (X,Z,-Y), determinant +1.
      positions.push(xyz[index], xyz[index + 2], -xyz[index + 1]);
      normals.push(faceNormals[index], faceNormals[index + 2], -faceNormals[index + 1]);
    }
    check(triangles.every(index => Number.isInteger(index) && index >= 0 && index < vertexCount),
      'local face index is out of range');
    parameters.push(...uv);
    indices.push(...triangles.map(index => index + vertexStart));
    faces.push({ faceToken, nativeFaceId,
      faceOrientation: chunk.faceOrientation as NativeFaceBinding['faceOrientation'],
      normalSource: chunk.normalSource as NativeFaceBinding['normalSource'],
      vertexRange: [vertexStart, positions.length / 3], indexRange: [indexStart, indices.length] });
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index++) {
    const axis = index % 3;
    min[axis] = Math.min(min[axis], positions[index]);
    max[axis] = Math.max(max[axis], positions[index]);
  }
  const packet = copyCadPreviewPacket({ version: 0, surfaceId: displayId, revision: packetRevision,
    lengthUnit: 'mm', coordinateSystem: 'right-handed-y-up', winding: 'ccw',
    positions, normals, indices, parameters, bounds: { min, max } });
  return { packet, context, faces };
}
