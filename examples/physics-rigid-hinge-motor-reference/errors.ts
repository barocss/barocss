import { PhysicsError } from '../../packages/barocss-physics/src/types.js';
import { ERRORS as PARENT_ERRORS } from '../physics-rigid-hinge-velocity-reference/profile.js';
import type { KnownErrorRecord, PairBodies } from './types.js';

export const ERRORS = {
  ...PARENT_ERRORS,
  options: 'private hinge motor options are invalid',
  reaction: 'unsafe joint reaction',
  diagnostics: 'private hinge motor diagnostics are invalid',
} as const;

export function reactionError(): never { throw new PhysicsError('NUMERIC_LIMIT', ERRORS.reaction); }
export function diagnosticsError(): never { throw new PhysicsError('NUMERIC_LIMIT', ERRORS.diagnostics); }

/** Inspect only an original known error's own data. Never serialize an unknown payload. */
export function knownCalculationError(value: unknown, bodies: PairBodies): KnownErrorRecord | null {
  try {
    if (!(value instanceof PhysicsError)) return null;
    const code = Object.getOwnPropertyDescriptor(value, 'code');
    const message = Object.getOwnPropertyDescriptor(value, 'message');
    const name = Object.getOwnPropertyDescriptor(value, 'name');
    if (!code || !message || !name || !('value' in code) || !('value' in message) || !('value' in name) ||
      name.value !== 'PhysicsError' || typeof message.value !== 'string') return null;
    const numeric = [ERRORS.pose, ERRORS.result, ERRORS.linear, ERRORS.system, ERRORS.certificate,
      ERRORS.reaction, ERRORS.diagnostics,
      ...bodies.flatMap(b => [`${b.id} exceeded angular movement limit`, `${b.id} exceeded step displacement limit`,
        `${b.id} position exceeded bounds`, `${b.id} velocity exceeded bounds`,
        `${b.id} angularVelocity exceeded bounds`, `${b.id} orientation exceeded tolerance`])];
    if (code.value === 'NUMERIC_LIMIT' && numeric.includes(message.value) ||
      code.value === 'INVALID_CONFIG' && message.value === ERRORS.profile ||
      code.value === 'INVALID_STEP' && message.value === ERRORS.dt) {
      return { name: 'PhysicsError', code: code.value, message: message.value };
    }
  } catch { /* Preserve the actual value received from the immutable parent. */ }
  return null;
}
