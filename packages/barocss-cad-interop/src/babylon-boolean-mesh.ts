import { validateCoplanarFaceBooleanMesh } from '@barocss/cad';
import type { CoplanarFaceBooleanMeshBoundaryPath, CoplanarFaceBooleanMeshResult,
  CoplanarFaceBooleanMeshTriangulation } from '@barocss/cad';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Scene } from '@babylonjs/core/scene.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';

export interface BaroCadBooleanBabylonMeshOptions {
  unitsPerMillimeter: number;
  /** Host assertion that authored XYZ matches the right-handed Y-up Scene. */
  basis: 'authored-xyz-matches-rhyup';
}

export interface BaroCadBooleanBabylonMeshBinding {
  readonly meshId: string;
  readonly evaluationId: string;
  readonly supportId: string;
  readonly sourceAssetIds: ReadonlyArray<string>;
  readonly operands: Readonly<{
    a: Readonly<CoplanarFaceBooleanMeshResult['mesh']['binding']['a']>;
    b: Readonly<CoplanarFaceBooleanMeshResult['mesh']['binding']['b']>;
  }>;
  readonly componentId: string;
  readonly outerLoopId: string;
  readonly holeLoopIds: ReadonlyArray<string>;
  readonly vertexIndices: ReadonlyArray<number>;
  readonly triangleIds: ReadonlyArray<string>;
  readonly boundaryPathIds: ReadonlyArray<string>;
  readonly internalEdgeIds: ReadonlyArray<string>;
  readonly bridgeIds: ReadonlyArray<string>;
  readonly object: Mesh;
}

export interface BaroCadBooleanBabylonMeshResult {
  readonly root: TransformNode;
  readonly bindings: ReadonlyArray<BaroCadBooleanBabylonMeshBinding>;
  readonly boundaryPaths: ReadonlyArray<CoplanarFaceBooleanMeshBoundaryPath>;
  readonly internalEdges: ReadonlyArray<CoplanarFaceBooleanMeshTriangulation['internalEdges'][number]>;
  readonly bridges: ReadonlyArray<CoplanarFaceBooleanMeshTriangulation['bridges'][number]>;
  /** Releases only adapter-owned target resources. */
  dispose(): void;
}

function ownOptions(input: BaroCadBooleanBabylonMeshOptions): BaroCadBooleanBabylonMeshOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Boolean Babylon mesh options must be plain own data');
  }
  const keys = Reflect.ownKeys(input);
  const fields = Object.getOwnPropertyDescriptors(input);
  if (keys.length !== 2 || !keys.every(key => typeof key === 'string' &&
      ['unitsPerMillimeter', 'basis'].includes(key) && fields[key].enumerable && 'value' in fields[key]) ||
      !fields.unitsPerMillimeter || !fields.basis ||
      fields.basis.value !== 'authored-xyz-matches-rhyup') {
    throw new RangeError('Boolean Babylon mesh options require scale and matching Y-up basis');
  }
  const scale = fields.unitsPerMillimeter.value;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0 ||
      !Number.isFinite(Math.fround(scale)) || Math.fround(scale) === 0) {
    throw new RangeError('Boolean Babylon mesh scale must be finite and representable');
  }
  return { unitsPerMillimeter: scale, basis: fields.basis.value };
}

function float32Data(values: number[], scale: number, label: string): Float32Array {
  const target = new Float32Array(values.length);
  for (let index = 0; index < values.length; index++) {
    const scaled = values[index] * scale;
    const value = Math.fround(scaled);
    if (!Number.isFinite(scaled) || !Number.isFinite(value) || (values[index] !== 0 && value === 0)) {
      throw new RangeError(`Boolean Babylon mesh ${label} is not representable as Float32`);
    }
    target[index] = value;
  }
  return target;
}

