import type { CoplanarFaceBooleanResult, CoplanarFaceBooleanContributor } from './coplanar-face-boolean.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import type { CompatibleRuledSurfaceResult } from '../nurbs/surfaces/compatible-ruled-surface.js';
import { KernelError } from '../core/barocss-error.js';
export declare const CoplanarFaceBooleanExtrusionDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly INCIDENCE: "INCIDENCE";
    readonly OWNED: "OWNED";
}>;
export type CoplanarFaceBooleanExtrusionDiagnosticCode = typeof CoplanarFaceBooleanExtrusionDiagnosticCode[keyof typeof CoplanarFaceBooleanExtrusionDiagnosticCode];
export declare class CoplanarFaceBooleanExtrusionError extends KernelError {
    readonly code: CoplanarFaceBooleanExtrusionDiagnosticCode;
    constructor(code: CoplanarFaceBooleanExtrusionDiagnosticCode, detail: string, cause?: unknown);
}
export interface CoplanarFaceBooleanExtrusionOptions {
    evaluationId: string;
    resultIdPrefix: string;
    distanceMM: number;
    maximumVertices: number;
    maximumFaces: number;
    maximumSourceChunks: number;
    maximumBindingSamples: number;
}
export interface CoplanarFaceBooleanExtrusionVertex {
    id: string;
    layer: 'bottom' | 'top';
    nativeVertexId: string;
    componentId: string;
    pointMM: Point;
    originalPointMM: Point;
}
type SourcePointer = {
    assetId: string;
    objectId: string;
    objectIndex: number;
    kind: 'curve' | 'surface';
};
export interface CoplanarFaceBooleanExtrusionEdgeUse {
    id: string;
    faceId: string;
    loopId: string;
    edgeId: string;
    curveId: string;
    source: SourcePointer;
    edgeSense: 'forward' | 'reverse';
    faceOrientation: 'forward' | 'reverse';
    effectiveSense: 'forward' | 'reverse';
    vertexIds: [string, string];
    effectiveVertexIds: [string, string];
    interval: [number, number];
    effectiveInterval: [number, number];
    nativeFragmentId: string | null;
    nativeUseId: string | null;
    contributor: CoplanarFaceBooleanContributor | null;
    pcurve: {
        id: string;
        coordinateSystem: 'uv';
        lengthUnit: 'dimensionless';
        domain: [number, number];
        parameterRoles: {
            u: 'original-support-u' | 'original-fragment-parameter';
            v: 'original-support-v' | 'extrusion-interpolation';
        };
        curve: Curve;
    };
    observations: {
        parameter: number;
        curveD1: CurveD1Result;
        pcurveD1: CurveD1Result;
        surfaceD1: SurfaceD1Result;
        pointDifferenceMM: number;
        relativeTangentDifference: number;
        endpointVertexId: string | null;
        endpointDifferenceMM: number | null;
    }[];
}
export interface CoplanarFaceBooleanExtrusionFace {
    id: string;
    componentId: string;
    kind: 'bottom-cap' | 'top-cap' | 'wall';
    orientation: 'forward' | 'reverse';
    surface: Surface;
    source: SourcePointer;
    nativeFragmentId: string | null;
    ruledConstruction: CompatibleRuledSurfaceResult | null;
    loops: {
        id: string;
        role: 'outer' | 'hole';
        nativeLoopId: string | null;
        nativeLoopRole: 'outer' | 'hole' | null;
        uses: CoplanarFaceBooleanExtrusionEdgeUse[];
        effectiveUseIds: string[];
    }[];
    normalObservation: {
        u: number;
        v: number;
        witness: 'native-selected-boundary-uv' | 'native-wall-parameter-center';
        materialInteriorClaim: false;
        surfaceD1: SurfaceD1Result;
        orientedNormal: Point;
        intendedNormal: Point;
        normalDifference: number;
        normalDot: number;
    };
}
export interface CoplanarFaceBooleanExtrusionShell {
    id: string;
    componentId: string;
    faceIds: string[];
    edgeIds: string[];
    vertexIds: string[];
    holeLoopIds: string[];
    vertexCount: number;
    edgeCount: number;
    faceCount: number;
    capWeightedContribution: number;
    weightedEuler: number;
    expectedWeightedEuler: number;
    pairedEdgeIncidence: true;
    solid: false;
}
export interface CoplanarFaceBooleanExtrusionReport {
    schema: 'barocss-native-coplanar-face-boolean-extrusion';
    version: 0;
    evaluationId: string;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    capUVUnits: 'dimensionless';
    wallVRole: 'extrusion-interpolation';
    distanceMM: number;
    empty: boolean;
    nativeVertexCount: number;
    nativeFragmentCount: number;
    componentCount: number;
    holeCount: number;
    vertexCount: number;
    edgeCount: number;
    faceCount: number;
    shellCount: number;
    edgeUseCount: number;
    geometryObjectCount: number;
    sourceChunkCount: number;
    ruledConstructionCount: number;
    bindingSampleCount: number;
    bindingCurveD1EvaluationCount: number;
    bindingSurfaceD1EvaluationCount: number;
    normalCurveD1EvaluationCount: number;
    normalSurfaceD1EvaluationCount: number;
    curveD1EvaluationCount: number;
    surfaceD1EvaluationCount: number;
    boundsMM: {
        min: Point;
        max: Point;
    } | null;
    translationEvidence: {
        origin: string;
        originalPointMM: Point;
        translatedPointMM: Point;
        actualOffsetMM: Point;
        dominantAxis: number;
        dominantSeparationMM: number;
        separationThresholdMM: number;
        normalProjectionMM: number;
        offsetDifferenceMM: number;
    }[];
    edgeIncidence: {
        edgeId: string;
        useIds: [string, string];
        faceIds: [string, string];
        effectiveSenses: ['forward', 'reverse'] | ['reverse', 'forward'];
        opposite: true;
    }[];
    maximumPointDifferenceMM: number;
    maximumEndpointDifferenceMM: number;
    maximumRelativeTangentDifference: number;
    maximumNormalDifference: number;
    incidenceValid: true;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        geometryAuthority: 'actual-native-fragments-support-and-compatible-ruled-surfaces';
        originalRegionBitsPreserved: true;
        boundsAuthority: 'canonical-selected-bottom-top-vertices-not-certified-native-geometry-bounds';
        topPoles: 'one-native-normal-translation';
        capTrim: 'unchanged-component-outer-and-hole-cycles-not-support-rectangle';
        capNormalWitness: 'selected-native-boundary-uv-no-material-interior-claim';
        wallUV: 'native-fragment-u-and-dimensionless-v-identity-equal-weight-sidecars';
        endpoints: 'unsnapped-native-curves-and-canonical-incidence-local-residuals-no-welding';
        pairedUses: 'local-edge-sense-times-face-orientation';
        workScope: 'new-extrusion-bindings-and-normal-observations-excludes-native-parent-and-ruled-constructor-observations';
        uvSource: 'dimensionless-sidecars-excluded-from-world-mm-source0';
        sourceObjectLimitUnchanged: 16;
        geometricSolidCertified: false;
        exactSewingCertified: false;
        globalManifoldCertified: false;
        manufacturingToleranceCertified: false;
        volumeCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-extrusion';
    limits: {
        maximumNativeVertices: 64;
        maximumVertices: 128;
        maximumEdges: 192;
        maximumFaces: 80;
        maximumShells: 8;
        maximumEdgeUses: 384;
        maximumGeometryObjects: 258;
        maximumSourceChunks: 17;
        maximumBindingSamples: 1152;
        sourceObjects: 16;
        ownValues: 1048576;
        ownDepth: 40;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
        resultIdPrefixCharacters: 20;
        minimumDistanceMM: 0.0001;
        maximumDistanceMM: 10000;
        worldCoordinateMM: 10000;
        pointComparisonMM: 1e-7;
        relativeD1Comparison: 1e-7;
    };
}
export interface CoplanarFaceBooleanExtrusionResult {
    region: CoplanarFaceBooleanResult;
    options: CoplanarFaceBooleanExtrusionOptions;
    normal: Point | null;
    translationMM: Point | null;
    vertices: CoplanarFaceBooleanExtrusionVertex[];
    edges: {
        id: string;
        componentId: string;
        kind: 'bottom' | 'top' | 'vertical';
        curve: Curve;
        source: SourcePointer;
        vertexIds: [string, string];
        nativeFragmentId: string | null;
        nativeVertexId: string | null;
        uses: {
            useId: string;
            faceId: string;
            loopId: string;
            effectiveSense: 'forward' | 'reverse';
        }[];
    }[];
    faces: CoplanarFaceBooleanExtrusionFace[];
    shells: CoplanarFaceBooleanExtrusionShell[];
    sources: {
        id: string;
        source: string;
        sourceVersion: 0;
        model: Model;
        objectIds: string[];
    }[];
    report: CoplanarFaceBooleanExtrusionReport;
}
/** Native trimmed caps and actual ruled walls; canonical incidence is observed, never welded. */
export declare function extrudeCoplanarFaceBoolean(regionInput: CoplanarFaceBooleanResult, optionsInput: CoplanarFaceBooleanExtrusionOptions): CoplanarFaceBooleanExtrusionResult;
/** Rebuild native parent, actual primitive geometry/source chunks and the entire oriented incidence result. */
export declare function validateCoplanarFaceBooleanExtrusion(input: CoplanarFaceBooleanExtrusionResult): CoplanarFaceBooleanExtrusionReport;
export {};
