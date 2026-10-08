import { slerpQuaternion } from './math.js';

/** Renderer-neutral, bounded TRS keyframes. All times are seconds. */
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type MotionProperty = 'translation' | 'rotation' | 'scale';
export type MotionInterpolation = 'STEP' | 'LINEAR' | 'SLERP';
export type PlaybackMode = 'clamp' | 'repeat';

export interface MotionKey {
  readonly timeSeconds: number;
  readonly value: readonly number[];
}

export interface MotionTrack {
  readonly targetId: string;
  readonly property: MotionProperty;
  readonly interpolation: MotionInterpolation;
  readonly keys: readonly MotionKey[];
}

export interface MotionClip {
  readonly version: 0;
  readonly contextId: string;
  readonly durationSeconds: number;
  readonly tracks: readonly MotionTrack[];
}

export interface MotionPose {
  targetId: string;
  translation?: Vec3;
  rotation?: Quat;
  scale?: Vec3;
}

export interface MotionFrame {
  contextId: string;
  timeSeconds: number;
  poses: MotionPose[];
}

export interface MotionPlayerState extends MotionFrame {
  playing: boolean;
  mode: PlaybackMode;
}

export interface MotionPlayer {
  getState(): MotionPlayerState;
  play(): MotionPlayerState;
  pause(): MotionPlayerState;
  seek(timeSeconds: number): MotionPlayerState;
  advance(deltaSeconds: number): MotionPlayerState;
  setMode(mode: PlaybackMode): MotionPlayerState;
  dispose(): void;
}

export { MotionFileError, parseMotionClipFile, serializeMotionClipFile } from './file.js';
export type { MotionFileErrorCode } from './file.js';
export { MotionTimelineError, createMotionTimeline } from './timeline.js';
export type { MotionMarkerInput, MotionTimeline, MotionTimelineErrorCode, MotionTimelineEvent, MotionTimelineOptions, MotionTimelineState } from './timeline.js';
export { MotionBlendError, sampleMotionBlend } from './blend.js';
export type { MotionBlendErrorCode, MotionBlendSample } from './blend.js';

export const MOTION_LIMITS = Object.freeze({
  targets: 64,
  tracks: 192,
  keysPerTrack: 256,
  totalKeys: 4096,
  durationSeconds: 3600,
  translationMm: 10000,
  scaleMin: 0.001,
  scaleMax: 100,
  quaternionNormTolerance: 1e-9,
});

const validClips = new WeakSet<object>();
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function fail(message: string): never {
  throw new TypeError(`Invalid motion data: ${message}`);
}

function objectFields(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object') fail(`${label} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(`${label} must be a plain object`);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || keys.some((key) => typeof key !== 'string' || !fields.includes(key))) {
    fail(`${label} has missing or unsupported fields`);
  }
  const values: Record<string, unknown> = Object.create(null);
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (!descriptor || !('value' in descriptor)) fail(`${label}.${field} must be a data field`);
    values[field] = descriptor.value;
  }
  return values;
}

function boundedArray(value: unknown, max: number, label: string): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail(`${label} must be an array`);
  }
  const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
  if (!Number.isInteger(length) || length < 1 || length > max) fail(`${label} length is out of bounds`);
  // Read each index by descriptor. This rejects holes and accessor elements.
  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor)) fail(`${label}[${index}] must be a data element`);
    result.push(descriptor.value);
  }
  if (Reflect.ownKeys(value).length !== length + 1) fail(`${label} has unsupported fields`);
  return result;
}

function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || !idPattern.test(value)) fail(`${label} must be an exact ASCII ID`);
  return value;
}

function finiteRange(value: unknown, minimum: number, maximum: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    fail(`${label} is out of bounds`);
  }
  return value;
}

function vector(value: unknown, property: MotionProperty): Vec3 | Quat {
  const count = property === 'rotation' ? 4 : 3;
  const components = boundedArray(value, count, `${property} value`);
  if (components.length !== count) fail(`${property} needs ${count} components`);
  if (property === 'translation') {
    return components.map((component) => finiteRange(component, -10000, 10000, 'translation mm')) as Vec3;
  }
  if (property === 'scale') {
    return components.map((component) => finiteRange(component, 0.001, 100, 'scale')) as Vec3;
  }
  const quaternion = components.map((component) => finiteRange(component, -1, 1, 'quaternion')) as Quat;
  const norm = Math.hypot(...quaternion);
  if (Math.abs(norm - 1) > 1e-9) fail('quaternion must have unit norm within 1e-9');
  return quaternion;
}

