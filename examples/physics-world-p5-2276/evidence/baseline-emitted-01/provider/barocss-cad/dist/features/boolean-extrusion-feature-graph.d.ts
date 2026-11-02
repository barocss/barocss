import type { SketchCircleLengthDefinition, SketchCircleLengthParameter, SketchCircleResolvedParameter } from '../sketch/sketch-circle-feature-graph.js';
import type { ConvexPlanarFaceLoop, ConvexPlanarFaceOptions, ConvexPlanarFaceResult } from '../own-convex-planar-face.js';
import type { CoplanarFaceBooleanOptions, CoplanarFaceBooleanResult } from '../planar-solids/coplanar-face-boolean.js';
import type { CoplanarFaceBooleanExtrusionOptions, CoplanarFaceBooleanExtrusionResult } from '../planar-solids/coplanar-face-boolean-extrusion.js';
import type { Surface } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const BooleanExtrusionFeatureGraphDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly PARAMETER: "PARAMETER";
    readonly DEPENDENCY: "DEPENDENCY";
    readonly REVISION: "REVISION";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly JSON: "JSON";
    readonly OWNED: "OWNED";
}>;
export type BooleanExtrusionFeatureGraphDiagnosticCode = typeof BooleanExtrusionFeatureGraphDiagnosticCode[keyof typeof BooleanExtrusionFeatureGraphDiagnosticCode];
export declare class BooleanExtrusionFeatureGraphError extends KernelError {
    readonly code: BooleanExtrusionFeatureGraphDiagnosticCode;
    readonly path: string;
    readonly featureId: string | null;
    readonly parameterId: string | null;
    constructor(code: BooleanExtrusionFeatureGraphDiagnosticCode, detail: string, context?: {
        path?: string;
        featureId?: string | null;
        parameterId?: string | null;
        cause?: unknown;
    });
}
export type BooleanExtrusionLengthDefinition = SketchCircleLengthDefinition;
export type BooleanExtrusionLengthParameter = SketchCircleLengthParameter;
export interface BooleanExtrusionFaceFeature {
    id: string;
    kind: 'face-input';
    outputSlotId: string;
    plane: Surface;
    loop: ConvexPlanarFaceLoop;
    options: ConvexPlanarFaceOptions;
}
export interface BooleanExtrusionBooleanFeature {
    id: string;
    kind: 'coplanar-boolean';
    outputSlotId: string;
    operandAFeatureId: string;
    operandBFeatureId: string;
    options: CoplanarFaceBooleanOptions;
}
export interface BooleanExtrusionExtrusionFeature {
    id: string;
    kind: 'normal-extrusion';
    outputSlotId: string;
    regionFeatureId: string;
    distance: BooleanExtrusionLengthDefinition;
    options: Omit<CoplanarFaceBooleanExtrusionOptions, 'distanceMM'>;
}
export interface BooleanExtrusionFeatureGraphV0 {
    format: 'barocss-native-boolean-extrusion-feature-graph';
    version: 0;
    id: string;
    revision: number;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameters: BooleanExtrusionLengthParameter[];
    features: (BooleanExtrusionFaceFeature | BooleanExtrusionBooleanFeature | BooleanExtrusionExtrusionFeature)[];
}
export interface BooleanExtrusionFeatureGraphOptions {
    maximumParameterResolutions: number;
    maximumFeatureEvaluations: number;
}
export interface BooleanExtrusionFeatureGraphEdits {
    expectedRevision: number;
    revision: number;
    parameterEdits: {
        parameterId: string;
        definition: BooleanExtrusionLengthDefinition;
    }[];
    faceEdits: {
        featureId: string;
        plane: Surface;
        loop: ConvexPlanarFaceLoop;
    }[];
    booleanEdits: {
        featureId: string;
        operation: 'union' | 'intersection' | 'difference';
    }[];
    distanceEdits: {
        featureId: string;
        definition: BooleanExtrusionLengthDefinition;
    }[];
}
export type BooleanExtrusionFeatureGraphResolvedParameter = SketchCircleResolvedParameter;
export type BooleanExtrusionFeatureGraphEvaluatedFeature = {
    featureId: string;
    outputSlotId: string;
    kind: 'face-input';
    order: number;
    dependencyIds: string[];
    evaluation: ConvexPlanarFaceResult;
} | {
    featureId: string;
    outputSlotId: string;
    kind: 'coplanar-boolean';
    order: number;
    dependencyIds: string[];
    evaluation: CoplanarFaceBooleanResult;
} | {
    featureId: string;
    outputSlotId: string;
    kind: 'normal-extrusion';
    order: number;
    dependencyIds: string[];
    evaluation: CoplanarFaceBooleanExtrusionResult;
};
export interface BooleanExtrusionFeatureGraphReport {
    schema: 'barocss-native-boolean-extrusion-feature-graph-report';
    version: 0;
    graphId: string;
    revision: number;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    authoredFeatureOrder: string[];
    featureOrder: string[];
    parameterOrder: string[];
    parameterDependencies: {
        parameterId: string;
        dependsOn: string;
    }[];
    featureDependencies: {
        featureId: string;
        dependencyIds: string[];
    }[];
    parameterResolutionCount: number;
    distanceDefinitionEvaluationCount: number;
    featureEvaluationCount: number;
    nativeBuilderCallCount: number;
    nativeBuilderCalls: {
        faceInput: 2;
        coplanarBoolean: 1;
        normalExtrusion: number;
    };
    distances: {
        featureId: string;
        definition: BooleanExtrusionLengthDefinition;
        valueMM: number;
        dependencyIds: string[];
    }[];
    qualifiedBindings: {
        graphId: string;
        revision: number;
        featureId: string;
        outputSlotId: string;
        kind: 'face-input' | 'coplanar-boolean' | 'normal-extrusion';
        nativeReferences: {
            graphId: string;
            revision: number;
            featureId: string;
            outputSlotId: string;
            nativeId: string;
        }[];
        sources: {
            assetId: string;
            sourceVersion: 0;
            objectIds: string[];
        }[];
    }[];
    summary: {
        booleanFeatureId: string;
        empty: boolean;
        componentCount: number;
        holeCount: number;
        materialAreaUV: number;
        extrusions: {
            featureId: string;
            outputSlotId: string;
            empty: boolean;
            shellIds: string[];
            distanceMM: number;
        }[];
    };
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        geometryAuthority: 'actual-native-face-boolean-and-extrusion-builders';
        authoredOrderPreserved: true;
        parameterResolver: 'actual-original-circle-graph-first-authored-ready';
        allUnusedParametersResolved: true;
        logicalSlotsAreGeometryIds: false;
        originalNativeIdsRetainedPerFeatureContext: true;
        nativeReferenceScope: 'entities-defined-by-this-feature-not-transitive-operand-references';
        revisionBinding: 'declared-graph-revision-qualified-no-hidden-history';
        priorRevisionReferences: 'stale-after-declared-revision-advance-even-if-native-id-repeats';
        updateEvaluation: 'complete-prior-owned-rebuild-then-full-copied-candidate-chain';
        builderWork: 'two-face-one-boolean-and-per-leaf-extrusion-calls-excludes-native-internal-validation-compiler-primitive-work';
        nativeOutputsAreAuthoredEditingAuthority: false;
        selectiveRecomputationClaimed: false;
        globalHistoryCertified: false;
        wholeGraphCertified: false;
        manufacturingToleranceCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-prior-intent-results-and-files-retained';
    limits: {
        maximumParameters: 8;
        maximumFeatures: 7;
        maximumExtrusions: 4;
        authoredIdCharacters: 48;
        maximumRevision: 1000000000;
        lengthMM: 10000;
        authoredValues: 16384;
        authoredDepth: 12;
        authoredArrayElements: 64;
        authoredRecordFields: 16;
        authoredStringCharacters: 128;
        ownValues: 1048576;
        ownDepth: 40;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
        maximumFileBytes: 1048576;
    };
}
export interface BooleanExtrusionFeatureGraphResult {
    document: BooleanExtrusionFeatureGraphV0;
    options: BooleanExtrusionFeatureGraphOptions;
    parameters: BooleanExtrusionFeatureGraphResolvedParameter[];
    features: BooleanExtrusionFeatureGraphEvaluatedFeature[];
    report: BooleanExtrusionFeatureGraphReport;
}
/** A declared current snapshot evaluates two Faces, one shared Boolean and every authored-ready extrusion leaf. */
export declare function evaluateBooleanExtrusionFeatureGraph(documentInput: BooleanExtrusionFeatureGraphV0, optionsInput: BooleanExtrusionFeatureGraphOptions): BooleanExtrusionFeatureGraphResult;
export declare function validateBooleanExtrusionFeatureGraph(input: BooleanExtrusionFeatureGraphResult): BooleanExtrusionFeatureGraphReport;
/** One copied candidate is evaluated only after every stable-ID edit has been admitted. */
export declare function updateBooleanExtrusionFeatureGraph(previousInput: BooleanExtrusionFeatureGraphResult, editsInput: BooleanExtrusionFeatureGraphEdits): BooleanExtrusionFeatureGraphResult;
