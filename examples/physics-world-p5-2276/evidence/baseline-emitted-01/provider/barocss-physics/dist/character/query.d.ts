import type { Vec3 } from '../internal-types.js';
import type { UprightCapsuleQuery, CapsuleSweepHitV1 } from '../capsule-query.js';
import type { CharacterState, CharacterDiagnostics } from './types.js';
export interface QueryResult {
    hit: CapsuleSweepHitV1 | null;
    indices: number[];
}
export interface QueryContext {
    sweep(position: Vec3, delta: Vec3, kind: string, preview?: boolean): QueryResult;
    commit(position: Vec3, delta: Vec3, kind: string, indices: number[]): Vec3;
}
export declare function queryContext(query: UprightCapsuleQuery, candidate: CharacterState, diagnostic: CharacterDiagnostics, capture: boolean): QueryContext;
