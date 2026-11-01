import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const ThreeSectionLoftDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BASIS: "BASIS";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type ThreeSectionLoftDiagnosticCode = typeof ThreeSectionLoftDiagnosticCode[keyof typeof ThreeSectionLoftDiagnosticCode];
export declare class ThreeSectionLoftError extends KernelError {
    readonly code: ThreeSectionLoftDiagnosticCode;
    constructor(code: ThreeSectionLoftDiagnosticCode, detail: string, cause?: unknown);
}
export interface ThreeSectionLoftOptions {
    surfaceId: string;
}
export interface ThreeSectionLoftObservation {
    u: number;
    v: number;
    sectionIndex: number;
    expectedPointMM: Point;
    actualPointMM: Point;
    differenceMM: number;
}
export interface ThreeSectionLoftD1Observation {
    u: number;
    v: number;
    sectionIndex: number;
    original: {
        status: 'evaluated';
        value: CurveD1Result;
    } | {
        status: 'native-refused';
        reason: string;
    };
    surface: {
        status: 'evaluated';
        value: SurfaceD1Result;
    } | {
        status: 'native-refused';
        reason: string;
    };
    relativeDuDifference: number | null;
}
type Homogeneous = [number, number, number, number];
export interface ThreeSectionLoftProvenance {
    kind: 'three-section-homogeneous-loft';
    surfaceId: string;
    sectionIds: [string, string, string];
    sectionParameters: [0, .5, 1];
    middleFormula: 'H1=2*Hmiddle-0.5*(Hfirst+Hlast)';
    rows: {
        poleIndex: number;
        sectionPoleIndices: [number, number, number];
        Hfirst: Homogeneous;
        Hmiddle: Homogeneous;
        Hlast: Homogeneous;
        doubledMiddle: Homogeneous;
        averagedEndpoints: Homogeneous;
        generatedHmiddle: Homogeneous;
        weightContributingMagnitude: number;
        weightCancellationMargin: number;
        poleMappings: {
            surfacePole: [number, number];
            origin: 'section-bit-copy' | 'generated-homogeneous';
            sectionIndex: number | null;
            sectionPoleIndex: number | null;
            sourceSectionIndices: number[];
            pointMM: Point;
        }[];
        weightMappings: {
            surfacePole: [number, number];
            origin: 'section-bit-copy' | 'generated-homogeneous';
            sectionIndex: number | null;
            sectionPoleIndex: number | null;
            sourceSectionIndices: number[];
            weight: number;
        }[];
    }[];
    uKnotMappings: {
        sectionKnotIndex: number;
        surfaceKnotIndex: number;
        sectionValues: [number, number, number];
        surfaceValue: number;
        origin: 'common-basis-bit-copy';
    }[];
}
export interface ThreeSectionLoftReport {
    kind: 'three-section-loft-surface';
    dto: {
        schema: 'barocss-native-three-section-loft';
        version: 0;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'native-three-section-surface-not-brep-or-solid';
    };
    surfaceId: string;
    sectionIds: [string, string, string];
    degreeU: number;
    degreeV: 2;
    controlPointGrid: [number, 3];
    domains: {
        u: [number, number];
        v: [0, 1];
    };
    sectionParameters: [0, .5, 1];
    originalSpanCount: number;
    observationCount: number;
    derivativeObservationCount: number;
    observations: ThreeSectionLoftObservation[];
    derivativeObservations: ThreeSectionLoftD1Observation[];
    guardedParameters: number[];
    derivativeComparisonCount: number;
    derivativeRefusalCount: number;
    asymmetricDerivativeRefusalCount: number;
    maximumPointDifferenceMM: number;
    maximumRelativeDuDifference: number | null;
    unrepresentedMidpointIntervals: {
        domain: [number, number];
        attemptedParameter: number;
    }[];
    authority: 'original-three-section-homogeneous-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        pointComparisonMM: 1e-7;
        relativeDuComparison: 1e-7;
        localObservationsOnly: true;
        endpointControlAndWeightBitsPreserved: true;
        commonUKnotDomainBitsPreserved: true;
        middleInterpolation: 'actual-homogeneous-section-interpolation-at-v-half';
        betweenSections: 'homogeneous-weight-dependent-not-naive-cartesian-interpolation';
        sectionWeightScalingInvarianceCertified: false;
        generatedWeightPolicy: 'positive-native-weight-above64-epsilon-absolute-contributing-terms';
        nativeD1Refusals: 'actual-original-and-surface-states-no-inferred-equality';
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        g1g2Certified: false;
        sourceText: 'regenerated-from-supplied-native-geometry-not-original-file-formatting';
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-result';
    limits: {
        maximumSectionDegree: 3;
        maximumSectionPoles: 16;
        maximumSurfacePoles: 48;
        maximumPointObservations: 96;
        maximumDerivativeObservations: 96;
        authoredIdCharacters: 48;
        coordinateAbsMM: 10000;
        weightRange: [1e-6, 1e6];
        inputValues: 32768;
        inputDepth: 8;
        inputArrayElements: 128;
        inputRecordFields: 16;
        inputStringCharacters: 128;
        snapshotValues: 524288;
        snapshotDepth: 32;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
    };
}
export interface ThreeSectionLoftResult {
    sections: [Curve, Curve, Curve];
    options: ThreeSectionLoftOptions;
    surface: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: ThreeSectionLoftProvenance;
    report: ThreeSectionLoftReport;
}
/** Interpolate three compatible native sections at V=0,.5,1 in homogeneous coefficients. */
export declare function buildThreeSectionLoftSurface(firstInput: Curve, middleInput: Curve, lastInput: Curve, inputOptions: ThreeSectionLoftOptions): ThreeSectionLoftResult;
/** Rebuild all original/generated coefficient lineage, four-object sources and native observations. */
export declare function validateThreeSectionLoftSurface(input: ThreeSectionLoftResult): ThreeSectionLoftReport;
export {};
