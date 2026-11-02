import { KernelError } from '../../core/barocss-error.js';
import { CadNumericPolicy } from '../../numeric-policy.js';
import { SectionRationalContext } from '../../section-rational-internal.js';
import type { Surface } from '../../types.js';
import type { ReversedSurfaceAxisResult, SurfaceAxisReversalOptions } from './surface-axis-reversal.js';
export declare const TrimmedSurfaceAxisReversalDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly SUPPORT: "SUPPORT";
    readonly DOMAIN: "DOMAIN";
    readonly TOPOLOGY: "TOPOLOGY";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly BINDING: "BINDING";
}>;
export type TrimmedSurfaceAxisReversalDiagnosticCode = typeof TrimmedSurfaceAxisReversalDiagnosticCode[keyof typeof TrimmedSurfaceAxisReversalDiagnosticCode];
export declare class TrimmedSurfaceAxisReversalError extends KernelError {
    readonly code: TrimmedSurfaceAxisReversalDiagnosticCode;
    constructor(code: TrimmedSurfaceAxisReversalDiagnosticCode, detail: string, cause?: unknown);
}
export interface SurfaceAxisTrimLoop {
    readonly keep: 'inside' | 'outside';
    readonly uv: readonly (readonly [number, number])[];
}
export interface OwnedSurfaceAxisTrimLoop {
    keep: 'inside' | 'outside';
    uv: [number, number][];
}
type RationalWork = ReturnType<SectionRationalContext['counts']>;
export interface TrimmedSurfaceAxisTransportReport {
    family: 'affine-plane-single-stored-trim-loop-axis-reversal';
    chartPolicy: typeof CadNumericPolicy.chartParameters;
    axis: 'u' | 'v';
    pointCount: number;
    bindingCount: number;
    roundedPointCount: number;
    originalWinding: 'cw' | 'ccw';
    reversedWinding: 'cw' | 'ccw';
    maximumChartRounding: number;
    maximumWorldRoundingBound: number;
    maximumPointDifference: number;
    quality: {
        linearComparison: 1e-7;
        uvComparison: 1e-7;
        segmentBound: 'affine-endpoint-displacement';
        keepPreserved: true;
        pointOrderPreserved: true;
        nonselectedCoordinateBitsPreserved: true;
        doubleReversalBitsCertified: false;
        solidMass: 'not-applicable';
    };
    work: {
        orientationTests: number;
        edgePairTests: number;
        vertexPairTests: number;
        inputTopology: RationalWork;
        outputTopology: RationalWork;
        transport: RationalWork;
    };
    limits: {
        maximumLoops: 1;
        maximumPoints: 160;
        maximumBindings: 160;
        maximumOrientationTests: 102400;
        maximumEdgePairTests: 25120;
        maximumVertexPairTests: 25440;
        rationalOperationsPerContext: 200000;
        rationalIntegerBits: 8192;
    };
}
export interface ReversedTrimmedSurfaceAxisResult extends ReversedSurfaceAxisResult {
    trimLoops: OwnedSurfaceAxisTrimLoop[];
    trimTransport: TrimmedSurfaceAxisTransportReport;
}
/** Reverse the native support once and transport one simple stored polyline. This does not construct a B-rep face or a solid. */
export declare function reverseTrimmedSurfaceAxis(surfaceInput: Surface, trimLoopsInput: readonly SurfaceAxisTrimLoop[], inputOptions: SurfaceAxisReversalOptions): ReversedTrimmedSurfaceAxisResult;
export {};
