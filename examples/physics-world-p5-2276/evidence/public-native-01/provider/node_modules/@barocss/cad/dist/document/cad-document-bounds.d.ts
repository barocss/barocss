import type { CadGeometryReferenceV0 } from './cad-document-reference.js';
import type { CadDocumentResult } from '../cad-document.js';
import type { Curve, Surface, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const CadDocumentBoundsDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly REFERENCE: "REFERENCE";
    readonly STALE: "STALE";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CadDocumentBoundsDiagnosticCode = typeof CadDocumentBoundsDiagnosticCode[keyof typeof CadDocumentBoundsDiagnosticCode];
export declare class CadDocumentBoundsError extends KernelError {
    readonly code: CadDocumentBoundsDiagnosticCode;
    constructor(code: CadDocumentBoundsDiagnosticCode, detail: string, cause?: unknown);
}
interface BoundExtremum {
    axis: 0 | 1 | 2;
    side: 'min' | 'max';
    valueMM: number;
    poleIndex: number | null;
    uIndex: number | null;
    vIndex: number | null;
    pointMM: Point;
}
export interface CadDocumentBoundsReport {
    schema: 'barocss-cad-document-bounds';
    version: 0;
    reference: CadGeometryReferenceV0;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    geometryAuthority: 'original-native-control-hull';
    geometryKind: 'curve' | 'surface';
    selectedGeometryCount: 1;
    controlPoleCount: number;
    domains: {
        curve: [number, number];
        surface: null;
    } | {
        curve: null;
        surface: {
            u: [number, number];
            v: [number, number];
        };
    };
    quality: {
        boundsSemantics: 'conservative-control-hull-not-tight-geometry-extrema';
        containment: 'positive-rational-convex-hull-in-exact-arithmetic';
        witnessSemantics: 'first-object-is-coefficient-in-curve-or-row-major-order';
        zeroTies: 'negative-zero-min-positive-zero-max-when-both-present';
        derivedCentre: 'box-centre-not-centre-of-mass';
        globalBinary64ContainmentCertified: false;
        manufacturingToleranceCertified: false;
        topologyNamingCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumCurvePoles: 64;
        maximumSurfaceAxisPoles: 16;
        maximumSurfacePoles: 256;
        maximumDegree: 5;
        ownedValues: 262144;
        ownedDepth: 32;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
    };
}
export interface CadDocumentBoundsResult {
    reference: CadGeometryReferenceV0;
    geometry: Curve | Surface;
    source: string;
    boundsMM: {
        min: Point;
        max: Point;
    };
    extentMM: Point;
    boxCenterMM: Point;
    extrema: BoundExtremum[];
    report: CadDocumentBoundsReport;
}
/** Conservative positive native control-hull box at one exact document reference. */
export declare function queryCadDocumentBounds(document: CadDocumentResult, reference: CadGeometryReferenceV0): CadDocumentBoundsResult;
/** Re-resolve the supplied current document and rebuild every owned field. */
export declare function validateCadDocumentBounds(document: CadDocumentResult, input: CadDocumentBoundsResult): CadDocumentBoundsReport;
export {};
