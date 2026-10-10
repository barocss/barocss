import type { Body } from '../../packages/barocss-physics/src/types.js';
import { detect } from '../../packages/barocss-physics/src/collision.js';
import { correctPersistentPair } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import { MAX_STEP_DISPLACEMENT_M } from '../../packages/barocss-physics/src/limits.js';
import { error } from '../../packages/barocss-physics/src/validation.js';

export interface ProjectionStats { sweeps: number; tests: number; hits: number }
export function relaxPositions(bodies: Body[], pairs: Array<[number, number]>): ProjectionStats {
  const stats: ProjectionStats = { sweeps: 32, tests: 0, hits: 0 };
  for (let sweep = 0; sweep < 32; sweep++) {
    for (const [aIndex, bIndex] of pairs) {
      stats.tests++;
      const a = bodies[aIndex], b = bodies[bIndex];
      const hit = detect(a, b);
      if (!hit) continue;
      stats.hits++;
      if (hit.penetration > MAX_STEP_DISPLACEMENT_M) {
        error('NUMERIC_LIMIT', 'position relaxation penetration exceeded limit');
      }
      correctPersistentPair(a, b, hit.normal, hit.penetration);
    }
  }
  return stats;
}
