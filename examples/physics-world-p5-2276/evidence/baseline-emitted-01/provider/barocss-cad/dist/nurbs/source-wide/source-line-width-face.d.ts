import type { Model, Curve } from '../../types.js';
import type { CompatibleRuledSurfaceResult } from '../surfaces/compatible-ruled-surface.js';
import type { ConvexPlanarFaceOptions, ConvexPlanarFaceResult } from '../../own-convex-planar-face.js';
import type { SurfaceBoundary } from '../../core/boundary.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const SourceLineWidthFaceDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly VERSION: "VERSION";
    readonly IDENTITY: "IDENTITY";
    readonly SOURCE: "SOURCE";
    readonly TARGET: "TARGET";
    readonly PROFILE: "PROFILE";
    readonly WIDTH: "WIDTH";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly RULED: "RULED";
    readonly BOUNDARY: "BOUNDARY";
    readonly FACE: "FACE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
    readonly FILE: "FILE";
}>;
export type SourceLineWidthFaceDiagnosticCode = typeof SourceLineWidthFaceDiagnosticCode[keyof typeof SourceLineWidthFaceDiagnosticCode];
export declare class SourceLineWidthFaceError extends KernelError {
    readonly code: SourceLineWidthFaceDiagnosticCode;
    constructor(code: SourceLineWidthFaceDiagnosticCode, detail: string, cause?: unknown);
}
type Four<T> = [T, T, T, T];
type Size = {
    utf16: number;
    utf8: number;
};
export interface SourceLineWidthFaceOptions {
    lowerCurveId: string;
    upperCurveId: string;
    surfaceId: string;
    loopId: string;
    boundaryCurveIds: Four<string>;
    face: ConvexPlanarFaceOptions;
}
export interface SourceLineWidthFaceRequest {
    source: string;
    sourceVersion: 0;
    curveId: string;
    widthMM: number;
    options: SourceLineWidthFaceOptions;
}
type SourceContext = {
    context: 'original' | 'ruled' | 'face';
    sourceField: 'request.source' | 'ruled.source' | 'face.source';
    modelField: 'originalModel' | 'ruled.model' | 'face.model';
    sourceVersion: 0;
    modelName: string;
};
type CurveReference = {
    context: 'original' | 'ruled' | 'face';
    modelName: string;
    objectIndex: number;
    curveId: string;
};
type SurfaceReference = {
    context: 'ruled' | 'face';
    modelName: string;
    objectIndex: 2 | 0;
    surfaceId: string;
};
type BoundaryBinding = {
    index: number;
    boundary: SurfaceBoundary;
    curve: CurveReference;
    edgeId: string;
    pcurveId: string;
    useId: string;
    traversalIndex: number;
    sense: 'forward' | 'reverse';
    interval: [number, number];
};
type Bindings = {
    sources: {
        original: SourceContext;
        ruled: SourceContext;
        face: SourceContext;
    };
    original: CurveReference;
    sections: {
        lower: CurveReference;
        upper: CurveReference;
    };
    support: {
        ruled: SurfaceReference;
        face: SurfaceReference;
        completeBitsEqual: true;
    };
    boundaries: Four<BoundaryBinding>;
    face: {
        faceId: string;
        loopId: string;
        orientation: 'forward' | 'reverse';
        useIdsInTraversalOrder: Four<string>;
    };
};
export interface SourceLineWidthFaceReport {
    schema: 'barocss-source-line-width-face-report';
    version: 0;
    sourceVersion: 0;
    lengthUnit: 'mm';
    profile: 'unit-line-positive-x-centered-y0-z0';
    curveId: string;
    selectedObjectIndex: number;
    originalModelName: string;
    originalObjectCount: number;
    widthIntent: {
        placement: 'centered-y';
        centerYMM: 0;
        centerZMM: 0;
        requestedWidthMM: number;
        halfWidthMM: number;
        lowerYMM: number;
        upperYMM: number;
        representedWidthMM: number;
        representedWidthEqualsRequest: true;
    };
    originalBasis: {
        degree: 1;
        poleCount: 2;
        knots: [0, 0, 1, 1];
        weights: [1, 1];
        domain: [0, 1];
    };
    diagnostics: {
        representedLengthMM: number;
        representedAreaMM2: number;
        authority: 'axis-product-diagnostics-not-solid-or-global-error-certificate';
    };
    generatedRoleIds: string[];
    directCounts: {
        originalSourceCompileCount: 1;
        ruledBuildCallCount: 1;
        boundaryExtractionCallCount: 4;
        convexFaceBuildCallCount: 1;
        producerDelegationCount: 7;
        curveD0Count: 0;
        curveD1AttemptCount: 0;
        surfaceD0Count: 0;
        surfaceD1AttemptCount: 0;
        rationalOperationCount: 0;
        sourceWriterCallCount: 0;
        parentValidationCallCount: 0;
    };
    childReceiptCounts: {
        ruledObservationCount: 9;
        faceBindingCount: 12;
        boundaryCurveCount: 4;
        facePcurveCount: 4;
        ruledModelObjectCount: 3;
        faceModelObjectCount: 5;
    };
    sourceSizes: {
        original: Size;
        ruled: Size;
        face: Size;
    };
    fileSizes: {
        request: Size;
        result: Size;
    };
    preservation: {
        completeOriginalSource: true;
        completeOriginalModel: true;
        originalSelectedCurveBits: true;
        originalUnselectedObjectBits: true;
        completeRuledReceipt: true;
        completeConvexFaceReceipt: true;
        selectedXZBasisWeightCopies: true;
        supportBitsAcrossDerivedContexts: true;
        naturalBoundaryDirections: true;
        sourceQualification: 'retained-source-field-path-and-actual-model-name';
    };
    quality: {
        nativeFaceConstructed: true;
        incidenceValid: true;
        geometricValidity: 'not-certified';
        topologyCertified: false;
        solid: false;
        originalSourceEdited: false;
        faceTopologyEncodedInNativeSource: false;
        ownedRebuild: true;
        generalCurveOffset: false;
        arbitraryDirection: false;
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        g1g2Certified: false;
        manufacturingToleranceCertified: false;
        editorDisplayCertified: false;
        persistentTopologyBindingCertified: false;
        publication: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumOriginalModelObjects: 16;
        sourceUTF16: 262144;
        sourceUTF8: 262144;
        selectedDegree: 1;
        selectedPoles: 2;
        selectedKnots: 4;
        selectedCoordinateAbsMM: 10000;
        minimumLengthMM: 0.000001;
        minimumWidthMM: 0.000001;
        maximumWidthMM: 10000;
        maximumSectionCurves: 2;
        boundaryCurveCount: 4;
        maximumProducerDelegations: 7;
        maximumRoleIds: 26;
        identityCharacters: 48;
        facePrefixCharacters: 20;
        maximumRequestUTF16: 1048576;
        maximumRequestUTF8: 1048576;
        maximumResultUTF16: 2097152;
        maximumResultUTF8: 2097152;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        stringCharacters: 262144;
    };
    workScope: 'direct-wrapper-delegations-child-native-work-retained-in-full-receipts';
    budgetFailure: 'atomic-no-partial-width-face-or-source';
}
export interface SourceLineWidthFaceResult {
    request: SourceLineWidthFaceRequest;
    originalModel: Model;
    originalCurve: Curve;
    ruled: CompatibleRuledSurfaceResult;
    face: ConvexPlanarFaceResult;
    bindings: Bindings;
    report: SourceLineWidthFaceReport;
}
/** Preserve complete authored width intent and delegate real native rectangle/Face construction. */
export declare function buildSourceLineWidthFace(input: SourceLineWidthFaceRequest): SourceLineWidthFaceResult;
/** Reconstruct once from complete original source and authored width, then compare every full receipt and bit. */
export declare function validateSourceLineWidthFace(input: SourceLineWidthFaceResult): SourceLineWidthFaceReport;
export {};
