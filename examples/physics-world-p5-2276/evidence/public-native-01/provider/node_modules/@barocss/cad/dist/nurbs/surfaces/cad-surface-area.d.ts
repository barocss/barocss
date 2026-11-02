import type { CadGeometryReferenceV0 } from '../../document/cad-document-reference.js';
import type { CadDocumentResult } from '../../cad-document.js';
import type { Surface, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const CadSurfaceAreaDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly REFERENCE: "REFERENCE";
    readonly STALE: "STALE";
    readonly REGION: "REGION";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CadSurfaceAreaDiagnosticCode = typeof CadSurfaceAreaDiagnosticCode[keyof typeof CadSurfaceAreaDiagnosticCode];
export declare class CadSurfaceAreaError extends KernelError {
    readonly code: CadSurfaceAreaDiagnosticCode;
    constructor(code: CadSurfaceAreaDiagnosticCode, detail: string, cause?: unknown);
}
type Region = {
    u: [number, number];
    v: [number, number];
};
export interface CadSurfaceAreaOptions {
    region: Region | null;
    absoluteToleranceMM2: number;
    relativeTolerance: number;
    maximumEvaluations: number;
    maximumSubdivisions: number;
    maximumDepth: number;
}
export interface CadSurfaceAreaCell {
    cellIndex: number;
    region: Region;
    depth: number;
    originalSpanIndices: {
        u: number;
        v: number;
    };
    Q3: number;
    Q5: number;
    gaussDifferenceMM2: number;
    roundoffFloorMM2: number;
    triangleShortfallMM2: number;
    nativeTriangleAreaMM2: number;
    errorEstimateMM2: number;
    nodes: {
        uNodeIndex: number;
        vNodeIndex: number;
        u: number;
        v: number;
        pointMM: Point;
        jacobian: number;
    }[];
    sanityGrid: {
        u: number;
        v: number;
        pointMM: Point;
    }[];
    triangles: {
        pointIndices: [number, number, number];
        areaMM2: number;
    }[];
}
export interface CadSurfaceAreaReport {
    schema: 'barocss-cad-surface-area';
    version: 0;
    reference: CadGeometryReferenceV0;
    documentVersion: 1;
    sourceVersion: 0;
    lengthUnit: 'mm';
    areaUnit: 'mm2';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    originalDomains: Region;
    requestedRegion: Region | null;
    region: Region;
    originalBreaks: {
        u: number[];
        v: number[];
    };
    initialBreaks: {
        u: number[];
        v: number[];
    };
    initialCellCount: number;
    finalCellCount: number;
    cellMeasurementCount: number;
    evaluationCount: number;
    pointEvaluationCount: number;
    guardEvaluationCount: number;
    subdivisionCount: number;
    guards: {
        axis: 'u' | 'v';
        parameter: number;
        multiplicity: number;
        probe: {
            u: number;
            v: number;
        };
        status: 'native-refused';
        nativeErrorName: string;
        nativeErrorCode: null;
        message: string;
    }[];
    subdivisions: {
        index: number;
        parent: CadSurfaceAreaCell;
        midpoint: {
            u: number;
            v: number;
        };
        children: [CadSurfaceAreaCell, CadSurfaceAreaCell, CadSurfaceAreaCell, CadSurfaceAreaCell];
        evaluationCountAfterSubdivision: number;
        pointEvaluationCountAfterSubdivision: number;
    }[];
    areaEstimateMM2: number;
    errorEstimateMM2: number;
    requestedAbsoluteToleranceMM2: number;
    requestedRelativeTolerance: number;
    achievedToleranceMM2: number;
    criterion: 'aggregate-cell-estimator-not-certified-upper-bound';
    criterionSatisfied: true;
    rule: {
        family: 'own-closed-form-tensor-three-and-five-point-gauss-legendre';
        normalizedNodes: number[];
        G3Weights: [number, number, number];
        G5Weights: [number, number, number, number, number];
        derivativeCallsPerCell: 33;
        pointCallsPerCell: 8;
        sharedCentreEvaluatedOnce: true;
        triangleDiagonal: 'low-low-to-high-high';
        gridOrder: 'u-major-v-major';
    };
    geometryAuthority: 'actual-original-source0-surface-and-native-d1';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        areaEstimate: 'five-by-five-rule-only-no-triangle-substitution';
        estimator: 'maximum-gauss-difference64-epsilon-floor-and-native-triangle-shortfall';
        nativeTriangleSanity: 'local-point-grid-plausibility-heuristic-not-certified-bound';
        parameterizedArea: 'counts-multiplicity-not-union-trim-or-brep-area';
        parameterScaling: 'original-u-v-half-widths-no-normalized-or-angular-fraction-inference';
        cellIdentity: 'measurement-order-id-including-discarded-parents';
        listOrder: 'initial-u-major-v-major-with-deterministic-local-child-replacement-not-global-lexicographic';
        knotGuards: 'genuine-native-c0-refusals-probed-with-other-axis-interior-midpoint';
        discardedParentWorkCounted: true;
        exactZeroJacobianSupported: true;
        globalErrorCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        g1g2Certified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-result';
    limits: {
        maximumAxisDegree: 3;
        maximumAxisPoles: 16;
        maximumSurfacePoles: 256;
        maximumAxisKnots: 20;
        coordinateAbsMM: 10000;
        weightRange: [1e-6, 1e6];
        maximumEvaluations: 65536;
        maximumSubdivisions: 128;
        maximumDepth: 10;
        maximumInitialCells: 225;
        maximumMeasuredCells: 737;
        maximumGuardEvaluations: 128;
        maximumActualD1Evaluations: 24321;
        maximumActualD0Evaluations: 5896;
        ownedValues: 1048576;
        ownedDepth: 32;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
        optionValues: 32768;
        optionDepth: 8;
        optionArrayElements: 128;
        optionRecordFields: 16;
        optionStringCharacters: 128;
    };
}
export interface CadSurfaceAreaResult {
    reference: CadGeometryReferenceV0;
    geometry: Surface;
    source: string;
    options: CadSurfaceAreaOptions;
    areaEstimateMM2: number;
    errorEstimateMM2: number;
    cells: CadSurfaceAreaCell[];
    report: CadSurfaceAreaReport;
}
/** Native parametric metric quadrature with independently recorded local triangle plausibility. */
export declare function queryCadDocumentSurfaceArea(documentInput: CadDocumentResult, referenceInput: CadGeometryReferenceV0, optionInput: CadSurfaceAreaOptions): CadSurfaceAreaResult;
/** Re-resolve actual current source and reconstruct all metric nodes, sanity, work and trace fields. */
export declare function validateCadDocumentSurfaceArea(document: CadDocumentResult, input: CadSurfaceAreaResult): CadSurfaceAreaReport;
export {};
