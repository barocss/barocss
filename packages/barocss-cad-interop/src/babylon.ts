import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import type { Scene } from '@babylonjs/core/scene.js';
import { parseBaroCadSource } from './native.js';
import type { BaroCadNativeResult, BaroCadParseOptions } from './native.js';

const MAX_SOURCE_BYTES = 262144; // The current CAD sourceVersion 0 compiler limit.

export interface BaroCadBabylonResult extends BaroCadNativeResult {
  /** Only the meshes created by this parse call. Scene names are not native IDs. */
  meshes: readonly Mesh[];
  /** Idempotent. Releases these meshes and their shared material, never the scene. */
  dispose(): void;
}

async function readSourceUrl(url: string): Promise<string> {
  if (typeof url !== 'string' || url.length === 0) throw new TypeError('A BaroCAD source URL is required');
  const response = await fetch(url);
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`BaroCAD source request failed: HTTP ${response.status}`);
  }
  const lengthHeader = response.headers.get('content-length');
  if (lengthHeader !== null && Number(lengthHeader) > MAX_SOURCE_BYTES) {
    await response.body?.cancel();
    throw new RangeError('BaroCAD source exceeds 262144 bytes');
  }
  if (!response.body) {
    const source = await response.text();
    if (new TextEncoder().encode(source).byteLength > MAX_SOURCE_BYTES) throw new RangeError('BaroCAD source exceeds 262144 bytes');
    return source;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_SOURCE_BYTES) {
        await reader.cancel();
        throw new RangeError('BaroCAD source exceeds 262144 bytes');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** Native BaroCAD source adapter for caller-owned right-handed Babylon scenes. */
export class BaroCADBabylonLoader {
  constructor(private readonly scene: Scene, private readonly options: BaroCadParseOptions) {}

  parse(source: string): BaroCadBabylonResult {
    if (this.scene?.useRightHandedSystem !== true) {
      throw new RangeError('BaroCAD Babylon loading requires scene.useRightHandedSystem === true');
    }
    if (this.scene.isDisposed) throw new RangeError('BaroCAD Babylon loading requires a live scene');
    const native = parseBaroCadSource(source, this.options);
    const ownedMeshes: Mesh[] = [];
    let material: StandardMaterial | undefined;
    try {
      material = new StandardMaterial('barocad_preview_material', this.scene);
      material.backFaceCulling = false;
      material.diffuseColor = new Color3(0.32, 0.69, 0.86);
      material.emissiveColor = new Color3(0.08, 0.16, 0.22);
      material.specularColor = Color3.Black();
      for (const surface of native.surfaces) {
        const mesh = new Mesh(`${native.model.name}:${surface.surfaceId}`, this.scene);
        ownedMeshes.push(mesh);
        const data = new VertexData();
        data.positions = surface.mesh.positions;
        data.normals = surface.mesh.normals;
        data.indices = surface.mesh.indices;
        data.applyToMesh(mesh);
        mesh.material = material;
        mesh.metadata = { barocss: {
          format: 'barocad-source-preview', sourceVersion: 0,
          modelName: native.model.name, surfaceId: surface.surfaceId,
          revision: surface.mesh.revision, lengthUnit: 'mm',
          coordinateSystem: 'right-handed-y-up',
          nativeParameters: Float32Array.from(surface.mesh.parameters),
        } };
      }
    } catch (error) {
      for (const mesh of ownedMeshes) if (!mesh.isDisposed()) mesh.dispose(false, false);
      material?.dispose();
      throw error;
    }
    let disposed = false;
    return {
      ...native, meshes: Object.freeze([...ownedMeshes]),
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const mesh of ownedMeshes) if (!mesh.isDisposed()) mesh.dispose(false, false);
        material.dispose();
      },
    };
  }

  async loadAsync(url: string): Promise<BaroCadBabylonResult> {
    return this.parse(await readSourceUrl(url));
  }
}
