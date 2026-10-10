/** Compilation-only public consumer. These functions are never invoked by this example. */
import {
  parseBaroCadSourceKnotAlignedLoft,
  readBaroCadSourceKnotAlignedLoft,
  BaroCadSourceKnotAlignedLoftReadError,
  BaroCadSourceKnotAlignedLoftDiagnosticCode,
} from '@barocss/cad-interop/source-knot-aligned-loft';
import type {
  BaroCadSourceKnotAlignedLoftRead,
  BaroCadSourceKnotAlignedLoftDiagnosticCode as DiagnosticCode,
} from '@barocss/cad-interop/source-knot-aligned-loft';
import type {
  SourceKnotAlignedLoftRequest,
  SourceKnotAlignedLoftResult,
  SourceKnotAlignedLoftReport,
  Model,
  Curve,
  CurveD1Result,
  SurfaceD1Result,
} from '@barocss/cad';

export function consumeWholeLoft(text: string, owned: unknown): BaroCadSourceKnotAlignedLoftRead {
  const parsed: BaroCadSourceKnotAlignedLoftRead = parseBaroCadSourceKnotAlignedLoft(text);
  const copied: BaroCadSourceKnotAlignedLoftRead = readBaroCadSourceKnotAlignedLoft(owned);
  const native: SourceKnotAlignedLoftResult = parsed.native;
  const report: SourceKnotAlignedLoftReport = parsed.validationReport;
  const request: SourceKnotAlignedLoftRequest = native.request;
  const exactText: string | null = parsed.sourceText;
  const copiedText: string | null = copied.sourceText;
  const nativeSchema: 'barocss-source-knot-aligned-loft-report' = report.schema;
  const sourceVersion: 0 = native.originalSources[0].sourceVersion;
  const originalModel: Model = native.originalSources[0].model;
  const alignedModel: Model = native.alignedSections[0].model;
  const constructedModel: Model = native.loft.model;
  const constructedCurve: Curve = native.loft.sections[0];
  const threeSourceIds: [string, string, string] = report.sourceIds;
  const authoredV: [number, number, number] = request.parametersV;
  const selectedId: string = native.bindings.sections[0].original.curveId;
  const sourceNamespace: string = native.bindings.sections[0].original.sourceId;
  const constructionNamespace: string = native.bindings.sections[0].construction.sourceId;
  const outputIndex: 3 = native.bindings.output.objectIndex;
  const coefficientsIdentical: true = native.bindings.sections[0].coefficientsIdenticalToAligned;

  for (const insertion of native.insertions) {
    const completeSource: string = insertion.result.source;
    const completeOriginal: Model = insertion.result.originalModel;
    const completeCandidate: Model = insertion.result.model;
    const selectedOriginal: Curve = insertion.result.originalCurve;
    const selectedCandidate: Curve = insertion.result.curve;
    const mapFormula: 'u=t' = insertion.result.provenance.parameterMap.formula;
    for (const patch of insertion.result.provenance.patches) {
      const startUTF16: number = patch.startUTF16;
      const endUTF16: number = patch.endUTF16;
      const originalText: string = patch.originalText;
      const replacementText: string = patch.replacementText;
      void [startUTF16, endUTF16, originalText, replacementText];
    }
    for (const observation of insertion.result.report.observations) {
      for (const state of [observation.originalD1, observation.refinedD1]) {
        if (state.status === 'evaluated') {
          const derivative: CurveD1Result = state.value;
          const component: number = derivative.derivative[0];
          void component;
        } else {
          const refused: null = state.value;
          const reason: string = state.reason;
          void [refused, reason];
        }
      }
    }
    void [completeSource, completeOriginal, completeCandidate, selectedOriginal, selectedCandidate, mapFormula];
  }
  for (const observation of native.loft.report.derivativeObservations) {
    if (observation.result.kind === 'evaluated') {
      const derivative: SurfaceD1Result = observation.result.result;
      const pointComponent: number = derivative.point[0];
      const duComponent: number = derivative.du[0];
      const dvComponent: number = derivative.dv[0];
      // @ts-expect-error Surface D1 exposes point/du/dv, not a normal field.
      derivative.normal;
      void [pointComponent, duComponent, dvComponent];
    } else {
      const refusedMessage: string = observation.result.message;
      // @ts-expect-error This actual Loft refusal has a message and no invented value:null.
      observation.result.value;
      void refusedMessage;
    }
  }

  // Public CPU data remains mutable; only profile metadata is readonly.
  native.loft.surface.controlPoints[0][0][2] = native.loft.surface.controlPoints[0][0][2];
  native.request.assets[0].source = native.request.assets[0].source;
  report.insertionCount = report.insertionCount;
  report.quality.globalShapeErrorCertified = false;
  parsed.native = native;
  parsed.validationReport = report;
  void [request, exactText, copiedText, nativeSchema, sourceVersion, originalModel, alignedModel, constructedModel, constructedCurve, threeSourceIds, authoredV, selectedId, sourceNamespace, constructionNamespace, outputIndex, coefficientsIdentical];
  return copied;
}

