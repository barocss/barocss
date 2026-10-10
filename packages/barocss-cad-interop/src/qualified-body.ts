import { validateQualifiedTranslatedStripBody } from '@barocss/cad';
import type { QualifiedTranslatedStripBodyReport, QualifiedTranslatedStripBodyResult } from '@barocss/cad';
import {
  BaroCadQualifiedBodyReadError,
  QUALIFIED_BODY_LIMITS,
  copyQualifiedBodyOwnData,
  parseQualifiedBodyJson,
} from './qualified-body-json.js';

export { BaroCadQualifiedBodyDiagnosticCode, BaroCadQualifiedBodyReadError } from './qualified-body-json.js';

const PROFILE = Object.freeze({
  schema: 'barocss-qualified-translated-strip-body-ingestion',
  version: 0,
  nativeSchema: 'barocss-qualified-translated-strip-body',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  lengthUnit: 'mm',
  volumeUnit: 'mm3',
  uvLengthUnit: 'dimensionless',
  ownership: 'independent-copied-cpu-data-gc',
  limits: QUALIFIED_BODY_LIMITS,
  capabilities: Object.freeze({
    nativeRestrictedBody: true,
    renderer: false,
    url: false,
    byteInput: false,
    genericSolid: false,
    boolean: false,
    worldPointQuery: false,
    manufacturing: false,
    exchange: false,
    publication: false,
  } as const),
} as const);

/** Complete native CPU data and a separate report from whole Body validation. */
export interface BaroCadQualifiedBodyRead {
  native: QualifiedTranslatedStripBodyResult;
  validationReport: QualifiedTranslatedStripBodyReport;
  /** Shared metadata only; every nested profile record is frozen. */
  profile: typeof PROFILE;
  /** Exact admitted text, or null when the input was owned data. */
  sourceText: string | null;
}

const BODY_FIELDS = [
  'base', 'ends', 'volume', 'options', 'models', 'vertices', 'edges',
  'faces', 'shell', 'body', 'proof', 'observations', 'report',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Dispatch only after the codec has copied and checked all own data. */
function requireNativeSchema(value: unknown): asserts value is QualifiedTranslatedStripBodyResult {
  if (!isRecord(value) || Object.keys(value).length !== BODY_FIELDS.length ||
      !BODY_FIELDS.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadQualifiedBodyReadError('SCHEMA', 'A complete qualified Body record with the exact 13 fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadQualifiedBodyReadError('SCHEMA', 'The native qualified Body report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadQualifiedBodyRead {
  const native = copyQualifiedBodyOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: QualifiedTranslatedStripBodyReport;
  try {
    actualReport = validateQualifiedTranslatedStripBody(native);
  } catch (cause) {
    throw new BaroCadQualifiedBodyReadError('NATIVE', 'Whole native qualified Body validation refused the copied data', cause);
  }
  // Keep the actual validator report separate from the supplied native graph.
  const validationReport = copyQualifiedBodyOwnData(actualReport).value as QualifiedTranslatedStripBodyReport;
  return { native, validationReport, profile: PROFILE, sourceText };
}

/** Read strict finite JSON while retaining the exact original text and native number bits. */
export function parseBaroCadQualifiedTranslatedStripBody(text: string): BaroCadQualifiedBodyRead {
  if (typeof text !== 'string') {
    throw new BaroCadQualifiedBodyReadError('INPUT', 'Qualified Body text must be a string');
  }
  return admit(parseQualifiedBodyJson(text).value, text);
}

/** Copy complete owned Body data before schema dispatch and whole native validation. */
export function readBaroCadQualifiedTranslatedStripBody(input: unknown): BaroCadQualifiedBodyRead {
  if (!isRecord(input)) {
    throw new BaroCadQualifiedBodyReadError('INPUT', 'Qualified Body owned data must be a record');
  }
  return admit(input, null);
}
