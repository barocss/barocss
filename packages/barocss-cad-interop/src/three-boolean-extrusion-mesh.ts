import { validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import type { CoplanarFaceBooleanExtrusionMeshResult } from '@barocss/cad';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Line, LineBasicMaterial,
  Mesh, MeshNormalMaterial } from 'three';

type FaceRange = CoplanarFaceBooleanExtrusionMeshResult['faceRanges'][number];
type EdgePath = CoplanarFaceBooleanExtrusionMeshResult['edgePaths'][number];

export interface BaroCadBooleanExtrusionThreeMeshOptions {
  unitsPerMillimeter: 0.001;
  /** Host assertion: authored XYZ is the scene's right-handed Y-up frame. */
  basis: 'authored-xyz-matches-rhyup';
}

export interface BaroCadBooleanExtrusionThreeShellBinding {
  readonly shellId: string;
  readonly componentId: string;
  readonly nativeFaceIds: ReadonlyArray<string>;
  readonly nativeEdgeIds: ReadonlyArray<string>;
  readonly faces: Group;
  readonly edges: Group;
}

export interface BaroCadBooleanExtrusionThreeFaceBinding {
  readonly meshId: string;
  readonly extrusionEvaluationId: string;
  readonly booleanEvaluationId: string;
  readonly sourceAssetIds: ReadonlyArray<string>;
  readonly face: Readonly<FaceRange>;
  readonly object: Mesh<BufferGeometry, MeshNormalMaterial>;
}

export interface BaroCadBooleanExtrusionThreeEdgeBinding {
  readonly meshId: string;
  readonly path: Readonly<EdgePath>;
  readonly object: Line<BufferGeometry, LineBasicMaterial>;
}

export interface BaroCadBooleanExtrusionThreeMeshResult {
  /** Host attaches this root to draw native face-local triangles. */
  readonly root: Group;
  /** Host attaches this separate root to show only true native Curve paths. */
  readonly edgeRoot: Group;
  readonly shells: ReadonlyArray<BaroCadBooleanExtrusionThreeShellBinding>;
  readonly faces: ReadonlyArray<BaroCadBooleanExtrusionThreeFaceBinding>;
  readonly edges: ReadonlyArray<BaroCadBooleanExtrusionThreeEdgeBinding>;
  /** Copied native display-only diagonals and bridges. Never CAD edges. */
  readonly internalEdges: ReadonlyArray<FaceRange['internalEdges'][number]>;
  dispose(): void;
}

function ownOptions(input: BaroCadBooleanExtrusionThreeMeshOptions): BaroCadBooleanExtrusionThreeMeshOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Three Shell options must be plain own data');
  }
  const keys = Reflect.ownKeys(input);
  const fields = Object.getOwnPropertyDescriptors(input);
  if (keys.length !== 2 || !keys.every(key => typeof key === 'string' &&
      ['unitsPerMillimeter', 'basis'].includes(key) && fields[key].enumerable && 'value' in fields[key]) ||
      fields.unitsPerMillimeter?.value !== 0.001 ||
      fields.basis?.value !== 'authored-xyz-matches-rhyup') {
    throw new RangeError('Three Shell requires fixed mm scale and matching Y-up basis');
  }
  return { unitsPerMillimeter: 0.001, basis: 'authored-xyz-matches-rhyup' };
}

function floatValues(values: ReadonlyArray<number>, scale: number, label: string): Float32Array {
  const output = new Float32Array(values.length);
  for (let index = 0; index < values.length; index++) {
    const converted = values[index] * scale;
    const rounded = Math.fround(converted);
    if (!Number.isFinite(converted) || !Number.isFinite(rounded) ||
        (values[index] !== 0 && rounded === 0)) {
      throw new RangeError(`Three Shell ${label} is not Float32 representable`);
    }
    output[index] = rounded;
  }
  return output;
}

function assertTriangles(positions: Float32Array, normals: Float32Array, indices: ReadonlyArray<number>): void {
  for (let offset = 0; offset < indices.length; offset += 3) {
    const [a, b, c] = indices.slice(offset, offset + 3);
    const component = (vertex: number, axis: number) => positions[3 * vertex + axis];
    const ab = [0, 1, 2].map(axis => component(b, axis) - component(a, axis));
    const ac = [0, 1, 2].map(axis => component(c, axis) - component(a, axis));
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0]];
    const dot = cross.reduce((sum, value, axis) => sum + value * normals[3 * a + axis], 0);
    if (!Number.isFinite(dot) || dot <= 0) {
      throw new RangeError('Three Shell triangle collapsed or changed winding in Float32');
    }
  }
}

