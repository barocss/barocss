import {
  parseBaroCadQualifiedBodyBoundaryMesh,
  readBaroCadQualifiedBodyBoundaryMesh,
  BaroCadQualifiedBodyBoundaryMeshReadError,
} from './qualified-body-boundary-mesh.js';
import type {
  BaroCadQualifiedBodyBoundaryMeshOptions,
  BaroCadQualifiedBodyBoundaryMeshRead,
} from './qualified-body-boundary-mesh.js';
import { copyQualifiedBodyBoundaryMeshOwnData } from './qualified-body-boundary-mesh-json.js';
import {
  Camera,
  LightingEnvironment,
  Container3D,
  Mesh3D,
  MeshGeometry3D,
  StandardMaterial,
  StandardMaterialAlphaMode,
  Color,
} from 'pixi3d/pixi7';
import { Renderer, DRAW_MODES } from 'pixi.js';

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

export interface BaroCadQualifiedBodyBoundaryMeshPixi3DContext {
  camera: Camera;
  lighting: LightingEnvironment;
}

export interface BaroCadQualifiedBodyBoundaryMeshPixi3DFaceBinding {
  readonly faceId: string;
  readonly role: NativeFace['role'];
  readonly orientation: NativeFace['orientation'];
  readonly supportRef: Readonly<NativeFace['supportRef']>;
  readonly object: Mesh3D;
}

export interface BaroCadQualifiedBodyBoundaryMeshPixi3DResult {
  readonly data: BaroCadQualifiedBodyBoundaryMeshRead;
  readonly root: Container3D;
  readonly faceBindings: ReadonlyArray<BaroCadQualifiedBodyBoundaryMeshPixi3DFaceBinding>;
  dispose(): void;
}

interface CapturedContext {
  camera: Camera;
  lighting: LightingEnvironment;
  renderer: Renderer;
}

const CONTEXT_MESSAGE = 'Qualified Body Pixi3D context requires matching live Camera and LightingEnvironment on one WebGL2 renderer';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Existing neutral option rules, without a native constructor admission. */
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

function requireLiveContext(context: CapturedContext): void {
  const { camera, lighting, renderer } = context;
  if (!(camera instanceof Camera) || camera.destroyed !== false ||
      !(lighting instanceof LightingEnvironment) || lighting.valid !== true ||
      !(renderer instanceof Renderer) || camera.renderer !== renderer || lighting.renderer !== renderer ||
      !renderer.context || renderer.context.isLost !== false ||
      renderer.context.webGLVersion !== 2 || !renderer.geometry ||
      renderer.geometry.canUseUInt32ElementIndex !== true ||
      !renderer.runners || !renderer.runners.destroy ||
      !Array.isArray(renderer.runners.destroy.items) || renderer.runners.destroy.items.length === 0) {
    throw new TypeError(CONTEXT_MESSAGE);
  }
}

/** Snapshot the two caller references only; engine objects stay caller-owned and mutable. */
function contextSnapshot(input: BaroCadQualifiedBodyBoundaryMeshPixi3DContext): CapturedContext {
  if (!isRecord(input)) throw new TypeError(CONTEXT_MESSAGE);
  const keys = Reflect.ownKeys(input);
  const prototype = Object.getPrototypeOf(input);
  if ((prototype !== Object.prototype && prototype !== null) ||
      keys.length !== 2 || !keys.includes('camera') || !keys.includes('lighting')) {
    throw new TypeError(CONTEXT_MESSAGE);
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (!['camera', 'lighting'].every(key => Object.hasOwn(descriptors, key) &&
      'value' in descriptors[key] && descriptors[key].enumerable === true)) {
    throw new TypeError(CONTEXT_MESSAGE);
  }
  const camera = descriptors.camera.value;
  const lighting = descriptors.lighting.value;
  if (!(camera instanceof Camera) || !(lighting instanceof LightingEnvironment)) {
    throw new TypeError(CONTEXT_MESSAGE);
  }
  const result: CapturedContext = { camera, lighting, renderer: camera.renderer };
  requireLiveContext(result);
  return result;
}

function bounds(positions: Float32Array): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], positions[index + axis]);
      max[axis] = Math.max(max[axis], positions[index + axis]);
    }
  }
  return { min, max };
}

/** Keep secondary cleanup evidence separate without replacing the original thrown value. */
function recordCleanupErrors(errors: readonly unknown[]): void {
  if (errors.length === 0) return;
  try { console.error('Qualified Body Pixi3D secondary cleanup errors', errors); }
  catch { /* Diagnostic failure must not replace the primary error. */ }
}

