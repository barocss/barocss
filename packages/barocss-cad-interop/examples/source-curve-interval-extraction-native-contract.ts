/** Public declaration consumer only. None of these function bodies is executed. */
import {
  parseBaroCadSourceCurveIntervalExtraction,
  readBaroCadSourceCurveIntervalExtraction,
  BaroCadSourceCurveIntervalExtractionReadError,
  BaroCadSourceCurveIntervalExtractionDiagnosticCode,
} from '@barocss/cad-interop/source-curve-interval-extraction';
import type {
  BaroCadSourceCurveIntervalExtractionRead,
  BaroCadSourceCurveIntervalExtractionDiagnosticCode as DiagnosticCode,
} from '@barocss/cad-interop/source-curve-interval-extraction';
import type {
  SourceCurveIntervalExtractionRequest,
  SourceCurveIntervalExtractionPatch,
  SourceCurveIntervalExtractionResult,
  SourceCurveIntervalExtractionReport,
  Model,
  Curve,
  CurveD1Result,
} from '@barocss/cad';

export function consumeWholeInterval(text: string, input: unknown): BaroCadSourceCurveIntervalExtractionRead {
  const parsed: BaroCadSourceCurveIntervalExtractionRead = parseBaroCadSourceCurveIntervalExtraction(text);
  const owned: BaroCadSourceCurveIntervalExtractionRead = readBaroCadSourceCurveIntervalExtraction(input);
  const native: SourceCurveIntervalExtractionResult = parsed.native;
  const report: SourceCurveIntervalExtractionReport = parsed.validationReport;
  const request: SourceCurveIntervalExtractionRequest = native.request;
  const sourceText: string | null = parsed.sourceText;
  const ownedSourceText: string | null = owned.sourceText;
  const originalModel: Model = native.originalModel;
  const candidateModel: Model = native.model;
  const originalCurve: Curve = native.originalCurve;
  const retainedCurve: Curve = native.curve;
  const sourceVersion: 0 = request.sourceVersion;
  const maximumObservations: 256 = request.maximumObservations;
  const schema: 'barocss-source-curve-interval-extraction-report' = report.schema;
  const requested: [number, number] = report.interval.requested;
  const effective: [number, number] = report.interval.effective;
  const originalDomain: [number, number] = report.domains.original;
  const retainedDomain: [number, number] = report.domains.output;
  const formula: 'u=t' = native.provenance.parameterMap.formula;
  const derivativeFactor: 1 = native.provenance.parameterMap.d1Factor;
  const boundary = native.provenance.boundaries[0];
  const requestedBits: number = boundary.requested;
  const effectiveBits: number = boundary.effective;
  const origin: 'original-domain-endpoint' | 'interior-request' = boundary.origin;
  const adoptedEndpointBits: boolean = boundary.adoptedOriginalEndpointBits;

  for (const patch of native.provenance.patches) {
    const completePatch: SourceCurveIntervalExtractionPatch = patch;
    const field: 'knots' | 'control-points' | 'weights' = patch.field;
    const startUTF16: number = patch.startUTF16;
    const endUTF16: number = patch.endUTF16;
    const originalText: string = patch.originalText;
    const replacementText: string = patch.replacementText;
    void [completePatch, field, startUTF16, endUTF16, originalText, replacementText];
  }
  for (const stage of native.provenance.stages) {
    const wholeCurves: Curve[] = [stage.input, stage.refined, stage.lower, stage.upper];
    const kind: 'knot-insertion' | 'direct-copy' = stage.refinement.kind;
    if (stage.refinement.calculation !== null) {
      const actualCoefficientCandidate: Curve = stage.refinement.calculation.candidate;
      void actualCoefficientCandidate;
    }
    for (const map of stage.lowerMaps.knots) {
      const copiedOrNewIndex: number | null = map.refinedKnotIndex;
      const knotOrigin: 'refined-copy' | 'requested-clamp' = map.origin;
      const knotValue: number = map.value;
      // @ts-expect-error Requested clamp knots can have no refined-knot index.
      const alwaysRefined: number = map.refinedKnotIndex;
      void [copiedOrNewIndex, knotOrigin, knotValue, alwaysRefined];
    }
    const sharedPoint: number = stage.shared.pointMM[0];
    const sharedWeight: number = stage.shared.weight;
    const ungatedChildComparison: number = stage.witness.relativeLowerUpperDifference;
    const inputComparison: number | null = stage.witness.relativeInputLowerDifference;
    for (const provider of [stage.witness.input, stage.witness.refined, stage.witness.lower, stage.witness.upper]) {
      if (provider.d1.status === 'evaluated') {
        const derivative: CurveD1Result = provider.d1.value;
        const component: number = derivative.derivative[0];
        // @ts-expect-error Actual Curve D1 has point/derivative, not a normal.
        derivative.normal;
        void component;
      } else {
        const refusedValue: null = provider.d1.value;
        const refusedName: string = provider.d1.name;
        const reason: string = provider.d1.reason;
        void [refusedValue, refusedName, reason];
      }
    }
    void [wholeCurves, kind, sharedPoint, sharedWeight, ungatedChildComparison, inputComparison];
  }
  for (const observation of report.observations) {
    const relative: number | null = observation.relativeDerivativeDifference;
    // @ts-expect-error Native C0 refusal makes this comparison nullable.
    const alwaysCompared: number = observation.relativeDerivativeDifference;
    for (const state of [observation.originalD1, observation.outputD1]) {
      if (state.status === 'evaluated') {
        const derivative: CurveD1Result = state.value;
        void derivative.point;
      } else {
        const nullValue: null = state.value;
        const nativeReason: string = state.reason;
        void [nullValue, nativeReason];
      }
    }
    void [relative, alwaysCompared];
  }

  // Owned CPU data and actual report remain mutable; metadata alone is readonly.
  native.curve.controlPoints[0][0] = native.curve.controlPoints[0][0];
  native.request.source = native.request.source;
  report.maximumPointDifferenceMM = report.maximumPointDifferenceMM;
  report.quality.globalShapeErrorCertified = false;
  parsed.native = native;
  parsed.validationReport = report;
  void [request, sourceText, ownedSourceText, originalModel, candidateModel, originalCurve, retainedCurve,
    sourceVersion, maximumObservations, schema, requested, effective, originalDomain, retainedDomain,
    formula, derivativeFactor, requestedBits, effectiveBits, origin, adoptedEndpointBits];
  return owned;
}

