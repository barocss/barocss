import type { CurveInterpolationResult } from '../nurbs/curves/curve-interpolation.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const MultiSectionLoftDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BASIS: "BASIS";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly CONDITIONING: "CONDITIONING";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type MultiSectionLoftDiagnosticCode = typeof MultiSectionLoftDiagnosticCode[keyof typeof MultiSectionLoftDiagnosticCode];
export declare class MultiSectionLoftError extends KernelError {
    readonly code: MultiSectionLoftDiagnosticCode;
    readonly poleIndex: number | null;
    constructor(code: MultiSectionLoftDiagnosticCode, detail: string, context?: {
        poleIndex?: number | null;
        cause?: unknown;
    });
}
export interface MultiSectionLoftOptions {
    surfaceId: string;
    degreeV: number;
    maximumBasisEvaluations: number;
    maximumEliminationSteps: number;
    maximumObservations: number;
}
type D1State<T> = {
    status: 'evaluated';
    value: T;
} | {
    status: 'native-refused';
    reason: string;
    nativeErrorName: string;
};
export interface MultiSectionLoftObservation {
    u: number;
    v: number;
    sectionIndex: number;
    originalPoint: Point;
    actualPoint: Point;
    difference: number;
    originalD1: D1State<CurveD1Result>;
    surfaceD1: D1State<SurfaceD1Result>;
    representativeVStateIndex: number;
    relativeDuDifference: number | null;
}
export interface MultiSectionLoftProvenance {
    kind: 'compatible-rational-u-polynomial-v-section-interpolation';
    sectionIds: string[];
    surfaceId: string;
    originalUKnots: number[];
    originalUWeights: number[];
    parametersV: number[];
    rowCurves: {
        poleIndex: number;
        curveId: string;
        evaluation: CurveInterpolationResult;
    }[];
    poleMappings: {
        surfacePole: [number, number];
        rowCurveId: string;
        rowCurvePoleIndex: number;
        origin: 'original-endpoint-bit-copy' | 'row-interpolation-solved';
        originalSectionIndex: number | null;
        originalPoleIndex: number | null;
        point: Point;
    }[];
    weightMappings: {
        surfacePole: [number, number];
        origin: 'common-u-weight-bit-copy';
        originalSectionIndex: 0;
        originalPoleIndex: number;
        weight: number;
    }[];
    uKnotMappings: {
        originalKnotIndex: number;
        surfaceKnotIndex: number;
        originalValue: number;
        surfaceValue: number;
    }[];
    vKnotMappings: {
        rowCurveKnotIndex: number;
        surfaceKnotIndex: number;
        rowCurveValue: number;
        surfaceValue: number;
    }[];
    endpointBitsPreserved: true;
}
export interface MultiSectionLoftReport {
    schema: 'barocss-native-multi-section-loft';
    version: 0;
    surfaceId: string;
    sectionIds: string[];
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    degreeU: number;
    degreeV: number;
    controlPointGrid: [number, number];
    sectionCount: number;
    domains: {
        u: [number, number];
        v: [number, number];
    };
    axisRoles: {
        u: 'original-common-section-parameter';
        v: 'original-section-interpolation-parameter';
    };
    parametersV: number[];
    uSamples: number[];
    unrepresentedMidpointIntervals: {
        domain: [number, number];
        attemptedParameter: number;
    }[];
    plannedCounts: {
        basisEvaluations: number;
        eliminationSteps: number;
        observations: number;
        rowCurveConstructions: number;
        nestedCurvePointEvaluations: number;
        representativeVD1Evaluations: number;
    };
    basisEvaluationCount: number;
    eliminationStepCount: number;
    rowCurveConstructionCount: number;
    nestedCurvePointEvaluationCount: number;
    observationCount: number;
    originalCurveD0EvaluationCount: number;
    surfaceD0EvaluationCount: number;
    originalCurveD1AttemptCount: number;
    surfaceD1AttemptCount: number;
    representativeVD1AttemptCount: number;
    representativeVStates: {
        sectionIndex: number;
        parameter: number;
        curveId: string;
        state: D1State<CurveD1Result>;
    }[];
    guardedParameters: {
        u: number[];
        v: number[];
    };
    observations: MultiSectionLoftObservation[];
    derivativeComparisonCount: number;
    derivativeRefusalCount: number;
    derivativeSourceRefusalCounts: {
        originalU: number;
        representativeV: number;
        surface: number;
    };
    maximumPointDifference: number;
    maximumRelativeDuDifference: number | null;
    sourceModelObjectCount: number;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        authority: 'actual-original-compatible-sections-and-public-native-row-interpolation';
        uBasisAndWeightBitsPreserved: true;
        vBasis: 'actual-polynomial-row-interpolation-original-parameters';
        endpointPoleAndWeightBitsPreserved: true;
        intermediateRows: 'temporary-native-control-curves-not-cad-edges';
        nativeD1Refusals: 'actual-surface-refusal-iff-original-u-or-representative-v-refuses-no-inferred-du';
        representativeVMeaning: 'actual-first-row-guard-state-not-surface-dv-comparison';
        localObservationsOnly: true;
        workScope: 'actual-child-basis-row-work-and-throughpoint-checks-separate-from-section-observations-and-representative-v-d1';
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        g1g2Certified: false;
        regularityCertified: false;
        sewingCertified: false;
        sourceObjectLimitUnchanged: 16;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-multi-section-loft';
    limits: {
        maximumSections: 15;
        maximumUPoles: 16;
        maximumDegree: 3;
        maximumSurfacePoles: 240;
        maximumUSamples: 31;
        maximumBasisEvaluations: 3600;
        maximumEliminationSteps: 1680;
        maximumObservations: 465;
        maximumSourceObjects: 16;
        authoredIdCharacters: 48;
        coordinateAbs: 10000;
        parameterAbs: 10000;
        weightRange: [1e-6, 1e6];
        pointComparison: 1e-7;
        relativeDuComparison: 1e-7;
        inputValues: 32768;
        inputDepth: 8;
        inputArrayElements: 128;
        inputRecordFields: 16;
        inputStringCharacters: 128;
        ownValues: 1048576;
        ownDepth: 40;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
    };
}
export interface MultiSectionLoftResult {
    sections: Curve[];
    parametersV: number[];
    options: MultiSectionLoftOptions;
    surface: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: MultiSectionLoftProvenance;
    report: MultiSectionLoftReport;
}
/** Compatible rational-U sections interpolated in original V units by actual public native row Curves. */
export declare function buildMultiSectionLoftSurface(sectionsInput: Curve[], parametersVInput: number[], optionsInput: MultiSectionLoftOptions): MultiSectionLoftResult;
/** Rebuild every actual native row interpolation, source, mapping and original/Surface D1 state bit-for-bit. */
export declare function validateMultiSectionLoftSurface(input: MultiSectionLoftResult): MultiSectionLoftReport;
export {};