function createTarget(data: BaroCadQualifiedBodyBoundaryMeshRead, context: CapturedContext): BaroCadQualifiedBodyBoundaryMeshPixi3DResult {
  let root: Container3D | undefined;
  const meshes: Mesh3D[] = [];
  const geometries: MeshGeometry3D[] = [];
  const materials: StandardMaterial[] = [];
  const bindings: BaroCadQualifiedBodyBoundaryMeshPixi3DFaceBinding[] = [];

  function release(): { failed: boolean; firstError: unknown; errors: unknown[] } {
    let failed = false;
    let firstError: unknown;
    const errors: unknown[] = [];
    const attempt = (action: () => void): void => {
      try { action(); } catch (error) {
        if (!failed) { failed = true; firstError = error; }
        errors.push(error);
      }
    };
    // Captured objects, not creation-time method values: later instance observers still chain.
    for (const mesh of meshes) attempt(() => mesh.parent?.removeChild(mesh));
    const capturedRoot = root;
    if (capturedRoot) attempt(() => capturedRoot.parent?.removeChild(capturedRoot));
    for (const mesh of meshes) attempt(() => mesh.destroy({ children: false, geometry: false, material: false }));
    for (const geometry of geometries) attempt(() => geometry.destroy());
    for (const material of materials) attempt(() => material.destroy());
    if (capturedRoot) attempt(() => capturedRoot.destroy({ children: false }));
    return { failed, firstError, errors };
  }

  try {
    root = new Container3D();
    root.name = data.native.packet.meshId;
    for (const chunk of data.projection.chunks) {
      const geometry = new MeshGeometry3D();
      geometries.push(geometry);
      const positions = new Float32Array(chunk.positions);
      geometry.positions = {
        buffer: positions, componentType: 5126, componentCount: 3,
        normalized: false, ...bounds(positions),
      };
      geometry.normals = {
        buffer: new Float32Array(chunk.normals), componentType: 5126,
        componentCount: 3, normalized: false,
      };
      geometry.indices = {
        buffer: new Uint32Array(chunk.indices), componentType: 5125,
        componentCount: 1, normalized: false,
      };
      // Dimensionless native UV and native D1 remain full neutral CPU data, never texture UV.
      const material = new StandardMaterial();
      materials.push(material);
      material.camera = context.camera;
      material.lightingEnvironment = context.lighting;
      material.unlit = true;
      material.doubleSided = true;
      material.alphaMode = StandardMaterialAlphaMode.opaque;
      material.baseColor = new Color(0.48, 0.36, 0.96, 1);
      material.state.blend = false;
      material.state.depthTest = true;
      material.depthMask = true;
      material.drawMode = DRAW_MODES.TRIANGLES;
      const object = new Mesh3D(geometry, material);
      meshes.push(object);
      object.name = chunk.faceId;
      root.addChild(object);
      const supportRef = Object.freeze({ ...chunk.supportRef });
      bindings.push(Object.freeze({
        faceId: chunk.faceId,
        role: chunk.role,
        orientation: chunk.orientation,
        supportRef,
        object,
      }));
    }
  } catch (primaryError) {
    const cleanup = release();
    recordCleanupErrors(cleanup.errors);
    throw primaryError;
  }

  const ownedRoot = root;
  let disposed = false;
  return {
    data,
    root: ownedRoot,
    faceBindings: Object.freeze(bindings),
    dispose() {
      if (disposed) return;
      disposed = true;
      const cleanup = release();
      if (cleanup.failed) {
        recordCleanupErrors(cleanup.errors.slice(1));
        throw cleanup.firstError;
      }
    },
  };
}

/** Read complete qualified Body receipts into owned Pixi3D Faces. Caller controls staging and rendering. */
export class BaroCADQualifiedBodyBoundaryMeshPixi3DLoader {
  readonly #options: BaroCadQualifiedBodyBoundaryMeshOptions;
  readonly #context: CapturedContext;

  constructor(options: BaroCadQualifiedBodyBoundaryMeshOptions, context: BaroCadQualifiedBodyBoundaryMeshPixi3DContext) {
    this.#options = optionsSnapshot(options);
    this.#context = contextSnapshot(context);
  }

  parse(text: string): BaroCadQualifiedBodyBoundaryMeshPixi3DResult {
    requireLiveContext(this.#context);
    const data = parseBaroCadQualifiedBodyBoundaryMesh(text, this.#options);
    return createTarget(data, this.#context);
  }

  read(input: unknown): BaroCadQualifiedBodyBoundaryMeshPixi3DResult {
    requireLiveContext(this.#context);
    const data = readBaroCadQualifiedBodyBoundaryMesh(input, this.#options);
    return createTarget(data, this.#context);
  }
}
