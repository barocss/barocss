import { validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import type { CoplanarFaceBooleanExtrusionMeshResult } from '@barocss/cad';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import type { Scene } from '@babylonjs/core/scene.js';

type FaceRange = CoplanarFaceBooleanExtrusionMeshResult['faceRanges'][number];
type EdgePath = CoplanarFaceBooleanExtrusionMeshResult['edgePaths'][number];

export interface BaroCadBooleanExtrusionBabylonMeshOptions {
  unitsPerMillimeter: 0.001;
  /** Host assertion: authored XYZ matches the right-handed Y-up Scene. */
  basis: 'authored-xyz-matches-rhyup';
}

export interface BaroCadBooleanExtrusionBabylonShellBinding {
  readonly shellId: string;
  readonly componentId: string;
  readonly nativeFaceIds: ReadonlyArray<string>;
  readonly nativeEdgeIds: ReadonlyArray<string>;
  readonly faces: TransformNode;
  readonly edges: TransformNode;
}

export interface BaroCadBooleanExtrusionBabylonFaceBinding {
  readonly meshId: string;
  readonly extrusionEvaluationId: string;
  readonly booleanEvaluationId: string;
  readonly sourceAssetIds: ReadonlyArray<string>;
  readonly face: Readonly<FaceRange>;
  readonly object: Mesh;
}

export interface BaroCadBooleanExtrusionBabylonEdgeBinding {
  readonly meshId: string;
  readonly path: Readonly<EdgePath>;
  readonly object: LinesMesh;
}

export interface BaroCadBooleanExtrusionBabylonMeshResult {
  /** Caller attaches this node to display the filled native face-local meshes. */
  readonly root: TransformNode;
  /** Caller enables this initially disabled node to display only true Curve sample paths. */
  readonly edgeRoot: TransformNode;
  readonly shells: ReadonlyArray<BaroCadBooleanExtrusionBabylonShellBinding>;
  readonly faces: ReadonlyArray<BaroCadBooleanExtrusionBabylonFaceBinding>;
  readonly edges: ReadonlyArray<BaroCadBooleanExtrusionBabylonEdgeBinding>;
  readonly internalEdges: ReadonlyArray<FaceRange['internalEdges'][number]>;
  dispose(): void;
}

function ownOptions(input: BaroCadBooleanExtrusionBabylonMeshOptions): BaroCadBooleanExtrusionBabylonMeshOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Babylon Shell options must be plain own data');
  }
  const keys = Reflect.ownKeys(input);
  const fields = Object.getOwnPropertyDescriptors(input);
  if (keys.length !== 2 || !keys.every(key => typeof key === 'string' &&
      ['unitsPerMillimeter', 'basis'].includes(key) && fields[key].enumerable && 'value' in fields[key]) ||
      fields.unitsPerMillimeter?.value !== 0.001 ||
      fields.basis?.value !== 'authored-xyz-matches-rhyup') {
    throw new RangeError('Babylon Shell requires fixed mm scale and matching Y-up basis');
  }
  return { unitsPerMillimeter: 0.001, basis: 'authored-xyz-matches-rhyup' };
}

function floatValues(values: ReadonlyArray<number>, scale: number, label: string): Float32Array {
  const output = new Float32Array(values.length);
  for (let index = 0; index < values.length; index++) {
    const converted = values[index] * scale;
    const value = Math.fround(converted);
    if (!Number.isFinite(converted) || !Number.isFinite(value) ||
        (values[index] !== 0 && value === 0)) {
      throw new RangeError(`Babylon Shell ${label} is not Float32 representable`);
    }
    output[index] = value;
  }
  return output;
}

function assertTriangles(positions: Float32Array, normals: Float32Array, indices: ReadonlyArray<number>): void {
  for (let offset = 0; offset < indices.length; offset += 3) {
    const [a, b, c] = indices.slice(offset, offset + 3).map(index => index * 3);
    const ab = [0, 1, 2].map(axis => positions[b + axis] - positions[a + axis]);
    const ac = [0, 1, 2].map(axis => positions[c + axis] - positions[a + axis]);
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0]];
    if (!Number.isFinite(Math.hypot(...cross)) || Math.hypot(...cross) === 0 ||
        [a, b, c].some(vertex => cross.reduce((sum, value, axis) =>
          sum + value * normals[vertex + axis], 0) <= 0)) {
      throw new RangeError('Babylon Shell triangle collapses or flips in Float32');
    }
  }
}

