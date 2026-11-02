import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionRational, SectionFraction } from './section-rational-internal.js';
import type { ConvexPlanarFaceResult } from './own-convex-planar-face.js';
import type { Point } from './types.js';
import { KernelError } from './core/barocss-error.js';
export declare const ConvexPlanarSolidDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
    readonly COVERAGE: "COVERAGE";
    readonly BINDING: "BINDING";
    readonly INCIDENCE: "INCIDENCE";
    readonly CONVEXITY: "CONVEXITY";
    readonly DEGENERATE: "DEGENERATE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
}>;
export type ConvexPlanarSolidDiagnosticCode = typeof ConvexPlanarSolidDiagnosticCode[keyof typeof ConvexPlanarSolidDiagnosticCode];
export declare class ConvexPlanarSolidError extends KernelError {
    readonly code: ConvexPlanarSolidDiagnosticCode;
    constructor(code: ConvexPlanarSolidDiagnosticCode, detail: string, cause?: unknown);
}
export declare function check(condition: boolean, code: ConvexPlanarSolidDiagnosticCode, detail: string): asserts condition;
export declare function record(value: unknown, fields: string[]): Record<string, unknown>;
export declare function id(value: unknown, maximum?: number): string;
export declare function same(a: unknown, b: unknown): boolean;
/** Every snapshot charges occurrences, including aliases. Bytes describe JSON data, never heap size. */
export declare class SolidSnapshotLedger {
    bytes: number;
    retainedBytes: number;
    copy<T>(input: T, retained?: boolean, inspectOnly?: boolean): T;
}
export type ExactPoint = [SectionRational, SectionRational, SectionRational];
export type ExactPointData = [SectionFraction, SectionFraction, SectionFraction];
export declare class SolidProof {
    readonly rational: SectionRationalContext;
    supportPredicates: number;
    coefficientProofs: number;
    fanTriangles: number;
    queryPredicates: number;
    /** Pcurve poles accepted under CadNumericPolicy.chartParameters (not exact, within one rounding). */
    certifiedLifts: number;
    maximumLiftDeviationMM: number;
    point(p: Point): ExactPoint;
    add(a: ExactPoint, b: ExactPoint): ExactPoint;
    sub(a: ExactPoint, b: ExactPoint): ExactPoint;
    scale(a: ExactPoint, s: SectionRational): ExactPoint;
    cross(a: ExactPoint, b: ExactPoint): ExactPoint;
    dot(a: ExactPoint, b: ExactPoint): SectionRational;
    equal(a: ExactPoint, b: ExactPoint): boolean;
    text(a: ExactPoint): ExactPointData;
    plane(face: ConvexPlanarFaceResult): {
        origin: ExactPoint;
        normal: ExactPoint;
        vertices: ExactPoint[];
    };
}
