import type { Surface, Curve, Model, Point } from '../../types.js';
export interface SurfaceIsoCurveOptions {
    fixedAxis: 'u' | 'v';
    parameter: number;
    curveId: string;
}
export interface SurfaceIsoCurveBasis {
    start: number;
    poleIndices: number[];
    values: number[];
}
export interface SurfaceIsoCurveContribution {
    sourceUIndex: number;
    sourceVIndex: number;
    basisValue: number;
    factor: number;
    weightedPoint: Point;
}
export interface SurfaceIsoCurvePole {
    curvePoleIndex: number;
    construction: 'endpoint-direct-copy' | 'homogeneous-contraction';
    endpointSourcePole: {
        uIndex: number;
        vIndex: number;
    } | null;
    homogeneous: [number, number, number, number];
    point: Point;
    weight: number;
    contributions: SurfaceIsoCurveContribution[];
}
export interface SurfaceIsoCurveProvenance {
    kind: 'surface-parameter-isocurve';
    sourceSurfaceId: string;
    curveId: string;
    fixedAxis: 'u' | 'v';
    varyingAxis: 'u' | 'v';
    parameter: number;
    fixedDomain: [number, number];
    varyingDomain: [number, number];
    endpoint: 'min' | 'max' | null;
    basis: SurfaceIsoCurveBasis;
    poles: SurfaceIsoCurvePole[];
}
export interface SurfaceIsoCurveReport {
    kind: 'surface-isocurve';
    surfaceId: string;
    curveId: string;
    lengthUnit: 'mm';
    fixedAxis: 'u' | 'v';
    varyingAxis: 'u' | 'v';
    parameter: number;
    fixedDomain: [number, number];
    varying: {
        degree: number;
        knots: number[];
        domain: [number, number];
        controlPointCount: number;
    };
    endpointDirectCopy: boolean;
    basis: SurfaceIsoCurveBasis;
    construction: SurfaceIsoCurvePole[];
    guardedFixedParameter: boolean;
    guardedVaryingKnots: number[];
    derivativeSemantics: 'native-guards-unchanged';
    observations: {
        varyingParameter: number;
        u: number;
        v: number;
        surfacePoint: Point;
        curvePoint: Point;
        difference: number;
    }[];
    maximumObservedDifference: number;
    authority: 'original-surface-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumGridAxis: 16;
        maximumPoles: 256;
        maximumDegree: 3;
        authoredIdCharacters: 48;
        snapshotValues: 4096;
        snapshotDepth: 8;
        arrayElements: 64;
        recordFields: 8;
        stringCharacters: 128;
        maximumObservations: 32;
        observationComparison: 1e-7;
    };
}
export interface SurfaceIsoCurveResult {
    original: Surface;
    curve: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: SurfaceIsoCurveProvenance;
    report: SurfaceIsoCurveReport;
}
/** Native increasing-parameter Curve from an original rational Surface at fixed U or V. */
export declare function extractSurfaceIsoCurve(input: Surface, options: SurfaceIsoCurveOptions): SurfaceIsoCurveResult;