/** Draw only the validated native Boolean material in a caller-owned Babylon Scene. */
export function createBaroCadBooleanBabylonMesh(
  scene: Scene, result: CoplanarFaceBooleanMeshResult, options: BaroCadBooleanBabylonMeshOptions,
): BaroCadBooleanBabylonMeshResult {
  if (!scene || scene.useRightHandedSystem !== true || scene.isDisposed) {
    throw new RangeError('Boolean Babylon mesh requires a live right-handed caller Scene');
  }
  validateCoplanarFaceBooleanMesh(result);
  const owned = structuredClone(result);
  const request = ownOptions(options);
  const positions = float32Data(owned.mesh.positionsMM, request.unitsPerMillimeter, 'position');
  const normals = float32Data(owned.mesh.normals, 1, 'normal');
  const parameters = float32Data(owned.mesh.parametersUV, 1, 'CAD UV');
  const triangles = new Map(owned.triangulation.triangles.map(value => [value.id, value]));
  const root = new TransformNode(owned.mesh.id, scene);
  const meshes: Mesh[] = [];
  const materials: StandardMaterial[] = [];
  const bindings: BaroCadBooleanBabylonMeshBinding[] = [];
  const release = () => {
    for (const mesh of meshes) mesh.dispose(false, false);
    for (const material of materials) material.dispose(false, false);
    root.dispose(false, false);
  };
  try {
    for (const component of owned.triangulation.components) {
      const indices = component.triangleIds.flatMap(id => {
        const triangle = triangles.get(id);
        if (!triangle || triangle.componentId !== component.componentId) {
          throw new RangeError('Boolean Babylon mesh triangle differs from native component');
        }
        return triangle.vertexIndices;
      });
      if (!indices.length) throw new RangeError('Boolean Babylon mesh component has no triangles');
      const mesh = new Mesh(component.componentId, scene);
      meshes.push(mesh);
      mesh.setVerticesData(VertexBuffer.PositionKind, positions, false, 3);
      mesh.setVerticesData(VertexBuffer.NormalKind, normals, false, 3);
      mesh.setVerticesData('_CAD_UV', parameters, false, 2);
      mesh.setIndices(indices);
      const material = new StandardMaterial(`${component.componentId}_material`, scene);
      materials.push(material);
      material.backFaceCulling = false;
      material.disableLighting = true;
      material.emissiveColor = new Color3(0.48, 0.36, 0.96);
      mesh.material = material;
      mesh.parent = root;
      bindings.push(Object.freeze({
        meshId: owned.mesh.id, evaluationId: owned.mesh.binding.evaluationId,
        supportId: owned.mesh.binding.supportId,
        sourceAssetIds: Object.freeze([...owned.mesh.binding.sourceAssetIds]),
        operands: Object.freeze({
          a: Object.freeze({ ...owned.mesh.binding.a }),
          b: Object.freeze({ ...owned.mesh.binding.b }) }),
        componentId: component.componentId, outerLoopId: component.outerLoopId,
        holeLoopIds: Object.freeze([...component.holeLoopIds]),
        vertexIndices: Object.freeze([...component.vertexIndices]),
        triangleIds: Object.freeze([...component.triangleIds]),
        boundaryPathIds: Object.freeze(owned.boundaryPaths.filter(path =>
          path.componentId === component.componentId).map(path => path.fragmentId)),
        internalEdgeIds: Object.freeze(owned.triangulation.internalEdges.filter(edge =>
          edge.componentId === component.componentId).map(edge => edge.id)),
        bridgeIds: Object.freeze(owned.triangulation.bridges.filter(bridge =>
          bridge.componentId === component.componentId).map(bridge => bridge.id)),
        object: mesh,
      }));
    }
    if (bindings.length !== owned.report.componentCount ||
        bindings.reduce((sum, binding) => sum + binding.triangleIds.length, 0) !== owned.report.triangleCount) {
      throw new RangeError('Boolean Babylon mesh omitted a native component or triangle');
    }
    let disposed = false;
    return Object.freeze({ root, bindings: Object.freeze(bindings),
      boundaryPaths: Object.freeze(owned.boundaryPaths),
      internalEdges: Object.freeze(owned.triangulation.internalEdges),
      bridges: Object.freeze(owned.triangulation.bridges),
      dispose() {
        if (disposed) return;
        disposed = true;
        release();
      } });
  } catch (error) {
    release();
    throw error;
  }
}
