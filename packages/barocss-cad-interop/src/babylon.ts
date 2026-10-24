import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { PickingInfo } from '@babylonjs/core/Collisions/pickingInfo.js';
import type { Scene } from '@babylonjs/core/scene.js';
import { makeCurvePickBinding, readAffineMatrix, readOwnData, readPoint, resolveCurveChord, sameValues } from './curve-pick.js';
import type { BaroCadCurveDisplayPick, CurvePickBinding } from './curve-pick.js';
import { parseBaroCadSource, validateBaroCadParseOptions } from './native.js';
import type { BaroCadNativeResult, BaroCadParseOptions } from './native.js';
import { readAbortableBaroCadSource, throwIfBaroCadAborted, validateBaroCadTransport } from './transport.js';
import type { BaroCadLoadTransportOptions } from './transport.js';
export type { BaroCadCurveDisplayPick } from './curve-pick.js';

interface BabylonCurvePickEntry {
  binding: CurvePickBinding;
  geometry: Mesh['geometry'];
  indices: number[];
}

const curvePickResults = new WeakMap<BaroCadBabylonResult, {
  owned: Map<Mesh, BabylonCurvePickEntry | null>;
  isDisposed: () => boolean;
}>();

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
    const options = validateBaroCadParseOptions(this.options);
    if (this.scene?.useRightHandedSystem !== true) {
      throw new RangeError('BaroCAD Babylon loading requires scene.useRightHandedSystem === true');
    }
    if (this.scene.isDisposed) throw new RangeError('BaroCAD Babylon loading requires a live scene');
    const native = parseBaroCadSource(source, options);
    const ownedMeshes: Mesh[] = [];
    const owned = new Map<Mesh, BabylonCurvePickEntry | null>();
    const previousMeshes = new Set(this.scene.meshes);
    let material: StandardMaterial | undefined;
    try {
      if (native.surfaces.length) {
        material = new StandardMaterial('barocad_preview_material', this.scene);
        material.backFaceCulling = false;
        material.diffuseColor = new Color3(0.32, 0.69, 0.86);
        material.emissiveColor = new Color3(0.08, 0.16, 0.22);
        material.specularColor = Color3.Black();
      }
      for (const surface of native.surfaces) {
        const mesh = new Mesh(`${native.model.name}:${surface.surfaceId}`, this.scene);
        ownedMeshes.push(mesh);
        const data = new VertexData();
        data.positions = surface.mesh.positions;
        data.normals = surface.mesh.normals;
        data.indices = surface.mesh.indices;
        data.applyToMesh(mesh);
        mesh.material = material ?? null;
        mesh.metadata = { barocss: {
          format: 'barocad-source-preview', sourceVersion: 0,
          modelName: native.model.name, surfaceId: surface.surfaceId,
          revision: surface.mesh.revision, lengthUnit: 'mm',
          coordinateSystem: 'right-handed-z-up',
          nativeParameters: Float32Array.from(surface.mesh.parameters),
        } };
        owned.set(mesh, null);
      }
      for (const curve of native.curves) {
        const points: Vector3[] = [];
        for (let index = 0; index < curve.positions.length; index += 3) {
          points.push(new Vector3(curve.positions[index], curve.positions[index + 1], curve.positions[index + 2]));
        }
        const line = MeshBuilder.CreateLines(`${native.model.name}:${curve.curveId}`, { points }, this.scene);
        ownedMeshes.push(line);
        line.color = new Color3(0.16, 0.79, 0.92);
        line.metadata = { barocss: {
          role: 'curve-display-line', format: 'barocad-source-preview', sourceVersion: 0,
          modelName: native.model.name, curveId: curve.curveId,
          lengthUnit: 'mm', coordinateSystem: 'right-handed-y-up',
          nativeParameters: [...curve.sample.parameters],
          nativeIntervals: curve.sample.segments.map(segment => [...segment.domain]),
          sampleReport: curve.sample.report,
        } };
        const original = native.model.objects.find(object => object.kind === 'curve' && object.id === curve.curveId);
        if (!original || original.kind !== 'curve') throw new RangeError('BaroCAD Curve display lost its native source binding');
        const binding = makeCurvePickBinding(native.model.name, original, curve);
        const indices: number[] = [];
        for (let index = 0; index < binding.parameters.length - 1; index++) indices.push(index, index + 1);
        owned.set(line, { binding, geometry: line.geometry, indices });
      }
      const sourceOrder = new Map(native.model.objects.map((object, index) => [object.id, index]));
      ownedMeshes.sort((left, right) => {
        const leftId = left.metadata.barocss.curveId ?? left.metadata.barocss.surfaceId;
        const rightId = right.metadata.barocss.curveId ?? right.metadata.barocss.surfaceId;
        return (sourceOrder.get(leftId) ?? -1) - (sourceOrder.get(rightId) ?? -1);
      });
    } catch (error) {
      for (const mesh of [...this.scene.meshes]) if (!previousMeshes.has(mesh) && !mesh.isDisposed()) mesh.dispose(false, false);
      material?.dispose();
      throw error;
    }
    let disposed = false;
    const result: BaroCadBabylonResult = {
      ...native, meshes: Object.freeze([...ownedMeshes]),
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const mesh of ownedMeshes) if (!mesh.isDisposed()) mesh.dispose(false, false);
        material?.dispose();
        owned.clear();
      },
    };
    curvePickResults.set(result, { owned, isDisposed: () => disposed });
    return result;
  }

  async loadAsync(url: string): Promise<BaroCadBabylonResult> {
    return this.parse(await readSourceUrl(url));
  }

  /** Explicit bounded URL transport. Existing loadAsync behavior is unchanged. */
  async loadAbortable(url: string, transport: BaroCadLoadTransportOptions): Promise<BaroCadBabylonResult> {
    const request = validateBaroCadTransport(url, transport);
    const source = await readAbortableBaroCadSource(request);
    throwIfBaroCadAborted(request.signal);
    let result: BaroCadBabylonResult | undefined;
    try {
      result = this.parse(source);
      await Promise.resolve();
      throwIfBaroCadAborted(request.signal);
      if (this.scene.isDisposed) throw new RangeError('BaroCAD Babylon loading requires a live scene');
      return result;
    } catch (error) {
      result?.dispose();
      throw error;
    }
  }
}

