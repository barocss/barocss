import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { Geometry } from '@babylonjs/core/Meshes/geometry.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Material } from '@babylonjs/core/Materials/material.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import {
  BaroCadQualifiedBodyBoundaryMeshReadError,
  parseBaroCadQualifiedBodyBoundaryMesh,
  readBaroCadQualifiedBodyBoundaryMesh,
} from './qualified-body-boundary-mesh.js';
import type {
  BaroCadQualifiedBodyBoundaryMeshOptions,
  BaroCadQualifiedBodyBoundaryMeshRead,
} from './qualified-body-boundary-mesh.js';
import { copyQualifiedBodyBoundaryMeshOwnData } from './qualified-body-boundary-mesh-json.js';

export {
  BaroCadQualifiedBodyBoundaryMeshReadError,
  BaroCadQualifiedBodyBoundaryMeshDiagnosticCode,
  BaroCadQualifiedBodyBoundaryMeshProjectionError,
} from './qualified-body-boundary-mesh.js';
export type {
  BaroCadQualifiedBodyBoundaryMeshOptions,
  BaroCadQualifiedBodyBoundaryMeshRead,
  BaroCadQualifiedBodyBoundaryMeshProjectionDiagnosticCode,
} from './qualified-body-boundary-mesh.js';

type NativeFace = BaroCadQualifiedBodyBoundaryMeshRead['native']['body']['faces'][number];

export interface BaroCadQualifiedBodyBoundaryMeshBabylonFaceBinding {
  readonly faceId: string;
  readonly role: NativeFace['role'];
  readonly orientation: NativeFace['orientation'];
  readonly supportRef: Readonly<NativeFace['supportRef']>;
  readonly object: Mesh;
}

export interface BaroCadQualifiedBodyBoundaryMeshBabylonResult {
  /** Complete neutral authority and independently owned CPU projection. */
  readonly data: BaroCadQualifiedBodyBoundaryMeshRead;
  /** Scene-registered but disabled; the caller controls staging and rendering. */
  readonly meshes: ReadonlyArray<Mesh>;
  readonly faceBindings: ReadonlyArray<BaroCadQualifiedBodyBoundaryMeshBabylonFaceBinding>;
  /** Release captured originals once, preserving caller resources and replacements. */
  dispose(): void;
}

interface OwnedFace {
  mesh: Mesh;
  geometry: Geometry | null;
  material: StandardMaterial | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionsSnapshot(input: BaroCadQualifiedBodyBoundaryMeshOptions): BaroCadQualifiedBodyBoundaryMeshOptions {
  if (!isRecord(input)) {
    throw new BaroCadQualifiedBodyBoundaryMeshReadError('INPUT', 'Explicit boundary mesh options must be a record');
  }
  const copied = copyQualifiedBodyBoundaryMeshOwnData(input).value;
  if (!isRecord(copied) || Object.keys(copied).length !== 1 ||
      !Object.hasOwn(copied, 'unitsPerMillimeter') || copied.unitsPerMillimeter !== 0.001) {
    throw new BaroCadQualifiedBodyBoundaryMeshReadError('INPUT', 'Boundary mesh options require only unitsPerMillimeter 0.001');
  }
  return { unitsPerMillimeter: 0.001 };
}

function requireScene(scene: Scene): void {
  if (!(scene instanceof Scene)) throw new TypeError('A live Babylon Scene instance is required');
  if (scene.isDisposed) throw new RangeError('The Babylon Scene must not be disposed');
  if (scene.useRightHandedSystem !== true) {
    throw new RangeError('The Babylon Scene must use the right-handed coordinate system');
  }
}

/** Allocate only after complete neutral admission; no shader or render operation occurs here. */
function createTarget(data: BaroCadQualifiedBodyBoundaryMeshRead, scene: Scene): BaroCadQualifiedBodyBoundaryMeshBabylonResult {
  const owned: OwnedFace[] = [];
  const bindings: BaroCadQualifiedBodyBoundaryMeshBabylonFaceBinding[] = [];

  function release(): void {
    let failed = false;
    let firstError: unknown;
    const attempt = (action: () => void): boolean => {
      try { action(); return true; }
      catch (error) {
        if (!failed) { failed = true; firstError = error; }
        return false;
      }
    };
    for (const row of owned) {
      // Mesh.dispose releases its current Geometry. Detach foreign pointers without deleting them.
      const safeToDispose = attempt(() => {
        const current = row.mesh.geometry;
        if (current !== null && current !== row.geometry) current.releaseForMesh(row.mesh, false);
      });
      if (safeToDispose) attempt(() => row.mesh.dispose(true, false));
      // Normal Mesh disposal already releases its original Geometry; replacements can orphan it.
      attempt(() => {
        if (row.geometry !== null && !row.geometry.isDisposed()) row.geometry.dispose();
      });
      if (row.material !== null) attempt(() => row.material!.dispose(false, false));
    }
    if (failed) throw firstError;
  }

  try {
    for (const chunk of data.projection.chunks) {
      const mesh = new Mesh(chunk.faceId, scene);
      const row: OwnedFace = { mesh, geometry: null, material: null };
      owned.push(row);
      mesh.setEnabled(false);
      const vertexData = new VertexData();
      vertexData.positions = new Float32Array(chunk.positions);
      vertexData.normals = new Float32Array(chunk.normals);
      vertexData.indices = new Uint32Array(chunk.indices);
      try {
        vertexData.applyToMesh(mesh, false);
      } finally {
        // Keep an original Geometry created before a partial VertexData failure.
        row.geometry = mesh.geometry;
      }
      const material = new StandardMaterial(`${chunk.faceId}:material`, scene);
      row.material = material;
      material.alpha = 1;
      material.transparencyMode = Material.MATERIAL_OPAQUE;
      material.backFaceCulling = false;
      material.disableLighting = true;
      material.emissiveColor = new Color3(0.48, 0.36, 0.96);
      mesh.material = material;
      const supportRef = Object.freeze({
        sourceModelId: chunk.supportRef.sourceModelId,
        objectId: chunk.supportRef.objectId,
      });
      bindings.push(Object.freeze({
        faceId: chunk.faceId,
        role: chunk.role,
        orientation: chunk.orientation,
        supportRef,
        object: mesh,
      }));
    }
  } catch (error) {
    try { release(); } catch { /* Preserve the original construction failure after every cleanup attempt. */ }
    throw error;
  }

  let disposed = false;
  return {
    data,
    meshes: Object.freeze(owned.map(row => row.mesh)),
    faceBindings: Object.freeze(bindings),
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
    },
  };
}

/** Load complete qualified Body boundary receipts into caller-owned right-handed Babylon scenes. */
export class BaroCADQualifiedBodyBoundaryMeshBabylonLoader {
  readonly #options: BaroCadQualifiedBodyBoundaryMeshOptions;
  readonly #scene: Scene;

  constructor(options: BaroCadQualifiedBodyBoundaryMeshOptions, scene: Scene) {
    this.#options = optionsSnapshot(options);
    requireScene(scene);
    this.#scene = scene;
  }

  parse(text: string): BaroCadQualifiedBodyBoundaryMeshBabylonResult {
    requireScene(this.#scene);
    const data = parseBaroCadQualifiedBodyBoundaryMesh(text, this.#options);
    return createTarget(data, this.#scene);
  }

  read(input: unknown): BaroCadQualifiedBodyBoundaryMeshBabylonResult {
    requireScene(this.#scene);
    const data = readBaroCadQualifiedBodyBoundaryMesh(input, this.#options);
    return createTarget(data, this.#scene);
  }
}
