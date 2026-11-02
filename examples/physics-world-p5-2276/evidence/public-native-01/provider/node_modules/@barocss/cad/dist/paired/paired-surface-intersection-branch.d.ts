import type { Surface, Model, Point } from '../types.js';
import type { SurfaceD1Result } from '../core/derivatives.js';
import { KernelError } from '../core/barocss-error.js';
type Two<T> = [T, T];
type Three<T> = [T, T, T];
type Size = {
    utf16: number;
    utf8: number;
};
type Domains = {
    u: [number, number];
    v: [number, number];
};
type Asset = {
    sourceId: string;
    source: string;
    surface: Surface;
};
type UV = [number, number];
type UnknownCoordinates = [number, number, number];
export declare const PairedSurfaceIntersectionBranchDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly SOURCE: "SOURCE";
    readonly REFERENCE: "REFERENCE";
    readonly SUPPORT: "SUPPORT";
    readonly DOMAIN: "DOMAIN";
    readonly CONTINUITY: "CONTINUITY";
    readonly REGULARITY: "REGULARITY";
    readonly TANGENCY: "TANGENCY";
    readonly CHART: "CHART";
    readonly CONDITION: "CONDITION";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly NATIVE: "NATIVE";
    readonly STAGNATION: "STAGNATION";
    readonly WORK: "WORK";
    readonly BUDGET: "BUDGET";
    readonly BINDING: "BINDING";
    readonly FILE: "FILE";
    readonly OWNED: "OWNED";
}>;
type DiagnosticCode = typeof PairedSurfaceIntersectionBranchDiagnosticCode[keyof typeof PairedSurfaceIntersectionBranchDiagnosticCode];
export interface PairedSurfaceIntersectionBranchOptions {
    evaluationId: string;
    maximumStations: number;
    maximumCorrectionsPerStation: number;
    maximumTrialsPerCorrection: number;
    maximumSurfacePointEvaluations: number;
    maximumSurfaceDerivativeAttempts: number;
}
export interface PairedSurfaceIntersectionBranchRequest {
    assets: Two<Asset>;
    seed: {
        uvA: UV;
        uvB: UV;
    };
    uAStations: number[];
    options: PairedSurfaceIntersectionBranchOptions;
}
type DirectCounts = {
    sourceCompilationCount: number;
    selectedSurfaceValidationCount: number;
    surfaceDomainCount: number;
    stationStartCount: number;
    stationCompletionCount: number;
    correctionSolveCount: number;
    acceptedCorrectionCount: number;
    trialSlotCount: number;
    domainRejectedTrialCount: number;
    inDomainTrialCount: number;
    rejectedDecreaseTrialCount: number;
    acceptedTrialCount: number;
    surfacePointEvaluationCount: number;
    surfaceDerivativeAttemptCount: number;
    finalPointPairCount: number;
    chartFactorizationCount: number;
    linearSolveCount: number;
    tangentSolveCount: number;
    curvePointEvaluationCount: 0;
    curveDerivativeAttemptCount: 0;
    secondDerivativeAttemptCount: 0;
    rationalOperationCount: 0;
    fittingCallCount: 0;
    sourceWriterCallCount: 0;
};
type ErrorContext = {
    phase: 'input' | 'source' | 'reference' | 'support' | 'seed' | 'station' | 'd1' | 'regularity' | 'chart' | 'newton' | 'trial' | 'final-d0' | 'tangent' | 'file' | 'owned';
    assetIndex: 0 | 1 | null;
    stationIndex: number | null;
    correctionIndex: number | null;
    trialIndex: number | null;
    directCounts: DirectCounts;
};
export declare class PairedSurfaceIntersectionBranchError extends KernelError {
    readonly code: DiagnosticCode;
    readonly context: ErrorContext;
    constructor(code: DiagnosticCode, detail: string, context: ErrorContext, cause?: unknown);
}
type Pivot = {
    column: 0 | 1 | 2;
    selectedCurrentRow: 0 | 1 | 2;
    pivotRowOriginalIndex: 0 | 1 | 2;
    swappedCurrentRows: [number, number] | null;
    absolutePivot: number;
    rowOrder: Three<number>;
};
type Elimination = {
    column: 0 | 1;
    row: 1 | 2;
    factor: number;
};
type Chart = {
    unknownOrder: ['vA', 'uB', 'vB'];
    jacobian: Three<Point>;
    domainWidths: Three<number>;
    scaledColumnNorms: Three<number>;
    normalizedMatrix: Three<Point>;
    rowOrder: Three<number>;
    pivots: Three<Pivot>;
    eliminations: Three<Elimination>;
    lowerTriangularMatrix: Three<Point>;
    upperTriangularMatrix: Three<Point>;
    minimumAbsolutePivot: number;
    method: 'domain-width-column-normalization-absolute-partial-row-pivot';
    tiePolicy: 'first-current-row-on-equal-absolute-score';
    recoveryAssociation: 'domain-width-times-normalized-solution-divided-by-scaled-column-norm';
};
type Solve = {
    role: 'newton' | 'tangent';
    rhsMM: Point;
    permutedRHS: Point;
    forwardSubstitutionRHS: Point;
    normalizedSolution: Point;
    recoveredOriginalUnknowns: UnknownCoordinates;
};
type Residual = {
    vectorMM: Point;
    normMM: number;
};
type NormalEvidence = {
    rawA: Point;
    rawB: Point;
    normA: number;
    normB: number;
    unitA: Point;
    unitB: Point;
    unitCross: Point;
    transverseMeasure: number;
};
type TrialBase = {
    index: number;
    damping: number;
    proposedZ: UnknownCoordinates;
    uvA: UV;
    uvB: UV;
};
type Trial = TrialBase & ({
    status: 'outside-domain';
    pointA: null;
    pointB: null;
    residual: null;
    armijoLimitMM: null;
} | {
    status: 'rejected-decrease' | 'accepted';
    pointA: Point;
    pointB: Point;
    residual: Residual;
    armijoLimitMM: number;
});
type Correction = {
    index: number;
    uvA: UV;
    uvB: UV;
    d1A: SurfaceD1Result;
    d1B: SurfaceD1Result;
    residual: Residual;
    normalEvidence: NormalEvidence;
    chart: Chart;
    solve: Solve;
    undampedDelta: UnknownCoordinates;
    initialDamping: number;
    trials: Trial[];
    acceptedTrialIndex: number;
};
type Observation = {
    index: number;
    uA: number;
    initialSeedZ: UnknownCoordinates;
    uvA: UV;
    uvB: UV;
    pointA: Point;
    pointB: Point;
    d1A: SurfaceD1Result;
    d1B: SurfaceD1Result;
    residual: Residual;
    d0ToD1PointGapMM: Two<number>;
    normalEvidence: NormalEvidence;
    chart: Chart;
    tangentSolve: Solve;
    originalParameterDerivative: UnknownCoordinates;
    tangentA: Point;
    tangentB: Point;
    relativeTangentGap: number;
    corrections: Correction[];
    work: {
        correctionSolveCount: number;
        acceptedCorrectionCount: number;
        trialSlotCount: number;
        domainRejectedTrialCount: number;
        inDomainTrialCount: number;
        surfacePointEvaluationCount: number;
        surfaceDerivativeAttemptCount: number;
        chartFactorizationCount: number;
        linearSolveCount: number;
    };
};
export interface PairedSurfaceIntersectionBranchReport {
    schema: 'barocss-seeded-paired-surface-intersection-branch';
    version: 0;
    evaluationId: string;
    lengthUnit: 'mm';
    parameterUnit: 'dimensionless';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameterFrame: 'original-native-u-v-domains';
    selections: Two<{
        assetIndex: 0 | 1;
        sourceId: string;
        modelName: string;
        objectIndex: number;
        surfaceId: string;
        sourceField: 'request.assets.source';
        modelField: 'originalModels';
        sourceVersion: 0;
        degrees: [number, number];
        controlPointGrid: [number, number];
        domains: Domains;
    }>;
    stationCount: number;
    maximumObservedPointGapMM: number;
    maximumObservedD0ToD1PointGapMM: number;
    maximumObservedRelativeTangentGap: number;
    minimumObservedTransverseMeasure: number;
    minimumObservedAbsolutePivot: number;
    directCounts: DirectCounts;
    sourceSizes: Two<Size>;
    fileSizes: {
        request: Size;
        result: Size;
    };
    numericPolicy: {
        corrector: 'fixed-original-uA-three-unknown-native-newton';
        unknownOrder: ['vA', 'uB', 'vB'];
        nextSeed: 'previous-converged-original-z-no-predictor';
        firstSeed: 'caller-uA-object-is-first-station';
        normAuthority: 'finite-native-components-and-finite-norms-before-division';
        pointComparisonMM: 1e-7;
        relativeTangentComparison: 1e-7;
        minimumTransverseMeasure: 1e-6;
        scaledColumnNormMinimumMM: 1e-12;
        scaledColumnNormMaximumMM: 1e12;
        minimumAbsolutePivot: 1e-10;
        maximumDomainFractionStep: 0.25;
        armijoCoefficient: 0.0001;
        damping: 'single-initial-domain-fraction-cap-then-half-per-trial';
        domain: 'original-domain-test-no-clamping';
        factorReuse: 'once-per-current-d1-pair-one-newton-or-final-tangent-solve';
        recoveryAssociation: 'domain-width-times-normalized-solution-divided-by-scaled-column-norm';
        finalPointCheck: 'always-one-new-native-d0-pair-even-if-trial-or-seed-cached';
        localAuthority: 'sampled-native-residual-and-measured-chart-transversality-only';
    };
    preservation: {
        completeOriginalSources: true;
        completeOriginalModelsAndSiblings: true;
        selectedSurfaceBits: true;
        sourceQualifiedOriginalIdentities: true;
        originalDomainBits: true;
        bothOriginalUVsAndNativePoints: true;
        nativeAnalyticDerivatives: true;
        noDomainNormalization: true;
        noFiniteDifferences: true;
        noClampingOrToleranceRelaxation: true;
        noSourceOrCurveConstruction: true;
    };
    quality: {
        sampledSeededLocalBranch: true;
        geometricValidity: 'not-certified';
        exactTrimCurve: false;
        pairedPcurve: false;
        allBranches: false;
        branchIdentityBetweenStations: false;
        wholeSpanErrorCertified: false;
        globalBinary64ErrorCertified: false;
        turningSupported: false;
        contactClassifier: false;
        topologyCertified: false;
        closed: false;
        body: false;
        solid: false;
        manufacturingToleranceCertified: false;
        publication: false;
        ownedRebuild: true;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumStations: 17;
        maximumCorrectionsPerStation: 12;
        maximumTrialsPerCorrection: 8;
        maximumSurfacePointEvaluations: 3298;
        maximumSurfaceDerivativeAttempts: 442;
        maximumNativeEvaluationAttempts: 3740;
        maximumChartFactorizations: 221;
        maximumLinearSolves: 221;
        minimumSelectedDegree: 1;
        maximumSelectedDegree: 3;
        maximumSelectedAxisPoles: 8;
        maximumSelectedPoles: 64;
        coordinateAbsMM: 10000;
        minimumWeight: 0.001;
        maximumWeight: 1000;
        parameterAbs: 10000;
        minimumDomainWidth: 0.001;
        maximumDomainWidth: 10000;
        maximumModelObjects: 16;
        identityCharacters: 48;
        sourceUTF16: 262144;
        sourceUTF8: 262144;
        maximumRequestUTF16: 2097152;
        maximumRequestUTF8: 2097152;
        maximumResultUTF16: 4194304;
        maximumResultUTF8: 4194304;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        stringCharacters: 262144;
        authoredParserDepth: 12;
        authoredParserValues: 65536;
        authoredParserRecordFields: 16;
        authoredParserStringCharacters: 262144;
    };
    workScope: 'actual-direct-native-attempts-and-root-factor-solves-compiler-descendants-excluded';
    budgetFailure: 'atomic-no-partial-accepted-paired-surface-branch';
}
export interface PairedSurfaceIntersectionBranchResult {
    request: PairedSurfaceIntersectionBranchRequest;
    originalModels: Two<Model>;
    observations: Observation[];
    report: PairedSurfaceIntersectionBranchReport;
}
/** Trace a caller-seeded local branch in original parameters, without fitting or topology construction. */
export declare function tracePairedSurfaceIntersectionBranch(input: PairedSurfaceIntersectionBranchRequest): PairedSurfaceIntersectionBranchResult;
/** Rebuild the complete owned branch once from the original request and compare every retained bit. */
export declare function validatePairedSurfaceIntersectionBranch(value: unknown): PairedSurfaceIntersectionBranchReport;
export {};
