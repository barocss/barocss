/** Public declaration consumer. These function bodies are not executed here. */
import {
  parseBaroCadSourceLineWidthFace,
  readBaroCadSourceLineWidthFace,
  BaroCadSourceLineWidthFaceReadError,
  BaroCadSourceLineWidthFaceDiagnosticCode,
} from '@barocss/cad-interop/source-line-width-face';
import type {
  BaroCadSourceLineWidthFaceRead,
  BaroCadSourceLineWidthFaceDiagnosticCode as DiagnosticCode,
} from '@barocss/cad-interop/source-line-width-face';
import type {
  SourceLineWidthFaceRequest,
  SourceLineWidthFaceOptions,
  SourceLineWidthFaceResult,
  SourceLineWidthFaceReport,
  Model,
  Curve,
  Surface,
  CurveD1Result,
  SurfaceD1Result,
} from '@barocss/cad';

type RuledParent = SourceLineWidthFaceResult['ruled'];
type FaceParent = SourceLineWidthFaceResult['face'];
type BoundaryBinding = SourceLineWidthFaceResult['bindings']['boundaries'][number];
type FaceBinding = FaceParent['bindings'][number];
type FaceUse = FaceParent['topology']['loop']['uses'][number];
type Pcurve = FaceParent['pcurves'][number];

