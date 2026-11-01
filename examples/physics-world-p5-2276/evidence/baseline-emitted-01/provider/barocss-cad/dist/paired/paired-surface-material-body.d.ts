import { SectionRationalContext } from '../section-rational-internal.js';
import type { Point, Curve, Surface, Model } from '../types.js';
import type { FaceBundle, FaceIds } from '../core/face.js';
import type { CompatibleRuledSurfaceResult } from '../nurbs/surfaces/compatible-ruled-surface.js';
import type { PairedSurfaceUVSplitFacesResult } from './paired-surface-uv-split-faces.js';
import type { PairedSurfaceBUVSplitFacesResult } from './paired-surface-b-uv-split-faces.js';
import type { SectionFraction } from '../section-rational-internal.js';
import { KernelError } from '../core/barocss-error.js';
type F = SectionFraction;
type Sense = 'forward' | 'reverse';
type Size = {
    utf16: number;
    utf8: number;
};
type ClosureRole = 'yMin' | 'zMin' | 'xMin' | 'xMax';
type FaceRole = 'roof' | 'side' | ClosureRole;
type EdgeRole = 'cut' | 'roofYMin' | 'roofXMin' | 'roofXMax' | 'sideZMin' | 'sideXMin' | 'sideXMax' | 'lowYLowZ' | 'lowYXMin' | 'lowYXMax' | 'lowZXMin' | 'lowZXMax';
export interface PairedSurfaceMaterialBodyOptions {
    evaluationId: string;
    resultIdPrefix: string;
    maximumClosures: 4;
    maximumFaces: 6;
    maximumEdgePairs: 12;
    maximumObservations: 24;
}
export interface PairedSurfaceMaterialBodyRequest {
    a: PairedSurfaceUVSplitFacesResult;
    b: PairedSurfaceBUVSplitFacesResult;
    options: PairedSurfaceMaterialBodyOptions;
}
type SourceRef = {
    sourceId: string;
    sourceField: string;
    modelField: string;
    modelName: string;
    objectIndex: number;
    objectId: string;
};
type SourceModel = {
    sourceId: string;
    source: string;
    sourceVersion: 0;
    model: Model;
};
type Closure = {
    role: ClosureRole;
    lowCurve: Curve;
    ruled: CompatibleRuledSurfaceResult;
    faceIds: FaceIds;
    face: FaceBundle;
    world: SourceModel;
};
type Closures = [Closure, Closure, Closure, Closure];
type LocalFaceRef = {
    kind: 'a' | 'b' | 'closure';
    closureIndex: number | null;
    faceId: string;
    loopId: string;
    supportRef: SourceRef;
    sourceField: string;
    modelField: string;
};
type LocalVertexRef = {
    face: LocalFaceRef;
    vertexId: string;
    world: Point;
};
type LocalUseRef = {
    face: LocalFaceRef;
    edgeId: string;
    useId: string | null;
    curveId: string;
    localVertexIds: [string, string];
    localCurve: Curve;
    pcurve: {
        kind: 'native-curve';
        curve: Curve;
    } | {
        kind: 'native-line';
        domain: [number, number];
        uv0: [number, number];
        uv1: [number, number];
    };
    sense: Sense;
    interval: [number, number];
    curveRef: SourceRef;
};
type ParameterMap = {
    canonicalDomain: [number, number];
    localDomain: [number, number];
    offset: F;
    scale: F;
    localEndpointParameters: [number, number];
    endpointResiduals: [F, F];
    wholeCurveResiduals: F[][];
    proofDegree: 4;
};
type GlobalUse = {
    id: string;
    faceId: string;
    loopId: string;
    edgeId: string;
    vertexIds: [string, string];
    sense: Sense;
    origin: LocalUseRef;
    parameterMap: ParameterMap;
};
type Vertex = {
    id: string;
    world: Point;
    members: LocalVertexRef[];
};
type Edge = {
    id: string;
    role: EdgeRole;
    curve: Curve;
    curveRef: SourceRef;
    vertexIds: [string, string];
    parameterRange: [number, number];
    uses: [GlobalUse, GlobalUse];
};
type Loop = {
    id: string;
    faceId: string;
    uses: [GlobalUse, GlobalUse, GlobalUse, GlobalUse];
};
type Face = {
    id: string;
    role: FaceRole;
    support: Surface;
    supportRef: SourceRef;
    origin: LocalFaceRef;
    orientation: Sense;
    outerLoopId: string;
    loop: Loop;
};
type Shell = {
    id: string;
    faceIds: [string, string, string, string, string, string];
    closed: true;
    oriented: true;
};
type Body = {
    id: string;
    shellIds: [string];
    materialCertificateId: string;
    closed: true;
    solid: true;
    restrictedSolidCertified: true;
};
type FaceImage = {
    faceId: string;
    role: FaceRole;
    supportRef: SourceRef;
    originalSupport: Surface;
    nativeDomains: {
        u: [number, number];
        v: [number, number];
    };
    cubeRestriction: 't=1' | 's=1' | 's=0' | 't=0' | 'u=uMin' | 'u=uMax';
    chartVariables: ['u', 's'] | ['u', 't'] | ['s', 't'];
    nativeUVPower: F[][][];
    actualCartesian: F[][][];
    expectedCartesian: F[][][];
    residuals: F[][][];
    proofDegrees: {
        first: 4;
        second: 1;
    };
    wholeImageEqual: true;
    outward: {
        axis: 'x' | 'y' | 'z';
        sign: -1 | 1;
        principalCoefficients: F[];
        minimumAbsolute: F;
    };
    storedLocalUsesUnchanged: true;
};
type EdgePair = {
    edgeId: string;
    role: EdgeRole;
    canonicalCurveRef: SourceRef;
    occurrences: [{
        useId: string;
        origin: LocalUseRef;
        parameterMap: ParameterMap;
    }, {
        useId: string;
        origin: LocalUseRef;
        parameterMap: ParameterMap;
    }];
    oppositeEffectiveUses: true;
    exactWholeWorldImage: true;
};
type Germ = {
    edgeId: string;
    endpointIndex: 0 | 1;
};
type VertexLink = {
    vertexId: string;
    germs: [Germ, Germ, Germ];
    cornerArcs: {
        faceId: string;
        incomingUseId: string;
        outgoingUseId: string;
        from: Germ;
        to: Germ;
    }[];
    cycle: Germ[];
    connected: true;
    degreeTwo: true;
};
type MaterialProof = {
    certificateId: string;
    bodyId: string;
    shellId: string;
    faceIds: string[];
    sourceRefs: SourceRef[];
    profile: {
        aXIdentity: true;
        aYIdentity: true;
        bXShiftIdentity: true;
        bZIdentity: true;
        originalUBOffset: F;
        originalUBScale: F;
        unitPositiveAxes: true;
        constantPositiveWeights: true;
        bYPower: F[];
        aZPower: F[][];
        sourceResiduals: F[][][];
    };
    cubeMap: {
        domain: {
            u: [number, number];
            s: [0, 1];
            t: [0, 1];
        };
        lowY: F;
        lowZ: F;
        heightYBernstein: F[];
        heightZBernstein: F[][];
        heightProofUDegree: 4;
        heightProofSDegree: 1;
        minimumHeightY: F;
        minimumHeightZ: F;
        jacobianBernstein: F[][];
        jacobianDegrees: {
            u: 8;
            s: 1;
        };
        minimumJacobian: F;
        inverse: 'u=X;s=(Y-lowY)/heightY(u);t=(Z-lowZ)/heightZ(u,s)';
        globallyInjective: true;
    };
    faceImages: [FaceImage, FaceImage, FaceImage, FaceImage, FaceImage, FaceImage];
    volume: {
        exactVolumeMM3: F;
        integrandBernstein: F[];
        degree: 8;
        integrationResidual: F;
        unit: 'mm3';
    };
    sourceDefinedOccupiedRegion: true;
    wholeBoundaryImage: true;
    outwardMaterial: true;
    embeddedClosedBoundary: true;
    restrictedSolidCertified: true;
    parentFlagsUnchanged: true;
};
type Proof = {
    schema: 'barocss-paired-surface-material-body-proof';
    version: 0;
    correspondence: EdgePair[];
    vertexClasses: {
        vertexId: string;
        members: LocalVertexRef[];
    }[];
    vertexLinks: VertexLink[];
    faceAdjacency: {
        faceId: string;
        adjacentFaceIds: string[];
    }[];
    sourceInventory: SourceRef[];
    eulerCharacteristic: 2;
    connectedFaceGraph: true;
    material: MaterialProof;
};
type Observation = {
    index: number;
    edgeId: string;
    endpointIndex: 0 | 1;
    parameter: number;
    vertexId: string;
    canonicalPoint: Point;
    vertexWorld: Point;
    canonicalVertexGapMM: number;
    local: [
        {
            useId: string;
            parameter: number;
            point: Point;
            canonicalGapMM: number;
            vertexGapMM: number;
        },
        {
            useId: string;
            parameter: number;
            point: Point;
            canonicalGapMM: number;
            vertexGapMM: number;
        }
    ];
};
type DirectCounts = {
    parentValidationCount: number;
    newCurveValidationCount: number;
    ruledSurfaceBuildCount: number;
    parametricFaceBuildCount: number;
    faceModelAdoptionCount: number;
    constructorDelegationCount: number;
    observationCount: number;
    curveD0AttemptCount: number;
    curveD1AttemptCount: 0;
    surfaceD0AttemptCount: 0;
    surfaceD1AttemptCount: 0;
    sourceCompilationCount: 0;
    rationalFloatConversionCount: 0;
};
export interface PairedSurfaceMaterialBodyResult {
    request: PairedSurfaceMaterialBodyRequest;
    closures: Closures;
    vertices: Vertex[];
    edges: Edge[];
    faces: Face[];
    shell: Shell;
    body: Body;
    proof: Proof;
    observations: Observation[];
    report: PairedSurfaceMaterialBodyReport;
}
export interface PairedSurfaceMaterialBodyReport {
    schema: 'barocss-paired-surface-material-body';
    version: 0;
    evaluationId: string;
    parentEvaluationIds: [string, string];
    pairedEvaluationId: string;
    bodyId: string;
    shellId: string;
    materialCertificateId: string;
    faceIds: string[];
    vertexCount: 8;
    edgeCount: 12;
    faceCount: 6;
    loopCount: 6;
    useCount: 24;
    edgePairCount: 12;
    vertexLinkCount: 8;
    cornerArcCount: 24;
    freeBoundaryCount: 0;
    eulerCharacteristic: 2;
    connectedFaceGraph: true;
    originalTrimmedModelCount: 2;
    closureRuledModelCount: 4;
    closureFaceModelCount: 4;
    flattenedMasterModelProduced: false;
    directionConvention: 'selected-parent-stored-use-order-already-includes-face-orientation';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    uvLengthUnit: 'dimensionless';
    lengthUnit: 'mm';
    volumeUnit: 'mm3';
    exactVolumeMM3: F;
    minimumHeightY: F;
    minimumHeightZ: F;
    minimumJacobian: F;
    maximumObservedEndpointGapMM: number;
    reservedIds: string[];
    directCounts: DirectCounts;
    inheritedCounts: {
        a: PairedSurfaceUVSplitFacesResult['report']['directCounts'];
        b: PairedSurfaceBUVSplitFacesResult['report']['directCounts'];
        ruled: [
            CompatibleRuledSurfaceResult['report'],
            CompatibleRuledSurfaceResult['report'],
            CompatibleRuledSurfaceResult['report'],
            CompatibleRuledSurfaceResult['report']
        ];
    };
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    quality: {
        sharedBodyTopology: true;
        manifold: true;
        restrictedSolid: true;
        sourceDefinedOccupiedRegion: true;
        exactOccupiedVolume: true;
        outwardMaterial: true;
        wholeBodyEmbedding: true;
        fullParentsAndClosuresRetained: true;
        parentFlagsUnchanged: true;
        genericBoolean: false;
        generalCurvedSolidProperties: false;
        globalC1: false;
        globalBinary64EvaluationErrorCertified: false;
        manufacturingToleranceCertified: false;
        weldingPerformed: false;
        publication: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    fileSizes: {
        request: Size;
        result: Size;
    };
    ownValues: number;
    limits: {
        maximumClosures: 4;
        maximumFaces: 6;
        maximumEdgePairs: 12;
        maximumObservations: 24;
        maximumNativeD0Attempts: 72;
        maximumVertices: 8;
        maximumEdges: 12;
        maximumUses: 24;
        maximumOriginalUDegree: 2;
        vDegree: 1;
        maximumProofDegree: 8;
        maximumRuledDegree: 2;
        sourceCharacters: 262144;
        sourceUTF8Bytes: 262144;
        maximumObjectsPerModel: 16;
        requestBytes: 8388608;
        resultBytes: 16777216;
        ownValues: 4194304;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        stringCharacters: 262144;
        prefixCharacters: 8;
        identityCharacters: 48;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        maximumRationalFloatConversions: 0;
        maximumSettlePasses: 8;
    };
    workScope: 'two-full-parent-validations-four-real-closure-factories-and-exact-material-proof-with-inherited-work-separated';
    budgetFailure: 'atomic-no-partial-material-body';
}
export declare const PairedSurfaceMaterialBodyDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly PARENT: "PARENT";
    readonly PROFILE: "PROFILE";
    readonly SOURCE: "SOURCE";
    readonly NATIVE: "NATIVE";
    readonly CLOSURE: "CLOSURE";
    readonly TOPOLOGY: "TOPOLOGY";
    readonly MATERIAL: "MATERIAL";
    readonly ORIENTATION: "ORIENTATION";
    readonly DOMAIN: "DOMAIN";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly BUDGET: "BUDGET";
    readonly FILE: "FILE";
    readonly OWNED: "OWNED";
}>;
type Code = typeof PairedSurfaceMaterialBodyDiagnosticCode[keyof typeof PairedSurfaceMaterialBodyDiagnosticCode];
type Context = {
    phase: 'input' | 'parent' | 'profile' | 'closure' | 'adoption' | 'topology' | 'material' | 'observation' | 'file' | 'owned';
    assetIndex: 0 | 1 | null;
    closureIndex: number | null;
    edgeIndex: number | null;
    observationIndex: number | null;
    directCounts: {
        [K in keyof DirectCounts]: number;
    };
};
export declare class PairedSurfaceMaterialBodyError extends KernelError {
    readonly code: Code;
    readonly context: Context;
    constructor(code: Code, detail: string, context: Context, cause?: unknown);
}
/** Actual mixed trimmed/natural six-Face Body in the exact unit-axis source profile. */
export declare function buildPairedSurfaceMaterialBody(inputA: PairedSurfaceUVSplitFacesResult, inputB: PairedSurfaceBUVSplitFacesResult, inputOptions: PairedSurfaceMaterialBodyOptions): PairedSurfaceMaterialBodyResult;
/** Reconstruct once from the complete original Faces and actual closure options. */
export declare function validatePairedSurfaceMaterialBody(input: PairedSurfaceMaterialBodyResult): PairedSurfaceMaterialBodyReport;
export {};
