import { validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import type { CoplanarFaceBooleanExtrusionMeshResult } from '@barocss/cad';
import { DRAW_MODES } from 'pixi.js';
import { Color, Container3D, Mesh3D, MeshGeometry3D, StandardMaterial } from 'pixi3d/pixi7';

type FaceRange = CoplanarFaceBooleanExtrusionMeshResult['faceRanges'][number];
type EdgePath = CoplanarFaceBooleanExtrusionMeshResult['edgePaths'][number];

export interface BaroCadBooleanExtrusionPixi3DMeshOptions {
  unitsPerMillimeter: 0.001;
  /** Host assertion: authored XYZ matches the right-handed Y-up view. */
  basis: 'authored-xyz-matches-rhyup';
}

export interface BaroCadBooleanExtrusionPixi3DShellBinding {
  readonly shellId: string;
  readonly componentId: string;
  readonly nativeFaceIds: ReadonlyArray<string>;
  readonly nativeEdgeIds: ReadonlyArray<string>;
  readonly faces: Container3D;
  readonly edges: Container3D;
}

export interface BaroCadBooleanExtrusionPixi3DFaceBinding {
  readonly meshId: string;
  readonly extrusionEvaluationId: string;
  readonly booleanEvaluationId: string;
  readonly sourceAssetIds: ReadonlyArray<string>;
  readonly face: Readonly<FaceRange>;
  /** Native dimensionless CAD parameters; Pixi texture UV is unset. */
  readonly cadParametersUV: ReadonlyArray<number>;
  readonly object: Mesh3D;
}

export interface BaroCadBooleanExtrusionPixi3DEdgeBinding {
  readonly meshId: string;
  readonly path: Readonly<EdgePath>;
  readonly object: Mesh3D;
}

export interface BaroCadBooleanExtrusionPixi3DMeshResult {
  /** Caller attaches this root for the filled native Shell faces. */
  readonly root: Container3D;
  /** Caller attaches this separate root to show true native Curve sample paths. */
  readonly edgeRoot: Container3D;
  readonly shells: ReadonlyArray<BaroCadBooleanExtrusionPixi3DShellBinding>;
  readonly faces: ReadonlyArray<BaroCadBooleanExtrusionPixi3DFaceBinding>;
  readonly edges: ReadonlyArray<BaroCadBooleanExtrusionPixi3DEdgeBinding>;
  /** Display triangulation edges are metadata, never CAD Curve Mesh3D objects. */
  readonly internalEdges: ReadonlyArray<FaceRange['internalEdges'][number]>;
  dispose(): void;
}

function ownOptions(input: BaroCadBooleanExtrusionPixi3DMeshOptions): BaroCadBooleanExtrusionPixi3DMeshOptions {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Pixi3D Shell options must be plain own data');
  }
  const keys = Reflect.ownKeys(input);
  const fields = Object.getOwnPropertyDescriptors(input);
  if (keys.length !== 2 || !keys.every(key => typeof key === 'string' &&
      ['unitsPerMillimeter', 'basis'].includes(key) && fields[key].enumerable && 'value' in fields[key]) ||
      fields.unitsPerMillimeter?.value !== 0.001 ||
      fields.basis?.value !== 'authored-xyz-matches-rhyup') {
    throw new RangeError('Pixi3D Shell requires fixed mm scale and matching Y-up basis');
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
      throw new RangeError(`Pixi3D Shell ${label} is not Float32 representable`);
    }
    output[index] = rounded;
  }
  return output;
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
      throw new RangeError('Pixi3D Shell triangle collapses or flips in Float32');
    }
  }
}

function disposeMesh(mesh: Mesh3D): void {
  mesh.parent?.removeChild(mesh);
  mesh.destroy({ children: false, geometry: true, material: true });
}

