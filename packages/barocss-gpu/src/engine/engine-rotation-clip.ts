import { ownRecord } from '../mesh/gpu-data.js';
import { prepareEngineScene } from './engine-scene.js';
import type { EngineSceneV0 } from './engine-scene.js';
type Quat = [number, number, number, number];

export const EngineRotationClipDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', BUDGET: 'BUDGET', REFERENCE: 'REFERENCE',
  RANGE: 'RANGE', SCENE: 'SCENE', FRAME: 'FRAME',
} as const);
export type EngineRotationClipDiagnosticCode = typeof EngineRotationClipDiagnosticCode[keyof typeof EngineRotationClipDiagnosticCode];
export class EngineRotationClipError extends Error {
  constructor(readonly code: EngineRotationClipDiagnosticCode, detail: string, cause?: unknown) {
    super(('Engine rotation clip: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'EngineRotationClipError';
  }
}
export interface EngineRotationKeyV0 { timeSeconds: number; rotationXYZW: Quat }
export interface EngineRotationTrackV0 { nodeId: string; keys: EngineRotationKeyV0[] }
export interface EngineRotationClipV0 {
  format: 'barocss-gpu-engine-rotation-clip'; version: 0; id: string; sceneId: string;
  coordinateSystem: 'right-handed-y-up'; positionUnit: 'scene'; timeUnit: 'seconds';
  rotationOrder: 'xyzw'; interpolation: 'shortest-path-nlerp'; tracks: EngineRotationTrackV0[];
}
export interface EngineRotationClipRequestV0 {
  format: 'barocss-gpu-engine-rotation-clip-request'; version: 0; timeSeconds: number;
}
export interface SampledEngineRotationClip {
  readonly originalScene: EngineSceneV0;
  readonly clip: EngineRotationClipV0;
  readonly request: EngineRotationClipRequestV0;
  /** Derived complete scene0; the original source and keys remain separate. */
  readonly scene: EngineSceneV0;
}
const CODE = EngineRotationClipDiagnosticCode;
function check(value: unknown, code: EngineRotationClipDiagnosticCode, detail: string): asserts value {
  if (!value) throw new EngineRotationClipError(code, detail);
}
function identifier(value: unknown): string {
  check(typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(value), CODE.INPUT,
    'IDs require the existing ASCII 1..64 character form'); return value;
}
function number(value: unknown, minimum: number, maximum: number, label: string): number {
  check(typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum,
    CODE.RANGE, label + ' requires a finite Number within ' + minimum + '..' + maximum); return value;
}
function arrayLength(input: unknown, minimum: number, maximum: number): number {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype, CODE.INPUT,
    'Arrays must be plain dense own data');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'length');
  check(descriptor && 'value' in descriptor && Number.isInteger(descriptor.value), CODE.INPUT,
    'Array length requires own data');
  check(descriptor.value >= minimum && descriptor.value <= maximum, CODE.BUDGET,
    'Array cardinality must lie within ' + minimum + '..' + maximum); return descriptor.value;
}
function array(input: unknown, minimum: number, maximum: number): unknown[] {
  const length = arrayLength(input, minimum, maximum), keys = Reflect.ownKeys(input as object);
  check(keys.length === length + 1, CODE.INPUT, 'Arrays must be dense without extra, hidden or symbol keys');
  for (const key of keys) if (key !== 'length') {
    check(typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length, CODE.INPUT,
      'Array keys must be dense indices');
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && 'value' in descriptor && descriptor.enumerable, CODE.INPUT,
      'Array elements require enumerable own data');
  }
  return Array.from({ length }, (_, i) => Object.getOwnPropertyDescriptor(input, String(i))!.value);
}
function request(input: unknown): EngineRotationClipRequestV0 {
  const data = ownRecord(input, ['format', 'version', 'timeSeconds']);
  check(data.format === 'barocss-gpu-engine-rotation-clip-request' && data.version === 0,
    CODE.VERSION, 'Only rotation clip request0 is supported');
  return Object.freeze({ format: 'barocss-gpu-engine-rotation-clip-request', version: 0,
    timeSeconds: number(data.timeSeconds, 0, 3600, 'Request time') });
}
function clip(input: unknown): EngineRotationClipV0 {
  const data = ownRecord(input, ['format', 'version', 'id', 'sceneId', 'coordinateSystem',
    'positionUnit', 'timeUnit', 'rotationOrder', 'interpolation', 'tracks']);
  check(data.format === 'barocss-gpu-engine-rotation-clip' && data.version === 0
    && data.coordinateSystem === 'right-handed-y-up' && data.positionUnit === 'scene'
    && data.timeUnit === 'seconds' && data.rotationOrder === 'xyzw' && data.interpolation === 'shortest-path-nlerp', CODE.VERSION,
  'Only clip0, right-handed-y-up/scene/seconds/xyzw and shortest-path-nlerp local rotations are supported');
  const id = identifier(data.id), sceneId = identifier(data.sceneId);
  let total = 0;
  const rows = array(data.tracks, 0, 32).map(input => {
    const row = ownRecord(input, ['nodeId', 'keys']), nodeId = identifier(row.nodeId);
    total += arrayLength(row.keys, 1, 32);
    check(total <= 512, CODE.BUDGET, 'Aggregate key count exceeds512');
    return { nodeId, input: row.keys };
  });
  // Every per-track and aggregate length is admitted before copying key values.
  const tracks = rows.map(row => {
    let previous: number | undefined;
    const keys = array(row.input, 1, 32).map(input => {
      const data = ownRecord(input, ['timeSeconds', 'rotationXYZW']);
      const timeSeconds = number(data.timeSeconds, 0, 3600, 'Key time');
      check(previous === undefined || timeSeconds > previous && timeSeconds - previous >= 1e-6,
        CODE.RANGE, 'Key times require strict increasing order and separation of at least1e-6 seconds');
      previous = timeSeconds;
      const rotationXYZW = quaternion(data.rotationXYZW);
      Object.freeze(rotationXYZW); return Object.freeze({ timeSeconds, rotationXYZW });
    });
    Object.freeze(keys); return Object.freeze({ nodeId: row.nodeId, keys });
  });
  Object.freeze(tracks);
  return Object.freeze({ format: 'barocss-gpu-engine-rotation-clip', version: 0, id, sceneId,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', timeUnit: 'seconds', rotationOrder: 'xyzw', interpolation: 'shortest-path-nlerp', tracks });
}
function quaternion(input: unknown): Quat {
  const value = array(input, 4, 4).map(n => number(n, -1, 1, 'Local quaternion component')) as Quat;
  check(Math.abs(Math.hypot(...value) - 1) <= 1e-9, CODE.RANGE,
    'Local XYZW quaternion must be unit length within1e-9'); return value;
}
function normalize(value: Quat): Quat {
  const length = Math.hypot(...value);
  check(Number.isFinite(length) && length > 0, CODE.RANGE, 'Derived quaternion length must be finite and positive');
  const result = value.map(n => number(n / length, -1, 1, 'Derived quaternion component')) as Quat;
  check(Math.abs(Math.hypot(...result) - 1) <= 1e-9, CODE.RANGE,
    'Derived quaternion must be unit length within1e-9'); return result;
}
function sample(track: EngineRotationTrackV0, time: number): Quat {
  const keys = track.keys, first = keys[0], last = keys[keys.length - 1];
  // Literal endpoints precede normalization and preserve original coefficients/sign bits.
  if (time <= first.timeSeconds) return [...first.rotationXYZW];
  if (time >= last.timeSeconds) return [...last.rotationXYZW];
  for (let i = 1; i < keys.length; i++) {
    const rightKey = keys[i];
    if (time === rightKey.timeSeconds) return [...rightKey.rotationXYZW];
    if (time < rightKey.timeSeconds) {
      const leftKey = keys[i - 1], alpha = (time - leftKey.timeSeconds) / (rightKey.timeSeconds - leftKey.timeSeconds);
      check(Number.isFinite(alpha) && alpha >= 0 && alpha <= 1, CODE.RANGE, 'Derived segment ratio is invalid');
      const left = normalize(leftKey.rotationXYZW), right = normalize(rightKey.rotationXYZW);
      const dot = left.reduce((sum, n, index) => sum + n * right[index], 0);
      check(Number.isFinite(dot), CODE.RANGE, 'Derived quaternion dot product is nonfinite');
      // Shortest orientation path; a zero dot retains the authored right sign.
      const sign = dot < 0 ? -1 : 1;
      return normalize(left.map((n, index) => n + (sign * right[index] - n) * alpha) as Quat);
    }
  }
  throw new EngineRotationClipError(CODE.RANGE, 'No admitted segment contains request time');
}
function scene(input: unknown, code: 'SCENE' | 'FRAME'): EngineSceneV0 {
  try { return prepareEngineScene(input).scene; }
  catch (cause) { throw new EngineRotationClipError(code, 'Actual complete ' + code.toLowerCase() + ' admission refused', cause); }
}
/** Sample one caller time without modifying original assets or owning a clock. */
export function sampleEngineRotationClip(sceneInput: unknown, clipInput: unknown,
  requestInput: unknown): SampledEngineRotationClip {
  try {
    const originalRequest = request(requestInput), originalClip = clip(clipInput);
    const originalScene = scene(sceneInput, CODE.SCENE);
    check(originalClip.sceneId === originalScene.id, CODE.REFERENCE, 'Clip sceneId must name the complete original scene');
    const nodeIds = new Set(originalScene.nodes.map(node => node.id)), seen = new Set<string>();
    for (const track of originalClip.tracks) {
      check(nodeIds.has(track.nodeId) && !seen.has(track.nodeId), CODE.REFERENCE,
        'Tracks require unique current group or mesh IDs');
      seen.add(track.nodeId);
    }
    const rotations = new Map(originalClip.tracks.map(track => [track.nodeId, sample(track, originalRequest.timeSeconds)]));
    const candidate = { ...originalScene, nodes: originalScene.nodes.map(node => ({ ...node,
      rotationXYZW: rotations.get(node.id) ?? node.rotationXYZW })) };
    const sampledScene = scene(candidate, CODE.FRAME);
    return Object.freeze({ originalScene, clip: originalClip, request: originalRequest, scene: sampledScene });
  } catch (cause) {
    if (cause instanceof EngineRotationClipError) throw cause;
    throw new EngineRotationClipError(CODE.INPUT, 'Own source reflection refused', cause);
  }
}
