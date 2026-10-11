import { ownData } from './copy.js';
import { worldFailure } from './errors.js';
import type { WorldOptions } from './types.js';

/** Constructor admission after all original profile and scene checks. */
export function admitWorldOptions(value: unknown): WorldOptions {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return worldFailure('options');
  const keys = Reflect.ownKeys(value);
  if (keys.length === 0 && ownData(value, []) !== null) return {};
  const input = ownData(value, ['observeAttempt']);
  if (!input || typeof input.observeAttempt !== 'function') return worldFailure('options');
  return { observeAttempt: input.observeAttempt as NonNullable<WorldOptions['observeAttempt']> };
}
