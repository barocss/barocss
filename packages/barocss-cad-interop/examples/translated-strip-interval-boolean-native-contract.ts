import {
  parseBaroCadTranslatedStripIntervalBoolean,
  readBaroCadTranslatedStripIntervalBoolean,
  BaroCadTranslatedStripIntervalBooleanReadError,
  BaroCadTranslatedStripIntervalBooleanDiagnosticCode,
} from '@barocss/cad-interop/translated-strip-interval-boolean';
import type { BaroCadTranslatedStripIntervalBooleanRead } from '@barocss/cad-interop/translated-strip-interval-boolean';
import type {
  TranslatedStripIntervalBooleanResult, TranslatedStripIntervalBooleanReport,
  TranslatedStripIntervalBooleanOptions, TranslatedStripIntervalBooleanOutput,
  QualifiedTranslatedStripBodyResult,
} from '@barocss/cad';

/** Importing this declaration consumer calls no reader. */
export const readers: {
  parse: (text: string) => BaroCadTranslatedStripIntervalBooleanRead;
  read: (input: unknown) => BaroCadTranslatedStripIntervalBooleanRead;
} = { parse: parseBaroCadTranslatedStripIntervalBoolean, read: readBaroCadTranslatedStripIntervalBoolean };
export type IntervalBooleanProfile = BaroCadTranslatedStripIntervalBooleanRead['profile'];

export function consumeIntervalBooleanDeclarations(text: string, owned: TranslatedStripIntervalBooleanResult): BaroCadTranslatedStripIntervalBooleanRead {
  const parsed: BaroCadTranslatedStripIntervalBooleanRead = readers.parse(text);
  const copied: BaroCadTranslatedStripIntervalBooleanRead = readers.read(owned);
  const native: TranslatedStripIntervalBooleanResult = parsed.native;
  const validationReport: TranslatedStripIntervalBooleanReport = parsed.validationReport;
  const options: TranslatedStripIntervalBooleanOptions = native.options;
  const sourceText: string | null = parsed.sourceText;
  const ownedSourceText: string | null = copied.sourceText;
  const schema: 'barocss-translated-strip-interval-boolean-ingestion' = parsed.profile.schema;
  const nativeSchema: 'barocss-translated-strip-interval-boolean' = parsed.profile.nativeSchema;
  const version: 0 = parsed.profile.version;
  const nativeVersion: 0 = parsed.profile.nativeVersion;
  const sourceFrame: 'authored-xyz-no-axis-conversion' = parsed.profile.sourceFrame;
  const lengthUnit: 'mm' = parsed.profile.lengthUnit;
  const volumeUnit: 'mm3' = parsed.profile.volumeUnit;
  const uvLengthUnit: 'dimensionless' = parsed.profile.uvLengthUnit;
  const ownership: 'independent-copied-cpu-data-gc' = parsed.profile.ownership;
  const byteLimit: 12582912 = parsed.profile.limits.utf8Bytes;
  const occurrenceLimit: 4194304 = parsed.profile.limits.values;
  const nativeIntervalBoolean: true = parsed.profile.capabilities.nativeIntervalBoolean;
  const copiedWholeReceipt: true = parsed.profile.capabilities.copiedWholeReceipt;
  const renderer: false = parsed.profile.capabilities.renderer;
  const genericBoolean: false = parsed.profile.capabilities.genericBoolean;
  const arbitraryCurvedSolid: false = parsed.profile.capabilities.arbitraryCurvedSolid;
  const body: QualifiedTranslatedStripBodyResult = native.a;
  const otherBody: QualifiedTranslatedStripBodyResult = native.b;
  const materialCertificateId: string = body.proof.material.certificateId;
  const modelObjects: QualifiedTranslatedStripBodyResult['models'][number]['model']['objects'] = body.models[0].model.objects;
  const totalNumerator: string = native.total.exactVolumeMM3.numerator;
  const empty: boolean = validationReport.empty;
  const slab = native.proof.plan.slabs[0];
  const selected: boolean = slab.selected;
  const midpointNumerator: string = slab.midpointOffsetY.numerator;
  const originalEndpointSource: string = native.proof.plan.endpointGroups[0].selectedDonor.sourceId;
  for (const output of native.outputs) {
    const actualOutput: TranslatedStripIntervalBooleanOutput = output;
    const completeBody: QualifiedTranslatedStripBodyResult = output.body;
    const sourceId: string = output.lower.sourceId;
    const surfaceId: string = output.upper.surfaceId;
    const intervalNumerator: string = output.interval.width.numerator;
    const bodyOptions: TranslatedStripIntervalBooleanOutput['recipe']['body'] = output.recipe.body;
    void [actualOutput, completeBody, sourceId, surfaceId, intervalNumerator, bodyOptions];
  }
  void [validationReport, options, sourceText, ownedSourceText, schema, nativeSchema, version, nativeVersion,
    sourceFrame, lengthUnit, volumeUnit, uvLengthUnit, ownership, byteLimit, occurrenceLimit,
    nativeIntervalBoolean, copiedWholeReceipt, renderer, genericBoolean, arbitraryCurvedSolid, body,
    otherBody, materialCertificateId, modelObjects, totalNumerator, empty, selected, midpointNumerator,
    originalEndpointSource, native.proof.commonMap, native.proof.generatedIds, native.proof.outputVolumeChecks,
    native.proof.volumeAccounting];
  return parsed;
}

export function consumeIntervalBooleanError(error: unknown): BaroCadTranslatedStripIntervalBooleanDiagnosticCode | null {
  if (!(error instanceof BaroCadTranslatedStripIntervalBooleanReadError)) return null;
  const code: BaroCadTranslatedStripIntervalBooleanDiagnosticCode = error.code;
  const cause: unknown = error.cause;
  const codes: readonly BaroCadTranslatedStripIntervalBooleanDiagnosticCode[] = [
    BaroCadTranslatedStripIntervalBooleanDiagnosticCode.INPUT,
    BaroCadTranslatedStripIntervalBooleanDiagnosticCode.JSON,
    BaroCadTranslatedStripIntervalBooleanDiagnosticCode.OWNED,
    BaroCadTranslatedStripIntervalBooleanDiagnosticCode.BUDGET,
    BaroCadTranslatedStripIntervalBooleanDiagnosticCode.SCHEMA,
    BaroCadTranslatedStripIntervalBooleanDiagnosticCode.NATIVE,
  ];
  void [cause, codes]; return code;
}

export function consumeReadonlyMetadata(profile: IntervalBooleanProfile): void {
  if (false) {
    // @ts-expect-error Fixed profile is readonly; this is a same-value write.
    profile.version = profile.version;
    // @ts-expect-error Nested fixed limits are readonly.
    profile.limits.utf8Bytes = profile.limits.utf8Bytes;
    // @ts-expect-error Nested capability metadata is readonly.
    profile.capabilities.renderer = profile.capabilities.renderer;
  }
}
