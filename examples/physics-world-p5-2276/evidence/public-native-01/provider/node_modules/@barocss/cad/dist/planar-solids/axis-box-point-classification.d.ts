import type { AxisBoxSolidBooleanResult } from '../axis-box-boolean.js';
import type { Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const AxisBoxSolidBooleanPointDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly BOOLEAN: "BOOLEAN";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type AxisBoxSolidBooleanPointDiagnosticCode = typeof AxisBoxSolidBooleanPointDiagnosticCode[keyof typeof AxisBoxSolidBooleanPointDiagnosticCode];
export declare class AxisBoxSolidBooleanPointError extends KernelError {
    readonly code: AxisBoxSolidBooleanPointDiagnosticCode;
    constructor(code: AxisBoxSolidBooleanPointDiagnosticCode, detail: string, cause?: unknown);
}
export interface AxisBoxSolidBooleanPointQuery {
    queryId: string;
    pointMM: Point;
}
export interface AxisBoxSolidBooleanPointOptions {
    evaluationId: string;
    maximumQueries: number;
}
type Status = 'inside' | 'outside' | 'boundary';
type BoundaryPanel = {
    panelId: string;
    sourceId: string;
    bodyId: string;
    shellId: string;
    emptyRegionId: string;
    shellRole: 'outer' | 'cavity';
    localFaceId: string;
    surfaceId: string;
};
type Classification = {
    queryId: string;
    status: Status;
    bodyIds: string[];
    emptyRegionIds: string[];
    boundaryPanels: BoundaryPanel[];
};
type AxisPosition = {
    axis: 'x' | 'y' | 'z';
    position: 'below-grid' | 'above-grid' | 'grid-plane' | 'open-interval';
    planeIndex: number | null;
    incidentIndices: number[];
};
type IncidentCell = {
    index: [number, number, number];
    outOfGrid: boolean;
    occupied: boolean;
    bodyId: string | null;
    emptyRegionId: string | null;
};
type QueryProof = {
    queryId: string;
    axes: [AxisPosition, AxisPosition, AxisPosition];
    incidentCells: IncidentCell[];
    occupiedCount: number;
    emptyCount: number;
    panelTestCount: number;
    matchedPanelIds: string[];
};
type Proof = {
    queries: QueryProof[];
};
export interface AxisBoxSolidBooleanPointReport {
    schema: 'barocss-axis-box-solid-boolean-point-classification';
    version: 0;
    evaluationId: string;
    parentEvaluationId: string;
    operandSourceIds: [string, string];
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    authority: 'saved-restricted-integer-cell-coefficient-model-material';
    queryCount: number;
    counts: {
        inside: number;
        outside: number;
        boundary: number;
    };
    bodyIds: string[];
    emptyRegionIds: string[];
    exteriorEmptyRegionId: string;
    directCounts: {
        booleanValidationCount: 1;
        curvePointEvaluationCount: 0;
        curveDerivativeEvaluationCount: 0;
        surfacePointEvaluationCount: 0;
        surfaceDerivativeEvaluationCount: 0;
        sourceCompilationCount: 0;
        incidentCellCheckCount: number;
        boundaryPanelTestCount: number;
    };
    numericPolicy: {
        ordering: 'exact-finite-represented-point-versus-safe-integer-plane';
        material: 'all-occupied-inside-none-occupied-outside-mixed-boundary';
        exterior: 'actual-parent-exterior-empty-region-sentinel';
        panelMembership: 'exact-plane-equality-and-closed-integer-tile-extents';
        internalPlanes: 'cancelled-occupied-grid-interfaces-remain-inside';
        inputBitsPreserved: true;
        coordinateArithmeticPerformed: false;
        toleranceUsed: false;
        nativeD0EqualityAuthority: false;
        rayUsed: false;
        snapPerformed: false;
    };
    quality: {
        restrictedPointMaterialCertified: true;
        arbitraryCurvedSolidCertified: false;
        pointProjectionPerformed: false;
        manufacturingToleranceCertified: false;
        globalBinary64EvaluationErrorCertified: false;
        rendererPickingCertified: false;
        parentProofUnchanged: true;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumQueries: 8;
        maximumIncidentCellsPerQuery: 8;
        maximumIncidentCellChecks: 64;
        maximumPanelsPerQuery: 72;
        maximumBoundaryPanelTests: 576;
        finiteXYZRequired: true;
        coordinateMagnitudeCap: 'none';
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        stringCharacters: 262144;
    };
    workScope: 'direct-parent-owned-validation-and-new-integer-grid-predicates-parent-internal-work-excluded';
    budgetFailure: 'atomic-no-partial-point-classification';
}
export interface AxisBoxSolidBooleanPointResult {
    boolean: AxisBoxSolidBooleanResult;
    queries: AxisBoxSolidBooleanPointQuery[];
    options: AxisBoxSolidBooleanPointOptions;
    classifications: Classification[];
    proof: Proof;
    report: AxisBoxSolidBooleanPointReport;
}
/** Classify the exact represented original XYZ point against the saved regularized integer cell material. */
export declare function classifyAxisBoxSolidBooleanPoints(booleanInput: AxisBoxSolidBooleanResult, queriesInput: AxisBoxSolidBooleanPointQuery[], optionsInput: AxisBoxSolidBooleanPointOptions): AxisBoxSolidBooleanPointResult;
/** Rebuild all parent ownership and exact material/panel predicates, then compare every retained bit. */
export declare function validateAxisBoxSolidBooleanPointClassification(input: AxisBoxSolidBooleanPointResult): AxisBoxSolidBooleanPointReport;
export {};
