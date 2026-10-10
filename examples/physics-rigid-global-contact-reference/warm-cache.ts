import type { PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import type { ManifoldPoint } from '../../packages/barocss-physics/src/contact-manifold.js';

export interface WarmCacheStats {
  testedPatches: number; compatiblePatches: number; incompatiblePatches: number;
  reusedPoints: number; coldPoints: number;
}
export function emptyWarmCacheStats(): WarmCacheStats {
  return { testedPatches: 0, compatiblePatches: 0, incompatiblePatches: 0, reusedPoints: 0, coldPoints: 0 };
}
/** Cross-step eligibility only. Existing current-step entries are never reset. */
export function compatiblePatch(cache: ReadonlyMap<string, PointImpulse>,
  pairKey: string, manifold: readonly ManifoldPoint[]): boolean {
  const prefix = `${pairKey}\u0000`;
  const current = new Set(manifold.map(point => `${prefix}${point.id}`));
  const previous = [...cache.keys()].filter(key => key.startsWith(prefix));
  return current.size > 0 && previous.length === current.size &&
    previous.every(key => current.has(key));
}