export function consumeProfile(value: BaroCadSourceKnotAlignedLoftRead): void {
  const profile: BaroCadSourceKnotAlignedLoftRead['profile'] = value.profile;
  const schema: 'barocss-source-knot-aligned-loft-ingestion' = profile.schema;
  const version: 0 = profile.version;
  const nativeSchema: 'barocss-source-knot-aligned-loft-report' = profile.nativeSchema;
  const nativeVersion: 0 = profile.nativeVersion;
  const sourceFrame: 'authored-xyz-no-axis-conversion' = profile.sourceFrame;
  const units: 'mm' = profile.lengthUnit;
  const parameters: 'original-native-curve-u-and-authored-loft-v' = profile.parameterFrame;
  const ownership: 'independent-copied-cpu-data-gc' = profile.ownership;
  const limits: readonly [16777216, 16777216, 4194304, 64, 64, 8192, 262144, 128] = [
    profile.limits.utf8Bytes, profile.limits.utf16Units, profile.limits.values,
    profile.limits.depth, profile.limits.recordFields, profile.limits.arrayElements,
    profile.limits.stringUnits, profile.limits.keyUnits,
  ];
  const capabilities: readonly [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] = [
    profile.capabilities.nativeWholeValidation, profile.capabilities.copiedWholeReceipt,
    profile.capabilities.renderer, profile.capabilities.url, profile.capabilities.byteInput,
    profile.capabilities.publicSerializer, profile.capabilities.dispose, profile.capabilities.sourceEdit,
    profile.capabilities.sampling, profile.capabilities.genericLoft, profile.capabilities.genericRefinement,
    profile.capabilities.globalShape, profile.capabilities.globalBinary64, profile.capabilities.g1g2,
    profile.capabilities.topology, profile.capabilities.solid, profile.capabilities.manufacturing,
    profile.capabilities.editorDisplay, profile.capabilities.persistentTopology, profile.capabilities.publication,
  ];
  // Same-value assignments test readonly declarations, not a different literal value.
  // @ts-expect-error Profile schema is readonly.
  profile.schema = 'barocss-source-knot-aligned-loft-ingestion';
  // @ts-expect-error Nested limits are readonly.
  profile.limits.utf8Bytes = 16777216;
  // @ts-expect-error Per-pass work metadata is readonly.
  profile.limits.values = 4194304;
  // @ts-expect-error Nested positive capability is readonly.
  profile.capabilities.nativeWholeValidation = true;
  // @ts-expect-error Renderer remains readonly false metadata.
  profile.capabilities.renderer = false;
  // @ts-expect-error No mutable source-edit capability.
  profile.capabilities.sourceEdit = false;
  // @ts-expect-error Publication remains readonly false metadata.
  profile.capabilities.publication = false;
  void [schema, version, nativeSchema, nativeVersion, sourceFrame, units, parameters, ownership, limits, capabilities];
}

export function consumeErrors(cause: unknown): DiagnosticCode[] {
  const codes: DiagnosticCode[] = [
    BaroCadSourceKnotAlignedLoftDiagnosticCode.INPUT,
    BaroCadSourceKnotAlignedLoftDiagnosticCode.JSON,
    BaroCadSourceKnotAlignedLoftDiagnosticCode.OWNED,
    BaroCadSourceKnotAlignedLoftDiagnosticCode.BUDGET,
    BaroCadSourceKnotAlignedLoftDiagnosticCode.SCHEMA,
    BaroCadSourceKnotAlignedLoftDiagnosticCode.NATIVE,
  ];
  const error = new BaroCadSourceKnotAlignedLoftReadError('NATIVE', 'Actual original cause', cause);
  const actualCode: DiagnosticCode = error.code;
  const exactCause: unknown = error.cause;
  // @ts-expect-error FILE is a CAD phase, not a public reader diagnostic code.
  const unsupportedCode: DiagnosticCode = 'FILE';
  // @ts-expect-error Public parsing accepts text, not an owned record.
  parseBaroCadSourceKnotAlignedLoft({});
  // @ts-expect-error This reader exposes no caller options or custom budgets.
  parseBaroCadSourceKnotAlignedLoft('{}', { maximumValues: 10 });
  // @ts-expect-error This reader exposes no extra options on owned admission.
  readBaroCadSourceKnotAlignedLoft({}, { maximumValues: 10 });
  void [actualCode, exactCause, unsupportedCode];
  return codes;
}
