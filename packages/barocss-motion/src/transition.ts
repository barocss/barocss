import { MotionBlendError, sampleMotionBlend } from './blend.js';
import { sampleMotionClip, type MotionClip, type MotionPose, type PlaybackMode } from './index.js';
import { MotionTimingError, evaluateMotionTiming, type MotionCubicTiming } from './timing.js';

export type MotionTransitionErrorCode =
  'INVALID_INPUT' | 'INCOMPATIBLE_CLIPS' | 'TRANSITION_ACTIVE' | 'UNSAFE_RESULT' | 'DISPOSED';

export class MotionTransitionError extends Error {
  readonly code: MotionTransitionErrorCode;

  constructor(code: MotionTransitionErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'MotionTransitionError';
    this.code = code;
  }
}

export interface MotionTransitionOptions {
  readonly destinationTimeSeconds: number;
  readonly fadeDurationSeconds: number;
  readonly timing?: MotionCubicTiming;
}

export interface MotionTransitionState {
  readonly phase: 'idle' | 'fading' | 'adopted';
  readonly playing: boolean;
  readonly mode: PlaybackMode;
  readonly contextId: string;
  readonly sourceTimeSeconds: number;
  readonly destinationTimeSeconds: number | null;
  readonly fadeElapsedSeconds: number;
  readonly fadeDurationSeconds: number;
  readonly fadeProgress: number;
  readonly weight: number;
  readonly poses: MotionPose[];
}

export interface MotionTransitionPlayer {
  getState(): MotionTransitionState;
  play(): MotionTransitionState;
  pause(): MotionTransitionState;
  seek(timeSeconds: number): MotionTransitionState;
  advance(deltaSeconds: number): MotionTransitionState;
  transitionTo(nextClip: MotionClip, options: MotionTransitionOptions): MotionTransitionState;
  dispose(): void;
}

interface PendingFade {
  readonly clip: MotionClip;
  readonly timeSeconds: number;
  readonly elapsedSeconds: number;
  readonly durationSeconds: number;
  readonly timing: MotionCubicTiming | null;
}

function fail(code: MotionTransitionErrorCode, message: string): never {
  throw new MotionTransitionError(code, message);
}

function ownFields(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', 'expected a plain options record');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('INVALID_INPUT', 'expected a plain options record');
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string' || ![...required, ...optional].includes(key)) ||
      required.some((key) => !keys.includes(key))) fail('INVALID_INPUT', 'options fields differ from the contract');
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_INPUT', `${key} must be an own data field`);
    result[key] = descriptor.value;
  }
  return result;
}

function boundedTime(value: unknown, maximum: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
    fail('INVALID_INPUT', `${name} must be finite in [0, ${maximum}]`);
  }
  return value === 0 ? 0 : value;
}

function copyPose(pose: MotionPose): MotionPose {
  const copy: MotionPose = { targetId: pose.targetId };
  if (pose.translation) copy.translation = [...pose.translation];
  if (pose.rotation) copy.rotation = [...pose.rotation];
  if (pose.scale) copy.scale = [...pose.scale];
  return copy;
}

function sampleClip(clip: MotionClip, timeSeconds: number): MotionPose[] {
  try {
    return sampleMotionClip(clip, timeSeconds).poses;
  } catch {
    fail('INVALID_INPUT', 'expected a validated v0 clip and in-range source time');
  }
}

function blend(fromClip: MotionClip, fromTime: number, toClip: MotionClip, toTime: number, weight: number): MotionPose[] {
  try {
    return sampleMotionBlend(fromClip, fromTime, toClip, toTime, weight).poses;
  } catch (error) {
    if (error instanceof MotionBlendError) fail(error.code, error.message.slice(error.code.length + 2));
    throw error;
  }
}

function ownTiming(value: unknown): MotionCubicTiming {
  const fields = ownFields(value, ['kind', 'x1', 'y1', 'x2', 'y2']);
  const timing = fields as unknown as MotionCubicTiming;
  try {
    evaluateMotionTiming(0.5, timing);
  } catch (error) {
    if (error instanceof MotionTimingError) fail(error.code, error.message.slice(error.code.length + 2));
    throw error;
  }
  return Object.freeze({ kind: timing.kind, x1: timing.x1, y1: timing.y1, x2: timing.x2, y2: timing.y2 });
}

function clock(time: number, clip: MotionClip, delta: number, mode: PlaybackMode): number {
  const next = time + delta;
  if (!Number.isFinite(next)) fail('UNSAFE_RESULT', 'time arithmetic overflow');
  if (mode === 'repeat') return clip.durationSeconds === 0 ? 0 : next % clip.durationSeconds;
  return Math.min(next, clip.durationSeconds);
}

