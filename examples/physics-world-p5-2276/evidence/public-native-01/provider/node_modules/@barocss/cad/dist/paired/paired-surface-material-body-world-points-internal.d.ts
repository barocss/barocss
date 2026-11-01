import type { PairedSurfaceMaterialBodyResult } from './paired-surface-material-body.js';
import type { PairedSurfaceMaterialBodyWorldPointQuery } from './paired-surface-material-body-world-points.js';
import type { SectionFraction, SectionRationalContext } from '../section-rational-internal.js';
type F = SectionFraction;
type FaceRole = 'roof' | 'side' | 'yMin' | 'zMin' | 'xMin' | 'xMax';
type Sign = -1 | 0 | 1;
type Stage = 'x' | 'y' | 'z';
type BodySourceRef = PairedSurfaceMaterialBodyResult['faces'][number]['supportRef'];
type ParentRef = {
    parentField: 'request.body';
    reference: BodySourceRef;
};
type BoundaryFace = {
    parentField: 'request.body';
    role: FaceRole;
    faceId: string;
    supportRef: BodySourceRef;
};
type Classification = {
    queryId: string;
    status: 'inside' | 'outside' | 'boundary';
    bodyId: string;
    materialCertificateId: string;
    boundaryFaces: BoundaryFace[];
};
type Constraint = {
    role: FaceRole;
    difference: F;
    sign: Sign;
};
type QueryProof = {
    queryId: string;
    pointExact: [F, F, F];
    decision: 'outside-x' | 'outside-y' | 'outside-z' | 'inside' | 'boundary';
    x: [Constraint, Constraint];
    originalUB: F | null;
    yRoof: F | null;
    y: [Constraint, Constraint] | null;
    zRoof: F | null;
    z: [Constraint, Constraint] | null;
    classification: Classification;
};
type SourceDefinition = {
    bodyId: string;
    shellId: string;
    materialCertificateId: string;
    originalUAInterval: [number, number];
    originalUBOffset: F;
    originalUBScale: F;
    lowY: F;
    lowZ: F;
    bYOriginalUBPower: F[];
    aZOriginalUAVAPower: F[][];
    sourceRefs: ParentRef[];
    faceRefs: [BoundaryFace, BoundaryFace, BoundaryFace, BoundaryFace, BoundaryFace, BoundaryFace];
    unitAxisSourceAuthority: true;
    wholeMaterialParentUnchanged: true;
};
type Proof = {
    schema: 'barocss-paired-surface-material-body-world-points-proof';
    version: 0;
    source: SourceDefinition;
    queries: QueryProof[];
    authority: 'exact-source-defined-unit-axis-paired-surface-occupied-region';
};
type DirectCounts = {
    bodyValidationCount: number;
    queryCount: number;
    yRoofEvaluationCount: number;
    zRoofEvaluationCount: number;
    signComparisonCount: number;
    curveD0Count: 0;
    curveD1Count: 0;
    surfaceD0Count: 0;
    surfaceD1Count: 0;
    sourceCompilationCount: 0;
    rootSolveCount: 0;
    rationalFloatConversionCount: 0;
};
type Callbacks = {
    beginQuery(queryIndex: number): void;
    beginStage(stage: Stage): void;
    retainQuery(classification: Classification, proof: QueryProof): void;
    fail(code: 'BINDING' | 'DOMAIN', detail: string, cause?: unknown): never;
};
export type PairedMaterialWorldSource = SourceDefinition;
export type PairedMaterialWorldClassification = Classification;
export type PairedMaterialWorldQueryProof = QueryProof;
export type PairedMaterialWorldProof = Proof;
export type PairedMaterialWorldDirectCounts = DirectCounts;
/** Exact World predicates on one publicly validated complete material Body. */
export declare function classifyPairedSurfaceMaterialBodyWorldQueriesTrusted(body: PairedSurfaceMaterialBodyResult, queries: PairedSurfaceMaterialBodyWorldPointQuery[], q: SectionRationalContext, counts: DirectCounts, callbacks: Callbacks): {
    source: SourceDefinition;
    classifications: Classification[];
    queries: QueryProof[];
};
export {};
