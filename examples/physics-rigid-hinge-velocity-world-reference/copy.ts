import { copyBody } from '../../packages/barocss-physics/src/validation.js';
import type { Body, PairBodies, WorldBodies } from './types.js';
export { ownData, denseNumbers } from '../physics-rigid-hinge-motor-reference/copy.js';

/** Admitted or constructed data only; every occurrence gets a separate copy. */
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
export function copyBodies(bodies: readonly Body[]): WorldBodies {
  return [copyBody(bodies[0]), copyBody(bodies[1]), copyBody(bodies[2]), copyBody(bodies[3])];
}
export function copyPair(bodies: readonly Body[]): PairBodies {
  return [copyBody(bodies[0]), copyBody(bodies[1])];
}