export function consumeWholeWidthFace(text: string, input: unknown): BaroCadSourceLineWidthFaceRead {
  const parsed: BaroCadSourceLineWidthFaceRead = parseBaroCadSourceLineWidthFace(text);
  const owned: BaroCadSourceLineWidthFaceRead = readBaroCadSourceLineWidthFace(input);
  const native: SourceLineWidthFaceResult = parsed.native;
  const report: SourceLineWidthFaceReport = parsed.validationReport;
  const suppliedReport: SourceLineWidthFaceReport = native.report;
  const request: SourceLineWidthFaceRequest = native.request;
  const options: SourceLineWidthFaceOptions = request.options;
  const sourceText: string | null = parsed.sourceText;
  const ownedText: string | null = owned.sourceText;
  const sourceVersion: 0 = request.sourceVersion;
  const source: string = request.source;
  const selectedCurveId: string = request.curveId;
  const widthMM: number = request.widthMM;
  const generatedIds: [string, string, string, string] = options.boundaryCurveIds;
  const orientation: 'forward' | 'reverse' = options.face.orientation;
  const originalModel: Model = native.originalModel;
  const originalCurve: Curve = native.originalCurve;
  const ruled: RuledParent = native.ruled;
  const face: FaceParent = native.face;
  const models: Model[] = [originalModel, ruled.model, face.model];
  const sources: string[] = [request.source, ruled.source, face.source];
  const sectionCurves: Curve[] = [ruled.first, ruled.second];
  const supports: Surface[] = [ruled.surface, face.plane];
  const originalIndex: number = report.selectedObjectIndex;
  const objectCount: number = report.originalObjectCount;
  const schema: 'barocss-source-line-width-face-report' = report.schema;
  const nativeProfile: 'unit-line-positive-x-centered-y0-z0' = report.profile;
  const basisKnots: [0, 0, 1, 1] = report.originalBasis.knots;
  const basisWeights: [1, 1] = report.originalBasis.weights;
  const domain: [0, 1] = report.originalBasis.domain;
  const areaMM2: number = report.diagnostics.representedAreaMM2;
  const diagnosticAuthority: 'axis-product-diagnostics-not-solid-or-global-error-certificate' = report.diagnostics.authority;
  const constructed: true = report.quality.nativeFaceConstructed;
  const incidenceValid: true = report.quality.incidenceValid;
  const geometricValidity: 'not-certified' = report.quality.geometricValidity;
  const solid: false = report.quality.solid;
  // @ts-expect-error Complete source fields remain inside their qualified parents.
  native.source;
  // @ts-expect-error The native root has bindings, not a Curve provenance field.
  native.provenance;

  for (const context of [native.bindings.sources.original, native.bindings.sources.ruled, native.bindings.sources.face]) {
    const namespace: 'original' | 'ruled' | 'face' = context.context;
    const sourceField: 'request.source' | 'ruled.source' | 'face.source' = context.sourceField;
    const modelField: 'originalModel' | 'ruled.model' | 'face.model' = context.modelField;
    const modelName: string = context.modelName;
    const version: 0 = context.sourceVersion;
    void [namespace, sourceField, modelField, modelName, version];
  }
  for (const support of [native.bindings.support.ruled, native.bindings.support.face]) {
    const namespace: 'ruled' | 'face' = support.context;
    const modelName: string = support.modelName;
    const objectIndex: 2 | 0 = support.objectIndex;
    const surfaceId: string = support.surfaceId;
    void [namespace, modelName, objectIndex, surfaceId];
  }
  const completeSupportBits: true = native.bindings.support.completeBitsEqual;
  const traversalUseIds: [string, string, string, string] = native.bindings.face.useIdsInTraversalOrder;
  for (const boundary of native.bindings.boundaries) {
    const actualBinding: BoundaryBinding = boundary;
    const canonicalBoundary: 'v-min' | 'u-max' | 'v-max' | 'u-min' = boundary.boundary;
    const canonicalIndex: number = boundary.index;
    const traversalIndex: number = boundary.traversalIndex;
    const namespace: 'original' | 'ruled' | 'face' = boundary.curve.context;
    const modelName: string = boundary.curve.modelName;
    const curveObjectIndex: number = boundary.curve.objectIndex;
    const curveId: string = boundary.curve.curveId;
    const ids: string[] = [boundary.edgeId, boundary.pcurveId, boundary.useId];
    const interval: [number, number] = boundary.interval;
    const sense: 'forward' | 'reverse' = boundary.sense;
    void [actualBinding, canonicalBoundary, canonicalIndex, traversalIndex, namespace,
      modelName, curveObjectIndex, curveId, ids, interval, sense];
  }
  for (const use of face.topology.loop.uses) {
    const actualUse: FaceUse = use;
    const ids: string[] = [use.id, use.edgeId, use.curveId, use.pcurveId];
    const vertices: [string, string] = use.vertexIds;
    const sense: 'forward' | 'reverse' = use.sense;
    const interval: [number, number] = use.interval;
    void [actualUse, ids, vertices, sense, interval];
  }
  for (const pcurve of face.pcurves) {
    const actualPcurve: Pcurve = pcurve;
    const coordinates: 'uv' = pcurve.coordinateSystem;
    const domain: [number, number] = pcurve.domain;
    const nativeUVCurve: Curve = pcurve.curve;
    const associatedIds: string[] = [pcurve.id, pcurve.edgeId, pcurve.curveId];
    void [actualPcurve, coordinates, domain, nativeUVCurve, associatedIds];
  }
  for (const binding of face.bindings) {
    const actualBinding: FaceBinding = binding;
    const line: CurveD1Result = binding.lineD1;
    const uv: CurveD1Result = binding.pcurveD1;
    const support: SurfaceD1Result = binding.surfaceD1;
    const point: [number, number, number] = line.point;
    const worldDerivative: [number, number, number] = line.derivative;
    const uvDerivative: [number, number, number] = uv.derivative;
    const supportPartials: [number, number, number][] = [support.point, support.du, support.dv];
    const declaredNormal: [number, number, number] = binding.orientedFaceNormal;
    const chainTangent: [number, number, number] = binding.orientedSurfaceChainTangentMM;
    const lineTangent: [number, number, number] = binding.orientedLineTangentMM;
    const traversalSense: 'forward' | 'reverse' = binding.traversalSense;
    // @ts-expect-error Actual Surface D1 has point/du/dv; the oriented Face normal is separate.
    support.normal;
    // @ts-expect-error Actual Curve D1 has derivative, not a Surface partial.
    line.du;
    void [actualBinding, point, worldDerivative, uvDerivative, supportPartials,
      declaredNormal, chainTangent, lineTangent, traversalSense];
  }

  // Native parent data and both reports remain mutable independent CPU records.
  native.originalCurve.controlPoints[0][0] = native.originalCurve.controlPoints[0][0];
  native.ruled.surface.controlPoints[0][0][0] = native.ruled.surface.controlPoints[0][0][0];
  native.face.topology.vertices[0].point[0] = native.face.topology.vertices[0].point[0];
  native.request.widthMM = native.request.widthMM;
  suppliedReport.quality.solid = false;
  report.diagnostics.representedAreaMM2 = report.diagnostics.representedAreaMM2;
  parsed.native = native;
  parsed.validationReport = report;
  void [request, options, sourceText, ownedText, sourceVersion, source, selectedCurveId,
    widthMM, generatedIds, orientation, models, sources, sectionCurves, supports,
    originalIndex, objectCount, schema, nativeProfile, basisKnots, basisWeights, domain,
    areaMM2, diagnosticAuthority, constructed, incidenceValid, geometricValidity, solid,
    completeSupportBits, traversalUseIds];
  return owned;
}