/** Caller-driven two-clip fade. The player owns no timer, renderer, or caller clip. */
export function createMotionTransitionPlayer(
  initialClip: MotionClip, options: { mode: PlaybackMode },
): MotionTransitionPlayer {
  const fields = ownFields(options, ['mode']);
  if (fields.mode !== 'clamp' && fields.mode !== 'repeat') fail('INVALID_INPUT', 'mode must be clamp or repeat');
  let sourceClip: MotionClip | null = initialClip;
  let sourceTimeSeconds = 0;
  let playing = false;
  let phase: MotionTransitionState['phase'] = 'idle';
  let pending: PendingFade | null = null;
  let fadeElapsedSeconds = 0;
  let fadeDurationSeconds = 0;
  let fadeProgress = 0;
  let weight = 0;
  let poses = sampleClip(initialClip, 0);
  const mode = fields.mode;

  function active(): MotionClip {
    if (!sourceClip) fail('DISPOSED', 'transition player is disposed');
    return sourceClip;
  }

  function state(): MotionTransitionState {
    const clip = active();
    return {
      phase, playing, mode, contextId: clip.contextId, sourceTimeSeconds,
      destinationTimeSeconds: pending?.timeSeconds ?? null,
      fadeElapsedSeconds, fadeDurationSeconds, fadeProgress, weight,
      poses: poses.map(copyPose),
    };
  }

  return {
    getState: state,
    play() {
      const clip = active();
      if (!pending && mode === 'clamp' && sourceTimeSeconds === clip.durationSeconds && clip.durationSeconds > 0) {
        poses = sampleClip(clip, 0);
        sourceTimeSeconds = 0;
      }
      playing = true;
      return state();
    },
    pause() {
      active();
      playing = false;
      return state();
    },
    seek(nextTime: number) {
      const clip = active();
      if (pending) fail('TRANSITION_ACTIVE', 'seek is unavailable during a fade');
      const next = boundedTime(nextTime, clip.durationSeconds, 'source time');
      const nextPoses = sampleClip(clip, next);
      sourceTimeSeconds = next;
      poses = nextPoses;
      return state();
    },
    advance(deltaSeconds: number) {
      const clip = active();
      const delta = boundedTime(deltaSeconds, Number.MAX_VALUE, 'deltaSeconds');
      if (!playing || delta === 0) return state();
      const nextSourceTime = clock(sourceTimeSeconds, clip, delta, mode);
      if (pending) {
        const nextDestinationTime = clock(pending.timeSeconds, pending.clip, delta, mode);
        const nextElapsed = Math.min(pending.durationSeconds, pending.elapsedSeconds + delta);
        const nextProgress = nextElapsed / pending.durationSeconds;
        let nextWeight = nextProgress;
        if (pending.timing) {
          try {
            nextWeight = evaluateMotionTiming(nextProgress, pending.timing).easedProgress;
          } catch (error) {
            if (error instanceof MotionTimingError) fail(error.code, error.message.slice(error.code.length + 2));
            throw error;
          }
        }
        const nextPoses = nextElapsed === pending.durationSeconds
          ? sampleClip(pending.clip, nextDestinationTime)
          : blend(clip, nextSourceTime, pending.clip, nextDestinationTime, nextWeight);
        if (nextElapsed === pending.durationSeconds) {
          sourceClip = pending.clip;
          sourceTimeSeconds = nextDestinationTime;
          pending = null;
          phase = 'adopted';
          fadeElapsedSeconds = nextElapsed;
          fadeDurationSeconds = nextElapsed;
          fadeProgress = 1;
          weight = 1;
          playing = mode === 'repeat' || nextDestinationTime < sourceClip.durationSeconds;
        } else {
          sourceTimeSeconds = nextSourceTime;
          pending = { ...pending, timeSeconds: nextDestinationTime, elapsedSeconds: nextElapsed };
          fadeElapsedSeconds = nextElapsed;
          fadeProgress = nextProgress;
          weight = nextWeight;
        }
        poses = nextPoses;
      } else {
        const nextPoses = sampleClip(clip, nextSourceTime);
        sourceTimeSeconds = nextSourceTime;
        poses = nextPoses;
        if (mode === 'clamp' && nextSourceTime === clip.durationSeconds) playing = false;
      }
      return state();
    },
    transitionTo(nextClip: MotionClip, transitionOptions: MotionTransitionOptions) {
      const clip = active();
      if (pending) fail('TRANSITION_ACTIVE', 'complete the pending fade before starting another');
      const transition = ownFields(transitionOptions, ['destinationTimeSeconds', 'fadeDurationSeconds'], ['timing']);
      const duration = boundedTime(transition.fadeDurationSeconds, 3600, 'fadeDurationSeconds');
      blend(clip, sourceTimeSeconds, nextClip, 0, 0);
      const nextTime = boundedTime(transition.destinationTimeSeconds, nextClip.durationSeconds, 'destinationTimeSeconds');
      const timing = 'timing' in transition ? ownTiming(transition.timing) : null;
      const nextPoses = duration === 0
        ? sampleClip(nextClip, nextTime)
        : blend(clip, sourceTimeSeconds, nextClip, nextTime, 0);
      if (duration === 0) {
        sourceClip = nextClip;
        sourceTimeSeconds = nextTime;
        phase = 'adopted';
        pending = null;
        fadeElapsedSeconds = 0;
        fadeDurationSeconds = 0;
        fadeProgress = 1;
        weight = 1;
        if (mode === 'clamp' && nextTime === nextClip.durationSeconds) playing = false;
      } else {
        pending = { clip: nextClip, timeSeconds: nextTime, elapsedSeconds: 0, durationSeconds: duration, timing };
        phase = 'fading';
        fadeElapsedSeconds = 0;
        fadeDurationSeconds = duration;
        fadeProgress = 0;
        weight = 0;
      }
      poses = nextPoses;
      return state();
    },
    dispose() {
      sourceClip = null;
      pending = null;
      poses = [];
      playing = false;
    },
  };
}