/** Associate one actual Babylon LinesMesh hit with its accepted native Curve sample interval. */
export function resolveBaroCadBabylonCurvePick(
  result: BaroCadBabylonResult, pickingInfo: PickingInfo | null,
): BaroCadCurveDisplayPick | null {
  const record = curvePickResults.get(result);
  if (!record) throw new TypeError('BaroCAD Babylon pick requires a result from this loader');
  if (record.isDisposed()) throw new RangeError('BaroCAD Babylon pick result is disposed');
  if (pickingInfo === null) return null;
  const hit = readOwnData(pickingInfo, 'hit');
  if (hit === false) return null;
  if (hit !== true) throw new TypeError('BaroCAD Babylon pick hit must be boolean data');
  const mesh = readOwnData(pickingInfo, 'pickedMesh');
  if (!(mesh instanceof Mesh) || !record.owned.has(mesh)) {
    throw new RangeError('BaroCAD Babylon pick mesh is foreign to this result');
  }
  const entry = record.owned.get(mesh);
  if (!entry) return null;
  if (mesh.isDisposed() || mesh.geometry !== entry.geometry ||
      !sameValues(mesh.getVerticesData('position'), entry.binding.positions) ||
      !sameValues(mesh.getIndices(), entry.indices) || mesh.subMeshes.length !== 1 ||
      mesh.subMeshes[0].indexStart !== 0 || mesh.subMeshes[0].indexCount !== entry.indices.length) {
    throw new RangeError('BaroCAD Babylon Curve display geometry is stale');
  }
  const index = readOwnData(pickingInfo, 'faceId');
  const subMeshIndex = readOwnData(pickingInfo, 'subMeshFaceId');
  const subMeshId = readOwnData(pickingInfo, 'subMeshId');
  if (typeof index !== 'number' || index !== subMeshIndex || subMeshId !== 0) {
    throw new RangeError('BaroCAD Babylon Curve segment index is stale');
  }
  const point = readOwnData(pickingInfo, 'pickedPoint');
  if (!(point instanceof Vector3)) throw new TypeError('BaroCAD Babylon pick point must be a Vector3');
  const worldHit = readPoint(
    readOwnData(point, '_x') as number, readOwnData(point, '_y') as number, readOwnData(point, '_z') as number,
  );
  const worldMatrix = mesh.computeWorldMatrix(true);
  const matrix = readAffineMatrix(readOwnData(worldMatrix, '_m'));
  const threshold = readOwnData(mesh, 'intersectionThreshold');
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0) {
    throw new RangeError('BaroCAD Babylon line threshold is unsafe');
  }
  const maxScale = Math.max(
    Math.hypot(matrix[0], matrix[1], matrix[2]),
    Math.hypot(matrix[4], matrix[5], matrix[6]),
    Math.hypot(matrix[8], matrix[9], matrix[10]),
  );
  return resolveCurveChord('babylon', entry.binding, index, worldHit, matrix, threshold * maxScale + 1e-5);
}
