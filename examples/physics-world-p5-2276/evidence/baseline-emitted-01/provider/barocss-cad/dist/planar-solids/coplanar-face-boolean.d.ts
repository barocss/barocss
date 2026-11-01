import type { ConvexPlanarFaceResult } from '../own-convex-planar-face.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import type { ExtractedCurveIntervalResult } from '../nurbs/curves/curve-interval-extraction.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const CoplanarFaceBooleanDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly SUPPORT: "SUPPORT";
    readonly CONTACT: "CONTACT";
    readonly UNCERTAINTY: "UNCERTAINTY";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly INCIDENCE: "INCIDENCE";
    readonly NESTING: "NESTING";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CoplanarFaceBooleanDiagnosticCode = typeof CoplanarFaceBooleanDiagnosticCode[keyof typeof CoplanarFaceBooleanDiagnosticCode];
export declare class CoplanarFaceBooleanError extends KernelError {
    readonly code: CoplanarFaceBooleanDiagnosticCode;
    constructor(code: CoplanarFaceBooleanDiagnosticCode, detail: string, cause?: unknown);
}
export interface CoplanarFaceBooleanOptions {
    operation: 'union' | 'intersection' | 'difference';
    evaluationId: string;
    resultIdPrefix: string;
    maximumPairTests: number;
    maximumFragments: number;
}
export interface CoplanarFaceBooleanContributor {
    operand: 'a' | 'b';
    faceId: string;
    evaluationId: string;
    supportId: string;
    loopId: string;
    useId: string;
    edgeId: string;
    curveId: string;
    pcurveId: string;
    authoredEdgeIndex: number;
    originalUseSense: 'forward' | 'reverse';
    authoredLoopOrientation: 'ccw' | 'cw';
    originalFaceSense: 'forward' | 'reverse';
}
export interface CoplanarFaceBooleanEvent {
    id: string;
    vertexId: string;
    uv: Point;
    pointMM: Point;
    a: {
        contributor: CoplanarFaceBooleanContributor;
        fraction: number;
        parameter: number;
        uv: Point;
        nativeUV: Point;
        pointMM: Point;
    };
    b: {
        contributor: CoplanarFaceBooleanContributor;
        fraction: number;
        parameter: number;
        uv: Point;
        nativeUV: Point;
        pointMM: Point;
    };
    worldDifferenceMM: number;
    uvDifference: number;
    determinant: {
        denominator: number;
        numeratorA: number;
        numeratorB: number;
        denominatorThreshold: number;
        numeratorAThreshold: number;
        numeratorBThreshold: number;
        fractionMarginA: number;
        fractionMarginB: number;
    };
}
interface BooleanVertex {
    id: string;
    uv: Point;
    pointMM: Point;
    contributors: {
        source: CoplanarFaceBooleanContributor;
        kind: 'original-vertex' | 'cross-event' | 'coincident-counterpart';
        originalVertexId: string | null;
        parameter: number;
        eventId: string | null;
    }[];
}
export interface CoplanarFaceBooleanFragment {
    id: string;
    edgeId: string;
    useId: string;
    vertexIds: [string, string];
    contributor: CoplanarFaceBooleanContributor;
    interval: [number, number];
    traversalInterval: [number, number];
    sense: 'forward' | 'reverse';
    curve: Curve;
    extraction: ExtractedCurveIntervalResult;
    pcurve: {
        id: string;
        coordinateSystem: 'uv';
        lengthUnit: 'dimensionless';
        domain: [number, number];
        curve: Curve;
    };
    source: {
        assetId: string;
        curveId: string;
        objectIndex: number;
    };
    endpointBindings: {
        vertexId: string;
        parameter: number;
        pointMM: Point;
        uv: Point;
        vertexDifferenceMM: number;
        uvDifference: number;
    }[];
    observations: {
        parameter: number;
        originalPointMM: Point;
        pointMM: Point;
        uv: Point;
        planePointMM: Point;
        pointDifferenceMM: number;
        surfaceDifferenceMM: number;
        originalD1: CurveD1Result;
        curveD1: CurveD1Result;
        pcurveD1: CurveD1Result;
        surfaceD1: SurfaceD1Result;
        relativeD1Difference: number;
        relativeSurfaceD1Difference: number;
    }[];
}
export interface CoplanarFaceBooleanLoop {
    id: string;
    role: 'outer' | 'hole';
    orientation: 'ccw' | 'cw';
    faceSense: 'forward';
    componentId: string;
    vertexIds: string[];
    fragmentIds: string[];
    uses: {
        id: string;
        edgeId: string;
        curveId: string;
        pcurveId: string;
        vertexIds: [string, string];
        interval: [number, number];
        sense: 'forward' | 'reverse';
    }[];
    signedAreaUV: number;
    areaUncertaintyUV: number;
}
export interface CoplanarFaceBooleanComponent {
    id: string;
    supportId: string;
    outerLoopId: string;
    holeLoopIds: string[];
    areaUV: number;
}
export interface CoplanarFaceBooleanReport {
    schema: 'barocss-native-coplanar-face-boolean';
    version: 0;
    operation: 'union' | 'intersection' | 'difference';
    evaluationId: string;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    uvUnits: 'dimensionless';
    representation: 'nonconvex-and-holed-planar-region-not-convex-face-or-solid';
    branch: 'proper-arrangement' | 'exact-full-coincidence';
    pairTestCount: number;
    eventCount: number;
    arrangementVertexCount: number;
    arrangementFragmentCount: number;
    selectedFragmentCount: number;
    discardedFragmentCount: number;
    vertexCount: number;
    loopCount: number;
    componentCount: number;
    holeCount: number;
    sourceCount: number;
    areaUV: number;
    pairTests: {
        edgeA: number;
        edgeB: number;
        classification: 'crossing' | 'disjoint' | 'parallel-separated';
        denominator: number;
        numeratorA: number | null;
        numeratorB: number | null;
        fractionA: number | null;
        fractionB: number | null;
    }[];
    selections: {
        arrangementIndex: number;
        contributor: CoplanarFaceBooleanContributor;
        interval: [number, number];
        midpoint: number;
        midpointUV: Point;
        classification: 'inside' | 'outside' | 'coincident';
        selected: boolean;
        sense: 'forward' | 'reverse';
        fragmentId: string | null;
    }[];
    coincidentCounterparts: {
        vertexA: number;
        vertexB: number;
        edgeA: number;
        edgeB: number;
    }[];
    maximumEndpointDifferenceMM: number;
    maximumPointDifferenceMM: number;
    maximumRelativeD1Difference: number;
    incidenceValid: true;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        authority: 'qualified-original-native-plane-and-line-coefficients';
        supportBitsCopiedExceptDerivedId: true;
        worldFragments: 'actual-native-original-parameter-interval-extraction-not-snapped';
        uvPcurves: 'dimensionless-native-curves-excluded-from-mm-source0';
        vertices: 'qualified-original-or-edge-pair-events-no-close-coordinate-merging';
        loops: 'all-selected-cycles-outer-ccw-hole-cw-canonical-forward-face-sense';
        sourceObjectLimitUnchanged: 16;
        uvAreaIsManufacturingArea: false;
        globalBinary64ErrorCertified: false;
        globalShapeErrorCertified: false;
        manufacturingToleranceCertified: false;
        brepNamingCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-region';
    limits: {
        maximumEdgesPerOperand: 8;
        maximumPairTests: 64;
        maximumFragments: 64;
        maximumEvents: 64;
        maximumLoops: 16;
        maximumComponents: 8;
        maximumHoles: 8;
        maximumSources: 5;
        maximumCurvesPerSource: 15;
        resultIdPrefixCharacters: 12;
        ownValues: 1048576;
        ownDepth: 40;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
        pointComparisonMM: 1e-7;
        relativeD1Comparison: 1e-7;
    };
}
export interface CoplanarFaceBooleanResult {
    faceA: ConvexPlanarFaceResult;
    faceB: ConvexPlanarFaceResult;
    options: CoplanarFaceBooleanOptions;
    support: Surface;
    vertices: BooleanVertex[];
    events: CoplanarFaceBooleanEvent[];
    fragments: CoplanarFaceBooleanFragment[];
    loops: CoplanarFaceBooleanLoop[];
    components: CoplanarFaceBooleanComponent[];
    sources: {
        id: string;
        source: string;
        sourceVersion: 0;
        model: Model;
        supportId: string;
        fragmentIds: string[];
    }[];
    report: CoplanarFaceBooleanReport;
}
/** Qualified native Lines produce a separate, possibly nonconvex/holed planar region. */
export declare function booleanCoplanarFaces(faceAInput: ConvexPlanarFaceResult, faceBInput: ConvexPlanarFaceResult, inputOptions: CoplanarFaceBooleanOptions): CoplanarFaceBooleanResult;
/** Full reconstruction includes discarded arrangement evidence and every native extraction/Source0 asset. */
export declare function validateCoplanarFaceBoolean(input: CoplanarFaceBooleanResult): CoplanarFaceBooleanReport;
export {};
