import { PhysicsError } from '../capsule-query-error.js';
import type { Vec3 } from '../types.js';
import type { UprightCapsuleQuery, CapsuleSweepInputV1, CapsuleSweepHitV1 } from '../capsule-query.js';
import { QUERY_CAP } from './profile.js';
import { clone, dot } from './math.js';
import { errorRecord } from './state.js';
import type { CharacterState, CharacterDiagnostics } from './types.js';

export interface QueryResult { hit: CapsuleSweepHitV1 | null; indices: number[]; }
export interface QueryContext {
  sweep(position: Vec3, delta: Vec3, kind: string, preview?: boolean): QueryResult;
  commit(position: Vec3, delta: Vec3, kind: string, indices: number[]): Vec3;
}
export function queryContext(query: UprightCapsuleQuery, candidate: CharacterState,
    diagnostic: CharacterDiagnostics, capture: boolean): QueryContext {
  function raw(position: Vec3, delta: Vec3, kind: string, preview: boolean, excludeId: string | null = null): QueryResult {
    if (candidate.queryCount >= (diagnostic.queryBudget ?? QUERY_CAP)) {
      throw new PhysicsError('WORLD_LIMIT', 'Controller per-step query limit exhausted');
    }
    const input: CapsuleSweepInputV1 = {
      revision: candidate.sceneRevision, centerM: [...position], displacementM: [...delta], excludeId,
    };
    const index = candidate.queryCount;
    candidate.queryCount++;
    let hit: CapsuleSweepHitV1 | null;
    try { hit = query.sweep(input); }
    catch (error) {
      if (capture) candidate.lastQueries.push({ kind, preview, input: clone(input), hit: null, error: errorRecord(error) });
      throw error;
    }
    if (capture) candidate.lastQueries.push({ kind, preview, input: clone(input), hit: clone(hit), error: null });
    return { hit, indices: [index] };
  }
  function sweep(position: Vec3, delta: Vec3, kind: string, preview = false): QueryResult {
    const first = raw(position, delta, kind, preview);
    if (first.hit?.toiFraction === 0 && dot(first.hit.normalFixtureToCapsule, delta) >= -1e-12) {
      const second = raw(position, delta, kind + '-fresh-touch-departure', preview, first.hit.bodyId);
      if (second.hit?.toiFraction === 0) throw new PhysicsError('INVALID_COMMAND', 'Controller second fresh touch is unresolved');
      return { hit: second.hit, indices: [...first.indices, ...second.indices] };
    }
    return first;
  }
  function commit(position: Vec3, delta: Vec3, kind: string, indices: number[]): Vec3 {
    const target = position.map((value, index) => value + delta[index]) as Vec3;
    if (capture) candidate.lastSegments.push({
      kind, fromM: [...position], displacementM: [...delta], toM: [...target], queryIndices: [...indices],
    });
    return target;
  }
  return { sweep, commit };
}
