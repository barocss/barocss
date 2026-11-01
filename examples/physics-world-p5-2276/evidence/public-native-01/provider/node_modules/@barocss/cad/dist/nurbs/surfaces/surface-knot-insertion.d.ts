import type { CurveKnotInsertionProvenance } from '../curves/curve-knot-insertion.js';
import type { Surface, Model, Point } from '../../types.js';
export interface SurfaceKnotInsertionOptions {
    axis: 'u' | 'v';
    knot: number;
    insertions: number;
}
export interface SurfaceKnotUnchangedPole {
    originalUIndex: number;
    originalVIndex: number;
    refinedUIndex: number;
    refinedVIndex: number;
}
export interface SurfaceKnotInsertionStrip {
    fixedPoleIndex: number;
    curve: CurveKnotInsertionProvenance;
}
export interface SurfaceKnotInsertionProvenance {
    kind: 'strip-curve-surface-knot-insertion';
    surfaceId: string;
    axis: 'u' | 'v';
    unchangedPoles: SurfaceKnotUnchangedPole[];
    unchangedKnots: {
        originalKnotIndex: number;
        refinedKnotIndex: number;
    }[];
    strips: SurfaceKnotInsertionStrip[];
}
export interface SurfaceKnotGridCount {
    u: number;
    v: number;
    total: number;
}
export interface SurfaceKnotInsertionReport {
    kind: 'surface-knot-insertion';
    surfaceId: string;
    lengthUnit: 'mm';
    axis: 'u' | 'v';
    knot: number;
    insertions: number;
    domain: {
        u: [number, number];
        v: [number, number];
    };
    degrees: {
        u: number;
        v: number;
    };
    originalGrid: SurfaceKnotGridCount;
    refinedGrid: SurfaceKnotGridCount;
    stripCount: number;
    originalMultiplicity: number;
    refinedMultiplicity: number;
    unchangedPoleCount: number;
    generatedPoleCount: number;
    observations: {
        u: number;
        v: number;
        originalPointMM: Point;
        refinedPointMM: Point;
        differenceMM: number;
    }[];
    maximumObservedDifferenceMM: number;
    guardedKnots: {
        original: {
            u: number[];
            v: number[];
        };
        refined: {
            u: number[];
            v: number[];
        };
    };
    authority: 'direct-surface-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumGridAxis: 16;
        maximumPoles: 256;
        maximumDegree: 3;
        maximumInsertions: 3;
        authoredIdCharacters: 48;
        snapshotValues: 4096;
        snapshotDepth: 8;
        arrayElements: 64;
        recordFields: 8;
        stringCharacters: 128;
        maximumObservations: 128;
        observationComparisonMM: 1e-7;
    };
}
export interface SurfaceKnotInsertionResult {
    original: Surface;
    refined: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: SurfaceKnotInsertionProvenance;
    report: SurfaceKnotInsertionReport;
}
/** Refine one original Surface axis through the existing rational Curve insertion API. */
export declare function insertSurfaceKnot(input: Surface, options: SurfaceKnotInsertionOptions): SurfaceKnotInsertionResult;
