import type { ExactSurfaceLowerTrimResult } from '../exact-proof/exact-surface-lower-trim.js';
import type { PairedSectionPlaneCapResult } from '../paired/paired-section-plane-cap.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionFraction } from '../section-rational-internal.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const TranslatedSurfaceEndFacesDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly PARENT: "PARENT";
    readonly PAIR: "PAIR";
    readonly SUPPORT: "SUPPORT";
    readonly TRANSLATION: "TRANSLATION";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
}>;
export type TranslatedSurfaceEndFacesDiagnosticCode = typeof TranslatedSurfaceEndFacesDiagnosticCode[keyof typeof TranslatedSurfaceEndFacesDiagnosticCode];
export declare class TranslatedSurfaceEndFacesError extends KernelError {
    readonly code: TranslatedSurfaceEndFacesDiagnosticCode;
    constructor(code: TranslatedSurfaceEndFacesDiagnosticCode, detail: string, cause?: unknown);
}
export interface TranslatedSurfaceEndFacesOptions {
    evaluationId: string;
    resultIdPrefix: string;
    baseLeftCurveId: string;
    baseRightCurveId: string;
    maximumParents: 3;
    maximumObservations: 24;
}
type Bound = {
    exact: SectionFraction;
    upper: number;
};
type Role = 'u-min' | 'u-max';
type Vertex = {
    id: string;
    world: Point;
    uv: Point;
};
type Origin = {
    parent: 'lowerWall' | 'upperWall' | 'cap' | 'new';
    parentEdgeId: string | null;
    sourceId: string;
    surfaceId: string;
};
type Edge = {
    id: string;
    curve: Curve;
    vertexIds: [string, string];
    pcurve: {
        coordinateSystem: 'native-surface-uv';
        lengthUnit: 'dimensionless';
        curve: Curve;
    };
    origin: Origin;
};
type Use = {
    id: string;
    edgeId: string;
    vertexIds: [string, string];
    sense: 'forward' | 'reverse';
    interval: [number, number];
    pcurveId: string;
};
export interface TranslatedSurfaceEndFace {
    role: Role;
    id: string;
    surfaceId: string;
    orientation: 'forward' | 'reverse';
    vertices: Vertex[];
    edges: Edge[];
    loop: {
        id: string;
        uses: Use[];
    };
}
type Translation = {
    lowerSourceId: string;
    upperSourceId: string;
    lowerSurfaceId: string;
    upperSurfaceId: string;
    height: SectionFraction;
    vector: SectionFraction[];
    originalBasis: {
        degreeU: number;
        degreeV: number;
        knotsU: number[];
        knotsV: number[];
        weights: number[][];
        domains: ExactSurfaceLowerTrimResult['binding']['section']['report']['surfaceDomains'];
    };
    poles: {
        uIndex: number;
        vIndex: number;
        lower: Point;
        upper: Point;
        differences: SectionFraction[];
        residuals: SectionFraction[];
    }[];
    commonPlane: {
        sourceId: string;
        planeId: string;
        rawNormal: SectionFraction[];
    };
    matchedUV: {
        lowerId: string;
        upperId: string;
        geometry: Omit<Curve, 'id'>;
    };
    parentPair: {
        lowerWallFaceId: string;
        upperWallFaceId: string;
        capFaceId: string;
        lowerSectionEvaluationId: string;
        upperSectionEvaluationId: string;
        completeSectionIdentity: true;
    };
};
type SupportProof = {
    role: Role;
    surfaceId: string;
    originalUIndex: number;
    nativeDomains: {
        u: [number, number];
        v: [number, number];
    };
    actualGrid: Point[][];
    idealGrid: SectionFraction[][][];
    weights: number[][];
    residuals: SectionFraction[][][];
    mixedCoefficient: SectionFraction[];
    originalZDerivative: SectionFraction;
};
type BoundaryProof = {
    faceId: string;
    edgeId: string;
    curveId: string;
    pcurveId: string;
    worldEndpoints: Point[];
    uvEndpoints: Point[];
    supportEndpoints: SectionFraction[][];
    residuals: SectionFraction[][];
    endpointL1Errors: SectionFraction[];
    wholeGap: Bound;
};
type Embedding = {
    schema: 'barocss-exact-translated-surface-end-face';
    version: 0;
    authority: 'exact-stored-coefficients-translated-original-surface-and-oriented-loop';
    role: Role;
    faceId: string;
    surfaceId: string;
    worldModelId: string;
    loopId: string;
    edgeIds: string[];
    curveIds: string[];
    pcurveIds: string[];
    nativeDomains: {
        u: [number, number];
        v: [number, number];
    };
    orientation: 'forward' | 'reverse';
    height: SectionFraction;
    zDerivative: SectionFraction;
    normalXAbsoluteLowerBound: SectionFraction;
    gramDeterminantLowerBound: SectionFraction;
    orientedNormalXSign: -1 | 1;
    wholeCoefficientModelGap: Bound;
    closedDiskCertified: true;
    exactWorldSurfaceAgreement: true;
};
type Correspondence = {
    borrowed: {
        faceId: string;
        edgeId: string;
        curveId: string;
        parent: 'lowerWall' | 'upperWall' | 'cap';
        parentSourceId: string;
        parentSurfaceId: string;
        parentFaceId: string;
        parentEdgeId: string;
        parentUseId: string;
        useId: string;
        parentSense: 'forward' | 'reverse';
        sense: 'forward' | 'reverse';
        exactCurveGeometry: true;
        oppositeUse: true;
        sharedSewnBRepEdge: false;
    }[];
    baseLines: {
        role: 'left' | 'right';
        curveId: string;
        curve: Curve;
        direction: 'lower-to-upper';
        parameterDomain: [0, 1];
        sharedSewnBRepEdge: false;
    }[];
};
type Proof = {
    translation: Translation;
    supports: SupportProof[];
    boundaries: BoundaryProof[];
    faceEmbeddings: Embedding[];
    correspondence: Correspondence;
};
type D1<T> = {
    status: 'evaluated';
    value: T;
} | {
    status: 'native-refused';
    reason: string;
    nativeErrorName: string;
};
type Observation = {
    faceId: string;
    faceIndex: number;
    edgeId: string;
    edgeIndex: number;
    index: number;
    parameter: number;
    world: {
        d0: Point;
        d1: D1<CurveD1Result>;
    };
    pcurve: {
        d0: Point;
        d1: D1<CurveD1Result>;
    };
    surface: {
        d0: Point;
        d1: D1<SurfaceD1Result>;
    };
    chain: Point | null;
    residuals: {
        pointGapMM: number;
        worldD0D1PointGapMM: number | null;
        uvD0D1PointGap: number | null;
        surfaceD0D1PointGapMM: number | null;
        relativeChainGap: number | null;
    };
};
export interface TranslatedSurfaceEndFacesReport {
    schema: 'barocss-translated-surface-end-faces';
    version: 0;
    evaluationId: string;
    height: SectionFraction;
    surfaceCount: 2;
    faceCount: 2;
    edgeCount: 8;
    useCount: 8;
    vertexCount: 8;
    uniqueWorldCurveCount: 8;
    worldObjectCount: 10;
    maximumWholeModelGapMM: 0;
    maximumObservedPointGapMM: number;
    maximumObservedRelativeChainGap: number;
    lengthUnit: 'mm';
    uvLengthUnit: 'dimensionless';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameterFrame: 'original-native-v-and-unit-extrusion-uv-lines';
    derivativeCounts: Record<'world' | 'pcurve' | 'surface', {
        evaluated: number;
        refused: number;
    }>;
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    directCounts: {
        wallValidationCount: 2;
        capValidationCount: 1;
        newEndSurfaceValidationCount: 2;
        newWorldCurveValidationCount: 2;
        newUVValidationCount: 8;
        worldSourceCompilationCount: 1;
        observationCount: 24;
        curvePointEvaluationCount: 48;
        curveDerivativeEvaluationCount: 48;
        surfacePointEvaluationCount: 24;
        surfaceDerivativeEvaluationCount: 24;
    };
    quality: {
        individualFacesEmbedded: true;
        exactTranslation: true;
        wholeModelGapCertified: true;
        logicalFaceIncidence: true;
        orientedLoops: true;
        parentProofsUnchanged: true;
        sharedBodyTopologyCertified: false;
        manifoldCertified: false;
        solid: false;
        occupiedVolumeCertified: false;
        outwardSolidOrientationCertified: false;
        generalSurfaceRegularityCertified: false;
        globalBinary64EvaluationErrorCertified: false;
        manufacturingToleranceCertified: false;
        weldingPerformed: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumSupports: 2;
        maximumWorldCurves: 8;
        maximumWorldObjects: 10;
        maximumObservations: 24;
        prefixCharacters: 12;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
    };
    workScope: 'direct-root-calls-and-arithmetic-parent-internal-work-retained-and-excluded';
    budgetFailure: 'atomic-no-partial-end-faces';
}
export interface TranslatedSurfaceEndFacesResult {
    lowerWall: ExactSurfaceLowerTrimResult;
    upperWall: ExactSurfaceLowerTrimResult;
    cap: PairedSectionPlaneCapResult;
    options: TranslatedSurfaceEndFacesOptions;
    surfaces: Surface[];
    curves: Curve[];
    faces: TranslatedSurfaceEndFace[];
    world: {
        source: string;
        sourceVersion: 0;
        model: Model;
    };
    proof: Proof;
    observations: Observation[];
    report: TranslatedSurfaceEndFacesReport;
}
/** Build two real affine U-end Supports and their exact oriented trimmed Faces. */
export declare function buildTranslatedSurfaceEndFaces(lowerInput: ExactSurfaceLowerTrimResult, upperInput: ExactSurfaceLowerTrimResult, capInput: PairedSectionPlaneCapResult, optionsInput: TranslatedSurfaceEndFacesOptions): TranslatedSurfaceEndFacesResult;
/** Rebuild complete parents, actual Supports/Lines/source/proofs/native observations before whole owned comparison. */
export declare function validateTranslatedSurfaceEndFaces(input: TranslatedSurfaceEndFacesResult): TranslatedSurfaceEndFacesReport;
export {};
