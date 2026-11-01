import type { Point, Curve, Surface, Model } from '../types.js';
import type { FaceBundle, FaceIds } from '../core/face.js';
import type { CompatibleRuledSurfaceResult } from '../nurbs/surfaces/compatible-ruled-surface.js';
import type { PairedSurfaceMaterialBodyRequest } from './paired-surface-material-body.js';
import type { SectionFraction, SectionRationalContext } from '../section-rational-internal.js';
import { KernelError } from '../core/barocss-error.js';
type F = SectionFraction;
type Sense = 'forward' | 'reverse';
type ClosureRole = 'yMin' | 'zMin' | 'xMin' | 'xMax';
type FaceRole = 'roof' | 'side' | ClosureRole;
type EdgeRole = 'cut' | 'roofYMin' | 'roofXMin' | 'roofXMax' | 'sideZMin' | 'sideXMin' | 'sideXMax' | 'lowYLowZ' | 'lowYXMin' | 'lowYXMax' | 'lowZXMin' | 'lowZXMax';
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
type Graph = {
    vertices: Vertex[];
    edges: Edge[];
    faces: Face[];
    shell: Shell;
    body: Body;
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
    occurrences: [
        {
            useId: string;
            origin: LocalUseRef;
            parameterMap: ParameterMap;
        },
        {
            useId: string;
            origin: LocalUseRef;
            parameterMap: ParameterMap;
        }
    ];
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
export type PairedSurfaceMaterialBodyClosure = Closure;
export type PairedSurfaceMaterialBodyClosures = Closures;
export type PairedSurfaceMaterialBodyGraph = Graph;
export type PairedSurfaceMaterialBodyProof = Proof;
export type PairedSurfaceMaterialBodySourceRef = SourceRef;
export type PairedSurfaceMaterialBodyLocalFaceRef = LocalFaceRef;
export type PairedSurfaceMaterialBodyLocalVertexRef = LocalVertexRef;
export type PairedSurfaceMaterialBodyLocalUseRef = LocalUseRef;
export type PairedSurfaceMaterialBodyParameterMap = ParameterMap;
export type PairedSurfaceMaterialBodyGlobalUse = GlobalUse;
export type PairedSurfaceMaterialBodyVertex = Vertex;
export type PairedSurfaceMaterialBodyEdge = Edge;
export type PairedSurfaceMaterialBodyLoop = Loop;
export type PairedSurfaceMaterialBodyFace = Face;
export type PairedSurfaceMaterialBodyShell = Shell;
export type PairedSurfaceMaterialBodyBody = Body;
export declare class PairedSurfaceMaterialBodyProofError extends KernelError {
    readonly code: 'PROFILE' | 'DOMAIN' | 'TOPOLOGY' | 'MATERIAL' | 'ORIENTATION' | 'BINDING' | 'REPRESENTABILITY';
    readonly edgeIndex: number | null;
    readonly faceRole: FaceRole | null;
    constructor(code: PairedSurfaceMaterialBodyProofError['code'], detail: string, edgeIndex?: number | null, faceRole?: FaceRole | null, cause?: unknown);
}
/** Entire actual boundary/graph/source-defined material proof; no provider or qFloat calls. */
export declare function provePairedSurfaceMaterialBodyTrusted(request: PairedSurfaceMaterialBodyRequest, closures: Closures, graph: Graph, q: SectionRationalContext): Proof;
export {};
