import type { Model, Point } from '../types.js';
import type { SectionFraction } from '../section-rational-internal.js';
import type { QualifiedTranslatedStripBodyResult, QualifiedTranslatedStripBodyOptions } from './qualified-translated-strip-body.js';
import type { MultiSpanVLinearSurfacePlaneSectionAsset, MultiSpanVLinearSurfacePlaneSectionOptions } from '../intersect/multispan-vlinear-plane-section.js';
import type { SectionExactSurfaceBindingOptions } from '../features/section-exact-surface-binding.js';
import type { ExactSurfaceLowerTrimOptions } from '../exact-proof/exact-surface-lower-trim.js';
import type { PairedSectionPlaneCapOptions } from '../paired/paired-section-plane-cap.js';
import type { TranslatedSurfaceBaseFaceOptions } from './translated-surface-base-face.js';
import type { TranslatedSurfaceEndFacesOptions } from './translated-surface-end-faces.js';
import type { TranslatedSurfaceStripVolumeOptions } from './translated-surface-strip-volume.js';
import { KernelError } from '../core/barocss-error.js';
type Two<T> = [T, T];
type Size = {
    utf16: number;
    utf8: number;
};
type Side = 'below-y' | 'above-y';
type Recipe = {
    lowerSection: MultiSpanVLinearSurfacePlaneSectionOptions;
    upperSection: MultiSpanVLinearSurfacePlaneSectionOptions;
    lowerBinding: SectionExactSurfaceBindingOptions;
    upperBinding: SectionExactSurfaceBindingOptions;
    lowerWall: ExactSurfaceLowerTrimOptions;
    upperWall: ExactSurfaceLowerTrimOptions;
    cap: PairedSectionPlaneCapOptions;
    base: TranslatedSurfaceBaseFaceOptions;
    ends: TranslatedSurfaceEndFacesOptions;
    volume: TranslatedSurfaceStripVolumeOptions;
    body: QualifiedTranslatedStripBodyOptions;
};
export interface TranslatedStripPlaneSplitOptions {
    evaluationId: string;
    maximumOutputBodies: 2;
    maximumProducerDelegations: 22;
    outputRecipes: Two<Recipe>;
}
export interface TranslatedStripPlaneSplitRequest {
    body: QualifiedTranslatedStripBodyResult;
    cutAsset: MultiSpanVLinearSurfacePlaneSectionAsset;
    options: TranslatedStripPlaneSplitOptions;
}
type SourceRef = {
    sourceField: 'request.body' | 'request.cutAsset.source' | 'outputs.body.models.source';
    componentIndex: 0 | 1 | null;
    sourceId: string;
    modelName: string;
    objectIndex: number;
    objectId: string;
};
type FaceRef = {
    componentIndex: 0 | 1 | null;
    bodyId: string;
    faceId: string;
    surfaceId: string;
    role: QualifiedTranslatedStripBodyResult['faces'][number]['role'];
    support: SourceRef;
};
type EdgeRef = {
    componentIndex: 0 | 1 | null;
    bodyId: string;
    edgeId: string;
    curveId: string;
    role: QualifiedTranslatedStripBodyResult['edges'][number]['role'];
    curve: SourceRef;
};
type VertexRef = {
    componentIndex: 0 | 1 | null;
    bodyId: string;
    vertexId: string;
    world: Point;
};
type Interval = {
    lowerY: SectionFraction;
    upperY: SectionFraction;
    width: SectionFraction;
};
type CutProof = {
    selectedObjectIndex: number;
    source: SourceRef;
    lowerSource: SourceRef;
    upperSource: SourceRef;
    roofSource: SourceRef;
    domains: {
        u: [number, number];
        v: [number, number];
    };
    degrees: [1, 1];
    knotsU: number[];
    knotsV: number[];
    unitWeight: SectionFraction;
    yLower: SectionFraction;
    yCut: SectionFraction;
    yUpper: SectionFraction;
    lowerYResiduals: SectionFraction[][];
    cutYResiduals: SectionFraction[][];
    upperYResiduals: SectionFraction[][];
    cutToLowerDifferences: SectionFraction[][][];
    cutToUpperDifferences: SectionFraction[][][];
    xzBitsEqual: true;
    basisWeightBitsEqual: true;
    plane: {
        origin: SectionFraction[];
        uDirection: SectionFraction[];
        vDirection: SectionFraction[];
        rawNormal: SectionFraction[];
        d: SectionFraction;
        fourthCornerResiduals: SectionFraction[];
        equation: 'Y-yCut=0';
        nativeNormalYSign: -1;
        strictPositiveXZ: true;
    };
};
type Proof = {
    cut: CutProof;
    intervals: {
        original: Interval;
        outputs: Two<Interval>;
        sharedEndpointResidual: SectionFraction;
        originalWidthResidual: SectionFraction;
        disjointOpenInteriors: true;
        closedUnionEqualsInput: true;
        commonMap: 'S_originalLower(u,v)+[0,translationY,0]';
        materialSemantics: 'partition-of-one-occupied-region-no-removed-slab';
    };
    outputMaterial: {
        index: 0 | 1;
        bodyId: string;
        materialCertificateId: string;
        originalMaterialCertificateId: string;
        lowerSourceId: string;
        upperSourceId: string;
        roofSourceId: string;
        unchangedSourceDomainRoof: true;
        sourceDefinedOccupiedRegion: true;
        wholeBoundaryImage: true;
        embeddedClosedBoundary: true;
        outwardMaterial: true;
        restrictedSolidCertified: true;
    }[];
    volume: {
        areaFactorMM2: SectionFraction;
        originalExactVolumeMM3: SectionFraction;
        expectedOutputExactVolumeMM3: Two<SectionFraction>;
        actualOutputExactVolumeMM3: Two<SectionFraction>;
        outputResiduals: Two<SectionFraction>;
        sumExactVolumeMM3: SectionFraction;
        conservationResidual: SectionFraction;
    };
    generatedIds: string[];
};
type Bindings = {
    original: {
        bodyId: string;
        shellId: string;
        materialCertificateId: string;
    };
    cut: {
        source: SourceRef;
        surfaceId: string;
        first: FaceRef;
        second: FaceRef;
        originalCutSurfaceBitsEqual: true;
        wholeNativePatchImageEqual: true;
        effectiveOrientations: ['reverse', 'forward'];
        outwardNormalYSigns: [1, -1];
        boundaryMaps: {
            first: EdgeRef;
            second: EdgeRef;
            parameterScale: SectionFraction;
            parameterOffset: SectionFraction;
            coefficientResiduals: SectionFraction[][];
            oppositeEffectiveUses: true;
        }[];
    };
    faceLineage: {
        original: FaceRef;
        outputs: FaceRef[];
        semantics: 'same-whole-face-image' | 'partition-of-original-face-image';
        translationIntervals: Interval[];
        materialMapResiduals: SectionFraction[][];
    }[];
    edgeLineage: {
        original: EdgeRef;
        outputs: {
            edge: EdgeRef;
            nativeParameterScale: SectionFraction;
            nativeParameterOffset: SectionFraction;
            coefficientResiduals: SectionFraction[][];
        }[];
        semantics: 'same-whole-edge-image' | 'partition-of-original-edge-image';
    }[];
    vertexLineage: {
        original: VertexRef;
        output: VertexRef;
        pointBitsEqual: true;
    }[];
    directionConvention: 'parent-stored-use-order-already-includes-face-orientation';
    namingAuthority: 'explicit-source-qualified-operation-lineage-no-generic-persistent-matching';
};
type Output = {
    index: 0 | 1;
    side: Side;
    recipe: Recipe;
    body: QualifiedTranslatedStripBodyResult;
};
type DirectCounts = {
    originalBodyValidationCount: number;
    cutSourceCompilationCount: number;
    outputBodyConstructionCount: number;
    sectionBuildCount: number;
    bindingBuildCount: number;
    wallBuildCount: number;
    capBuildCount: number;
    baseBuildCount: number;
    endBuildCount: number;
    volumeBuildCount: number;
    qualifiedBodyBuildCount: number;
    producerDelegationCount: number;
    totalDirectDelegationCount: number;
    curvePointEvaluationCount: 0;
    curveDerivativeEvaluationCount: 0;
    surfacePointEvaluationCount: 0;
    surfaceDerivativeEvaluationCount: 0;
    cutSurfaceValidationCount: 0;
    cutSurfaceDomainCallCount: 0;
    floatConversionCount: 0;
    nativeRootCount: 0;
    booleanCallCount: 0;
    sourceWriterCallCount: 0;
};
export declare const TranslatedStripPlaneSplitDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly PARENT: "PARENT";
    readonly SOURCE: "SOURCE";
    readonly REFERENCE: "REFERENCE";
    readonly SUPPORT: "SUPPORT";
    readonly CUT: "CUT";
    readonly PARTITION: "PARTITION";
    readonly ORIENTATION: "ORIENTATION";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly CONSTRUCTION: "CONSTRUCTION";
    readonly VOLUME: "VOLUME";
    readonly FILE: "FILE";
    readonly CODEC: "CODEC";
    readonly OWNED: "OWNED";
}>;
type DiagnosticCode = typeof TranslatedStripPlaneSplitDiagnosticCode[keyof typeof TranslatedStripPlaneSplitDiagnosticCode];
type Context = {
    stage: 'input' | 'parent' | 'cut-source' | 'cut-binding' | 'partition' | 'identity' | 'section' | 'binding' | 'wall' | 'cap' | 'base' | 'ends' | 'volume' | 'body' | 'lineage' | 'file' | 'codec' | 'owned';
    componentIndex: 0 | 1 | null;
    directCounts: DirectCounts;
    codecCounts: {
        ownedSplitValidationCount: number;
        originalBodyReconstructionCount: number;
        originalProducerDelegationCount: number;
        splitConstructionCount: number;
    };
};
export declare class TranslatedStripPlaneSplitError extends KernelError {
    readonly code: DiagnosticCode;
    readonly context: Context;
    constructor(code: DiagnosticCode, detail: string, context: Context, cause?: unknown);
}
export interface TranslatedStripPlaneSplitReport {
    schema: 'barocss-translated-strip-plane-split';
    version: 0;
    evaluationId: string;
    lengthUnit: 'mm';
    volumeUnit: 'mm3';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    profile: 'qualified-affine-xz-constant-y-side-supports-and-interior-y-plane';
    originalBodyId: string;
    originalMaterialCertificateId: string;
    cutSourceId: string;
    cutSurfaceId: string;
    cutModelName: string;
    selectedCutObjectIndex: number;
    outputBodyIds: Two<string>;
    outputMaterialCertificateIds: Two<string>;
    inputBodyCount: 1;
    outputBodyCount: 2;
    exactVolumeMM3: SectionFraction;
    outputExactVolumesMM3: Two<SectionFraction>;
    conservationResidual: SectionFraction;
    yInterval: Interval;
    outputYIntervals: Two<Interval>;
    directCounts: DirectCounts;
    rationalCounts: ReturnType<import('../section-rational-internal.js').SectionRationalContext['counts']>;
    outputCounts: Two<{
        vertexCount: 8;
        edgeCount: 12;
        faceCount: 6;
        useCount: 24;
        loopCount: 6;
        vertexLinkCount: 8;
        cornerArcCount: 24;
        modelCount: 2;
        geometryObjectCount: 18;
        shellCount: 1;
        bodyCount: 1;
    }>;
    lineageCounts: {
        originalFaces: 6;
        originalEdges: 12;
        originalVertices: 8;
        unchangedFaceImages: 2;
        partitionedFaceImages: 4;
        unchangedEdgeImages: 8;
        partitionedEdgeImages: 4;
        commonCutFaces: 2;
        commonCutBoundaryPairs: 4;
    };
    sourceSizes: {
        cut: Size;
    };
    fileSizes: {
        request: Size;
        result: Size;
    };
    numericPolicy: {
        authority: 'exact-represented-original-and-cut-source-material-map';
        cutSelection: 'unchanged-original-caller-plane-surface-not-computed-endpoint';
        semantics: 'conserved-closed-interval-partition-not-finite-width-subtraction';
        commonRoof: 'same-full-original-plane-and-stored-native-roof';
        volume: 'exact-area-factor-times-positive-y-width';
        lineage: 'explicit-qualified-source-and-complete-coefficient-parameter-maps';
        orientation: 'cut-upper-reverse-and-cut-lower-forward-parent-uses-once';
        rootNativeSampling: false;
        rootFloatConversion: false;
        weldingPerformed: false;
        sourceIdentityRenaming: false;
        coefficientGeneration: false;
        toleranceUsed: false;
    };
    quality: {
        restrictedSplitCertified: true;
        inputMaterialConserved: true;
        disjointOutputInteriors: true;
        closedOutputUnionEqualsInput: true;
        actualOutputBodiesQualified: true;
        commonCutImageCertified: true;
        oppositeCutOutwardOrientations: true;
        originalBodySourcesAndSiblingsPreserved: true;
        fullParentProofsUnchanged: true;
        genericSplitBody: false;
        arbitraryPlaneCut: false;
        arbitraryCurvedSolid: false;
        globalC1: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        genericPersistentNaming: false;
        editorAccepted: false;
        publication: false;
        ownedRebuild: true;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumInputBodies: 1;
        maximumCutAssets: 1;
        maximumOutputBodies: 2;
        maximumProducerDelegations: 22;
        maximumOutputModels: 4;
        maximumOutputGeometryObjects: 36;
        selectedDegreeU: 1;
        selectedDegreeV: 1;
        selectedAxisPoles: 2;
        maximumOriginalSpans: 1;
        unitWeight: 1;
        maximumObjectsPerModel: 16;
        maximumBodyUTF16: 2097152;
        maximumBodyUTF8: 2097152;
        sourceUTF16: 262144;
        sourceUTF8: 262144;
        identityCharacters: 48;
        maximumRequestUTF16: 6291456;
        maximumRequestUTF8: 6291456;
        maximumResultUTF16: 12582912;
        maximumResultUTF8: 12582912;
        ownValues: 4194304;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        stringCharacters: 262144;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        rootNativeCalls: 0;
        rootFloatConversions: 0;
        maximumAuthoredUTF16: 2097152;
        maximumAuthoredUTF8: 2097152;
        authoredParserDepth: 12;
        authoredParserValues: 65536;
        authoredParserRecordFields: 16;
        authoredParserStringCharacters: 262144;
    };
    workScope: 'one-body-validation-one-cut-compile-and-actual-twenty-two-producer-calls-child-work-retained-separately';
    budgetFailure: 'atomic-no-partial-accepted-split-bodies-or-authored-update';
}
export interface TranslatedStripPlaneSplitResult {
    request: TranslatedStripPlaneSplitRequest;
    cutModel: Model;
    proof: Proof;
    outputs: Two<Output>;
    bindings: Bindings;
    report: TranslatedStripPlaneSplitReport;
}
/** Partition one actual occupied region using an unchanged source-backed interior Y Plane. */
export declare function splitTranslatedStripBodyByPlane(input: TranslatedStripPlaneSplitRequest): TranslatedStripPlaneSplitResult;
/** Compare the complete family with one real cold reconstruction, retaining failure work. */
export declare function validateTranslatedStripPlaneSplit(value: unknown): TranslatedStripPlaneSplitReport;
/** Encode only the actual authored construction recipe; all derived Bodies remain separate. */
export declare function serializeTranslatedStripPlaneSplit(value: TranslatedStripPlaneSplitResult): string;
/** Strict authored decode, real original eleven-stage reconstruction, then the real conserved Split. */
export declare function parseTranslatedStripPlaneSplit(text: string): TranslatedStripPlaneSplitResult;
export {};
