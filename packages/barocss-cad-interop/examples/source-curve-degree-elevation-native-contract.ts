/** Public declaration consumer. These function bodies are never executed here. */
import {
  parseBaroCadSourceCurveDegreeElevation,
  readBaroCadSourceCurveDegreeElevation,
  BaroCadSourceCurveDegreeElevationReadError,
  BaroCadSourceCurveDegreeElevationDiagnosticCode,
} from '@barocss/cad-interop/source-curve-degree-elevation';
import type {
  BaroCadSourceCurveDegreeElevationRead,
  BaroCadSourceCurveDegreeElevationDiagnosticCode as DiagnosticCode,
} from '@barocss/cad-interop/source-curve-degree-elevation';
import type {
  SourceCurveDegreeElevationRequest,
  SourceCurveDegreeElevationPatch,
  SourceCurveDegreeElevationResult,
  SourceCurveDegreeElevationReport,
  Model,
  Curve,
  CurveD1Result,
} from '@barocss/cad';

type CoefficientResult = SourceCurveDegreeElevationResult['provenance']['coefficientResult'];
type CoefficientSpan = CoefficientResult['spans'][number];
type GeneratedRow = CoefficientSpan['generated'][number];
type KnotRow = CoefficientResult['knots'][number];

export function consumeWholeDegreeElevation(text: string, input: unknown): BaroCadSourceCurveDegreeElevationRead {
  const parsed: BaroCadSourceCurveDegreeElevationRead = parseBaroCadSourceCurveDegreeElevation(text);
  const owned: BaroCadSourceCurveDegreeElevationRead = readBaroCadSourceCurveDegreeElevation(input);
  const native: SourceCurveDegreeElevationResult = parsed.native;
  const report: SourceCurveDegreeElevationReport = parsed.validationReport;
  const originalReport: SourceCurveDegreeElevationReport = native.report;
  const request: SourceCurveDegreeElevationRequest = native.request;
  const sourceText: string | null = parsed.sourceText;
  const ownedText: string | null = owned.sourceText;
  const source: string = native.source;
  const originalModel: Model = native.originalModel;
  const candidateModel: Model = native.model;
  const originalCurve: Curve = native.originalCurve;
  const candidateCurve: Curve = native.curve;
  const sourceVersion: 0 = request.sourceVersion;
  const targetDegree: 2 | 3 | 4 | 5 = request.targetDegree;
  const maximumObservations: 128 = request.maximumObservations;
  const schema: 'barocss-source-curve-degree-elevation-report' = report.schema;
  const originalDegree: number = report.originalDegree;
  const reportedTargetDegree: number = report.targetDegree;
  const domain: [number, number] = report.domain;
  const patchCount: 4 = report.patchCount;
  const selectedIndex: number = native.provenance.selectedObjectIndex;
  const parameterKind: 'identity' = native.provenance.parameterMap.kind;
  const formula: 'u=t' = native.provenance.parameterMap.formula;
  const derivativeFactor: 1 = native.provenance.parameterMap.d1Factor;
  // @ts-expect-error The actual report has originalDegree and targetDegree, not degree.
  report.degree;

  for (const patch of native.provenance.patches) {
    const actualPatch: SourceCurveDegreeElevationPatch = patch;
    const field: 'degree' | 'knots' | 'control-points' | 'weights' = patch.field;
    const startUTF16: number = patch.startUTF16;
    const endUTF16: number = patch.endUTF16;
    const originalText: string = patch.originalText;
    const replacementText: string = patch.replacementText;
    void [actualPatch, field, startUTF16, endUTF16, originalText, replacementText];
  }
  for (const block of native.provenance.blocks) {
    const blockIndex: number = block.index;
    const value: number = block.value;
    const originalKnotRange: [number, number] = [block.originalFirstKnotIndex, block.originalLastKnotIndex];
    const multiplicity: number = block.multiplicity;
    void [blockIndex, value, originalKnotRange, multiplicity];
  }
  const coefficients: CoefficientResult = native.provenance.coefficientResult;
  const coefficientCandidate: Curve = coefficients.candidate;
  for (const homogeneous of coefficients.liftedOriginalHomogeneous) {
    const originalHomogeneous: [number, number, number, number] = homogeneous;
    void originalHomogeneous;
  }
  for (const span of coefficients.spans) {
    const actualSpan: CoefficientSpan = span;
    const spanIndex: number = span.index;
    const spanDomain: [number, number] = span.domain;
    const originalPoleIndices: number[] = span.originalPoleIndices;
    const outputPoleIndices: number[] = span.outputPoleIndices;
    for (const row of span.generated) {
      const actualGeneratedRow: GeneratedRow = row;
      const outputPoleIndex: number = row.outputPoleIndex;
      const leftOriginalPoleIndex: number = row.leftOriginalPoleIndex;
      const rightOriginalPoleIndex: number = row.rightOriginalPoleIndex;
      const alpha: number = row.alpha;
      const homogeneousRows: [number, number, number, number][] = [
        row.leftHomogeneous, row.rightHomogeneous,
        row.leftContribution, row.rightContribution, row.homogeneous,
      ];
      const pointMM: [number, number, number] = row.pointMM;
      const weight: number = row.weight;
      void [actualGeneratedRow, outputPoleIndex, leftOriginalPoleIndex, rightOriginalPoleIndex,
        alpha, homogeneousRows, pointMM, weight];
    }
    void [actualSpan, spanIndex, spanDomain, originalPoleIndices, outputPoleIndices];
  }
  for (const copied of coefficients.copiedPoles) {
    const originalPoleIndex: number = copied.originalPoleIndex;
    const outputPoleIndex: number = copied.outputPoleIndex;
    void [originalPoleIndex, outputPoleIndex];
  }
  for (const knot of coefficients.knots) {
    const actualKnot: KnotRow = knot;
    const outputKnotIndex: number = knot.outputKnotIndex;
    const originalKnotIndex: number | null = knot.originalKnotIndex;
    const value: number = knot.value;
    const origin: 'original-copy' | 'degree-multiplicity-increase' = knot.origin;
    const blockIndex: number = knot.blockIndex;
    // @ts-expect-error Added degree-multiplicity knots have no original knot index.
    const alwaysOriginal: number = knot.originalKnotIndex;
    void [actualKnot, outputKnotIndex, originalKnotIndex, value, origin, blockIndex, alwaysOriginal];
  }
  for (const observation of report.observations) {
    const parameter: number = observation.parameter;
    const points: [number, number, number][] = [observation.originalPointMM, observation.pointMM];
    const differenceMM: number = observation.pointDifferenceMM;
    const relative: number | null = observation.relativeDerivativeDifference;
    // @ts-expect-error A native C0 refusal makes the derivative comparison nullable.
    const alwaysCompared: number = observation.relativeDerivativeDifference;
    for (const state of [observation.originalD1, observation.outputD1]) {
      if (state.status === 'evaluated') {
        const d1: CurveD1Result = state.value;
        const point: [number, number, number] = d1.point;
        const derivative: [number, number, number] = d1.derivative;
        // @ts-expect-error Actual Curve D1 has point and derivative, not a normal.
        d1.normal;
        void [point, derivative];
      } else {
        const value: null = state.value;
        const name: string = state.name;
        const reason: string = state.reason;
        void [value, name, reason];
      }
    }
    void [parameter, points, differenceMM, relative, alwaysCompared];
  }

  // Whole CPU records and both reports remain mutable. Metadata alone is readonly.
  native.request.source = native.request.source;
  native.curve.controlPoints[0][0] = native.curve.controlPoints[0][0];
  native.report.originalDegree = native.report.originalDegree;
  report.targetDegree = report.targetDegree;
  report.quality.globalShapeErrorCertified = false;
  parsed.native = native;
  parsed.validationReport = report;
  void [originalReport, request, sourceText, ownedText, source, originalModel, candidateModel,
    originalCurve, candidateCurve, sourceVersion, targetDegree, maximumObservations, schema,
    originalDegree, reportedTargetDegree, domain, patchCount, selectedIndex, parameterKind,
    formula, derivativeFactor, coefficientCandidate];
  return owned;
}

