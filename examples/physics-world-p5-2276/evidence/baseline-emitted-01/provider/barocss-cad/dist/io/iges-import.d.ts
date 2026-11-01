import type { Model } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const IGESImportDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly FILE: "FILE";
    readonly RECORD: "RECORD";
    readonly GLOBAL: "GLOBAL";
    readonly DIRECTORY: "DIRECTORY";
    readonly PARAMETER: "PARAMETER";
    readonly UNSUPPORTED: "UNSUPPORTED";
    readonly BUDGET: "BUDGET";
    readonly NUMBER: "NUMBER";
    readonly NATIVE: "NATIVE";
    readonly SOURCE: "SOURCE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type IGESImportDiagnosticCode = typeof IGESImportDiagnosticCode[keyof typeof IGESImportDiagnosticCode];
export declare class IGESImportError extends KernelError {
    readonly code: IGESImportDiagnosticCode;
    constructor(code: IGESImportDiagnosticCode, detail: string, cause?: unknown);
}
type Size = {
    utf16: number;
    utf8: number;
};
type Span = [number, number];
type GlobalField = {
    index: number;
    kind: 'number';
    text: string;
    value: number;
} | {
    index: number;
    kind: 'hollerith';
    text: string;
    value: string;
};
interface IGESImportMetadata {
    startText: string;
    globals: GlobalField[];
    parameterDelimiter: ',';
    recordDelimiter: ';';
    unitFlag: 2;
    lengthUnit: 'mm';
    modelScale: 1;
    declaredMaximumCoordinate: number;
    actualMaximumCoordinate: number;
    records: {
        S: 1;
        G: number;
        D: number;
        P: number;
        T: 1;
    };
}
export interface IGESImportOptions {
    sourceId: string;
    modelName: string;
    idPrefix: string;
    maximumEntities: 16;
    maximumRecords: 8192;
}
type ParameterMapping = {
    firstSequence: number;
    lastSequence: number;
    recordCount: number;
    tokenCount: number;
    header: Span;
    knotsU: Span;
    knotsV: Span | null;
    weights: Span;
    cartesian: Span;
    domains: Span;
    normal: Span | null;
};
type CurveFlags = {
    planar: 0;
    closed: 0;
    polynomial: 0 | 1;
    periodic: 0;
    normal: [0, 0, 0];
};
type SurfaceFlags = {
    closedU: 0;
    closedV: 0;
    polynomial: 0 | 1;
    periodicU: 0;
    periodicV: 0;
};
export interface IGESImportEntity {
    index: number;
    entity: 126 | 128;
    directoryPointer: number;
    parameterPointer: number;
    parameterRecords: number;
    label: string;
    labelField: string;
    nativeId: string;
    nativeObjectIndex: number;
    degrees: {
        u: number;
        v: number | null;
    };
    poleCounts: {
        u: number;
        v: number | null;
        total: number;
    };
    knotCounts: {
        u: number;
        v: number | null;
    };
    domain: {
        u: [number, number];
        v: [number, number] | null;
    };
    flags: CurveFlags | SurfaceFlags;
    coefficientOrder: 'curve-pole-order-xyz' | 'surface-u-fastest-to-native-u-v';
    parameterMapping: ParameterMapping;
}
export interface IGESImportReport {
    schema: 'barocss-native-iges-import-report';
    version: 0;
    profile: 'barocss-writer-iges53-untransformed-open-126-128';
    format: 'IGES 5.3 ASCII';
    sourceVersion: 0;
    sourceId: string;
    modelName: string;
    idPrefix: string;
    lengthUnit: 'mm';
    modelScale: 1;
    entityCount: number;
    curveCount: number;
    surfaceCount: number;
    records: {
        S: 1;
        G: number;
        D: number;
        P: number;
        T: 1;
    };
    inputSizes: Size;
    sourceSizes: Size;
    fileSizes: {
        request: Size;
        result: Size;
    };
    directoryPointers: number[];
    parameterPointers: number[];
    nativeIds: string[];
    duplicateDirectoryLabelCount: number;
    fileNegativeZeroTokenCount: number;
    declaredMaximumCoordinate: number;
    actualMaximumCoordinate: number;
    directCounts: {
        recordScanCount: number;
        integerFieldParseCount: number;
        tokenScanCount: number;
        numericParseCount: number;
        hollerithParseCount: number;
        nativeCurveValidationCount: number;
        nativeSurfaceValidationCount: number;
        curveDomainQueryCount: number;
        surfaceDomainQueryCount: number;
        fullSourceCompileCount: 1;
        decimalEmissionCount: number;
        curveD0Count: 0;
        curveD1AttemptCount: 0;
        surfaceD0Count: 0;
        surfaceD1AttemptCount: 0;
        rationalOperationCount: 0;
    };
    preservation: {
        completeInputFile: true;
        directoryOrderAndOwnership: true;
        directoryLabelFields: true;
        parsedCoefficientBits: true;
        parsedDomains: true;
        independentWeights: true;
        sourceModelCoefficientBinding: true;
        nativeIdsFromDirectoryPointers: true;
    };
    losses: {
        fileNumberPolicy: 'complete-decimal-token-to-finite-binary64';
        parsedNegativeZeroBitsPreserved: true;
        originalFullNativeIdsRecovered: false;
        originalAuthoredZeroSignsRecovered: false;
        originalSourceSpellingRecovered: false;
        originalFeaturesHistoryRecovered: false;
        originalSourceIncluded: false;
        directoryLabelsMayBeTruncated: true;
        geometryReparameterized: false;
        unitsConverted: false;
        transformsApplied: false;
        sourceMeaning: 'new-imported-geometry-not-original-author-intent';
    };
    quality: {
        nativeGeometryValidated: true;
        sourceCoefficientBinding: true;
        geometryOnly: true;
        generalIGESConformance: false;
        trimmedTopology: false;
        topologyCertified: false;
        solid: false;
        assembly: false;
        smoothnessCertified: false;
        g1g2Certified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        editorDisplayCertified: false;
        persistentTopologyBindingCertified: false;
        publication: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumInputUTF16: 1048576;
        maximumInputUTF8: 1048576;
        maximumRecords: 8192;
        recordCharacters: 80;
        maximumEntities: 16;
        maximumGlobalRecords: 64;
        globalTokenCount: 26;
        maximumTokens: 18000;
        maximumEntityTokens: 1082;
        maximumNumericTokenCharacters: 32;
        maximumHollerithCharacters: 256;
        maximumDegree: 5;
        maximumCurvePoles: 64;
        maximumCurveKnots: 70;
        maximumSurfaceAxisPoles: 16;
        maximumSurfacePoles: 256;
        maximumSurfaceAxisKnots: 22;
        maximumModelObjects: 16;
        coordinateAbs: 1000000;
        minimumWeight: 0.000001;
        maximumWeight: 1000000;
        maximumNativeIdCharacters: 48;
        maximumModelNameCharacters: 48;
        maximumIdPrefixCharacters: 32;
        maximumDecimalEmissionCount: 17120;
        maximumSourceLiteralCharacters: 350;
        sourceUTF16: 262144;
        sourceUTF8: 262144;
        maximumRequestFileUTF16: 1048576;
        maximumRequestFileUTF8: 1048576;
        maximumResultFileUTF16: 4194304;
        maximumResultFileUTF8: 4194304;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        stringCharacters: 262144;
        requestIGESStringCharacters: 1048576;
    };
    workScope: 'actual-parser-native-validation-domain-and-full-source-compile-calls-inherited-work-excluded';
    budgetFailure: 'atomic-no-partial-imported-model-or-source';
}
export interface IGESImportResult {
    request: {
        iges: string;
        options: IGESImportOptions;
    };
    source: string;
    model: Model;
    metadata: IGESImportMetadata;
    entities: IGESImportEntity[];
    report: IGESImportReport;
}
/** Import only the current writer's bounded untransformed open126/128 family into editable literal Source0. */
export declare function importIGES(igesInput: string, optionsInput: IGESImportOptions): IGESImportResult;
/** Rebuild once from complete actual file authority, then compare every retained bit and parser/native receipt. */
export declare function validateIGESImport(input: IGESImportResult): IGESImportReport;
export {};
