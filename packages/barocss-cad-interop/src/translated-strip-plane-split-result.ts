import { validateTranslatedStripPlaneSplit } from '@barocss/cad';
import type { TranslatedStripPlaneSplitResult, TranslatedStripPlaneSplitReport } from '@barocss/cad';
import {
  TRANSLATED_STRIP_PLANE_SPLIT_LIMITS,
  BaroCadTranslatedStripPlaneSplitReadError,
  parseTranslatedStripPlaneSplitJson,
  copyTranslatedStripPlaneSplitOwnData,
} from './translated-strip-plane-split-result-json.js';

export {
  BaroCadTranslatedStripPlaneSplitReadError,
  BaroCadTranslatedStripPlaneSplitDiagnosticCode,
} from './translated-strip-plane-split-result-json.js';

const PROFILE = Object.freeze({
  schema: 'barocss-translated-strip-plane-split-result-ingestion',
  version: 0,
  nativeSchema: 'barocss-translated-strip-plane-split',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  lengthUnit: 'mm',
  parameterFrame: 'retained-original-curve-and-surface-domains-with-dimensionless-uv',
  sourceQualification: 'retained-source-field-component-index-and-original-model-selection',
  ownership: 'independent-copied-cpu-data-gc',
  limits: TRANSLATED_STRIP_PLANE_SPLIT_LIMITS,
  capabilities: Object.freeze({
    nativeWholeValidation: true,
    copiedWholeReceipt: true,
    renderer: false,
    url: false,
    byteInput: false,
    publicSerializer: false,
    dispose: false,
    sourceEdit: false,
    sampling: false,
    bodyConstruction: false,
    splitOperation: false,
    genericSplitBody: false,
    arbitraryPlaneCut: false,
    booleanOperation: false,
    globalError: false,
    newSolid: false,
    manufacturing: false,
    persistentNaming: false,
    editor: false,
    publication: false,
  } as const),
} as const);

/** Complete supplied result with a separate actual whole-validation report. */
export interface BaroCadTranslatedStripPlaneSplitResultRead {
  native: TranslatedStripPlaneSplitResult;
  validationReport: TranslatedStripPlaneSplitReport;
  /** Frozen metadata only; native data and report remain independently mutable. */
  profile: typeof PROFILE;
  /** Entire admitted text, unchanged; null for owned-data admission. */
  sourceText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Check only after descriptor-safe copying. The discriminator belongs to the report. */
function requireNativeSchema(value: unknown): asserts value is TranslatedStripPlaneSplitResult {
  const fields = ['request', 'cutModel', 'proof', 'outputs', 'bindings', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadTranslatedStripPlaneSplitReadError(
      'SCHEMA', 'A complete translated strip Plane Split result record with the exact six fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadTranslatedStripPlaneSplitReadError(
      'SCHEMA', 'The native translated strip Plane Split report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadTranslatedStripPlaneSplitResultRead {
  const native = copyTranslatedStripPlaneSplitOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: TranslatedStripPlaneSplitReport;
  try {
    actualReport = validateTranslatedStripPlaneSplit(native);
  } catch (cause) {
    throw new BaroCadTranslatedStripPlaneSplitReadError(
      'NATIVE', 'Whole native translated strip Plane Split validation refused the copied data', cause);
  }
  // Codec failures during report copying retain their own code and cause.
  const validationReport = copyTranslatedStripPlaneSplitOwnData(actualReport).value as TranslatedStripPlaneSplitReport;
  return { native, validationReport, profile: PROFILE, sourceText };
}

/** Copy and whole-validate complete saved results without a direct split operation. */
export function parseBaroCadTranslatedStripPlaneSplitResult(text: string): BaroCadTranslatedStripPlaneSplitResultRead {
  if (typeof text !== 'string') {
    throw new BaroCadTranslatedStripPlaneSplitReadError('INPUT', 'Translated strip Plane Split result text must be a string');
  }
  return admit(parseTranslatedStripPlaneSplitJson(text).value, text);
}

/** Independently copy and whole-validate the complete supplied result on every call. */
export function readBaroCadTranslatedStripPlaneSplitResult(input: unknown): BaroCadTranslatedStripPlaneSplitResultRead {
  if (!isRecord(input)) {
    throw new BaroCadTranslatedStripPlaneSplitReadError('INPUT', 'Translated strip Plane Split result owned data must be a record');
  }
  return admit(input, null);
}
