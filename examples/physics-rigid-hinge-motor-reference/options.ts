import { PhysicsError } from '../../packages/barocss-physics/src/types.js';
import { ownData } from './copy.js';
import { ERRORS } from './errors.js';
import type { HingeMotorOptions } from './types.js';

/** Called after parent and command admission. No observer is registered on refusal. */
export function admitOptions(value: unknown): HingeMotorOptions {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PhysicsError('INVALID_CONFIG', ERRORS.options);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length === 0 && ownData(value, []) !== null) return {};
  const input = ownData(value, ['observeAttempt']);
  if (!input || typeof input.observeAttempt !== 'function') {
    throw new PhysicsError('INVALID_CONFIG', ERRORS.options);
  }
  return { observeAttempt: input.observeAttempt as NonNullable<HingeMotorOptions['observeAttempt']> };
}
