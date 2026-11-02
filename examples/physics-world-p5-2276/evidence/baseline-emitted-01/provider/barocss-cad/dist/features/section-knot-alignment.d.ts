import type { WideCurveInsertionRequest, WideCurveRefinementResult, WideCurveRefinementReport } from '../nurbs/source-wide/curve-wide-refinement.js';
import type { RationalRuledSurfaceResult, RationalRuledSurfaceReport } from '../nurbs/surfaces/rational-ruled-surface.js';
import type { Curve, Model } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const SectionKnotAlignmentDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BASIS: "BASIS";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type SectionKnotAlignmentDiagnosticCode = typeof SectionKnotAlignmentDiagnosticCode[keyof typeof SectionKnotAlignmentDiagnosticCode];
export declare class SectionKnotAlignmentError extends KernelError {
    readonly code: SectionKnotAlignmentDiagnosticCode;
    constructor(code: SectionKnotAlignmentDiagnosticCode, detail: string, cause?: unknown);
}
export interface SectionKnotAlignmentOptions {
    surfaceId: string;
    firstAlignedId: string;
    secondAlignedId: string;
    resultIdPrefix: string;
    maximumInsertedKnots: number;
    maximumRefinementOperations: number;
}
export interface SectionKnotAlignmentSection {
    index: number;
    originalId: string;
    curve: Curve;
    refinement: WideCurveRefinementResult | null;
}
type Multiplicity = {
    value: number;
    firstMultiplicity: number;
    secondMultiplicity: number;
    targetMultiplicity: number;
    firstDeficit: number;
    secondDeficit: number;
};
type SectionWork = {
    index: number;
    refinementCallCount: 0 | 1;
    operationCount: number;
    insertionCount: number;
    originalPoleCount: number;
    alignedPoleCount: number;
    originalKnotCount: number;
    alignedKnotCount: number;
};
export interface SectionKnotAlignmentReport {
    schema: 'barocss-native-section-knot-alignment';
    version: 0;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameterFrame: 'common-original-u-and-native-rational-v';
    surfaceId: string;
    originalIds: [string, string];
    activeIds: [string, string];
    originalModelId: string;
    degree: number;
    originalDomains: [[number, number], [number, number]];
    commonDomain: [number, number];
    commonKnots: number[];
    targetPoleCount: number;
    multiplicities: Multiplicity[];
    requestPlan: [WideCurveInsertionRequest[], WideCurveInsertionRequest[]];
    sectionModes: ['refined' | 'untouched', 'refined' | 'untouched'];
    refinementCallCount: number;
    refinementOperationCount: number;
    insertedKnotCount: number;
    ruledCallCount: 1;
    sectionWork: [SectionWork, SectionWork];
    sourceOwnership: 'separate-original-pair-two-object-refinement-one-object-ruled-three-object-source0-models';
    sourceIds: {
        originalPair: string;
        refinementOriginalContexts: [string | null, string | null];
        refinementFinalContexts: [string | null, string | null];
        refinementStageContexts: [string[], string[]];
        ruledContext: string;
    };
    inheritedObservations: {
        refinementReports: [WideCurveRefinementReport | null, WideCurveRefinementReport | null];
        ruledReport: RationalRuledSurfaceReport;
    };
    numericPolicy: {
        basis: 'object-is-knot-bits-with-numeric-sorted-max-multiplicity-union';
        signedZero: 'numeric-equality-with-bit-disagreement-refuses';
        parameters: 'identity-original-domain-no-remapping';
        untouched: 'original-id-and-coefficients-zero-refinement-work';
        weightInterpolation: 'actual630-denominator-weighted-independent-section-weights';
        derivatives: 'actual-original-aligned-and-surface-states-no-invented-original-c0';
        endpointPolicy: 'all-original-clamp-slot-bits-must-agree';
        pointComparison: 1e-7;
        relativeD1Comparison: 1e-7;
    };
    profile: {
        maximumSectionDegree: 3;
        maximumOriginalPoles: 16;
        maximumAlignedPoles: 16;
        maximumAlignedKnots: 20;
        maximumSurfacePoles: 32;
        coordinateAbs: 10000;
        positiveWeights: [0.000001, 1000000];
        degreeSpecificMaximumInsertedKnots: number;
    };
    quality: {
        constructionOnly: true;
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        continuityCertified: false;
        solidCertified: false;
        manufacturingToleranceCertified: false;
        weightRepairSupported: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    budgetFailure: 'complete-preflight-and-atomic-no-partial-surface';
    limits: {
        maximumInsertedKnots: 14;
        maximumRefinementOperations: 14;
        maximumRequestsPerSection: 16;
        reservedStageIdsPerSection: 16;
        ownedValues: 1048576;
        ownedDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
    };
}
export interface SectionKnotAlignmentResult {
    originals: [Curve, Curve];
    options: SectionKnotAlignmentOptions;
    sections: [SectionKnotAlignmentSection, SectionKnotAlignmentSection];
    ruled: RationalRuledSurfaceResult;
    originalSource: string;
    originalModel: Model;
    report: SectionKnotAlignmentReport;
}
/** Align only missing original knot multiplicities, then construct the actual independently weighted ruled Surface. */
export declare function buildAlignedRationalRuledSurface(firstInput: Curve, secondInput: Curve, optionsInput: SectionKnotAlignmentOptions): SectionKnotAlignmentResult;
/** Rebuild the complete actual alignment operation and bit-check all owned child sources and work evidence. */
export declare function validateAlignedRationalRuledSurface(input: SectionKnotAlignmentResult): SectionKnotAlignmentReport;
export {};
