import type { Surface, Model, Point } from '../../types.js';
export type SurfacePoleField = 'xMM' | 'yMM' | 'zMM' | 'weight';
export interface SurfacePoleEdit {
    uIndex: number;
    vIndex: number;
    xMM?: number;
    yMM?: number;
    zMM?: number;
    weight?: number;
}
export interface SurfaceControlNetEdits {
    poleEdits: SurfacePoleEdit[];
}
export interface SurfacePoleEditProvenance {
    uIndex: number;
    vIndex: number;
    requestedFields: SurfacePoleField[];
    changedFields: SurfacePoleField[];
    before: {
        pointMM: Point;
        weight: number;
    };
    after: {
        pointMM: Point;
        weight: number;
    };
}
export interface SurfaceControlNetReport {
    kind: 'surface-control-net-edit';
    surfaceId: string;
    lengthUnit: 'mm';
    domain: {
        u: [number, number];
        v: [number, number];
    };
    degrees: {
        u: number;
        v: number;
    };
    controlPointCounts: {
        u: number;
        v: number;
        total: number;
    };
    requestedPoleCount: number;
    changedPoleCount: number;
    changedFieldCount: number;
    untouchedPoleCount: number;
    untouchedFieldCount: number;
    observations: {
        u: number;
        v: number;
        beforePointMM: Point;
        afterPointMM: Point;
        observedChangeMM: number;
    }[];
    maximumObservedChangeMM: number;
    authority: 'direct-surface-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumGridAxis: 16;
        maximumPoles: 256;
        maximumDegree: 3;
        maximumEdits: 16;
        authoredIdCharacters: 48;
        snapshotValues: 4096;
        snapshotDepth: 8;
        arrayElements: 64;
        recordFields: 8;
        stringCharacters: 128;
    };
}
export interface SurfaceControlNetResult {
    original: Surface;
    surface: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: SurfacePoleEditProvenance[];
    report: SurfaceControlNetReport;
}
/** Atomic coefficient editing of a directly authored original rational Surface. */
export declare function editSurfaceControlNet(input: Surface, edits: SurfaceControlNetEdits): SurfaceControlNetResult;
