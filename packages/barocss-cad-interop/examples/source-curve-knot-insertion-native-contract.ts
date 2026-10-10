import {
  parseBaroCadSourceCurveKnotInsertion,
  readBaroCadSourceCurveKnotInsertion,
  BaroCadSourceCurveKnotInsertionReadError,
  BaroCadSourceCurveKnotInsertionDiagnosticCode,
} from '@barocss/cad-interop/source-curve-knot-insertion';
import type {
  BaroCadSourceCurveKnotInsertionRead,
} from '@barocss/cad-interop/source-curve-knot-insertion';
import type {
  SourceCurveKnotInsertionResult,
  SourceCurveKnotInsertionReport,
  CurveD1Result,
} from '@barocss/cad';

/** Selected declaration consumer. Importing this file calls no reader. */
export type SourceCurveKnotIngestionProfile = BaroCadSourceCurveKnotInsertionRead['profile'];
export const readers: {
  parse: (text: string) => BaroCadSourceCurveKnotInsertionRead;
  read: (input: unknown) => BaroCadSourceCurveKnotInsertionRead;
} = { parse: parseBaroCadSourceCurveKnotInsertion, read: readBaroCadSourceCurveKnotInsertion };

export function consumeSourceCurveKnotDeclarations(
  text: string, owned: SourceCurveKnotInsertionResult,
): BaroCadSourceCurveKnotInsertionRead {
  const parsed: BaroCadSourceCurveKnotInsertionRead = readers.parse(text);
  const copied: BaroCadSourceCurveKnotInsertionRead = readers.read(owned);
  const native: SourceCurveKnotInsertionResult = parsed.native;
  const validationReport: SourceCurveKnotInsertionReport = parsed.validationReport;
  const profile: SourceCurveKnotIngestionProfile = parsed.profile;
  const sourceText: string | null = parsed.sourceText;
  const ownedSourceText: string | null = copied.sourceText;
  const schema: 'barocss-source-curve-knot-insertion-ingestion' = profile.schema;
  const version: 0 = profile.version;
  const nativeSchema: 'barocss-source-curve-knot-insertion-report' = profile.nativeSchema;
  const nativeVersion: 0 = profile.nativeVersion;
  const sourceFrame: 'authored-xyz-no-axis-conversion' = profile.sourceFrame;
  const lengthUnit: 'mm' = profile.lengthUnit;
  const parameterFrame: 'original-native-curve-parameter' = profile.parameterFrame;
  const ownership: 'independent-copied-cpu-data-gc' = profile.ownership;
  const textLimit: 2097152 = profile.limits.utf8Bytes;
  const values: 1048576 = profile.limits.values;
  const nativeSourceInsertion: true = profile.capabilities.nativeSourceInsertion;
  const copiedWholeReceipt: true = profile.capabilities.copiedWholeReceipt;
  const renderer: false = profile.capabilities.renderer;
  const genericRefinement: false = profile.capabilities.genericRefinement;
  const globalShape: false = profile.capabilities.globalShape;
  const globalBinary64: false = profile.capabilities.globalBinary64;
  const topology: false = profile.capabilities.topology;
  const solid: false = profile.capabilities.solid;
  const originalSource: string = native.request.source;
  const candidateSource: string = native.source;
  const maximumObservations: 128 = native.request.maximumObservations;
  const parameterMap: { kind: 'identity'; formula: 'u=t'; d1Factor: 1 } = native.provenance.parameterMap;
  const originalCurve: SourceCurveKnotInsertionResult['originalCurve'] = native.originalCurve;
  const refinedCurve: SourceCurveKnotInsertionResult['curve'] = native.curve;
  const patch: SourceCurveKnotInsertionResult['provenance']['patches'][number] = native.provenance.patches[0];
  const patchField: 'knots' | 'control-points' | 'weights' = patch.field;
  for (const observation of native.report.observations) {
    const parameter: number = observation.parameter;
    const difference: number | null = observation.relativeDerivativeDifference;
    if (observation.refinedD1.status === 'evaluated') {
      const actualD1: CurveD1Result = observation.refinedD1.value;
      const actualDerivative: CurveD1Result['derivative'] = actualD1.derivative;
      void actualDerivative;
    } else {
      const refused: null = observation.refinedD1.value;
      const reason: string = observation.refinedD1.reason;
      void [refused, reason];
    }
    void [parameter, difference];
  }
  void [validationReport, schema, version, nativeSchema, nativeVersion, sourceFrame,
    lengthUnit, parameterFrame, ownership, textLimit, values, nativeSourceInsertion,
    copiedWholeReceipt, renderer, genericRefinement, globalShape, globalBinary64,
    topology, solid, sourceText, ownedSourceText, originalSource, candidateSource,
    maximumObservations, parameterMap, originalCurve, refinedCurve, patchField,
    native.originalModel, native.model, native.provenance.homogeneousSteps,
    native.provenance.unchangedPoles, native.provenance.unchangedKnots];
  return parsed;
}

export function consumeSourceCurveKnotErrors(error: unknown): BaroCadSourceCurveKnotInsertionDiagnosticCode | null {
  if (!(error instanceof BaroCadSourceCurveKnotInsertionReadError)) return null;
  const code: BaroCadSourceCurveKnotInsertionDiagnosticCode = error.code;
  const cause: unknown = error.cause;
  const codes: readonly BaroCadSourceCurveKnotInsertionDiagnosticCode[] = [
    BaroCadSourceCurveKnotInsertionDiagnosticCode.INPUT,
    BaroCadSourceCurveKnotInsertionDiagnosticCode.JSON,
    BaroCadSourceCurveKnotInsertionDiagnosticCode.OWNED,
    BaroCadSourceCurveKnotInsertionDiagnosticCode.BUDGET,
    BaroCadSourceCurveKnotInsertionDiagnosticCode.SCHEMA,
    BaroCadSourceCurveKnotInsertionDiagnosticCode.NATIVE,
  ];
  void [cause, codes];
  return code;
}

/** Same-value writes test readonly, not a mismatched literal type. */
export function consumeSourceCurveKnotReadonlyCanaries(profile: SourceCurveKnotIngestionProfile): void {
  if (false) {
    // @ts-expect-error Fixed profile metadata is readonly.
    profile.version = profile.version;
    // @ts-expect-error Nested fixed limits are readonly.
    profile.limits.utf8Bytes = profile.limits.utf8Bytes;
    // @ts-expect-error Nested capability metadata is readonly.
    profile.capabilities.renderer = profile.capabilities.renderer;
  }
}
