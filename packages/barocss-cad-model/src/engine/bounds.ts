// The box round several bodies' display meshes (R4 B1: the loops each module wrote, gathered). No bodies: min at
// +Infinity and max at −Infinity, as every loop started.
import type { Vec3 } from './vec3';

type Bounded = { readonly mesh: { readonly bounds: { readonly min: readonly number[]; readonly max: readonly number[] } } };

/** The union of the bodies' mesh bounds. */
export function boundsOf(bodies: readonly Bounded[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const b of bodies) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.mesh.bounds.min[k]); max[k] = Math.max(max[k], b.mesh.bounds.max[k]); }
  return { min, max };
}