export function consumeProfile(value: BaroCadSourceLineWidthFaceRead): void {
  const profile: BaroCadSourceLineWidthFaceRead['profile'] = value.profile;
  const schema: 'barocss-source-line-width-face-ingestion' = profile.schema;
  const version: 0 = profile.version;
  const nativeSchema: 'barocss-source-line-width-face-report' = profile.nativeSchema;
  const nativeVersion: 0 = profile.nativeVersion;
  const sourceFrame: 'authored-xyz-no-axis-conversion' = profile.sourceFrame;
  const units: 'mm' = profile.lengthUnit;
  const parameterFrame: 'retained-original-world-and-surface-parameters-with-dimensionless-uv' = profile.parameterFrame;
  const qualification: 'retained-source-field-path-and-actual-model-name' = profile.sourceQualification;
  const ownership: 'independent-copied-cpu-data-gc' = profile.ownership;
  const limits: readonly [2097152, 2097152, 1048576, 64, 64, 8192, 262144, 128] = [
    profile.limits.utf8Bytes, profile.limits.utf16Units, profile.limits.values,
    profile.limits.depth, profile.limits.recordFields, profile.limits.arrayElements,
    profile.limits.stringUnits, profile.limits.keyUnits,
  ];
  const capabilities: readonly [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] = [
    profile.capabilities.nativeWholeValidation, profile.capabilities.copiedWholeReceipt,
    profile.capabilities.renderer, profile.capabilities.url, profile.capabilities.byteInput,
    profile.capabilities.publicSerializer, profile.capabilities.dispose, profile.capabilities.sourceEdit,
    profile.capabilities.sampling, profile.capabilities.widthOperation, profile.capabilities.generalCurveOffset,
    profile.capabilities.globalShape, profile.capabilities.globalBinary64, profile.capabilities.g1g2,
    profile.capabilities.topology, profile.capabilities.solid, profile.capabilities.manufacturing,
    profile.capabilities.editorDisplay, profile.capabilities.persistentTopology, profile.capabilities.publication,
  ];
  // Same-value canaries check readonly declarations, not mismatched literal values.
  // @ts-expect-error Profile schema is readonly.
  profile.schema = 'barocss-source-line-width-face-ingestion';
  // @ts-expect-error The parameter frame is readonly.
  profile.parameterFrame = 'retained-original-world-and-surface-parameters-with-dimensionless-uv';
  // @ts-expect-error Source qualification is readonly.
  profile.sourceQualification = 'retained-source-field-path-and-actual-model-name';
  // @ts-expect-error UTF8 limit is readonly.
  profile.limits.utf8Bytes = 2097152;
  // @ts-expect-error UTF16 limit is readonly.
  profile.limits.utf16Units = 2097152;
  // @ts-expect-error Work limit is readonly.
  profile.limits.values = 1048576;
  // @ts-expect-error Depth limit is readonly.
  profile.limits.depth = 64;
  // @ts-expect-error Record limit is readonly.
  profile.limits.recordFields = 64;
  // @ts-expect-error Array limit is readonly.
  profile.limits.arrayElements = 8192;
  // @ts-expect-error String limit is readonly.
  profile.limits.stringUnits = 262144;
  // @ts-expect-error Key limit is readonly.
  profile.limits.keyUnits = 128;
  // @ts-expect-error Whole-validation capability is readonly.
  profile.capabilities.nativeWholeValidation = true;
  // @ts-expect-error Copied-receipt capability is readonly.
  profile.capabilities.copiedWholeReceipt = true;
  // @ts-expect-error Renderer capability is readonly.
  profile.capabilities.renderer = false;
  // @ts-expect-error URL capability is readonly.
  profile.capabilities.url = false;
  // @ts-expect-error Byte-input capability is readonly.
  profile.capabilities.byteInput = false;
  // @ts-expect-error Serializer capability is readonly.
  profile.capabilities.publicSerializer = false;
  // @ts-expect-error Disposal capability is readonly.
  profile.capabilities.dispose = false;
  // @ts-expect-error Source-edit capability is readonly.
  profile.capabilities.sourceEdit = false;
  // @ts-expect-error Sampling capability is readonly.
  profile.capabilities.sampling = false;
  // @ts-expect-error Width-operation capability is readonly.
  profile.capabilities.widthOperation = false;
  // @ts-expect-error General-offset capability is readonly.
  profile.capabilities.generalCurveOffset = false;
  // @ts-expect-error Global-shape capability is readonly.
  profile.capabilities.globalShape = false;
  // @ts-expect-error Binary64 capability is readonly.
  profile.capabilities.globalBinary64 = false;
  // @ts-expect-error Continuity capability is readonly.
  profile.capabilities.g1g2 = false;
  // @ts-expect-error Topology capability is readonly.
  profile.capabilities.topology = false;
  // @ts-expect-error Solid capability is readonly.
  profile.capabilities.solid = false;
  // @ts-expect-error Manufacturing capability is readonly.
  profile.capabilities.manufacturing = false;
  // @ts-expect-error Display capability is readonly.
  profile.capabilities.editorDisplay = false;
  // @ts-expect-error Persistent-binding capability is readonly.
  profile.capabilities.persistentTopology = false;
  // @ts-expect-error Publication capability is readonly.
  profile.capabilities.publication = false;
  void [schema, version, nativeSchema, nativeVersion, sourceFrame, units,
    parameterFrame, qualification, ownership, limits, capabilities];
}

