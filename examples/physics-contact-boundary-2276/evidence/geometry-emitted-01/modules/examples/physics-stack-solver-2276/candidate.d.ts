/** Private normal-only contact candidate. No World, geometry or fixture imports. */
export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [Vec3, Vec3, Vec3];
export interface NormalBody {
    id: string;
    positionM: Vec3;
    velocityMps: Vec3;
    angularVelocityRadps: Vec3;
    inverseMass: number;
    inverseInertiaWorld: Mat3;
}
export interface NormalPoint {
    id: string;
    aId: string;
    bId: string;
    pointM: Vec3;
    normalAtoB: Vec3;
}
export interface NormalProblem {
    bodies: readonly NormalBody[];
    points: readonly NormalPoint[];
}
export interface NormalRowResidual {
    id: string;
    normalSpeedMps: number;
    negativeNormalImpulseNs: number;
    complementarityJ: number;
    tangentSpeedMps: number;
}
export interface NormalCertificate {
    maxClosingNormalSpeedMps: number;
    maxNegativeNormalImpulseNs: number;
    maxComplementarityJ: number;
    maxStationaritySqrtJ: number;
    maxLoadedTangentSpeedMps: number;
    zeroTangentFeasible: boolean;
}
export interface NormalSolverStats {
    outerIterations: number;
    blockQrFactorizations: number;
    activeChanges: number;
    qrRank: number;
    finalActiveRows: number;
    dynamicDof: number;
    rankTests: number;
    dotProducts: number;
    dotScalarProducts: number;
    vectorUpdates: number;
    triangularTerms: number;
    constraintTests: number;
}
export interface NormalSolverResult {
    ok: boolean;
    status: 'SOLVED_NORMAL_ONLY' | 'NUMERIC' | 'ITERATION_LIMIT';
    bodies: NormalBody[];
    normalImpulsesNs: number[] | null;
    rowResiduals: NormalRowResidual[] | null;
    certificate: NormalCertificate | null;
    stats: NormalSolverStats;
    reason: string | null;
}
export declare const NORMAL_CANDIDATE_GATES: Readonly<{
    normal: 1e-10;
    complementarity: 1e-10;
    stationarity: 1e-10;
    tangent: 1e-10;
    rank: 1e-12;
}>;
export declare const NORMAL_CANDIDATE_BUDGET: Readonly<{
    outerIterations: 64;
    blockQrFactorizations: 64;
    activeChanges: 64;
    rankTests: 2048;
    dotProducts: 400000;
    dotScalarProducts: 32000000;
    vectorUpdates: 10000000;
    triangularTerms: 40000;
    constraintTests: 4096;
}>;
/** Solves only homogeneous normal constraints. Tangential impulses are zero. */
export declare function solveNormalContacts(problem: NormalProblem): NormalSolverResult;