/** Display validated native Shell faces and true Curve samples in a caller Scene. */
export function createBaroCadBooleanExtrusionBabylonMesh(
  scene: Scene, result: CoplanarFaceBooleanExtrusionMeshResult,
  options: BaroCadBooleanExtrusionBabylonMeshOptions,
): BaroCadBooleanExtrusionBabylonMeshResult {
  if (!scene || scene.useRightHandedSystem !== true || scene.isDisposed) {
    throw new RangeError('Babylon Shell requires a live right-handed caller Scene');
  }
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
    if (values.length !== 9) throw new RangeError('Babylon Shell expects three native Curve samples');
    for (let index = 3; index < values.length; index += 3) {
      if (values[index] === values[index - 3] && values[index + 1] === values[index - 2] &&
          values[index + 2] === values[index - 1]) {
        throw new RangeError('Babylon Shell Curve segment collapses in Float32');
      }
    }
    return values;
  });

  const root = new TransformNode(owned.mesh.id, scene);
  const edgeRoot = new TransformNode(owned.mesh.id + '_true_edges', scene);
  edgeRoot.setEnabled(false);
  const faceMeshes: Mesh[] = [], lineMeshes: LinesMesh[] = [], materials: StandardMaterial[] = [];
  const shellNodes: TransformNode[] = [];
  const shells: BaroCadBooleanExtrusionBabylonShellBinding[] = [];
  const faces: BaroCadBooleanExtrusionBabylonFaceBinding[] = [];
  const edges: BaroCadBooleanExtrusionBabylonEdgeBinding[] = [];
  const release = () => {
    for (const mesh of faceMeshes) mesh.dispose(false, false);
    for (const line of lineMeshes) line.dispose(false, false);
    for (const material of materials) material.dispose(false, false);
    for (const node of shellNodes) node.dispose(false, false);
    root.dispose(false, false); edgeRoot.dispose(false, false);
  };
  try {
    for (const shell of owned.shellRanges) {
      const faceGroup = new TransformNode(shell.shellId, scene);
      shellNodes.push(faceGroup); faceGroup.parent = root;
      const edgeGroup = new TransformNode(shell.shellId + '_true_edges', scene);
      shellNodes.push(edgeGroup); edgeGroup.parent = edgeRoot;
      shells.push(Object.freeze({ shellId: shell.shellId, componentId: shell.componentId,
        nativeFaceIds: Object.freeze([...shell.nativeFaceIds]),
        nativeEdgeIds: Object.freeze([...shell.nativeEdgeIds]), faces: faceGroup, edges: edgeGroup }));
      for (const rangeIndex of shell.faceRangeIndices) {
        const face = owned.faceRanges[rangeIndex];
        const mesh = new Mesh(face.faceId, scene); faceMeshes.push(mesh);
        mesh.setVerticesData(VertexBuffer.PositionKind, positions, false, 3);
        mesh.setVerticesData(VertexBuffer.NormalKind, normals, false, 3);
        mesh.setVerticesData('_CAD_UV', cadUV, false, 2);
        mesh.setIndices(owned.mesh.indices.slice(face.indexStart, face.indexStart + face.indexCount));
        const material = new StandardMaterial(`${face.faceId}_material`, scene); materials.push(material);
        material.backFaceCulling = false;
        material.disableLighting = true;
        material.emissiveColor = new Color3(0.48, 0.36, 0.96);
        mesh.material = material; mesh.parent = faceGroup;
        faces.push(Object.freeze({ meshId: owned.mesh.id,
          extrusionEvaluationId: owned.mesh.binding.extrusionEvaluationId,
          booleanEvaluationId: owned.mesh.binding.booleanEvaluationId,
          sourceAssetIds: Object.freeze([...owned.mesh.binding.sourceAssetIds]), face, object: mesh }));
      }
      for (const pathIndex of shell.edgePathIndices) {
        const path = owned.edgePaths[pathIndex];
        const values = edgePositions[pathIndex];
        const points = [0, 1, 2].map(index => new Vector3(
          values[3 * index], values[3 * index + 1], values[3 * index + 2]));
        const line = MeshBuilder.CreateLines(path.edgeId, { points }, scene);
        lineMeshes.push(line); line.color = new Color3(1, 0.75, 0.25);
        line.parent = edgeGroup;
        edges.push(Object.freeze({ meshId: owned.mesh.id, path, object: line }));
      }
    }
    if (shells.length !== owned.report.shellRangeCount || faces.length !== owned.report.faceRangeCount ||
        edges.length !== owned.report.edgePathCount ||
        faces.reduce((sum, binding) => sum + binding.face.triangleCount, 0) !== owned.report.triangleCount) {
      throw new RangeError('Babylon Shell omitted a native face, triangle or true edge');
    }
    let disposed = false;
    return Object.freeze({ root, edgeRoot, shells: Object.freeze(shells),
      faces: Object.freeze(faces), edges: Object.freeze(edges),
      internalEdges: Object.freeze(owned.faceRanges.flatMap(face => face.internalEdges)),
      dispose() { if (disposed) return; disposed = true; release(); } });
  } catch (error) { release(); throw error; }
}