export function consumeDiagnostics(cause: unknown): DiagnosticCode[] {
  const codes: DiagnosticCode[] = [
    BaroCadSourceLineWidthFaceDiagnosticCode.INPUT,
    BaroCadSourceLineWidthFaceDiagnosticCode.JSON,
    BaroCadSourceLineWidthFaceDiagnosticCode.OWNED,
    BaroCadSourceLineWidthFaceDiagnosticCode.BUDGET,
    BaroCadSourceLineWidthFaceDiagnosticCode.SCHEMA,
    BaroCadSourceLineWidthFaceDiagnosticCode.NATIVE,
  ];
  const error = new BaroCadSourceLineWidthFaceReadError('NATIVE', 'Retained original cause', cause);
  const phase: DiagnosticCode = error.code;
  const actualCause: unknown = error.cause;
  // @ts-expect-error Public Error.code is readonly.
  error.code = error.code;
  // @ts-expect-error Diagnostic constants are readonly.
  BaroCadSourceLineWidthFaceDiagnosticCode.INPUT = 'INPUT';
  // @ts-expect-error CAD SOURCE is not one of the six public reader phases.
  const unsupportedCode: DiagnosticCode = 'SOURCE';
  // @ts-expect-error Parse expects a primitive string.
  parseBaroCadSourceLineWidthFace({});
  // @ts-expect-error Parse has no caller options parameter.
  parseBaroCadSourceLineWidthFace('{}', { maximumValues: 10 });
  // @ts-expect-error Owned read has no caller options parameter.
  readBaroCadSourceLineWidthFace({}, { maximumValues: 10 });
  void [phase, actualCause, unsupportedCode];
  return codes;
}

/** Unknown is admitted by the signature; runtime guards determine validity. */
export function consumeUnknownInput(input: unknown): BaroCadSourceLineWidthFaceRead {
  const owned: BaroCadSourceLineWidthFaceRead = readBaroCadSourceLineWidthFace(input);
  const arrayAtTypeBoundary: BaroCadSourceLineWidthFaceRead = readBaroCadSourceLineWidthFace([]);
  void arrayAtTypeBoundary;
  return owned;
}
