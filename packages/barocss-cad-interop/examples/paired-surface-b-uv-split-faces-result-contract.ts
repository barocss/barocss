// Compile-only public type consumer. These function bodies are never invoked.
import {
  parseBaroCadPairedSurfaceBUVSplitFacesResult,
  readBaroCadPairedSurfaceBUVSplitFacesResult,
  BaroCadPairedSurfaceBUVSplitFacesReadError,
  BaroCadPairedSurfaceBUVSplitFacesDiagnosticCode,
  type BaroCadPairedSurfaceBUVSplitFacesResultRead,
} from '@barocss/cad-interop/paired-surface-b-uv-split-faces-result';
import {
  PairedSurfaceBUVSplitFacesError,
  type PairedSurfaceBUVSplitFacesResult,
  type PairedSurfaceBUVSplitFacesReport,
  type PairedSurfaceBUVSplitFacesRequest,
  type PairedSurfaceBUVSplitFacesOptions,
  type Model, type Curve, type Surface, type Point,
  type CurveD1Result, type SurfaceD1Result,
} from '@barocss/cad';

type Read = BaroCadPairedSurfaceBUVSplitFacesResultRead;
type Native = PairedSurfaceBUVSplitFacesResult;
type Parent = Native['request']['section'];
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type ExactSurfaceChecks = [
  Assert<Equal<keyof Read, 'native' | 'validationReport' | 'profile' | 'sourceText'>>,
  Assert<Equal<keyof Native, 'request' | 'isoCurves' | 'intervals' | 'world' | 'vertices' | 'edges' | 'loops' | 'faces' | 'proof' | 'observations' | 'report'>>,
  Assert<Equal<keyof PairedSurfaceBUVSplitFacesRequest, 'section' | 'options'>>,
  Assert<Equal<keyof PairedSurfaceBUVSplitFacesOptions, 'evaluationId' | 'resultIdPrefix' | 'orientation' | 'maximumIsoCurves' | 'maximumIntervals' | 'maximumObservations'>>,
  Assert<Equal<BaroCadPairedSurfaceBUVSplitFacesDiagnosticCode, 'INPUT' | 'JSON' | 'OWNED' | 'BUDGET' | 'SCHEMA' | 'NATIVE'>>,
  Assert<Equal<keyof Read['profile'], "schema" | "version" | "nativeSchema" | "nativeVersion" | "sourceFrame" | "worldLengthUnit" | "uvLengthUnit" | "parameterFrame" | "sourceQualification" | "ownership" | "faceScope" | "d1Representation" | "nativeRequestBytes" | "limits" | "capabilities">>,
  Assert<Equal<keyof Read['profile']['limits'], "utf8Bytes" | "utf16Units" | "values" | "depth" | "recordFields" | "arrayElements" | "stringUnits" | "keyUnits">>,
  Assert<Equal<keyof Read['profile']['capabilities'], "nativeWholeValidation" | "copiedWholeReceipt" | "renderer" | "url" | "byteInput" | "publicSerializer" | "dispose" | "sourceEdit" | "sampling" | "intersectionConstruction" | "isoCurveConstruction" | "intervalExtraction" | "faceConstruction" | "aSurfaceSplit" | "topologyConstruction" | "body" | "solid" | "globalError" | "manufacturing" | "persistentNaming" | "editor" | "publication">>,
  Assert<Equal<keyof Parent, 'request' | 'originalModels' | 'world' | 'pcurves' | 'proof' | 'observations' | 'report'>>,
];

export function publicSignatures(text: string, unknownInput: unknown) {
  const exactKeys: ExactSurfaceChecks = [true, true, true, true, true, true, true, true, true];
  const parse: (value: string) => Read = parseBaroCadPairedSurfaceBUVSplitFacesResult;
  const read: (value: unknown) => Read = readBaroCadPairedSurfaceBUVSplitFacesResult;
  const parsed: Read = parse(text), owned: Read = read(unknownInput);
  const native: Native = owned.native;
  const report: PairedSurfaceBUVSplitFacesReport = parsed.validationReport;
  const sourceText: string | null = parsed.sourceText;
  // unknown input accepts arrays at compile time; runtime INPUT refusal is a separate proof.
  const unknownArray: Read = readBaroCadPairedSurfaceBUVSplitFacesResult([]);
  // @ts-expect-error Public text parsing requires a primitive string.
  parseBaroCadPairedSurfaceBUVSplitFacesResult({});
  // @ts-expect-error Owned admission may retain sourceText null.
  const nonnullableText: string = owned.sourceText;
  void [exactKeys, parse, read, parsed, owned, native, report, sourceText, unknownArray, nonnullableText];
}

