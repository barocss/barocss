import type { Vec3 } from '../types.js';

export const dot = (a: Vec3, b: Vec3): number => a.reduce((sum, value, index) => sum + value * b[index], 0);
export const add = (a: Vec3, b: Vec3): Vec3 => a.map((value, index) => value + b[index]) as Vec3;
export const scale = (a: Vec3, factor: number): Vec3 => a.map(value => value * factor) as Vec3;
export const norm = (a: Vec3): number => Math.hypot(...a);

/** Clone only admitted private records and arrays. Preserve all numeric bits. */
export function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => clone(item)) as T;
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) result[key] = clone((value as Record<string, unknown>)[key]);
    return result as T;
  }
  return value;
}
