import { ownRecord } from './gpu-data.js';
import { prepareTriangleGeometry, TriangleGeometryError } from './triangle-geometry.js';
import type { TriangleGeometryV0, PreparedTriangleGeometry } from './triangle-geometry.js';
import { sceneRotation } from './mesh-scene-transform.js';
import { validateMeshCamera } from './camera.js';
import type { MeshCamera } from './camera.js';
import { validateMeshGeometry } from './mesh-packet.js';
import type { RGB, Vec3 } from './scene-types.js';

export const EngineSceneDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', BUDGET: 'BUDGET', REFERENCE: 'REFERENCE',
  TRANSFORM: 'TRANSFORM', GEOMETRY: 'GEOMETRY', REPRESENTATION: 'REPRESENTATION', CAMERA: 'CAMERA',
} as const);
export type EngineSceneDiagnosticCode = typeof EngineSceneDiagnosticCode[keyof typeof EngineSceneDiagnosticCode];
export class EngineSceneError extends Error {
  readonly code: EngineSceneDiagnosticCode;
  constructor(code: EngineSceneDiagnosticCode, detail: string, cause?: unknown) {
    super(('Engine scene: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'EngineSceneError'; this.code = code;
  }
}
export interface EngineSceneMaterialV0 { id: string; type: 'unlit'; colorSpace: 'linear'; color: RGB }
interface EngineSceneNodeTransform {
  id: string; parentId: string | null; translation: Vec3;
  rotationXYZW: [number, number, number, number]; scale: Vec3; visible: boolean;
}
export type EngineSceneNodeV0 = (EngineSceneNodeTransform & { type: 'group' })
  | (EngineSceneNodeTransform & { type: 'mesh'; geometryId: string; materialId: string });
export interface EngineSceneV0 {
  format: 'barocss-gpu-engine-scene'; version: 0; id: string;
  coordinateSystem: 'right-handed-y-up'; positionUnit: 'scene'; background: RGB; camera: MeshCamera;
  geometries: TriangleGeometryV0[]; materials: EngineSceneMaterialV0[]; nodes: EngineSceneNodeV0[];
}
type Matrix4 = [number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number];
type Matrix3 = [number, number, number, number, number, number, number, number, number];
type Bounds = { min: Vec3; max: Vec3 };
export interface PreparedEngineSceneNode {
  readonly id: string; readonly type: 'group' | 'mesh'; readonly parentId: string | null;
  readonly effectiveVisible: boolean; readonly worldMatrix: Matrix4; readonly normalMatrix: Matrix3;
  readonly worldMatrixF32: Float32Array; readonly normalMatrixF32: Float32Array; readonly bounds: Bounds | null;
}
export interface PreparedEngineSceneDraw {
  readonly id: string; readonly geometryId: string; readonly materialId: string;
  readonly geometry: PreparedTriangleGeometry; readonly material: EngineSceneMaterialV0;
  readonly node: PreparedEngineSceneNode;
}
export interface PreparedEngineScene {
  readonly scene: EngineSceneV0; readonly geometries: PreparedTriangleGeometry[];
  readonly nodes: PreparedEngineSceneNode[]; readonly draws: PreparedEngineSceneDraw[];
  readonly bufferBytes: number; readonly vertexWork: number;
}
const CODE = EngineSceneDiagnosticCode;
const ROOT_FIELDS = ['format', 'version', 'id', 'coordinateSystem', 'positionUnit',
  'background', 'camera', 'geometries', 'materials', 'nodes'];
const GEOMETRY_FIELDS = ['format', 'version', 'id', 'coordinateSystem', 'positionUnit',
  'winding', 'positions', 'normals', 'uvs', 'indices'];
const NODE_FIELDS = ['id', 'type', 'parentId', 'translation', 'rotationXYZW', 'scale', 'visible'];
function check(value: unknown, code: EngineSceneDiagnosticCode, detail: string): asserts value {
  if (!value) throw new EngineSceneError(code, detail);
}
function guard<T>(code: EngineSceneDiagnosticCode, detail: string, action: () => T): T {
  try { return action(); } catch (cause) {
    if (cause instanceof EngineSceneError) throw cause;
    throw new EngineSceneError(code, detail, cause);
  }
}
function record(input: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  return guard(CODE.INPUT, label + ' requires exact own plain data', () => ownRecord(input, fields, fields, label));
}
function identifier(input: unknown, label: string): string {
  check(typeof input === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(input), CODE.INPUT,
    label + ' must be an ASCII identifier of 1..64 characters'); return input;
}
function arrayLength(input: unknown, maximum: number, label: string): number {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype, CODE.INPUT,
    label + ' must be a plain array');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'length');
  check(descriptor && 'value' in descriptor && Number.isInteger(descriptor.value) && descriptor.value >= 0,
    CODE.INPUT, label + ' requires a plain array length');
  check(descriptor.value <= maximum, CODE.BUDGET, label + ' exceeds its cardinality limit');
  return descriptor.value as number;
}
function arrayDescriptors(input: unknown, length: number, label: string): void {
  const source = input as unknown[], keys = Reflect.ownKeys(source);
  check(keys.length === length + 1, CODE.INPUT, label + ' must be dense without hidden, extra or symbol fields');
  for (const key of keys) if (key !== 'length') {
    check(typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length,
      CODE.INPUT, label + ' has unsupported array keys');
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    check(descriptor && 'value' in descriptor && descriptor.enumerable, CODE.INPUT,
      label + ' elements must be own enumerable data');
  }
}
function ownArray(input: unknown, maximum: number, label: string): unknown[] {
  const length = arrayLength(input, maximum, label); arrayDescriptors(input, length, label);
  return Array.from({ length }, (_, i) => Object.getOwnPropertyDescriptor(input, String(i))!.value);
}
function numbers(input: unknown, count: number, label: string): number[] {
  const length = arrayLength(input, Number.MAX_SAFE_INTEGER, label);
  check(length === count, CODE.INPUT, label + ' has an incorrect fixed attribute count');
  arrayDescriptors(input, count, label);
  const values = Array.from({ length: count }, (_, i) => Object.getOwnPropertyDescriptor(input, String(i))!.value);
  check(values.every(n => typeof n === 'number' && Number.isFinite(n)),
    CODE.INPUT, label + ' requires ' + count + ' finite numeric values'); return values as number[];
}
function rgb(input: unknown, label: string): RGB {
  const value = numbers(input, 3, label) as RGB;
  check(value.every(n => n >= 0 && n <= 1), CODE.INPUT, label + ' requires linear RGB in 0..1');
  Object.freeze(value); return value;
}
function material(input: unknown): EngineSceneMaterialV0 {
  const data = record(input, ['id', 'type', 'colorSpace', 'color'], 'material');
  check(data.type === 'unlit' && data.colorSpace === 'linear', CODE.VERSION, 'Only unlit/linear material0 is supported');
  return Object.freeze({ id: identifier(data.id, 'material.id'), type: 'unlit', colorSpace: 'linear', color: rgb(data.color, 'material.color') });
}
function node(input: unknown): EngineSceneNodeV0 {
  const tag = guard(CODE.INPUT, 'Node fields must be own plain data', () => ownRecord(input,
    [...NODE_FIELDS, 'geometryId', 'materialId'], ['type'], 'node'));
  check(tag.type === 'group' || tag.type === 'mesh', CODE.INPUT, 'Node type must be group or mesh');
  const data = record(input, tag.type === 'group' ? NODE_FIELDS : [...NODE_FIELDS, 'geometryId', 'materialId'], 'node');
  const id = identifier(data.id, 'node.id'), parentId = data.parentId === null ? null : identifier(data.parentId, 'node.parentId');
  const translation = numbers(data.translation, 3, 'node.translation') as Vec3;
  const rotationXYZW = numbers(data.rotationXYZW, 4, 'node.rotationXYZW') as [number, number, number, number];
  const scale = numbers(data.scale, 3, 'node.scale') as Vec3;
  check(translation.every(n => Math.abs(n) <= 1000) && scale.every(n => n >= .01 && n <= 100)
    && rotationXYZW.every(n => Math.abs(n) <= 1) && Math.abs(Math.hypot(...rotationXYZW) - 1) <= 1e-9,
  CODE.TRANSFORM, 'Authored SRT requires bounded translation, positive scale and a unit quaternion within1e-9');
  check(typeof data.visible === 'boolean', CODE.INPUT, 'node.visible must be explicit boolean data');
  for (const array of [translation, rotationXYZW, scale]) Object.freeze(array);
  const common = { id, parentId, translation, rotationXYZW, scale, visible: data.visible };
  return tag.type === 'group' ? Object.freeze({ ...common, type: 'group' })
    : Object.freeze({ ...common, type: 'mesh', geometryId: identifier(data.geometryId, 'node.geometryId'), materialId: identifier(data.materialId, 'node.materialId') });
}
interface GeometryPreflight { input: unknown; data: Record<string, unknown>; lengths: Record<'positions' | 'normals' | 'uvs' | 'indices', number>; vertexCount: number }
function preflightGeometries(inputs: unknown[]): GeometryPreflight[] {
  let values = 0, vertices = 0, triangles = 0;
  const rows = inputs.map(input => {
    const data = record(input, GEOMETRY_FIELDS, 'geometry'), lengths = {
      positions: arrayLength(data.positions, 393216, 'geometry.positions'),
      normals: arrayLength(data.normals, 393216, 'geometry.normals'),
      uvs: arrayLength(data.uvs, 262144, 'geometry.uvs'),
      indices: arrayLength(data.indices, 393216, 'geometry.indices'),
    };
    values += lengths.positions + lengths.normals + lengths.uvs + lengths.indices;
    vertices += lengths.positions / 3; triangles += lengths.indices / 3;
    check(values <= 2883584 && vertices <= 262144 && triangles <= 262144,
      CODE.BUDGET, 'Aggregate geometry source slots, vertices or triangles exceed scene limits');
    return { input, data, lengths, vertexCount: lengths.positions / 3 };
  });
  // Reflection is bounded by all admitted lengths and aggregate ceilings. No
  // numerical geometry copy or typed buffer is allocated during this pass.
  for (const row of rows) for (const field of ['positions', 'normals', 'uvs', 'indices'] as const)
    arrayDescriptors(row.data[field], row.lengths[field], 'geometry.' + field);
  return rows;
}
function prepareGeometry(input: unknown): PreparedTriangleGeometry {
  try { return prepareTriangleGeometry(input); } catch (cause) {
    if (cause instanceof TriangleGeometryError) {
      const code = ['INPUT', 'VERSION', 'BUDGET', 'REPRESENTATION'].includes(cause.code)
        ? cause.code as EngineSceneDiagnosticCode : CODE.GEOMETRY;
      throw new EngineSceneError(code, 'Triangle resource preparation refused', cause);
    }
    throw new EngineSceneError(CODE.GEOMETRY, 'Triangle resource preparation refused', cause);
  }
}
function unique<T>(items: T[], getId: (item: T) => string, label: string): Map<string, T> {
  const result = new Map<string, T>(); for (const item of items) {
    const id = getId(item); check(!result.has(id), CODE.REFERENCE, 'Duplicate ' + label + ' ID: ' + id); result.set(id, item);
  } return result;
}
function localMatrix(source: EngineSceneNodeV0): Matrix4 {
  const rotate = sceneRotation({ translationMm: source.translation, rotationXYZW: source.rotationXYZW, scale: source.scale });
  const x = rotate(source.scale[0], 0, 0), y = rotate(0, source.scale[1], 0), z = rotate(0, 0, source.scale[2]);
  return [...x, 0, ...y, 0, ...z, 0, ...source.translation, 1] as Matrix4;
}
function multiply(a: Matrix4, b: Matrix4): Matrix4 {
  const result = new Array<number>(16);
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
    let value = a[row] * b[column * 4];
    for (let i = 1; i < 4; i++) value += a[i * 4 + row] * b[column * 4 + i];
    result[column * 4 + row] = value;
  }
  return result as Matrix4;
}
function normalMatrix(world: ArrayLike<number>, code: EngineSceneDiagnosticCode): Matrix3 {
  check(Array.from(world).every(n => Number.isFinite(n) && Math.abs(n) <= 1e6), code, 'Derived matrix entries must be finite and within1e6');
  check([world[12], world[13], world[14]].every(n => Math.abs(n) <= 1000), code, 'World translation exceeds1000 scene units');
  const a: Vec3 = [world[0], world[1], world[2]], b: Vec3 = [world[4], world[5], world[6]], c: Vec3 = [world[8], world[9], world[10]];
  const lengths = [Math.hypot(...a), Math.hypot(...b), Math.hypot(...c)];
  check(lengths.every(n => Number.isFinite(n) && n >= 1e-6 && n <= 1e6), code, 'World basis lengths must remain in1e-6..1e6');
  const cross = (u: Vec3, v: Vec3): Vec3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const bc = cross(b, c), ca = cross(c, a), ab = cross(a, b), determinant = a[0] * bc[0] + a[1] * bc[1] + a[2] * bc[2];
  check(Number.isFinite(determinant) && determinant > 0 && determinant / (lengths[0] * lengths[1] * lengths[2]) >= 1e-8,
    code, 'World matrix must have a positive normalized determinant of at least1e-8');
  const result = [...bc, ...ca, ...ab].map(n => n / determinant) as Matrix3;
  check(result.every(n => Number.isFinite(n) && Math.abs(n) <= 1e6), code, 'Inverse-transpose normal matrix exceeds finite1e6 bounds');
  return result;
}
function floatMatrix(matrix: number[]): Float32Array {
  for (const n of matrix) check(Number.isFinite(Math.fround(n)) && (n === 0 || Math.fround(n) !== 0),
    CODE.REPRESENTATION, 'A nonzero matrix entry loses finite Float32 representation');
  return Float32Array.from(matrix);
}
function numberVector(matrix: ArrayLike<number>, stride: 3 | 4, value: Vec3, translation: boolean): Vec3 {
  return [0, 1, 2].map(row => matrix[row] * value[0] + matrix[stride + row] * value[1]
    + matrix[2 * stride + row] * value[2] + (translation ? matrix[3 * stride + row] : 0)) as Vec3;
}
function f32Scalar(value: number): number {
  const result = Math.fround(value);
  check(Number.isFinite(result) && (value === 0 || result !== 0), CODE.REPRESENTATION,
    'A transformed component loses nonzero finite Float32 representation'); return result;
}
function f32Vector(matrix: Float32Array, stride: 3 | 4, value: Vec3, translation: boolean): Vec3 {
  return [0, 1, 2].map(row => {
    let result = Math.fround(matrix[row] * value[0]);
    result = Math.fround(result + Math.fround(matrix[stride + row] * value[1]));
    result = Math.fround(result + Math.fround(matrix[2 * stride + row] * value[2]));
    if (translation) result = Math.fround(result + matrix[3 * stride + row]);
    return result;
  }) as Vec3;
}
function normalize(value: Vec3, code: EngineSceneDiagnosticCode): Vec3 {
  const length = Math.hypot(...value); check(Number.isFinite(length) && length > 0, code, 'Transformed normal must have finite nonzero length');
  const result = value.map(n => n / length) as Vec3;
  check(result.every((n, i) => Number.isFinite(n) && (value[i] === 0 || n !== 0)), code, 'Transformed normal normalization loses finite nonzero data'); return result;
}
function transformedBounds(geometry: PreparedTriangleGeometry, world: Matrix4, normal: Matrix3,
  worldF32: Float32Array, normalF32: Float32Array): Bounds {
  // These four temporary arrays exist for only this mesh validation. No expanded
  // world geometry is retained in the result or shared with prepared resources.
  const positions: number[] = [], normals: number[] = [], positionsF32 = new Float32Array(geometry.positions.length), normalsF32 = new Float32Array(geometry.normals.length);
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < geometry.geometry.positions.length; i += 3) {
    const originalPoint = geometry.geometry.positions.slice(i, i + 3) as Vec3;
    const originalNormal = geometry.geometry.normals.slice(i, i + 3) as Vec3;
    const point = numberVector(world, 4, originalPoint, true), direction = normalize(numberVector(normal, 3, originalNormal, false), CODE.GEOMETRY);
    check(point.every(n => Number.isFinite(n) && Math.abs(n) <= 1000), CODE.GEOMETRY, 'Original transformed points exceed finite1000 scene bounds');
    // Encoding underflow differs from rounded arithmetic cancellation. A nominal
    // zero can leave a tiny Number residual but cancel exactly in the F32 path.
    point.forEach(f32Scalar); direction.forEach(f32Scalar);
    const pointF32 = f32Vector(worldF32, 4, Array.from(geometry.positions.slice(i, i + 3)) as Vec3, true);
    const rawNormalF32 = f32Vector(normalF32, 3, Array.from(geometry.normals.slice(i, i + 3)) as Vec3, false);
    const directionF32 = normalize(rawNormalF32, CODE.REPRESENTATION).map(f32Scalar) as Vec3;
    check(pointF32.every(n => Number.isFinite(n) && Math.abs(n) <= 1000), CODE.REPRESENTATION,
      'Float32 transformed points exceed finite scene bounds');
    positions.push(...point); normals.push(...direction);
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], point[axis]); max[axis] = Math.max(max[axis], point[axis]);
      positionsF32[i + axis] = pointF32[axis]; normalsF32[i + axis] = directionF32[axis];
    }
  }
  guard(CODE.GEOMETRY, 'Original transformed triangles refused', () => validateMeshGeometry(positions, normals, geometry.geometry.indices, 'Original scene instance'));
  guard(CODE.REPRESENTATION, 'Float32 transformed triangles refused', () => validateMeshGeometry(positionsF32, normalsF32, geometry.indices, 'Float32 scene instance'));
  Object.freeze(min); Object.freeze(max); return Object.freeze({ min, max });
}

