import type { VLinearSurfacePlaneTrimResult } from './vlinear-plane-trim.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionFraction } from '../section-rational-internal.js';
import { KernelError } from '../core/barocss-error.js';
export declare const VLinearSurfacePlaneTrimUVDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly TRIM: "TRIM";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type VLinearSurfacePlaneTrimUVDiagnosticCode = typeof VLinearSurfacePlaneTrimUVDiagnosticCode[keyof typeof VLinearSurfacePlaneTrimUVDiagnosticCode];
export declare class VLinearSurfacePlaneTrimUVError extends KernelError {
    readonly code: VLinearSurfacePlaneTrimUVDiagnosticCode;
    constructor(code: VLinearSurfacePlaneTrimUVDiagnosticCode, detail: string, cause?: unknown);
}
export interface VLinearSurfacePlaneTrimUVQuery {
    queryId: string;
    u: number;
    v: number;
}
export interface VLinearSurfacePlaneTrimUVOptions {
    evaluationId: string;
    maxQueries: number;
    maxSubdivisions: number;
}
type Relation = 'below' | 'above' | 'on' | 'uncertain' | 'not-applicable';
type Material = 'inside' | 'outside' | 'boundary' | 'uncertain';
type ChartBoundary = 'u-min' | 'u-max' | 'v-min' | 'v-max';
type Classification = {
    queryId: string;
    chart: 'outside' | 'interior' | 'boundary';
    chartBoundaries: ChartBoundary[];
    cutRelation: Relation;
    faces: [{
        sourceId: string;
        surfaceId: string;
        faceId: string;
        classification: Material;
    }, {
        sourceId: string;
        surfaceId: string;
        faceId: string;
        classification: Material;
    }];
};
type Bracket = [SectionFraction, SectionFraction];
type Step = {
    index: number;
    bracketBefore: Bracket;
    midpoint: SectionFraction;
    midHomogeneous: SectionFraction[];
    uNumerator: SectionFraction;
    vNumerator: SectionFraction;
    uSign: number;
    vSign: number;
    selection: 'lower' | 'upper' | 'exact-root';
    bracketAfter: Bracket;
};
type Witness = {
    kind: 'endpoint' | 'midpoint' | 'constant-v';
    normalizedParameter: SectionFraction | null;
    homogeneous: SectionFraction[] | null;
    uNumerator: SectionFraction | null;
    vNumerator: SectionFraction | null;
};
type QueryProof = {
    queryId: string;
    method: 'outside-chart' | 'natural-v-boundary' | 'u-endpoint' | 'positive-weight-hull' | 'exact-root' | 'zero-v-polynomial' | 'iteration-cap';
    bracket: Bracket | null;
    homogeneous: SectionFraction[][];
    uNumerators: SectionFraction[];
    vNumerators: SectionFraction[];
    uSigns: number[];
    vSigns: number[];
    steps: Step[];
    witness: Witness | null;
};
type Proof = {
    curveId: string;
    queries: QueryProof[];
};
export interface VLinearSurfacePlaneTrimUVReport {
    schema: 'barocss-vlinear-surface-plane-trim-uv-classification';
    version: 0;
    evaluationId: string;
    sourceId: string;
    surfaceId: string;
    sharedCutEdgeId: string;
    cutPcurveId: string;
    lengthUnit: 'dimensionless';
    parameterFrame: 'original-support-u-v';
    authority: 'unchanged-stored-positive-weight-monotone-u-graph';
    queryCount: number;
    totalSubdivisions: number;
    chartCounts: {
        outside: number;
        interior: number;
        boundary: number;
    };
    relationCounts: {
        below: number;
        above: number;
        on: number;
        uncertain: number;
        'not-applicable': number;
    };
    faceCounts: {
        faceId: string;
        inside: number;
        outside: number;
        boundary: number;
        uncertain: number;
    }[];
    directCounts: {
        trimValidationCount: 1;
        curvePointEvaluationCount: 0;
        curveDerivativeEvaluationCount: 0;
        surfacePointEvaluationCount: 0;
        surfaceDerivativeEvaluationCount: 0;
        sourceCompilationCount: 0;
    };
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    numericPolicy: {
        input: 'exact-represented-original-dimensionless-uv';
        subdivision: 'exact-homogeneous-de-casteljau-halves-with-strict-unique-u-root-bracket';
        material: 'restricted-positive-weight-v-numerator-signs';
        boundary: 'exact-endpoint-or-root-equality-or-zero-v-polynomial';
        iterationLimit: 'successful-uncertain-no-guess';
        arithmeticLimit: 'atomic-budget-error-no-partial-result';
        toleranceUsed: false;
        nativeD0EqualityAuthority: false;
    };
    quality: {
        uvMaterialClassificationOnly: true;
        parentModelGapProofUnchanged: true;
        worldProjectionPerformed: false;
        idealPlaneSideCertified: false;
        geometricValidity: 'not-certified';
        topologyCertified: false;
        solid: false;
        insideOutsideCertified: false;
        embeddedManifoldCertified: false;
        manufacturingToleranceCertified: false;
        globalBinary64EvaluationErrorCertified: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumQueries: 4;
        maximumSubdivisionsPerQuery: 16;
        maximumTotalSubdivisions: 64;
        queryCoordinateAbs: 10000;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        stringCharacters: 262144;
    };
    workScope: 'direct-root-trim-validation-and-new-exact-arithmetic-parent-internal-work-excluded';
}
export interface VLinearSurfacePlaneTrimUVResult {
    trim: VLinearSurfacePlaneTrimResult;
    queries: VLinearSurfacePlaneTrimUVQuery[];
    options: VLinearSurfacePlaneTrimUVOptions;
    classifications: Classification[];
    proof: Proof;
    report: VLinearSurfacePlaneTrimUVReport;
}
/** Query exact stored UV material; unresolved iteration brackets are successful uncertain results. */
export declare function classifyVLinearSurfacePlaneTrimUV(trimInput: VLinearSurfacePlaneTrimResult, queriesInput: VLinearSurfacePlaneTrimUVQuery[], optionsInput: VLinearSurfacePlaneTrimUVOptions): VLinearSurfacePlaneTrimUVResult;
/** Rebuild full parent ownership and every exact query certificate before whole-result comparison. */
export declare function validateVLinearSurfacePlaneTrimUVClassification(input: VLinearSurfacePlaneTrimUVResult): VLinearSurfacePlaneTrimUVReport;
export {};
