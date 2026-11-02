import type { XYArcResult } from '../xy-arc.js';
import type { XYPoint } from './xy-profile.js';
import type { Point } from '../types.js';
export interface XYArcSketchRadius {
    id: string;
    valueMM: number;
}
export type XYArcSketchProfileIntent = {
    id: string;
    kind: 'circle';
    centerId: string;
    centerMM: XYPoint;
    radius: XYArcSketchRadius;
    seamId: string;
} | {
    id: string;
    kind: 'quarter-arc';
    centerId: string;
    centerMM: XYPoint;
    radius: XYArcSketchRadius;
    quadrant: 0 | 1 | 2 | 3;
    endpointIds: [string, string];
};
export interface XYArcSketchDocumentV0 {
    format: 'barocss-xy-arc-sketch';
    version: 0;
    id: string;
    lengthUnit: 'mm';
    workplane: 'xy';
    profiles: XYArcSketchProfileIntent[];
}
export type XYArcSketchDocumentEdit = {
    kind: 'upsert';
    profile: XYArcSketchProfileIntent;
} | {
    kind: 'remove';
    profileId: string;
};
export interface XYArcSketchCurvePointBinding {
    pointId: string;
    curveId: string;
    poleIndex: number;
    parameter: number;
    role: 'start' | 'end' | 'seam';
}
export interface XYArcSketchBindings {
    curveId: string;
    nativeDomain: [number, number];
    center: {
        pointId: string;
        pointMM: Point;
        role: 'center';
    };
    radius: {
        parameterId: string;
        valueMM: number;
    };
    curvePoints: XYArcSketchCurvePointBinding[];
}
export interface XYArcSketchEvaluatedProfile {
    profileId: string;
    evaluation: XYArcResult;
    bindings: XYArcSketchBindings;
}
export interface XYArcSketchDocumentReport {
    kind: 'xy-arc-sketch-document-evaluation';
    formatVersion: 0;
    documentId: string;
    workplane: 'xy';
    profileCount: number;
    profileIds: string[];
    profileStates: {
        profileId: string;
        endpointClosed: boolean;
        periodic: false;
        nativeDomain: [number, number];
    }[];
    limits: {
        authoredIdCharacters: 64;
        maximumProfiles: 8;
        maximumEdits: 8;
        snapshotValues: 4096;
        snapshotDepth: 8;
        arrayElements: 64;
        recordFields: 12;
        stringCharacters: 128;
        maximumJSONBytes: 131072;
    };
    periodic: false;
    regionCertified: false;
    face: false;
    solid: false;
}
export interface XYArcSketchDocumentResult {
    document: XYArcSketchDocumentV0;
    profiles: XYArcSketchEvaluatedProfile[];
    report: XYArcSketchDocumentReport;
}
export declare function evaluateXYArcSketchDocument(document: XYArcSketchDocumentV0): XYArcSketchDocumentResult;
export declare function updateXYArcSketchDocument(document: XYArcSketchDocumentV0, edits: XYArcSketchDocumentEdit[]): XYArcSketchDocumentResult;
export declare function serializeXYArcSketchDocument(document: XYArcSketchDocumentV0): string;
export declare function parseXYArcSketchDocument(text: string): XYArcSketchDocumentV0;
