import type { Curve, Model, Point } from '../types.js';
import type { ExactPairedVLinearSurfaceIntersectionResult } from '../exact-proof/exact-paired-vlinear-surface-intersection.js';
import type { SurfaceIsoCurveResult } from '../nurbs/surfaces/surface-isocurve.js';
import type { SourceCurveIntervalExtractionResult } from '../nurbs/source-wide/source-curve-interval-extraction.js';
import type { SectionFraction, SectionRationalContext } from '../section-rational-internal.js';
import { KernelError } from '../core/barocss-error.js';
type F = SectionFraction;
type Role = 'bottom' | 'rightLow' | 'rightHigh' | 'top' | 'leftLow' | 'leftHigh' | 'sharedCut';
type VertexRole = 'bottomLeft' | 'bottomRight' | 'topRight' | 'topLeft' | 'cutLeft' | 'cutRight';
type Sense = 'forward' | 'reverse';
type SourceRef = {
    sourceField: 'world.source';
    modelField: 'world.model';
    modelName: string;
    objectIndex: number;
    curveId: string;
};
type SupportRef = {
    sourceId: string;
    surfaceId: string;
    sourceField: 'request.section.request.assets[0].source';
    modelField: 'request.section.originalModels[0]';
    modelName: string;
    objectIndex: number;
};
type Vertex = {
    id: string;
    role: VertexRole;
    sourceId: string;
    surfaceId: string;
    world: Point;
    uv: Point;
};
type Edge = {
    id: string;
    role: Role;
    curve: Curve;
    vertexIds: [string, string];
    pcurve: {
        coordinateSystem: 'original-native-uv';
        lengthUnit: 'dimensionless';
        curve: Curve;
    };
    origin: {
        kind: 'restricted-isocurve' | 'exact-fixed-u-line' | 'paired-section';
        index: number | null;
    };
    sourceRef: SourceRef;
};
type Use = {
    id: string;
    edgeId: string;
    vertexIds: [string, string];
    sense: Sense;
    interval: [number, number];
    pcurveId: string;
};
type Loop = {
    id: string;
    uses: [Use, Use, Use, Use];
};
type Face = {
    id: string;
    sourceId: string;
    surfaceId: string;
    outerLoopId: string;
    orientation: Sense;
    region: 'below-cut' | 'above-cut';
};
type World = {
    source: string;
    sourceVersion: 0;
    model: Model;
};
type EdgeProof = {
    edgeId: string;
    role: Role;
    sourceRef: SourceRef;
    nativeDegree: number;
    nativeDomain: [number, number];
    nativeWeights: number[];
    proofDegree: 4;
    worldCartesian: F[][];
    uvCartesian: F[][];
    composedSurfaceCartesian: F[][];
    residuals: F[][];
    wholeGap: {
        exact: F;
        upper: 0;
    };
};
type RestrictedBoundary = {
    edgeId: string;
    isoIndex: 0 | 1;
    intervalIndex: 0 | 1;
    fixedOriginalV: number;
    originalDomain: [number, number];
    effectiveDomain: [number, number];
    isoCurveId: string;
    intervalCurveId: string;
    worldCurveId: string;
    wholeIsoSourceBinding: true;
    wholeIntervalSourceBinding: true;
    identityParameterMap: true;
    sourceRestrictionResiduals: F[][];
};
type Connector = {
    edgeId: string;
    role: 'rightLow' | 'rightHigh' | 'leftLow' | 'leftHigh';
    fixedOriginalU: number;
    worldEndpoints: Point[];
    uvEndpoints: Point[];
    expectedSurfaceEndpoints: F[][];
    endpointResiduals: F[][];
    wholeAffineResiduals: F[][];
};
type Proof = {
    schema: 'barocss-paired-surface-uv-split-faces-proof';
    version: 0;
    support: SupportRef;
    window: {
        u: [number, number];
        v: [number, number];
    };
    projection: {
        xIntercept: F;
        xDerivative: F;
        yIntercept: F;
        yDerivative: F;
        xyDeterminant: F;
        gramLowerBound: F;
        nonzero: true;
        globallyInjectiveOnOriginalA: true;
    };
    cut: {
        worldCurveId: string;
        pcurveId: string;
        parentEvaluationId: string;
        degree: 4;
        uCoefficients: F[];
        uDerivative: F[];
        minimumUDerivative: F;
        vCoefficients: F[];
        lowerGaps: F[];
        upperGaps: F[];
        minimumLowerGap: F;
        minimumUpperGap: F;
        strictVInterior: true;
    };
    restrictions: [RestrictedBoundary, RestrictedBoundary];
    connectors: Connector[];
    edges: EdgeProof[];
    uvRegions: {
        lowerArea: F;
        upperArea: F;
        windowArea: F;
        sumResidual: F;
        areaUnit: 'dimensionless-uv2';
        closedCoverOfWindow: true;
        disjointInteriors: true;
        sharedBoundaryOnlyCut: true;
        outsideWindowUnclaimed: true;
    };
    faceCertificates: {
        faceId: string;
        loopId: string;
        sourceId: string;
        surfaceId: string;
        region: 'below-cut' | 'above-cut';
        orientation: Sense;
        closedDiskCertified: true;
        exactWorldSurfaceAgreement: true;
        originalXYProjectionAuthority: true;
        orientedUVSimpleCycle: true;
    }[];
    wholeModelGapZero: true;
    originalInputsPreserved: true;
    authority: 'full-exact-paired-section-actual-restricted-isocurves-and-original-a-xy-projection';
};
export type PairedSurfaceUVSplitFacesProof = Proof;
export type PairedSurfaceUVSplitVertex = Vertex;
export type PairedSurfaceUVSplitEdge = Edge;
export type PairedSurfaceUVSplitLoop = Loop;
export type PairedSurfaceUVSplitFace = Face;
export type PairedSurfaceUVSplitWorld = World;
export declare class PairedSurfaceUVSplitFacesProofError extends KernelError {
    readonly code: 'SUPPORT' | 'DOMAIN' | 'REGION' | 'REPRESENTABILITY' | 'BINDING';
    readonly edgeIndex: number | null;
    readonly role: Role | null;
    constructor(code: PairedSurfaceUVSplitFacesProofError['code'], detail: string, edgeIndex: number | null, role: Role | null, cause?: unknown);
}
/** Exact actual-source/image/region proof; no native calls or coordinate conversion. */
export declare function provePairedSurfaceUVSplitFacesTrusted(section: ExactPairedVLinearSurfaceIntersectionResult, isoCurves: [SurfaceIsoCurveResult, SurfaceIsoCurveResult], intervals: [SourceCurveIntervalExtractionResult, SourceCurveIntervalExtractionResult], world: World, vertices: Vertex[], edges: Edge[], loops: [Loop, Loop], faces: [Face, Face], q: SectionRationalContext): Proof;
export {};
