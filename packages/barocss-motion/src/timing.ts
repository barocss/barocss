import { createMotionPlayer, sampleMotionClip, type MotionClip, type MotionPose } from './index.js';

export type MotionTimingErrorCode = 'INVALID_INPUT' | 'UNSAFE_RESULT';

export class MotionTimingError extends Error {
  readonly code: MotionTimingErrorCode;

  constructor(code: MotionTimingErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'MotionTimingError';
    this.code = code;
  }
}

export interface MotionCubicTiming {
  readonly kind: 'cubic-bezier';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface MotionTimingEvaluation {
  readonly progress: number;
  readonly easedProgress: number;
  readonly parameter: number;
  readonly iterations: number;
  readonly xResidual: number;
}

export interface MotionTimedSample {
  readonly contextId: string;
  readonly inputTimeSeconds: number;
  readonly sampledTimeSeconds: number;
  readonly poses: MotionPose[];
}

const MAX_STEPS = 64;
const MAX_X_RESIDUAL = 1e-9;
const timingFields = ['kind', 'x1', 'y1', 'x2', 'y2'];

function fail(code: MotionTimingErrorCode, path: string, reason: string): never {
  throw new MotionTimingError(code, `${path}: ${reason}`);
}

function unit(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    fail('INVALID_INPUT', path, 'expected a finite number in [0, 1]');
  }
  return value;
}

function ownTiming(value: unknown): MotionCubicTiming {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_INPUT', 'timing', 'expected a plain timing record');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail('INVALID_INPUT', 'timing', 'expected a plain timing record');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== timingFields.length || keys.some((key) => typeof key !== 'string' || !timingFields.includes(key))) {
    fail('INVALID_INPUT', 'timing', 'expected exactly five timing fields');
  }
  const fields: Record<string, unknown> = Object.create(null);
  for (const key of timingFields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_INPUT', `timing.${key}`, 'expected an own data field');
    fields[key] = descriptor.value;
  }
  if (fields.kind !== 'cubic-bezier') fail('INVALID_INPUT', 'timing.kind', 'expected cubic-bezier');
  return {
    kind: 'cubic-bezier',
    x1: unit(fields.x1, 'timing.x1'),
    y1: unit(fields.y1, 'timing.y1'),
    x2: unit(fields.x2, 'timing.x2'),
    y2: unit(fields.y2, 'timing.y2'),
  };
}

function cubic(parameter: number, first: number, second: number): number {
  const remaining = 1 - parameter;
  return 3 * remaining * remaining * parameter * first +
    3 * remaining * parameter * parameter * second + parameter * parameter * parameter;
}

/** Invert one bounded monotone cubic X curve and return a fresh timing result. */
export function evaluateMotionTiming(progress: number, timing: MotionCubicTiming): MotionTimingEvaluation {
  const input = unit(progress, 'progress');
  const curve = ownTiming(timing);
  if (input === 0 || input === 1) {
    const endpoint = input === 0 ? 0 : 1;
    return { progress: input, easedProgress: endpoint, parameter: endpoint, iterations: 0, xResidual: 0 };
  }

  let lower = 0;
  let upper = 1;
  for (let iterations = 1; iterations <= MAX_STEPS; iterations += 1) {
    const parameter = (lower + upper) / 2;
    const x = cubic(parameter, curve.x1, curve.x2);
    const xResidual = Math.abs(x - input);
    if (!Number.isFinite(x) || !Number.isFinite(xResidual)) {
      fail('UNSAFE_RESULT', 'timing', 'nonfinite cubic result');
    }
    if (xResidual <= MAX_X_RESIDUAL) {
      const easedProgress = cubic(parameter, curve.y1, curve.y2);
      if (!Number.isFinite(easedProgress) || easedProgress < 0 || easedProgress > 1) {
        fail('UNSAFE_RESULT', 'timing', 'eased progress is outside [0, 1]');
      }
      return { progress: input, easedProgress, parameter, iterations, xResidual };
    }
    if (x < input) lower = parameter;
    else upper = parameter;
  }
  fail('UNSAFE_RESULT', 'timing', 'X inversion did not meet residual bound');
}

/** Sample an actual clip at a caller-supplied eased time without changing the clip. */
export function sampleMotionClipWithTiming(
  clip: MotionClip, inputTimeSeconds: number, timing: MotionCubicTiming,
): MotionTimedSample {
  try {
    const validator = createMotionPlayer(clip, { mode: 'clamp' });
    validator.dispose();
  } catch {
    fail('INVALID_INPUT', 'clip', 'expected a validated v0 MotionClip');
  }
  const duration = clip.durationSeconds;
  if (typeof inputTimeSeconds !== 'number' || !Number.isFinite(inputTimeSeconds) ||
      inputTimeSeconds < 0 || inputTimeSeconds > duration) {
    fail('INVALID_INPUT', 'inputTimeSeconds', 'expected a finite time within the clip');
  }
  const evaluation = evaluateMotionTiming(duration === 0 ? 0 : inputTimeSeconds / duration, timing);
  const sampledTimeSeconds = duration === 0 || inputTimeSeconds === 0 || inputTimeSeconds === duration
    ? inputTimeSeconds : duration * evaluation.easedProgress;
  if (!Number.isFinite(sampledTimeSeconds) || sampledTimeSeconds < 0 || sampledTimeSeconds > duration) {
    fail('UNSAFE_RESULT', 'sampledTimeSeconds', 'computed time is outside the clip');
  }
  try {
    const frame = sampleMotionClip(clip, sampledTimeSeconds);
    return { contextId: frame.contextId, inputTimeSeconds, sampledTimeSeconds, poses: frame.poses };
  } catch {
    fail('UNSAFE_RESULT', 'sampledTimeSeconds', 'existing clip sampler refused the computed time');
  }
}
