import type { MeshCamera } from '@barocss/gpu';
import type { ViewerGeometryRef, ViewerNativePointInput } from './index.js';

/** Revision pins identify a loaded scene. They do not authenticate its contents. */
export interface ViewerReviewSceneV1 {
  kind: 'document' | 'assembly';
  id: string;
  revision: number;
  mmToSceneUnit: number;
  /** Loaded body/instance IDs and their original document/asset revision pins. */
  members: string[];
}
export interface ViewerReviewStateV1 {
  schema: 'barocss-viewer-review';
  version: 1;
  scene: ViewerReviewSceneV1;
  camera: MeshCamera;
  visibleGeometry: ViewerGeometryRef[];
  selectedGeometry: ViewerGeometryRef | null;
}
/** Original native parameters supplement the revision-pinned display review. */
export interface ViewerMeasuredReviewStateV1 {
  schema: 'barocss-viewer-measured-review';
  version: 1;
  review: ViewerReviewStateV1;
  measurement: null | {
    first: ViewerNativePointInput;
    second: ViewerNativePointInput;
    distanceMM: number;
    metric: 'straight-line';
    space: 'native-authored';
    certification: 'not-certified';
  };
}

/** Accept only own plain data. Do not execute getters in a file-shaped input. */
export function reviewRecord(input: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype)
    throw new RangeError(`${label} must be plain data`);
  const actual = Reflect.ownKeys(input);
  if (actual.length !== keys.length || !actual.every(key => typeof key === 'string' && keys.includes(key)))
    throw new RangeError(`${label} has missing or unsupported fields`);
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const field = Object.getOwnPropertyDescriptor(input, key);
    if (!field?.enumerable || !('value' in field)) throw new RangeError(`${label}.${key} must be data`);
    result[key] = field.value;
  }
  return result;
}

export function validateReviewScene(input: unknown, current: ViewerReviewSceneV1): void {
  const scene = reviewRecord(input, ['kind', 'id', 'revision', 'mmToSceneUnit', 'members'], 'Review scene');
  if (scene.kind !== current.kind || scene.id !== current.id || scene.revision !== current.revision
    || scene.mmToSceneUnit !== current.mmToSceneUnit)
    throw new RangeError('Review scene identity, revision or scale differs from the loaded scene');
  const members = scene.members;
  if (!Array.isArray(members) || Object.getPrototypeOf(members) !== Array.prototype
    || members.length !== current.members.length || Reflect.ownKeys(members).length !== members.length + 1)
    throw new RangeError('Review scene inventory differs from the loaded scene');
  for (let i = 0; i < current.members.length; i++) {
    const member = Object.getOwnPropertyDescriptor(members, String(i));
    if (!member?.enumerable || !('value' in member) || member.value !== current.members[i])
      throw new RangeError('Review scene inventory differs from the loaded scene');
  }
}