export function consumeProfile(value: BaroCadSourceCurveDegreeElevationRead): void {
  const profile: BaroCadSourceCurveDegreeElevationRead['profile'] = value.profile;
  const schema: 'barocss-source-curve-degree-elevation-ingestion' = profile.schema;
  const version: 0 = profile.version;
  const nativeSchema: 'barocss-source-curve-degree-elevation-report' = profile.nativeSchema;
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
    profile.capabilities.sampling, profile.capabilities.genericDegreeElevation, profile.capabilities.degreeLowering,
    profile.capabilities.globalShape, profile.capabilities.globalBinary64, profile.capabilities.g1g2,
    profile.capabilities.topology, profile.capabilities.solid, profile.capabilities.manufacturing,
    profile.capabilities.editorDisplay, profile.capabilities.persistentTopology, profile.capabilities.publication,
  ];
  // Same-value assignments test readonly declarations, not different literal values.
  // @ts-expect-error Profile schema is readonly.
  profile.schema = 'barocss-source-curve-degree-elevation-ingestion';
  // @ts-expect-error Nested byte limit is readonly.
  profile.limits.utf8Bytes = 2097152;
  // @ts-expect-error Per-pass work metadata is readonly.
  profile.limits.values = 1048576;
  // @ts-expect-error A positive capability is readonly.
  profile.capabilities.nativeWholeValidation = true;
  // @ts-expect-error Degree elevation is a readonly denied reader capability.
  profile.capabilities.genericDegreeElevation = false;
  // @ts-expect-error Degree lowering is readonly false.
  profile.capabilities.degreeLowering = false;
  // @ts-expect-error Renderer metadata is readonly false.
  profile.capabilities.renderer = false;
  // @ts-expect-error Publication metadata is readonly false.
  profile.capabilities.publication = false;
  void [schema, version, nativeSchema, nativeVersion, frame, units, parameterFrame, ownership, limits, capabilities];
}

