import { SectionRationalContext } from '../section-rational-internal.js';
import type { Point } from '../types.js';
import type { PairedSurfaceMaterialBodyResult } from './paired-surface-material-body.js';
import type { SectionFraction } from '../section-rational-internal.js';
import { KernelError } from '../core/barocss-error.js';
type F = SectionFraction;
type Size = {
    utf16: number;
    utf8: number;
};
type Status = 'inside' | 'outside' | 'boundary';
type FaceRole = 'roof' | 'side' | 'yMin' | 'zMin' | 'xMin' | 'xMax';
type Sign = -1 | 0 | 1;
type Stage = 'x' | 'y' | 'z';
type BodySourceRef = PairedSurfaceMaterialBodyResult['faces'][number]['supportRef'];
export interface PairedSurfaceMaterialBodyWorldPointQuery {
    queryId: string;
    pointMM: Point;
}
export interface PairedSurfaceMaterialBodyWorldPointOptions {
    evaluationId: string;
    maximumQueries: 16;
}
type Request = {
    body: PairedSurfaceMaterialBodyResult;
    queries: PairedSurfaceMaterialBodyWorldPointQuery[];
    options: PairedSurfaceMaterialBodyWorldPointOptions;
};
type ParentRef = {
    parentField: 'request.body';
    reference: BodySourceRef;
};
type BoundaryFace = {
    parentField: 'request.body';
    role: FaceRole;
    faceId: string;
    supportRef: BodySourceRef;
};
type Classification = {
    queryId: string;
    status: Status;
    bodyId: string;
    materialCertificateId: string;
    boundaryFaces: BoundaryFace[];
};
type Constraint = {
    role: FaceRole;
    difference: F;
    sign: Sign;
};
type QueryProof = {
    queryId: string;
    pointExact: [F, F, F];
    decision: 'outside-x' | 'outside-y' | 'outside-z' | 'inside' | 'boundary';
    x: [Constraint, Constraint];
    originalUB: F | null;
    yRoof: F | null;
    y: [Constraint, Constraint] | null;
    zRoof: F | null;
    z: [Constraint, Constraint] | null;
    classification: Classification;
};
type SourceDefinition = {
    bodyId: string;
    shellId: string;
    materialCertificateId: string;
    originalUAInterval: [number, number];
    originalUBOffset: F;
    originalUBScale: F;
    lowY: F;
    lowZ: F;
    bYOriginalUBPower: F[];
    aZOriginalUAVAPower: F[][];
    sourceRefs: ParentRef[];
    faceRefs: [BoundaryFace, BoundaryFace, BoundaryFace, BoundaryFace, BoundaryFace, BoundaryFace];
    unitAxisSourceAuthority: true;
    wholeMaterialParentUnchanged: true;
};
type Proof = {
    schema: 'barocss-paired-surface-material-body-world-points-proof';
    version: 0;
    source: SourceDefinition;
    queries: QueryProof[];
    authority: 'exact-source-defined-unit-axis-paired-surface-occupied-region';
};
type DirectCounts = {
    bodyValidationCount: number;
    queryCount: number;
    yRoofEvaluationCount: number;
    zRoofEvaluationCount: number;
    signComparisonCount: number;
    curveD0Count: 0;
    curveD1Count: 0;
    surfaceD0Count: 0;
    surfaceD1Count: 0;
    sourceCompilationCount: 0;
    rootSolveCount: 0;
    rationalFloatConversionCount: 0;
};
export interface PairedSurfaceMaterialBodyWorldPointResult {
    request: Request;
    classifications: Classification[];
    proof: Proof;
    report: PairedSurfaceMaterialBodyWorldPointReport;
}
export interface PairedSurfaceMaterialBodyWorldPointReport {
    schema: 'barocss-paired-surface-material-body-world-points';
    version: 0;
    evaluationId: string;
    parentEvaluationId: string;
    bodyId: string;
    shellId: string;
    materialCertificateId: string;
    queryCount: number;
    classificationCounts: {
        inside: number;
        outside: number;
        boundary: number;
    };
    decisionCounts: {
        'outside-x': number;
        'outside-y': number;
        'outside-z': number;
        inside: number;
        boundary: number;
    };
    boundaryRoleCounts: {
        roof: number;
        side: number;
        yMin: number;
        zMin: number;
        xMin: number;
        xMax: number;
    };
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameterFrame: 'exact-world-xyz-and-original-ua-va-ub-polynomials';
    authority: 'exact-source-defined-unit-axis-paired-surface-occupied-region';
    directCounts: DirectCounts;
    inheritedCounts: {
        body: PairedSurfaceMaterialBodyResult['report']['directCounts'];
    };
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    numericPolicy: {
        input: 'exact-represented-original-world-xyz';
        coordinates: 'unit-axis-source-identities';
        evaluation: 'exact-rational-source-polynomial-horner';
        decisionOrder: 'x-bounds-y-roof-and-bounds-z-roof-and-bounds';
        boundary: 'all-exact-zero-region-constraints-after-outside-priority';
        toleranceUsed: false;
        nativeD0EqualityAuthority: false;
        rootFindingUsed: false;
        pointProjectionPerformed: false;
        normalizedCubeInputUsed: false;
        sourceIdentityRenaming: false;
        snapPerformed: false;
        rootFloatConversion: false;
    };
    quality: {
        exactWorldRegionMembershipCertified: true;
        sourceDefinedOccupiedRegionAuthority: true;
        actualParentBodyRetained: true;
        parentTopologyAndMaterialUnchanged: true;
        originalBitsPreserved: true;
        newGeometryProduced: false;
        newBodyProduced: false;
        genericBoolean: false;
        arbitraryBodyMembershipCertified: false;
        rendererPickingCertified: false;
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
        maximumParents: 1;
        maximumQueries: 16;
        queryCoordinateAbs: 10000;
        maximumYDegree: 2;
        maximumZUDegree: 2;
        maximumZVDegree: 1;
        maximumBoundaryFaces: 6;
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
    workScope: 'one-complete-body-validation-and-new-exact-world-predicates-with-inherited-work-separated';
    budgetFailure: 'atomic-no-partial-world-classification';
}
export declare const PairedSurfaceMaterialBodyWorldPointDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly PARENT: "PARENT";
    readonly BINDING: "BINDING";
    readonly DOMAIN: "DOMAIN";
    readonly BUDGET: "BUDGET";
    readonly FILE: "FILE";
    readonly OWNED: "OWNED";
}>;
type Code = typeof PairedSurfaceMaterialBodyWorldPointDiagnosticCode[keyof typeof PairedSurfaceMaterialBodyWorldPointDiagnosticCode];
type Context = {
    phase: 'input' | 'parent' | 'binding' | 'query' | 'file' | 'owned';
    queryIndex: number | null;
    stage: Stage | null;
    directCounts: {
        [K in keyof DirectCounts]: number;
    };
};
export declare class PairedSurfaceMaterialBodyWorldPointError extends KernelError {
    readonly code: Code;
    readonly context: Context;
    constructor(code: Code, detail: string, context: Context, cause?: unknown);
}
/** Exact represented World(mm) membership in the unchanged source-defined material Body. */
export declare function classifyPairedSurfaceMaterialBodyWorldPoints(inputBody: PairedSurfaceMaterialBodyResult, inputQueries: PairedSurfaceMaterialBodyWorldPointQuery[], inputOptions: PairedSurfaceMaterialBodyWorldPointOptions): PairedSurfaceMaterialBodyWorldPointResult;
/** One complete source-backed classification rebuild; return an independent Report. */
export declare function validatePairedSurfaceMaterialBodyWorldPointClassification(input: PairedSurfaceMaterialBodyWorldPointResult): PairedSurfaceMaterialBodyWorldPointReport;
export {};
