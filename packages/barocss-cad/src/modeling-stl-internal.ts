import { tessellateConvexPlanarSolid } from './planar-solids/convex-planar-solid-mesh.js';
import type { ConvexPlanarSolidMeshResult } from './planar-solids/convex-planar-solid-mesh.js';
import type { ConvexPlanarSolidResult } from './convex-planar-solid.js';
import { MassLedger, MASS_LIMITS, ConvexPlanarSolidMassError } from './planar-solids/convex-planar-solid-mass-internal.js';
import { encodeQualifiedStripBinaryStlTrusted } from './qualified-strip-binary-stl-encoding-internal.js';
import type { QualifiedStlCounts, QualifiedStlEncodingResult, QualifiedStlGeometry } from './qualified-strip-binary-stl-encoding-internal.js';
import { SectionRationalContext } from './section-rational-internal.js';

type ExactWork = ReturnType<SectionRationalContext['counts']>;
type Stage = 'mesh' | 'projection' | 'loss' | 'facet' | 'encoding' | 'snapshot';
type Code = 'NATIVE' | 'BINDING' | 'REPRESENTABILITY' | 'COLLAPSE' | 'NORMAL' | 'BUDGET';
type DirectCalls = { tessellationCount: number; separateMeshValidationCount: 0; retries: 0 };
type Progress = {
  native: ConvexPlanarSolidMeshResult | null;
  vertexLosses: QualifiedStlEncodingResult['vertexLosses'];
  facets: QualifiedStlEncodingResult['facets'];
  bytes: null;
};
type Context = {
  vertexIndex: number | null; triangleIndex: number | null;
  directCalls: DirectCalls; directCounts: QualifiedStlCounts; rationalCounts: ExactWork;
};

