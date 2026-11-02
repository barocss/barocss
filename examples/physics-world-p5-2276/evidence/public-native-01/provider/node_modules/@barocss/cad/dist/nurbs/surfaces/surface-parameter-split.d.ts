import type { SurfaceKnotInsertionProvenance, SurfaceKnotUnchangedPole, SurfaceKnotGridCount } from './surface-knot-insertion.js';
import type { Surface, Model, Point } from '../../types.js';
export interface SurfaceParameterSplitOptions {
    axis: 'u' | 'v';
    parameter: number;
    lowerSurfaceId: string;
    upperSurfaceId: string;
}
export interface SurfaceSplitPoleMapping {
    refinedUIndex: number;
    refinedVIndex: number;
    childUIndex: number;
    childVIndex: number;
}
export interface SurfaceSplitKnotMapping {
    childKnotIndex: number;
    refinedKnotIndex: number | null;
    value: number;
    origin: 'refined-copy' | 'requested-clamp';
}
export interface SurfaceSplitChildProvenance {
    side: 'lower' | 'upper';
    surfaceId: string;
    poleMappings: SurfaceSplitPoleMapping[];
    selectedKnots: SurfaceSplitKnotMapping[];
    nonselectedKnots: SurfaceSplitKnotMapping[];
}
export interface SurfaceSplitRefinementProvenance {
    kind: 'knot-insertion' | 'direct-copy';
    insertions: number;
    operation: SurfaceKnotInsertionProvenance | null;
    unchangedPoles: SurfaceKnotUnchangedPole[];
    unchangedKnots: {
        originalKnotIndex: number;
        refinedKnotIndex: number;
    }[];
}
export interface SurfaceSplitSharedCoefficients {
    refinedAxisPoleIndex: number;
    lowerAxisPoleIndex: number;
    upperAxisPoleIndex: number;
    coefficients: {
        varyingPoleIndex: number;
        point: Point;
        weight: number;
    }[];
    lowerBoundary: 'u-max' | 'v-max';
    upperBoundary: 'u-min' | 'v-min';
    lowerDirection: 'increasing' | 'decreasing';
    upperDirection: 'increasing' | 'decreasing';
}
export interface SurfaceParameterSplitProvenance {
    kind: 'surface-parameter-split';
    sourceSurfaceId: string;
    axis: 'u' | 'v';
    parameter: number;
    firstRefinedKnotIndex: number;
    refinement: SurfaceSplitRefinementProvenance;
    lower: SurfaceSplitChildProvenance;
    upper: SurfaceSplitChildProvenance;
    shared: SurfaceSplitSharedCoefficients;
}
export interface SurfaceParameterSplitReport {
    kind: 'surface-parameter-split';
    surfaceId: string;
    lengthUnit: 'mm';
    axis: 'u' | 'v';
    parameter: number;
    selectedDegree: number;
    originalMultiplicity: number;
    requiredInsertions: number;
    refinedMultiplicity: number;
    grids: {
        original: SurfaceKnotGridCount;
        refined: SurfaceKnotGridCount;
        lower: SurfaceKnotGridCount;
        upper: SurfaceKnotGridCount;
    };
    domains: {
        original: SurfaceDomain;
        refined: SurfaceDomain;
        lower: SurfaceDomain;
        upper: SurfaceDomain;
    };
    cutEndpoints: {
        requested: number;
        lower: number;
        upper: number;
        negativeZero: {
            requested: boolean;
            lower: boolean;
            upper: boolean;
        };
    };
    selectedAxisKnotGuards: {
        original: boolean;
        refined: boolean;
        lowerEndpoint: boolean;
        upperEndpoint: boolean;
    };
    derivativeSemantics: 'native-guards-unchanged';
    shared: SurfaceSplitSharedCoefficients;
    observations: {
        side: 'lower' | 'upper';
        surfaceId: string;
        u: number;
        v: number;
        originalPoint: Point;
        childPoint: Point;
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
        maximumObservations: 128;
        observationComparison: 1e-7;
    };
}
type SurfaceDomain = {
    u: [number, number];
    v: [number, number];
};
export interface SurfaceParameterSplitResult {
    original: Surface;
    refined: Surface;
    lower: Surface;
    upper: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: SurfaceParameterSplitProvenance;
    report: SurfaceParameterSplitReport;
}
/** Two increasing-parameter native patches, split through existing Surface refinement. */
export declare function splitSurfaceAtParameter(input: Surface, options: SurfaceParameterSplitOptions): SurfaceParameterSplitResult;
export {};