/** Display validated native Shell faces and true Curve paths as separately owned Three objects. */
export function createBaroCadBooleanExtrusionThreeMesh(
  result: CoplanarFaceBooleanExtrusionMeshResult, options: BaroCadBooleanExtrusionThreeMeshOptions,
): BaroCadBooleanExtrusionThreeMeshResult {
  validateCoplanarFaceBooleanExtrusionMesh(result);
  const owned = structuredClone(result);
  const request = ownOptions(options);
  const positions = floatValues(owned.mesh.positionsMM, request.unitsPerMillimeter, 'position');
  const normals = floatValues(owned.mesh.normals, 1, 'normal');
  const cadUV = floatValues(owned.mesh.parametersUV, 1, 'CAD UV');
  assertTriangles(positions, normals, owned.mesh.indices);
  const edgePositions = owned.edgePaths.map(path => {
    const values = floatValues(path.samples.flatMap(sample => sample.curveD1.point),
      request.unitsPerMillimeter, 'Curve sample');
    for (let index = 3; index < values.length; index += 3) {
      if (values[index] === values[index - 3] && values[index + 1] === values[index - 2] &&
          values[index + 2] === values[index - 1]) {
        throw new RangeError('Three Shell Curve segment collapsed in Float32');
      }
    }
    return values;
  });

  const root = new Group(); root.name = owned.mesh.id;
  const edgeRoot = new Group(); edgeRoot.name = owned.mesh.id + '_true_edges';
  const geometries: BufferGeometry[] = [];
  const materials: Array<MeshNormalMaterial | LineBasicMaterial> = [];
  const shells: BaroCadBooleanExtrusionThreeShellBinding[] = [];
  const faces: BaroCadBooleanExtrusionThreeFaceBinding[] = [];
  const edges: BaroCadBooleanExtrusionThreeEdgeBinding[] = [];
  const release = () => {
    root.removeFromParent(); edgeRoot.removeFromParent();
    root.clear(); edgeRoot.clear();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  };
  try {
    for (const shell of owned.shellRanges) {
      const faceGroup = new Group(); faceGroup.name = shell.shellId;
      const edgeGroup = new Group(); edgeGroup.name = shell.shellId;
      root.add(faceGroup); edgeRoot.add(edgeGroup);
      shells.push(Object.freeze({ shellId: shell.shellId, componentId: shell.componentId,
        nativeFaceIds: Object.freeze([...shell.nativeFaceIds]),
        nativeEdgeIds: Object.freeze([...shell.nativeEdgeIds]), faces: faceGroup, edges: edgeGroup }));
      for (const rangeIndex of shell.faceRangeIndices) {
        const face = owned.faceRanges[rangeIndex];
        const geometry = new BufferGeometry(); geometries.push(geometry);
        geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
        geometry.setAttribute('_CAD_UV', new Float32BufferAttribute(cadUV, 2));
        geometry.setIndex(owned.mesh.indices.slice(face.indexStart, face.indexStart + face.indexCount));
        const material = new MeshNormalMaterial({ side: DoubleSide }); materials.push(material);
        const object = new Mesh(geometry, material); object.name = face.faceId;
        faceGroup.add(object);
        faces.push(Object.freeze({ meshId: owned.mesh.id,
          extrusionEvaluationId: owned.mesh.binding.extrusionEvaluationId,
          booleanEvaluationId: owned.mesh.binding.booleanEvaluationId,
          sourceAssetIds: Object.freeze([...owned.mesh.binding.sourceAssetIds]), face, object }));
      }
      for (const pathIndex of shell.edgePathIndices) {
        const path = owned.edgePaths[pathIndex];
        const geometry = new BufferGeometry(); geometries.push(geometry);
        geometry.setAttribute('position', new Float32BufferAttribute(edgePositions[pathIndex], 3));
        const material = new LineBasicMaterial({ color: 0xffc857 }); materials.push(material);
        const object = new Line(geometry, material); object.name = path.edgeId;
        edgeGroup.add(object);
        edges.push(Object.freeze({ meshId: owned.mesh.id, path, object }));
      }
    }
    if (shells.length !== owned.report.shellRangeCount || faces.length !== owned.report.faceRangeCount ||
        edges.length !== owned.report.edgePathCount ||
        faces.reduce((sum, binding) => sum + binding.face.triangleCount, 0) !== owned.report.triangleCount) {
      throw new RangeError('Three Shell omitted a native face, triangle or true edge');
    }
    let disposed = false;
    return Object.freeze({ root, edgeRoot, shells: Object.freeze(shells), faces: Object.freeze(faces),
      edges: Object.freeze(edges),
      internalEdges: Object.freeze(owned.faceRanges.flatMap(face => face.internalEdges)),
      dispose() { if (disposed) return; disposed = true; release(); } });
  } catch (error) { release(); throw error; }
}