/** Private refusal retains the original cause and completed bounded evidence, never STL bytes. */
export class ModelingStlError extends Error {
  constructor(readonly code: Code, readonly stage: Stage, detail: string,
    readonly context: Context, readonly progress: Progress, cause?: unknown) {
    super(('Modeling binary STL: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'ModelingStlError';
  }
}

export interface ModelingStlReport {
  schema: 'barocss-modeling-binary-stl'; version: 0; solidId: string;
  format: 'binary-stl'; byteOrder: 'little-endian'; lengthUnit: 'mm';
  unitSource: 'caller-convention-not-stl-metadata'; sourceFrame: 'authored-xyz-no-axis-conversion';
  headerASCII: 'BaroCSS binary STL | mm convention | approximate facets';
  positionEncoding: 'float32'; byteEncoding: 'dense-uint8-number-array'; attributePolicy: 'zero-no-colors';
  normalSource: 'approximate-quantized-triangle-geometry'; vertexCount: number; triangleCount: number; byteLength: number;
  directCalls: DirectCalls; directCounts: QualifiedStlCounts; rationalCounts: ExactWork;
  inheritedMeshReport: ConvexPlanarSolidMeshResult['report'];
  parentNativeWork: ConvexPlanarSolidMeshResult['report']['parentNativeWork'];
  stages: {
    native: 'complete-convex-parent-reconstruction-and-stored-face-fans';
    projection: 'original-vertices-indices-and-native-face-ranges';
    loss: 'all-original-vertices-compared';
    facets: 'all-quantized-crosses-nonzero-and-normals-aligned';
    encoding: 'complete-deterministic-binary-stl'; snapshot: 'bounded-complete-independent-data';
  };
  numericPolicy: {
    source: 'whole-validated-binary64-native-mesh'; coordinates: 'Math.fround-no-transform';
    loss: 'exact-rational-components-and-squared-distance-plus-measured-hypot';
    collapse: 'exact-zero-cross-after-float32-quantization'; normal: 'approximate-unit-float32-with-exact-positive-cross-dot';
    originalTriangleOrderPreserved: true; originalIndexedVertexMappingRetained: true;
    resampling: false; recentering: false; rescaling: false; welding: false; snapPerformed: false;
  };
  quality: {
    wholeNativeParentValidated: true; originalMeshRetained: true; parentFlagsUnchanged: true;
    allOriginalVerticesCompared: true; float32LossMeasured: true; exactQuantizedCollapseChecked: true;
    serializationCertified: true; approximateFacets: true; approximateNormals: true;
    nativeIdentityEmbedded: false; nativeUnitsMetadataEmbedded: false; nativeUVTrimsEmbedded: false;
    editableTopologyEmbedded: false; globalTopologyPreservationCertified: false;
    originalSolidOrientationAfterQuantizationCertified: false; stlWatertightnessCertified: false;
    stlManifoldCertified: false; stlEmbeddedSolidCertified: false; globalApproximationErrorCertified: false;
    manufacturingToleranceCertified: false; slicerAcceptance: false; rendererAcceptance: false;
    fileWrittenByAPI: false; fileReadByAPI: false; downloadStartedByAPI: false;
    publication: false; ownership: 'independent-copied-cpu-data-gc';
  };
  limits: {
    faces: 12; meshVertices: 64; triangles: 40; binaryBytes: 2084;
    rationalOperations: 200000; gcdSteps: 200000; integerBits: 8192; normalUnitResidual: 1e-5;
    data: typeof MASS_LIMITS;
  };
  workScope: 'one-convex-tessellation-with-full-parent-validation-and-zero-native-encoding-work';
  hiddenTransitiveNativeWork: 'not-measured';
  dataCharge: 'unchanged-mass-ledger-alias-occurrence-counted-serialized-data-not-v8-heap';
  budgetFailure: 'atomic-no-partial-binary-stl';
}

/** The primary model facade freezes this complete independent result for its caller. */
export interface ModelingStlResult {
  native: ConvexPlanarSolidMeshResult;
  encoding: QualifiedStlEncodingResult & { directCounts: QualifiedStlCounts; rationalCounts: ExactWork };
  report: ModelingStlReport;
}

function counts(): QualifiedStlCounts {
  return { meshValidationCount: 0, vertexCount: 0, coordinateFloat32RoundCount: 0,
    triangleCount: 0, normalFloat32RoundCount: 0, exactCrossCount: 0, normalAlignmentCount: 0,
    encodedFloat32Count: 0, encodedAttributeCount: 0, encodedByteCount: 0,
    curveD0Count: 0, curveD1Count: 0, surfaceD0Count: 0, surfaceD1Count: 0,
    sourceCompilationCount: 0, rootSolveCount: 0, rationalFloatConversionCount: 0,
    fileWriteCount: 0, fileReadCount: 0 };
}

/** One genuine convex mesh construction, followed only by bounded geometry encoding. */
export function buildModelingStl(solid: ConvexPlanarSolidResult): ModelingStlResult {
  const ledger = new MassLedger(), directCounts = counts();
  const directCalls: DirectCalls = { tessellationCount: 0, separateMeshValidationCount: 0, retries: 0 };
  let stage: Stage = 'mesh', vertexIndex: number | null = null, triangleIndex: number | null = null;
  let rational: SectionRationalContext | null = null;
  let progress: Progress = { native: null, vertexLosses: [], facets: [], bytes: null };
  const exactWork = (): ExactWork => rational?.counts() ?? { operations: 0, gcdSteps: 0, floatSearchSteps: 0, floatConversions: 0, maximumObservedBits: 0 };
  const fail = (code: Code, detail: string, cause?: unknown): never => {
    throw new ModelingStlError(code, stage, detail,
      { vertexIndex, triangleIndex, directCalls: { ...directCalls }, directCounts: { ...directCounts }, rationalCounts: exactWork() },
      progress, cause);
  };
  const check = (condition: boolean, code: Code, detail: string): void => { if (!condition) fail(code, detail); };
  try {
    directCalls.tessellationCount++;
    // This provider performs the one complete parent reconstruction. Do not call
    // validateConvexPlanarSolidMesh or manufacture a qualified-strip certificate.
    const native = tessellateConvexPlanarSolid(solid, { maximumFanTriangles: 40 });
    progress = { ...progress, native };
    stage = 'projection';
    const { mesh } = native, vertexCount = mesh.vertices.length, triangleCount = mesh.indices.length / 3;
    check(mesh.faces.length >= 4 && mesh.faces.length <= 12 && vertexCount >= 4 && vertexCount <= 64
      && Number.isInteger(triangleCount) && triangleCount > 0 && triangleCount <= 40
      && mesh.positionsMM.length === 3 * vertexCount && 84 + 50 * triangleCount <= 2084,
    'BUDGET', 'The complete convex mesh must remain within12 Faces/64 vertices/40 triangles/2084 bytes');
    check(native.report.vertexCount === vertexCount && native.report.triangleCount === triangleCount
      && native.report.faceCount === mesh.faces.length, 'BINDING', 'Native report must cover the complete projected mesh');
    const vertices = mesh.vertices.map((_, index) => ({ index,
      point: [mesh.positionsMM[3 * index], mesh.positionsMM[3 * index + 1], mesh.positionsMM[3 * index + 2]] }));
    const triangles: { index: number; faceId: string; vertexIndices: [number, number, number] }[] = [];
    let vertexOffset = 0, indexOffset = 0;
    for (const face of mesh.faces) {
      check(face.vertexOffset === vertexOffset && face.indexOffset === indexOffset
        && Number.isInteger(face.vertexCount) && face.vertexCount >= 3 && face.vertexCount <= 8
        && face.indexCount === 3 * (face.vertexCount - 2)
        && vertexOffset + face.vertexCount <= vertexCount && indexOffset + face.indexCount <= mesh.indices.length,
      'BINDING', 'Every original native Face must retain its complete ordered vertex and triangle ranges');
      for (let offset = vertexOffset; offset < vertexOffset + face.vertexCount; offset++) {
        const vertex = mesh.vertices[offset];
        check(vertex.sourceId === face.sourceId && vertex.faceId === face.faceId
          && vertex.surfaceId === face.surfaceId && vertex.loopId === face.loopId,
        'BINDING', 'Projected vertices must belong to their actual source-qualified native Face');
      }
      for (let offset = indexOffset; offset < indexOffset + face.indexCount; offset += 3) {
        const vertexIndices: [number, number, number] = [mesh.indices[offset], mesh.indices[offset + 1], mesh.indices[offset + 2]];
        check(vertexIndices.every(index => Number.isInteger(index) && index >= vertexOffset && index < vertexOffset + face.vertexCount),
          'BINDING', 'Each original ordered triangle must remain within its actual native Face range');
        triangles.push({ index: offset / 3, faceId: face.faceId, vertexIndices });
      }
      vertexOffset += face.vertexCount; indexOffset += face.indexCount;
    }
    check(vertexOffset === vertexCount && indexOffset === mesh.indices.length && triangles.length === triangleCount,
      'BINDING', 'The geometry projection must cover every original native vertex and triangle exactly once');
    // Only these geometry fields cross the seam. All native topology, flags and
    // domains remain in native, without being rebranded as another mesh family.
    const geometry: QualifiedStlGeometry = { positionsMM: mesh.positionsMM, indices: mesh.indices, vertices, triangles };
    ledger.copy({ native, geometry });
    rational = new SectionRationalContext((code, detail) => fail(code, detail));
    const encoded = encodeQualifiedStripBinaryStlTrusted(geometry, rational, directCounts, {
      beginVertex(index) { stage = 'loss'; vertexIndex = index; triangleIndex = null; },
      beginTriangle(index) { stage = 'facet'; vertexIndex = null; triangleIndex = index; },
      beginEncoding() { stage = 'encoding'; vertexIndex = null; triangleIndex = null; },
      retainPhase(data) {
        // Retain only a fully guarded phase. A refused facet or binary write
        // cannot expose partial bytes, including when the final snapshot fails.
        // The completed byte array is charged with the whole final result below;
        // the already retained facet phase is sufficient for later refusals.
        if (data.bytes === null) progress = ledger.copy({ native, vertexLosses: data.vertexLosses, facets: data.facets, bytes: null });
      },
      fail,
    });
    const encoding: ModelingStlResult['encoding'] = { ...encoded, directCounts: { ...directCounts }, rationalCounts: exactWork() };
    const report: ModelingStlReport = {
      schema: 'barocss-modeling-binary-stl', version: 0, solidId: native.report.solidId,
      format: 'binary-stl', byteOrder: 'little-endian', lengthUnit: 'mm', unitSource: 'caller-convention-not-stl-metadata',
      sourceFrame: 'authored-xyz-no-axis-conversion', headerASCII: 'BaroCSS binary STL | mm convention | approximate facets',
      positionEncoding: 'float32', byteEncoding: 'dense-uint8-number-array', attributePolicy: 'zero-no-colors',
      normalSource: 'approximate-quantized-triangle-geometry', vertexCount, triangleCount, byteLength: encoding.bytes.length,
      directCalls: { ...directCalls }, directCounts: { ...directCounts }, rationalCounts: exactWork(),
      inheritedMeshReport: native.report, parentNativeWork: native.report.parentNativeWork,
      stages: { native: 'complete-convex-parent-reconstruction-and-stored-face-fans',
        projection: 'original-vertices-indices-and-native-face-ranges', loss: 'all-original-vertices-compared',
        facets: 'all-quantized-crosses-nonzero-and-normals-aligned', encoding: 'complete-deterministic-binary-stl',
        snapshot: 'bounded-complete-independent-data' },
      numericPolicy: { source: 'whole-validated-binary64-native-mesh', coordinates: 'Math.fround-no-transform',
        loss: 'exact-rational-components-and-squared-distance-plus-measured-hypot',
        collapse: 'exact-zero-cross-after-float32-quantization', normal: 'approximate-unit-float32-with-exact-positive-cross-dot',
        originalTriangleOrderPreserved: true, originalIndexedVertexMappingRetained: true,
        resampling: false, recentering: false, rescaling: false, welding: false, snapPerformed: false },
      quality: { wholeNativeParentValidated: true, originalMeshRetained: true, parentFlagsUnchanged: true,
        allOriginalVerticesCompared: true, float32LossMeasured: true, exactQuantizedCollapseChecked: true,
        serializationCertified: true, approximateFacets: true, approximateNormals: true,
        nativeIdentityEmbedded: false, nativeUnitsMetadataEmbedded: false, nativeUVTrimsEmbedded: false,
        editableTopologyEmbedded: false, globalTopologyPreservationCertified: false,
        originalSolidOrientationAfterQuantizationCertified: false, stlWatertightnessCertified: false,
        stlManifoldCertified: false, stlEmbeddedSolidCertified: false, globalApproximationErrorCertified: false,
        manufacturingToleranceCertified: false, slicerAcceptance: false, rendererAcceptance: false,
        fileWrittenByAPI: false, fileReadByAPI: false, downloadStartedByAPI: false,
        publication: false, ownership: 'independent-copied-cpu-data-gc' },
      limits: { faces: 12, meshVertices: 64, triangles: 40, binaryBytes: 2084,
        rationalOperations: 200000, gcdSteps: 200000, integerBits: 8192, normalUnitResidual: 1e-5, data: MASS_LIMITS },
      workScope: 'one-convex-tessellation-with-full-parent-validation-and-zero-native-encoding-work',
      hiddenTransitiveNativeWork: 'not-measured', dataCharge: 'unchanged-mass-ledger-alias-occurrence-counted-serialized-data-not-v8-heap',
      budgetFailure: 'atomic-no-partial-binary-stl',
    };
    stage = 'snapshot';
    return ledger.copy({ native, encoding, report });
  } catch (cause) {
    if (cause instanceof ModelingStlError) throw cause;
    return fail(cause instanceof ConvexPlanarSolidMassError && cause.code === 'BUDGET' ? 'BUDGET' : 'NATIVE',
      cause instanceof Error ? cause.message : 'Native mesh or encoding refused', cause);
  }
}
