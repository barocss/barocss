import { PhysicsError } from '../../packages/barocss-physics/src/types.js';
import { ERRORS as PARENT_ERRORS } from '../physics-rigid-hinge-velocity-reference/profile.js';
import type { Body, KnownErrorRecord } from './types.js';

export const WORLD_ERRORS = {
  profile: 'private hinge velocity World profile is unsupported',
  options: 'private hinge velocity World options are invalid',
  contact: 'private hinge velocity World contact profile is unsupported',
  diagnostics: 'private hinge velocity World diagnostics are invalid',
  result: 'private hinge velocity World result is invalid',
} as const;
export function worldFailure(kind: keyof typeof WORLD_ERRORS): never {
  throw new PhysicsError(kind === 'profile' || kind === 'options' ? 'INVALID_CONFIG' : 'NUMERIC_LIMIT', WORLD_ERRORS[kind]);
}

/** Inspect only exact original class/code/message with own data; unknown values are never serialized. */
export function knownWorldCalculationError(value: unknown, bodies: readonly Body[]): KnownErrorRecord | null {
  try {
    if (!(value instanceof PhysicsError)) return null;
    const code = Object.getOwnPropertyDescriptor(value, 'code');
    const message = Object.getOwnPropertyDescriptor(value, 'message');
    const name = Object.getOwnPropertyDescriptor(value, 'name');
    if (!code || !message || !name || !('value' in code) || !('value' in message) || !('value' in name) ||
      name.value !== 'PhysicsError' || typeof message.value !== 'string') return null;
    const numeric = [PARENT_ERRORS.pose, PARENT_ERRORS.result, PARENT_ERRORS.linear, PARENT_ERRORS.system,
      PARENT_ERRORS.certificate, WORLD_ERRORS.contact, WORLD_ERRORS.diagnostics, WORLD_ERRORS.result,
      'contact penetration exceeded limit', 'unsafe contact result', 'unsafe joint reaction',
      ...bodies.flatMap(body => [`${body.id} exceeded angular movement limit`, `${body.id} exceeded step displacement limit`,
        `${body.id} position exceeded bounds`, `${body.id} velocity exceeded bounds`,
        `${body.id} angularVelocity exceeded bounds`, `${body.id} orientation exceeded tolerance`])];
    if (code.value === 'NUMERIC_LIMIT' && numeric.includes(message.value) ||
      code.value === 'INVALID_CONFIG' && message.value === PARENT_ERRORS.profile ||
      code.value === 'INVALID_STEP' && message.value === PARENT_ERRORS.dt) {
      return { name: 'PhysicsError', code: code.value, message: message.value };
    }
  } catch { /* Keep the actual emerged value from the unchanged parent boundary. */ }
  return null;
}
