import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshNormalMaterial } from 'three';
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

export interface BaroCadQualifiedBodyBoundaryMeshThreeFaceBinding {
  readonly faceId: string;
  readonly role: NativeFace['role'];
  readonly orientation: NativeFace['orientation'];
  readonly supportRef: Readonly<NativeFace['supportRef']>;
  readonly object: Mesh<BufferGeometry, MeshNormalMaterial>;
}

export interface BaroCadQualifiedBodyBoundaryMeshThreeResult {
  /** Complete neutral authority, including the independently validated report and CPU projection. */
  readonly data: BaroCadQualifiedBodyBoundaryMeshRead;
  /** Initially detached; the caller owns attachment, staging and rendering. */
  readonly group: Group;
  readonly faceBindings: ReadonlyArray<BaroCadQualifiedBodyBoundaryMeshThreeFaceBinding>;
  /** Release original owned resources once, preserving foreign replacements and child resources. */
  dispose(): void;
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

/** Build only after the complete native receipt and all neutral chunks have been admitted. */
function createTarget(data: BaroCadQualifiedBodyBoundaryMeshRead): BaroCadQualifiedBodyBoundaryMeshThreeResult {
  const group = new Group();
  group.name = data.native.packet.meshId;
  const meshes: Array<Mesh<BufferGeometry, MeshNormalMaterial>> = [];
  const geometries: BufferGeometry[] = [];
  const materials: MeshNormalMaterial[] = [];
  const bindings: BaroCadQualifiedBodyBoundaryMeshThreeFaceBinding[] = [];

  function release(): void {
    let failed = false;
    let firstError: unknown;
    const attempt = (action: () => void): void => {
      try { action(); }
      catch (error) {
        if (!failed) { failed = true; firstError = error; }
      }
    };
    for (const mesh of meshes) attempt(() => mesh.removeFromParent());
    attempt(() => group.removeFromParent());
    attempt(() => group.clear());
    // These lists capture the originals; mutable current Mesh pointers are not ownership evidence.
    for (const geometry of geometries) attempt(() => geometry.dispose());
    for (const material of materials) attempt(() => material.dispose());
    if (failed) throw firstError;
  }

  try {
    for (const chunk of data.projection.chunks) {
      const geometry = new BufferGeometry();
      geometries.push(geometry);
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(chunk.positions), 3));
      geometry.setAttribute('normal', new BufferAttribute(new Float32Array(chunk.normals), 3));
      geometry.setIndex(new BufferAttribute(new Uint32Array(chunk.indices), 1));
      const material = new MeshNormalMaterial({ side: DoubleSide });
      materials.push(material);
      const object = new Mesh(geometry, material);
      meshes.push(object);
      object.name = chunk.faceId;
      group.add(object);
      // Native support qualification contains only string fields; this separate copy is deeply frozen.
      const supportRef = Object.freeze({ ...chunk.supportRef });
      bindings.push(Object.freeze({
        faceId: chunk.faceId,
        role: chunk.role,
        orientation: chunk.orientation,
        supportRef,
        object,
      }));
    }
  } catch (error) {
    try { release(); } catch { /* Keep the original construction error after attempting every cleanup. */ }
    throw error;
  }

  let disposed = false;
  return {
    data,
    group,
    faceBindings: Object.freeze(bindings),
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
    },
  };
}

/** Load complete qualified Body boundary mesh receipts into independently owned Three Face objects. */
export class BaroCADQualifiedBodyBoundaryMeshThreeLoader {
  readonly #options: BaroCadQualifiedBodyBoundaryMeshOptions;

  constructor(options: BaroCadQualifiedBodyBoundaryMeshOptions) {
    this.#options = optionsSnapshot(options);
  }

  parse(text: string): BaroCadQualifiedBodyBoundaryMeshThreeResult {
    const data = parseBaroCadQualifiedBodyBoundaryMesh(text, this.#options);
    return createTarget(data);
  }

  read(input: unknown): BaroCadQualifiedBodyBoundaryMeshThreeResult {
    const data = readBaroCadQualifiedBodyBoundaryMesh(input, this.#options);
    return createTarget(data);
  }
}
