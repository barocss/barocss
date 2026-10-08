import { validateCoplanarFaceBooleanMesh } from '@barocss/cad';
import type { CoplanarFaceBooleanMeshBoundaryPath, CoplanarFaceBooleanMeshResult,
  CoplanarFaceBooleanMeshTriangulation } from '@barocss/cad';
import { Color, Container3D, Mesh3D, MeshGeometry3D, StandardMaterial } from 'pixi3d/pixi7';

export interface BaroCadBooleanPixi3DMeshOptions {
  unitsPerMillimeter: number;
  /** Host assertion that authored XYZ matches the right-handed Y-up view. */
  basis: 'authored-xyz-matches-rhyup';
}

export interface BaroCadBooleanPixi3DMeshBinding {
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
  /** Native dimensionless CAD parameters, not MeshGeometry3D texture UVs. */
  readonly cadParametersUV: ReadonlyArray<number>;
  readonly object: Mesh3D;
}

export interface BaroCadBooleanPixi3DMeshResult {
  readonly root: Container3D;
  readonly bindings: ReadonlyArray<BaroCadBooleanPixi3DMeshBinding>;
  readonly boundaryPaths: ReadonlyArray<CoplanarFaceBooleanMeshBoundaryPath>;
  readonly internalEdges: ReadonlyArray<CoplanarFaceBooleanMeshTriangulation['internalEdges'][number]>;
  readonly bridges: ReadonlyArray<CoplanarFaceBooleanMeshTriangulation['bridges'][number]>;
  /** Releases only adapter-owned display resources. */
  dispose(): void;
}

function ownOptions(input: BaroCadBooleanPixi3DMeshOptions): BaroCadBooleanPixi3DMeshOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Boolean Pixi3D mesh options must be plain own data');
  }
  const keys = Reflect.ownKeys(input);
  const fields = Object.getOwnPropertyDescriptors(input);
  if (keys.length !== 2 || !keys.every(key => typeof key === 'string' &&
      ['unitsPerMillimeter', 'basis'].includes(key) && fields[key].enumerable && 'value' in fields[key]) ||
      !fields.unitsPerMillimeter || !fields.basis ||
      fields.basis.value !== 'authored-xyz-matches-rhyup') {
    throw new RangeError('Boolean Pixi3D mesh options require scale and matching Y-up basis');
  }
  const scale = fields.unitsPerMillimeter.value;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0 ||
      !Number.isFinite(Math.fround(scale)) || Math.fround(scale) === 0) {
    throw new RangeError('Boolean Pixi3D mesh scale must be finite and representable');
  }
  return { unitsPerMillimeter: scale, basis: fields.basis.value };
}

function float32Data(values: number[], scale: number, label: string): Float32Array {
  const target = new Float32Array(values.length);
  for (let index = 0; index < values.length; index++) {
    const scaled = values[index] * scale;
    const value = Math.fround(scaled);
    if (!Number.isFinite(scaled) || !Number.isFinite(value) || (values[index] !== 0 && value === 0)) {
      throw new RangeError(`Boolean Pixi3D mesh ${label} is not representable as Float32`);
    }
    target[index] = value;
  }
  return target;
}

function limits(positions: Float32Array): { min: number[]; max: number[] } {
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

function disposeMesh(mesh: Mesh3D): void {
  mesh.parent?.removeChild(mesh);
  mesh.destroy({ children: false, geometry: true, material: true });
}

/** Draw only the validated native Boolean material in pinned Pixi3D. */
export function createBaroCadBooleanPixi3DMesh(
  result: CoplanarFaceBooleanMeshResult, options: BaroCadBooleanPixi3DMeshOptions,
): BaroCadBooleanPixi3DMeshResult {
  validateCoplanarFaceBooleanMesh(result);
  const owned = structuredClone(result);
  const request = ownOptions(options);
  const positions = float32Data(owned.mesh.positionsMM, request.unitsPerMillimeter, 'position');
  const normals = float32Data(owned.mesh.normals, 1, 'normal');
  const parameters = float32Data(owned.mesh.parametersUV, 1, 'CAD UV');
  const bounds = positions.length ? limits(positions) : null;
  const triangles = new Map(owned.triangulation.triangles.map(value => [value.id, value]));
  const root = new Container3D();
  const meshes: Mesh3D[] = [];
  const bindings: BaroCadBooleanPixi3DMeshBinding[] = [];
  const release = () => {
    root.parent?.removeChild(root);
    for (const mesh of meshes) disposeMesh(mesh);
    root.destroy({ children: false });
  };
  try {
    for (const component of owned.triangulation.components) {
      const indices = component.triangleIds.flatMap(id => {
        const triangle = triangles.get(id);
        if (!triangle || triangle.componentId !== component.componentId) {
          throw new RangeError('Boolean Pixi3D mesh triangle differs from native component');
        }
        return triangle.vertexIndices;
      });
      if (!indices.length || indices.some(index => index < 0 || index > 65535)) {
        throw new RangeError('Boolean Pixi3D mesh component indices exceed Uint16');
      }
      const geometry = new MeshGeometry3D();
      let material: StandardMaterial | undefined;
      let mesh: Mesh3D | undefined;
      try {
        geometry.positions = { buffer: positions.slice(), componentType: 5126, componentCount: 3,
          normalized: false, ...bounds! };
        geometry.normals = { buffer: normals.slice(), componentType: 5126, componentCount: 3,
          normalized: false };
        geometry.indices = { buffer: Uint16Array.from(indices), componentType: 5123,
          componentCount: 1, normalized: false };
        // Pixi's uvs attribute is texture UV, not native CAD parameter data.
        material = new StandardMaterial();
        material.unlit = true;
        material.doubleSided = true;
        material.baseColor = new Color(0.48, 0.36, 0.96);
        mesh = new Mesh3D(geometry, material);
        meshes.push(mesh);
        root.addChild(mesh);
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
          cadParametersUV: Object.freeze(Array.from(parameters)), object: mesh,
        }));
      } catch (error) {
        if (!mesh) {
          geometry.destroy();
          material?.destroy();
        }
        throw error;
      }
    }
    if (bindings.length !== owned.report.componentCount ||
        bindings.reduce((sum, binding) => sum + binding.triangleIds.length, 0) !== owned.report.triangleCount) {
      throw new RangeError('Boolean Pixi3D mesh omitted a native component or triangle');
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
