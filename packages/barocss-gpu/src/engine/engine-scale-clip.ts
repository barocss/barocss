import { BarocssError } from '../core/barocss-error.js';
import { ownRecord } from '../mesh/gpu-data.js';
import { prepareEngineScene } from './engine-scene.js';
import type { EngineSceneV0 } from './engine-scene.js';
import type { Vec3 } from '../scene/scene-types.js';

export const EngineScaleClipDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', BUDGET: 'BUDGET', REFERENCE: 'REFERENCE',
  RANGE: 'RANGE', SCENE: 'SCENE', FRAME: 'FRAME',
} as const);
export type EngineScaleClipDiagnosticCode = typeof EngineScaleClipDiagnosticCode[keyof typeof EngineScaleClipDiagnosticCode];
export class EngineScaleClipError extends BarocssError {
  constructor(readonly code: EngineScaleClipDiagnosticCode, detail: string, cause?: unknown) {
    super(code, ('Engine scale clip: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'EngineScaleClipError';
  }
}
export interface EngineScaleKeyV0 { timeSeconds: number; scale: Vec3 }
export interface EngineScaleTrackV0 { nodeId: string; keys: EngineScaleKeyV0[] }
export interface EngineScaleClipV0 {
  format: 'barocss-gpu-engine-scale-clip'; version: 0; id: string; sceneId: string;
  coordinateSystem: 'right-handed-y-up'; positionUnit: 'scene'; timeUnit: 'seconds';
  interpolation: 'linear'; tracks: EngineScaleTrackV0[];
}
export interface EngineScaleClipRequestV0 {
  format: 'barocss-gpu-engine-scale-clip-request'; version: 0; timeSeconds: number;
}
export interface SampledEngineScaleClip {
  readonly originalScene: EngineSceneV0;
  readonly clip: EngineScaleClipV0;
  readonly request: EngineScaleClipRequestV0;
  /** Derived complete scene0; the original source and keys remain separate. */
  readonly scene: EngineSceneV0;
}
const CODE = EngineScaleClipDiagnosticCode;
function check(value: unknown, code: EngineScaleClipDiagnosticCode, detail: string): asserts value {
  if (!value) throw new EngineScaleClipError(code, detail);
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
function request(input: unknown): EngineScaleClipRequestV0 {
  const data = ownRecord(input, ['format', 'version', 'timeSeconds']);
  check(data.format === 'barocss-gpu-engine-scale-clip-request' && data.version === 0,
    CODE.VERSION, 'Only scale clip request0 is supported');
  return Object.freeze({ format: 'barocss-gpu-engine-scale-clip-request', version: 0,
    timeSeconds: number(data.timeSeconds, 0, 3600, 'Request time') });
}
function clip(input: unknown): EngineScaleClipV0 {
  const data = ownRecord(input, ['format', 'version', 'id', 'sceneId', 'coordinateSystem',
    'positionUnit', 'timeUnit', 'interpolation', 'tracks']);
  check(data.format === 'barocss-gpu-engine-scale-clip' && data.version === 0
    && data.coordinateSystem === 'right-handed-y-up' && data.positionUnit === 'scene'
    && data.timeUnit === 'seconds' && data.interpolation === 'linear', CODE.VERSION,
  'Only clip0, right-handed-y-up/scene/seconds and linear positive local scales are supported');
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
      const data = ownRecord(input, ['timeSeconds', 'scale']);
      const timeSeconds = number(data.timeSeconds, 0, 3600, 'Key time');
      check(previous === undefined || timeSeconds > previous && timeSeconds - previous >= 1e-6,
        CODE.RANGE, 'Key times require strict increasing order and separation of at least1e-6 seconds');
      previous = timeSeconds;
      const scale = array(data.scale, 3, 3).map(n => number(n, .01, 100, 'Local scale')) as Vec3;
      Object.freeze(scale); return Object.freeze({ timeSeconds, scale });
    });
    Object.freeze(keys); return Object.freeze({ nodeId: row.nodeId, keys });
  });
  Object.freeze(tracks);
  return Object.freeze({ format: 'barocss-gpu-engine-scale-clip', version: 0, id, sceneId,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', timeUnit: 'seconds', interpolation: 'linear', tracks });
}
function sample(track: EngineScaleTrackV0, time: number): Vec3 {
  const keys = track.keys, first = keys[0], last = keys[keys.length - 1];
  // Literal keys precede arithmetic so exact endpoints retain their original coefficients.
  if (time <= first.timeSeconds) return [...first.scale];
  if (time >= last.timeSeconds) return [...last.scale];
  for (let i = 1; i < keys.length; i++) {
    const right = keys[i];
    if (time === right.timeSeconds) return [...right.scale];
    if (time < right.timeSeconds) {
      const left = keys[i - 1], alpha = (time - left.timeSeconds) / (right.timeSeconds - left.timeSeconds);
      check(Number.isFinite(alpha) && alpha >= 0 && alpha <= 1, CODE.RANGE, 'Derived segment ratio is invalid');
      return left.scale.map((n, index) => number(n + (right.scale[index] - n) * alpha,
        .01, 100, 'Derived local scale')) as Vec3;
    }
  }
  throw new EngineScaleClipError(CODE.RANGE, 'No admitted segment contains request time');
}
function scene(input: unknown, code: 'SCENE' | 'FRAME'): EngineSceneV0 {
  try { return prepareEngineScene(input).scene; }
  catch (cause) { throw new EngineScaleClipError(code, 'Actual complete ' + code.toLowerCase() + ' admission refused', cause); }
}
/** Sample one caller time without modifying original assets or owning a clock. */
export function sampleEngineScaleClip(sceneInput: unknown, clipInput: unknown,
  requestInput: unknown): SampledEngineScaleClip {
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
    const scales = new Map(originalClip.tracks.map(track => [track.nodeId, sample(track, originalRequest.timeSeconds)]));
    const candidate = { ...originalScene, nodes: originalScene.nodes.map(node => ({ ...node,
      scale: scales.get(node.id) ?? node.scale })) };
    const sampledScene = scene(candidate, CODE.FRAME);
    return Object.freeze({ originalScene, clip: originalClip, request: originalRequest, scene: sampledScene });
  } catch (cause) {
    if (cause instanceof EngineScaleClipError) throw cause;
    throw new EngineScaleClipError(CODE.INPUT, 'Own source reflection refused', cause);
  }
}
