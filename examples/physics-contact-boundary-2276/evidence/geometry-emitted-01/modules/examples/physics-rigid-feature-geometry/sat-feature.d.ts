import type { Body, Hit } from '../../packages/barocss-physics/src/types.js';
export declare const FEATURE_INPUT_MESSAGE = "private feature geometry requires two admitted boxes";
/** Reporting only. This value never participates in winner selection. */
export declare const DIAGNOSTIC_TIE_TOLERANCE_M = 1e-12;
export type SATFeature = {
    kind: 'face-a';
    axisA: number;
} | {
    kind: 'face-b';
    axisB: number;
} | {
    kind: 'edge-cross';
    axisA: number;
    axisB: number;
};
export interface SATCandidateDiagnostic {
    candidateIndex: number;
    label: string;
    feature: SATFeature;
    rawAxisLength: number;
    skippedByOriginalCutoff: boolean;
    signedDistanceM: number | null;
    overlapM: number | null;
}
export interface SATFeatureSelection {
    /** Bit-preserved original boxBox hit arithmetic, with detached vectors. */
    hit: Hit;
    feature: SATFeature;
    label: string;
    candidateIndex: number;
    rawAxisLength: number;
    candidates: SATCandidateDiagnostic[];
    ambiguity: {
        exactMinimumCandidateIndices: number[];
        withinDiagnosticTieToleranceCandidateIndices: number[];
        skippedCandidateIndices: number[];
        diagnosticTieToleranceM: number;
        uniquePhysicalFeatureClaimed: false;
    };
}
/**
 * Inputs have already passed the original finite/quaternion/box admission.
 * Mirror boxBox's 15-axis order and strict minimum exactly. No preferred face,
 * tie repair, new separation epsilon or normalized quaternion is introduced.
 * Caller-owned bodies and vectors are read only; output contains no references.
 */
export declare function selectBoxSATFeature(a: Body, b: Body): SATFeatureSelection | null;
