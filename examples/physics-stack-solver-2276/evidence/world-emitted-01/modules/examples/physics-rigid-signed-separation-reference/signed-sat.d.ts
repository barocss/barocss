import type { Body, Vec3 } from '../../packages/barocss-physics/src/types.js';
export declare const FEATURE_INPUT_MESSAGE = "signed position reference requires admitted raw boxes";
export declare const AXIS_MESSAGE = "signed position reference requires a fresh supported pre-SAT axis";
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
    axis: Vec3 | null;
    orientedNormal: Vec3 | null;
    radiusAM: number | null;
    radiusBM: number | null;
}
export interface SignedSATSelection {
    normal: Vec3;
    boundM: number;
    pointM: Vec3;
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
 * Mirror boxBox's 15-axis order and strict minimum; continue after separation. No preferred face,
 * tie repair, new separation epsilon or normalized quaternion is introduced.
 * Caller-owned bodies and vectors are read only; output contains no references.
 */
export declare function inspectSignedBoxSAT(a: Body, b: Body): SignedSATSelection;