/** Validate and copy a version-0 clip. Input accessors are never invoked. */
export function createMotionClip(input: unknown): MotionClip {
  const source = objectFields(input, ['version', 'contextId', 'durationSeconds', 'tracks'], 'clip');
  if (source.version !== 0) fail('unsupported clip version');
  const contextId = id(source.contextId, 'contextId');
  const durationSeconds = finiteRange(source.durationSeconds, 0, 3600, 'durationSeconds');
  const inputs = boundedArray(source.tracks, 192, 'tracks');
  const tracks: MotionTrack[] = [];
  const targets = new Set<string>();
  const propertyPairs = new Set<string>();
  let totalKeys = 0;
  for (const [trackIndex, inputTrack] of inputs.entries()) {
    const raw = objectFields(inputTrack, ['targetId', 'property', 'interpolation', 'keys'], `track ${trackIndex}`);
    const targetId = id(raw.targetId, 'targetId');
    if (raw.property !== 'translation' && raw.property !== 'rotation' && raw.property !== 'scale') {
      fail('unsupported track property');
    }
    const property = raw.property;
    if (raw.interpolation !== 'STEP' &&
        !(property === 'rotation' ? raw.interpolation === 'SLERP' : raw.interpolation === 'LINEAR')) {
      fail('unsupported interpolation for property');
    }
    const interpolation = raw.interpolation as MotionInterpolation;
    const pair = `${targetId}\0${property}`;
    if (propertyPairs.has(pair)) fail('duplicate target/property track');
    propertyPairs.add(pair);
    targets.add(targetId);
    if (targets.size > 64) fail('too many targets');
    const rawKeys = boundedArray(raw.keys, 256, 'keys');
    totalKeys += rawKeys.length;
    if (totalKeys > 4096) fail('too many total keys');
    const keys: MotionKey[] = [];
    let previous = -1;
    for (const [keyIndex, inputKey] of rawKeys.entries()) {
      const rawKey = objectFields(inputKey, ['timeSeconds', 'value'], `key ${keyIndex}`);
      const timeSeconds = finiteRange(rawKey.timeSeconds, 0, durationSeconds, 'key timeSeconds');
      if (timeSeconds <= previous) fail('key times must strictly increase');
      previous = timeSeconds;
      keys.push(Object.freeze({ timeSeconds, value: Object.freeze(vector(rawKey.value, property)) }));
    }
    tracks.push(Object.freeze({ targetId, property, interpolation, keys: Object.freeze(keys) }));
  }
  const clip: MotionClip = Object.freeze({ version: 0, contextId, durationSeconds, tracks: Object.freeze(tracks) });
  validClips.add(clip);
  return clip;
}

function requireClip(clip: MotionClip): void {
  if (!clip || !validClips.has(clip)) fail('clip must come from createMotionClip');
}

function interpolate(track: MotionTrack, timeSeconds: number): Vec3 | Quat {
  const keys = track.keys;
  if (timeSeconds <= keys[0].timeSeconds) return [...keys[0].value] as Vec3 | Quat;
  const last = keys[keys.length - 1];
  if (timeSeconds >= last.timeSeconds) return [...last.value] as Vec3 | Quat;
  let right = 1;
  while (keys[right].timeSeconds < timeSeconds) right += 1;
  const before = keys[right - 1];
  const after = keys[right];
  if (timeSeconds === after.timeSeconds) return [...after.value] as Vec3 | Quat;
  if (track.interpolation === 'STEP') return [...before.value] as Vec3 | Quat;
  const fraction = (timeSeconds - before.timeSeconds) / (after.timeSeconds - before.timeSeconds);
  if (track.interpolation === 'LINEAR') {
    return before.value.map((component, index) => component + (after.value[index] - component) * fraction) as Vec3;
  }
  return slerpQuaternion(before.value, after.value, fraction);
}

/** Return new pose objects and component arrays for every sample. */
export function sampleMotionClip(clip: MotionClip, timeSeconds: number): MotionFrame {
  requireClip(clip);
  finiteRange(timeSeconds, 0, clip.durationSeconds, 'sample timeSeconds');
  const poses = new Map<string, MotionPose>();
  for (const track of clip.tracks) {
    let pose = poses.get(track.targetId);
    if (!pose) {
      pose = { targetId: track.targetId };
      poses.set(track.targetId, pose);
    }
    const value = interpolate(track, timeSeconds);
    if (track.property === 'rotation') pose.rotation = value as Quat;
    else if (track.property === 'translation') pose.translation = value as Vec3;
    else pose.scale = value as Vec3;
  }
  return { contextId: clip.contextId, timeSeconds, poses: [...poses.values()] };
}

function requireMode(mode: PlaybackMode): void {
  if (mode !== 'clamp' && mode !== 'repeat') fail('mode must be clamp or repeat');
}

/** Caller-supplied time only; this player owns no timer or renderer object. */
export function createMotionPlayer(clip: MotionClip, options: { mode: PlaybackMode }): MotionPlayer {
  requireClip(clip);
  const input = objectFields(options, ['mode'], 'player options');
  requireMode(input.mode as PlaybackMode);
  let currentClip: MotionClip | null = clip;
  let mode = input.mode as PlaybackMode;
  let timeSeconds = 0;
  let playing = false;

  function active(): MotionClip {
    if (!currentClip) fail('player is disposed');
    return currentClip;
  }
  function state(): MotionPlayerState {
    const frame = sampleMotionClip(active(), timeSeconds);
    return { ...frame, playing, mode };
  }
  return {
    getState: state,
    play() {
      const duration = active().durationSeconds;
      if (mode === 'clamp' && timeSeconds === duration && duration > 0) timeSeconds = 0;
      playing = true;
      return state();
    },
    pause() {
      active();
      playing = false;
      return state();
    },
    seek(next: number) {
      const duration = active().durationSeconds;
      finiteRange(next, 0, duration, 'seek timeSeconds');
      timeSeconds = next;
      return state();
    },
    advance(delta: number) {
      const duration = active().durationSeconds;
      finiteRange(delta, 0, Number.MAX_VALUE, 'deltaSeconds');
      if (!playing || delta === 0) return state();
      const next = timeSeconds + delta;
      if (!Number.isFinite(next)) fail('time arithmetic overflow');
      if (mode === 'repeat') {
        timeSeconds = duration === 0 ? 0 : next % duration;
      } else if (next >= duration) {
        timeSeconds = duration;
        playing = false;
      } else {
        timeSeconds = next;
      }
      return state();
    },
    setMode(next: PlaybackMode) {
      active();
      requireMode(next);
      mode = next;
      return state();
    },
    dispose() {
      currentClip = null;
      playing = false;
      timeSeconds = 0;
    },
  };
}
