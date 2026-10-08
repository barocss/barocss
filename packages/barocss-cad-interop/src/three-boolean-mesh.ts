import { validateCoplanarFaceBooleanMesh } from '@barocss/cad';
import type { CoplanarFaceBooleanMeshBoundaryPath, CoplanarFaceBooleanMeshResult,
  CoplanarFaceBooleanMeshTriangulation } from '@barocss/cad';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshNormalMaterial } from 'three';

export interface BaroCadBooleanThreeMeshOptions {
  unitsPerMillimeter: number;
  /** Host assertion that authored XYZ matches the right-handed Y-up Scene. */
  basis: 'authored-xyz-matches-rhyup';
}

export interface BaroCadBooleanThreeMeshBinding {
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
  /** Original native fragment boundary paths, never display diagonals or bridges. */
  readonly boundaryPathIds: ReadonlyArray<string>;
  readonly internalEdgeIds: ReadonlyArray<string>;
  readonly bridgeIds: ReadonlyArray<string>;
  readonly object: Mesh<BufferGeometry, MeshNormalMaterial>;
}

export interface BaroCadBooleanThreeMeshResult {
  readonly root: Group;
  readonly bindings: ReadonlyArray<BaroCadBooleanThreeMeshBinding>;
  /** Copied native authority; boundary paths and display-internal edges stay distinct. */
  readonly boundaryPaths: ReadonlyArray<CoplanarFaceBooleanMeshBoundaryPath>;
  readonly internalEdges: ReadonlyArray<CoplanarFaceBooleanMeshTriangulation['internalEdges'][number]>;
  readonly bridges: ReadonlyArray<CoplanarFaceBooleanMeshTriangulation['bridges'][number]>;
  /** Releases only adapter-owned display resources. */
  dispose(): void;
}

function ownOptions(input: BaroCadBooleanThreeMeshOptions): BaroCadBooleanThreeMeshOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Boolean Three mesh options must be plain own data');
  }
  const keys = Reflect.ownKeys(input);
  const fields = Object.getOwnPropertyDescriptors(input);
  if (keys.length !== 2 || !keys.every(key => typeof key === 'string' &&
      ['unitsPerMillimeter', 'basis'].includes(key) && fields[key].enumerable && 'value' in fields[key]) ||
      !fields.unitsPerMillimeter || !fields.basis ||
      fields.basis.value !== 'authored-xyz-matches-rhyup') {
    throw new RangeError('Boolean Three mesh options require scale and matching Y-up basis');
  }
  const scale = fields.unitsPerMillimeter.value;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0 ||
      !Number.isFinite(Math.fround(scale)) || Math.fround(scale) === 0) {
    throw new RangeError('Boolean Three mesh scale must be finite and representable');
  }
  return { unitsPerMillimeter: scale, basis: fields.basis.value };
}

function scenePositions(positionsMM: number[], scale: number): Float32Array {
  const positions = new Float32Array(positionsMM.length);
  for (let index = 0; index < positionsMM.length; index++) {
    const value = positionsMM[index] * scale;
    const target = Math.fround(value);
    if (!Number.isFinite(value) || !Number.isFinite(target) ||
        (positionsMM[index] !== 0 && target === 0)) {
      throw new RangeError('Boolean Three mesh position is not representable in scene units');
    }
    positions[index] = target;
  }
  return positions;
}

/** Draw only the native filled Boolean material, with provenance kept separate. */
export function createBaroCadBooleanThreeMesh(
  result: CoplanarFaceBooleanMeshResult, options: BaroCadBooleanThreeMeshOptions,
): BaroCadBooleanThreeMeshResult {
  validateCoplanarFaceBooleanMesh(result);
  const owned = structuredClone(result);
  const request = ownOptions(options);
  const positions = scenePositions(owned.mesh.positionsMM, request.unitsPerMillimeter);
  const normals = Float32Array.from(owned.mesh.normals);
  const parameters = Float32Array.from(owned.mesh.parametersUV);
  if ([...normals, ...parameters].some(value => !Number.isFinite(value))) {
    throw new RangeError('Boolean Three mesh normal or UV is not representable as Float32');
  }
  const triangles = new Map(owned.triangulation.triangles.map(value => [value.id, value]));
  const root = new Group();
  root.name = owned.mesh.id;
  const geometries: BufferGeometry[] = [];
  const materials: MeshNormalMaterial[] = [];
  const bindings: BaroCadBooleanThreeMeshBinding[] = [];
  const release = () => {
    root.removeFromParent();
    root.clear();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  };
  try {
    for (const component of owned.triangulation.components) {
      const indices = component.triangleIds.flatMap(id => {
        const triangle = triangles.get(id);
        if (!triangle || triangle.componentId !== component.componentId) {
          throw new RangeError('Boolean Three mesh triangle differs from native component');
        }
        return triangle.vertexIndices;
      });
      if (!indices.length) throw new RangeError('Boolean Three mesh component has no triangles');
      const geometry = new BufferGeometry();
      geometries.push(geometry);
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
      geometry.setAttribute('_CAD_UV', new Float32BufferAttribute(parameters, 2));
      geometry.setIndex(indices);
      const material = new MeshNormalMaterial({ side: DoubleSide });
      materials.push(material);
      const object = new Mesh(geometry, material);
      object.name = component.componentId;
      root.add(object);
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
        object,
      }));
    }
    if (bindings.length !== owned.report.componentCount ||
        bindings.reduce((sum, binding) => sum + binding.triangleIds.length, 0) !== owned.report.triangleCount) {
      throw new RangeError('Boolean Three mesh omitted a native component or triangle');
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
