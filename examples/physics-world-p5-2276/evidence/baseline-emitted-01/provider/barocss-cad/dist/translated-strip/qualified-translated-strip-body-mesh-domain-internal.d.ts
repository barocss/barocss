import type { QualifiedTranslatedStripBodyResult } from './qualified-translated-strip-body.js';
import type { QualifiedTranslatedStripBodyMeshError, QualifiedTranslatedStripBodyMeshResult } from './qualified-translated-strip-body-mesh.js';
import type { SurfaceD1Result } from '../core/derivatives.js';
import type { Point, Surface } from '../types.js';
type Face = QualifiedTranslatedStripBodyResult['faces'][number];
type Role = Face['role'];
type Key = [number, number, number];
type UV = [number, number];
type EdgePath = QualifiedTranslatedStripBodyMeshResult['edgePaths'][number];
type FaceSample = QualifiedTranslatedStripBodyMeshResult['faceSamples'][number];
export type QualifiedStripMeshFaceGrid = {
    faceId: string;
    role: Role;
    orientation: Face['orientation'];
    gridSize: [number, number];
    vertexIndices: number[];
    sampleIndices: number[];
};
export interface QualifiedStripMeshDomainCallbacks {
    fail(code: QualifiedTranslatedStripBodyMeshError['code'], detail: string, cause?: unknown): never;
    isRootError(cause: unknown): boolean;
    surfaceD0(surface: Surface, uv: UV): Point;
    surfaceD1(surface: Surface, uv: UV): SurfaceD1Result;
    resolveVertex(key: Key, faceId: string, point: Point, faceSampleIndex: number): {
        vertexIndex: number;
        anchorPoint: Point;
    };
    existingVertex(key: Key): {
        vertexIndex: number;
        anchorPoint: Point;
    } | null;
}
export type QualifiedStripMeshDomainResult = {
    faceSamples: FaceSample[];
    faceGrids: QualifiedStripMeshFaceGrid[];
};
/** Trusted only after main validates the complete Body, sources, logical keys and native Curve/Use caches. */
export declare function buildQualifiedStripMeshFaceSamplesTrusted(body: QualifiedTranslatedStripBodyResult, uStations: number[], edgePaths: EdgePath[], callbacks: QualifiedStripMeshDomainCallbacks): QualifiedStripMeshDomainResult;
export {};
