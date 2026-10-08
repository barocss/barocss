import { PhysicsError } from './index.js';
import type { PhysicsErrorCode, Vec3 } from './types.js';

export function proxyError(code: PhysicsErrorCode, message: string): never {
  throw new PhysicsError(code, message);
}

export function proxyRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    proxyError('INVALID_CONFIG', 'CAD proxy request must be a plain object');
  }
  return value as Record<string, unknown>;
}

export function proxyFields(value: Record<string, unknown>, allowed: string[]): void {
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.includes(key))) {
    proxyError('INVALID_CONFIG', 'CAD proxy request has an unsupported field');
  }
}

export function proxyFinite(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    proxyError('INVALID_CONFIG', `${label} must be finite and in [${min}, ${max}]`);
  }
  return value;
}

export function proxyVector(value: unknown, min: number, max: number, label: string): Vec3 {
  if (!Array.isArray(value) || value.length !== 3 || Reflect.ownKeys(value).length !== 4 ||
    ![0, 1, 2].every((index) => Object.hasOwn(value, index))) {
    proxyError('INVALID_CONFIG', `${label} must be a dense 3-vector`);
  }
  return [0, 1, 2].map((index) => proxyFinite(value[index], min, max, `${label}[${index}]`)) as Vec3;
}
