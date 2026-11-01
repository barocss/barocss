import type { SourceCurveKnotInsertionResult } from './source-curve-knot-insertion.js';
import type { PiecewiseRationalLoftResult, PiecewiseRationalLoftReport } from '../../features/piecewise-rational-loft.js';
import type { Model } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const SourceKnotAlignedLoftDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly VERSION: "VERSION";
    readonly IDENTITY: "IDENTITY";
    readonly SOURCE: "SOURCE";
    readonly TARGET: "TARGET";
    readonly BASIS: "BASIS";
    readonly STATIONS: "STATIONS";
    readonly BUDGET: "BUDGET";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly INSERTION: "INSERTION";
    readonly LOFT: "LOFT";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
    readonly FILE: "FILE";
}>;
export type SourceKnotAlignedLoftDiagnosticCode = typeof SourceKnotAlignedLoftDiagnosticCode[keyof typeof SourceKnotAlignedLoftDiagnosticCode];
export declare class SourceKnotAlignedLoftError extends KernelError {
    readonly code: SourceKnotAlignedLoftDiagnosticCode;
    constructor(code: SourceKnotAlignedLoftDiagnosticCode, detail: string, cause?: unknown);
}
type Triple<T> = [T, T, T];
type Asset = {
    sourceId: string;
    sourceVersion: 0;
    source: string;
    curveId: string;
};
export interface SourceKnotAlignedLoftOptions {
    evaluationId: string;
    constructionSourceId: string;
    modelName: string;
    surfaceId: string;
    constructionSectionIds: Triple<string>;
    maximumSections: 3;
    maximumAlignedUPoles: 16;
    maximumInsertionCalls: 28;
}
export interface SourceKnotAlignedLoftRequest {
    assets: Triple<Asset>;
    parametersV: Triple<number>;
    options: SourceKnotAlignedLoftOptions;
}
type SourceContext = {
    index: number;
    sourceId: string;
    sourceVersion: 0;
    source: string;
    model: Model;
};
type Insertion = {
    index: number;
    sectionIndex: number;
    knot: number;
    result: SourceCurveKnotInsertionResult;
};
type Multiplicity = {
    value: number;
    originalMultiplicities: Triple<number>;
    targetMultiplicity: number;
    deficits: Triple<number>;
};
type SectionPlan = {
    index: number;
    originalPoleCount: number;
    missingKnots: number[];
};
type Plan = {
    degree: number;
    domain: [number, number];
    knots: number[];
    poleCount: number;
    multiplicities: Multiplicity[];
    sections: Triple<SectionPlan>;
    insertionCount: number;
};
type Reference = {
    sourceId: string;
    modelName: string;
    curveId: string;
    objectIndex: number;
};
type SectionBinding = {
    index: number;
    original: Reference;
    aligned: Reference;
    construction: Reference;
    coefficientsIdenticalToAligned: true;
};
type Bindings = {
    sections: Triple<SectionBinding>;
    output: {
        sourceId: string;
        modelName: string;
        surfaceId: string;
        objectIndex: 3;
    };
};
type Size = {
    utf16: number;
    utf8: number;
};
type InsertionCounts = {
    compileCount: number;
    nativeCurveValidationCount: number;
    domainQueryCount: number;
    coefficientInsertionCallCount: number;
    patchCount: number;
    decimalEmissionCount: number;
    observationCount: number;
    curveD0Count: number;
    curveD1AttemptCount: number;
    curveD1EvaluatedCount: number;
    curveD1RefusedCount: number;
};
export interface SourceKnotAlignedLoftReport {
    schema: 'barocss-source-knot-aligned-loft-report';
    version: 0;
    lengthUnit: 'mm';
    evaluationId: string;
    sectionCount: 3;
    sourceIds: Triple<string>;
    constructionSourceId: string;
    modelName: string;
    surfaceId: string;
    constructionSectionIds: Triple<string>;
    degreeU: number;
    degreeV: 1;
    domainU: [number, number];
    parametersV: Triple<number>;
    alignedUPoleCount: number;
    insertionCount: number;
    sectionInsertionCounts: Triple<number>;
    sourceSizes: {
        original: Triple<Size>;
        aligned: Triple<Size>;
        construction: Size;
    };
    fileSizes: {
        request: Size;
        result: Size;
    };
    directCounts: {
        originalCompileCount: 3;
        nativeCurveValidationCount: 3;
        domainQueryCount: 3;
        sourceInsertionCallCount: number;
        loftBuildCallCount: 1;
        constructionCopyCount: 3;
        curveD0Count: 0;
        curveD1AttemptCount: 0;
        surfaceD0Count: 0;
        surfaceD1AttemptCount: 0;
        rationalOperationCount: 0;
        childValidationCount: 0;
        loftValidationCount: 0;
    };
    delegatedCounts: {
        insertions: InsertionCounts;
        loft: PiecewiseRationalLoftReport['directCounts'];
        totalD0Count: number;
        totalD1AttemptCount: number;
        totalDecimalEmissionCount: number;
    };
    preservation: {
        completeOriginalSources: true;
        completeAlignedSources: true;
        originalModelMetadataAndSiblings: true;
        originalSelectedIds: true;
        alignedCommonBasis: true;
        constructionCopiesBitIdentical: true;
        parameterIdentity: true;
    };
    quality: {
        constructionOnly: true;
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        smoothLoftCertified: false;
        g1g2Certified: false;
        topologyCertified: false;
        solid: false;
        manufacturingToleranceCertified: false;
        editorDisplayCertified: false;
        persistentTopologyBindingCertified: false;
        publication: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumSections: 3;
        maximumDegree: 5;
        maximumAlignedUPoles: 16;
        maximumAlignedKnots: 22;
        maximumInsertionCalls: 28;
        maximumInsertionObservations: 662;
        maximumDelegatedD0Count: 1360;
        maximumDelegatedD1AttemptCount: 1339;
        maximumInsertionDecimalEmissions: 1711;
        maximumTotalDecimalEmissions: 2177;
        maximumModelObjects: 16;
        coordinateAbsMM: 10000;
        minimumWeight: 0.000001;
        maximumWeight: 1000000;
        sourceUTF16: 262144;
        sourceUTF8: 262144;
        maximumRequestUTF16: 2097152;
        maximumRequestUTF8: 2097152;
        maximumResultUTF16: 16777216;
        maximumResultUTF8: 16777216;
        ownValues: 4194304;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        stringCharacters: 262144;
        identifierCharacters: 48;
    };
    workScope: 'direct-root-calls-and-delegated-provider-receipts-separated';
    budgetFailure: 'atomic-no-partial-source-aligned-loft';
}
export interface SourceKnotAlignedLoftResult {
    request: SourceKnotAlignedLoftRequest;
    originalSources: Triple<SourceContext>;
    alignedSections: Triple<SourceContext>;
    insertions: Insertion[];
    plan: Plan;
    loft: PiecewiseRationalLoftResult;
    bindings: Bindings;
    report: SourceKnotAlignedLoftReport;
}
/** Align three complete source branches through public insertion, then build a real rational Loft. */
export declare function buildSourceKnotAlignedLoft(input: SourceKnotAlignedLoftRequest): SourceKnotAlignedLoftResult;
/** Reconstruct once from the full original request, including every real provider operation. */
export declare function validateSourceKnotAlignedLoft(input: SourceKnotAlignedLoftResult): SourceKnotAlignedLoftReport;
export {};
