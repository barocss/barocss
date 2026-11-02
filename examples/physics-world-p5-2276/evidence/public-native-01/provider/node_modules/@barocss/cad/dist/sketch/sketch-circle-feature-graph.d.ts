import type { XYArcSketchDocumentV0, XYArcSketchDocumentEdit, XYArcSketchDocumentResult, XYArcSketchBindings } from './xy-arc-sketch-document.js';
import type { XYCirclePrismDocumentResult, XYCirclePrismDocumentReport } from '../planar-solids/xy-circle-prism-document.js';
import type { XYCirclePrismShellReport } from '../xy-circle-prism-shell.js';
export type SketchCircleLengthDefinition = {
    kind: 'literal';
    valueMM: number;
} | {
    kind: 'offset';
    parameterId: string;
    offsetMM: number;
};
export interface SketchCircleLengthParameter {
    id: string;
    type: 'length';
    definition: SketchCircleLengthDefinition;
}
export interface SketchCircleGraphFeature {
    id: string;
    kind: 'xy-circle-extrude';
    profileId: string;
    shellId: string;
    distanceParameterId: string;
    suppressed: boolean;
}
export interface SketchCircleFeatureGraphV0 {
    format: 'barocss-sketch-circle-feature-graph';
    version: 0;
    id: string;
    lengthUnit: 'mm';
    sketch: XYArcSketchDocumentV0;
    parameters: SketchCircleLengthParameter[];
    features: SketchCircleGraphFeature[];
}
export interface SketchCircleFeatureGraphEdits {
    parameterEdits?: {
        parameterId: string;
        definition: SketchCircleLengthDefinition;
    }[];
    sketchEdits?: XYArcSketchDocumentEdit[];
    featureEdits?: {
        featureId: string;
        suppressed: boolean;
    }[];
}
export type SketchCircleFeatureOperation = {
    kind: 'upsert';
    feature: SketchCircleGraphFeature;
} | {
    kind: 'remove';
    featureId: string;
};
export interface SketchCircleFeatureLifecycleEdits {
    featureOperations: SketchCircleFeatureOperation[];
    parameterEdits?: SketchCircleFeatureGraphEdits['parameterEdits'];
    sketchEdits?: XYArcSketchDocumentEdit[];
}
export type SketchCircleParameterOperation = {
    kind: 'upsert';
    parameter: SketchCircleLengthParameter;
} | {
    kind: 'remove';
    parameterId: string;
};
export interface SketchCircleParameterLifecycleEdits {
    parameterOperations: SketchCircleParameterOperation[];
    featureOperations?: SketchCircleFeatureOperation[];
    sketchEdits?: XYArcSketchDocumentEdit[];
}
export interface SketchCircleResolvedParameter {
    id: string;
    type: 'length';
    valueMM: number;
    dependencyIds: string[];
    order: number;
}
export interface SketchCircleFeatureBindings {
    kind: 'derived-one-circle-projection';
    graphDocumentId: string;
    graphSketchId: string;
    featureId: string;
    profileId: string;
    shellId: string;
    heightParameterId: string;
    heightMM: number;
    profileBindings: XYArcSketchBindings;
    projectionBindings: XYCirclePrismDocumentReport['bindings'];
    projectionFormat: 'barocss-xy-circle-prism-feature';
    geometryIds: XYCirclePrismShellReport['geometryIds'];
    domains: XYCirclePrismShellReport['domains'];
    faceIds: string[];
}
export interface SketchCircleEvaluatedFeature {
    featureId: string;
    profileId: string;
    shellId: string;
    distanceParameterId: string;
    status: 'active' | 'suppressed';
    evaluation: XYCirclePrismDocumentResult | null;
    bindings: SketchCircleFeatureBindings;
}
export interface SketchCircleFeatureGraphReport {
    kind: 'sketch-circle-feature-graph-evaluation';
    formatVersion: 0;
    documentId: string;
    parameterOrder: string[];
    parameterDependencies: {
        parameterId: string;
        dependsOn: string;
    }[];
    featureDependencies: {
        featureId: string;
        profileId: string;
        distanceParameterId: string;
    }[];
    featureStatus: {
        featureId: string;
        shellId: string;
        status: 'active' | 'suppressed';
        native: XYCirclePrismShellReport | null;
    }[];
    activeShellIds: string[];
    wholeGraphCertified: false;
    candidateClosedShell: true;
    periodic: false;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumParameters: 8;
        maximumFeatures: 4;
        authoredIdCharacters: 64;
        profileShellIdCharacters: 48;
        snapshotValues: 8192;
        snapshotDepth: 10;
        arrayElements: 64;
        recordFields: 12;
        stringCharacters: 128;
        maximumJSONBytes: 131072;
    };
}
export interface SketchCircleFeatureGraphResult {
    document: SketchCircleFeatureGraphV0;
    sketchEvaluation: XYArcSketchDocumentResult;
    parameters: SketchCircleResolvedParameter[];
    features: SketchCircleEvaluatedFeature[];
    report: SketchCircleFeatureGraphReport;
}
export declare function evaluateSketchCircleFeatureGraph(document: SketchCircleFeatureGraphV0): SketchCircleFeatureGraphResult;
export declare function evaluateCircleGraphWithIdentities(document: SketchCircleFeatureGraphV0, identities: Map<string, string>): SketchCircleFeatureGraphResult;
export declare function updateSketchCircleFeatureGraph(document: SketchCircleFeatureGraphV0, edits: SketchCircleFeatureGraphEdits): SketchCircleFeatureGraphResult;
export declare function editSketchCircleFeatureGraphFeatures(document: SketchCircleFeatureGraphV0, edits: SketchCircleFeatureLifecycleEdits): SketchCircleFeatureGraphResult;
export declare function editSketchCircleFeatureGraphParameters(document: SketchCircleFeatureGraphV0, edits: SketchCircleParameterLifecycleEdits): SketchCircleFeatureGraphResult;
export declare function serializeSketchCircleFeatureGraph(document: SketchCircleFeatureGraphV0): string;
/** Admission scan only; JSON.parse remains the JSON syntax/value parser. */
export declare function parseSketchCircleFeatureGraph(text: string): SketchCircleFeatureGraphV0;