export function completeNative(read: Read) {
  const native: Native = read.native, report: PairedSurfaceBUVSplitFacesReport = read.validationReport;
  const request: PairedSurfaceBUVSplitFacesRequest = native.request;
  const options: PairedSurfaceBUVSplitFacesOptions = request.options;
  const isoCap: 2 = options.maximumIsoCurves, intervalCap: 2 = options.maximumIntervals, observationCap: 35 = options.maximumObservations;
  const orientation: 'forward' | 'reverse' = options.orientation;
  const parent: Parent = request.section;
  const originalA: Model = parent.originalModels[0], originalB: Model = parent.originalModels[1];
  const surfaceA: Surface = parent.request.assets[0].surface, surfaceB: Surface = parent.request.assets[1].surface;
  const sourceA: string = parent.request.assets[0].source, sourceB: string = parent.request.assets[1].source;
  const originalUV_A: Curve = parent.pcurves.a.curve, originalUV_B: Curve = parent.pcurves.b.curve;
  const parentWorldCurve: Curve = parent.world.curve;
  const parentCurveD1: CurveD1Result = parent.observations[0].world.d1;
  const parentSurfaceD1: SurfaceD1Result = parent.observations[0].surfaceA.d1;
  const parentSurfaceD1B: SurfaceD1Result = parent.observations[0].surfaceB.d1;
  const parentDerivative: Point = parentCurveD1.derivative;
  const parentDu: Point = parentSurfaceD1.du, parentDv: Point = parentSurfaceD1.dv;
  const isoChildren: Native['isoCurves'] = native.isoCurves;
  const intervalChildren: Native['intervals'] = native.intervals;
  const isoReceipt: Native['isoCurves'][number] = isoChildren[0];
  const intervalReceipt: Native['intervals'][number] = intervalChildren[0];
  const isoReport: Native['isoCurves'][number]['report'] = isoReceipt.report;
  const intervalReport: Native['intervals'][number]['report'] = intervalReceipt.report;
  const world: Native['world'] = native.world;
  const worldSource: string = world.source, worldModel: Model = world.model;
  const worldVersion: 0 = world.sourceVersion;
  const vertices: Native['vertices'] = native.vertices, edges: Native['edges'] = native.edges;
  const vertex: Native['vertices'][number] = vertices[0];
  const worldPoint: Point = vertex.world, uvPoint: Point = vertex.uv;
  const edge: Native['edges'][number] = edges[0];
  const edgeCurve: Curve = edge.curve;
  const edgeOrigin: Native['edges'][number]['origin'] = edge.origin;
  const edgeVertices: [string, string] = edge.vertexIds;
  const sourceRef: Native['edges'][number]['sourceRef'] = edge.sourceRef;
  const sourceField: 'world.source' = sourceRef.sourceField;
  const modelField: 'world.model' = sourceRef.modelField;
  const objectIndex: number = sourceRef.objectIndex, curveId: string = sourceRef.curveId;
  const pcurve: Curve = edge.pcurve.curve;
  const uvFrame: 'original-native-uv' = edge.pcurve.coordinateSystem;
  const uvUnit: 'dimensionless' = edge.pcurve.lengthUnit;
  const loop: Native['loops'][number] = native.loops[0];
  const use: Native['loops'][number]['uses'][number] = loop.uses[0];
  const sense: 'forward' | 'reverse' = use.sense;
  const useInterval: [number, number] = use.interval;
  const useVertices: [string, string] = use.vertexIds;
  const face: Native['faces'][number] = native.faces[0];
  const faceRegion: 'below-cut' | 'above-cut' = face.region;
  const faceLoopId: string = face.outerLoopId;
  const support: Native['proof']['support'] = native.proof.support;
  const supportSourceField: 'request.section.request.assets[1].source' = support.sourceField;
  const supportModelField: 'request.section.originalModels[1]' = support.modelField;
  const window: Native['proof']['window'] = native.proof.window;
  const projection: Native['proof']['projection'] = native.proof.projection;
  const projectionAuthority: true = projection.globallyInjectiveOnOriginalB;
  // Exact rational XZ proof data is separate from native SurfaceD1 or GPU normals.
  const nativeNormalY: Native['proof']['projection']['nativeNormalY'] = projection.nativeNormalY;
  const normalYNumerator: string = nativeNormalY.numerator, normalYDenominator: string = nativeNormalY.denominator;
  const xzDeterminant: Native['proof']['projection']['xzDeterminant'] = projection.xzDeterminant;
  const parameterMap: Native['proof']['parameterMap'] = native.proof.parameterMap;
  const originalUA: [number, number] = parameterMap.originalUAInterval;
  const originalUB: [number, number] = parameterMap.originalUBInterval;
  const positiveMap: true = parameterMap.positiveScale;
  const unchangedSharedUA: true = parameterMap.sharedCutOriginalUAUnchanged;
  const unchangedBoundaryUB: true = parameterMap.boundaryOriginalUBUnchanged;
  const ubCoefficients: Native['proof']['parameterMap']['uBCoefficients'] = parameterMap.uBCoefficients;
  const ubDerivatives: Native['proof']['parameterMap']['uBDerivative'] = parameterMap.uBDerivative;
  const ubEndpointResiduals: Native['proof']['parameterMap']['endpointResiduals'] = parameterMap.endpointResiduals;
  const reportOriginalUA: [number, number] = report.originalUAInterval;
  const reportUBMap: PairedSurfaceBUVSplitFacesReport['originalUBMap'] = report.originalUBMap;
  const offsetNumerator: string = reportUBMap.offset.numerator, scaleNumerator: string = reportUBMap.scale.numerator;
  const cut: Native['proof']['cut'] = native.proof.cut;
  const cutDegree: 4 = cut.degree;
  const restrictions: Native['proof']['restrictions'] = native.proof.restrictions;
  const connectors: Native['proof']['connectors'] = native.proof.connectors;
  const edgeProof: Native['proof']['edges'][number] = native.proof.edges[0];
  const coefficientGrid: Native['proof']['edges'][number]['composedSurfaceCartesian'] = edgeProof.composedSurfaceCartesian;
  const residualGrid: Native['proof']['edges'][number]['residuals'] = edgeProof.residuals;
  const proofDegree: 4 = edgeProof.proofDegree;
  const regions: Native['proof']['uvRegions'] = native.proof.uvRegions;
  const uvAreaUnit: 'dimensionless-uv2' = regions.areaUnit;
  const outsideWindowUnclaimed: true = regions.outsideWindowUnclaimed;
  const sumResidual: Native['proof']['uvRegions']['sumResidual'] = regions.sumResidual;
  const numerator: string = sumResidual.numerator, denominator: string = sumResidual.denominator;
  const certificates: Native['proof']['faceCertificates'] = native.proof.faceCertificates;
  const closedDisk: true = certificates[0].closedDiskCertified;
  const actualProjection: true = certificates[0].originalXZProjectionAuthority;
  const reportSchema: 'barocss-paired-surface-b-uv-split-faces' = report.schema;
  const reportVersion: 0 = report.version;
  const countVertices: 6 = report.vertexCount, countEdges: 7 = report.edgeCount;
  const countFaces: 2 = report.faceCount, countLoops: 2 = report.loopCount, countUses: 8 = report.useCount, countWorld: 8 = report.worldObjectCount;
  const nativeRequestCap: 4194304 = report.limits.requestBytes, nativeResultCap: 16777216 = report.limits.resultBytes;
  const nativeD1Cap: 210 = report.limits.maximumNativeObservationAttempts;
  const conversionCap: 0 = report.limits.maximumRationalFloatConversions;
  const directCounts: PairedSurfaceBUVSplitFacesReport['directCounts'] = report.directCounts;
  const inheritedCounts: PairedSurfaceBUVSplitFacesReport['inheritedCounts'] = report.inheritedCounts;
  const derivativeCounts: PairedSurfaceBUVSplitFacesReport['derivativeCounts'] = report.derivativeCounts;
  const parentCalls: 1 = directCounts.parentValidationCount, isoCalls: 2 = directCounts.isoCurveExtractionCount;
  const localFace: true = report.quality.individualFaceEmbedded;
  const noASplit: false = report.quality.aSplitProduced, noSolid: false = report.quality.solid;
  const noVolume: false = report.quality.occupiedVolumeCertified, noArea: false = report.quality.worldSurfaceAreaComputed;
  // Native whole data and the separate actual Report remain mutable.
  native.world.source = native.world.source;
  native.request.options.maximumObservations = native.request.options.maximumObservations;
  native.loops[0].uses[0].sense = native.loops[0].uses[0].sense;
  native.edges[0].curve.controlPoints[0][0] = native.edges[0].curve.controlPoints[0][0];
  native.proof.uvRegions.sumResidual = native.proof.uvRegions.sumResidual;
  report.maximumObservedPointGapMM = report.maximumObservedPointGapMM;
  report.quality.solid = report.quality.solid;
  // @ts-expect-error There is no invented native root schema.
  void native.schema;
  // @ts-expect-error Original-B receipt does not add a Body root.
  void native.body;
  // @ts-expect-error Native supplied false qualification cannot become an A split.
  report.quality.aSplitProduced = true;
  // @ts-expect-error Native supplied false qualification cannot become a Solid.
  report.quality.solid = true;
  // @ts-expect-error Parent1499 D1 is direct, not an outer tagged D1 union.
  void parentCurveD1.status;
  // @ts-expect-error Actual SurfaceD1 point/du/dv has no normal field.
  void parentSurfaceD1.normal;
  void [isoCap, intervalCap, observationCap, orientation, originalA, originalB, surfaceA, surfaceB, sourceA, sourceB,
    originalUV_A, originalUV_B, parentWorldCurve, parentDerivative, parentDu, parentDv, isoReport, intervalReport,
    worldSource, worldModel, worldVersion, worldPoint, uvPoint, edgeCurve, edgeOrigin, edgeVertices,
    sourceField, modelField, objectIndex, curveId, pcurve, uvFrame, uvUnit, sense, useInterval, useVertices,
    faceRegion, faceLoopId, supportSourceField, supportModelField, window, projectionAuthority, cutDegree,
    restrictions, connectors, coefficientGrid, residualGrid, proofDegree, uvAreaUnit, outsideWindowUnclaimed,
    numerator, denominator, closedDisk, actualProjection, reportSchema, reportVersion, countVertices, countEdges,
    countFaces, countLoops, countUses, countWorld, nativeRequestCap, nativeResultCap, nativeD1Cap, conversionCap,
    inheritedCounts, derivativeCounts, parentCalls, isoCalls, localFace, noASplit, noSolid, noVolume, noArea,
    parentSurfaceD1B, normalYNumerator, normalYDenominator, xzDeterminant, originalUA, originalUB, positiveMap,
    unchangedSharedUA, unchangedBoundaryUB, ubCoefficients, ubDerivatives, ubEndpointResiduals, reportOriginalUA, offsetNumerator, scaleNumerator];
}

