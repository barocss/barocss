import type { PairedSurfaceUVSplitFacesResult } from './paired-surface-uv-split-faces.js';
import type { PairedSurfaceBUVSplitFacesResult } from './paired-surface-b-uv-split-faces.js';
import type { PairedSurfaceUVFaceQuery } from './paired-surface-uv-face-classification.js';
import type { SectionFraction, SectionRationalContext } from '../section-rational-internal.js';
type F = SectionFraction;
type Asset = 0 | 1;
type Sense = 'forward' | 'reverse';
type Material = 'inside' | 'outside' | 'boundary';
type Relation = 'below' | 'on' | 'above' | 'not-applicable';
type Boundary = 'u-min' | 'u-max' | 'v-min' | 'v-max';
type Sign = -1 | 0 | 1;
type FaceClassification = {
    sourceId: string;
    surfaceId: string;
    faceId: string;
    region: 'below-cut' | 'above-cut';
    orientation: Sense;
    classification: Material;
};
type Classification = {
    queryId: string;
    assetIndex: Asset;
    window: 'outside' | 'interior' | 'boundary';
    windowBoundaries: Boundary[];
    cutRelation: Relation;
    faces: [FaceClassification, FaceClassification];
};
type SourceRef = {
    assetIndex: Asset;
    sourceId: string;
    surfaceId: string;
    modelName: string;
    objectIndex: number;
    sourceField: 'request.a.request.section.request.assets[0].source' | 'request.b.request.section.request.assets[1].source';
    modelField: 'request.a.request.section.originalModels[0]' | 'request.b.request.section.originalModels[1]';
};
type Support = {
    reference: SourceRef;
    parentEvaluationId: string;
    window: {
        u: [number, number];
        v: [number, number];
    };
    faceIds: [string, string];
    orientations: [Sense, Sense];
    sharedCutEdgeId: string;
    worldCurveId: string;
    pcurveId: string;
    originalUAInterval: [number, number];
    uMap: {
        offset: F;
        scale: F;
    };
    vCoefficients: F[];
};
type QueryProof = {
    queryId: string;
    assetIndex: Asset;
    queryUV: [F, F];
    method: 'outside-window' | 'natural-v-boundary' | 'exact-affine-quartic';
    boundSigns: {
        uMinimum: Sign;
        uMaximum: Sign;
        vMinimum: Sign;
        vMaximum: Sign;
    };
    originalUA: F | null;
    normalizedParameter: F | null;
    deCasteljau: F[][];
    cutValue: F | null;
    vMinusCut: F | null;
    cutSign: Sign | null;
    classification: Classification;
};
type Proof = {
    schema: 'barocss-paired-surface-uv-face-classification-proof';
    version: 0;
    supports: [Support, Support];
    sameCompletePairedParent: true;
    unchangedSharedWorldCurve: true;
    preservedOriginalParameterFrames: true;
    queries: QueryProof[];
    authority: 'exact-stored-affine-u-quartic-v-on-certified-original-uv-face-windows';
};
type DirectCounts = {
    parentValidationCount: number;
    queryCount: number;
    affineInversionCount: number;
    quarticEvaluationCount: number;
    signComparisonCount: number;
    curveD0Count: 0;
    curveD1Count: 0;
    surfaceD0Count: 0;
    surfaceD1Count: 0;
    sourceCompilationCount: 0;
    rationalFloatConversionCount: 0;
};
type Callbacks = {
    beginQuery(assetIndex: Asset, queryIndex: number): void;
    retainQuery(classification: Classification, proof: QueryProof): void;
    fail(code: 'BINDING' | 'DOMAIN', detail: string, cause?: unknown): never;
};
export type PairedUVFaceQueryProof = QueryProof;
export type PairedUVFaceSupport = Support;
export type PairedUVFaceProof = Proof;
export type PairedUVFaceClassification = Classification;
export type PairedUVFaceDirectCounts = DirectCounts;
/** Trusted exact predicates after public full-parent admission; no native/provider calls. */
export declare function classifyPairedSurfaceUVQueriesTrusted(a: PairedSurfaceUVSplitFacesResult, b: PairedSurfaceBUVSplitFacesResult, queries: PairedSurfaceUVFaceQuery[], q: SectionRationalContext, counts: DirectCounts, callbacks: Callbacks): {
    supports: [Support, Support];
    classifications: Classification[];
    queries: QueryProof[];
};
export {};
