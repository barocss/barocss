import type { FreeRotationResult } from './rigid-free-rotation.js';
import { error } from './validation.js';

/** Validate both prepared angular outputs before either candidate field is assigned. */
export function validateRotationResult(result: FreeRotationResult, dt: number): void {
  if (result.angularVelocityRadps.some(value => !Number.isFinite(value) || Math.abs(value) > 1000) ||
      !Number.isFinite(dt) || dt <= 0 || Math.hypot(...result.angularVelocityRadps) * dt > 10) {
    error('NUMERIC_LIMIT', 'free rotation exceeded angular movement limit');
  }
  if (result.orientation.some(value => !Number.isFinite(value)) ||
      Math.abs(Math.hypot(...result.orientation) - 1) > 1e-12) {
    error('NUMERIC_LIMIT', 'free rotation orientation exceeded tolerance');
  }
}
