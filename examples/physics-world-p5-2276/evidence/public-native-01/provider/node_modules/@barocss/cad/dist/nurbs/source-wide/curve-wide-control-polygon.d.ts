import type { CurveControlPolygonEdits, CurvePoleEditProvenance, CurveControlPolygonD1Observation } from '../curves/curve-control-polygon.js';
import type { Curve, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const WideCurveControlPolygonEditDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type WideCurveControlPolygonEditDiagnosticCode = typeof WideCurveControlPolygonEditDiagnosticCode[keyof typeof WideCurveControlPolygonEditDiagnosticCode];
export declare class WideCurveControlPolygonEditError extends KernelError {
    readonly code: WideCurveControlPolygonEditDiagnosticCode;
    constructor(code: WideCurveControlPolygonEditDiagnosticCode, detail: string, cause?: unknown);
}
export interface WideCurveControlPolygonEditReport {
    kind: 'wide-curve-control-polygon-edit';
    dto: {
        schema: 'barocss-native-wide-curve-control-polygon-edit';
        version: 0;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'native-curve-coefficient-edit-not-topology-or-fit';
    };
    curveId: string;
    lengthUnit: 'mm';
    domain: [number, number];
    degree: number;
    controlPointCount: number;
    originalSpanCount: number;
    requestedPoleCount: number;
    requestedFieldCount: number;
    changedPoleCount: number;
    changedFieldCount: number;
    untouchedPoleCount: number;
    untouchedFieldCount: number;
    unrequestedPoleCount: number;
    unrequestedFieldCount: number;
    noOp: boolean;
    observations: {
        parameter: number;
        beforePointMM: Point;
        afterPointMM: Point;
        observedChangeMM: number;
    }[];
    maximumObservedChangeMM: number;
    derivativeObservations: CurveControlPolygonD1Observation[];
    guardedKnots: number[];
    unrepresentedMidpointIntervals: {
        domain: [number, number];
        attemptedParameter: number;
        reason: 'no-represented-interior-midpoint';
    }[];
    derivativeSemantics: 'native-c0-guards-unchanged-other-arithmetic-refuses';
    authority: 'direct-original-and-edited-curve-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    inputProfile: {
        degreeRange: [1, 3];
        poleRange: [2, 64];
        maximumKnots: 70;
        maximumNonzeroSpans: 64;
        coordinateAbsMM: 10000;
        weightRange: [1e-6, 1e6];
        positive: true;
        clamped: true;
        nonperiodic: true;
    };
    quality: {
        editSemantics: 'absolute-requested-cartesian-and-weight-replacements';
        unrequestedCoefficientBitsPreserved: true;
        idDegreeKnotDomainAndControlOrderPreserved: true;
        parameterization: 'original-degree-and-knot-domain-retained';
        sourceText: 'regenerated-from-supplied-native-curve-not-original-file-formatting';
        pointAndDerivativeEffects: 'actual-native-before-and-after-observations';
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        g1g2Certified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-result';
    limits: {
        maximumPoles: 64;
        maximumKnots: 70;
        maximumDegree: 3;
        maximumEdits: 64;
        maximumSpans: 64;
        maximumObservations: 129;
        maximumDerivativeObservations: 129;
        authoredIdCharacters: 48;
        inputValues: 32768;
        inputDepth: 8;
        inputArrayElements: 128;
        inputRecordFields: 16;
        inputStringCharacters: 128;
        snapshotValues: 524288;
        snapshotDepth: 32;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
    };
}
export interface WideCurveControlPolygonEditResult {
    original: Curve;
    edits: CurveControlPolygonEdits;
    curve: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    originalSource: string;
    originalModel: Model;
    provenance: CurvePoleEditProvenance[];
    report: WideCurveControlPolygonEditReport;
}
/** Absolute pole edits using the unchanged shared patch kernel and actual wide native geometry. */
export declare function editCurveControlPolygonWide(curveInput: Curve, editInput: CurveControlPolygonEdits): WideCurveControlPolygonEditResult;
/** Rebuild original and edited native curves, source Models, exact patches/provenance and observed effects. */
export declare function validateWideCurveControlPolygonEdit(input: WideCurveControlPolygonEditResult): WideCurveControlPolygonEditReport;
