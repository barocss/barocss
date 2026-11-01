import type { Curve, Surface, Model, Point } from '../../types.js';
export interface CompatibleRuledSurfaceOptions {
    surfaceId: string;
}
export interface CompatibleRuledSurfaceConstruction {
    kind: 'compatible-two-curve-ruled';
    firstCurveId: string;
    secondCurveId: string;
    surfaceId: string;
    lengthUnit: 'mm';
    uRole: 'common-section-parameter';
    vRole: 'section-interpolation';
    rows: {
        surfaceRowIndex: number;
        firstCurveId: string;
        firstPoleIndex: number;
        firstColumn: 0;
        secondCurveId: string;
        secondPoleIndex: number;
        secondColumn: 1;
    }[];
}
export interface CompatibleRuledSurfaceObservation {
    u: number;
    v: number;
    firstPointMM: Point;
    secondPointMM: Point;
    expectedPointMM: Point;
    actualPointMM: Point;
    differenceMM: number;
}
export interface CompatibleRuledSurfaceReport {
    kind: 'compatible-ruled-surface';
    firstCurveId: string;
    secondCurveId: string;
    surfaceId: string;
    lengthUnit: 'mm';
    domains: {
        first: [number, number];
        second: [number, number];
        surface: {
            u: [number, number];
            v: [number, number];
        };
    };
    degrees: {
        u: number;
        v: 1;
    };
    controlPointCounts: {
        u: number;
        v: 2;
        total: number;
    };
    observations: CompatibleRuledSurfaceObservation[];
    maximumObservedDifferenceMM: number;
    guardedUKnots: number[];
    identicalSectionPoleCoefficients: boolean;
    parameterBoundarySemantics: 'original-extractSurfaceBoundary-convention';
    periodic: false;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumSectionPoles: 16;
        maximumSectionDegree: 3;
        authoredIdCharacters: 48;
        snapshotValues: 1024;
        snapshotDepth: 6;
        arrayElements: 64;
        recordFields: 8;
        stringCharacters: 128;
        observationComparisonMM: 1e-7;
    };
}
export interface CompatibleRuledSurfaceResult {
    first: Curve;
    second: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    surface: Surface;
    construction: CompatibleRuledSurfaceConstruction;
    report: CompatibleRuledSurfaceReport;
}
/** Two original compatible section bases, no resampling or compatibility repair. */
export declare function buildCompatibleRuledSurface(firstInput: Curve, secondInput: Curve, options: CompatibleRuledSurfaceOptions): CompatibleRuledSurfaceResult;
