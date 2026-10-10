import {validateMeshCamera, validateMeshOptions} from '@barocss/gpu';
import type {MeshCamera, MeshLighting} from '@barocss/gpu';
import type {BaroCadDocumentPrimitiveEntryV2} from '@barocss/cad-interop/document';
import {normalizeRenderEditorError} from './errors.js';

type XYZ = readonly [number, number, number];
type XYZW = readonly [number, number, number, number];
export interface RenderNativeScenePose {
  readonly bodyId: string;
  readonly translationMM: XYZ;
  readonly rotationXYZW: XYZW;
  readonly scale: XYZ;
}
export interface RenderNativeSceneDisplay {
  readonly mmToSceneUnit: number;
  readonly background: XYZ;
  readonly camera: MeshCamera;
  readonly lighting: MeshLighting;
  readonly visibleBodyIds: readonly string[];
  readonly poses: readonly RenderNativeScenePose[];
  readonly basis: 'part-xyz-matches-rhyup';
}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError(message);
}
function record(input: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(input)), `${label} requires a plain own record.`);
  const actual = Reflect.ownKeys(input);
  check(actual.length === keys.length && actual.every(key => typeof key === 'string' && keys.includes(key)), `${label} has missing or unsupported fields.`);
  return Object.fromEntries(keys.map(key => {
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
function number(input: unknown, min: number, max: number, label: string): number {
  check(typeof input === 'number' && Number.isFinite(input) && input >= min && input <= max, `${label} must be finite in ${min}..${max}.`);
  return input;
}
function vector(input: unknown, count: number, min: number, max: number, label: string): readonly number[] {
  return Object.freeze(dense(input, count, count, label).map(value => number(value, min, max, label)));
}

/** Copy authored display intent. This does not qualify posed GPU coordinates or present a frame. */
export function copyRenderNativeSceneDisplay(input: unknown, entries: ReadonlyArray<BaroCadDocumentPrimitiveEntryV2>): RenderNativeSceneDisplay {
  try {
    const data = record(input, ['mmToSceneUnit', 'background', 'camera', 'lighting', 'visibleBodyIds', 'poses', 'basis'], 'Native scene display');
    check(data.basis === 'part-xyz-matches-rhyup', 'Native scene display basis must explicitly preserve authored XYZ/mm.');
    const mmToSceneUnit = number(data.mmToSceneUnit, 1e-6, 1, 'Native scene scale');
    const background = vector(data.background, 3, 0, 1, 'Native scene background') as XYZ;
    const light = record(data.lighting, ['ambientStrength', 'directionalStrength', 'direction'], 'Native scene lighting');
    const direction = vector(light.direction, 3, -1000, 1000, 'Native scene light direction');
    const camera = validateMeshCamera(data.camera);
    // Neutral execution fields are an explicit adapter to the public lighting/background validator.
    const options = validateMeshOptions({mmToSceneUnit, translate: [0, 0, 0], color: [1, 1, 1], background: [...background], camera,
      lighting: {ambientStrength: light.ambientStrength, directionalStrength: light.directionalStrength, direction: [...direction]}});
    const bodyIds = entries.map(entry => entry.binding.bodyId), selected = new Set(bodyIds);
    check(bodyIds.length >= 1 && bodyIds.length <= 4 && selected.size === bodyIds.length, 'Native scene display requires 1..4 distinct selected original bodies.');
    const visibleBodyIds = dense(data.visibleBodyIds, 0, 4, 'Native scene visibility').map(value => {
      check(typeof value === 'string' && selected.has(value), 'Visible body must be an original selected body.'); return value;
    });
    check(new Set(visibleBodyIds).size === visibleBodyIds.length, 'Native scene visible bodies must be unique.');
    const poses = dense(data.poses, 0, 4, 'Native scene poses').map(inputPose => {
      const pose = record(inputPose, ['bodyId', 'translationMM', 'rotationXYZW', 'scale'], 'Native scene pose');
      check(typeof pose.bodyId === 'string' && selected.has(pose.bodyId), 'Pose body must be an original selected body.');
      const translationMM = vector(pose.translationMM, 3, -10000, 10000, 'Native scene translation') as XYZ;
      const rotationXYZW = vector(pose.rotationXYZW, 4, -1, 1, 'Native scene rotation') as XYZW;
      check(Math.abs(Math.hypot(...rotationXYZW) - 1) <= 1e-9, 'Native scene rotation must be a unit XYZW quaternion.');
      const scale = vector(pose.scale, 3, .001, 100, 'Native scene pose scale') as XYZ;
      return Object.freeze({bodyId: pose.bodyId, translationMM, rotationXYZW, scale});
    });
    check(poses.length === 0 || poses.length === bodyIds.length && new Set(poses.map(pose => pose.bodyId)).size === bodyIds.length,
      'Native scene poses must be empty identity intent or cover every selected body exactly once.');
    return Object.freeze({mmToSceneUnit, background: options.background, camera, lighting: options.lighting!,
      visibleBodyIds: Object.freeze(visibleBodyIds), poses: Object.freeze(poses), basis: 'part-xyz-matches-rhyup'});
  } catch (cause) {
    const error = normalizeRenderEditorError(cause);
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
