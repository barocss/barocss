import { prepareCadPreviewMesh } from './packet.js';
import type { PreparedCadMesh } from './packet.js';
import { prepareOwnNativeFaceMesh } from './native-face.js';

type BufferView = { buffer: 0; byteOffset: number; byteLength: number; target: number };
type Accessor = {
  bufferView: number; componentType: number; count: number; type: 'SCALAR' | 'VEC2' | 'VEC3';
  min?: number[]; max?: number[];
};

const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const NATIVE_GLB_MAX_BYTES = 1024 * 1024;

export interface NativeGlbCurve {
  curveId: string;
  positions: Float32Array;
  parameters: number[];
  intervals: [number, number][];
}

function align4(length: number): number { return (length + 3) & ~3; }

/** Encode one or more CAD preview packets as a self-contained glTF 2.0 binary asset. */
export function encodeCadPreviewGlb(input: unknown): ArrayBuffer {
  const sources = Array.isArray(input) ? input : [input];
  if (sources.length < 1 || sources.length > 32) throw new RangeError('GLB needs 1..32 preview packets');
  const meshes: PreparedCadMesh[] = sources.map(source => prepareCadPreviewMesh(source, 0.001));
  const names = new Set(meshes.map(mesh => mesh.surfaceId));
  if (names.size !== meshes.length) throw new RangeError('GLB surfaceId values must be unique');
  return encodeMeshes(meshes, meshes.map(mesh => ({ previewPacketVersion: 0,
    surfaceId: mesh.surfaceId, revision: mesh.revision, sourceLengthUnit: 'mm', approximate: true })));
}

/** Encode the CAD engine's native face mesh, retaining result-scoped face bindings. */
export function encodeOwnNativeFaceMeshGlb(input: unknown, displayId: string, packetRevision: number): ArrayBuffer {
  const prepared = prepareOwnNativeFaceMesh(input, displayId, packetRevision);
  return encodeMeshes([prepareCadPreviewMesh(prepared.packet, 0.001)], [{
    previewPacketVersion: 0, surfaceId: displayId, revision: packetRevision,
    sourceLengthUnit: 'mm', approximate: true, nativeFrame: 'part-xyz',
    context: prepared.context, faces: prepared.faces,
  }]);
}

/** Internal native-source display writer. Native source validation lives in native.ts. */
export function encodeNativePreviewGlb(
  meshes: PreparedCadMesh[], metadata: Record<string, unknown>[],
  curves: NativeGlbCurve[], assetMetadata: Record<string, unknown>,
): ArrayBuffer {
  return encodeMeshes(meshes, metadata, { curves, assetMetadata, maxBytes: NATIVE_GLB_MAX_BYTES });
}

