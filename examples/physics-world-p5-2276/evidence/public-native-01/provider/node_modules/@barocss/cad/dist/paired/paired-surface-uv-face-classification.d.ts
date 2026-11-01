import { SectionRationalContext } from '../section-rational-internal.js';
import type { PairedSurfaceUVSplitFacesResult } from './paired-surface-uv-split-faces.js';
import type { PairedSurfaceBUVSplitFacesResult } from './paired-surface-b-uv-split-faces.js';
import type { SectionFraction } from '../section-rational-internal.js';
import { KernelError } from '../core/barocss-error.js';
type F = SectionFraction;
type Asset = 0 | 1;
type Region = 'below-cut' | 'above-cut';
type Sense = 'forward' | 'reverse';
type Material = 'inside' | 'outside' | 'boundary';
type Relation = 'below' | 'on' | 'above' | 'not-applicable';
type Boundary = 'u-min' | 'u-max' | 'v-min' | 'v-max';
type Size = {
    utf16: number;
    utf8: number;
};
export interface PairedSurfaceUVFaceQuery {
    queryId: string;
    assetIndex: Asset;
    u: number;
    v: number;
}
export interface PairedSurfaceUVFaceOptions {
    evaluationId: string;
    maximumQueries: 16;
}
type Request = {
    a: PairedSurfaceUVSplitFacesResult;
    b: PairedSurfaceBUVSplitFacesResult;
    queries: PairedSurfaceUVFaceQuery[];
    options: PairedSurfaceUVFaceOptions;
};
type FaceClassification = {
    sourceId: string;
    surfaceId: string;
    faceId: string;
    region: Region;
    orientation: Sense;
    classification: Material;
};
type Classification = {
    queryId: string;
    assetIndex: Asset;
    window: 'outside' | 'interior' | 'boundary';
    windowBoundaries: Boundary[];
    cutRelation: Relation;
    faces: [FaceClassification, FaceClassification];
};
type SourceRef = {
    assetIndex: Asset;
    sourceId: string;
    surfaceId: string;
    modelName: string;
    objectIndex: number;
    sourceField: 'request.a.request.section.request.assets[0].source' | 'request.b.request.section.request.assets[1].source';
    modelField: 'request.a.request.section.originalModels[0]' | 'request.b.request.section.originalModels[1]';
};
type Support = {
    reference: SourceRef;
    parentEvaluationId: string;
    window: {
        u: [number, number];
        v: [number, number];
    };
    faceIds: [string, string];
    orientations: [Sense, Sense];
    sharedCutEdgeId: string;
    worldCurveId: string;
    pcurveId: string;
    originalUAInterval: [number, number];
    uMap: {
        offset: F;
        scale: F;
    };
    vCoefficients: F[];
};
type QueryProof = {
    queryId: string;
    assetIndex: Asset;
    queryUV: [F, F];
    method: 'outside-window' | 'natural-v-boundary' | 'exact-affine-quartic';
    boundSigns: {
        uMinimum: -1 | 0 | 1;
        uMaximum: -1 | 0 | 1;
        vMinimum: -1 | 0 | 1;
        vMaximum: -1 | 0 | 1;
    };
    originalUA: F | null;
    normalizedParameter: F | null;
    deCasteljau: F[][];
    cutValue: F | null;
    vMinusCut: F | null;
    cutSign: -1 | 0 | 1 | null;
    classification: Classification;
};
type Proof = {
    schema: 'barocss-paired-surface-uv-face-classification-proof';
    version: 0;
    supports: [Support, Support];
    sameCompletePairedParent: true;
    unchangedSharedWorldCurve: true;
    preservedOriginalParameterFrames: true;
    queries: QueryProof[];
    authority: 'exact-stored-affine-u-quartic-v-on-certified-original-uv-face-windows';
};
type DirectCounts = {
    parentValidationCount: number;
    queryCount: number;
    affineInversionCount: number;
    quarticEvaluationCount: number;
    signComparisonCount: number;
    curveD0Count: 0;
    curveD1Count: 0;
    surfaceD0Count: 0;
    surfaceD1Count: 0;
    sourceCompilationCount: 0;
    rationalFloatConversionCount: 0;
};
export interface PairedSurfaceUVFaceResult {
    request: Request;
    classifications: Classification[];
    proof: Proof;
    report: PairedSurfaceUVFaceReport;
}
export interface PairedSurfaceUVFaceReport {
    schema: 'barocss-paired-surface-uv-face-classification';
    version: 0;
    evaluationId: string;
    parentEvaluationIds: [string, string];
    pairedEvaluationId: string;
    queryCount: number;
    assetQueryCounts: [number, number];
    windowCounts: {
        outside: number;
        interior: number;
        boundary: number;
    };
    relationCounts: {
        below: number;
        on: number;
        above: number;
        'not-applicable': number;
    };
    faceCounts: {
        assetIndex: Asset;
        faceId: string;
        inside: number;
        outside: number;
        boundary: number;
    }[];
    lengthUnit: 'dimensionless';
    parameterFrame: 'original-a-u-v-and-original-b-u-v';
    authority: 'exact-stored-affine-u-quartic-v-on-certified-original-uv-face-windows';
    directCounts: DirectCounts;
    inheritedCounts: {
        a: PairedSurfaceUVSplitFacesResult['report']['directCounts'];
        b: PairedSurfaceBUVSplitFacesResult['report']['directCounts'];
    };
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    numericPolicy: {
        input: 'exact-represented-original-native-uv';
        outsidePriority: true;
        boundary: 'exact-window-or-shared-cut-equality';
        uInversion: 'exact-positive-affine-original-ua-map';
        cutEvaluation: 'exact-stored-degree4-bernstein-de-casteljau';
        toleranceUsed: false;
        nativeD0EqualityAuthority: false;
        rootFindingUsed: false;
        pointProjectionPerformed: false;
        sourceIdentityRenaming: false;
        rootFloatConversion: false;
        snapPerformed: false;
    };
    quality: {
        exactUVFaceMembershipCertified: true;
        fullParentsRetained: true;
        parentFlagsUnchanged: true;
        originalBitsPreserved: true;
        orientationIndependentMembership: true;
        worldPointMembershipCertified: false;
        occupied3DMaterialCertified: false;
        sewnManifold: false;
        wholeBodyTopologyCertified: false;
        solid: false;
        booleanCertified: false;
        worldSurfaceAreaComputed: false;
        globalBinary64EvaluationErrorCertified: false;
        manufacturingToleranceCertified: false;
        publication: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    fileSizes: {
        request: Size;
        result: Size;
    };
    ownValues: number;
    limits: {
        maximumParents: 2;
        maximumQueries: 16;
        queryCoordinateAbs: 10000;
        maximumCutDegree: 4;
        maximumFaces: 4;
        requestBytes: 8388608;
        resultBytes: 16777216;
        ownValues: 4194304;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        stringCharacters: 262144;
        identityCharacters: 48;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        maximumRationalFloatConversions: 0;
        maximumSettlePasses: 8;
    };
    workScope: 'two-complete-parent-validations-and-new-exact-uv-predicates-with-inherited-work-separated';
    budgetFailure: 'atomic-no-partial-paired-face-classification';
}
export declare const PairedSurfaceUVFaceClassificationDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly PARENT: "PARENT";
    readonly BINDING: "BINDING";
    readonly DOMAIN: "DOMAIN";
    readonly BUDGET: "BUDGET";
    readonly FILE: "FILE";
    readonly OWNED: "OWNED";
}>;
type Code = typeof PairedSurfaceUVFaceClassificationDiagnosticCode[keyof typeof PairedSurfaceUVFaceClassificationDiagnosticCode];
type ErrorContext = {
    phase: 'input' | 'parent' | 'binding' | 'query' | 'file' | 'owned';
    assetIndex: Asset | null;
    queryIndex: number | null;
    directCounts: {
        [K in keyof DirectCounts]: number;
    };
};
export declare class PairedSurfaceUVFaceClassificationError extends KernelError {
    readonly code: Code;
    readonly context: ErrorContext;
    constructor(code: Code, detail: string, context: ErrorContext, cause?: unknown);
}
/** Exact membership in the two certified Face regions of each original UV window. */
export declare function classifyPairedSurfaceUVFaces(inputA: PairedSurfaceUVSplitFacesResult, inputB: PairedSurfaceBUVSplitFacesResult, inputQueries: PairedSurfaceUVFaceQuery[], inputOptions: PairedSurfaceUVFaceOptions): PairedSurfaceUVFaceResult;
/** Reconstruct the complete source-backed request once and return an independent Report. */
export declare function validatePairedSurfaceUVFaceClassification(input: PairedSurfaceUVFaceResult): PairedSurfaceUVFaceReport;
export {};