/** Prepare one independent engine scene0, including hidden resources and mesh instances. */
export function prepareEngineScene(input: unknown): PreparedEngineScene {
  return guard(CODE.INPUT, 'Own scene reflection refused', () => {
    const data = record(input, ROOT_FIELDS, 'scene');
    check(data.format === 'barocss-gpu-engine-scene' && data.version === 0 && data.coordinateSystem === 'right-handed-y-up'
      && data.positionUnit === 'scene', CODE.VERSION, 'Only engine scene0/right-handed-y-up/scene metadata is supported');
    const id = identifier(data.id, 'scene.id');
    // Catalog cardinality checks precede any catalog item admission.
    const counts = { geometries: arrayLength(data.geometries, 16, 'geometries'), materials: arrayLength(data.materials, 32, 'materials'), nodes: arrayLength(data.nodes, 64, 'nodes') };
    for (const field of ['geometries', 'materials', 'nodes'] as const) arrayDescriptors(data[field], counts[field], field);
    const geometryInputs = ownArray(data.geometries, 16, 'geometries'), materialInputs = ownArray(data.materials, 32, 'materials'), nodeInputs = ownArray(data.nodes, 64, 'nodes');
    const geometryRows = preflightGeometries(geometryInputs);
    const geometryMap = unique(geometryRows, row => identifier(row.data.id, 'geometry.id'), 'geometry');
    const materials = materialInputs.map(material), materialMap = unique(materials, value => value.id, 'material');
    const nodes = nodeInputs.map(node), nodeMap = unique(nodes, value => value.id, 'node');
    const meshes = nodes.filter((value): value is Extract<EngineSceneNodeV0, { type: 'mesh' }> => value.type === 'mesh');
    check(meshes.length <= 32, CODE.BUDGET, 'At most32 mesh instances including hidden are supported');
    for (const source of nodes) if (source.parentId !== null) {
      const parent = nodeMap.get(source.parentId); check(parent?.type === 'group', CODE.REFERENCE, 'Every parent must name a current group');
    }
    let vertexWork = 0;
    for (const source of meshes) {
      const geometry = geometryMap.get(source.geometryId);
      check(geometry && materialMap.has(source.materialId), CODE.REFERENCE, 'Each mesh requires current geometry and material IDs');
      vertexWork += geometry.vertexCount; check(vertexWork <= 524288, CODE.BUDGET, 'Mesh vertex work including hidden exceeds524288');
    }
    const depths = new Map<string, number>(), visiting = new Set<string>();
    function depth(source: EngineSceneNodeV0): number {
      const known = depths.get(source.id); if (known !== undefined) return known;
      check(!visiting.has(source.id), CODE.REFERENCE, 'Node parent graph contains a cycle'); visiting.add(source.id);
      const count = source.parentId === null ? 1 : depth(nodeMap.get(source.parentId)!) + 1;
      check(count <= 16, CODE.BUDGET, 'Node hierarchy exceeds depth16'); visiting.delete(source.id); depths.set(source.id, count); return count;
    }
    for (const source of nodes) depth(source);
    const background = rgb(data.background, 'background'), camera = guard(CODE.CAMERA, 'Actual camera admission refused', () => validateMeshCamera(data.camera));
    const geometries = geometryRows.map(row => prepareGeometry(row.input));
    const resources = new Map(geometries.map(value => [value.geometry.id, value]));
    const bufferBytes = geometries.reduce((sum, value) => sum + value.bufferBytes, 0);
    check(bufferBytes <= 11534336, CODE.BUDGET, 'Unique geometry execution buffers exceed11534336 bytes');
    const preparedMap = new Map<string, PreparedEngineSceneNode>();
    function prepareNode(source: EngineSceneNodeV0): PreparedEngineSceneNode {
      const existing = preparedMap.get(source.id); if (existing) return existing;
      const parent = source.parentId === null ? null : prepareNode(nodeMap.get(source.parentId)!);
      const local = localMatrix(source), worldMatrix = parent ? multiply(parent.worldMatrix, local) : local;
      const normal = normalMatrix(worldMatrix, CODE.TRANSFORM), worldMatrixF32 = floatMatrix(worldMatrix), normalMatrixF32 = floatMatrix(normal);
      normalMatrix(worldMatrixF32, CODE.REPRESENTATION);
      const bounds = source.type === 'mesh' ? transformedBounds(resources.get(source.geometryId)!, worldMatrix, normal, worldMatrixF32, normalMatrixF32) : null;
      Object.freeze(worldMatrix); Object.freeze(normal);
      const prepared = Object.freeze({ id: source.id, type: source.type, parentId: source.parentId,
        effectiveVisible: source.visible && (parent === null || parent.effectiveVisible), worldMatrix,
        normalMatrix: normal, worldMatrixF32, normalMatrixF32, bounds });
      preparedMap.set(source.id, prepared); return prepared;
    }
    const preparedNodes = nodes.map(prepareNode);
    const draws: PreparedEngineSceneDraw[] = meshes.filter(source => preparedMap.get(source.id)!.effectiveVisible).map(source => Object.freeze({
      id: source.id, geometryId: source.geometryId, materialId: source.materialId,
      geometry: resources.get(source.geometryId)!, material: materialMap.get(source.materialId)!, node: preparedMap.get(source.id)!,
    }));
    const sourceGeometries = geometries.map(resource => resource.geometry);
    for (const array of [sourceGeometries, materials, nodes, geometries, preparedNodes, draws]) Object.freeze(array);
    const scene: EngineSceneV0 = Object.freeze({ format: 'barocss-gpu-engine-scene', version: 0, id,
      coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background, camera,
      geometries: sourceGeometries, materials, nodes });
    return Object.freeze({ scene, geometries, nodes: preparedNodes, draws, bufferBytes, vertexWork });
  });
}