function encodeMeshes(
  meshes: PreparedCadMesh[], metadata: Record<string, unknown>[],
  native?: { curves: NativeGlbCurve[]; assetMetadata: Record<string, unknown>; maxBytes: number },
): ArrayBuffer {
  const chunks: Uint8Array[] = [];
  const bufferViews: BufferView[] = [];
  const accessors: Accessor[] = [];
  let binaryLength = 0;

  function append(bytes: Uint8Array, target: number): number {
    const padding = align4(binaryLength) - binaryLength;
    if (padding) { chunks.push(new Uint8Array(padding)); binaryLength += padding; }
    const view = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: binaryLength, byteLength: bytes.byteLength, target });
    chunks.push(bytes);
    binaryLength += bytes.byteLength;
    return view;
  }

  function floats(values: Float32Array): Uint8Array {
    const bytes = new Uint8Array(values.length * 4);
    const view = new DataView(bytes.buffer);
    for (let index = 0; index < values.length; index++) view.setFloat32(index * 4, values[index], true);
    return bytes;
  }

  function shorts(values: Uint16Array): Uint8Array {
    const bytes = new Uint8Array(values.length * 2);
    const view = new DataView(bytes.buffer);
    for (let index = 0; index < values.length; index++) view.setUint16(index * 2, values[index], true);
    return bytes;
  }

  function attribute(values: Float32Array, type: 'VEC2' | 'VEC3'): number {
    const accessor = accessors.length;
    accessors.push({ bufferView: append(floats(values), ARRAY_BUFFER), componentType: FLOAT,
      count: values.length / (type === 'VEC3' ? 3 : 2), type });
    return accessor;
  }

  const gltfMeshes = meshes.map(mesh => {
    const position = attribute(mesh.positions, 'VEC3');
    const boundsMin = [Infinity, Infinity, Infinity], boundsMax = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < mesh.positions.length; index += 3) {
      for (let axis = 0; axis < 3; axis++) {
        boundsMin[axis] = Math.min(boundsMin[axis], mesh.positions[index + axis]);
        boundsMax[axis] = Math.max(boundsMax[axis], mesh.positions[index + axis]);
      }
    }
    accessors[position].min = boundsMin;
    accessors[position].max = boundsMax;
    const normal = attribute(mesh.normals, 'VEC3');
    // CAD parameters are application data. They are not normalized texture UVs.
    const parameter = attribute(mesh.parameters, 'VEC2');
    const indices = accessors.length;
    accessors.push({ bufferView: append(shorts(mesh.indices), ELEMENT_ARRAY_BUFFER),
      componentType: UNSIGNED_SHORT, count: mesh.indices.length, type: 'SCALAR' });
    return { name: mesh.surfaceId, primitives: [{ attributes: { POSITION: position, NORMAL: normal,
      _CAD_UV: parameter }, indices, material: 0, mode: 4 }] };
  });

  const curveMeshes = (native?.curves ?? []).map(curve => {
    const pointCount = curve.positions.length / 3;
    if (!Number.isInteger(pointCount) || pointCount < 2 || pointCount > 1025 ||
        curve.parameters.length !== pointCount || curve.intervals.length !== pointCount - 1 ||
        !curve.positions.every(Number.isFinite)) throw new RangeError('GLB Curve has invalid sample points');
    for (let index = 1; index < pointCount; index++) {
      const a = (index - 1) * 3, b = index * 3;
      if (curve.positions[a] === curve.positions[b] && curve.positions[a + 1] === curve.positions[b + 1] &&
          curve.positions[a + 2] === curve.positions[b + 2]) throw new RangeError('GLB Curve has a collapsed segment');
    }
    const position = attribute(curve.positions, 'VEC3');
    const boundsMin = [Infinity, Infinity, Infinity], boundsMax = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < curve.positions.length; index += 3) {
      for (let axis = 0; axis < 3; axis++) {
        boundsMin[axis] = Math.min(boundsMin[axis], curve.positions[index + axis]);
        boundsMax[axis] = Math.max(boundsMax[axis], curve.positions[index + axis]);
      }
    }
    accessors[position].min = boundsMin;
    accessors[position].max = boundsMax;
    const indices = accessors.length;
    accessors.push({ bufferView: append(shorts(Uint16Array.from({ length: pointCount }, (_, index) => index)),
      ELEMENT_ARRAY_BUFFER), componentType: UNSIGNED_SHORT, count: pointCount, type: 'SCALAR' });
    return { name: curve.curveId, primitives: [{ attributes: { POSITION: position }, indices, material: 1, mode: 3 }] };
  });

  const paddedBinaryLength = align4(binaryLength);
  const document = {
    asset: { version: '2.0', generator: '@barocss/cad-interop',
      ...(native ? { extras: { barocss: native.assetMetadata } } : {}) },
    scene: 0,
    scenes: [{ nodes: [...meshes, ...(native?.curves ?? [])].map((_, index) => index) }],
    nodes: [...meshes.map((mesh, index) => ({ mesh: index, name: mesh.surfaceId,
      extras: { barocss: metadata[index] } })),
      ...(native?.curves ?? []).map((curve, index) => ({ mesh: meshes.length + index, name: curve.curveId,
        extras: { barocss: { kind: 'curve', curveId: curve.curveId, sourceLengthUnit: 'mm',
          displayLengthUnit: 'm', approximate: true, parameters: curve.parameters,
          intervals: curve.intervals } } }))],
    meshes: [...gltfMeshes, ...curveMeshes],
    materials: [{ name: 'CAD preview', doubleSided: true,
      pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1], metallicFactor: 0,
        roughnessFactor: 1 } },
      ...(native?.curves.length ? [{ name: 'CAD Curve preview', doubleSided: true,
        pbrMetallicRoughness: { baseColorFactor: [0.9, 0.25, 0.1, 1], metallicFactor: 0,
          roughnessFactor: 1 } }] : [])],
    buffers: [{ byteLength: paddedBinaryLength }],
    bufferViews,
    accessors,
  };
  const json = new TextEncoder().encode(JSON.stringify(document));
  const paddedJsonLength = align4(json.byteLength);
  const totalLength = 12 + 8 + paddedJsonLength + 8 + paddedBinaryLength;
  if (native && totalLength > native.maxBytes) throw new RangeError('BaroCAD GLB exceeds 1 MiB');
  const output = new ArrayBuffer(totalLength);
  const bytes = new Uint8Array(output);
  const header = new DataView(output);
  header.setUint32(0, 0x46546c67, true); // glTF
  header.setUint32(4, 2, true);
  header.setUint32(8, totalLength, true);
  header.setUint32(12, paddedJsonLength, true);
  header.setUint32(16, 0x4e4f534a, true); // JSON
  bytes.set(json, 20);
  bytes.fill(0x20, 20 + json.byteLength, 20 + paddedJsonLength);
  const binaryHeader = 20 + paddedJsonLength;
  header.setUint32(binaryHeader, paddedBinaryLength, true);
  header.setUint32(binaryHeader + 4, 0x004e4942, true); // BIN
  let offset = binaryHeader + 8;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}