export function consumeDiagnostics(cause: unknown): DiagnosticCode[] {
  const codes: DiagnosticCode[] = [
    BaroCadSourceCurveDegreeElevationDiagnosticCode.INPUT,
    BaroCadSourceCurveDegreeElevationDiagnosticCode.JSON,
    BaroCadSourceCurveDegreeElevationDiagnosticCode.OWNED,
    BaroCadSourceCurveDegreeElevationDiagnosticCode.BUDGET,
    BaroCadSourceCurveDegreeElevationDiagnosticCode.SCHEMA,
    BaroCadSourceCurveDegreeElevationDiagnosticCode.NATIVE,
  ];
  const error = new BaroCadSourceCurveDegreeElevationReadError('NATIVE', 'Retained original cause', cause);
  const actualCode: DiagnosticCode = error.code;
  const originalCause: unknown = error.cause;
  // @ts-expect-error The public Error.code is readonly.
  error.code = error.code;
  // @ts-expect-error Public diagnostic constants are readonly.
  BaroCadSourceCurveDegreeElevationDiagnosticCode.INPUT = 'INPUT';
  // @ts-expect-error CAD SOURCE is not a public reader phase.
  const unsupportedCode: DiagnosticCode = 'SOURCE';
  // @ts-expect-error Parse accepts text, not an owned record.
  parseBaroCadSourceCurveDegreeElevation({});
  // @ts-expect-error Parse exposes no caller options or budgets.
  parseBaroCadSourceCurveDegreeElevation('{}', { maximumValues: 10 });
  // @ts-expect-error Owned read exposes no caller options.
  readBaroCadSourceCurveDegreeElevation({}, { maximumValues: 10 });
  void [actualCode, originalCause, unsupportedCode];
  return codes;
}

/** Unknown is the owned-data boundary. Runtime guards decide whether it is valid. */
export function consumeUnknownInput(value: unknown): BaroCadSourceCurveDegreeElevationRead {
  const owned: BaroCadSourceCurveDegreeElevationRead = readBaroCadSourceCurveDegreeElevation(value);
  const arrayAtUnknownBoundary: BaroCadSourceCurveDegreeElevationRead = readBaroCadSourceCurveDegreeElevation([]);
  void arrayAtUnknownBoundary;
  return owned;
}
