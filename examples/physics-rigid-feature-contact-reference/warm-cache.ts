import type { PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import type { VelocityGeometryPoint } from './geometry-adapter.js';

export interface WarmCacheStats {
  testedPatches: number; compatiblePatches: number; incompatiblePatches: number;
  reusedPoints: number; coldPoints: number;
}

export function emptyWarmCacheStats(): WarmCacheStats {
  return { testedPatches: 0, compatiblePatches: 0, incompatiblePatches: 0, reusedPoints: 0, coldPoints: 0 };
}

/** Whole current/prior face-key equality only. Edge rows are always cold. */
export function compatiblePatch(cache: ReadonlyMap<string, PointImpulse>, pairKey: string,
  points: readonly VelocityGeometryPoint[], family: 'face' | 'edge'): boolean {
  if (family !== 'face') return false;
  const prefix = `${pairKey}\u0000`;
  const current = new Set(points.map(point => `${prefix}${point.id}`));
  const previous = [...cache.keys()].filter(key => key.startsWith(prefix));
  return current.size > 0 && current.size === points.length
    && points.every(point => point.id.startsWith('face:'))
    && previous.length === current.size
    && previous.every(key => key.slice(prefix.length).startsWith('face:') && current.has(key));
}
