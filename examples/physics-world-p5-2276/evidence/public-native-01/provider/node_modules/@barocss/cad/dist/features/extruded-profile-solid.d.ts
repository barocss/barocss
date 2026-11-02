import type { Curve, Point, Surface } from '../types.js';
import { type KernelError } from '../core/barocss-error.js';
export declare const ExtrudedProfileDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly BUDGET: "BUDGET";
    readonly GEOMETRY: "GEOMETRY";
    readonly TOPOLOGY: "TOPOLOGY";
    readonly SELF_INTERSECTION: "SELF_INTERSECTION";
}>;
export type ExtrudedProfileDiagnosticCode = typeof ExtrudedProfileDiagnosticCode[keyof typeof ExtrudedProfileDiagnosticCode];
/** This module's refusal (R7.3a batch 2: the ExtrudedProfileError class folded, D279): a BarocssError, `details.source` 'extruded-profile'. */
export declare const extrudedProfileError: (code: ExtrudedProfileDiagnosticCode, detail: string, cause?: unknown) => KernelError & {
    readonly code: ExtrudedProfileDiagnosticCode;
};
/** Whether something thrown is this module's refusal. */
export declare const isExtrudedProfileError: (e: unknown) => e is KernelError & {
    readonly code: ExtrudedProfileDiagnosticCode;
};
export type XY = [number, number];
/** One loop segment runs from its `start` to the next segment's `start` (the loop closes). */
export type ProfileSegmentInput = {
    readonly kind: 'line';
    readonly start: XY;
} | {
    readonly kind: 'arc';
    readonly start: XY;
    readonly center: XY;
    readonly direction: 'ccw' | 'cw';
};
export type ProfileSegment = {
    readonly kind: 'line';
    readonly start: XY;
    readonly end: XY;
    readonly length: number;
} | {
    readonly kind: 'arc';
    readonly start: XY;
    readonly end: XY;
    readonly center: XY;
    readonly radius: number;
    readonly startAngle: number;
    readonly sweep: number;
    readonly length: number;
};
export interface ProfileLoop {
    readonly kind: 'extruded-profile-loop';
    readonly version: 0;
    readonly segments: readonly ProfileSegment[];
    /** True when the authored order was clockwise and was reversed to counter-clockwise. */
    readonly reversed: boolean;
    readonly area: number;
    readonly centroid: XY;
    readonly perimeter: number;
    /** Second moments of area about the centroid: [∫(x−x̄)², ∫(y−ȳ)², ∫(x−x̄)(y−ȳ)] in mm⁴. */
    readonly secondMomentsMM4: readonly [number, number, number];
    readonly bounds: {
        readonly min: XY;
        readonly max: XY;
    };
}
export interface ExtrudedProfileVertex {
    readonly id: string;
    readonly point: Point;
}
export interface ExtrudedProfileEdge {
    readonly id: string;
    readonly vertexIds: readonly [string, string];
    readonly curve: Curve;
    readonly role: 'bottom' | 'top' | 'vertical';
    readonly segment: number;
}
export interface ExtrudedProfileEdgeUse {
    readonly edgeId: string;
    readonly sense: 'forward' | 'reversed';
}
export interface ExtrudedProfileFace {
    readonly id: string;
    readonly role: 'bottom' | 'top' | 'side';
    readonly segment: number | null;
    readonly kind: 'plane' | 'cylinder';
    readonly surface: Surface;
    readonly outwardNormal: Point | null;
    readonly loop: readonly ExtrudedProfileEdgeUse[];
}
export interface ExtrudedProfileSolidResult {
    readonly kind: 'extruded-profile-solid';
    readonly version: 0;
    readonly id: string;
    readonly lengthUnit: 'mm';
    readonly profile: ProfileLoop;
    readonly from: number;
    readonly height: number;
    readonly vertices: readonly ExtrudedProfileVertex[];
    readonly edges: readonly ExtrudedProfileEdge[];
    readonly faces: readonly ExtrudedProfileFace[];
    readonly report: {
        readonly valid: true;
        readonly eulerCharacteristic: number;
        readonly faceCount: number;
        readonly edgeCount: number;
        readonly vertexCount: number;
        readonly volume: number;
        readonly surfaceArea: number;
        readonly bounds: {
            readonly min: Point;
            readonly max: Point;
        };
        readonly maxCurveDeviation: number;
        readonly tolerance: number;
    };
}
export declare const ExtrudedProfileLimits: Readonly<{
    segments: 64;
    coordinateMM: 10000;
    minimumRadiusMM: 0.01;
    minimumLengthMM: 0.0001;
    tolerance: 1e-7;
}>;
/** Admits and normalises a loop: closed, simple, counter-clockwise. */
/** `maximumSegments` lets B-rep builders (no fixed caps) raise the stored-solid budget of 64. */
export declare function buildProfileLoop(input: readonly ProfileSegmentInput[], options?: {
    readonly maximumSegments?: number;
}): ProfileLoop;
/** Exact rational quadratic NURBS for an arc, spans ≤ 90°; degree-1 for a line. */
export declare function segmentCurve(s: ProfileSegment, z: number, id: string): Curve;
export declare function extrudedSurface(curve: Curve, z0: number, z1: number, id: string): Surface;
export declare function capSurface(bounds: {
    min: XY;
    max: XY;
}, z: number, id: string, up: boolean): Surface;
export interface ExtrudedProfileSolidOptions {
    readonly id: string;
    readonly height: number;
    readonly from?: number;
}
export declare function buildExtrudedProfileSolid(profile: ProfileLoop, options: ExtrudedProfileSolidOptions): ExtrudedProfileSolidResult;
export interface ExtrudedProfileMass {
    readonly volume: number;
    readonly mass: number;
    readonly centroid: Point;
    /** Inertia tensor about the centroid in kg·m², products of inertia stored as −∫xy dm. */
    readonly inertiaCentroid: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
}
export declare function measureExtrudedProfileSolid(solid: ExtrudedProfileSolidResult, options: {
    readonly density: number;
}): ExtrudedProfileMass;
export interface ExtrudedProfileMeshFace {
    readonly faceId: string;
    readonly role: ExtrudedProfileFace['role'];
    readonly kind: ExtrudedProfileFace['kind'];
    readonly vertexOffset: number;
    readonly vertexCount: number;
    readonly indexOffset: number;
    readonly indexCount: number;
}
export interface ExtrudedProfileMesh {
    readonly positions: Float64Array;
    readonly normals: Float64Array;
    readonly indices: Uint32Array;
    readonly faces: readonly ExtrudedProfileMeshFace[];
}
/** Watertight triangle mesh: caps and side strips share the same boundary samples. */
export declare function tessellateExtrudedProfileSolid(solid: ExtrudedProfileSolidResult, options?: {
    readonly segmentsPerQuarter?: number;
}): ExtrudedProfileMesh;
/** Binary STL (little-endian) from the watertight tessellation. */
export declare function exportExtrudedProfileSolidStl(solid: ExtrudedProfileSolidResult, options?: {
    readonly segmentsPerQuarter?: number;
}): Uint8Array;
