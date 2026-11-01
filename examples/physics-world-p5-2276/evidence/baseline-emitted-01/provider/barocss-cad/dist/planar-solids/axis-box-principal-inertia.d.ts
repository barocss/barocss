import type { AxisBoxSolidMassResult, AxisBoxSolidMassMeasure } from '../axis-box-solid-mass.js';
import type { Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const AxisBoxSolidPrincipalInertiaDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly BUDGET: "BUDGET";
    readonly MASS: "MASS";
    readonly SELECTION: "SELECTION";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly OWNED: "OWNED";
}>;
export type AxisBoxSolidPrincipalInertiaDiagnosticCode = typeof AxisBoxSolidPrincipalInertiaDiagnosticCode[keyof typeof AxisBoxSolidPrincipalInertiaDiagnosticCode];
export declare class AxisBoxSolidPrincipalInertiaError extends KernelError {
    readonly code: AxisBoxSolidPrincipalInertiaDiagnosticCode;
    constructor(code: AxisBoxSolidPrincipalInertiaDiagnosticCode, detail: string, cause?: unknown);
}
export type AxisBoxSolidPrincipalInertiaSelection = {
    kind: 'total';
} | {
    kind: 'body';
    bodyId: string;
};
export interface AxisBoxSolidPrincipalInertiaOptions {
    selection: AxisBoxSolidPrincipalInertiaSelection;
    maximumRotations: number;
    scaledResidualTolerance: number;
    degeneracyToleranceRelative: number;
}
type Matrix = [Point, Point, Point];
type Axis = {
    index: number;
    directionXYZ: Point;
    momentKgM2: number;
};
type Principal = {
    momentsKgM2: Point;
    axesXYZ: [Axis, Axis, Axis];
};
type Rotation = {
    index: number;
    pivot: [number, number];
    pivotValueScaled: number;
    diagonalBeforeScaled: [number, number];
    thetaRadians: number;
    sine: number;
    cosine: number;
    rawAnnihilationResidualScaled: number;
    annihilationGuardScaled: number;
    remainingOffDiagonalNormScaled: number;
    similarityResidualScaled: number;
    similarityGuardScaled: number;
    matrixBeforeScaled: Matrix;
    matrixAfterScaled: Matrix;
    eigenvectorsAfter: Matrix;
};
type Cluster = {
    indices: number[];
    momentsKgM2: number[];
    maximumAdjacentGapKgM2: number;
    thresholdKgM2: number;
};
type Residuals = {
    similarityScaled: number;
    eigensystemScaled: number;
    reconstructionScaled: number;
    orthogonality: number;
    maximumUnitNorm: number;
    determinant: number;
    scaledGuard: number;
    unitGuard: number;
};
export interface AxisBoxSolidPrincipalInertiaReport {
    schema: 'barocss-axis-box-solid-principal-inertia';
    version: 0;
    evaluationId: string;
    selection: AxisBoxSolidPrincipalInertiaSelection;
    selectedBodyId: string | null;
    units: {
        moment: 'kg*m2';
        centroid: 'mm';
        direction: 'world-xyz-unit-vector';
    };
    sourceFrame: 'authored-xyz-no-axis-conversion';
    densityKgPerM3: number;
    massKG: number;
    centroidMM: Point | null;
    empty: boolean;
    storedTensorAuthority: 'only-selected-stored-binary64-tensor-parent-exact-moments-and-errors-separate';
    inputTensorKgM2: Matrix | null;
    matrixScaleKgM2: number;
    normalizedMatrix: Matrix | null;
    options: AxisBoxSolidPrincipalInertiaOptions;
    rotationTrace: Rotation[];
    rotationCount: number;
    convergence: {
        offDiagonalNormScaled: number;
        toleranceScaled: number;
        converged: true;
    };
    sortedMomentsKgM2: Point | null;
    axesXYZ: Principal['axesXYZ'] | null;
    residuals: Residuals | null;
    observedDegenerateClusters: Cluster[];
    axesUnique: boolean | null;
    signPolicy: 'first-two-largest-absolute-component-positive-xyz-ties-third-right-handed';
    directCounts: {
        massValidationCount: 1;
        selectedMeasureBindingCount: 1;
        rotationCount: number;
        curvePointEvaluationCount: 0;
        curveDerivativeEvaluationCount: 0;
        surfacePointEvaluationCount: 0;
        surfaceDerivativeEvaluationCount: 0;
        sourceCompilationCount: 0;
    };
    numericPolicy: {
        pivot: 'largest-absolute-offdiagonal-lexicographic-01-02-12';
        angle: 'half-atan2-2b-d-minus-a';
        annihilation: 'checked-raw-jacobi-pivot-residual-then-zero';
        residualNorm: 'frobenius';
        convergenceNorm: 'upper-offdiagonal-euclidean';
        roundingFactor: 512;
        clustering: 'connected-adjacent-gaps-within-relative-original-matrix-scale';
        axesMeaning: 'canonical-local-representatives-not-persistent-axes';
        axisZeroSign: 'positive-zero-only-for-exact-zero-components';
        guards: 'observed-normalized-rounding-residual-policy-not-rigorous-global-error-bounds';
        uniqueness: 'observed-cluster-status-not-certified-geometry-axis-uniqueness';
    };
    quality: {
        storedTensorAnalysisOnly: true;
        exactGeometryEigenvaluesCertified: false;
        exactGeometryAxesCertified: false;
        globalFloatingEigenanalysisCertified: false;
        axesUniquenessCertified: false;
        persistentAxesCertified: false;
        densityCertified: false;
        materialCertified: false;
        manufacturingToleranceCertified: false;
        physicalPoseConversionCertified: false;
        parentExactAndConversionProofUnchanged: true;
        ownership: 'independent-copied-cpu-data-gc';
    };
    workScope: 'one-actual-public-solid-mass-validation-and-new-jacobi-rotations-parent-rebuild-work-excluded';
    budgetFailure: 'atomic-no-partial-eigensystem';
    limits: {
        maximumRotations: 64;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        stringCharacters: 262144;
    };
}
export interface AxisBoxSolidPrincipalInertiaResult {
    mass: AxisBoxSolidMassResult;
    options: AxisBoxSolidPrincipalInertiaOptions;
    measure: AxisBoxSolidMassMeasure;
    principal: Principal | null;
    report: AxisBoxSolidPrincipalInertiaReport;
}
/** Analyze one actual total/Body STORED tensor; exact parent moment/conversion certificates remain separate and unchanged. */
export declare function analyzeAxisBoxSolidPrincipalInertia(massInput: AxisBoxSolidMassResult, optionsInput: AxisBoxSolidPrincipalInertiaOptions): AxisBoxSolidPrincipalInertiaResult;
/** Re-run the complete actual parent binding and stored-tensor analysis, then compare all sources/proofs/numeric trace bits. */
export declare function validateAxisBoxSolidPrincipalInertia(input: AxisBoxSolidPrincipalInertiaResult): AxisBoxSolidPrincipalInertiaReport;
export {};
