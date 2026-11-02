import type { XYAngleArcResult } from './xy-angle-arc.js';
import { KernelError } from '../core/barocss-error.js';
export declare const XYAngleArcArtifactDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly REQUEST: "REQUEST";
    readonly SOURCE: "SOURCE";
    readonly BINDING: "BINDING";
    readonly STRUCTURE: "STRUCTURE";
    readonly ASSOCIATION: "ASSOCIATION";
    readonly OBSERVATION: "OBSERVATION";
    readonly BUDGET: "BUDGET";
    readonly OWNED: "OWNED";
    readonly CODEC: "CODEC";
    readonly VERSION: "VERSION";
}>;
type Code = typeof XYAngleArcArtifactDiagnosticCode[keyof typeof XYAngleArcArtifactDiagnosticCode];
export declare class XYAngleArcArtifactError extends KernelError {
    readonly code: Code;
    constructor(code: Code, detail: string, cause?: unknown);
}
export interface XYAngleArcArtifactFieldRule {
    path: string;
    rule: 'exact' | 'original-source-model-bit-binding' | 'bounded-association';
    unit: 'identity' | 'mm' | 'mm-per-native-parameter' | 'rad' | 'dimensionless';
    absoluteTolerance: number;
}
export interface XYAngleArcArtifactReport {
    schema: 'barocss-xy-angle-arc-artifact-verification';
    version: 0;
    curveId: string;
    lengthUnit: 'mm';
    angleUnit: 'rad';
    originalArtifactRetained: true;
    originalSourceBindingExact: true;
    numericalAssociationAccepted: true;
    provenanceAuthenticated: false;
    globalExactCircleCertified: false;
    sameRuntimeBitReplay: false;
    nativeParameterIsAngle: false;
    fieldRules: XYAngleArcArtifactFieldRule[];
    fieldCount: number;
    exactFieldCount: number;
    associatedFieldCount: number;
    originalD1EvaluatedCount: number;
    originalD1RefusalCount: number;
    directCounts: {
        requestReplayCount: 1;
        originalSourceCompilationCount: 1;
        originalCurveD0Count: number;
        originalCurveD1Attempts: number;
    };
    limits: {
        coefficientXYMM: 2e-10;
        pointXYMM: 2e-10;
        weight: 2e-13;
        analyticAngleRad: 2e-12;
        derivativeXYMMPerParameter: 2e-9;
        pointRadialResidualMM: 2e-10;
        derivativeResidualMMPerParameter: 2e-9;
        tangentResidual: 2e-12;
        originalSampleGuard: 1e-7;
        relativeTolerance: 0;
        maximumFields: 2048;
        maximumNativeQueries: 17;
        sourceUTF16: 262144;
        sourceUTF8: 262144;
        fileUTF16: 262144;
        fileUTF8: 262144;
        ownOccurrences: 131072;
        ownDepth: 32;
        arrayEntries: 2048;
        recordFields: 64;
        aggregateStringUnits: 1048576;
    };
}
export interface XYAngleArcArtifactVerification {
    artifact: XYAngleArcResult;
    report: XYAngleArcArtifactReport;
}
/** Verify a complete original artifact without replacing its source, coefficients or report. */
export declare function verifyXYAngleArcArtifact(input: XYAngleArcResult): XYAngleArcArtifactVerification;
export declare function validateXYAngleArcArtifactVerification(input: XYAngleArcArtifactVerification): XYAngleArcArtifactReport;
export declare function serializeXYAngleArcArtifact(input: XYAngleArcResult): string;
export declare function parseXYAngleArcArtifact(text: string): XYAngleArcArtifactVerification;
export {};
