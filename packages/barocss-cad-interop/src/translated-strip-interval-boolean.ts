import { validateTranslatedStripIntervalBoolean } from '@barocss/cad';
import type { TranslatedStripIntervalBooleanReport, TranslatedStripIntervalBooleanResult } from '@barocss/cad';
import {
  TRANSLATED_STRIP_INTERVAL_BOOLEAN_LIMITS,
  BaroCadTranslatedStripIntervalBooleanReadError,
  parseTranslatedStripIntervalBooleanJson,
  copyTranslatedStripIntervalBooleanOwnData,
} from './translated-strip-interval-boolean-json.js';

export {
  BaroCadTranslatedStripIntervalBooleanReadError,
  BaroCadTranslatedStripIntervalBooleanDiagnosticCode,
} from './translated-strip-interval-boolean-json.js';

const PROFILE = Object.freeze({
  schema: 'barocss-translated-strip-interval-boolean-ingestion',
  version: 0,
  nativeSchema: 'barocss-translated-strip-interval-boolean',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  lengthUnit: 'mm',
  volumeUnit: 'mm3',
  uvLengthUnit: 'dimensionless',
  ownership: 'independent-copied-cpu-data-gc',
  limits: TRANSLATED_STRIP_INTERVAL_BOOLEAN_LIMITS,
  capabilities: Object.freeze({
    nativeIntervalBoolean: true,
    copiedWholeReceipt: true,
    renderer: false,
    url: false,
    byteInput: false,
    publicSerializer: false,
    dispose: false,
    genericBoolean: false,
    arbitraryCurvedSolid: false,
    globalC1: false,
    globalBinary64: false,
    manufacturing: false,
    publication: false,
  } as const),
} as const);

export interface BaroCadTranslatedStripIntervalBooleanRead {
  /** Complete copied receipt, including both operands and any qualified output Bodies. */
  native: TranslatedStripIntervalBooleanResult;
  /** Independently copied report returned by the actual whole-result validator. */
  validationReport: TranslatedStripIntervalBooleanReport;
  profile: typeof PROFILE;
  /** Exact admitted JSON text; null when reading owned data. */
  sourceText: string | null;
}

function codec<T>(action: () => T): T {
  try {
    return action();
  } catch (cause) {
    if (cause instanceof BaroCadTranslatedStripIntervalBooleanReadError) {
      throw new BaroCadTranslatedStripIntervalBooleanReadError(cause.code, cause.message, cause);
    }
    throw cause;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Route only after descriptor-safe copying; the native report owns the discriminator. */
function requireNativeSchema(value: unknown): asserts value is TranslatedStripIntervalBooleanResult {
  const fields = ['a', 'b', 'options', 'proof', 'outputs', 'total', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadTranslatedStripIntervalBooleanReadError(
      'SCHEMA', 'A complete interval Boolean record with the exact seven fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadTranslatedStripIntervalBooleanReadError(
      'SCHEMA', 'The native interval Boolean report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadTranslatedStripIntervalBooleanRead {
  const native = codec(() => copyTranslatedStripIntervalBooleanOwnData(value)).value;
  requireNativeSchema(native);
  let actualReport: TranslatedStripIntervalBooleanReport;
  try {
    actualReport = validateTranslatedStripIntervalBoolean(native);
  } catch (cause) {
    throw new BaroCadTranslatedStripIntervalBooleanReadError(
      'NATIVE', 'Whole native interval Boolean validation refused the copied data', cause);
  }
  const validationReport = codec(() => copyTranslatedStripIntervalBooleanOwnData(actualReport))
    .value as TranslatedStripIntervalBooleanReport;
  return { native, validationReport, profile: PROFILE, sourceText };
}

/** Read the complete saved receipt while preserving its exact original JSON text. */
export function parseBaroCadTranslatedStripIntervalBoolean(text: string): BaroCadTranslatedStripIntervalBooleanRead {
  if (typeof text !== 'string') {
    throw new BaroCadTranslatedStripIntervalBooleanReadError('INPUT', 'Interval Boolean text must be a string');
  }
  return admit(codec(() => parseTranslatedStripIntervalBooleanJson(text)).value, text);
}

/** Copy and validate the complete owned receipt; no cached mutable admission token is used. */
export function readBaroCadTranslatedStripIntervalBoolean(input: unknown): BaroCadTranslatedStripIntervalBooleanRead {
  if (!isRecord(input)) {
    throw new BaroCadTranslatedStripIntervalBooleanReadError('INPUT', 'Interval Boolean input must be a record');
  }
  return admit(input, null);
}
