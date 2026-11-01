import type { QualifiedTranslatedStripBodyResult } from './qualified-translated-strip-body.js';
import type { Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const QualifiedTranslatedStripBodyMeshDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly BUDGET: "BUDGET";
    readonly BODY: "BODY";
    readonly SOURCE: "SOURCE";
    readonly TOPOLOGY: "TOPOLOGY";
    readonly UV: "UV";
    readonly NATIVE: "NATIVE";
    readonly ORIENTATION: "ORIENTATION";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly FILE: "FILE";
    readonly OWNED: "OWNED";
}>;
export type QualifiedTranslatedStripBodyMeshDiagnosticCode = typeof QualifiedTranslatedStripBodyMeshDiagnosticCode[keyof typeof QualifiedTranslatedStripBodyMeshDiagnosticCode];
export declare class QualifiedTranslatedStripBodyMeshError extends KernelError {
    readonly code: QualifiedTranslatedStripBodyMeshDiagnosticCode;
    constructor(code: QualifiedTranslatedStripBodyMeshDiagnosticCode, detail: string, cause?: unknown);
}
export interface QualifiedTranslatedStripBodyMeshOptions {
    evaluationId: string;
    meshId: string;
    subdivisionsPerOriginalUSpan: 4;
    subdivisionsT: 4;
    subdivisionsW: 4;
    maximumVertices: 290;
    maximumTriangles: 576;
    maximumNativeSamples: 1104;
}
type Face = QualifiedTranslatedStripBodyResult['faces'][number];
type Edge = QualifiedTranslatedStripBodyResult['edges'][number];
type FaceRole = Face['role'];
type Ref = Face['supportRef'];
type UV = [number, number];
type Key = [number, number, number];
type Vertex = {
    index: number;
    key: Key;
    point: Point;
    kind: 'stored-corner' | 'native-edge' | 'native-face';
    globalVertexId: string | null;
    globalEdgeId: string | null;
    faceId: string | null;
    sourceRef: Ref | null;
    edgeSampleIndex: number | null;
    faceSampleIndex: number | null;
};
type Triangle = {
    index: number;
    faceId: string;
    role: FaceRole;
    cell: [number, number];
    withinCell: 0 | 1;
    vertexIndices: [number, number, number];
    faceSampleIndices: [number, number, number];
};
type EdgeSample = {
    index: number;
    parameter: number;
    vertexIndex: number;
    point: Point;
    endpointVertexId: string | null;
    storedCorner: Point | null;
    endpointGapMM: number | null;
};
type UseSample = {
    index: number;
    parameter: number;
    vertexIndex: number;
    uv: UV;
    curvePoint: Point;
};
type UseSamples = {
    useId: string;
    faceId: string;
    loopId: string;
    sense: Edge['uses'][number]['sense'];
    interval: [number, number];
    pcurveId: string;
    origin: Edge['uses'][number]['origin'];
    samples: UseSample[];
};
type EdgePath = {
    edgeId: string;
    role: Edge['role'];
    curveId: string;
    curveRef: Ref;
    vertexIds: [string, string];
    parameterRange: [number, number];
    logicalDirection: 'increasing' | 'decreasing';
    samples: EdgeSample[];
    uses: UseSamples[];
};
type D1State = {
    status: 'evaluated';
    point: Point;
    du: Point;
    dv: Point;
    orientedNormal: Point;
    pointGapMM: number;
} | {
    status: 'refused-c0';
    name: string;
    reason: string;
    point: null;
    du: null;
    dv: null;
    orientedNormal: null;
    pointGapMM: null;
};
type FaceSample = {
    index: number;
    faceId: string;
    role: FaceRole;
    supportRef: Ref;
    grid: [number, number];
    vertexIndex: number;
    nominalUV: UV;
    uv: UV;
    boundaryUseSamples: {
        edgeId: string;
        useId: string;
        sampleIndex: number;
    }[];
    chosenUseId: string | null;
    alternateUVGap: number | null;
    point: Point;
    anchorPoint: Point;
    anchorGapMM: number;
    d1: D1State;
};
type RenderChunk = {
    faceId: string;
    role: FaceRole;
    orientation: Face['orientation'];
    normalSource: 'approximate-triangle-geometry';
    positionEncoding: 'float32-number';
    normalEncoding: 'float32-number';
    uvEncoding: 'binary64-number';
    indexEncoding: 'uint32-number';
    positionsMM: number[];
    normals: number[];
    parametersUV: number[];
    indices: number[];
    authorityIndices: number[];
    faceSampleIndices: number[];
    triangleIndices: number[];
    quantizationGapsMM: number[];
};
type SourceCatalog = {
    sourceId: string;
    sourceModelId: string;
    objectId: string;
    kind: 'Curve' | 'Surface';
    globalEdgeIds: string[];
    faceIds: string[];
};
type BoundaryPath = {
    edgeId: string;
    useId: string;
    pcurveId: string;
    sense: Edge['uses'][number]['sense'];
    interval: [number, number];
    vertexIndices: number[];
};
type FaceRange = {
    faceId: string;
    role: FaceRole;
    orientation: Face['orientation'];
    supportRef: Ref;
    origin: Face['origin'];
    materialImageRole: FaceRole;
    chart: 'u-t' | 'u-w' | 't-w';
    gridSize: [number, number];
    sampleRange: [number, number];
    triangleRange: [number, number];
    vertexIndices: number[];
    storedUseIds: string[];
    boundaryPaths: BoundaryPath[];
};
type TriangleUse = {
    triangleIndex: number;
    side: 0 | 1 | 2;
    from: number;
    to: number;
};
type EdgeIncidence = {
    vertexIndices: [number, number];
    uses: [TriangleUse, TriangleUse];
    kind: 'face-grid' | 'face-diagonal' | 'cad-edge';
    globalEdgeId: string | null;
};
type VertexLink = {
    vertexIndex: number;
    cycle: number[];
    triangleIndices: number[];
    globalVertexId: string | null;
    globalEdgeId: string | null;
};
type Proof = {
    sourceCatalog: SourceCatalog[];
    faceRanges: FaceRange[];
    edgeIncidence: EdgeIncidence[];
    vertexLinks: VertexLink[];
    connectedTriangles: true;
    connectedVertices: true;
    eulerCharacteristic: 2;
    parentMaterialCertificateId: string;
    parentFlagsUnchanged: true;
};
export interface QualifiedTranslatedStripBodyMeshPacket {
    schema: 'barocss-qualified-translated-strip-body-mesh';
    version: 0;
    meshId: string;
    bodyId: string;
    shellId: string;
    materialCertificateId: string;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    positionEncoding: 'binary64-number';
    indexEncoding: 'uint32-number';
    positionsMM: number[];
    indices: number[];
    vertices: Vertex[];
    triangles: Triangle[];
    bounds: {
        min: Point;
        max: Point;
    };
}
type DirectCounts = {
    bodyValidationCount: 1;
    worldCurveD0Count: number;
    usePCurveD0Count: number;
    surfaceD0Count: number;
    surfaceD1AttemptCount: number;
    surfaceD1EvaluatedCount: number;
    surfaceD1RefusedCount: number;
    nativeAttemptCount: number;
    curveD1Count: 0;
    surfaceD2Count: 0;
    sourceCompilationCount: 0;
    sourceWriterCount: 0;
    newBodyConstructionCount: 0;
    rationalFloatConversionCount: 0;
    rootSolverCount: 0;
    refinementCount: 0;
};
type Quality = {
    trimmedSixFaceSamples: true;
    sourceQualified: true;
    closedIndexedManifold: true;
    parentFlagsUnchanged: true;
    approximateTriangles: true;
    facetNormalsApproximate: true;
    float32DisplayValidated: true;
    storedCornerAuthority: true;
    welding: false;
    snapping: false;
    meshGeometricEmbedding: false;
    globalApproximationError: false;
    newSolidCertification: false;
    manufacturing: false;
    rendererAcceptance: false;
    loaderAcceptance: false;
    publication: false;
    ownership: 'independent-copied-cpu-data-gc';
};
type Limits = {
    maximumOriginalSpans: 4;
    subdivisionsPerOriginalUSpan: 4;
    subdivisionsT: 4;
    subdivisionsW: 4;
    maximumUStations: 17;
    maximumVertices: 290;
    maximumTriangles: 576;
    maximumMeshEdges: 864;
    maximumFaceSamples: 390;
    maximumUseSamples: 216;
    maximumNativeAttempts: 1104;
    maximumRenderVertices: 1728;
    maximumFileUTF16: 4194304;
    maximumFileUTF8: 4194304;
    parentBodyMaximumFileUTF16: 2097152;
    parentBodyMaximumFileUTF8: 2097152;
    ownValues: 4194304;
    ownDepth: 64;
    arrayElements: 8192;
    recordFields: 64;
    keyCharacters: 128;
    stringCharacters: 262144;
    identifierCharacters: 48;
    maximumObservedGapMM: 1e-7;
    normalUnitResidual: 1e-5;
};
export interface QualifiedTranslatedStripBodyMeshReport {
    schema: 'barocss-qualified-translated-strip-body-mesh-report';
    version: 0;
    evaluationId: string;
    meshId: string;
    bodyId: string;
    shellId: string;
    materialCertificateId: string;
    spanCount: number;
    uStationCount: number;
    vertexCount: number;
    triangleCount: number;
    meshEdgeCount: number;
    faceCount: 6;
    cadEdgeCount: 12;
    cornerCount: 8;
    edgeInteriorCount: number;
    faceInteriorCount: number;
    faceSampleCount: number;
    useSampleCount: number;
    renderVertexCount: number;
    nativeNormalEvaluatedCount: number;
    nativeNormalRefusedCount: number;
    maximumObservedEndpointGapMM: number;
    maximumObservedAnchorGapMM: number;
    maximumObservedD1PointGapMM: number;
    maximumObservedAlternateUVGap: number;
    maximumObservedFloat32QuantizationGapMM: number;
    fileSizes: {
        request: {
            utf16: number;
            utf8: number;
        };
        result: {
            utf16: number;
            utf8: number;
        };
    };
    directCounts: DirectCounts;
    quality: Quality;
    limits: Limits;
    workScope: 'new-root-native-attempts-parent-validation-work-retained-and-excluded';
    budgetFailure: 'atomic-no-partial-mesh';
}
export interface QualifiedTranslatedStripBodyMeshResult {
    body: QualifiedTranslatedStripBodyResult;
    options: QualifiedTranslatedStripBodyMeshOptions;
    packet: QualifiedTranslatedStripBodyMeshPacket;
    edgePaths: EdgePath[];
    faceSamples: FaceSample[];
    renderChunks: RenderChunk[];
    proof: Proof;
    report: QualifiedTranslatedStripBodyMeshReport;
}
/** Approximate the actual six trimmed Faces while retaining complete qualified Body authority. */
export declare function tessellateQualifiedTranslatedStripBody(bodyInput: QualifiedTranslatedStripBodyResult, optionsInput: QualifiedTranslatedStripBodyMeshOptions): QualifiedTranslatedStripBodyMeshResult;
/** Rebuild the complete Body, native cache, six charts, discrete proof and actual display projection. */
export declare function validateQualifiedTranslatedStripBodyMesh(input: QualifiedTranslatedStripBodyMeshResult): QualifiedTranslatedStripBodyMeshReport;
export {};
