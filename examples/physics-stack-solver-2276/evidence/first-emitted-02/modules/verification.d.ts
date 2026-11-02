/** Independent physical verification. This file imports no candidate code. */
export type VerificationVec3 = readonly [number, number, number];
export type VerificationMat3 = readonly [VerificationVec3, VerificationVec3, VerificationVec3];
export interface VerificationBody {
    id: string;
    positionM: VerificationVec3;
    velocityMps: VerificationVec3;
    angularVelocityRadps: VerificationVec3;
    inverseMass: number;
    inverseInertiaWorld: VerificationMat3;
}
export interface VerificationPoint {
    id: string;
    aId: string;
    bId: string;
    pointM: VerificationVec3;
    normalAtoB: VerificationVec3;
}
export interface VerificationProblem {
    bodies: readonly VerificationBody[];
    points: readonly VerificationPoint[];
}
export interface VerificationRow {
    id: string;
    normalSpeedMps: number;
    negativeNormalImpulseNs: number;
    complementarityJ: number;
    tangentSpeedMps: number;
}
export interface VerificationCertificate {
    maxClosingNormalSpeedMps: number;
    maxNegativeNormalImpulseNs: number;
    maxComplementarityJ: number;
    maxStationaritySqrtJ: number;
    maxLoadedTangentSpeedMps: number;
    zeroTangentFeasible: boolean;
}
export interface VerificationCandidate {
    ok: boolean;
    status: string;
    bodies: readonly VerificationBody[];
    normalImpulsesNs: readonly number[] | null;
    rowResiduals: readonly VerificationRow[] | null;
    certificate: VerificationCertificate | null;
}
export interface VerificationOracleBody {
    id: string;
    velocityMps: VerificationVec3;
    angularVelocityRadps: VerificationVec3;
    netImpulseNs: VerificationVec3;
    netTorqueNms: VerificationVec3;
}
export interface VerificationOracle {
    bodies: readonly VerificationOracleBody[];
    /** Provenance supplied by the parent fixture authenticator, not checked by a solve. */
    sourceReceiptSha256?: string;
}
export type IndependentBody = VerificationOracleBody;
export interface IndependentRow extends VerificationRow {
    normalImpulseNs: number;
}
export interface VerificationReport {
    passed: boolean;
    normalKktPassed: boolean;
    zeroTangentFrictionFeasible: boolean;
    oracleMatched: boolean;
    candidateReportsMatched: boolean;
    sourceReceiptSha256: string | null;
    bodies: IndependentBody[];
    rows: IndependentRow[];
    maxima: {
        closingNormalSpeedMps: number;
        negativeNormalImpulseNs: number;
        complementarityJ: number;
        loadedTangentSpeedMps: number;
        reportedVelocityErrorMps: number;
        reportedAngularVelocityErrorRadps: number;
        oracleVelocityErrorMps: number;
        oracleAngularVelocityErrorRadps: number;
        oracleNetImpulseErrorNs: number;
        oracleNetTorqueErrorNms: number;
        reportedResidualError: number;
        impulseWorkErrorJ: number;
    };
    energy: {
        freeKineticJ: number;
        finalKineticJ: number;
        normalImpulseWorkJ: number;
    };
    violations: string[];
}
export declare const VERIFICATION_GATE = 1e-10;
/**
 * Rebuild signed impulses and body state directly from input geometry.
 * The parent authenticates the fixture and independent Fraction oracle.
 * No candidate matrix, Jacobian, factorization, or residual helper is used.
 */
export declare function verifyNormalSolution(problem: VerificationProblem, candidate: VerificationCandidate, oracle: VerificationOracle): VerificationReport;
