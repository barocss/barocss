import type { TranslatedSurfaceBaseFaceResult } from './translated-surface-base-face.js';
import type { TranslatedSurfaceEndFacesResult } from './translated-surface-end-faces.js';
import type { TranslatedSurfaceStripVolumeResult } from './translated-surface-strip-volume.js';
import type { QualifiedTranslatedStripMaterialBindings, QualifiedTranslatedStripMaterialProof } from './qualified-translated-strip-material-internal.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionFraction } from '../section-rational-internal.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const QualifiedTranslatedStripBodyDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly PARENT: "PARENT";
    readonly PAIR: "PAIR";
    readonly SOURCE: "SOURCE";
    readonly TOPOLOGY: "TOPOLOGY";
    readonly MATERIAL: "MATERIAL";
    readonly ORIENTATION: "ORIENTATION";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
}>;
export type QualifiedTranslatedStripBodyDiagnosticCode = typeof QualifiedTranslatedStripBodyDiagnosticCode[keyof typeof QualifiedTranslatedStripBodyDiagnosticCode];
export declare class QualifiedTranslatedStripBodyError extends KernelError {
    readonly code: QualifiedTranslatedStripBodyDiagnosticCode;
    constructor(code: QualifiedTranslatedStripBodyDiagnosticCode, detail: string, cause?: unknown);
}
export interface QualifiedTranslatedStripBodyOptions {
    evaluationId: string;
    resultIdPrefix: string;
    maximumParents: 3;
    maximumModels: 2;
    maximumObservations: 24;
}
type FaceRole = 'lower' | 'upper' | 'cap' | 'base' | 'uMin' | 'uMax';
type EdgeRole = 'lowerBottom' | 'upperBottom' | 'lowerCut' | 'upperCut' | 'lowerLeft' | 'lowerRight' | 'upperLeft' | 'upperRight' | 'capLeft' | 'capRight' | 'baseLeft' | 'baseRight';
type Sense = 'forward' | 'reverse';
type ObjectReference = {
    sourceModelId: string;
    objectId: string;
};
type LocalFaceReference = {
    parent: 'lowerWall' | 'upperWall' | 'cap' | 'base' | 'ends';
    sourceId: string;
    sourceModelId: string;
    localFaceId: string;
    localLoopId: string;
    surfaceId: string;
};
type LocalVertexReference = LocalFaceReference & {
    localVertexId: string;
    world: Point;
};
type LocalUseReference = LocalFaceReference & {
    localEdgeId: string;
    localUseId: string;
    localVertexIds: [string, string];
    localEdgeVertexIds: [string, string];
    curveId: string;
    pcurveId: string;
};
type PCurve = {
    coordinateSystem: 'native-surface-uv' | 'native-plane-uv';
    lengthUnit: 'dimensionless';
    curve: Curve;
};
type GlobalUse = {
    id: string;
    faceId: string;
    loopId: string;
    edgeId: string;
    vertexIds: [string, string];
    sense: Sense;
    interval: [number, number];
    pcurve: PCurve;
    origin: LocalUseReference;
};
type GlobalLoop = {
    id: string;
    faceId: string;
    uses: GlobalUse[];
};
type GlobalFace = {
    id: string;
    role: FaceRole;
    nativeSurface: Surface;
    supportRef: ObjectReference;
    orientation: Sense;
    outerLoopId: string;
    vertices: string[];
    edges: string[];
    loop: GlobalLoop;
    origin: LocalFaceReference;
};
type GlobalVertex = {
    id: string;
    world: Point;
    members: LocalVertexReference[];
};
export interface QualifiedTranslatedStripBodyEdge {
    id: string;
    role: EdgeRole;
    curve: Curve;
    curveRef: ObjectReference;
    vertexIds: [string, string];
    parameterRange: [number, number];
    uses: [GlobalUse, GlobalUse];
}
type SourceModel = {
    sourceId: string;
    source: string;
    sourceVersion: 0;
    model: Model;
};
type Germ = {
    edgeId: string;
    endpointIndex: 0 | 1;
};
type CornerArc = {
    faceId: string;
    loopId: string;
    vertexId: string;
    localVertexId: string;
    incomingUseId: string;
    outgoingUseId: string;
    from: Germ;
    to: Germ;
};
type VertexLink = {
    vertexId: string;
    germs: Germ[];
    cornerArcs: CornerArc[];
    degrees: {
        edgeId: string;
        endpointIndex: 0 | 1;
        incoming: number;
        outgoing: number;
        degree: number;
    }[];
    cycle: Germ[];
    cycleArcIndices: number[];
};
type Correspondence = {
    edgeId: string;
    role: EdgeRole;
    curveId: string;
    parameterRange: [number, number];
    localOccurrences: {
        faceId: string;
        origin: LocalUseReference;
        vertexIds: [string, string];
        sense: Sense;
    }[];
    sameCompleteCurveBits: true;
    oppositeEffectiveUses: true;
};
type GeometryProvenance = LocalFaceReference & {
    localEdgeId: string | null;
    curveId: string | null;
};
type CatalogObject = {
    kind: 'curve' | 'surface';
    objectId: string;
    sourceId: string;
    sourceModelId: string;
    objectIndex: number;
    provenance: GeometryProvenance[];
};
type Proof = {
    correspondence: Correspondence[];
    vertexClasses: {
        vertexId: string;
        members: LocalVertexReference[];
    }[];
    vertexLinks: VertexLink[];
    faceAdjacency: {
        faceId: string;
        adjacentFaceIds: string[];
    }[];
    geometryCatalog: CatalogObject[];
    material: QualifiedTranslatedStripMaterialProof;
};
type Shell = {
    id: string;
    faceIds: string[];
    closed: true;
    oriented: true;
};
type Body = {
    id: string;
    shellIds: string[];
    materialCertificateId: string;
    closed: true;
    solid: true;
    restrictedSolidCertified: true;
};
type Observation = {
    index: number;
    edgeId: string;
    endpointIndex: 0 | 1;
    parameter: number;
    vertexId: string;
    point: Point;
    vertexWorld: Point;
    gapMM: number;
};
export interface QualifiedTranslatedStripBodyReport {
    schema: 'barocss-qualified-translated-strip-body';
    version: 0;
    evaluationId: string;
    bodyId: string;
    shellId: string;
    materialCertificateId: string;
    faceIds: QualifiedTranslatedStripMaterialBindings['faceIds'];
    modelIds: [string, string];
    sourceIds: [string, string];
    vertexCount: 8;
    edgeCount: 12;
    faceCount: 6;
    useCount: 24;
    loopCount: 6;
    shellCount: 1;
    bodyCount: 1;
    modelCount: 2;
    geometryObjectCount: 18;
    localVertexOccurrenceCount: 24;
    vertexLinkCount: 8;
    cornerArcCount: 24;
    eulerCharacteristic: 2;
    connectedFaceGraph: true;
    connectedVertexLinks: true;
    directionConvention: 'parent-stored-use-order-already-includes-face-orientation';
    h: SectionFraction;
    exactVolumeMM3: SectionFraction;
    volumeMM3: number;
    conversionError: TranslatedSurfaceStripVolumeResult['total']['conversionError'];
    lengthUnit: 'mm';
    volumeUnit: 'mm3';
    uvLengthUnit: 'dimensionless';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameterFrame: 'original-native-uv-and-qualified-face-local-pcurves';
    maximumObservedEndpointGapMM: number;
    fileSizes: {
        request: {
            utf16: number;
            utf8: number;
        };
        result: {
            utf16: number;
            utf8: number;
        };
    };
    directCounts: {
        baseValidationCount: 1;
        endValidationCount: 1;
        volumeValidationCount: 1;
        sourceCompilationCount: 2;
        curvePointEvaluationCount: 24;
        curveDerivativeEvaluationCount: 0;
        surfacePointEvaluationCount: 0;
        surfaceDerivativeEvaluationCount: 0;
        observationCount: 24;
    };
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    quality: {
        sharedBodyTopology: true;
        manifold: true;
        restrictedSolid: true;
        occupiedVolume: true;
        outwardMaterial: true;
        wholeBodyEmbedding: true;
        parentFlagsUnchanged: true;
        genericBoolean: false;
        generalCurvedSolidProperties: false;
        globalC1: false;
        globalBinary64: false;
        manufacturing: false;
        welding: false;
        publication: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumParents: 3;
        maximumModels: 2;
        maximumObjectsPerModel: 16;
        maximumGeometryObjects: 18;
        maximumVertices: 8;
        maximumEdges: 12;
        maximumFaces: 6;
        maximumUses: 24;
        maximumLocalVertexOccurrences: 24;
        maximumObservations: 24;
        maximumFileUTF16: 2097152;
        maximumFileUTF8: 2097152;
        sourceStringCharacters: 262144;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        prefixCharacters: 12;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        maximumFinalFloatConversions: 0;
    };
    workScope: 'direct-root-calls-and-shared-material-arithmetic-parent-internal-work-retained-and-excluded';
    budgetFailure: 'atomic-no-partial-body';
}
export interface QualifiedTranslatedStripBodyResult {
    base: TranslatedSurfaceBaseFaceResult;
    ends: TranslatedSurfaceEndFacesResult;
    volume: TranslatedSurfaceStripVolumeResult;
    options: QualifiedTranslatedStripBodyOptions;
    models: [SourceModel, SourceModel];
    vertices: GlobalVertex[];
    edges: QualifiedTranslatedStripBodyEdge[];
    faces: GlobalFace[];
    shell: Shell;
    body: Body;
    proof: Proof;
    observations: Observation[];
    report: QualifiedTranslatedStripBodyReport;
}
/** Build a real shared Body graph and qualify its complete stored material boundary. */
export declare function buildQualifiedTranslatedStripBody(baseInput: TranslatedSurfaceBaseFaceResult, endsInput: TranslatedSurfaceEndFacesResult, volumeInput: TranslatedSurfaceStripVolumeResult, optionsInput: QualifiedTranslatedStripBodyOptions): QualifiedTranslatedStripBodyResult;
/** Rebuild the full actual geometry, shared graph, material certificate, sources and native endpoints. */
export declare function validateQualifiedTranslatedStripBody(input: QualifiedTranslatedStripBodyResult): QualifiedTranslatedStripBodyReport;
export {};
