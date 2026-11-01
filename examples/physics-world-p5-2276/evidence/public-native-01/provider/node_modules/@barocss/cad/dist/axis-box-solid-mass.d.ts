import type { AxisBoxSolidBooleanResult } from './axis-box-boolean.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionFraction } from './section-rational-internal.js';
import type { Point } from './types.js';
import { KernelError } from './core/barocss-error.js';
export declare const AxisBoxSolidMassDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly BUDGET: "BUDGET";
    readonly BOOLEAN: "BOOLEAN";
    readonly BINDING: "BINDING";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly OWNED: "OWNED";
}>;
export type AxisBoxSolidMassDiagnosticCode = typeof AxisBoxSolidMassDiagnosticCode[keyof typeof AxisBoxSolidMassDiagnosticCode];
export declare class AxisBoxSolidMassError extends KernelError {
    readonly code: AxisBoxSolidMassDiagnosticCode;
    constructor(code: AxisBoxSolidMassDiagnosticCode, detail: string, cause?: unknown);
}
export interface AxisBoxSolidMassOptions {
    densityKgPerM3: number;
    maximumCells: number;
}
type Fraction = SectionFraction;
type FractionVector = [Fraction, Fraction, Fraction];
type FractionMatrix = [FractionVector, FractionVector, FractionVector];
type Matrix = [Point, Point, Point];
type ErrorBound = {
    exact: Fraction;
    upper: number;
};
type ErrorVector = [ErrorBound, ErrorBound, ErrorBound];
type ErrorMatrix = [ErrorVector, ErrorVector, ErrorVector];
type Index3 = [number, number, number];
export interface AxisBoxSolidMassMeasure {
    bodyId: string | null;
    cellIndices: Index3[];
    volumeMM3: number;
    massKG: number;
    centroidMM: Point | null;
    inertiaCentroidKgM2: Matrix | null;
    exact: {
        volumeMM3: Fraction;
        firstMomentsMM4: FractionVector;
        secondMomentsMM5: FractionMatrix;
        centralSecondMomentsMM5: FractionMatrix | null;
        massKG: Fraction;
        centroidMM: FractionVector | null;
        inertiaCentroidKgM2: FractionMatrix | null;
    };
    conversionErrors: {
        massKG: ErrorBound;
        centroidMM: ErrorVector | null;
        inertiaCentroidKgM2: ErrorMatrix | null;
    };
    positiveDefinite: {
        exactLeadingMinors: FractionVector;
        storedLeadingMinors: FractionVector;
    } | null;
}
type CellMoment = {
    index: Index3;
    bodyId: string;
    boundsMM: {
        min: Point;
        max: Point;
    };
    widthsMM: FractionVector;
    centroidMM: FractionVector;
    volumeMM3: Fraction;
    firstMomentsMM4: FractionVector;
    secondMomentsMM5: FractionMatrix;
};
export interface AxisBoxSolidMassReport {
    schema: 'barocss-axis-box-solid-mass';
    version: 0;
    evaluationId: string;
    densityKgPerM3: number;
    densityExactKgPerM3: Fraction;
    empty: boolean;
    bodyCount: number;
    integratedCellCount: number;
    measureCount: number;
    massKG: number;
    centroidMM: Point | null;
    inertiaCentroidKgM2: Matrix | null;
    volumeMM3: number;
    cellMoments: CellMoment[];
    units: {
        density: 'kg/m3';
        mass: 'kg';
        centroid: 'mm';
        inertia: 'kg*m2';
        volume: 'mm3';
        firstMoment: 'mm4';
        secondMoment: 'mm5';
    };
    unitConversions: {
        densityKgPerMM3: Fraction;
        inertiaKgM2PerVolumeSecondMomentMM5: Fraction;
        cubicMillimetresPerCubicMetre: 1000000000;
        squareMillimetresPerSquareMetre: 1000000;
    };
    sourceFrame: 'authored-xyz-no-axis-conversion';
    directCounts: {
        booleanValidationCount: 1;
        cellIntegrationCount: number;
        measureCount: number;
        finalValueConversionCount: number;
        upwardErrorConversionCount: number;
        curvePointEvaluationCount: 0;
        curveDerivativeEvaluationCount: 0;
        surfacePointEvaluationCount: 0;
        surfaceDerivativeEvaluationCount: 0;
        sourceCompilationCount: 0;
    };
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    numericPolicy: {
        authority: 'exact-occupied-integer-cell-raw-and-central-coordinate-moments';
        density: 'uniform-caller-declared-exact-represented-value';
        siConversion: 'exact-integer-divisors-1e9-and-1e15';
        output: 'nearest-even-final-values-only-symmetric-upper-triangle-mirrored';
        errors: 'exact-absolute-conversion-error-and-least-upward-binary64';
        positiveDefinite: 'exact-leading-minors-for-model-and-stored-binary64-matrix';
        nonzeroUnderflow: 'refused';
        generatedExactZero: 'positive-zero';
        empty: 'mass-zero-centroid-and-tensor-null-no-pd-claim';
    };
    quality: {
        exactCellModelMassPropertiesCertified: true;
        nonemptyExactAndStoredTensorPositiveDefinite: boolean;
        densityCertified: false;
        materialCertified: false;
        arbitraryCurvedSolidPropertiesCertified: false;
        manufacturingToleranceCertified: false;
        globalBinary64GeometryEvaluationErrorCertified: false;
        physicalPoseConversionCertified: false;
        principalAxesCertified: false;
        parentProofUnchanged: true;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumCells: 27;
        maximumBodies: 2;
        maximumMeasures: 3;
        maximumFinalFloatConversions: 60;
        maximumFloatSearchSteps: 3840;
        maximumDensityKgPerM3: 1000000;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        floatSearchStepsPerConversion: 64;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        stringCharacters: 262144;
    };
    workScope: 'direct-parent-owned-validation-and-new-exact-cell-integration-parent-internal-work-excluded';
    budgetFailure: 'atomic-no-partial-mass-properties';
}
export interface AxisBoxSolidMassResult {
    boolean: AxisBoxSolidBooleanResult;
    options: AxisBoxSolidMassOptions;
    bodies: AxisBoxSolidMassMeasure[];
    total: AxisBoxSolidMassMeasure;
    report: AxisBoxSolidMassReport;
}
/** Exact uniform-density properties of the actual occupied integer-cell material, with final conversion certificates. */
export declare function measureAxisBoxSolidBooleanMass(booleanInput: AxisBoxSolidBooleanResult, optionsInput: AxisBoxSolidMassOptions): AxisBoxSolidMassResult;
/** Rebuild the complete parent/material integration and all exact/rounded witnesses before whole-result comparison. */
export declare function validateAxisBoxSolidBooleanMass(input: AxisBoxSolidMassResult): AxisBoxSolidMassReport;
export {};