export function taggedDerivatives(native: Native) {
  const observation: Native['observations'][number] = native.observations[0];
  const chain: Point | null = observation.chain;
  const pointGap: number = observation.residuals.pointGapMM;
  const relativeGap: number | null = observation.residuals.relativeChainGap;
  const worldGap: number | null = observation.residuals.worldD0D1PointGapMM;
  const uvGap: number | null = observation.residuals.uvD0D1PointGap;
  const surfaceGap: number | null = observation.residuals.surfaceD0D1PointGapMM;
  if (observation.world.d1.status === 'evaluated') {
    const value: CurveD1Result = observation.world.d1.value;
    const derivative: Point = value.derivative;
    // @ts-expect-error Curve success branch does not carry refusal reason.
    void observation.world.d1.reason;
    void derivative;
  } else {
    const status: 'native-refused' = observation.world.d1.status;
    const reason: string = observation.world.d1.reason, errorName: string = observation.world.d1.nativeErrorName;
    // @ts-expect-error Native refusal has no successful or nullable value field.
    void observation.world.d1.value;
    void [status, reason, errorName];
  }
  if (observation.pcurve.d1.status === 'evaluated') {
    const derivative: Point = observation.pcurve.d1.value.derivative;
    void derivative;
  } else {
    const refusalName: string = observation.pcurve.d1.nativeErrorName;
    void refusalName;
  }
  if (observation.surface.d1.status === 'evaluated') {
    const value: SurfaceD1Result = observation.surface.d1.value;
    const point: Point = value.point, du: Point = value.du, dv: Point = value.dv;
    // @ts-expect-error Actual native Surface D1 has no normal.
    void value.normal;
    void [point, du, dv];
  } else {
    const reason: string = observation.surface.d1.reason, name: string = observation.surface.d1.nativeErrorName;
    // @ts-expect-error Refused Surface D1 has no value:null or successful value.
    void observation.surface.d1.value;
    void [reason, name];
  }
  // @ts-expect-error Without branch qualification, actual chain may be null.
  const requiredChain: Point = observation.chain;
  // @ts-expect-error Tagged outer D1 has no direct .du member.
  void observation.surface.d1.du;
  void [chain, pointGap, relativeGap, worldGap, uvGap, surfaceGap, requiredChain];
}

