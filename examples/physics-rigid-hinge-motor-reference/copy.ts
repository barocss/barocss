import { copyBody } from '../../packages/barocss-physics/src/validation.js';
import type { Body } from '../../packages/barocss-physics/src/types.js';
import type { PairBodies } from './types.js';

/** Internal admitted/constructed data only. Each occurrence gets its own copy. */
export function copyData<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => copyData(item)) as T;
  const copied: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    Object.defineProperty(copied, key, { value: copyData((value as Record<string, unknown>)[key]),
      enumerable: true, configurable: true, writable: true });
  }
  return copied as T;
}

export function copyPair(bodies: readonly Body[]): PairBodies {
  return [copyBody(bodies[0]), copyBody(bodies[1])];
}

/** Guard inputs use descriptors. No accessor is invoked. Reflection errors remain unknown. */
export function ownData(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return null;
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some(k => typeof k !== 'string' || !keys.includes(k))) return null;
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
    Object.defineProperty(result, key, { value: descriptor.value, enumerable: true, configurable: true, writable: true });
  }
  return result;
}

export function denseNumbers(value: unknown, length: number): number[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== length ||
    Reflect.ownKeys(value).length !== length + 1) return null;
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor) ||
      typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value)) return null;
    result.push(descriptor.value);
  }
  return result;
}
