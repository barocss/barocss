import { type Body } from '../../packages/barocss-physics/src/types.js';
import { type SignedSATSelection } from '../physics-rigid-signed-separation-reference/signed-sat.js';
import type { CompactSelection, FullPairProblemBuild, PairObservation, PositionPair } from './world-types.js';
export declare const FULL_PAIR_ERRORS: {
    readonly INPUT: "private full-pair position input is invalid";
    readonly PROFILE: "private full-pair position profile is unsupported";
    readonly RANGE: "private full-pair position signed bound exceeds the admitted range";
    readonly GEOMETRY: "private full-pair position requires fresh matching box geometry";
    readonly INFEASIBLE: "private full-pair position constraints are infeasible";
    readonly NUMERIC_UNSAFE: "private full-pair position solve is numerically unsafe";
    readonly WORK_LIMIT: "private full-pair position solve exceeded its work limit";
    readonly RESULT: "private full-pair position result is invalid";
    readonly NONPENETRATION: "private full-pair position result left an overlapping pair";
};
export declare function refuse(key: keyof typeof FULL_PAIR_ERRORS): never;
/** Only the original class, code and exact message permit a bridge. */
export declare function mapFullPairError(error: unknown): unknown;
export declare function ordinaryDense(value: unknown, size?: number): value is unknown[];
/** Preserve the original private raw-body and pair profile. No parser or repair. */
export declare function checkedFullPairInputs(bodies: readonly Body[], pairs: readonly PositionPair[]): void;
export declare function pairKey(bodies: readonly Body[], a: number, b: number): string;
export declare function compactSelection(full: SignedSATSelection): CompactSelection;
export declare function freshSelection(a: Body, b: Body): CompactSelection;
/** Every eligible PRE pair supplies one unclamped signed row, even when detect is null. */
export declare function buildFullPairProblem(bodies: readonly Body[], pairs: readonly PositionPair[], capture?: FullPairProblemBuild): FullPairProblemBuild;
/** Complete fresh hypothetical scan. It creates no manifold or velocity/cache row. */
export declare function inspectFullPairHypothesis(bodies: readonly Body[], pairs: readonly PositionPair[], capture?: PairObservation[], progress?: {
    postPairTests: number;
}): PairObservation[];
