import type { CoplanarFaceBooleanExtrusionResult } from './coplanar-face-boolean-extrusion.js';
import type { SurfaceD1Result } from '../core/derivatives.js';
import type { Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly OWNED: "OWNED";
}>;
export type CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode = typeof CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode[keyof typeof CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode];
export declare class CoplanarFaceBooleanExtrusionPropertiesError extends KernelError {
    readonly code: CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode;
    constructor(code: CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode, detail: string, cause?: unknown);
}
export interface CoplanarFaceBooleanExtrusionPropertiesOptions {
    maximumBoundarySegments: number;
    maximumSurfaceEvaluations: number;
}
export interface CoplanarFaceBooleanExtrusionPropertiesComponent {
    componentId: string;
    shellId: string;
    outerLoopId: string;
    holeLoopIds: string[];
    supportId: string;
    areaUV: number;
    areaMM2: number;
    volumeMM3: number;
    centroidUV: [number, number];
    capCentroidMM: Point;
    centroidMM: Point;
    supportD1: SurfaceD1Result;
    originUV: [number, number];
    signedDoubleAreaUV: number;
    absoluteCrossSumUV: number;
    shiftedFirstMomentNumeratorsUV: [number, number];
    areaCancellationThresholdUV: number;
    originalAreaUV: number;
    areaDifferenceUV: number;
    areaComparisonToleranceUV: number;
    loopMoments: {
        loopId: string;
        role: 'outer' | 'hole';
        signedDoubleAreaUV: number;
        absoluteCrossSumUV: number;
        shiftedFirstMomentNumeratorsUV: [number, number];
    }[];
}
export interface CoplanarFaceBooleanExtrusionPropertiesReport {
    schema: 'barocss-native-coplanar-face-boolean-extrusion-properties';
    version: 0;
    evaluationId: string;
    lengthUnit: 'mm';
    areaUnit: 'mm2';
    volumeUnit: 'mm3';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    empty: boolean;
    componentCount: number;
    shellCount: number;
    holeCount: number;
    boundarySegmentCount: number;
    surfaceD1EvaluationCount: number;
    areaMM2: number;
    volumeMM3: number;
    centroidMM: Point | null;
    distanceMM: number;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    numericPolicy: {
        moments: 'signed-directed-loops-shifted-by-outer-first-uv';
        areaCancellation: '128-epsilon-absolute-shifted-cross-sum';
        areaComparison: 'own-area-cancellation-threshold-plus-parent-declared-uncertainty-and-128-epsilon-area-scale';
        centroid: 'actual-native-support-point-plus-actual-half-translation';
        aggregate: 'shifted-volume-weighted-component-centroids';
        zeroFirstMomentsAllowed: true;
    };
    quality: {
        authority: 'actual-native-affine-support-canonical-trim-and-positive-normal-extrusion-distance';
        constructionEstimateOnly: true;
        centroidMeaning: 'homogeneous-geometric-construction-centroid-not-density-or-mass';
        centroidIsInteriorWitness: false;
        componentAggregation: 'separate-native-component-shells-not-spatial-overlap-union';
        endpointPolicy: 'canonical-trim-incidence-and-unsnapped-native-edges-remain-distinct';
        workScope: 'new-component-support-d1-only-excludes-native-parent-reconstruction';
        globalBinary64ErrorCertified: false;
        globalShapeErrorCertified: false;
        manifoldCertified: false;
        exactSewingCertified: false;
        solidCertified: false;
        manufacturingToleranceCertified: false;
        densityCertified: false;
        massCertified: false;
        inertiaCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    inheritedBindingResiduals: {
        maximumPointDifferenceMM: number;
        maximumEndpointDifferenceMM: number;
    };
    budgetFailure: 'atomic-refusal-no-partial-construction-properties';
    limits: {
        maximumBoundarySegments: 64;
        maximumSurfaceEvaluations: 8;
        ownValues: 1048576;
        ownDepth: 40;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
    };
}
export interface CoplanarFaceBooleanExtrusionPropertiesResult {
    extrusion: CoplanarFaceBooleanExtrusionResult;
    options: CoplanarFaceBooleanExtrusionPropertiesOptions;
    components: CoplanarFaceBooleanExtrusionPropertiesComponent[];
    report: CoplanarFaceBooleanExtrusionPropertiesReport;
}
/** Native canonical trim sweep construction metrics, without density, mass or general Solid authority. */
export declare function measureCoplanarFaceBooleanExtrusion(extrusionInput: CoplanarFaceBooleanExtrusionResult, optionsInput: CoplanarFaceBooleanExtrusionPropertiesOptions): CoplanarFaceBooleanExtrusionPropertiesResult;
/** Bit-sensitive complete reconstruction from the current native parent, not acceptance of caller metrics. */
export declare function validateCoplanarFaceBooleanExtrusionProperties(input: CoplanarFaceBooleanExtrusionPropertiesResult): CoplanarFaceBooleanExtrusionPropertiesReport;
