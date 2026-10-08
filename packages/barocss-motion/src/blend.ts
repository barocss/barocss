import { sampleMotionClip, type MotionClip, type MotionFrame, type MotionPose, type Quat, type Vec3 } from './index.js';
import { slerpQuaternion } from './math.js';

export type MotionBlendErrorCode = 'INVALID_INPUT' | 'INCOMPATIBLE_CLIPS' | 'UNSAFE_RESULT';

export class MotionBlendError extends Error {
  readonly code: MotionBlendErrorCode;

  constructor(code: MotionBlendErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'MotionBlendError';
    this.code = code;
  }
}

export interface MotionBlendSample {
  readonly contextId: string;
  readonly fromTimeSeconds: number;
  readonly toTimeSeconds: number;
  readonly weight: number;
  readonly poses: MotionPose[];
}

function fail(code: MotionBlendErrorCode, path: string, reason: string): never {
  throw new MotionBlendError(code, `${path}: ${reason}`);
}

function sample(clip: MotionClip, timeSeconds: number, path: string): MotionFrame {
  try {
    return sampleMotionClip(clip, timeSeconds);
  } catch {
    fail('INVALID_INPUT', path, 'expected a validated v0 clip and finite in-range time');
  }
}

function trackPairs(clip: MotionClip): Set<string> {
  return new Set(clip.tracks.map((track) => `${track.targetId}\0${track.property}`));
}

function copyPose(source: MotionPose): MotionPose {
  const pose: MotionPose = { targetId: source.targetId };
  if (source.translation) pose.translation = [...source.translation];
  if (source.rotation) pose.rotation = [...source.rotation];
  if (source.scale) pose.scale = [...source.scale];
  return pose;
}

function linear(left: Vec3, right: Vec3, weight: number): Vec3 {
  return left.map((value, index) => value + (right[index] - value) * weight) as Vec3;
}

function checked(pose: MotionPose, index: number): MotionPose {
  const vector = (values: readonly number[] | undefined, min: number, max: number, property: string): void => {
    if (values?.some((value) => !Number.isFinite(value) || value < min || value > max)) {
      fail('UNSAFE_RESULT', `poses[${index}].${property}`, 'computed value is outside v0 bounds');
    }
  };
  vector(pose.translation, -10000, 10000, 'translation');
  vector(pose.scale, 0.001, 100, 'scale');
  vector(pose.rotation, -1, 1, 'rotation');
  if (pose.rotation && Math.abs(Math.hypot(...pose.rotation) - 1) > 1e-9) {
    fail('UNSAFE_RESULT', `poses[${index}].rotation`, 'computed quaternion norm is outside v0 bounds');
  }
  return pose;
}

/** Blend two actual v0 clips without changing clips, players, or renderers. */
export function sampleMotionBlend(
  fromClip: MotionClip,
  fromTimeSeconds: number,
  toClip: MotionClip,
  toTimeSeconds: number,
  weight: number,
): MotionBlendSample {
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 1) {
    fail('INVALID_INPUT', 'weight', 'expected a finite number in [0, 1]');
  }
  const from = sample(fromClip, fromTimeSeconds, 'fromClip/fromTimeSeconds');
  const to = sample(toClip, toTimeSeconds, 'toClip/toTimeSeconds');
  if (from.contextId !== to.contextId) fail('INCOMPATIBLE_CLIPS', 'contextId', 'source and destination differ');
  const sourcePairs = trackPairs(fromClip);
  const destinationPairs = trackPairs(toClip);
  if (sourcePairs.size !== destinationPairs.size || [...sourcePairs].some((pair) => !destinationPairs.has(pair))) {
    fail('INCOMPATIBLE_CLIPS', 'tracks', 'target/property sets differ');
  }
  const destinations = new Map(to.poses.map((pose) => [pose.targetId, pose]));
  const poses = from.poses.map((source, index) => {
    const destination = destinations.get(source.targetId);
    if (!destination) fail('INCOMPATIBLE_CLIPS', 'tracks', 'target/property sets differ');
    if (weight === 0) return checked(copyPose(source), index);
    if (weight === 1) return checked(copyPose(destination), index);
    const pose: MotionPose = { targetId: source.targetId };
    if (source.translation && destination.translation) pose.translation = linear(source.translation, destination.translation, weight);
    if (source.rotation && destination.rotation) pose.rotation = slerpQuaternion(source.rotation, destination.rotation, weight) as Quat;
    if (source.scale && destination.scale) pose.scale = linear(source.scale, destination.scale, weight);
    return checked(pose, index);
  });
  return {
    contextId: from.contextId,
    fromTimeSeconds,
    toTimeSeconds,
    weight: weight === 0 ? 0 : weight,
    poses,
  };
}