export function consumeProfile(value: BaroCadSourceCurveIntervalExtractionRead): void {
  const profile: BaroCadSourceCurveIntervalExtractionRead['profile'] = value.profile;
  const schema: 'barocss-source-curve-interval-extraction-ingestion' = profile.schema;
  const version: 0 = profile.version;
  const nativeSchema: 'barocss-source-curve-interval-extraction-report' = profile.nativeSchema;
  const nativeVersion: 0 = profile.nativeVersion;
  const frame: 'authored-xyz-no-axis-conversion' = profile.sourceFrame;
  const units: 'mm' = profile.lengthUnit;
  const parameterFrame: 'original-native-curve-parameter' = profile.parameterFrame;
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
    profile.capabilities.sampling, profile.capabilities.genericInterval, profile.capabilities.genericRefinement,
    profile.capabilities.globalShape, profile.capabilities.globalBinary64, profile.capabilities.g1g2,
    profile.capabilities.topology, profile.capabilities.solid, profile.capabilities.manufacturing,
    profile.capabilities.editorDisplay, profile.capabilities.persistentTopology, profile.capabilities.publication,
  ];
  // Same-value assignments check readonly declarations, not literal-type differences.
  // @ts-expect-error Profile schema is readonly.
  profile.schema = 'barocss-source-curve-interval-extraction-ingestion';
  // @ts-expect-error Nested byte limit is readonly.
  profile.limits.utf8Bytes = 2097152;
  // @ts-expect-error Per-traversal work metadata is readonly.
  profile.limits.values = 1048576;
  // @ts-expect-error A positive capability is readonly too.
  profile.capabilities.nativeWholeValidation = true;
  // @ts-expect-error Renderer remains readonly false.
  profile.capabilities.renderer = false;
  // @ts-expect-error Publication remains readonly false.
  profile.capabilities.publication = false;
  void [schema, version, nativeSchema, nativeVersion, frame, units, parameterFrame, ownership, limits, capabilities];
}

export function consumeDiagnostics(cause: unknown): DiagnosticCode[] {
  const codes: DiagnosticCode[] = [
    BaroCadSourceCurveIntervalExtractionDiagnosticCode.INPUT,
    BaroCadSourceCurveIntervalExtractionDiagnosticCode.JSON,
    BaroCadSourceCurveIntervalExtractionDiagnosticCode.OWNED,
    BaroCadSourceCurveIntervalExtractionDiagnosticCode.BUDGET,
    BaroCadSourceCurveIntervalExtractionDiagnosticCode.SCHEMA,
    BaroCadSourceCurveIntervalExtractionDiagnosticCode.NATIVE,
  ];
  const error = new BaroCadSourceCurveIntervalExtractionReadError('NATIVE', 'Retained original cause', cause);
  const actualCode: DiagnosticCode = error.code;
  const originalCause: unknown = error.cause;
  // @ts-expect-error Public Error.code is readonly; the same value cannot be reassigned.
  error.code = error.code;
  // @ts-expect-error The public diagnostic constant is readonly.
  BaroCadSourceCurveIntervalExtractionDiagnosticCode.INPUT = 'INPUT';
  // @ts-expect-error CAD SOURCE is not one of the six public reader phases.
  const unsupportedCode: DiagnosticCode = 'SOURCE';
  // @ts-expect-error Parse expects text, not an owned record.
  parseBaroCadSourceCurveIntervalExtraction({});
  // @ts-expect-error The public reader exposes no custom budget/options parameter.
  parseBaroCadSourceCurveIntervalExtraction('{}', { maximumValues: 10 });
  // @ts-expect-error Owned admission also has no caller options parameter.
  readBaroCadSourceCurveIntervalExtraction({}, { maximumValues: 10 });
  void [actualCode, originalCause, unsupportedCode];
  return codes;
}

/** Unknown owned input is allowed by the signature; runtime guards decide validity. */
export function consumeUnknownInput(value: unknown): BaroCadSourceCurveIntervalExtractionRead {
  const readUnknown: BaroCadSourceCurveIntervalExtractionRead = readBaroCadSourceCurveIntervalExtraction(value);
  const arrayAcceptedByTypeBoundary: BaroCadSourceCurveIntervalExtractionRead = readBaroCadSourceCurveIntervalExtraction([]);
  void arrayAcceptedByTypeBoundary;
  return readUnknown;
}
