import type { SourceCurveControlPolygonResult } from '../nurbs/source-wide/source-curve-control-polygon.js';
import type { CurveControlPolygonEdits } from '../nurbs/curves/curve-control-polygon.js';
import type { PiecewiseRationalLoftOptions, PiecewiseRationalLoftResult } from './piecewise-rational-loft.js';
import type { Model } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const NurbsSourceLoftFeatureGraphDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly VERSION: "VERSION";
    readonly IDENTITY: "IDENTITY";
    readonly REVISION: "REVISION";
    readonly BUDGET: "BUDGET";
    readonly SOURCE: "SOURCE";
    readonly REFERENCE: "REFERENCE";
    readonly DEPENDENCY: "DEPENDENCY";
    readonly BASIS: "BASIS";
    readonly STATIONS: "STATIONS";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly CODEC: "CODEC";
    readonly OWNED: "OWNED";
}>;
export type NurbsSourceLoftFeatureGraphDiagnosticCode = typeof NurbsSourceLoftFeatureGraphDiagnosticCode[keyof typeof NurbsSourceLoftFeatureGraphDiagnosticCode];
export declare class NurbsSourceLoftFeatureGraphError extends KernelError {
    readonly code: NurbsSourceLoftFeatureGraphDiagnosticCode;
    constructor(code: NurbsSourceLoftFeatureGraphDiagnosticCode, detail: string, cause?: unknown);
}
type Source = {
    sourceId: string;
    sourceVersion: 0;
    source: string;
};
type SourceEditNode = {
    id: string;
    kind: 'source-curve-edit';
    input: {
        sourceId: string;
        previousNodeId: string | null;
    };
    curveId: string;
    edits: CurveControlPolygonEdits;
};
type SectionRef = {
    nodeId: string;
    sourceId: string;
    curveId: string;
};
type LoftNode = {
    id: string;
    kind: 'piecewise-rational-loft';
    outputSourceId: string;
    sections: [SectionRef, SectionRef, SectionRef];
    parametersV: [number, number, number];
    suppressed: boolean;
    options: PiecewiseRationalLoftOptions;
};
export interface NurbsSourceLoftFeatureGraphV0 {
    format: 'barocss-nurbs-source-loft-feature-graph';
    version: 0;
    id: string;
    revision: number;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    sources: Source[];
    nodes: (SourceEditNode | LoftNode)[];
}
export interface NurbsSourceLoftFeatureGraphOptions {
    maximumSources: 3;
    maximumSourceEdits: 3;
    maximumFeatureEvaluations: 4;
    maximumLoftSections: 3;
}
export interface NurbsSourceLoftFeatureGraphEdits {
    expectedRevision: number;
    revision: number;
    nodeEdits: {
        nodeId: string;
        edits: CurveControlPolygonEdits;
    }[];
    loftSuppressed: boolean | null;
}
type CompiledSource = {
    sourceId: string;
    sourceVersion: 0;
    source: string;
    model: Model;
};
type EvaluatedNode = {
    nodeId: string;
    sourceId: string;
    previousNodeId: string | null;
    curveId: string;
    evaluation: SourceCurveControlPolygonResult;
};
type LoftState = {
    nodeId: string;
    outputSourceId: string;
    status: 'active' | 'suppressed';
    recipe: LoftNode;
    evaluation: PiecewiseRationalLoftResult | null;
};
type NodeBinding = {
    graphId: string;
    revision: number;
    nodeId: string;
    sourceId: string;
    sourceModelName: string;
    curveId: string;
    previousNodeId: string | null;
};
type LoftBinding = {
    graphId: string;
    revision: number;
    nodeId: string;
    outputSourceId: string;
    modelName: string;
    surfaceId: string;
    status: 'active' | 'suppressed';
    sections: NodeBinding[];
};
export interface NurbsSourceLoftFeatureGraphResult {
    document: NurbsSourceLoftFeatureGraphV0;
    options: NurbsSourceLoftFeatureGraphOptions;
    originalSources: CompiledSource[];
    evaluatedNodes: EvaluatedNode[];
    loft: LoftState;
    bindings: {
        nodes: NodeBinding[];
        loft: LoftBinding;
    };
    report: NurbsSourceLoftFeatureGraphReport;
}
export interface NurbsSourceLoftFeatureGraphReport {
    schema: 'barocss-nurbs-source-loft-feature-graph';
    version: 0;
    graphId: string;
    revision: number;
    sourceIds: string[];
    sourceModelNames: string[];
    nodeOrder: string[];
    dependencies: {
        nodeId: string;
        dependencyNodeIds: string[];
    }[];
    sourceNamespaces: {
        sourceId: string;
        modelName: string;
        objectIds: string[];
    }[];
    loftNodeId: string;
    loftOutputSourceId: string;
    loftSurfaceId: string;
    loftModelName: string;
    loftStatus: 'active' | 'suppressed';
    sectionRefs: SectionRef[];
    receiptCounts: {
        originalSourceModelCount: number;
        sourceEditReceiptCount: 3;
        activeLoftReceiptCount: 0 | 1;
        sourceEditPatchCount: number;
        sourceEditRequestedFieldCount: number;
    };
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    authority: 'complete-authored-source-and-explicit-source-node-qualified-recipes';
    reconstruction: 'whole-current-document-and-options-no-operation-history';
    workScope: 'retained-result-receipts-not-operation-constructor-call-counts';
    fileSizes: {
        authored: {
            utf16: number;
            utf8: number;
        };
        result: {
            utf16: number;
            utf8: number;
        };
    };
    quality: {
        completeOriginalSourcesRetained: true;
        unrelatedSourceGeometryPreserved: true;
        sourceQualifiedCurveBindings: true;
        independentWeightsPreserved: true;
        ownedRebuild: true;
        affectedOnlyUpdates: true;
        originalMixedSourceLoftOutput: false;
        smoothLoft: false;
        G1: false;
        G2: false;
        persistentTopologyBinding: false;
        topologyCertified: false;
        solid: false;
        globalBinary64ErrorCertified: false;
        manufacturing: false;
        editorDisplay: false;
        publication: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumSources: 3;
        maximumSourceEdits: 3;
        maximumNodes: 4;
        maximumLoftSections: 3;
        maximumSelectedUDegree: 5;
        maximumSelectedUPoles: 16;
        maximumRevision: 1000000000;
        maximumAggregateOriginalSourceUTF16: 262144;
        maximumAggregateOriginalSourceUTF8: 262144;
        maximumSourceUTF16: 262144;
        maximumSourceUTF8: 262144;
        maximumModelObjects: 16;
        maximumAuthoredFileUTF16: 1048576;
        maximumAuthoredFileUTF8: 1048576;
        maximumResultFileUTF16: 2097152;
        maximumResultFileUTF8: 2097152;
        maximumWrapperPoleEdits: 192;
        maximumWrapperRequestedFields: 768;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        stringCharacters: 262144;
        authoredCodecDepth: 12;
        authoredCodecValues: 65536;
        authoredCodecRecordFields: 16;
        authoredCodecDecodedStringCharacters: 262144;
    };
}
export interface NurbsSourceLoftFeatureGraphTransactionReport {
    schema: 'barocss-nurbs-source-loft-feature-graph-transaction';
    version: 0;
    graphId: string;
    previousRevision: number;
    revision: number;
    noOp: boolean;
    requestedNodeIds: string[];
    changedRecipeNodeIds: string[];
    affectedSourceEditNodeIds: string[];
    reusedSourceEditNodeIds: string[];
    loftNodeId: string;
    loftAffected: boolean;
    suppressionChanged: boolean;
    resumed: boolean;
    loftAction: 'rebuilt' | 'retained' | 'suppressed';
    directCounts: {
        priorOwnedValidationCount: 1;
        sourceCompilationCount: 0;
        sourceEditEvaluationCount: number;
        loftEvaluationCount: 0 | 1;
        curvePointEvaluationCount: 0;
        curveDerivativeEvaluationCount: 0;
        surfacePointEvaluationCount: 0;
        surfaceDerivativeEvaluationCount: 0;
    };
    nativeCalls: 'actual-selective-wrapper-producer-calls';
    workScope: 'prior-owned-validation-and-producer-internal-work-excluded';
    fileSizes: {
        update: {
            utf16: number;
            utf8: number;
        };
    };
    atomic: true;
    unchangedNativeReceiptsCopied: true;
}
export interface NurbsSourceLoftFeatureGraphTransaction {
    request: {
        previousDocument: NurbsSourceLoftFeatureGraphV0;
        options: NurbsSourceLoftFeatureGraphOptions;
        edits: NurbsSourceLoftFeatureGraphEdits;
    };
    report: NurbsSourceLoftFeatureGraphTransactionReport;
}
export interface NurbsSourceLoftFeatureGraphUpdateResult {
    result: NurbsSourceLoftFeatureGraphResult;
    transaction: NurbsSourceLoftFeatureGraphTransaction;
}
/** Evaluate full authored sources, exact source-node dependencies and the actual active piecewise Loft. */
export declare function evaluateNurbsSourceLoftFeatureGraph(documentInput: NurbsSourceLoftFeatureGraphV0, optionsInput: NurbsSourceLoftFeatureGraphOptions): NurbsSourceLoftFeatureGraphResult;
/** Reconstruct all current native receipts from authored authority; operation history is not graph authority. */
export declare function validateNurbsSourceLoftFeatureGraph(input: NurbsSourceLoftFeatureGraphResult): NurbsSourceLoftFeatureGraphReport;
/** Validate the prior graph, then execute only the actually affected dependency closure. */
export declare function updateNurbsSourceLoftFeatureGraph(previousInput: NurbsSourceLoftFeatureGraphResult, editsInput: NurbsSourceLoftFeatureGraphEdits): NurbsSourceLoftFeatureGraphUpdateResult;
/** Reconstruct the nonrecursive authored baseline and actual selective operation, comparing result and transaction. */
export declare function validateNurbsSourceLoftFeatureGraphUpdate(input: NurbsSourceLoftFeatureGraphUpdateResult): NurbsSourceLoftFeatureGraphTransactionReport;
/** Serialize current authored intent only, with the unchanged strict grammar's file envelope. */
export declare function serializeNurbsSourceLoftFeatureGraph(document: NurbsSourceLoftFeatureGraphV0, options: NurbsSourceLoftFeatureGraphOptions): string;
/** Strict original JSON grammar, then actual current native Source/Loft reconstruction. */
export declare function parseNurbsSourceLoftFeatureGraph(text: string, options: NurbsSourceLoftFeatureGraphOptions): NurbsSourceLoftFeatureGraphResult;
export {};