/** Display validated native Shell faces and true Curve samples in pinned Pixi3D. */
export function createBaroCadBooleanExtrusionPixi3DMesh(
  result: CoplanarFaceBooleanExtrusionMeshResult,
  options: BaroCadBooleanExtrusionPixi3DMeshOptions,
): BaroCadBooleanExtrusionPixi3DMeshResult {
  validateCoplanarFaceBooleanExtrusionMesh(result);
  const owned = structuredClone(result);
  const request = ownOptions(options);
  const positions = floatValues(owned.mesh.positionsMM, request.unitsPerMillimeter, 'position');
  const normals = floatValues(owned.mesh.normals, 1, 'normal');
  const cadUV = floatValues(owned.mesh.parametersUV, 1, 'CAD UV');
  assertTriangles(positions, normals, owned.mesh.indices);
  if (owned.mesh.indices.some(index => index < 0 || index > 65535)) {
    throw new RangeError('Pixi3D Shell indices exceed Uint16');
  }
  const edgePositions = owned.edgePaths.map(path => {
    const values = floatValues(path.samples.flatMap(sample => sample.curveD1.point),
      request.unitsPerMillimeter, 'Curve sample');
    if (values.length !== 9) throw new RangeError('Pixi3D Shell expects three native Curve samples');
    for (let index = 3; index < values.length; index += 3) {
      if (values[index] === values[index - 3] && values[index + 1] === values[index - 2] &&
          values[index + 2] === values[index - 1]) {
        throw new RangeError('Pixi3D Shell Curve segment collapses in Float32');
      }
    }
    return values;
  });

  const root = new Container3D();
  const edgeRoot = new Container3D();
  const meshes: Mesh3D[] = [];
  const containers: Container3D[] = [];
  const shells: BaroCadBooleanExtrusionPixi3DShellBinding[] = [];
  const faces: BaroCadBooleanExtrusionPixi3DFaceBinding[] = [];
  const edges: BaroCadBooleanExtrusionPixi3DEdgeBinding[] = [];
  const release = () => {
    root.parent?.removeChild(root);
    edgeRoot.parent?.removeChild(edgeRoot);
    for (const mesh of meshes) disposeMesh(mesh);
    for (const container of containers) {
      container.parent?.removeChild(container);
      container.destroy({ children: false });
    }
    root.destroy({ children: false });
    edgeRoot.destroy({ children: false });
  };
  const faceBounds = positions.length ? bounds(positions) : null;
  try {
    for (const shell of owned.shellRanges) {
      const faceGroup = new Container3D(); containers.push(faceGroup); root.addChild(faceGroup);
      const edgeGroup = new Container3D(); containers.push(edgeGroup); edgeRoot.addChild(edgeGroup);
      shells.push(Object.freeze({ shellId: shell.shellId, componentId: shell.componentId,
        nativeFaceIds: Object.freeze([...shell.nativeFaceIds]),
        nativeEdgeIds: Object.freeze([...shell.nativeEdgeIds]), faces: faceGroup, edges: edgeGroup }));
      for (const rangeIndex of shell.faceRangeIndices) {
        const face = owned.faceRanges[rangeIndex];
        const indices = owned.mesh.indices.slice(face.indexStart, face.indexStart + face.indexCount);
        const geometry = new MeshGeometry3D();
        let material: StandardMaterial | undefined;
        let mesh: Mesh3D | undefined;
        try {
          geometry.positions = { buffer: positions.slice(), componentType: 5126, componentCount: 3,
            normalized: false, ...faceBounds! };
          geometry.normals = { buffer: normals.slice(), componentType: 5126,
            componentCount: 3, normalized: false };
          geometry.indices = { buffer: Uint16Array.from(indices), componentType: 5123,
            componentCount: 1, normalized: false };
          material = new StandardMaterial();
          material.unlit = true;
          material.doubleSided = true;
          material.baseColor = new Color(0.48, 0.36, 0.96);
          mesh = new Mesh3D(geometry, material);
          meshes.push(mesh);
          faceGroup.addChild(mesh);
          faces.push(Object.freeze({ meshId: owned.mesh.id,
            extrusionEvaluationId: owned.mesh.binding.extrusionEvaluationId,
            booleanEvaluationId: owned.mesh.binding.booleanEvaluationId,
            sourceAssetIds: Object.freeze([...owned.mesh.binding.sourceAssetIds]),
            face, cadParametersUV: Object.freeze(Array.from(cadUV)), object: mesh }));
        } catch (error) {
          if (!mesh) { geometry.destroy(); material?.destroy(); }
          throw error;
        }
      }
      for (const pathIndex of shell.edgePathIndices) {
        const path = owned.edgePaths[pathIndex];
        const values = edgePositions[pathIndex];
        const geometry = new MeshGeometry3D();
        let material: StandardMaterial | undefined;
        let mesh: Mesh3D | undefined;
        try {
          geometry.positions = { buffer: values.slice(), componentType: 5126, componentCount: 3,
            normalized: false, ...bounds(values) };
          // Required by the unlit Pixi3D shader, not native Curve normals.
          const shaderNormals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
          geometry.normals = { buffer: shaderNormals, componentType: 5126,
            componentCount: 3, normalized: false };
          geometry.indices = { buffer: new Uint16Array([0, 1, 2]), componentType: 5123,
            componentCount: 1, normalized: false };
          material = new StandardMaterial();
          material.unlit = true;
          material.doubleSided = true;
          material.baseColor = new Color(1, 0.75, 0.25);
          material.drawMode = DRAW_MODES.LINE_STRIP;
          mesh = new Mesh3D(geometry, material);
          meshes.push(mesh);
          edgeGroup.addChild(mesh);
          edges.push(Object.freeze({ meshId: owned.mesh.id, path, object: mesh }));
        } catch (error) {
          if (!mesh) { geometry.destroy(); material?.destroy(); }
          throw error;
        }
      }
    }
    if (shells.length !== owned.report.shellRangeCount || faces.length !== owned.report.faceRangeCount ||
        edges.length !== owned.report.edgePathCount ||
        faces.reduce((sum, binding) => sum + binding.face.triangleCount, 0) !== owned.report.triangleCount) {
      throw new RangeError('Pixi3D Shell omitted a native face, triangle or true edge');
    }
    let disposed = false;
    return Object.freeze({ root, edgeRoot, shells: Object.freeze(shells),
      faces: Object.freeze(faces), edges: Object.freeze(edges),
      internalEdges: Object.freeze(owned.faceRanges.flatMap(face => face.internalEdges)),
      dispose() { if (disposed) return; disposed = true; release(); } });
  } catch (error) { release(); throw error; }
}