export function frozenProfile(read: Read) {
  const p: Read['profile'] = read.profile;
  const scalar_schema: "barocss-paired-surface-b-uv-split-faces-result-ingestion" = p.schema;
  // @ts-expect-error Frozen scalar schema rejects a same-value write.
  p.schema = p.schema;
  const scalar_version: 0 = p.version;
  // @ts-expect-error Frozen scalar version rejects a same-value write.
  p.version = p.version;
  const scalar_nativeSchema: "barocss-paired-surface-b-uv-split-faces" = p.nativeSchema;
  // @ts-expect-error Frozen scalar nativeSchema rejects a same-value write.
  p.nativeSchema = p.nativeSchema;
  const scalar_nativeVersion: 0 = p.nativeVersion;
  // @ts-expect-error Frozen scalar nativeVersion rejects a same-value write.
  p.nativeVersion = p.nativeVersion;
  const scalar_sourceFrame: "authored-xyz-no-axis-conversion" = p.sourceFrame;
  // @ts-expect-error Frozen scalar sourceFrame rejects a same-value write.
  p.sourceFrame = p.sourceFrame;
  const scalar_worldLengthUnit: "mm" = p.worldLengthUnit;
  // @ts-expect-error Frozen scalar worldLengthUnit rejects a same-value write.
  p.worldLengthUnit = p.worldLengthUnit;
  const scalar_uvLengthUnit: "dimensionless" = p.uvLengthUnit;
  // @ts-expect-error Frozen scalar uvLengthUnit rejects a same-value write.
  p.uvLengthUnit = p.uvLengthUnit;
  const scalar_parameterFrame: "original-b-u-window-and-unchanged-original-a-u-shared-cut" = p.parameterFrame;
  // @ts-expect-error Frozen scalar parameterFrame rejects a same-value write.
  p.parameterFrame = p.parameterFrame;
  const scalar_sourceQualification: "original-b-source-id-model-object-index-with-full-original-a-retained" = p.sourceQualification;
  // @ts-expect-error Frozen scalar sourceQualification rejects a same-value write.
  p.sourceQualification = p.sourceQualification;
  const scalar_ownership: "independent-copied-cpu-data-gc" = p.ownership;
  // @ts-expect-error Frozen scalar ownership rejects a same-value write.
  p.ownership = p.ownership;
  const scalar_faceScope: "original-b-proper-u-window-full-original-v" = p.faceScope;
  // @ts-expect-error Frozen scalar faceScope rejects a same-value write.
  p.faceScope = p.faceScope;
  const scalar_d1Representation: "outer-tagged-parent-direct" = p.d1Representation;
  // @ts-expect-error Frozen scalar d1Representation rejects a same-value write.
  p.d1Representation = p.d1Representation;
  const scalar_nativeRequestBytes: 4194304 = p.nativeRequestBytes;
  // @ts-expect-error Frozen scalar nativeRequestBytes rejects a same-value write.
  p.nativeRequestBytes = p.nativeRequestBytes;
  const scalarValues: readonly ["barocss-paired-surface-b-uv-split-faces-result-ingestion", 0, "barocss-paired-surface-b-uv-split-faces", 0, "authored-xyz-no-axis-conversion", "mm", "dimensionless", "original-b-u-window-and-unchanged-original-a-u-shared-cut", "original-b-source-id-model-object-index-with-full-original-a-retained", "independent-copied-cpu-data-gc", "original-b-proper-u-window-full-original-v", "outer-tagged-parent-direct", 4194304] = [p.schema, p.version, p.nativeSchema, p.nativeVersion, p.sourceFrame, p.worldLengthUnit, p.uvLengthUnit, p.parameterFrame, p.sourceQualification, p.ownership, p.faceScope, p.d1Representation, p.nativeRequestBytes];
  // @ts-expect-error Frozen limits object cannot be replaced even with itself.
  p.limits = p.limits;
  const limits_utf8Bytes: 16777216 = p.limits.utf8Bytes;
  // @ts-expect-error Frozen limits.utf8Bytes rejects a same-value write.
  p.limits.utf8Bytes = p.limits.utf8Bytes;
  const limits_utf16Units: 16777216 = p.limits.utf16Units;
  // @ts-expect-error Frozen limits.utf16Units rejects a same-value write.
  p.limits.utf16Units = p.limits.utf16Units;
  const limits_values: 4194304 = p.limits.values;
  // @ts-expect-error Frozen limits.values rejects a same-value write.
  p.limits.values = p.limits.values;
  const limits_depth: 64 = p.limits.depth;
  // @ts-expect-error Frozen limits.depth rejects a same-value write.
  p.limits.depth = p.limits.depth;
  const limits_recordFields: 64 = p.limits.recordFields;
  // @ts-expect-error Frozen limits.recordFields rejects a same-value write.
  p.limits.recordFields = p.limits.recordFields;
  const limits_arrayElements: 8192 = p.limits.arrayElements;
  // @ts-expect-error Frozen limits.arrayElements rejects a same-value write.
  p.limits.arrayElements = p.limits.arrayElements;
  const limits_stringUnits: 262144 = p.limits.stringUnits;
  // @ts-expect-error Frozen limits.stringUnits rejects a same-value write.
  p.limits.stringUnits = p.limits.stringUnits;
  const limits_keyUnits: 128 = p.limits.keyUnits;
  // @ts-expect-error Frozen limits.keyUnits rejects a same-value write.
  p.limits.keyUnits = p.limits.keyUnits;
  const limitsValues: readonly [16777216, 16777216, 4194304, 64, 64, 8192, 262144, 128] = [p.limits.utf8Bytes, p.limits.utf16Units, p.limits.values, p.limits.depth, p.limits.recordFields, p.limits.arrayElements, p.limits.stringUnits, p.limits.keyUnits];
  // @ts-expect-error Frozen capabilities object cannot be replaced even with itself.
  p.capabilities = p.capabilities;
  const capabilities_nativeWholeValidation: true = p.capabilities.nativeWholeValidation;
  // @ts-expect-error Frozen capabilities.nativeWholeValidation rejects a same-value write.
  p.capabilities.nativeWholeValidation = p.capabilities.nativeWholeValidation;
  const capabilities_copiedWholeReceipt: true = p.capabilities.copiedWholeReceipt;
  // @ts-expect-error Frozen capabilities.copiedWholeReceipt rejects a same-value write.
  p.capabilities.copiedWholeReceipt = p.capabilities.copiedWholeReceipt;
  const capabilities_renderer: false = p.capabilities.renderer;
  // @ts-expect-error Frozen capabilities.renderer rejects a same-value write.
  p.capabilities.renderer = p.capabilities.renderer;
  const capabilities_url: false = p.capabilities.url;
  // @ts-expect-error Frozen capabilities.url rejects a same-value write.
  p.capabilities.url = p.capabilities.url;
  const capabilities_byteInput: false = p.capabilities.byteInput;
  // @ts-expect-error Frozen capabilities.byteInput rejects a same-value write.
  p.capabilities.byteInput = p.capabilities.byteInput;
  const capabilities_publicSerializer: false = p.capabilities.publicSerializer;
  // @ts-expect-error Frozen capabilities.publicSerializer rejects a same-value write.
  p.capabilities.publicSerializer = p.capabilities.publicSerializer;
  const capabilities_dispose: false = p.capabilities.dispose;
  // @ts-expect-error Frozen capabilities.dispose rejects a same-value write.
  p.capabilities.dispose = p.capabilities.dispose;
  const capabilities_sourceEdit: false = p.capabilities.sourceEdit;
  // @ts-expect-error Frozen capabilities.sourceEdit rejects a same-value write.
  p.capabilities.sourceEdit = p.capabilities.sourceEdit;
  const capabilities_sampling: false = p.capabilities.sampling;
  // @ts-expect-error Frozen capabilities.sampling rejects a same-value write.
  p.capabilities.sampling = p.capabilities.sampling;
  const capabilities_intersectionConstruction: false = p.capabilities.intersectionConstruction;
  // @ts-expect-error Frozen capabilities.intersectionConstruction rejects a same-value write.
  p.capabilities.intersectionConstruction = p.capabilities.intersectionConstruction;
  const capabilities_isoCurveConstruction: false = p.capabilities.isoCurveConstruction;
  // @ts-expect-error Frozen capabilities.isoCurveConstruction rejects a same-value write.
  p.capabilities.isoCurveConstruction = p.capabilities.isoCurveConstruction;
  const capabilities_intervalExtraction: false = p.capabilities.intervalExtraction;
  // @ts-expect-error Frozen capabilities.intervalExtraction rejects a same-value write.
  p.capabilities.intervalExtraction = p.capabilities.intervalExtraction;
  const capabilities_faceConstruction: false = p.capabilities.faceConstruction;
  // @ts-expect-error Frozen capabilities.faceConstruction rejects a same-value write.
  p.capabilities.faceConstruction = p.capabilities.faceConstruction;
  const capabilities_aSurfaceSplit: false = p.capabilities.aSurfaceSplit;
  // @ts-expect-error Frozen capabilities.aSurfaceSplit rejects a same-value write.
  p.capabilities.aSurfaceSplit = p.capabilities.aSurfaceSplit;
  const capabilities_topologyConstruction: false = p.capabilities.topologyConstruction;
  // @ts-expect-error Frozen capabilities.topologyConstruction rejects a same-value write.
  p.capabilities.topologyConstruction = p.capabilities.topologyConstruction;
  const capabilities_body: false = p.capabilities.body;
  // @ts-expect-error Frozen capabilities.body rejects a same-value write.
  p.capabilities.body = p.capabilities.body;
  const capabilities_solid: false = p.capabilities.solid;
  // @ts-expect-error Frozen capabilities.solid rejects a same-value write.
  p.capabilities.solid = p.capabilities.solid;
  const capabilities_globalError: false = p.capabilities.globalError;
  // @ts-expect-error Frozen capabilities.globalError rejects a same-value write.
  p.capabilities.globalError = p.capabilities.globalError;
  const capabilities_manufacturing: false = p.capabilities.manufacturing;
  // @ts-expect-error Frozen capabilities.manufacturing rejects a same-value write.
  p.capabilities.manufacturing = p.capabilities.manufacturing;
  const capabilities_persistentNaming: false = p.capabilities.persistentNaming;
  // @ts-expect-error Frozen capabilities.persistentNaming rejects a same-value write.
  p.capabilities.persistentNaming = p.capabilities.persistentNaming;
  const capabilities_editor: false = p.capabilities.editor;
  // @ts-expect-error Frozen capabilities.editor rejects a same-value write.
  p.capabilities.editor = p.capabilities.editor;
  const capabilities_publication: false = p.capabilities.publication;
  // @ts-expect-error Frozen capabilities.publication rejects a same-value write.
  p.capabilities.publication = p.capabilities.publication;
  const capabilitiesValues: readonly [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] = [p.capabilities.nativeWholeValidation, p.capabilities.copiedWholeReceipt, p.capabilities.renderer, p.capabilities.url, p.capabilities.byteInput, p.capabilities.publicSerializer, p.capabilities.dispose, p.capabilities.sourceEdit, p.capabilities.sampling, p.capabilities.intersectionConstruction, p.capabilities.isoCurveConstruction, p.capabilities.intervalExtraction, p.capabilities.faceConstruction, p.capabilities.aSurfaceSplit, p.capabilities.topologyConstruction, p.capabilities.body, p.capabilities.solid, p.capabilities.globalError, p.capabilities.manufacturing, p.capabilities.persistentNaming, p.capabilities.editor, p.capabilities.publication];
  void [scalarValues, limitsValues, capabilitiesValues, scalar_schema, scalar_version, scalar_nativeSchema, scalar_nativeVersion, scalar_sourceFrame, scalar_worldLengthUnit, scalar_uvLengthUnit, scalar_parameterFrame, scalar_sourceQualification, scalar_ownership, scalar_faceScope, scalar_d1Representation, scalar_nativeRequestBytes, limits_utf8Bytes, limits_utf16Units, limits_values, limits_depth, limits_recordFields, limits_arrayElements, limits_stringUnits, limits_keyUnits, capabilities_nativeWholeValidation, capabilities_copiedWholeReceipt, capabilities_renderer, capabilities_url, capabilities_byteInput, capabilities_publicSerializer, capabilities_dispose, capabilities_sourceEdit, capabilities_sampling, capabilities_intersectionConstruction, capabilities_isoCurveConstruction, capabilities_intervalExtraction, capabilities_faceConstruction, capabilities_aSurfaceSplit, capabilities_topologyConstruction, capabilities_body, capabilities_solid, capabilities_globalError, capabilities_manufacturing, capabilities_persistentNaming, capabilities_editor, capabilities_publication];
}

