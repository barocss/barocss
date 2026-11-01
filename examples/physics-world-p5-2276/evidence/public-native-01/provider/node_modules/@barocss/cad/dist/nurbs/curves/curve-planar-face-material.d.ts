import type { WideCurveAffinePlaneIntersectionResult } from '../source-wide/curve-wide-plane-intersection.js';
import type { WideCubicCurveAffinePlaneIntersectionResult } from '../source-wide/curve-wide-cubic-plane-intersection.js';
import type { ConvexPlanarFaceWithHolesResult, ConvexPlanarFaceWithHolesUVClassification } from '../../intersect/own-convex-planar-face-holes.js';
import type { ExtractedCurveIntervalResult } from './curve-interval-extraction.js';
import type { Curve, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const CurvePlanarFaceMaterialDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly BUDGET: "BUDGET";
    readonly UNSUPPORTED: "UNSUPPORTED";
    readonly NATIVE: "NATIVE";
    readonly UNCERTAINTY: "UNCERTAINTY";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CurvePlanarFaceMaterialDiagnosticCode = typeof CurvePlanarFaceMaterialDiagnosticCode[keyof typeof CurvePlanarFaceMaterialDiagnosticCode];
export declare class CurvePlanarFaceMaterialError extends KernelError {
    readonly code: CurvePlanarFaceMaterialDiagnosticCode;
    constructor(code: CurvePlanarFaceMaterialDiagnosticCode, detail: string, cause?: unknown);
}
export interface CurvePlanarFaceMaterialOptions {
    evaluationId: string;
    resultIdPrefix: string;
    pointEventIds: string[];
    maximumBracketRestrictions: number;
    maximumClassifications: number;
}
type Classification = ConvexPlanarFaceWithHolesUVClassification['classification'];
type Sign = 'positive' | 'negative' | 'zero';
type BoundaryIdentity = {
    loopId: string;
    loopRole: 'outer' | 'inner';
    edgeId: string;
    curveId: string;
    useId: string;
    pcurveId: string;
};
type Decision = {
    classification: Classification;
    material: boolean;
    holeId: string | null;
    boundaryContributors: BoundaryIdentity[];
};
type ChartBound = {
    axis: 'u' | 'v';
    side: 'lower' | 'upper';
    limit: number;
    values: number[];
    thresholds: number[];
    sign: Sign;
};
type LoopBound = BoundaryIdentity & {
    edgeIndex: number;
    authoredOrientation: 'ccw' | 'cw';
    values: number[];
    thresholds: number[];
    sign: Sign;
};
type Bracket = {
    spanId: string;
    spanIndex: number;
    contributionEventId: string;
    interval: [number, number];
    extraction: ExtractedCurveIntervalResult | null;
    projectedControlHullUV: Point[];
    positiveWeights: number[];
    chartBounds: ChartBound[];
    loopBounds: LoopBound[];
    decision: Decision;
};
type Transversality = {
    eventId: string;
    normalDerivativeMM: number;
    normalDerivativeGuardMM: number;
    lower: {
        parameter: number;
        signedDistanceMM: number;
        guardMM: number;
    }[];
    upper: {
        parameter: number;
        signedDistanceMM: number;
        guardMM: number;
    }[];
};
export interface CurvePlanarFaceMaterialEvent {
    eventId: string;
    parameter: number;
    classification: Classification;
    material: boolean;
    faceClassification: ConvexPlanarFaceWithHolesUVClassification;
    brackets: Bracket[];
}
export interface CurvePlanarFaceMaterialReport {
    schema: 'barocss-curve-planar-face-material';
    version: 0;
    lengthUnit: 'mm';
    frame: 'authored-xyz-mm-native-uv-dimensionless';
    curveId: string;
    faceId: string;
    planeId: string;
    evaluationId: string;
    parentFamily: string;
    parentEvaluationId: string;
    curveDegree: number;
    spanCount: number;
    parentMaximumContributions: number;
    rootEventCount: number;
    contributionCount: number;
    nonSingletonContributionCount: number;
    bracketRestrictionCount: number;
    nativeSplitCount: number;
    classificationCount: number;
    classificationCounts: Record<Classification, number>;
    transversality: Transversality[];
    identities: {
        nativeObjectIds: string[];
        loopIds: string[];
        pcurveIds: string[];
        useIds: string[];
    };
    numericPolicy: {
        hullGuardFactor: 512;
        transversalityGuardFactor: 64;
        inheritedExtractionBindingMM: 1e-7;
        evidence: 'local-constructed-positive-control-hulls-not-original-global-binary64-enclosures';
        boundary: 'exact-singleton-or-identically-zero-applicable-whole-hull-halfspace';
        projection: 'orthogonal-affine-native-uv-not-coplanarity-of-bracket-points';
    };
    workPolicy: {
        rootWorkBeforeTrimAdmission: true;
        completeTrimAdmissionBeforeExtractionOrClassification: true;
        counters: 'direct-operation-calls-not-internal-validator-work';
        failure: 'atomic-no-partial-result';
    };
    sourceOwnership: 'separate-original-face-parent-curve-plane-and-interval-source0-models-independent-cpu-data';
    limits: {
        maximumCurvePoles: 64;
        maximumKnots: 70;
        maximumDegree: 3;
        maximumContributions: 192;
        maximumBracketRestrictions: number;
        maximumClassifications: number;
        maximumFaceLines: 15;
        maximumFaceSourceObjects: 16;
        coordinateAbsMM: 10000;
        ownedValues: 1048576;
        ownedDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
    };
}
export interface CurvePlanarFaceMaterialResult {
    curve: Curve;
    face: ConvexPlanarFaceWithHolesResult;
    options: CurvePlanarFaceMaterialOptions;
    intersection: WideCurveAffinePlaneIntersectionResult | WideCubicCurveAffinePlaneIntersectionResult;
    events: CurvePlanarFaceMaterialEvent[];
    report: CurvePlanarFaceMaterialReport;
}
/** Transverse original finite-Curve roots with complete guarded local bracket material decisions. */
export declare function intersectCurveWithPlanarFaceMaterial(curveInput: Curve, faceInput: ConvexPlanarFaceWithHolesResult, optionInput: CurvePlanarFaceMaterialOptions): CurvePlanarFaceMaterialResult;
/** Rebuild the complete actual public operation and compare every owned occurrence and bit. */
export declare function validateCurvePlanarFaceMaterialIntersection(input: CurvePlanarFaceMaterialResult): CurvePlanarFaceMaterialReport;
export {};
