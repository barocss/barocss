import {validateMeshCamera} from '@barocss/gpu';
import type {EngineSceneMaterialV0, EngineSceneNodeV0, MeshCamera, RGB, Vec3} from '@barocss/gpu';
import {normalizeRenderEditorError} from './errors.js';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError(message);
}
function record(input: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(input)), `${label} requires a plain own record.`);
  const keys = Reflect.ownKeys(input);
  check(keys.length === fields.length && keys.every(key => typeof key === 'string' && fields.includes(key)), `${label} has missing or unsupported fields.`);
  return Object.fromEntries(fields.map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && 'value' in descriptor && descriptor.enumerable, `${label}.${key} requires own enumerable data.`);
    return [key, descriptor.value];
  }));
}
function dense(input: unknown, min: number, max: number, label: string): unknown[] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype, `${label} requires a plain dense array.`);
  const length = Object.getOwnPropertyDescriptor(input, 'length');
  check(length && 'value' in length && Number.isInteger(length.value) && length.value >= min && length.value <= max, `${label} exceeds its count limit.`);
  const keys = Reflect.ownKeys(input);
  check(keys.length === length.value + 1 && keys.every(key => key === 'length' || typeof key === 'string'
    && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length.value), `${label} has holes, extra fields, or symbols.`);
  return Array.from({length: length.value}, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    check(descriptor && 'value' in descriptor && descriptor.enumerable, `${label}[${index}] requires own enumerable data.`);
    return descriptor.value;
  });
}
function number(input: unknown, label: string): number {
  check(typeof input === 'number' && Number.isFinite(input), `${label} requires a finite Number.`);
  return input;
}
function vector(input: unknown, count: number, label: string): number[] {
  const values = dense(input, count, count, label).map(value => number(value, label));
  Object.freeze(values); return values;
}
function identifier(input: unknown, label: string): string {
  check(typeof input === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(input), `${label} requires an ASCII identifier of 1..64 characters.`);
  return input;
}
function cameraCopy(input: unknown): MeshCamera {
  const data = record(input, ['eye', 'target', 'up', 'fovYDegrees', 'near', 'far'], 'Parametric scene camera');
  const camera: MeshCamera = {eye: vector(data.eye, 3, 'Camera eye') as Vec3, target: vector(data.target, 3, 'Camera target') as Vec3,
    up: vector(data.up, 3, 'Camera up') as Vec3, fovYDegrees: number(data.fovYDegrees, 'Camera FOV'),
    near: number(data.near, 'Camera near'), far: number(data.far, 'Camera far')};
  validateMeshCamera(camera);
  return Object.freeze(camera);
}
function materialCopy(input: unknown): EngineSceneMaterialV0 {
  const data = record(input, ['id', 'type', 'colorSpace', 'color'], 'Parametric scene material');
  check(data.type === 'unlit' && data.colorSpace === 'linear', 'Parametric scene material requires unlit linear RGB.');
  return Object.freeze({id: identifier(data.id, 'Material ID'), type: 'unlit', colorSpace: 'linear', color: vector(data.color, 3, 'Material color') as RGB});
}
function nodeCopy(input: unknown): EngineSceneNodeV0 {
  check(input !== null && typeof input === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'Parametric scene node requires a plain own record.');
  const tag = Object.getOwnPropertyDescriptor(input, 'type');
  check(tag && 'value' in tag && tag.enumerable && (tag.value === 'group' || tag.value === 'mesh'), 'Parametric scene node requires group or mesh own type data.');
  const fields = ['id', 'type', 'parentId', 'translation', 'rotationXYZW', 'scale', 'visible'];
  const data = record(input, tag.value === 'mesh' ? [...fields, 'geometryId', 'materialId'] : fields, 'Parametric scene node');
  check(typeof data.visible === 'boolean', 'Parametric scene visibility requires a boolean.');
  const common = {id: identifier(data.id, 'Node ID'), parentId: data.parentId === null ? null : identifier(data.parentId, 'Parent node ID'),
    translation: vector(data.translation, 3, 'Node translation') as Vec3,
    rotationXYZW: vector(data.rotationXYZW, 4, 'Node rotation') as [number, number, number, number],
    scale: vector(data.scale, 3, 'Node scale') as Vec3, visible: data.visible};
  return tag.value === 'group' ? Object.freeze({...common, type: 'group'})
    : Object.freeze({...common, type: 'mesh', geometryId: identifier(data.geometryId, 'Node geometry ID'), materialId: identifier(data.materialId, 'Node material ID')});
}

/** Preserve original authoring data. The real EngineScene preparer admits transforms and references later. */
export function copyRenderParametricSceneData(input: unknown): {
  camera: MeshCamera; background: RGB; materials: EngineSceneMaterialV0[]; nodes: EngineSceneNodeV0[];
} {
  try {
    const data = record(input, ['camera', 'background', 'materials', 'nodes'], 'Parametric scene data');
    const camera = cameraCopy(data.camera), background = vector(data.background, 3, 'Parametric scene background') as RGB;
    const materials = dense(data.materials, 1, 8, 'Parametric scene materials').map(materialCopy);
    const nodes = dense(data.nodes, 1, 16, 'Parametric scene nodes').map(nodeCopy);
    Object.freeze(materials); Object.freeze(nodes);
    return Object.freeze({camera, background, materials, nodes});
  } catch (cause) {
    const error = normalizeRenderEditorError(cause);
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