export function actualErrors(publicError: BaroCadPairedSurfaceBUVSplitFacesReadError, nativeError: PairedSurfaceBUVSplitFacesError) {
  const code: BaroCadPairedSurfaceBUVSplitFacesDiagnosticCode = publicError.code;
  const nativeCode: PairedSurfaceBUVSplitFacesError['code'] = nativeError.code;
  const context: PairedSurfaceBUVSplitFacesError['context'] = nativeError.context;
  const phase: PairedSurfaceBUVSplitFacesError['context']['phase'] = context.phase;
  const edgeIndex: number | null = context.edgeIndex, observationIndex: number | null = context.observationIndex;
  const directCounts: PairedSurfaceBUVSplitFacesError['context']['directCounts'] = context.directCounts;
  const attemptedParentCalls: number = directCounts.parentValidationCount;
  const publicCause: unknown = publicError.cause, nativeCause: unknown = nativeError.cause;
  const diagnosticValues: readonly ['INPUT','JSON','OWNED','BUDGET','SCHEMA','NATIVE'] = [
    BaroCadPairedSurfaceBUVSplitFacesDiagnosticCode.INPUT, BaroCadPairedSurfaceBUVSplitFacesDiagnosticCode.JSON,
    BaroCadPairedSurfaceBUVSplitFacesDiagnosticCode.OWNED, BaroCadPairedSurfaceBUVSplitFacesDiagnosticCode.BUDGET,
    BaroCadPairedSurfaceBUVSplitFacesDiagnosticCode.SCHEMA, BaroCadPairedSurfaceBUVSplitFacesDiagnosticCode.NATIVE,
  ];
  const wrapped = new BaroCadPairedSurfaceBUVSplitFacesReadError('NATIVE', 'compile-only', nativeError);
  // @ts-expect-error Public read error code is readonly even for same-value assignment.
  publicError.code = publicError.code;
  // @ts-expect-error Native error code is readonly even for same-value assignment.
  nativeError.code = nativeError.code;
  // @ts-expect-error Native context reference is readonly; its actual indexed fields are retained.
  nativeError.context = nativeError.context;
  // @ts-expect-error Exact frozen Diagnostic const rejects a same-value write.
  BaroCadPairedSurfaceBUVSplitFacesDiagnosticCode.INPUT = BaroCadPairedSurfaceBUVSplitFacesDiagnosticCode.INPUT;
  // @ts-expect-error Public merged Diagnostic union contains six fixed codes only.
  const badCode: BaroCadPairedSurfaceBUVSplitFacesDiagnosticCode = 'INVALID';
  // @ts-expect-error ReadError constructor rejects unsupported codes.
  new BaroCadPairedSurfaceBUVSplitFacesReadError('INVALID', 'compile-only');
  // @ts-expect-error This native family has edge/observation indices, not assetIndex.
  void context.assetIndex;
  // @ts-expect-error This native family has edge/observation indices, not stationIndex.
  void context.stationIndex;
  void [code, nativeCode, phase, edgeIndex, observationIndex, attemptedParentCalls,
    publicCause, nativeCause, diagnosticValues, wrapped, badCode];
}
