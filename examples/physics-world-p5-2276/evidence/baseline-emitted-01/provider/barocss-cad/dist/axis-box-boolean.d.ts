import type { AxisBoxSolidValidationReport } from './core/box-solid.js';
import type { AxisBoxShell } from './core/box-shell.js';
import type { FaceBundle } from './core/face.js';
import type { CurveD1Result, SurfaceD1Result } from './core/derivatives.js';
import type { Model, Point } from './types.js';
import { KernelError } from './core/barocss-error.js';
export declare const AxisBoxSolidBooleanDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly SOURCE: "SOURCE";
    readonly BINDING: "BINDING";
    readonly CONTACT: "CONTACT";
    readonly TOPOLOGY: "TOPOLOGY";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
}>;
export type AxisBoxSolidBooleanDiagnosticCode = typeof AxisBoxSolidBooleanDiagnosticCode[keyof typeof AxisBoxSolidBooleanDiagnosticCode];
export declare class AxisBoxSolidBooleanError extends KernelError {
    readonly code: AxisBoxSolidBooleanDiagnosticCode;
    constructor(code: AxisBoxSolidBooleanDiagnosticCode, detail: string, cause?: unknown);
}
export interface AxisBoxSolidBooleanAsset {
    sourceId: string;
    sourceVersion: 0;
    source: string;
    shell: AxisBoxShell;
}
export interface AxisBoxSolidBooleanOptions {
    operation: 'union' | 'intersection' | 'difference';
    evaluationId: string;
    resultIdPrefix: string;
    maximumCells: number;
    maximumPanels: number;
}
type Index3 = [number, number, number];
type Four<T> = [T, T, T, T];
type Fraction = {
    numerator: string;
    denominator: string;
};
type Cell = {
    index: Index3;
    insideA: boolean;
    insideB: boolean;
    occupied: boolean;
    bodyId: string | null;
    emptyRegionId: string | null;
    volumeMM3: number;
};
type Arc = {
    panelId: string;
    cornerIndex: number;
    previousEdgeId: string;
    nextEdgeId: string;
};
type Vertex = {
    id: string;
    gridIndex: Index3;
    pointMM: Point;
    link: {
        edgeIds: string[];
        arcs: Arc[];
        degrees: {
            edgeId: string;
            incoming: number;
            outgoing: number;
            degree: number;
        }[];
        cycleEdgeIds: string[];
        cycleArcIndices: number[];
    };
};
type Reference = {
    sourceId: string;
    faceId: string;
    localEdgeId: string;
    curveId: string;
};
type Use = Reference & {
    sense: 'forward' | 'reverse';
};
type Edge = {
    id: string;
    vertexIds: [string, string];
    canonical: Reference;
    uses: [Use, Use];
};
type Lineage = {
    operand: 'a' | 'b';
    sourceId: string;
    shellId: string;
    globalFaceId: string;
    localFaceId: string;
    surfaceId: string;
    relativeOrientation: 1 | -1;
    uvCorners: Four<[Fraction, Fraction]>;
};
type Panel = {
    id: string;
    axis: 0 | 1 | 2;
    sign: -1 | 1;
    planeIndex: number;
    cellIndex: Index3;
    emptyCellIndex: Index3 | null;
    bodyId: string;
    emptyRegionId: string;
    gridCorners: Four<Index3>;
    vertexIds: Four<string>;
    edgeIds: Four<string>;
    sourceId: string;
    areaMM2: number;
    bundle: FaceBundle;
    lineage: Lineage[];
};
type Shell = {
    id: string;
    bodyId: string;
    emptyRegionId: string;
    role: 'outer' | 'cavity';
    panelIds: string[];
    edgeIds: string[];
    vertexIds: string[];
    eulerCharacteristic: number;
    signedVolumeMM3: number;
    areaMM2: number;
};
type Body = {
    id: string;
    cellIndices: Index3[];
    shellIds: string[];
    volumeMM3: number;
    areaMM2: number;
    boundsMM: {
        min: Point;
        max: Point;
    };
    closed: true;
    solid: true;
    embeddedIntegerCellModelCertified: true;
};
type Source = {
    sourceId: string;
    panelId: string;
    source: string;
    sourceVersion: 0;
    model: Model;
};
type SurfaceObservation = {
    kind: 'surface';
    panelId: string;
    uv: [number, number];
    d0: Point;
    d1: SurfaceD1Result;
    expectedPointMM: Point;
    expectedDu: Point;
    expectedDv: Point;
    pointGapMM: number;
    derivativeGapMM: number;
};
type CurveObservation = {
    kind: 'curve';
    panelId: string;
    localEdgeId: string;
    curveId: string;
    parameter: number;
    d0: Point;
    d1: CurveD1Result;
    expectedPointMM: Point;
    expectedDerivative: Point;
    pointGapMM: number;
    derivativeGapMM: number;
};
type Observation = SurfaceObservation | CurveObservation;
type OperandBinding = {
    sourceId: string;
    shellId: string;
    faces: {
        globalFaceId: string;
        localFaceId: string;
        surfaceId: string;
    }[];
};
export interface AxisBoxSolidBooleanReport {
    schema: 'barocss-axis-box-solid-boolean';
    version: 0;
    evaluationId: string;
    operation: AxisBoxSolidBooleanOptions['operation'];
    geometryFamily: 'exact-integer-orthogonal-cell-solid-v0';
    lengthUnit: 'mm';
    empty: boolean;
    solid: boolean;
    cellCount: number;
    occupiedCellCount: number;
    vertexCount: number;
    edgeCount: number;
    panelCount: number;
    shellCount: number;
    bodyCount: number;
    sourceCount: number;
    volumeMM3: number;
    areaMM2: number;
    eulerCharacteristic: number;
    operandBindings: [OperandBinding, OperandBinding];
    emptyRegions: {
        id: string;
        exterior: boolean;
        cellIndices: Index3[];
    }[];
    incidence: {
        allBoundaryTilesAccounted: true;
        internalFacesCancelled: true;
        everyEdgeTwoOppositeUses: true;
        orientedVertexLinksSingleCycles: true;
        cornerCount: number;
        edgeUseCount: number;
        panelEdgeEquation: true;
    };
    directCounts: {
        originalSourceCompilationCount: 2;
        operandSolidValidationCount: 2;
        faceBuildCount: number;
        outputSourceCompilationCount: number;
        curvePointEvaluationCount: number;
        curveDerivativeEvaluationCount: number;
        surfacePointEvaluationCount: number;
        surfaceDerivativeEvaluationCount: number;
        observationCount: number;
    };
    numericPolicy: {
        material: 'regularized-closure-of-occupied-open-integer-cells';
        generatedZero: 'canonical-positive-zero-original-bits-retained';
        identity: 'exact-original-coordinate-plane-grid-indices-no-tolerance-welding';
        source: 'whole-original-models-and-per-panel-native-model5';
        lineageUV: 'exact-reduced-integer-ratio-fractions';
        volume: 'occupied-cell-volume-equals-sum-of-oriented-shell-volumes';
        euler: 'diagnostic-no-sphere-or-single-shell-requirement';
        pointComparisonMM: 1e-9;
        relativeDerivativeComparison: 1e-9;
    };
    quality: {
        restrictedCellModelEmbeddingCertified: boolean;
        restrictedBoundaryManifoldCertified: boolean;
        regularizedMaterialCertified: true;
        arbitraryCurvedSolidCertified: false;
        globalBinary64EvaluationErrorCertified: false;
        manufacturingToleranceCertified: false;
        nativePanelFaceSubsetSolidFalse: true;
        weldingPerformed: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumCells: 27;
        maximumCandidatePanels: 162;
        maximumPanels: 72;
        maximumGridVertices: 64;
        maximumGridSegments: 144;
        maximumObservations: 1080;
        maximumOriginalModelObjects: 16;
        outputModelObjects: 5;
        volumeMM3: 2000000000000;
        areaMM2: 1200000000;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
    };
    workScope: 'direct-root-calls-inherited-provider-work-excluded';
    budgetFailure: 'atomic-no-partial-solid-boolean';
}
export interface AxisBoxSolidBooleanResult {
    a: AxisBoxSolidBooleanAsset;
    b: AxisBoxSolidBooleanAsset;
    options: AxisBoxSolidBooleanOptions;
    originalModels: [Model, Model];
    operandReports: [AxisBoxSolidValidationReport, AxisBoxSolidValidationReport];
    grid: {
        x: number[];
        y: number[];
        z: number[];
    };
    cells: Cell[];
    vertices: Vertex[];
    edges: Edge[];
    panels: Panel[];
    shells: Shell[];
    bodies: Body[];
    sources: Source[];
    observations: Observation[];
    report: AxisBoxSolidBooleanReport;
}
/** Regularized exact integer-cell Boolean; complete manifold planning precedes output native construction. */
export declare function buildAxisBoxSolidBoolean(aInput: AxisBoxSolidBooleanAsset, bInput: AxisBoxSolidBooleanAsset, optionsInput: AxisBoxSolidBooleanOptions): AxisBoxSolidBooleanResult;
/** Rebuild both source-qualified original solids and every exact/native output witness before whole-result comparison. */
export declare function validateAxisBoxSolidBoolean(input: AxisBoxSolidBooleanResult): AxisBoxSolidBooleanReport;
export {};
