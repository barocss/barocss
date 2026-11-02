import type { SurfaceD1Result } from '../core/derivatives.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const PiecewiseRationalLoftDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly BASIS: "BASIS";
    readonly STATIONS: "STATIONS";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly SOURCE: "SOURCE";
    readonly OWNED: "OWNED";
}>;
export type PiecewiseRationalLoftDiagnosticCode = typeof PiecewiseRationalLoftDiagnosticCode[keyof typeof PiecewiseRationalLoftDiagnosticCode];
export declare class PiecewiseRationalLoftError extends KernelError {
    readonly code: PiecewiseRationalLoftDiagnosticCode;
    constructor(code: PiecewiseRationalLoftDiagnosticCode, detail: string, cause?: unknown);
}
export interface PiecewiseRationalLoftOptions {
    surfaceId: string;
    modelName: string;
    maximumSections: number;
    maximumUPoles: number;
    maximumPointObservations: number;
    maximumDerivativeObservations: number;
}
export interface PiecewiseRationalLoftProvenance {
    kind: 'piecewise-rational-loft';
    sectionIds: string[];
    surfaceId: string;
    modelName: string;
    uRole: 'original-common-section-parameter';
    vRole: 'explicit-piecewise-rational-stations';
    rows: {
        surfaceUIndex: number;
        columns: {
            sectionIndex: number;
            curveId: string;
            curvePoleIndex: number;
            stationV: number;
            pointMM: Point;
            weight: number;
        }[];
    }[];
    degreeU: number;
    degreeV: 1;
    knotsU: number[];
    knotsV: number[];
    unchangedOriginalSections: true;
    sourceMeaning: 'new-construction-model-not-unseen-original-file';
}
type StationObservation = {
    kind: 'station';
    sectionIndex: number;
    u: number;
    v: number;
    sectionPointMM: Point;
    surfacePointMM: Point;
    comparisonErrorMM: number;
};
type IntervalObservation = {
    kind: 'interval';
    sectionPairIndices: [number, number];
    u: number;
    v: number;
    alpha: number;
    firstPointMM: Point;
    secondPointMM: Point;
    firstDenominator: number;
    secondDenominator: number;
    rationalSecondFraction: number;
    expectedPointMM: Point;
    surfacePointMM: Point;
    comparisonErrorMM: number;
    naiveCartesianPointMM: Point;
    naiveCartesianDifferenceMM: number;
};
type PointObservation = StationObservation | IntervalObservation;
type DerivativeObservation = {
    u: number;
    v: number;
    result: {
        kind: 'evaluated';
        result: SurfaceD1Result;
    } | {
        kind: 'refused';
        message: string;
    };
};
export interface PiecewiseRationalLoftReport {
    schema: 'barocss-piecewise-rational-loft';
    version: 0;
    surfaceId: string;
    modelName: string;
    sectionIds: string[];
    sectionCount: number;
    controlPointGrid: [number, number];
    degreeU: number;
    degreeV: 1;
    domains: {
        u: [number, number];
        v: [number, number];
    };
    parametersU: number[];
    parametersV: number[];
    pointObservations: PointObservation[];
    derivativeObservations: DerivativeObservation[];
    maximumComparisonErrorMM: number;
    maximumNaiveCartesianDifferenceMM: number;
    sourceUTF16: number;
    sourceUTF8: number;
    options: PiecewiseRationalLoftOptions;
    directCounts: {
        curveValidationCount: number;
        surfaceValidationCount: 1;
        curveDomainQueryCount: 1;
        surfaceDomainQueryCount: 1;
        sourceCompilationCount: 1;
        curvePointEvaluationCount: number;
        surfacePointEvaluationCount: number;
        basisEvaluationCount: number;
        surfaceDerivativeEvaluationCount: number;
        derivativeSuccessCount: number;
        derivativeRefusalCount: number;
        decimalEmissionCount: number;
    };
    numericPolicy: {
        authority: 'copied-original-cartesian-poles-and-independent-positive-weights';
        uBasis: 'exact-original-degree-count-knot-domain-bits';
        stationOrder: 'caller-order-no-sort';
        vBasis: 'clamped-linear-c0';
        betweenStations: 'native-homogeneous-rational-blend';
        pointComparisonMM: 1e-7;
        d1: 'actual-native-evaluated-refused-union';
        observation: 'three-represented-original-u-parameters-stations-and-midpoints-not-global-bound';
        zeroBits: 'original-coefficient-and-station-bits-retained';
        source: 'new-model-original-sections-plus-native-surface';
        counters: 'direct-wrapper-calls-inherited-validations-excluded';
    };
    quality: {
        nativeCurveAndSurfaceAdmission: true;
        coefficientLayoutAndSourceBitsRetained: true;
        pointObservationsPassed: true;
        topologyCertified: false;
        solid: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        editorDisplayCertified: false;
        smoothLoftCertified: false;
        G1Certified: false;
        G2Certified: false;
        originalMixedSourcePreservationCertified: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumSections: 15;
        maximumUPoles: 16;
        maximumDegreeU: 5;
        degreeV: 1;
        maximumModelObjects: 16;
        maximumPointObservations: 87;
        maximumDerivativeObservations: 87;
        maximumCurvePointEvaluations: 129;
        maximumSurfacePointEvaluations: 87;
        maximumBasisEvaluations: 84;
        maximumDecimalEmissions: 2306;
        sourceUTF16: 262144;
        sourceUTF8: 262144;
        maximumLiteralCharacters: 512;
        coordinateAbsMM: 1000000;
        minimumWeight: 0.000001;
        maximumWeight: 1000000;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        stringCharacters: 262144;
    };
    workScope: 'direct-native-construction-source-and-observation-calls-inherited-validation-excluded';
    budgetFailure: 'atomic-no-partial-loft-or-source';
}
export interface PiecewiseRationalLoftResult {
    request: {
        sections: Curve[];
        parametersV: number[];
        options: PiecewiseRationalLoftOptions;
    };
    sections: Curve[];
    parametersV: number[];
    surface: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: PiecewiseRationalLoftProvenance;
    report: PiecewiseRationalLoftReport;
}
/** Copy ordered independent-weight section columns into a real piecewise-linear-V native construction Surface. */
export declare function buildPiecewiseRationalLoftSurface(sectionsInput: Curve[], parametersInput: number[], optionsInput: PiecewiseRationalLoftOptions): PiecewiseRationalLoftResult;
/** Rebuild one complete native construction and all actual observations, preserving every original/source/count bit. */
export declare function validatePiecewiseRationalLoftSurface(input: PiecewiseRationalLoftResult): PiecewiseRationalLoftReport;
export {};
