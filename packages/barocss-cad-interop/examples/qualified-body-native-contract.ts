import {
  parseBaroCadQualifiedTranslatedStripBody,
  readBaroCadQualifiedTranslatedStripBody,
  BaroCadQualifiedBodyReadError,
  BaroCadQualifiedBodyDiagnosticCode,
  type BaroCadQualifiedBodyRead,
  type BaroCadQualifiedBodyDiagnosticCode as DiagnosticCode,
} from '@barocss/cad-interop/qualified-body';
import type {
  QualifiedTranslatedStripBodyResult,
  QualifiedTranslatedStripBodyReport,
} from '@barocss/cad';

export function qualifiedBodyContract(text: string, owned: unknown): BaroCadQualifiedBodyRead[] {
  const parsed: BaroCadQualifiedBodyRead = parseBaroCadQualifiedTranslatedStripBody(text);
  const copied: BaroCadQualifiedBodyRead = readBaroCadQualifiedTranslatedStripBody(owned);
  const native: QualifiedTranslatedStripBodyResult = parsed.native;
  const validation: QualifiedTranslatedStripBodyReport = parsed.validationReport;
  const source: string | null = copied.sourceText;
  const code: DiagnosticCode = BaroCadQualifiedBodyDiagnosticCode.NATIVE;
  const error: BaroCadQualifiedBodyReadError = new BaroCadQualifiedBodyReadError(code, 'type checkpoint');
  const profile = parsed.profile;
  void [native.models[0].model.objects, native.models[1].model.objects,
    native.faces[0].supportRef, native.edges[0].curveRef,
    native.proof.material, native.report.quality.restrictedSolid,
    validation.workScope, source, error.code, error.cause,
    profile.schema, profile.version, profile.nativeSchema, profile.nativeVersion,
    profile.limits.values, profile.capabilities.nativeRestrictedBody,
    profile.capabilities.renderer, profile.capabilities.url];
  return [parsed, copied];
}
