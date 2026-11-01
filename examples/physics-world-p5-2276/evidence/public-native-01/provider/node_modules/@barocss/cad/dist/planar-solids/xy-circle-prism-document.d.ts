import type { XYArcSketchDocumentV0, XYArcSketchDocumentResult } from '../sketch/xy-arc-sketch-document.js';
import type { XYCirclePrismShellResult, XYCirclePrismShellReport } from '../xy-circle-prism-shell.js';
import type { XYPoint } from '../sketch/xy-profile.js';
import type { Point } from '../types.js';
export interface XYCirclePrismDocumentV0 {
    format: 'barocss-xy-circle-prism-feature';
    version: 0;
    id: string;
    lengthUnit: 'mm';
    sketch: XYArcSketchDocumentV0;
    feature: {
        id: string;
        kind: 'xy-circle-extrude';
        profileId: string;
        shellId: string;
        height: {
            id: string;
            valueMM: number;
        };
    };
}
export interface XYCirclePrismDocumentPatch {
    centreMM?: XYPoint;
    radiusMM?: number;
    heightMM?: number;
}
export interface XYCirclePrismDocumentReport {
    kind: 'xy-circle-prism-document-evaluation';
    formatVersion: 0;
    documentId: string;
    bindings: {
        documentId: string;
        sketchId: string;
        featureId: string;
        profileId: string;
        shellId: string;
        centerId: string;
        radiusId: string;
        seamId: string;
        heightId: string;
        centerMM: XYPoint;
        radiusMM: number;
        heightMM: number;
        sourceCurveId: string;
    };
    native: XYCirclePrismShellReport;
    boundsMM: {
        min: Point;
        max: Point;
    };
    domains: XYCirclePrismShellReport['domains'];
    referenceVolumeMM3: number;
    candidateClosedShell: true;
    periodic: false;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        authoredIdCharacters: 64;
        profileShellIdCharacters: 48;
        snapshotValues: 4096;
        snapshotDepth: 10;
        arrayElements: 64;
        recordFields: 12;
        stringCharacters: 128;
        maximumJSONBytes: 131072;
    };
}
export interface XYCirclePrismDocumentResult {
    document: XYCirclePrismDocumentV0;
    sketchEvaluation: XYArcSketchDocumentResult;
    shell: XYCirclePrismShellResult;
    report: XYCirclePrismDocumentReport;
}
export declare function evaluateXYCirclePrismDocument(document: XYCirclePrismDocumentV0): XYCirclePrismDocumentResult;
export declare function updateXYCirclePrismDocument(document: XYCirclePrismDocumentV0, patch: XYCirclePrismDocumentPatch): XYCirclePrismDocumentResult;
export declare function serializeXYCirclePrismDocument(document: XYCirclePrismDocumentV0): string;
export declare function parseXYCirclePrismDocument(text: string): XYCirclePrismDocumentV0;
